const { Router } = require('express');
const state = require('../f1timing/state');
const { getArchiveTelemetry, getSessionCarData } = require('../f1timing/telemArchive');
const { loadResult } = require('../f1timing/persistence');

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Extract the latest telemetry sample for a given driver number from CarData.
 * CarData.z decompresses to:
 * { Entries: [ { Utc: "...", Cars: { "44": { Channels: { 0:rpm, 2:speed, 3:gear, 4:throttle, 5:brake, 45:drs } } } } ] }
 */
function getLatestTelemetry(driverNumber) {
  const entries = state.carData?.Entries;
  if (!entries) return null;

  const arr = Array.isArray(entries) ? entries : Object.values(entries);
  if (arr.length === 0) return null;

  const latest = arr[arr.length - 1];
  const ch = latest?.Cars?.[driverNumber]?.Channels;
  if (!ch) return null;

  return {
    timestamp: latest.Utc || null,
    rpm:       ch[0]  ?? null,
    speed:     ch[2]  ?? null,
    gear:      ch[3]  ?? null,
    throttle:  ch[4]  ?? null,
    brake:     ch[5]  ?? null,
    drs:       ch[45] ?? null,
    drs_label: drsLabel(ch[45]),
  };
}

/** All latest telemetry entries keyed by driver number. */
function getAllLatestTelemetry() {
  const entries = state.carData?.Entries;
  if (!entries) return {};

  const arr = Array.isArray(entries) ? entries : Object.values(entries);
  if (arr.length === 0) return {};

  const latest = arr[arr.length - 1];
  const cars   = latest?.Cars || {};
  const result = {};

  Object.entries(cars).forEach(([num, car]) => {
    if (!/^\d+$/.test(num)) return;
    const ch = car?.Channels || {};
    result[num] = {
      timestamp: latest.Utc || null,
      rpm:       ch[0]  ?? null,
      speed:     ch[2]  ?? null,
      gear:      ch[3]  ?? null,
      throttle:  ch[4]  ?? null,
      brake:     ch[5]  ?? null,
      drs:       ch[45] ?? null,
      drs_label: drsLabel(ch[45]),
    };
  });

  return result;
}

function drsLabel(val) {
  if (val === null || val === undefined) return null;
  if (val === 0)  return 'off';
  if (val === 8)  return 'eligible';
  if (val === 10) return 'on';
  if (val === 12) return 'active';
  return `unknown(${val})`;
}

function driverInfo(num) {
  const d = state.driverList?.[num] || {};
  return {
    driver_number: num,
    name:          d.FullName   || null,
    acronym:       d.Tla        || null,
    team:          d.TeamName   || null,
    team_colour:   d.TeamColour || null,
  };
}

// ── REST endpoints ────────────────────────────────────────────────────────────

/**
 * GET /telemetry
 * Latest telemetry sample for all drivers.
 */
router.get('/', (req, res) => {
  const all  = getAllLatestTelemetry();
  const drivers = state.driverList || {};

  const result = Object.keys(drivers)
    .filter(num => /^\d+$/.test(num))
    .map(num => ({
      ...driverInfo(num),
      telemetry: all[num] || null,
    }));

  res.json({
    timestamp: new Date().toISOString(),
    session:   state.sessionInfo?.Name || null,
    active:    Object.keys(all).length > 0,
    drivers:   result,
  });
});

/**
 * GET /telemetry/:number
 * Latest telemetry sample for one driver.
 */
router.get('/:number', (req, res) => {
  const num = req.params.number;
  const tel = getLatestTelemetry(num);

  if (!state.driverList?.[num]) {
    return res.status(404).json({ error: 'Driver not found' });
  }

  res.json({
    ...driverInfo(num),
    telemetry: tel,
  });
});

// ── SSE streams ───────────────────────────────────────────────────────────────

/**
 * GET /telemetry/stream/all
 * SSE — pushes all 22 drivers' telemetry on every CarData update (~3.7Hz during session).
 */
router.get('/stream/all', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Send current snapshot immediately
  const initial = getAllLatestTelemetry();
  res.write(`event: snapshot\ndata: ${JSON.stringify({
    timestamp: new Date().toISOString(),
    session:   state.sessionInfo?.Name || null,
    cars:      initial,
  })}\n\n`);

  const onUpdate = ({ topic, data }) => {
    if (topic !== 'CarData') return;

    const entries = data?.Entries;
    if (!entries) return;

    const arr    = Array.isArray(entries) ? entries : Object.values(entries);
    const latest = arr[arr.length - 1];
    if (!latest?.Cars) return;

    const cars = {};
    Object.entries(latest.Cars).forEach(([num, car]) => {
      if (!/^\d+$/.test(num)) return;
      const ch = car?.Channels || {};
      cars[num] = {
        rpm:      ch[0]  ?? null,
        speed:    ch[2]  ?? null,
        gear:     ch[3]  ?? null,
        throttle: ch[4]  ?? null,
        brake:    ch[5]  ?? null,
        drs:      ch[45] ?? null,
        drs_label: drsLabel(ch[45]),
      };
    });

    res.write(`data: ${JSON.stringify({
      timestamp: latest.Utc || new Date().toISOString(),
      session:   state.sessionInfo?.Name || null,
      cars,
    })}\n\n`);
  };

  state.on('update', onUpdate);
  req.on('close', () => state.off('update', onUpdate));
});

