const { Router } = require('express');
const { fetch, getLatestSessionKey } = require('../services/openf1');

const router = Router();

/**
 * GET /stints
 * Returns tire stint data: compound, lap_start, lap_end, stint_number,
 *                          tyre_age_at_start.
 *
 * Query: session_key, meeting_key, driver_number, stint_number,
 *        lap_start, lap_end, compound, tyre_age_at_start
 */
router.get('/', async (req, res, next) => {
  try {
    const data = await fetch('/stints', req.query);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /stints/latest
 */
router.get('/latest', async (req, res, next) => {
  try {
    const sessionKey = await getLatestSessionKey();
    const params = { session_key: sessionKey, ...req.query };
    const data = await fetch('/stints', params);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /stints/driver/:driver_number
 */
router.get('/driver/:driver_number', async (req, res, next) => {
  try {
    const params = { driver_number: req.params.driver_number, ...req.query };
    const data = await fetch('/stints', params);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
