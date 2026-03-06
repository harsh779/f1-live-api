const axios = require('axios');
const NodeCache = require('node-cache');

const liveCache = new NodeCache({ stdTTL: parseInt(process.env.CACHE_TTL_SECONDS) || 5 });
const staticCache = new NodeCache({ stdTTL: parseInt(process.env.CACHE_TTL_STATIC_SECONDS) || 300 });

const BASE_URL = process.env.OPENF1_BASE_URL || 'https://api.openf1.org/v1';

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Accept': 'application/json' },
});

/**
 * Build query string from a params object, filtering out undefined/null values.
 */
function buildQuery(params = {}) {
  return Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

/**
 * Fetch data from OpenF1 with optional caching.
 * @param {string} endpoint - e.g. '/car_data'
 * @param {object} params   - query parameters
 * @param {boolean} isStatic - use longer TTL cache for mostly-static data
 */
async function fetch(endpoint, params = {}, isStatic = false) {
  const qs = buildQuery(params);
  const url = qs ? `${endpoint}?${qs}` : endpoint;
  const cache = isStatic ? staticCache : liveCache;

  const cached = cache.get(url);
  if (cached !== undefined) return cached;

  const response = await client.get(url);
  cache.set(url, response.data);
  return response.data;
}

/**
 * Resolve "latest" session_key by hitting /sessions with session_key=latest.
 */
async function getLatestSessionKey() {
  const data = await fetch('/sessions', { session_key: 'latest' });
  if (!data || data.length === 0) throw new Error('No active session found');
  return data[0].session_key;
}

/**
 * Resolve "latest" meeting_key.
 */
async function getLatestMeetingKey() {
  const data = await fetch('/meetings', { meeting_key: 'latest' });
  if (!data || data.length === 0) throw new Error('No active meeting found');
  return data[0].meeting_key;
}

module.exports = { fetch, getLatestSessionKey, getLatestMeetingKey, buildQuery };