/**
 * GET /telemetry/stream/:number
 * SSE — pushes one driver's telemetry on every CarData update (~3.7Hz during session).
 */
router.get('/stream/:number', (req, res) => {
  const num = req.params.number;

  if (!state.driverList?.[num]) {
    return res.status(404).json({ error: 'Driver not found' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const info = driverInfo(num);

  // Send current snapshot immediately
  res.write(`event: snapshot\ndata: ${JSON.stringify({
    ...info,
    telemetry: getLatestTelemetry(num),
  })}\n\n`);

  const onUpdate = ({ topic, data }) => {
    if (topic !== 'CarData') return;

    const entries = data?.Entries;
    if (!entries) return;

    const arr    = Array.isArray(entries) ? entries : Object.values(entries);
    const latest = arr[arr.length - 1];
    const ch     = latest?.Cars?.[num]?.Channels;
    if (!ch) return;

    res.write(`data: ${JSON.stringify({
      ...info,
      telemetry: {
        timestamp: latest.Utc || new Date().toISOString(),
        rpm:       ch[0]  ?? null,
        speed:     ch[2]  ?? null,
        gear:      ch[3]  ?? null,
        throttle:  ch[4]  ?? null,
        brake:     ch[5]  ?? null,
        drs:       ch[45] ?? null,
        drs_label: drsLabel(ch[45]),
      },
    })}\n\n`);
  };

  state.on('update', onUpdate);
  req.on('close', () => state.off('update', onUpdate));
});

// ── Archive telemetry (post-session, from F1 static archive) ─────────────────

/**
 * GET /telemetry/archive/:filename
 * Returns driver list + session meta for a saved result file.
 * Requires meta.archive_path (set by backfill since this feature landed).
 */
router.get('/archive/:filename', async (req, res) => {
  const result = loadResult(req.params.filename);
  if (!result) return res.status(404).json({ error: 'Result not found' });

  const archivePath = result.meta?.archive_path;
  if (!archivePath) {
    return res.status(404).json({
      error: 'No archive_path in result meta — file was saved before telemetry support was added',
    });
  }

  res.json({
    session:      result.meta,
    archive_path: archivePath,
    drivers: Object.entries(result.drivers || {}).map(([num, d]) => {
      const r = (result.results || []).find(x => x.driver_number === num);
      return {
        number:     num,
        name:       d.name       || null,
        acronym:    d.acronym    || null,
        team:       d.team       || null,
        team_color: d.team_color || null,
        best_lap:   r?.best_lap_time || null,
        position:   r?.position      || null,
      };
    }).sort((a, b) => (a.position || 99) - (b.position || 99)),
  });
});

/**
 * GET /telemetry/archive/:filename/:driver
 * Full session telemetry for one driver — fetched + parsed from F1 static archive.
 * Cached in memory for 24 h after first request.
 * Response: {session, driver, fastest_lap, sample_count, samples: [{t,d,v,thr,brk,rpm,g,drs}]}
 *   t   = UTC epoch ms
 *   d   = cumulative distance (same units as F1 Position X/Y — meters)
 *   v   = speed km/h
 *   thr = throttle 0–100
 *   brk = brake 0/1
 *   rpm = engine RPM
 *   g   = gear (0=neutral)
 *   drs = DRS status code (0=off, 8=eligible, 10=on, 12=active)
 */
router.get('/archive/:filename/:driver', async (req, res) => {
  const result = loadResult(req.params.filename);
  if (!result) return res.status(404).json({ error: 'Result not found' });

  const archivePath = result.meta?.archive_path;
  if (!archivePath) {
    return res.status(404).json({
      error: 'No archive_path in result meta — file was saved before telemetry support was added',
    });
  }

  const driverNum = req.params.driver;
  const driverInfo = result.drivers?.[driverNum] || {};
  const driverResult = (result.results || []).find(r => r.driver_number === driverNum);

  try {
    const samples = await getArchiveTelemetry(archivePath, driverNum);
    res.json({
      session:      result.meta,
      driver:       { number: driverNum, ...driverInfo },
      fastest_lap:  driverResult
        ? { time: driverResult.best_lap_time, lap: driverResult.best_lap_number }
        : null,
      sample_count: samples.length,
      samples,
    });
  } catch (e) {
    console.error(`[TELEM] Archive fetch failed for ${req.params.filename}/${driverNum}:`, e.message);
    res.status(503).json({ error: `Archive fetch failed: ${e.message}` });
  }
});

module.exports = router;
