const { Router } = require('express');
const { loadResultsByType } = require('../f1timing/persistence');
const { RACE_POINTS, SPRINT_POINTS, FASTEST_LAP_POINT } = require('../data/calendar');
const state = require('../f1timing/state');

const router = Router();

function calculateDriverStandings() {
  const points  = {};
  const wins    = {};
  const podiums = {};

  const processResults = (results, pointsTable, isSprint = false) => {
    results.forEach(result => {
      const driverList = state.driverList || {};

      result.results.forEach(entry => {
        const num = entry.driver_number;
        if (!num || entry.retired) return;

        const pos = parseInt(entry.position);
        if (!pos) return;

        let pts = pointsTable[pos - 1] || 0;

        // Fastest lap bonus — race only, finisher in P1-P10
        if (!isSprint && result.fastest_lap?.driver_number === num && pos <= 10) {
          pts += FASTEST_LAP_POINT;
        }

        points[num]  = (points[num]  || 0) + pts;
        wins[num]    = (wins[num]    || 0) + (pos === 1 ? 1 : 0);
        podiums[num] = (podiums[num] || 0) + (pos <= 3 ? 1 : 0);
      });
    });
  };

  processResults(loadResultsByType('Race'),   RACE_POINTS,   false);
  processResults(loadResultsByType('Sprint'), SPRINT_POINTS, true);

  // Enrich with driver info from current state — include ALL drivers, not just those with results
  const driverList = state.driverList || {};

  // Merge driver numbers from results AND from the full driverList
  const allNums = new Set([
    ...Object.keys(points),
    ...Object.keys(wins),
    ...Object.keys(driverList),
  ]);

  return [...allNums]
    .filter(num => /^\d+$/.test(num))
    .map(num => {
      const d = driverList[num] || {};
      return {
        position:      null, // set below after sort
        driver_number: num,
        name:          d.FullName   || null,
        acronym:       d.Tla        || null,
        team:          d.TeamName   || null,
        team_colour:   d.TeamColour || null,
        points:        points[num]  || 0,
        wins:          wins[num]    || 0,
        podiums:       podiums[num] || 0,
      };
    })
    .filter(d => d.name) // only include drivers we have info for
    .sort((a, b) => b.points - a.points || b.wins - a.wins)
    .map((entry, i) => ({ ...entry, position: i + 1 }));
}

function calculateConstructorStandings() {
  const points = {};
  const wins   = {};

  const processResults = (results, pointsTable, isSprint = false) => {
    results.forEach(result => {
      const driverList = state.driverList || {};

      result.results.forEach(entry => {
        const num = entry.driver_number;
        if (!num || entry.retired) return;

        const pos  = parseInt(entry.position);
        if (!pos) return;

        const team = driverList[num]?.TeamName || null;
        if (!team) return;

        let pts = pointsTable[pos - 1] || 0;
        if (!isSprint && result.fastest_lap?.driver_number === num && pos <= 10) {
          pts += FASTEST_LAP_POINT;
        }

        points[team] = (points[team] || 0) + pts;
        wins[team]   = (wins[team]   || 0) + (pos === 1 ? 1 : 0);
      });
    });
  };

  processResults(loadResultsByType('Race'),   RACE_POINTS,   false);
  processResults(loadResultsByType('Sprint'), SPRINT_POINTS, true);

  // Include all teams from driverList so teams with 0 points still appear
  const driverList = state.driverList || {};
  Object.values(driverList).forEach(d => {
    if (d.TeamName && !(d.TeamName in points)) {
      points[d.TeamName] = 0;
      wins[d.TeamName]   = 0;
    }
  });

  return Object.keys(points)
    .map(team => ({ position: null, team, points: points[team] || 0, wins: wins[team] || 0 }))
    .sort((a, b) => b.points - a.points || b.wins - a.wins)
    .map((entry, i) => ({ ...entry, position: i + 1 }));
}

/** GET /standings/drivers */
router.get('/drivers', (req, res) => {
  res.json({
    timestamp: new Date().toISOString(),
    season:    2026,
    standings: calculateDriverStandings(),
  });
});

/** GET /standings/constructors */
router.get('/constructors', (req, res) => {
  res.json({
    timestamp: new Date().toISOString(),
    season:    2026,
    standings: calculateConstructorStandings(),
  });
});

module.exports = router;
