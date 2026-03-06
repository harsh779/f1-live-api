const { Router } = require('express');
const { fetch, getLatestSessionKey } = require('../services/openf1');

const router = Router();

/**
 * Builds a merged per-driver timing sheet for a given session.
 * Combines: drivers, position, intervals, laps, stints
 */
async function buildTimingSheet(sessionKey) {
  const results = await Promise.allSettled([
    fetch('/drivers',   { session_key: sessionKey }, true),
    fetch('/position',  { session_key: sessionKey }),
    fetch('/intervals', { session_key: sessionKey }),
    fetch('/laps',      { session_key: sessionKey }),
    fetch('/stints',    { session_key: sessionKey }),
  ]);

  const get = (r) => (r.status === 'fulfilled' && Array.isArray(r.value) ? r.value : []);
  const [drivers, positions, intervals, laps, stints] = results.map(get);

  // --- Latest position per driver ---
  const latestPosition = {};
  positions.forEach(p => { latestPosition[p.driver_number] = p; });

  // --- Latest interval per driver ---
  const latestInterval = {};
  intervals.forEach(i => { latestInterval[i.driver_number] = i; });

  // --- Laps per driver: count, best lap, last lap ---
  const lapsByDriver = {};
  laps.forEach(l => {
    if (!lapsByDriver[l.driver_number]) lapsByDriver[l.driver_number] = [];
    lapsByDriver[l.driver_number].push(l);
  });

  // --- Latest stint per driver (current tyre) ---
  const latestStint = {};
  stints.forEach(s => {
    const existing = latestStint[s.driver_number];
    if (!existing || s.stint_number > existing.stint_number) {
      latestStint[s.driver_number] = s;
    }
  });

  // --- Merge into timing entries ---
  const sheet = drivers.map(driver => {
    const num = driver.driver_number;
    const pos = latestPosition[num];
    const gap = latestInterval[num];
    const driverLaps = lapsByDriver[num] || [];
    const stint = latestStint[num];

    // Best lap: lowest non-null lap_duration
    const validLaps = driverLaps.filter(l => l.lap_duration != null);
    const bestLap = validLaps.length > 0
      ? Math.min(...validLaps.map(l => l.lap_duration))
      : null;

    // Last lap: most recent completed lap
    const lastLap = validLaps.length > 0
      ? validLaps[validLaps.length - 1]
      : null;

    return {
      driver_number:    num,
      name:             driver.full_name,
      acronym:          driver.name_acronym,
      team:             driver.team_name,
      team_colour:      driver.team_colour,
      headshot_url:     driver.headshot_url,
      position:         pos?.position ?? null,
      laps_completed:   driverLaps.length,
      tyre_compound:    stint?.compound ?? null,
      tyre_age:         stint != null
        ? (driverLaps.length - (stint.lap_start - 1))
        : null,
      stint_number:     stint?.stint_number ?? null,
      interval:         gap?.interval ?? null,
      gap_to_leader:    gap?.gap_to_leader ?? null,
      best_lap_time:    bestLap,
      best_lap_time_fmt: bestLap ? formatLapTime(bestLap) : null,
      last_lap_time:    lastLap?.lap_duration ?? null,
      last_lap_time_fmt: lastLap ? formatLapTime(lastLap.lap_duration) : null,
      last_lap_number:  lastLap?.lap_number ?? null,
      last_lap_sectors: lastLap ? {
        s1: lastLap.duration_sector_1,
        s2: lastLap.duration_sector_2,
        s3: lastLap.duration_sector_3,
      } : null,
      is_pit_out_lap:   lastLap?.is_pit_out_lap ?? null,
    };
  });

  // Sort by position (null positions go to the bottom)
  sheet.sort((a, b) => {
    if (a.position == null && b.position == null) return 0;
    if (a.position == null) return 1;
    if (b.position == null) return -1;
    return a.position - b.position;
  });

  return sheet;
}

/** Format seconds → m:ss.mmm */
function formatLapTime(seconds) {
  if (seconds == null) return null;
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(3).padStart(6, '0');
  return `${m}:${s}`;
}

/**
 * GET /timing/latest
 * Full merged timing sheet for the current live session.
 * Query: session_key (optional, defaults to latest)
 */
router.get('/latest', async (req, res, next) => {
  try {
    const sessionKey = req.query.session_key || await getLatestSessionKey();
    const sheet = await buildTimingSheet(sessionKey);
    res.json({
      session_key: sessionKey,
      timestamp: new Date().toISOString(),
      drivers: sheet,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /timing/driver/:driver_number
 * Single driver timing entry.
 */
router.get('/driver/:driver_number', async (req, res, next) => {
  try {
    const sessionKey = req.query.session_key || await getLatestSessionKey();
    const sheet = await buildTimingSheet(sessionKey);
    const driver = sheet.find(d => d.driver_number == req.params.driver_number);
    if (!driver) return res.status(404).json({ error: 'Driver not found' });
    res.json(driver);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /timing/stream
 * SSE — pushes the full timing sheet every N seconds.
 * Query: interval_ms (min 3000, default 5000), session_key
 */
router.get('/stream', async (req, res) => {
  const intervalMs = Math.max(3000, parseInt(req.query.interval_ms) || 5000);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  let stopped = false;

  async function push() {
    if (stopped) return;
    try {
      const sessionKey = req.query.session_key || await getLatestSessionKey();
      const sheet = await buildTimingSheet(sessionKey);
      const payload = {
        session_key: sessionKey,
        timestamp: new Date().toISOString(),
        drivers: sheet,
      };
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    } catch (err) {
      res.write(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
    }
  }

  push();
  const timer = setInterval(push, intervalMs);
  req.on('close', () => { stopped = true; clearInterval(timer); });
});

module.exports = router;
