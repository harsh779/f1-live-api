const { Router } = require('express');
const { fetch, getLatestSessionKey } = require('../services/openf1');

const router = Router();

/**
 * GET /pit
 * Returns pit stop events: lap_number, pit_duration, date.
 *
 * Query: session_key, meeting_key, driver_number, lap_number,
 *        pit_duration, date
 */
router.get('/', async (req, res, next) => {
  try {
    const data = await fetch('/pit', req.query);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /pit/latest
 */
router.get('/latest', async (req, res, next) => {
  try {
    const sessionKey = await getLatestSessionKey();
    const params = { session_key: sessionKey, ...req.query };
    const data = await fetch('/pit', params);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /pit/driver/:driver_number
 */
router.get('/driver/:driver_number', async (req, res, next) => {
  try {
    const params = { driver_number: req.params.driver_number, ...req.query };
    const data = await fetch('/pit', params);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
