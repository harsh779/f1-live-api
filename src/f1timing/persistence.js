const fs   = require('fs');
const path = require('path');

const DATA_DIR        = process.env.DATA_DIR || path.join(__dirname, '../data');
const RESULTS_DIR     = path.join(DATA_DIR, 'results');
const LAST_STATE_FILE = path.join(DATA_DIR, 'last_state.json');

// Ensure results directory exists
if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true });

/**
 * Save a finalised session's results to disk.
 * Filename: YYYY_R{round:02d}_{SessionType}.json
 * e.g. 2026_R01_Race.json, 2026_R01_Qualifying.json
 */
function saveSessionResult(sessionInfo, timingData, appData, statsData, weatherData, lapCount, driverList) {
  try {
    const year    = sessionInfo.StartDate?.slice(0, 4) || new Date().getFullYear();
    const round   = String(sessionInfo.Meeting?.Number || 0).padStart(2, '0');
    const type    = (sessionInfo.Name || 'Session').replace(/\s+/g, '_');
    const filename = `${year}_R${round}_${type}.json`;
    const filepath  = path.join(RESULTS_DIR, filename);

    const lines = timingData?.Lines || {};
    const appLines = appData?.Lines || {};
    const statLines = statsData?.Lines || {};

    // Build classified results
    const results = Object.entries(lines)
      .filter(([num]) => /^\d+$/.test(num))
      .map(([num, td]) => {
        const app  = appLines[num] || {};
        const stat = statLines[num] || {};
        const stints    = app.Stints || [];
        const stintsArr = Array.isArray(stints) ? stints : Object.values(stints);

        return {
          position:      parseInt(td.Position) || null,
          driver_number: num,
          laps_completed: td.NumberOfLaps || null,
          gap_to_leader: td.GapToLeader  || null,
          best_lap_time: stat.PersonalFastestLap?.Value || td.BestLapTime?.Value || null,
          best_lap_number: stat.PersonalFastestLap?.Lap || null,
          retired:       td.Retired  || false,
          stopped:       td.Stopped  || false,
          in_pit:        td.InPit    || false,
          stints: stintsArr.map(s => ({
            stint:    s.TyreLife || null,
            compound: s.Compound || null,
            new:      s.New      || false,
            laps:     s.TotalLaps || null,
          })),
          speed_traps: {
            i1: td.Speeds?.I1?.Value || null,
            i2: td.Speeds?.I2?.Value || null,
            fl: td.Speeds?.FL?.Value || null,
            st: td.Speeds?.ST?.Value || null,
          },
        };
      })
      .sort((a, b) => (a.position || 99) - (b.position || 99));

    // Fastest lap
    let fastestLap = null;
    Object.entries(statLines)
      .filter(([num]) => /^\d+$/.test(num))
      .forEach(([num, stat]) => {
        if (stat.PersonalFastestLap?.OverallFastest) {
          fastestLap = { driver_number: num, time: stat.PersonalFastestLap.Value, lap: stat.PersonalFastestLap.Lap };
        }
      });

    // Build compact driver lookup from DriverList
    const drivers = {};
    if (driverList) {
      Object.entries(driverList).filter(([num]) => /^\d+$/.test(num)).forEach(([num, d]) => {
        drivers[num] = {
          name: [d.FirstName, d.LastName].filter(Boolean).join(' ') || d.Tla || null,
          acronym: d.Tla || null,
          team: d.TeamName || null,
          team_color: d.TeamColour ? '#' + d.TeamColour : null,
        };
      });
    }

    const output = {
      meta: {
        year,
        round: sessionInfo.Meeting?.Number || null,
        meeting: sessionInfo.Meeting?.Name || null,
        circuit: sessionInfo.Meeting?.Circuit?.ShortName || null,
        session_name: sessionInfo.Name || null,
        session_type: sessionInfo.Type || null,
        date: sessionInfo.StartDate || null,
        total_laps: lapCount?.TotalLaps || null,
      },
      drivers,
      weather: weatherData || {},
      fastest_lap: fastestLap,
      results,
    };

    fs.writeFileSync(filepath, JSON.stringify(output, null, 2));
    console.log(`[F1] Session saved → ${filename}`);
    return filename;
  } catch (err) {
    console.error('[F1] Failed to save session result:', err.message);
    return null;
  }
}

/** List all saved session result files. */
function listResults() {
  return fs.readdirSync(RESULTS_DIR)
    .filter(f => f.endsWith('.json'))
    .sort()
    .reverse(); // newest first
}

/** Load a single saved result by filename. */
function loadResult(filename) {
  const filepath = path.join(RESULTS_DIR, filename);
  if (!fs.existsSync(filepath)) return null;
  return JSON.parse(fs.readFileSync(filepath, 'utf8'));
}

/** Load all results of a given session type (Race, Qualifying, Sprint). */
function loadResultsByType(type) {
  return listResults()
    .filter(f => f.includes(`_${type}.json`))
    .map(f => loadResult(f))
    .filter(Boolean);
}

/** Persist the current live state snapshot to disk (survives restarts). */
function saveLastState(snapshot) {
  try {
    fs.writeFileSync(LAST_STATE_FILE, JSON.stringify(snapshot));
  } catch {}
}

/** Load the last persisted state snapshot. Returns null if not found. */
function loadLastState() {
  try {
    if (!fs.existsSync(LAST_STATE_FILE)) return null;
    return JSON.parse(fs.readFileSync(LAST_STATE_FILE, 'utf8'));
  } catch { return null; }
}

module.exports = { saveSessionResult, listResults, loadResult, loadResultsByType, saveLastState, loadLastState };
