const fs = require('fs');
const path = require('path');
const https = require('https');
const { calendar2026 } = require('../data/calendar');
const { saveSessionResult } = require('./persistence');

const RESULTS_DIR = process.env.DATA_DIR
  ? path.join(process.env.DATA_DIR, 'results')
  : path.join(__dirname, '../data/results');

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
  if (fs.existsSync(filepath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(filepath, 'utf8'));
      if (existing?.meta?.source !== 'ergast-backfill') return;
      console.log(`[BACKFILL] Replacing legacy ${filename} with F1 archive data`);
    } catch {
      // If the existing file is unreadable, attempt to rebuild it from archive.
    }
  }

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

async function ensureArchiveSession(round, archiveIndex, sessionName, sessionDate) {
  if (!sessionDate || new Date(sessionDate) > new Date()) return;
  await backfillArchiveSession(round, archiveIndex, sessionName);
}

/**
 * Backfill missing results for completed sessions using only F1's archive.
 * Runs once on startup and only fetches sessions whose scheduled date has passed
 * and whose result file does not already exist.
 */
async function backfillResults() {
  const now = new Date();
  const archiveIndex = await fetchJSON(`${STATIC_BASE}/${ARCHIVE_YEAR}/Index.json`);

  for (const round of calendar2026) {
    const raceDate = new Date(round.sessions.race);
    if (raceDate > now) continue;

    await ensureArchiveSession(round, archiveIndex, 'Qualifying', round.sessions.qualifying);
    await ensureArchiveSession(round, archiveIndex, 'Race', round.sessions.race);

    if (round.hasSprint) {
      await ensureArchiveSession(round, archiveIndex, 'Sprint Qualifying', round.sessions.sprint_qualifying);
      await ensureArchiveSession(round, archiveIndex, 'Sprint', round.sessions.sprint);
    }
  }
}

module.exports = { backfillResults };
