const { Router } = require('express');
const { listResults, loadResult, loadResultsByType } = require('../f1timing/persistence');
const { calendar2026, RACE_POINTS, SPRINT_POINTS, FASTEST_LAP_POINT } = require('../data/calendar');

const router = Router();

// ── Results ───────────────────────────────────────────────────────────────────

/** GET /results — list all saved sessions */
router.get('/', (req, res) => {
  const files = listResults();
  const sessions = files.map(filename => {
    const result = loadResult(filename);
    return {
      filename,
      round:        result?.meta?.round        || null,
      meeting:      result?.meta?.meeting      || null,
      session_name: result?.meta?.session_name || null,
      session_type: result?.meta?.session_type || null,
      date:         result?.meta?.date         || null,
      circuit:      result?.meta?.circuit      || null,
    };
  });
  res.json(sessions);
});

/** GET /results/:filename — single saved session result */
router.get('/:filename', (req, res) => {
  const result = loadResult(req.params.filename);
  if (!result) return res.status(404).json({ error: 'Result not found' });
  res.json(result);
});

/** GET /results/round/:round — all sessions for a specific round number */
router.get('/round/:round', (req, res) => {
  const round = String(req.params.round).padStart(2, '0');
  const files = listResults().filter(f => f.includes(`_R${round}_`));
  if (files.length === 0) return res.status(404).json({ error: `No results for round ${req.params.round}` });
  res.json(files.map(f => loadResult(f)).filter(Boolean));
});

// ── Standings ─────────────────────────────────────────────────────────────────

function calculateStandings() {
  const driverPoints      = {};
  const constructorPoints = {};
  const driverInfo        = {};

  // Process race results
  const raceResults = loadResultsByType('Race');
  raceResults.forEach(result => {
    result.results.forEach(entry => {
      if (!entry.driver_number || entry.retired) return;
      const pos = entry.position;
      let pts = RACE_POINTS[pos - 1] || 0;

      // Fastest lap bonus (+1 if in top 10)
      if (result.fastest_lap?.driver_number === entry.driver_number && pos <= 10) {
        pts += FASTEST_LAP_POINT;
      }

      driverPoints[entry.driver_number] = (driverPoints[entry.driver_number] || 0) + pts;
    });
  });

  // Process sprint results
  const sprintResults = loadResultsByType('Sprint');
  sprintResults.forEach(result => {
    result.results.forEach(entry => {
      if (!entry.driver_number || entry.retired) return;
      const pos = entry.position;
      const pts = SPRINT_POINTS[pos - 1] || 0;
      driverPoints[entry.driver_number] = (driverPoints[entry.driver_number] || 0) + pts;
    });
  });

  // Build constructor points from driver points
  // We need driver→team mapping — get from the latest saved race result
  const allRaces = [...raceResults, ...sprintResults];
  if (allRaces.length > 0) {
    // We don't store team in results currently — skip constructor standings if no data
    // Constructor standings will be calculated once team data is in results
  }

  // Sort drivers by points
  const driverStandings = Object.entries(driverPoints)
    .map(([num, pts]) => ({ driver_number: num, points: pts }))
    .sort((a, b) => b.points - a.points)
    .map((entry, i) => ({ position: i + 1, ...entry }));

  return { drivers: driverStandings };
}

/**
 * GET /standings — current driver championship standings
 * Calculated from all saved race + sprint results.
 */
router.get('/drivers', (req, res) => {
  const standings = calculateStandings();
  res.json({
    timestamp: new Date().toISOString(),
    note: 'Calculated from saved session results. Updates after each finalised race/sprint.',
    ...standings,
  });
});

/**
 * GET /standings/constructors — constructor championship standings
 */
router.get('/constructors', (req, res) => {
  const constructorPoints = {};

  const process = (results, pointsTable) => {
    results.forEach(result => {
      result.results.forEach(entry => {
        if (!entry.driver_number || entry.retired) return;
        const pos  = entry.position;
        const pts  = pointsTable[pos - 1] || 0;
        // Team info needs to come from stored results — placeholder for now
        // Once team data is stored in results this will be populated
      });
    });
  };

  process(loadResultsByType('Race'),   RACE_POINTS);
  process(loadResultsByType('Sprint'), SPRINT_POINTS);

  const standings = Object.entries(constructorPoints)
    .map(([team, pts]) => ({ team, points: pts }))
    .sort((a, b) => b.points - a.points)
    .map((entry, i) => ({ position: i + 1, ...entry }));

  res.json({
    timestamp: new Date().toISOString(),
    standings,
  });
});

module.exports = router;
