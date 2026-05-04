const fs = require('fs');
const path = require('path');
const { calendar2026: staticCalendarMetadata } = require('./calendar');
const { loadKV, saveKV } = require('../f1timing/persistence');

const YEAR = 2026;
const CACHE_KEY = 'calendar_2026_dynamic';
const INDEX_URL = `https://livetiming.formula1.com/static/${YEAR}/Index.json`;
const F1_RACING_BASE_URL = `https://www.formula1.com/en/racing/${YEAR}`;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../data');
const CACHE_FILE = path.join(DATA_DIR, 'calendar_2026_dynamic.json');

let _calendar = [];
let _lastRefresh = null;

const trackMetadataByName = new Map(
  staticCalendarMetadata.map(race => [normalizeName(race.name), {
    circuit: race.circuit,
    country: race.country,
    track: race.track,
  }])
);

function cloneCalendar(calendar) {
  return JSON.parse(JSON.stringify(calendar || []));
}

function normalizeName(value = '') {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

function isValidCalendar(calendar) {
  return Array.isArray(calendar)
    && calendar.length >= 20
    && calendar.every(r => r && r.round && r.name && r.sessions?.race);
}

function toOffsetIso(startDate, gmtOffset) {
  if (!startDate) return null;
  if (/[zZ]|[+-]\d\d:\d\d$/.test(startDate)) {
    const direct = new Date(startDate);
    return Number.isNaN(direct.getTime()) ? null : direct.toISOString();
  }

  const offset = String(gmtOffset || '00:00:00');
  const sign = offset.startsWith('-') ? '-' : '+';
  const clean = offset.replace(/^[+-]/, '');
  const [hh = '00', mm = '00'] = clean.split(':');
  const parsed = new Date(`${startDate}${sign}${hh.padStart(2, '0')}:${mm.padStart(2, '0')}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function sessionKey(session) {
  const name = String(session?.Name || '').toLowerCase();
  const type = String(session?.Type || '').toLowerCase();
  const number = Number(session?.Number || 0);

  if (name.includes('sprint qualifying') || name.includes('sprint shootout')) return 'sprint_qualifying';
  if (name === 'sprint' || (type === 'race' && name.includes('sprint'))) return 'sprint';
  if (name.includes('qualifying') || type === 'qualifying') return 'qualifying';
  if (name === 'race' || (type === 'race' && !name.includes('sprint'))) return 'race';
  if (name.includes('practice 1') || (type === 'practice' && number === 1)) return 'fp1';
  if (name.includes('practice 2') || (type === 'practice' && number === 2)) return 'fp2';
  if (name.includes('practice 3') || (type === 'practice' && number === 3)) return 'fp3';
  return null;
}

function attachTrackMetadata(race) {
  const metadata = trackMetadataByName.get(normalizeName(race.name));
  if (!metadata) return race;
  return {
    ...race,
    circuit: race.circuit || metadata.circuit || null,
    country: race.country || metadata.country || null,
    track: race.track || metadata.track || null,
  };
}

function findCalendarRace(meeting) {
  const meetingName = normalizeName(meeting?.Name);
  const round = Number(meeting?.Number || 0);
  return _calendar.find(r => normalizeName(r.name) === meetingName)
    || _calendar.find(r => Number(r.apiRound || r.officialRound || 0) === round && /grand prix/i.test(meeting?.Name || ''))
    || null;
}

function mergeSessionsFromIndex(index) {
  let updated = 0;
  const meetings = Array.isArray(index?.Meetings) ? index.Meetings : [];

  for (const meeting of meetings) {
    if (!/grand prix/i.test(meeting?.Name || '')) continue;
    const race = findCalendarRace(meeting);
    if (!race) continue;

    const timingRound = Number(meeting?.Number || 0);
    if (timingRound && race.apiRound !== timingRound) {
      race.apiRound = timingRound;
      race.timingMeetingKey = meeting.Key || race.timingMeetingKey || null;
      updated++;
    }

    const sessions = Array.isArray(meeting.Sessions) ? meeting.Sessions : [];
    for (const session of sessions) {
      const key = sessionKey(session);
      const iso = toOffsetIso(session.StartDate, session.GmtOffset);
      if (!key || !iso) continue;
      if (!race.sessions) race.sessions = {};
      if (!race.sessions[key]) {
        race.sessions[key] = iso;
        if (key === 'race') race.date = iso;
        updated++;
      }
    }
  }

  return updated;
}

function keyFromF1EventName(name) {
  const value = String(name || '').toLowerCase();
  if (value.includes('sprint qualifying') || value.includes('sprint shootout')) return 'sprint_qualifying';
  if (value.includes('practice 1') || value.includes('free practice 1')) return 'fp1';
  if (value.includes('practice 2') || value.includes('free practice 2')) return 'fp2';
  if (value.includes('practice 3') || value.includes('free practice 3')) return 'fp3';
  if (value.includes('sprint') && !value.includes('qualifying')) return 'sprint';
  if (value.includes('qualifying')) return 'qualifying';
  if (value.includes('race')) return 'race';
  return null;
}

function cleanRaceName(name = '') {
  let value = String(name || '')
    .replace(/^FORMULA 1\s+/i, '')
    .replace(/\s+2026$/i, '')
    .trim();

  const suffixes = [
    'Australian Grand Prix',
    'Chinese Grand Prix',
    'Japanese Grand Prix',
    'Miami Grand Prix',
    'Canadian Grand Prix',
    'Monaco Grand Prix',
    'Barcelona-Catalunya Grand Prix',
    'Austrian Grand Prix',
    'British Grand Prix',
    'Belgian Grand Prix',
    'Hungarian Grand Prix',
    'Dutch Grand Prix',
    'Italian Grand Prix',
    'Spanish Grand Prix',
    'Azerbaijan Grand Prix',
    'Singapore Grand Prix',
    'United States Grand Prix',
    'Mexico City Grand Prix',
    'Brazilian Grand Prix',
    'Las Vegas Grand Prix',
    'Qatar Grand Prix',
    'Abu Dhabi Grand Prix',
  ];

  return suffixes.find(suffix => normalizeName(value).endsWith(normalizeName(suffix))) || value;
}

function raceNameFromSubEvents(subEvents = []) {
  for (const subEvent of subEvents) {
    const parts = String(subEvent?.name || '').split(' - ');
    if (parts.length > 1 && /grand prix/i.test(parts[1])) return parts.slice(1).join(' - ').trim();
  }
  return null;
}

function extractJsonLd(html) {
  const blocks = [...String(html || '').matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const block of blocks) {
    try {
      const parsed = JSON.parse(block[1]);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      const event = items.find(item => Array.isArray(item?.subEvent));
      if (event) return event;
    } catch {}
  }
  return null;
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; f1-live-api calendar refresh)' },
  });
  if (!response.ok) throw new Error(`${url} HTTP ${response.status}`);
  return response.text();
}

async function fetchSeasonSlugs() {
  const html = await fetchHtml(F1_RACING_BASE_URL);
  const slugs = [...new Set(
    [...html.matchAll(/\/en\/racing\/2026\/([a-z0-9-]+)/g)]
      .map(match => match[1])
      .filter(slug => !slug.startsWith('pre-season'))
  )];
  if (slugs.length < 15) throw new Error('F1.com season page returned too few race links');
  return slugs;
}

async function fetchRaceFromF1Page(slug) {
  const html = await fetchHtml(`${F1_RACING_BASE_URL}/${slug}`);
  const event = extractJsonLd(html);
  const subEvents = Array.isArray(event?.subEvent) ? event.subEvent : [];
  const sessions = {};

  for (const subEvent of subEvents) {
    const key = keyFromF1EventName(subEvent?.name);
    const start = subEvent?.startDate ? new Date(subEvent.startDate) : null;
    if (!key || !start || Number.isNaN(start.getTime())) continue;
    sessions[key] = start.toISOString();
  }

  if (!sessions.race) return null;

  const location = event?.location || {};
  const raceName = raceNameFromSubEvents(subEvents) || cleanRaceName(event?.name || slug);

  return {
    round: 0,
    slug,
    name: raceName,
    hasSprint: Boolean(sessions.sprint || sessions.sprint_qualifying),
    date: sessions.race,
    circuit: location.name || null,
    country: location.address ? String(location.address).split(',').pop().trim() : null,
    city: location.name || null,
    track: null,
    sessions,
  };
}

async function buildCalendarFromF1Pages() {
  const slugs = await fetchSeasonSlugs();
  const races = [];

  for (const slug of slugs) {
    try {
      const race = await fetchRaceFromF1Page(slug);
      if (race) races.push(race);
    } catch (e) {
      console.warn(`[CAL] F1.com schedule unavailable for ${slug}:`, e.message);
    }
  }

  races.sort((a, b) => new Date(a.sessions.race) - new Date(b.sessions.race));
  races.forEach((race, index) => { race.round = index + 1; });
  const enriched = races.map(attachTrackMetadata);
  if (!isValidCalendar(enriched)) throw new Error('F1.com calendar did not produce a valid season calendar');
  _calendar = enriched;
  return races.length;
}

async function fetchIndex() {
  const response = await fetch(INDEX_URL, {
    headers: { 'user-agent': 'f1-live-api calendar refresh' },
  });
  if (!response.ok) throw new Error(`F1 static index HTTP ${response.status}`);
  return response.json();
}

async function saveCalendarCache() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify({ calendar: _calendar, last_refresh: _lastRefresh }, null, 2));
    await saveKV(CACHE_KEY, { calendar: _calendar, last_refresh: _lastRefresh });
  } catch (e) {
    console.warn('[CAL] Failed to save dynamic calendar cache:', e.message);
  }
}

async function loadCalendarCache() {
  try {
    const raw = await loadKV(CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (isValidCalendar(parsed.calendar)) {
        _calendar = cloneCalendar(parsed.calendar);
        _lastRefresh = parsed.last_refresh || null;
        console.log('[CAL] Loaded dynamic calendar cache from Turso');
        return true;
      }
    }
  } catch (e) {
    console.warn('[CAL] Failed to load dynamic calendar cache:', e.message);
  }

  try {
    if (!fs.existsSync(CACHE_FILE)) return false;
    const parsed = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    if (!isValidCalendar(parsed.calendar)) return false;
    _calendar = cloneCalendar(parsed.calendar);
    _lastRefresh = parsed.last_refresh || null;
    console.log('[CAL] Loaded dynamic calendar cache from disk');
    return true;
  } catch (e) {
    console.warn('[CAL] Failed to load disk calendar cache:', e.message);
    return false;
  }
}

async function init() {
  const loaded = await loadCalendarCache();
  try {
    await refresh();
  } catch (e) {
    console.warn('[CAL] Initial refresh failed:', e.message);
    if (!loaded) _calendar = [];
  }
  return getCalendar();
}

async function refresh() {
  const raceCount = await buildCalendarFromF1Pages();
  let indexUpdates = 0;
  try {
    const index = await fetchIndex();
    indexUpdates = mergeSessionsFromIndex(index);
  } catch (e) {
    console.warn('[CAL] F1 static index unavailable:', e.message);
  }
  _lastRefresh = new Date().toISOString();
  await saveCalendarCache();
  console.log(`[CAL] Refreshed calendar (${raceCount} F1.com races, ${indexUpdates} static index gap-fill update${indexUpdates === 1 ? '' : 's'})`);
  return getCalendar();
}

function applySessionInfo(sessionInfo) {
  const meeting = sessionInfo?.Meeting;
  const race = findCalendarRace(meeting);
  const key = sessionKey(sessionInfo);
  const iso = toOffsetIso(sessionInfo?.StartDate, sessionInfo?.GmtOffset);
  if (!race || !key || !iso) return false;

  if (!race.sessions) race.sessions = {};
  if (race.sessions[key] === iso) return false;
  race.sessions[key] = iso;
  if (key === 'race') race.date = iso;
  _lastRefresh = new Date().toISOString();
  saveCalendarCache();
  console.log(`[CAL] Updated ${race.name} ${key} from live SessionInfo`);
  return true;
}

function hookSessionInfo(state) {
  if (!state?.on) return;
  state.on('topic:SessionInfo', () => applySessionInfo(state.sessionInfo));
}

function getCalendar() {
  return cloneCalendar(_calendar);
}

function getLastRefresh() {
  return _lastRefresh;
}

module.exports = {
  init,
  refresh,
  hookSessionInfo,
  applySessionInfo,
  getCalendar,
  getLastRefresh,
};
