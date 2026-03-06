const { Router } = require('express');
const { fetch, getLatestSessionKey } = require('../services/openf1');

const router = Router();

/**
 * GET /location
 * Returns car x/y/z track coordinates (sampled at ~3.7 Hz).
 *
 * Query: session_key, meeting_key, driver_number, date, x, y, z
 */
router.get('/', async (req, res, next) => {
  try {
    const data = await fetch('/location', req.query);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /location/latest  - current positions of all cars
 */
router.get('/latest', async (req, res, next) => {
  try {
    const sessionKey = await getLatestSessionKey();
    const params = { session_key: sessionKey, ...req.query };
    const data = await fetch('/location', params);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /location/driver/:driver_number
 */
router.get('/driver/:driver_number', async (req, res, next) => {
  try {
    const params = { driver_number: req.params.driver_number, ...req.query };
    const data = await fetch('/location', params);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
