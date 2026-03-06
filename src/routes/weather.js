const { Router } = require('express');
const { fetch, getLatestSessionKey } = require('../services/openf1');

const router = Router();

/**
 * GET /weather
 * Returns atmospheric data sampled every ~10 seconds:
 * air_temperature, humidity, pressure, rainfall, track_temperature,
 * wind_direction, wind_speed.
 *
 * Query: session_key, meeting_key, date,
 *        air_temperature, humidity, pressure, rainfall,
 *        track_temperature, wind_direction, wind_speed
 */
router.get('/', async (req, res, next) => {
  try {
    const data = await fetch('/weather', req.query);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /weather/latest  - most recent weather reading for the live session
 */
router.get('/latest', async (req, res, next) => {
  try {
    const sessionKey = await getLatestSessionKey();
    const params = { session_key: sessionKey };
    const data = await fetch('/weather', params);
    // Return only the most recent entry
    const latest = data && data.length > 0 ? data[data.length - 1] : null;
    if (!latest) return res.status(404).json({ error: 'No weather data available' });
    res.json(latest);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
