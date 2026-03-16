const fs = require('fs');
const path = require('path');
const https = require('https');
const { calendar2026 } = require('../data/calendar');
const { saveSessionResult } = require('./persistence');

const RESULTS_DIR = process.env.DATA_DIR
  ? path.join(process.env.DATA_DIR, 'results')
  : path.join(__dirname, '../data/results');

const ERGAST_BASE = 'https://api.jolpi.ca/ergast/f1/2026';
const STATIC_BASE = 'https://livetiming.formula1.com/static';
const ARCHIVE_YEAR = '2026';

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 15000 }, res => {
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }

      let body = '';
      res.on('data', c => (body += c));
      res.on('end', () => {
        try {
          const clean = body.charCodeAt(0) === 0xFEFF ? body.slice(1) : body;
          resolve(JSON.parse(clean));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('timeout'));
    });
  });
}

function normalizeName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function getArchiveMeeting(index, round) {
  const meetings = index?.Meetings || [];
  const exactName = normalizeName(round.name);
  const city = normalizeName(round.city);

  return meetings.find(m => normalizeName(m.Name) === exactName)
    || meetings.find(m => normalizeName(m.Location) === city)
    || meetings.find(m => normalizeName(m.Name).includes(exactName) || exactName.includes(normalizeName(m.Name)))
    || meetings.find(m => normalizeName(m.Location).includes(city) || city.includes(normalizeName(m.Location)))
    || null;
}

function getArchiveSession(meeting, sessionName) {
  const sessions = meeting?.Sessions || [];
  const target = normalizeName(sessionName);

  return sessions.find(s => normalizeName(s.Name) === target || normalizeName(s.Type) === target)
    || sessions.find(s => normalizeName(s.Name).includes(target) || normalizeName(s.Type).includes(target))
    || null;
}

async function fetchArchiveTopic(sessionPath, topic, { optional = false } = {}) {
  try {
    return await fetchJSON(`${STATIC_BASE}/${sessionPath}${topic}.json`);
  } catch (err) {
    if (optional) return {};
    throw err;
  }
}

async function backfillArchiveSession(round, archiveIndex, sessionName) {
  const roundStr = String(round.round).padStart(2, '0');
  const filename = `2026_R${roundStr}_${sessionName.replace(/\s+/g, '_')}.json`;
  const filepath = path.join(RESULTS_DIR, filename);
  if (fs.existsSync(filepath)) return;

  const meeting = getArchiveMeeting(archiveIndex, round);
  if (!meeting) {
    console.warn(`[BACKFILL] Archive meeting not found for R${roundStr}: ${round.name}`);
    return;
  }

  const session = getArchiveSession(meeting, sessionName);
  if (!session?.Path) {
    console.warn(`[BACKFILL] Archive session not found for R${roundStr}: ${sessionName}`);
    return;
  }

  try {
    const [
      sessionInfo,
      timingData,
      timingAppData,
      timingStats,
      weatherData,
      lapCount,
      driverList,
    ] = await Promise.all([
      fetchArchiveTopic(session.Path, 'SessionInfo'),
      fetchArchiveTopic(session.Path, 'TimingData'),
      fetchArchiveTopic(session.Path, 'TimingAppData', { optional: true }),
      fetchArchiveTopic(session.Path, 'TimingStats', { optional: true }),
      fetchArchiveTopic(session.Path, 'WeatherData', { optional: true }),
      fetchArchiveTopic(session.Path, 'LapCount', { optional: true }),
      fetchArchiveTopic(session.Path, 'DriverList', { optional: true }),
    ]);

    const saved = saveSessionResult(
      sessionInfo,
      timingData,
      timingAppData,
      timingStats,
      weatherData,
      lapCount,
      driverList,
    );

    if (saved) console.log(`[BACKFILL] Saved ${saved} from archive`);
  } catch (e) {
    console.warn(`[BACKFILL] Failed to fetch ${sessionName} R${roundStr}:`, e.message);
  }
}

