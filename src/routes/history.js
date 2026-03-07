const { Router } = require('express');
const https = require('https');

const router = Router();

const STATIC_BASE = 'https://livetiming.formula1.com/static';

// In-memory cache with TTL
const cache = new Map();
const CACHE_TTL = 300_000; // 5 minutes

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) { cache.delete(key); return null; }
  return entry.data;
}

function setCache(key, data) {
  cache.set(key, { data, ts: Date.now() });
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'BestHTTP' } }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      let body = '';
      res.on('data', c => (body += c));
      res.on('end', () => {
        try {
          // Strip BOM if present
          const clean = body.charCodeAt(0) === 0xFEFF ? body.slice(1) : body;
          resolve(JSON.parse(clean));
        }
        catch { reject(new Error('Invalid JSON')); }
      });
    }).on('error', reject);
  });
}

/**
 * GET /history — list available seasons
 * Archive format: { Years: [{ Year: 2024, Path: "2024/" }, ...] }
 */
router.get('/', async (req, res) => {
  try {
    const cached = getCached('index');
    if (cached) return res.json(cached);

    const index = await fetchJson(`${STATIC_BASE}/Index.json`);
    const years = (index.Years || []).map(y => y.Year).sort((a, b) => b - a);
    const result = {
      description: 'F1 historical session archive from livetiming.formula1.com',
      years,
      usage: 'GET /history/:year for meetings, then use session paths for data',
    };
    setCache('index', result);
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: 'Failed to fetch archive index', detail: err.message });
  }
});

/**
 * GET /history/session?path=2024/2024-03-02_Bahrain/2024-03-02_Race/&topic=TimingData
 * Fetch archived session data by path and topic.
 * Must be defined before /:year to avoid route shadowing.
 */
router.get('/session', async (req, res) => {
  const { path: sessionPath, topic = 'SessionInfo' } = req.query;
  if (!sessionPath) {
    return res.status(400).json({ error: 'path query param required (from /history/:year session paths)' });
  }

  const allowed = [
    'SessionInfo', 'TimingData', 'TimingAppData', 'TimingStats',
    'WeatherData', 'TrackStatus', 'RaceControlMessages', 'DriverList',
    'LapCount', 'TopThree', 'TeamRadio', 'SessionData',
    'ExtrapolatedClock', 'Heartbeat',
  ];
  if (!allowed.includes(topic)) {
    return res.status(400).json({ error: `Invalid topic. Available: ${allowed.join(', ')}` });
  }

  // Sanitise path — only allow alphanumerics, dashes, underscores, slashes, dots
  if (!/^[\w\-./]+$/.test(sessionPath)) {
    return res.status(400).json({ error: 'Invalid path' });
  }

  const archiveUrl = `${STATIC_BASE}/${sessionPath}${topic}.json`;
  const cacheKey = `session:${sessionPath}:${topic}`;

  try {
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    const data = await fetchJson(archiveUrl);
    setCache(cacheKey, data);
    res.json(data);
  } catch (err) {
    res.status(502).json({
      error: 'Failed to fetch archive data',
      detail: err.message,
      hint: `Tried: ${archiveUrl}`,
    });
  }
});

/**
 * GET /history/:year — list meetings and sessions for a year
 * Year index: { Year: 2024, Meetings: [{ Key, Name, Location, Sessions: [...] }] }
 */
router.get('/:year', async (req, res) => {
  const { year } = req.params;
  if (!/^\d{4}$/.test(year)) return res.status(400).json({ error: 'Invalid year' });

  const cacheKey = `year:${year}`;
  try {
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    const data = await fetchJson(`${STATIC_BASE}/${year}/Index.json`);
    const meetings = (data.Meetings || []).map(m => ({
      key:      m.Key || null,
      name:     m.Name || null,
      location: m.Location || null,
      country:  m.Country?.Name || null,
      path:     m.Path || null,
      sessions: (m.Sessions || []).map(s => ({
        key:        s.Key || null,
        name:       s.Name || null,
        type:       s.Type || null,
        path:       s.Path || null,
        start_date: s.StartDate || null,
        end_date:   s.EndDate || null,
      })),
    }));

    const result = {
      year: parseInt(year),
      total: meetings.length,
      meetings,
      usage: 'Use session path with GET /history/session?path=<path>&topic=TimingData',
    };
    setCache(cacheKey, result);
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: `Failed to fetch ${year} data`, detail: err.message });
  }
});

module.exports = router;
