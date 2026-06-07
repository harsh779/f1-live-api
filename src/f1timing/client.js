const net        = require('net');
const https      = require('https');
const WebSocket  = require('ws');
const { decompress } = require('./decompress');
const state      = require('./state');

const BASE_URL   = 'livetiming.formula1.com';
const HUB_PATH   = '/signalrcore';
const RECORD_SEP = '\x1e';

// Optional HTTP CONNECT proxy (residential IP to bypass CloudFront WAF).
// Set F1_PROXY_URL=http://user:pass@host:port in env.
const PROXY_URL = process.env.F1_PROXY_URL ? new URL(process.env.F1_PROXY_URL) : null;

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
  'AudioStreams',
  'ContentStreams',
];

const BASE_HEADERS = {
  'User-Agent':      'BestHTTP',
  'Accept-Encoding': 'gzip, identity',
  'Accept':          'application/json, text/plain, */*',
  'Origin':          'https://www.formula1.com',
};

let ws             = null;
let reconnectTimer = null;
let reconnectDelay = 2000;
let stopped        = false;
let pingTimer      = null;

// ── Proxy tunnel ──────────────────────────────────────────────────────────────
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

function parseCookies(rawHeaders) {
  const setCookies = rawHeaders['set-cookie'] || [];
  return setCookies.map(c => c.split(';')[0]).join('; ');
}

// ── Negotiate (SignalR Core) ──────────────────────────────────────────────────
function negotiate() {
  return new Promise((resolve, reject) => {
    const body    = JSON.stringify({});
    const options = {
      hostname: BASE_URL,
      port:     443,
      path:     `${HUB_PATH}/negotiate?negotiateVersion=1`,
      method:   'POST',
      headers: {
        ...BASE_HEADERS,
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error(`Negotiate HTTP ${res.statusCode}: ${data}`));
        try {
          const parsed  = JSON.parse(data);
          const cookies = parseCookies(res.headers);
          resolve({ ...parsed, _cookies: cookies });
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Message helpers ───────────────────────────────────────────────────────────
function sendFrame(data) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data) + RECORD_SEP);
  }
}

function processFeedMessage(topic, rawData) {
  const isCompressed = topic.endsWith('.z');
  const data = isCompressed ? decompress(rawData) : rawData;
  if (data == null) return;
  const cleanTopic = isCompressed ? topic.slice(0, -2) : topic;
  state.applyUpdate(cleanTopic, data);
}

function handleFrames(raw) {
  const frames = raw.split(RECORD_SEP).filter(f => f.trim());
  for (const frame of frames) {
    let msg;
    try { msg = JSON.parse(frame); } catch { continue; }

    switch (msg.type) {
      case 1: // Invocation from server
        if (msg.target === 'feed' && Array.isArray(msg.arguments) && msg.arguments.length >= 2) {
          processFeedMessage(msg.arguments[0], msg.arguments[1]);
        }
        break;
      case 6: // Ping — reply with pong
        sendFrame({ type: 6 });
        break;
      case 7: // Close
        console.warn('[F1] Server requested close');
        break;
    }
  }
}

// ── Connect ───────────────────────────────────────────────────────────────────
async function connect() {
  if (stopped) return;

  let negotiation;
  try {
    console.log('[F1] Negotiating (SignalR Core)...');
    negotiation = await negotiate();
    console.log(`[F1] Connection ID: ${negotiation.connectionId}`);
  } catch (err) {
    console.error('[F1] Negotiate failed:', err.message);
    scheduleReconnect();
    return;
  }

  const token   = negotiation.connectionToken || negotiation.connectionId;
  const cookies = negotiation._cookies;
  const wsUrl   = `wss://${BASE_URL}${HUB_PATH}?id=${encodeURIComponent(token)}`;

  // Forward AWSALB/AWSALBCORS sticky-session cookies from negotiate so the
  // WebSocket upgrade lands on the SAME backend instance that issued the
  // connection ID. Without this the hub returns 404 "No Connection with that ID".
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

  let handshakeDone = false;

  ws.on('open', () => {
    console.log('[F1] WebSocket connected');
    reconnectDelay = 2000;
    // Send SignalR Core handshake
    ws.send(JSON.stringify({ protocol: 'json', version: 1 }) + RECORD_SEP);
  });

  ws.on('message', (data) => {
    const raw = data.toString();

    if (!handshakeDone) {
      // Handshake response: {}\x1e or {"error":"..."}\x1e
      handshakeDone = true;
      const frames = raw.split(RECORD_SEP).filter(f => f.trim());
      let handshake = {};
      try { handshake = JSON.parse(frames[0]); } catch { /* empty = ok */ }
      if (handshake.error) {
        console.error('[F1] Handshake error:', handshake.error);
        ws.terminate();
        return;
      }
      console.log('[F1] Handshake complete');

      // Subscribe to all topics
      sendFrame({
        type:         1,
        invocationId: '0',
        target:       'Subscribe',
        arguments:    [TOPICS],
      });
      console.log(`[F1] Subscribed to ${TOPICS.length} topics`);

      state.connected = true;
      state.emit('connected');

      // Keepalive ping every 15 s
      pingTimer = setInterval(() => sendFrame({ type: 6 }), 15000);

      // Process any feed frames bundled with the handshake response
      if (frames.length > 1) handleFrames(frames.slice(1).join(RECORD_SEP) + RECORD_SEP);
      return;
    }

    handleFrames(raw);
  });

  ws.on('close', (code, reason) => {
    state.connected = false;
    if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
    console.warn(`[F1] Disconnected (${code}): ${reason || 'no reason'}`);
    state.emit('disconnected');
    scheduleReconnect();
  });

  ws.on('error', err => console.error('[F1] WS error:', err.message));
}

// ── Reconnect with exponential backoff ────────────────────────────────────────
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
  if (pingTimer)      { clearInterval(pingTimer);     pingTimer = null; }
  if (ws)             { ws.terminate(); ws = null; }
  state.connected = false;
}

module.exports = { start, stop };
