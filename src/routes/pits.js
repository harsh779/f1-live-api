const { Router } = require('express');
const state = require('../f1timing/state');

const router = Router();

/**
 * Extract pit stop data from timing state.
 * Derives pit events from InPit/PitOut flags and stint changes.
 */
function buildPitStops() {
  const drivers  = state.driverList         || {};
  const timing   = state.timingData?.Lines  || {};
  const appData  = state.timingAppData?.Lines || {};

  return Object.keys(drivers)
    .filter(num => /^\d+$/.test(num))
    .map(num => {
      const d      = drivers[num] || {};
      const td     = timing[num]  || {};
      const app    = appData[num] || {};
      const stints = app.Stints || [];
      const stintsArr = Array.isArray(stints) ? stints : Object.values(stints);

      const pitStops = stintsArr.slice(1).map((stint, i) => ({
        stop_number: i + 1,
        lap:         stint.StartLaps || null,
        compound:    stint.Compound  || null,
        new_tyre:    stint.New       || false,
        tyre_life:   stint.TyreLife  || null,
      }));

      return {
        driver_number: num,
        name:          d.FullName   || null,
        acronym:       d.Tla        || null,
        team:          d.TeamName   || null,
        in_pit:        td.InPit     || false,
        pit_out:       td.PitOut    || false,
        total_stops:   pitStops.length,
        pit_stops:     pitStops,
        current_stint: {
          number:   stintsArr.length || 0,
          compound: stintsArr[stintsArr.length - 1]?.Compound  || null,
          new_tyre: stintsArr[stintsArr.length - 1]?.New       || false,
          laps:     stintsArr[stintsArr.length - 1]?.TotalLaps || null,
        },
      };
    })
    .sort((a, b) => b.total_stops - a.total_stops);
}

/** GET /pits — all drivers' pit stop data */
router.get('/', (req, res) => {
  res.json({
    timestamp: new Date().toISOString(),
    session:   state.sessionInfo?.Name || null,
    drivers:   buildPitStops(),
  });
});

/** GET /pits/:number — single driver's pit stops */
router.get('/:number', (req, res) => {
  const driver = buildPitStops().find(d => d.driver_number == req.params.number);
  if (!driver) return res.status(404).json({ error: 'Driver not found' });
  res.json(driver);
});

module.exports = router;
