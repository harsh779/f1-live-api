const fs   = require('fs');
const path = require('path');

const DATA_DIR        = process.env.DATA_DIR || path.join(__dirname, '../data');
const RESULTS_DIR     = path.join(DATA_DIR, 'results');
const LAST_STATE_FILE = path.join(DATA_DIR, 'last_state.json');

// Ensure results directory exists
if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true });

// ── Turso client (optional — gracefully degraded if env vars absent) ──────────
let _turso = null;
function getTurso() {
  if (_turso) return _turso;
  const url   = process.env.TURSO_DATABASE_URL;
  const token = process.env.TURSO_AUTH_TOKEN;
  if (!url || !token) return null;
  try {
    const { createClient } = require('@libsql/client');
    _turso = createClient({ url, authToken: token });
    return _turso;
  } catch (e) {
    console.warn('[TURSO] Failed to create client:', e.message);
    return null;
  }
}

/** Ensure Turso tables exist. Called once at startup. */
async function initTurso() {
  const db = getTurso();
  if (!db) {
    console.warn('[TURSO] Skipping init — TURSO_DATABASE_URL / TURSO_AUTH_TOKEN not set');
    return;
  }
  try {
    await db.executeMultiple(`
      CREATE TABLE IF NOT EXISTS f1_session_results (
        filename TEXT PRIMARY KEY,
        data     TEXT NOT NULL,
        saved_at INTEGER DEFAULT (unixepoch())
      );
      CREATE TABLE IF NOT EXISTS f1_kv_store (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
    console.log('[TURSO] Tables ready');
  } catch (e) {
    console.error('[TURSO] Init error:', e.message);
  }
}

/** Mirror a result file to Turso (fire-and-forget). */
function _tursoSaveResult(filename, data) {
  const db = getTurso();
  if (!db) return;
  db.execute({
    sql:  'INSERT OR REPLACE INTO f1_session_results (filename, data) VALUES (?, ?)',
    args: [filename, JSON.stringify(data)],
  }).catch(e => console.warn('[TURSO] Failed to mirror result:', e.message));
}

/** Mirror the kv store entry to Turso (fire-and-forget). */
function _tursoSaveKV(key, value) {
  const db = getTurso();
  if (!db) return;
  db.execute({
    sql:  'INSERT OR REPLACE INTO f1_kv_store (key, value) VALUES (?, ?)',
    args: [key, typeof value === 'string' ? value : JSON.stringify(value)],
  }).catch(e => console.warn('[TURSO] Failed to mirror kv:', e.message));
}

async function saveKV(key, value) {
  const db = getTurso();
  if (!db) return false;
  await db.execute({
    sql:  'INSERT OR REPLACE INTO f1_kv_store (key, value) VALUES (?, ?)',
    args: [key, typeof value === 'string' ? value : JSON.stringify(value)],
  });
  return true;
}

async function loadKV(key) {
  const db = getTurso();
  if (!db) return null;
  const rows = await db.execute({ sql: 'SELECT value FROM f1_kv_store WHERE key = ?', args: [key] });
  return rows.rows[0]?.value || null;
}

/**
 * On startup: pull any session result files stored in Turso that are missing
 * from the local filesystem (e.g. after an ephemeral container restart).
 */
async function rehydrateFromTurso() {
  const db = getTurso();
  if (!db) return;
  try {
    // Rehydrate session results
    const rows = await db.execute('SELECT filename, data FROM f1_session_results');
    let restored = 0;
    for (const row of rows.rows) {
      const filepath = path.join(RESULTS_DIR, row.filename);
      if (!fs.existsSync(filepath)) {
        try {
          fs.writeFileSync(filepath, row.data, 'utf8');
          restored++;
        } catch (e) {
          console.warn(`[TURSO] Failed to write ${row.filename}:`, e.message);
        }
      }
    }
    if (restored > 0) console.log(`[TURSO] Rehydrated ${restored} session result(s) from Turso`);

    // Rehydrate last_state
    if (!fs.existsSync(LAST_STATE_FILE)) {
      const kv = await db.execute({ sql: "SELECT value FROM f1_kv_store WHERE key = 'last_state'", args: [] });
      if (kv.rows.length > 0) {
        try {
          fs.writeFileSync(LAST_STATE_FILE, kv.rows[0].value, 'utf8');
          console.log('[TURSO] Rehydrated last_state from Turso');
        } catch {}
      }
    }
  } catch (e) {
    console.warn('[TURSO] Rehydrate failed:', e.message);
  }
}

// ── Core persistence (fs-primary, Turso mirrored) ─────────────────────────────

/**
 * Save a finalised session's results to disk.
 * Filename: YYYY_R{round:02d}_{SessionType}.json
 * e.g. 2026_R01_Race.json, 2026_R01_Qualifying.json
 */
function saveSessionResult(sessionInfo, timingData, appData, statsData, weatherData, lapCount, driverList, options = {}) {
  try {
    const year    = sessionInfo.StartDate?.slice(0, 4) || new Date().getFullYear();
    const round   = String(sessionInfo.Meeting?.Number || 0).padStart(2, '0');
    const type    = (sessionInfo.Name || 'Session').replace(/\s+/g, '_');
    const defaultFilename = `${year}_R${round}_${type}.json`;
    const filename = /^\d{4}_R\d{2}_\w+\.json$/.test(options.filename || '')
      ? options.filename
      : defaultFilename;
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
        const sessionStats = Array.isArray(td.Stats) ? td.Stats : Object.values(td.Stats || {});
        const finalSessionStats = [...sessionStats].reverse().find(s =>
          s?.TimeDifftoPositionAhead || s?.TimeDiffToFastest
        ) || {};
        const personalBestLap = stat.PersonalBestLapTime || stat.PersonalFastestLap || {};
        const position = parseInt(td.Position) || null;

        return {
          position,
          driver_number: num,
          laps_completed: td.NumberOfLaps || null,
          gap_to_leader: position === 1 ? null : (td.GapToLeader || finalSessionStats.TimeDiffToFastest || null),
          interval: position === 1 ? null : (td.IntervalToPositionAhead?.Value || finalSessionStats.TimeDifftoPositionAhead || null),
          best_lap_time: personalBestLap.Value || td.BestLapTime?.Value || null,
          best_lap_number: personalBestLap.Lap || td.BestLapTime?.Lap || null,
          retired:       td.Retired  || false,
          stopped:       td.Stopped  || false,
          in_pit:        td.InPit    || false,
          sectors: [0, 1, 2].map(i => {
            const sector = td.Sectors?.[i] || {};
            const bestSector = stat.BestSectors?.[i] || {};
            const segments = sector.Segments || {};
            const segmentList = Array.isArray(segments) ? segments : Object.values(segments);
            return {
              value: bestSector.Value || sector.Value || sector.PreviousValue || null,
              personal_best: Boolean(sector.PersonalFastest),
              overall_best: bestSector.Position === 1 || Boolean(sector.OverallFastest),
              stopped: Boolean(sector.Stopped),
              segments: segmentList.map((segment, index) => ({
                index,
                status: segment?.Status ?? 0,
              })),
            };
          }),
          stints: stintsArr.map(s => ({
            stint:    s.TyreLife || null,
            compound: s.Compound || null,
            new:      s.New      || false,
            laps:     s.TotalLaps || null,
          })),
          speed_traps: {
            i1: stat.BestSpeeds?.I1?.Value || td.Speeds?.I1?.Value || null,
            i2: stat.BestSpeeds?.I2?.Value || td.Speeds?.I2?.Value || null,
            fl: stat.BestSpeeds?.FL?.Value || td.Speeds?.FL?.Value || null,
            st: stat.BestSpeeds?.ST?.Value || td.Speeds?.ST?.Value || null,
          },
        };
      })
      .sort((a, b) => (a.position || 99) - (b.position || 99));

    // Fastest lap
    let fastestLap = null;
    Object.entries(statLines)
      .filter(([num]) => /^\d+$/.test(num))
      .forEach(([num, stat]) => {
        const personalBestLap = stat.PersonalBestLapTime || stat.PersonalFastestLap;
        if (personalBestLap?.Position === 1 || personalBestLap?.OverallFastest) {
          fastestLap = { driver_number: num, time: personalBestLap.Value, lap: personalBestLap.Lap };
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
        session_type: (sessionInfo.Name || '').includes('Sprint') ? 'Sprint ' + (sessionInfo.Type || '') : (sessionInfo.Type || null),
        date: sessionInfo.StartDate || null,
        total_laps: lapCount?.TotalLaps || null,
        archive_path: options.archive_path || null,
      },
      drivers,
      weather: weatherData || {},
      fastest_lap: fastestLap,
      results,
    };

    fs.writeFileSync(filepath, JSON.stringify(output, null, 2));
    console.log(`[F1] Session saved → ${filename}`);

    // Mirror to Turso asynchronously
    _tursoSaveResult(filename, output);

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
    // Mirror to Turso asynchronously
    _tursoSaveKV('last_state', JSON.stringify(snapshot));
  } catch {}
}

/** Load the last persisted state snapshot. Returns null if not found. */
function loadLastState() {
  try {
    if (!fs.existsSync(LAST_STATE_FILE)) return null;
    return JSON.parse(fs.readFileSync(LAST_STATE_FILE, 'utf8'));
  } catch { return null; }
}

module.exports = {
  saveSessionResult,
  listResults,
  loadResult,
  loadResultsByType,
  saveLastState,
  loadLastState,
  saveKV,
  loadKV,
  initTurso,
  rehydrateFromTurso,
};
