const fs    = require('fs');
const path  = require('path');
const https = require('https');
const { calendar2026 } = require('../data/calendar');

const RESULTS_DIR = process.env.DATA_DIR
  ? path.join(process.env.DATA_DIR, 'results')
  : path.join(__dirname, '../data/results');

const ERGAST_BASE = 'https://api.jolpi.ca/ergast/f1/2026';

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 15000 }, res => {
      let body = '';
      res.on('data', c => (body += c));
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

/**
 * Backfill missing Race and Sprint results from Ergast API.
 * Runs once on startup — only fetches rounds whose date has passed
 * and whose result file doesn't already exist.
 */
async function backfillResults() {
  const now = new Date();

  for (const round of calendar2026) {
    const raceDate = new Date(round.sessions.race);
    if (raceDate > now) continue; // future round

    const roundStr = String(round.round).padStart(2, '0');

    // Check Race
    const raceFile = path.join(RESULTS_DIR, `2026_R${roundStr}_Race.json`);
    if (!fs.existsSync(raceFile)) {
      try {
        const data = await fetchJSON(`${ERGAST_BASE}/${round.round}/results.json`);
        const races = data?.MRData?.RaceTable?.Races || [];
        if (races.length > 0 && races[0].Results?.length > 0) {
          const result = buildResultFromErgast(races[0], round, 'Race');
          fs.writeFileSync(raceFile, JSON.stringify(result, null, 2));
          console.log(`[BACKFILL] Saved ${path.basename(raceFile)}`);
        }
      } catch (e) {
        console.warn(`[BACKFILL] Failed to fetch Race R${roundStr}:`, e.message);
      }
    }

    // Check Sprint (if applicable)
    if (round.hasSprint) {
      const sprintFile = path.join(RESULTS_DIR, `2026_R${roundStr}_Sprint.json`);
      if (!fs.existsSync(sprintFile)) {
        try {
          const data = await fetchJSON(`${ERGAST_BASE}/${round.round}/sprint.json`);
          const races = data?.MRData?.RaceTable?.Races || [];
          if (races.length > 0 && races[0].SprintResults?.length > 0) {
            const result = buildSprintFromErgast(races[0], round);
            fs.writeFileSync(sprintFile, JSON.stringify(result, null, 2));
            console.log(`[BACKFILL] Saved ${path.basename(sprintFile)}`);
          }
        } catch (e) {
          console.warn(`[BACKFILL] Failed to fetch Sprint R${roundStr}:`, e.message);
        }
      }
    }
  }
}

function buildResultFromErgast(race, round, sessionType) {
  const results = race.Results.map(r => ({
    position:       parseInt(r.position),
    driver_number:  r.number,
    laps_completed: parseInt(r.laps) || null,
    gap_to_leader:  r.Time?.time || (r.status !== 'Finished' ? r.status : null),
    best_lap_time:  r.FastestLap?.Time?.time || null,
    best_lap_number: r.FastestLap?.lap ? parseInt(r.FastestLap.lap) : null,
    retired:        ['Retired', 'Did not start', 'Did not finish', 'Disqualified', 'Excluded', 'Withdrawn'].includes(r.status) || r.positionText === 'R' || r.positionText === 'D' || r.positionText === 'W',
    stopped:        false,
    in_pit:         false,
    stints:         [],
    speed_traps:    { i1: null, i2: null, fl: null, st: null },
  }));

  let fastestLap = null;
  race.Results.forEach(r => {
    if (r.FastestLap?.rank === '1') {
      fastestLap = {
        driver_number: r.number,
        time: r.FastestLap.Time?.time || null,
        lap:  r.FastestLap.lap ? parseInt(r.FastestLap.lap) : null,
      };
    }
  });

  return {
    meta: {
      year:         '2026',
      round:        round.round,
      meeting:      round.name,
      circuit:      round.circuit,
      session_name: sessionType,
      session_type: sessionType,
      date:         round.sessions.race,
      total_laps:   round.track.laps,
      source:       'ergast-backfill',
    },
    drivers: {},
    weather: {},
    fastest_lap: fastestLap,
    results,
  };
}

function buildSprintFromErgast(race, round) {
  const results = race.SprintResults.map(r => ({
    position:       parseInt(r.position),
    driver_number:  r.number,
    laps_completed: parseInt(r.laps) || null,
    gap_to_leader:  r.Time?.time || (r.status !== 'Finished' ? r.status : null),
    best_lap_time:  r.FastestLap?.Time?.time || null,
    best_lap_number: null,
    retired:        ['Retired', 'Did not start', 'Did not finish', 'Disqualified', 'Excluded', 'Withdrawn'].includes(r.status) || r.positionText === 'R' || r.positionText === 'D' || r.positionText === 'W',
    stopped:        false,
    in_pit:         false,
    stints:         [],
    speed_traps:    { i1: null, i2: null, fl: null, st: null },
  }));

  return {
    meta: {
      year:         '2026',
      round:        round.round,
      meeting:      round.name,
      circuit:      round.circuit,
      session_name: 'Sprint',
      session_type: 'Sprint',
      date:         round.sessions.sprint,
      total_laps:   null,
      source:       'ergast-backfill',
    },
    drivers: {},
    weather: {},
    fastest_lap: null,
    results,
  };
}

module.exports = { backfillResults };
