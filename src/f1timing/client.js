const https      = require('https');
const http       = require('http');
const net        = require('net');
const WebSocket  = require('ws');
const { decompress } = require('./decompress');
const state = require('./state');

const BASE_URL = 'livetiming.formula1.com';
const HUB      = 'streaming';
const PROTOCOL = '1.5';

// Optional HTTP CONNECT proxy (residential IP to bypass CloudFront WAF).
// Set F1_PROXY_URL=http://user:pass@host:port in env.
const PROXY_URL = process.env.F1_PROXY_URL ? new URL(process.env.F1_PROXY_URL) : null;

function buildTunnel(targetHost, targetPort) {
  return new Promise((resolve, reject) => {
    const proxyPort = parseInt(PROXY_URL.port) || 80;
    const conn = net.createConnection(proxyPort, PROXY_URL.hostname, () => {
      const auth = PROXY_URL.username
        ? `Proxy-Authorization: Basic ${Buffer.from(`${PROXY_URL.username}:${PROXY_URL.password}`).toString('base64')}\r\n`
        : '';
      conn.write(`CONNECT ${targetHost}:${targetPort} HTTP/1.1\r\nHost: ${targetHost}:${targetPort}\r\n${auth}\r\n`);
    });
    let buf = '';
    conn.on('data', chunk => {
      buf += chunk.toString();
      if (buf.includes('\r\n\r\n')) {
        if (buf.startsWith('HTTP/1.1 200') || buf.startsWith('HTTP/1.0 200')) {
          conn.removeAllListeners('data');
          resolve(conn);
        } else {
          reject(new Error(`Proxy CONNECT failed: ${buf.split('\r\n')[0]}`));
        }
      }
    });
    conn.on('error', reject);
    conn.setTimeout(10000, () => reject(new Error('Proxy CONNECT timeout')));
  });
}

const TOPICS = [
  'Heartbeat',
  'CarData.z',
  'Position.z',
  'ExtrapolatedClock',
  'TopThree',
  'TimingStats',
  'TimingAppData',
  'WeatherData',
  'TrackStatus',
  'DriverList',
  'RaceControlMessages',
  'SessionInfo',
  'SessionData',
  'LapCount',
  'TimingData',
  'TeamRadio',
];

const CONNECTION_DATA     = JSON.stringify([{ name: HUB }]);
const CONNECTION_DATA_ENC = encodeURIComponent(CONNECTION_DATA);

const BASE_HEADERS = {
  'User-Agent':      'BestHTTP',
  'Accept-Encoding': 'gzip, identity',
  'Accept':          'application/json, text/plain, */*',
  'Origin':          'https://www.formula1.com',
};

let ws             = null;
let msgCounter     = 1;
let reconnectTimer = null;
let reconnectDelay = 2000;
let stopped        = false;

// ── Helpers ───────────────────────────────────────────────────────────────────
async function httpsGet(path, extraHeaders = {}) {
  const options = {
    hostname: BASE_URL,
    port: 443,
    path,
    method: 'GET',
    headers: { ...BASE_HEADERS, ...extraHeaders },
  };

  if (PROXY_URL) {
    const socket = await buildTunnel(BASE_URL, 443);
    options.socket = socket;
    options.agent  = false;
  }

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', c => (body += c));
      res.on('end', () => resolve({ body, headers: res.headers, statusCode: res.statusCode }));
    });
    req.on('error', reject);
    req.end();
  });
}

function parseCookies(rawHeaders) {
  const setCookies = rawHeaders['set-cookie'] || [];
  return setCookies.map(c => c.split(';')[0]).join('; ');
}

// ── Negotiate ────────────────────────────────────────────────────────────────
async function negotiate() {
  const path =
    `/signalr/negotiate?clientProtocol=${PROTOCOL}` +
    `&connectionData=${CONNECTION_DATA_ENC}` +
    `&_=${Date.now()}`;

  const { body, headers, statusCode } = await httpsGet(path);
  if (statusCode !== 200) throw new Error(`Negotiate HTTP ${statusCode}: ${body}`);

  const data    = JSON.parse(body);
  const cookies = parseCookies(headers);
  return { ...data, _cookies: cookies };
}

// ── Start (required by SignalR 1.x) ──────────────────────────────────────────
async function signalStart(token, cookies) {
  const path =
    `/signalr/start?clientProtocol=${PROTOCOL}&transport=webSockets` +
    `&connectionData=${CONNECTION_DATA_ENC}` +
    `&connectionToken=${encodeURIComponent(token)}`;

  const extraHeaders = cookies ? { Cookie: cookies } : {};
  const { statusCode } = await httpsGet(path, extraHeaders);
  if (statusCode !== 200) console.warn(`[F1] /start returned HTTP ${statusCode}`);
}

