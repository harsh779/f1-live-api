const { Router } = require('express');
const { fetch, getLatestSessionKey } = require('../services/openf1');

const router = Router();

/**
 * GET /live/stream
 * Server-Sent Events endpoint — pushes a combined snapshot of the live
 * session every N seconds (default: 5s).
 *
 * Query params:
 *   interval_ms  - polling interval in ms (min 2000, default 5000)
 *   driver_number - optional; filter telemetry/position/interval to one driver
 *
 * Event fields emitted as JSON:
 *   session_key, timestamp,
 *   position[]        - race order
 *   intervals[]       - gaps
 *   car_data[]        - latest telemetry sample per driver
 *   weather           - latest weather reading
 *   race_control[]    - any new race control messages since last poll
 *   laps[]            - any newly completed laps since last poll
 */
router.get('/stream', async (req, res) => {
  const intervalMs = Math.max(2000, parseInt(req.query.interval_ms) || 5000);
  const driverNumber = req.query.driver_number;

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  let lastRaceControlDate = null;
  let lastLapDate = null;
  let stopped = false;

  async function pushSnapshot() {
    if (stopped) return;

    try {
      const sessionKey = await getLatestSessionKey();
      const driverFilter = driverNumber ? { driver_number: driverNumber } : {};

      const [positions, intervals, carData, weatherAll, raceControlAll, lapsAll] =
        await Promise.allSettled([
          fetch('/position',     { session_key: sessionKey, ...driverFilter }),
          fetch('/intervals',    { session_key: sessionKey, ...driverFilter }),
          fetch('/car_data',     { session_key: sessionKey, ...driverFilter }),
          fetch('/weather',      { session_key: sessionKey }),
          fetch('/race_control', { session_key: sessionKey }),
          fetch('/laps',         { session_key: sessionKey, ...driverFilter }),
        ]);

      const get = (r) => (r.status === 'fulfilled' ? r.value : []);

      const weather = (() => {
        const w = get(weatherAll);
        return w.length > 0 ? w[w.length - 1] : null;
      })();

      // Delta: only new race control messages
      const allRC = get(raceControlAll);
      const newRC = lastRaceControlDate
        ? allRC.filter((m) => m.date > lastRaceControlDate)
        : allRC;
      if (allRC.length > 0) lastRaceControlDate = allRC[allRC.length - 1].date;

      // Delta: only newly completed laps
      const allLaps = get(lapsAll);
      const newLaps = lastLapDate
        ? allLaps.filter((l) => l.date_start > lastLapDate)
        : allLaps;
      if (allLaps.length > 0) lastLapDate = allLaps[allLaps.length - 1].date_start;

      const snapshot = {
        session_key: sessionKey,
        timestamp: new Date().toISOString(),
        position: get(positions),
        intervals: get(intervals),
        car_data: get(carData),
        weather,
        race_control: newRC,
        laps: newLaps,
      };

      res.write(`data: ${JSON.stringify(snapshot)}\n\n`);
    } catch (err) {
      res.write(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
    }
  }

  // Send first snapshot immediately, then on interval
  pushSnapshot();
  const timer = setInterval(pushSnapshot, intervalMs);

  req.on('close', () => {
    stopped = true;
    clearInterval(timer);
  });
});

/**
 * GET /live/snapshot
 * Single combined snapshot (REST, not SSE).
 * Query: driver_number (optional)
 */
router.get('/snapshot', async (req, res, next) => {
  try {
    const sessionKey = await getLatestSessionKey();
    const driverFilter = req.query.driver_number
      ? { driver_number: req.query.driver_number }
      : {};

    const [sessionData, positions, intervals, carData, weatherAll, raceControl, laps, stints, pits, teamRadio] =
      await Promise.allSettled([
        fetch('/sessions',     { session_key: sessionKey }),
        fetch('/position',     { session_key: sessionKey, ...driverFilter }),
        fetch('/intervals',    { session_key: sessionKey, ...driverFilter }),
        fetch('/car_data',     { session_key: sessionKey, ...driverFilter }),
        fetch('/weather',      { session_key: sessionKey }),
        fetch('/race_control', { session_key: sessionKey }),
        fetch('/laps',         { session_key: sessionKey, ...driverFilter }),
        fetch('/stints',       { session_key: sessionKey, ...driverFilter }),
        fetch('/pit',          { session_key: sessionKey, ...driverFilter }),
        fetch('/team_radio',   { session_key: sessionKey, ...driverFilter }),
      ]);

    const get = (r) => (r.status === 'fulfilled' ? r.value : []);
    const w = get(weatherAll);

    res.json({
      session_key: sessionKey,
      timestamp: new Date().toISOString(),
      session: get(sessionData)[0] || null,
      position: get(positions),
      intervals: get(intervals),
      car_data: get(carData),
      weather: w.length > 0 ? w[w.length - 1] : null,
      race_control: get(raceControl),
      laps: get(laps),
      stints: get(stints),
      pit_stops: get(pits),
      team_radio: get(teamRadio),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
