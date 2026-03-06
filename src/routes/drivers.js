const { Router } = require('express');
const { fetch, getLatestSessionKey } = require('../services/openf1');

const router = Router();

/**
 * GET /drivers
 * Query: session_key, meeting_key, driver_number, broadcast_name,
 *        full_name, name_acronym, team_name, team_colour,
 *        first_name, last_name, headshot_url, country_code
 */
router.get('/', async (req, res, next) => {
  try {
    const data = await fetch('/drivers', req.query, true);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /drivers/latest  - drivers in the current live session
 */
router.get('/latest', async (req, res, next) => {
  try {
    const sessionKey = await getLatestSessionKey();
    const data = await fetch('/drivers', { session_key: sessionKey }, true);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /drivers/:driver_number
 * Query: session_key, meeting_key
 */
router.get('/:driver_number', async (req, res, next) => {
  try {
    const params = { ...req.query, driver_number: req.params.driver_number };
    const data = await fetch('/drivers', params, true);
    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Driver not found' });
    }
    res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
