/**
 * One-time script: fetch past session data from F1 archive (local residential IP)
 * and insert directly into Turso DB. Run with:
 *   TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... node scripts/populate_turso.js
 */
require('dotenv').config();
const https  = require('https');
const { createClient } = require('@libsql/client');

const STATIC_BASE = 'https://livetiming.formula1.com/static';

const SESSIONS = [
  { round: 1, name: 'Australian Grand Prix', sessions: [
    { sessionName: 'Qualifying', path: '2026/2026-03-08_Australian_Grand_Prix/2026-03-07_Qualifying/' },
    { sessionName: 'Race',       path: '2026/2026-03-08_Australian_Grand_Prix/2026-03-08_Race/' },
  ]},
  { round: 2, name: 'Chinese Grand Prix', sessions: [
    { sessionName: 'Sprint Qualifying', path: '2026/2026-03-15_Chinese_Grand_Prix/2026-03-13_Sprint_Qualifying/' },
    { sessionName: 'Sprint',            path: '2026/2026-03-15_Chinese_Grand_Prix/2026-03-14_Sprint/' },
    { sessionName: 'Qualifying',        path: '2026/2026-03-15_Chinese_Grand_Prix/2026-03-14_Qualifying/' },
    { sessionName: 'Race',              path: '2026/2026-03-15_Chinese_Grand_Prix/2026-03-15_Race/' },
  ]},
  { round: 3, name: 'Japanese Grand Prix', sessions: [
    { sessionName: 'Qualifying', path: '2026/2026-03-29_Japanese_Grand_Prix/2026-03-28_Qualifying/' },
    { sessionName: 'Race',       path: '2026/2026-03-29_Japanese_Grand_Prix/2026-03-29_Race/' },
  ]},
];

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 20000 }, res => {
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} — ${url}`));
      }
      let body = '';
      res.on('data', c => (body += c));
      res.on('end', () => {
        try {
          const clean = body.charCodeAt(0) === 0xFEFF ? body.slice(1) : body;
          resolve(JSON.parse(clean));
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function fetchTopic(sessionPath, topic, optional = false) {
  try { return await fetchJSON(`${STATIC_BASE}/${sessionPath}${topic}.json`); }
  catch (e) { if (optional) return {}; throw e; }
}

function buildOutput(sessionInfo, timingData, appData, statsData, weatherData, lapCount, driverList) {
  const year  = sessionInfo.StartDate?.slice(0, 4) || '2026';
  const round = String(sessionInfo.Meeting?.Number || 0).padStart(2, '0');
  const type  = (sessionInfo.Name || 'Session').replace(/\s+/g, '_');
  const filename = `${year}_R${round}_${type}.json`;

  const lines    = timingData?.Lines    || {};
  const appLines = appData?.Lines       || {};
  const statLines = statsData?.Lines    || {};

  const results = Object.entries(lines)
    .filter(([num]) => /^\d+$/.test(num))
    .map(([num, td]) => {
      const app  = appLines[num]  || {};
      const stat = statLines[num] || {};
      const stints    = app.Stints || [];
      const stintsArr = Array.isArray(stints) ? stints : Object.values(stints);
      return {
        position:       parseInt(td.Position) || null,
        driver_number:  num,
        laps_completed: td.NumberOfLaps || null,
        gap_to_leader:  td.GapToLeader  || null,
        best_lap_time:  stat.PersonalFastestLap?.Value || td.BestLapTime?.Value || null,
        best_lap_number: stat.PersonalFastestLap?.Lap  || null,
        retired: td.Retired || false,
        stopped: td.Stopped || false,
        in_pit:  td.InPit   || false,
        stints: stintsArr.map(s => ({
          stint: s.TyreLife || null, compound: s.Compound || null,
          new: s.New || false, laps: s.TotalLaps || null,
        })),
        speed_traps: {
          i1: td.Speeds?.I1?.Value || null, i2: td.Speeds?.I2?.Value || null,
          fl: td.Speeds?.FL?.Value || null, st: td.Speeds?.ST?.Value || null,
        },
      };
    })
    .sort((a, b) => (a.position || 99) - (b.position || 99));

  let fastestLap = null;
  Object.entries(statLines).filter(([n]) => /^\d+$/.test(n)).forEach(([num, stat]) => {
    if (stat.PersonalFastestLap?.OverallFastest)
      fastestLap = { driver_number: num, time: stat.PersonalFastestLap.Value, lap: stat.PersonalFastestLap.Lap };
  });

  const drivers = {};
  if (driverList) {
    Object.entries(driverList).filter(([n]) => /^\d+$/.test(n)).forEach(([num, d]) => {
      drivers[num] = {
        name: [d.FirstName, d.LastName].filter(Boolean).join(' ') || d.Tla || null,
        acronym: d.Tla || null, team: d.TeamName || null,
        team_color: d.TeamColour ? '#' + d.TeamColour : null,
      };
    });
  }

  return {
    filename,
    data: {
      meta: {
        year, round: sessionInfo.Meeting?.Number || null,
        meeting: sessionInfo.Meeting?.Name || null,
        circuit: sessionInfo.Meeting?.Circuit?.ShortName || null,
        session_name: sessionInfo.Name || null,
        session_type: (sessionInfo.Name || '').includes('Sprint') ? 'Sprint ' + (sessionInfo.Type || '') : (sessionInfo.Type || null),
        date: sessionInfo.StartDate || null,
        total_laps: lapCount?.TotalLaps || null,
      },
      drivers, weather: weatherData || {}, fastest_lap: fastestLap, results,
    },
  };
}

async function main() {
  const url   = process.env.TURSO_DATABASE_URL;
  const token = process.env.TURSO_AUTH_TOKEN;
  if (!url || !token) { console.error('Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN'); process.exit(1); }

  const db = createClient({ url, authToken: token });

  // Ensure table exists
  await db.execute(`CREATE TABLE IF NOT EXISTS f1_session_results (
    filename TEXT PRIMARY KEY, data TEXT NOT NULL, saved_at INTEGER DEFAULT (unixepoch())
  )`);

  for (const meeting of SESSIONS) {
    for (const { sessionName, path } of meeting.sessions) {
      console.log(`Fetching R${meeting.round} ${sessionName}...`);
      try {
        const [sessionInfo, timingData, appData, statsData, weatherData, lapCount, driverList] =
          await Promise.all([
            fetchTopic(path, 'SessionInfo'),
            fetchTopic(path, 'TimingData'),
            fetchTopic(path, 'TimingAppData', true),
            fetchTopic(path, 'TimingStats',   true),
            fetchTopic(path, 'WeatherData',   true),
            fetchTopic(path, 'LapCount',      true),
            fetchTopic(path, 'DriverList',    true),
          ]);

        const { filename, data } = buildOutput(sessionInfo, timingData, appData, statsData, weatherData, lapCount, driverList);
        await db.execute({
          sql:  'INSERT OR REPLACE INTO f1_session_results (filename, data) VALUES (?, ?)',
          args: [filename, JSON.stringify(data, null, 2)],
        });
        console.log(`  ✓ Saved ${filename}`);
      } catch (e) {
        console.error(`  ✗ Failed R${meeting.round} ${sessionName}:`, e.message);
      }
    }
  }

  console.log('Done.');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
