const https = require('https');
const WebSocket = require('ws');
const { decompress } = require('./decompress');
const state = require('./state');

const BASE_URL = 'livetiming.formula1.com';
const HUB      = 'streaming';
const PROTOCOL = '1.5';

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
function httpsGet(path, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: BASE_URL,
        path,
        method: 'GET',
        headers: { ...BASE_HEADERS, ...extraHeaders },
      },
      (res) => {
        let body = '';
        res.on('data', c => (body += c));
        res.on('end', () =>
          resolve({ body, headers: res.headers, statusCode: res.statusCode }),
        );
      },
    );
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
    const topics = Object.keys(msg.R);
    console.log('[F1] Subscribe response topics:', topics.join(', '));
    if (msg.R.TeamRadio) console.log('[F1] Initial TeamRadio:', JSON.stringify(msg.R.TeamRadio).slice(0, 500));
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
    negotiation = await negotiate();
    console.log(`[F1] Token acquired. ID: ${negotiation.ConnectionId}`);
  } catch (err) {
    console.error('[F1] Negotiate failed:', err.message);
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

  ws = new WebSocket(wsUrl, { headers: wsHeaders });

  ws.on('open', async () => {
    console.log('[F1] WebSocket connected');
    reconnectDelay = 2000;

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
    console.warn(`[F1] Disconnected (${code}): ${reason || 'no reason'}`);
    state.emit('disconnected');
    scheduleReconnect();
  });

  ws.on('error', err => console.error('[F1] WS error:', err.message));
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

function start() { stopped = false; connect(); }

function stop() {
  stopped = true;
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  if (ws) { ws.terminate(); ws = null; }
  state.connected = false;
}

module.exports = { start, stop };