/**
 * Backfill missing results for completed sessions.
 * Runs once on startup and only fetches rounds whose session date has passed
 * and whose result file does not already exist.
 */
async function backfillResults() {
  const now = new Date();
  let archiveIndex = null;

  for (const round of calendar2026) {
    const raceDate = new Date(round.sessions.race);
    if (raceDate > now) continue;

    const roundStr = String(round.round).padStart(2, '0');

    if (round.sessions.qualifying && new Date(round.sessions.qualifying) <= now) {
      try {
        archiveIndex ||= await fetchJSON(`${STATIC_BASE}/${ARCHIVE_YEAR}/Index.json`);
        await backfillArchiveSession(round, archiveIndex, 'Qualifying');
      } catch (e) {
        console.warn(`[BACKFILL] Failed to prepare archive Qualifying R${roundStr}:`, e.message);
      }
    }

    if (round.hasSprint && round.sessions.sprint_qualifying && new Date(round.sessions.sprint_qualifying) <= now) {
      try {
        archiveIndex ||= await fetchJSON(`${STATIC_BASE}/${ARCHIVE_YEAR}/Index.json`);
        await backfillArchiveSession(round, archiveIndex, 'Sprint Qualifying');
      } catch (e) {
        console.warn(`[BACKFILL] Failed to prepare archive Sprint Qualifying R${roundStr}:`, e.message);
      }
    }

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
    position: parseInt(r.position),
    driver_number: r.number,
    laps_completed: parseInt(r.laps) || null,
    gap_to_leader: r.Time?.time || (r.status !== 'Finished' ? r.status : null),
    best_lap_time: r.FastestLap?.Time?.time || null,
    best_lap_number: r.FastestLap?.lap ? parseInt(r.FastestLap.lap) : null,
    retired: ['Retired', 'Did not start', 'Did not finish', 'Disqualified', 'Excluded', 'Withdrawn'].includes(r.status),
    stopped: false,
    in_pit: false,
    stints: [],
    speed_traps: { i1: null, i2: null, fl: null, st: null },
  }));

  let fastestLap = null;
  race.Results.forEach(r => {
    if (r.FastestLap?.rank === '1') {
      fastestLap = {
        driver_number: r.number,
        time: r.FastestLap.Time?.time || null,
        lap: r.FastestLap.lap ? parseInt(r.FastestLap.lap) : null,
      };
    }
  });

  return {
    meta: {
      year: '2026',
      round: round.round,
      meeting: round.name,
      circuit: round.circuit,
      session_name: sessionType,
      session_type: sessionType,
      date: round.sessions.race,
      total_laps: round.track.laps,
      source: 'ergast-backfill',
    },
    drivers: {},
    weather: {},
    fastest_lap: fastestLap,
    results,
  };
}

function buildSprintFromErgast(race, round) {
  const results = race.SprintResults.map(r => ({
    position: parseInt(r.position),
    driver_number: r.number,
    laps_completed: parseInt(r.laps) || null,
    gap_to_leader: r.Time?.time || (r.status !== 'Finished' ? r.status : null),
    best_lap_time: r.FastestLap?.Time?.time || null,
    best_lap_number: null,
    retired: ['Retired', 'Did not start', 'Did not finish', 'Disqualified', 'Excluded', 'Withdrawn'].includes(r.status),
    stopped: false,
    in_pit: false,
    stints: [],
    speed_traps: { i1: null, i2: null, fl: null, st: null },
  }));

  return {
    meta: {
      year: '2026',
      round: round.round,
      meeting: round.name,
      circuit: round.circuit,
      session_name: 'Sprint',
      session_type: 'Sprint',
      date: round.sessions.sprint,
      total_laps: null,
      source: 'ergast-backfill',
    },
    drivers: {},
    weather: {},
    fastest_lap: null,
    results,
  };
}

module.exports = { backfillResults };
