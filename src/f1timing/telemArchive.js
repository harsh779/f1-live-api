const https = require('https');
const { decompress } = require('./decompress');

const STATIC_BASE = 'https://livetiming.formula1.com/static';
const REQUEST_HEADERS = {
  'User-Agent':      'BestHTTP',
  'Origin':          'https://www.formula1.com',
  'Accept-Encoding': 'identity',
};

// In-memory cache: avoids re-fetching large streams on every request.
// Key = `${archivePath}:${driverNumber}` or `${archivePath}:_session`
const _cache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 h

function _cacheGet(key) {
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiry) { _cache.delete(key); return null; }
  return entry.data;
}

function _cacheSet(key, data) {
  _cache.set(key, { data, expiry: Date.now() + CACHE_TTL });
}

// AT1.1 — fetch a .jsonStream file as raw text
function fetchRawStream(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: REQUEST_HEADERS, timeout: 60000 }, res => {
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout fetching stream')); });
  });
}

// AT1.1 — parse lines of format  `HH:MM:SS.mmm"<base64-compressed-json>`
function parseStreamLines(raw) {
  const clean = raw.charCodeAt(0) === 0xFEFF ? raw.slice(1) : raw;
  const result = [];
  for (const line of clean.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const idx = trimmed.indexOf('"');
    if (idx === -1) continue;
    const blob = trimmed.slice(idx + 1);
    if (!blob) continue;
    try {
      const data = decompress(blob);
      if (data && typeof data === 'object') result.push(data);
    } catch { /* skip malformed lines */ }
  }
  return result;
}

// AT1.2 — CarData.z: {Entries:[{Utc, Cars:{num:{Channels:{0:rpm,2:v,3:g,4:thr,5:brk,45:drs}}}}]}
// Returns {driverNum: [{t, v, thr, brk, rpm, g, drs}]} sorted by time
function processCarData(parsedLines) {
  const byDriver = {};
  for (const obj of parsedLines) {
    const entries = Array.isArray(obj?.Entries) ? obj.Entries : Object.values(obj?.Entries || {});
    for (const entry of entries) {
      if (!entry.Utc) continue;
      const t = new Date(entry.Utc).getTime();
      if (isNaN(t)) continue;
      const cars = entry.Cars || {};
      for (const [num, car] of Object.entries(cars)) {
        if (!/^\d+$/.test(num)) continue;
        const ch = car?.Channels || {};
        if (!byDriver[num]) byDriver[num] = [];
        byDriver[num].push({
          t,
          v:   ch[2]  ?? null,
          thr: ch[4]  ?? null,
          brk: ch[5]  ?? null,
          rpm: ch[0]  ?? null,
          g:   ch[3]  ?? null,
          drs: ch[45] ?? null,
        });
      }
    }
  }
  for (const arr of Object.values(byDriver)) arr.sort((a, b) => a.t - b.t);
  return byDriver;
}

// AT1.3 — Position.z: {Position:[{Timestamp:"HH:MM:SS.mmm", Entries:{num:{Status,X,Y,Z}}}]}
// dateStr "YYYY-MM-DD" used to build full UTC from the wall-clock time string
// Returns {driverNum: [{t, x, y}]} sorted by time, OnTrack only
function processPosition(parsedLines, dateStr) {
  const byDriver = {};
  for (const obj of parsedLines) {
    const frames = Array.isArray(obj?.Position) ? obj.Position : Object.values(obj?.Position || {});
    for (const frame of frames) {
      if (!frame.Timestamp) continue;
      const t = new Date(`${dateStr}T${frame.Timestamp}Z`).getTime();
      if (isNaN(t)) continue;
      const dEntries = frame.Entries || {};
      for (const [num, pos] of Object.entries(dEntries)) {
        if (!/^\d+$/.test(num)) continue;
        if (pos.Status !== 'OnTrack') continue;
        if (pos.X == null || pos.Y == null) continue;
        if (!byDriver[num]) byDriver[num] = [];
        byDriver[num].push({ t, x: pos.X, y: pos.Y });
      }
    }
  }
  for (const arr of Object.values(byDriver)) arr.sort((a, b) => a.t - b.t);
  return byDriver;
}

