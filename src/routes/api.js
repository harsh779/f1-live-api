const { Router } = require('express');
const state = require('../f1timing/state');

const router = Router();

// ── Per-driver timing view builder ────────────────────────────────────────────
function buildTimingView() {
  const drivers  = state.driverList       || {};
  const timing   = state.timingData?.Lines   || {};
  const appData  = state.timingAppData?.Lines || {};
  const stats    = state.timingStats?.Lines   || {};
  const carData  = state.carData?.Entries     || {};

  return Object.keys(drivers)
    .filter(num => /^\d+$/.test(num))
    .map(num => {
      const driver = drivers[num] || {};
      const td     = timing[num]  || {};
      const app    = appData[num] || {};
      const stat   = stats[num]   || {};

      // Latest telemetry sample
      const latestCar = Array.isArray(carData) && carData.length > 0
        ? (carData[carData.length - 1]?.Cars?.[num]?.Channels || {})
        : {};

      // Current tyre stint
      const stints    = app.Stints || [];
      const stintsArr = Array.isArray(stints) ? stints : Object.values(stints);
      const stint     = stintsArr[stintsArr.length - 1] || {};

      const bestLap = stat.PersonalFastestLap?.Value || td.BestLapTime?.Value || null;

      return {
        driver_number: num,
        name:          driver.FullName    || null,
        acronym:       driver.Tla         || null,
        team:          driver.TeamName    || null,
        team_colour:   driver.TeamColour  || null,
        headshot_url:  driver.HeadshotUrl || null,

        position:    td.Position  || null,
        in_pit:      td.InPit     || false,
        pit_out:     td.PitOut    || false,
        retired:     td.Retired   || false,
        stopped:     td.Stopped   || false,
        knock_out:   td.KnockedOut || false,

        gap_to_leader: td.GapToLeader || null,
        interval:      td.IntervalToPositionAhead?.Value || null,

        laps_completed:          td.NumberOfLaps || null,
        last_lap_time:           td.LastLapTime?.Value || null,
        last_lap_personal_best:  td.LastLapTime?.PersonalFastest || false,
        last_lap_overall_best:   td.LastLapTime?.OverallFastest  || false,
        best_lap_time:           bestLap,

        sectors: [0, 1, 2].map(i => {
          const s = td.Sectors?.[i] || {};
          return {
            value:         s.Value           || null,
            personal_best: s.PersonalFastest || false,
            overall_best:  s.OverallFastest  || false,
            stopped:       s.Stopped         || false,
          };
        }),

        speed_traps: {
          i1: td.Speeds?.I1?.Value || null,
          i2: td.Speeds?.I2?.Value || null,
          fl: td.Speeds?.FL?.Value || null,
          st: td.Speeds?.ST?.Value || null,
        },

        tyre_compound:  stint.Compound   || null,
        tyre_new:       stint.New        ?? null,
        tyre_laps:      stint.TotalLaps  || null,
        stint_number:   stintsArr.length || null,

        telemetry: {
          rpm:      latestCar[0]  ?? null,
          speed:    latestCar[2]  ?? null,
          gear:     latestCar[3]  ?? null,
          throttle: latestCar[4]  ?? null,
          brake:    latestCar[5]  ?? null,
          drs:      latestCar[45] ?? null,
        },
      };
    })
    .sort((a, b) => {
      const pa = parseInt(a.position) || 99;
      const pb = parseInt(b.position) || 99;
      return pa - pb;
    });
}

// ── REST endpoints ────────────────────────────────────────────────────────────

/** GET /status — connection state, session info, clock, flags */
router.get('/status', (req, res) => {
  res.json({
    connected:    state.connected,
    last_update:  state._lastUpdate,
    session:      state.sessionInfo,
    lap_count:    state.lapCount,
    clock:        state.extrapolatedClock,
    track_status: state.trackStatus,
    top_three:    state.topThree,
  });
});