// ── Process an incoming feed message ─────────────────────────────────────────
function processFeedMessage(topic, rawData) {
  const isCompressed = topic.endsWith('.z');
  const data = isCompressed ? decompress(rawData) : rawData;
  if (data == null) return;

  const cleanTopic = isCompressed ? topic.slice(0, -2) : topic;
  state.applyUpdate(cleanTopic, data);
}

function handleMessage(raw) {
  let msg;
  try { msg = JSON.parse(raw); } catch { return; }
  if (Object.keys(msg).length === 0) return; // keepalive ping

  // "R" = subscribe callback — contains initial full state for all topics
  if (msg.R && typeof msg.R === 'object') {
    Object.entries(msg.R).forEach(([topic, data]) => {
      if (data && typeof data === 'object' && Object.keys(data).length > 0) {
        processFeedMessage(topic, data);
      }
    });
  }

  // "M" = ongoing live updates
  if (msg.M && Array.isArray(msg.M)) {
    msg.M.forEach(m => {
      if (m.M === 'feed' && Array.isArray(m.A) && m.A.length >= 2) {
        processFeedMessage(m.A[0], m.A[1]);
      }
    });
  }
}

// ── Connect ──────────────────────────────────────────────────────────────────
async function connect() {
  if (stopped) return;

  let negotiation;
  try {
    console.log('[F1] Negotiating...');
    state.markConnectionPhase('negotiating', {
      attempts: (state.connectionDiagnostics?.attempts || 0) + 1,
      last_error: null,
      last_error_at: null,
    });
    negotiation = await negotiate();
    console.log(`[F1] Token acquired. ID: ${negotiation.ConnectionId}`);
  } catch (err) {
    console.error('[F1] Negotiate failed:', err.message);
    state.markConnectionPhase('negotiate_failed', {
      last_error: err.message,
      last_error_at: new Date().toISOString(),
    });
    scheduleReconnect();
    return;
  }

  const token   = negotiation.ConnectionToken;
  const cookies = negotiation._cookies;

  const wsUrl =
    `wss://${BASE_URL}/signalr/connect` +
    `?clientProtocol=${PROTOCOL}&transport=webSockets` +
    `&connectionData=${CONNECTION_DATA_ENC}` +
    `&connectionToken=${encodeURIComponent(token)}`;

  const wsHeaders = {
    'User-Agent': 'BestHTTP',
    'Origin':     'https://www.formula1.com',
    ...(cookies ? { Cookie: cookies } : {}),
  };

  let wsOptions = { headers: wsHeaders };
  if (PROXY_URL) {
    try {
      wsOptions.socket = await buildTunnel(BASE_URL, 443);
    } catch (err) {
      console.error('[F1] Proxy tunnel failed:', err.message);
      scheduleReconnect();
      return;
    }
  }
  ws = new WebSocket(wsUrl, wsOptions);

  ws.on('open', async () => {
    console.log('[F1] WebSocket connected');
    reconnectDelay = 2000;
    state.markConnectionPhase('websocket_connected', {
      last_connected_at: new Date().toISOString(),
      last_error: null,
      last_error_at: null,
    });

    await signalStart(token, cookies);

    ws.send(JSON.stringify({
      H: HUB,
      M: 'Subscribe',
      A: [TOPICS],
      I: msgCounter++,
    }));
    console.log(`[F1] Subscribed to ${TOPICS.length} topics`);

    state.connected = true;
    state.emit('connected');
  });

  ws.on('message', data => handleMessage(data.toString()));

  ws.on('close', (code, reason) => {
    state.connected = false;
    const reasonText = reason ? reason.toString() : 'no reason';
    console.warn(`[F1] Disconnected (${code}): ${reasonText}`);
    state.markConnectionPhase('websocket_disconnected', {
      last_disconnected_at: new Date().toISOString(),
      last_close_code: code,
      last_close_reason: reasonText,
    });
    state.emit('disconnected');
    scheduleReconnect();
  });

  ws.on('error', err => {
    console.error('[F1] WS error:', err.message);
    state.markConnectionPhase('websocket_error', {
      last_error: err.message,
      last_error_at: new Date().toISOString(),
    });
  });
}

// ── Reconnect with exponential backoff ───────────────────────────────────────
function scheduleReconnect() {
  if (stopped || reconnectTimer) return;
  console.log(`[F1] Reconnecting in ${reconnectDelay / 1000}s...`);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    reconnectDelay = Math.min(reconnectDelay * 2, 30000);
    connect();
  }, reconnectDelay);
}

function start() {
  if (PROXY_URL) console.log(`[F1] Proxy enabled: ${PROXY_URL.hostname}:${PROXY_URL.port}`);
  stopped = false;
  connect();
}

function stop() {
  stopped = true;
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  if (ws) { ws.terminate(); ws = null; }
  state.connected = false;
}

module.exports = { start, stop };