// Cumulative Euclidean distance along position samples (same unit as X/Y coords)
function computeCumulativeDist(posSamples) {
  const dist = new Array(posSamples.length).fill(0);
  for (let i = 1; i < posSamples.length; i++) {
    const dx = posSamples[i].x - posSamples[i - 1].x;
    const dy = posSamples[i].y - posSamples[i - 1].y;
    dist[i] = dist[i - 1] + Math.sqrt(dx * dx + dy * dy);
  }
  return dist;
}

// AT1.4 — merge CarData + Position by nearest timestamp, attach cumulative distance
function mergeTelemStreams(carSamples, posSamples) {
  if (!posSamples || posSamples.length === 0) {
    return carSamples.map(s => ({ ...s, d: null }));
  }

  const distArr = computeCumulativeDist(posSamples);
  let pi = 0;

  return carSamples.map(cs => {
    // Advance position pointer to nearest timestamp (both arrays are time-sorted)
    while (
      pi < posSamples.length - 1 &&
      Math.abs(posSamples[pi + 1].t - cs.t) <= Math.abs(posSamples[pi].t - cs.t)
    ) {
      pi++;
    }
    return { ...cs, d: Math.round(distArr[pi]) };
  });
}

function extractDate(carByDriver) {
  for (const samples of Object.values(carByDriver)) {
    if (samples.length > 0) return new Date(samples[0].t).toISOString().slice(0, 10);
  }
  return new Date().toISOString().slice(0, 10);
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Fetch + parse + merge CarData + Position for one driver from the F1 static archive.
 * Result is cached in memory for 24 h per archive path + driver number.
 *
 * @param {string} archivePath - session.Path from archive index, e.g.
 *   "2026/2026-03-07_Australian_Grand_Prix/2026-03-07_Qualifying/"
 * @param {string} driverNumber - e.g. "44"
 * @returns {Array} samples: [{t, d, v, thr, brk, rpm, g, drs}]
 */
async function getArchiveTelemetry(archivePath, driverNumber) {
  const cacheKey = `${archivePath}:${driverNumber}`;
  const cached = _cacheGet(cacheKey);
  if (cached) return cached;

  // Fetch both streams from F1 static archive (parallel)
  const [carRaw, posRaw] = await Promise.all([
    fetchRawStream(`${STATIC_BASE}/${archivePath}CarData.z.jsonStream`),
    fetchRawStream(`${STATIC_BASE}/${archivePath}Position.z.jsonStream`).catch(() => null),
  ]);

  const carParsed = parseStreamLines(carRaw);
  const posParsed = posRaw ? parseStreamLines(posRaw) : [];

  const carByDriver = processCarData(carParsed);
  const dateStr     = extractDate(carByDriver);
  const posByDriver = processPosition(posParsed, dateStr);

  const carSamples = carByDriver[driverNumber] || [];
  const posSamples = posByDriver[driverNumber] || [];

  const merged = mergeTelemStreams(carSamples, posSamples);
  _cacheSet(cacheKey, merged);
  return merged;
}

/**
 * Returns all driver numbers that have telemetry in the archive stream.
 * Uses a session-level cache (fetches CarData once for all drivers).
 */
async function getSessionCarData(archivePath) {
  const cacheKey = `${archivePath}:_session`;
  const cached = _cacheGet(cacheKey);
  if (cached) return cached;

  const carRaw = await fetchRawStream(`${STATIC_BASE}/${archivePath}CarData.z.jsonStream`);
  const carByDriver = processCarData(parseStreamLines(carRaw));
  _cacheSet(cacheKey, carByDriver);
  return carByDriver;
}

module.exports = { getArchiveTelemetry, getSessionCarData };