/** GET /timing — full leaderboard, all 22 drivers */
router.get('/timing', (req, res) => {
  res.json({
    timestamp: new Date().toISOString(),
    session:   state.sessionInfo?.Name || null,
    drivers:   buildTimingView(),
  });
});

/** GET /timing/:number — single driver */
router.get('/timing/:number', (req, res) => {
  const driver = buildTimingView().find(d => d.driver_number == req.params.number);
  if (!driver) return res.status(404).json({ error: 'Driver not found' });
  res.json(driver);
});

/** GET /weather */
router.get('/weather', (req, res) => {
  res.json(state.weatherData);
});

/** GET /track — flags and session state */
router.get('/track', (req, res) => {
  res.json({
    status:  state.trackStatus,
    session: state.sessionData,
  });
});

/** GET /race-control — race director messages, newest first */
router.get('/race-control', (req, res) => {
  const msgs = state.raceControl?.Messages || [];
  const arr  = Array.isArray(msgs) ? msgs : Object.values(msgs);
  res.json(arr.slice().reverse());
});

/** GET /drivers — full driver list */
router.get('/drivers', (req, res) => {
  const drivers = state.driverList || {};
  res.json(
    Object.entries(drivers)
      .filter(([num]) => /^\d+$/.test(num))
      .map(([num, d]) => ({
        driver_number: num,
        name:          d.FullName    || null,
        acronym:       d.Tla         || null,
        team:          d.TeamName    || null,
        team_colour:   d.TeamColour  || null,
        headshot_url:  d.HeadshotUrl || null,
        country_code:  d.CountryCode || null,
      }))
  );
});

/** GET /car/:number — telemetry for one driver */
router.get('/car/:number', (req, res) => {
  const driver = buildTimingView().find(d => d.driver_number == req.params.number);
  if (!driver) return res.status(404).json({ error: 'Driver not found' });
  res.json({
    driver_number: driver.driver_number,
    name:          driver.name,
    telemetry:     driver.telemetry,
  });
});

/** GET /snapshot — raw dump of all 15 F1 timing topics */
router.get('/snapshot', (req, res) => {
  res.json(state.snapshot());
});

// ── SSE streams ───────────────────────────────────────────────────────────────

/**
 * GET /stream
 * Pushes every raw topic update as it arrives from F1.
 * Query: ?topic=TimingData  (optional filter)
 */
router.get('/stream', (req, res) => {
  const filterTopic = req.query.topic || null;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Send current snapshot on connect
  res.write(`event: snapshot\ndata: ${JSON.stringify(state.snapshot())}\n\n`);

  const onUpdate = ({ topic, data, timestamp }) => {
    if (filterTopic && topic !== filterTopic) return;
    res.write(`data: ${JSON.stringify({ topic, data, timestamp })}\n\n`);
  };
  const onConnect    = () => res.write(`event: connected\ndata: {}\n\n`);
  const onDisconnect = () => res.write(`event: disconnected\ndata: {}\n\n`);

  state.on('update',       onUpdate);
  state.on('connected',    onConnect);
  state.on('disconnected', onDisconnect);
  req.on('close', () => {
    state.off('update',       onUpdate);
    state.off('connected',    onConnect);
    state.off('disconnected', onDisconnect);
  });
});

/**
 * GET /stream/timing
 * Pushes the full merged leaderboard every time timing data changes.
 */
router.get('/stream/timing', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  res.write(`data: ${JSON.stringify({ timestamp: new Date().toISOString(), drivers: buildTimingView() })}\n\n`);

  const TIMING_TOPICS = new Set(['TimingData', 'TimingAppData', 'TimingStats', 'Position', 'CarData', 'DriverList']);

  const onUpdate = ({ topic }) => {
    if (!TIMING_TOPICS.has(topic)) return;
    res.write(`data: ${JSON.stringify({ timestamp: new Date().toISOString(), drivers: buildTimingView() })}\n\n`);
  };

  state.on('update', onUpdate);
  req.on('close', () => state.off('update', onUpdate));
});

module.exports = router;
