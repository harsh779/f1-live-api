const { Router } = require('express');
const { loadResultsByType } = require('../f1timing/persistence');
const { RACE_POINTS, SPRINT_POINTS, FASTEST_LAP_POINT } = require('../data/calendar');
const state = require('../f1timing/state');

const router = Router();

const SEASON = 2026;
const F1_RESULTS_BASE = `https://www.formula1.com/en/results/${SEASON}`;
const CACHE_TTL = 5 * 60 * 1000;
const standingsCache = new Map();

function normalizeKey(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

function decodeHtml(value) {
  return String(value || '')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function stripTags(value) {
  return decodeHtml(value)
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleFromSlug(slug) {
  return String(slug || '')
    .split('-')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

async function fetchText(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; f1-live-api standings)' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.text();
    return body.charCodeAt(0) === 0xFEFF ? body.slice(1) : body;
  } finally {
    clearTimeout(timeout);
  }
}

function getCached(key) {
  const cached = standingsCache.get(key);
  if (!cached || Date.now() - cached.ts > CACHE_TTL) {
    standingsCache.delete(key);
    return null;
  }
  return cached.data;
}

function setCached(key, data) {
  standingsCache.set(key, { ts: Date.now(), data });
}

function parseRows(html) {
  const tbody = String(html || '').match(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/i)?.[1];
  if (!tbody) return [];

  return [...tbody.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map(rowMatch => [...rowMatch[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(cell => cell[1]))
    .filter(cells => cells.length > 0);
}

function parseDriverStandingsHtml(html) {
  return parseRows(html).map(cells => {
    const driverCell = cells[1] || '';
    const driverHref = driverCell.match(/href="[^"]*\/drivers\/[^/"]+\/([^"]+)"/i)?.[1];
    const rawDriverText = stripTags(driverCell);
    const acronym = rawDriverText.match(/([A-Z]{3})$/)?.[1] || null;
    const name = driverHref ? titleFromSlug(driverHref) : rawDriverText.replace(/[A-Z]{3}$/, '').trim();

    return {
      position: parseInt(stripTags(cells[0]), 10),
      name,
      acronym,
      nationality: stripTags(cells[2]) || null,
      team: stripTags(cells[3]) || null,
      points: parseInt(stripTags(cells[4]), 10) || 0,
    };
  }).filter(row => row.position && row.name);
}

function parseConstructorStandingsHtml(html) {
  return parseRows(html).map(cells => ({
    position: parseInt(stripTags(cells[0]), 10),
    team: stripTags(cells[1]) || null,
    points: parseInt(stripTags(cells[2]), 10) || 0,
  })).filter(row => row.position && row.team);
}

async function fetchOfficialDriverStandings() {
  const cacheKey = 'official:drivers';
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const html = await fetchText(`${F1_RESULTS_BASE}/drivers`);
  const standings = parseDriverStandingsHtml(html);
  if (!standings.length) throw new Error('No driver standings found');

  setCached(cacheKey, standings);
  return standings;
}

async function fetchOfficialConstructorStandings() {
  const cacheKey = 'official:constructors';
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const html = await fetchText(`${F1_RESULTS_BASE}/team`);
  const standings = parseConstructorStandingsHtml(html);
  if (!standings.length) throw new Error('No constructor standings found');

  setCached(cacheKey, standings);
  return standings;
}

function getDriverInfoFromState() {
  const infoByNumber = {};
  const infoByName = {};

  Object.entries(state.driverList || {})
    .filter(([num]) => /^\d+$/.test(num))
    .forEach(([num, driver]) => {
      const name = driver.FullName || [driver.FirstName, driver.LastName].filter(Boolean).join(' ');
      const info = {
        driver_number: num,
        name: name || null,
        acronym: driver.Tla || null,
        team: driver.TeamName || null,
        team_colour: driver.TeamColour || null,
      };
      infoByNumber[num] = info;
      if (info.name) infoByName[normalizeKey(info.name)] = info;
    });

  return { infoByNumber, infoByName };
}

function getRaceStats() {
  const drivers = {};
  const constructors = {};

  loadResultsByType('Race').forEach(result => {
    (result.results || []).forEach(entry => {
      const num = entry.driver_number;
      const pos = parseInt(entry.position, 10);
      if (!num || entry.retired || !pos) return;

      const driver = result.drivers?.[num] || {};
      const name = driver.name || state.driverList?.[num]?.FullName || null;
      const team = driver.team || state.driverList?.[num]?.TeamName || null;

      if (name) {
        const key = normalizeKey(name);
        drivers[key] = drivers[key] || { wins: 0, podiums: 0 };
        if (pos === 1) drivers[key].wins += 1;
        if (pos <= 3) drivers[key].podiums += 1;
      }

      if (team) {
        const key = normalizeKey(team);
        constructors[key] = constructors[key] || { wins: 0 };
        if (pos === 1) constructors[key].wins += 1;
      }
    });
  });

  return { drivers, constructors };
}

function calculateLocalFallbackDriverStandings() {
  const points = {};
  const { drivers: raceDriverStats } = getRaceStats();

  const processResults = (results, pointsTable, isSprint = false) => {
    results.forEach(result => {
      (result.results || []).forEach(entry => {
        const num = entry.driver_number;
        if (!num || entry.retired) return;

        const pos = parseInt(entry.position, 10);
        if (!pos) return;

        let pts = pointsTable[pos - 1] || 0;
        if (!isSprint && result.fastest_lap?.driver_number === num && pos <= 10) {
          pts += FASTEST_LAP_POINT;
        }
        points[num] = (points[num] || 0) + pts;
      });
    });
  };

  processResults(loadResultsByType('Race'), RACE_POINTS, false);
  processResults(loadResultsByType('Sprint'), SPRINT_POINTS, true);

  const { infoByNumber } = getDriverInfoFromState();
  const allNums = new Set([...Object.keys(points), ...Object.keys(infoByNumber)]);

  return [...allNums]
    .filter(num => /^\d+$/.test(num))
    .map(num => {
      const info = infoByNumber[num] || {};
      const raceStats = raceDriverStats[normalizeKey(info.name)] || {};
      return {
        position: null,
        driver_number: num,
        name: info.name || null,
        acronym: info.acronym || null,
        team: info.team || null,
        team_colour: info.team_colour || null,
        points: points[num] || 0,
        wins: raceStats.wins || 0,
        podiums: raceStats.podiums || 0,
      };
    })
    .filter(d => d.name)
    .sort((a, b) => b.points - a.points || b.wins - a.wins)
    .map((entry, i) => ({ ...entry, position: i + 1 }));
}

function calculateLocalFallbackConstructorStandings() {
  const points = {};
  const { constructors: raceConstructorStats } = getRaceStats();

  const processResults = (results, pointsTable, isSprint = false) => {
    results.forEach(result => {
      (result.results || []).forEach(entry => {
        const num = entry.driver_number;
        if (!num || entry.retired) return;

        const pos = parseInt(entry.position, 10);
        if (!pos) return;

        const team = result.drivers?.[num]?.team || state.driverList?.[num]?.TeamName || null;
        if (!team) return;

        let pts = pointsTable[pos - 1] || 0;
        if (!isSprint && result.fastest_lap?.driver_number === num && pos <= 10) {
          pts += FASTEST_LAP_POINT;
        }
        points[team] = (points[team] || 0) + pts;
      });
    });
  };

  processResults(loadResultsByType('Race'), RACE_POINTS, false);
  processResults(loadResultsByType('Sprint'), SPRINT_POINTS, true);

  Object.values(state.driverList || {}).forEach(driver => {
    if (driver.TeamName && !(driver.TeamName in points)) points[driver.TeamName] = 0;
  });

  return Object.keys(points)
    .map(team => ({
      position: null,
      team,
      points: points[team] || 0,
      wins: raceConstructorStats[normalizeKey(team)]?.wins || 0,
    }))
    .sort((a, b) => b.points - a.points || b.wins - a.wins)
    .map((entry, i) => ({ ...entry, position: i + 1 }));
}

async function getDriverStandings() {
  const official = await fetchOfficialDriverStandings();
  const { drivers: raceDriverStats } = getRaceStats();
  const { infoByName } = getDriverInfoFromState();

  return official.map(row => {
    const key = normalizeKey(row.name);
    const info = infoByName[key] || {};
    const raceStats = raceDriverStats[key] || {};
    return {
      position: row.position,
      driver_number: info.driver_number || null,
      name: row.name,
      acronym: info.acronym || row.acronym || null,
      nationality: row.nationality || null,
      team: row.team,
      team_colour: info.team_colour || null,
      points: row.points,
      wins: raceStats.wins || 0,
      podiums: raceStats.podiums || 0,
    };
  });
}

async function getConstructorStandings() {
  const official = await fetchOfficialConstructorStandings();
  const { constructors: raceConstructorStats } = getRaceStats();

  return official.map(row => ({
    position: row.position,
    team: row.team,
    points: row.points,
    wins: raceConstructorStats[normalizeKey(row.team)]?.wins || 0,
  }));
}

/** GET /standings/drivers */
router.get('/drivers', async (req, res) => {
  try {
    res.json({
      timestamp: new Date().toISOString(),
      season: SEASON,
      source: 'formula1.com-results-plus-race-archive-stats',
      standings: await getDriverStandings(),
    });
  } catch (err) {
    res.json({
      timestamp: new Date().toISOString(),
      season: SEASON,
      source: 'local-results-fallback',
      upstreamError: err.message,
      standings: calculateLocalFallbackDriverStandings(),
    });
  }
});

/** GET /standings/constructors */
router.get('/constructors', async (req, res) => {
  try {
    res.json({
      timestamp: new Date().toISOString(),
      season: SEASON,
      source: 'formula1.com-results-plus-race-archive-stats',
      standings: await getConstructorStandings(),
    });
  } catch (err) {
    res.json({
      timestamp: new Date().toISOString(),
      season: SEASON,
      source: 'local-results-fallback',
      upstreamError: err.message,
      standings: calculateLocalFallbackConstructorStandings(),
    });
  }
});

module.exports = router;
