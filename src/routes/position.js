const { Router } = require('express');
const { fetch, getLatestSessionKey } = require('../services/openf1');

const router = Router();

/**
 * GET /position
 * Returns the race/track position of each driver over time.
 *
 * Query: session_key, meeting_key, driver_number, date, position
 */
router.get('/', async (req, res, next) => {
  try {
    const data = await fetch('/position', req.query);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /position/latest  - current standings in the live session
 */
router.get('/latest', async (req, res, next) => {
  try {
    const sessionKey = await getLatestSessionKey();
    const params = { session_key: sessionKey, ...req.query };
    const data = await fetch('/position', params);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /position/driver/:driver_number
 */
router.get('/driver/:driver_number', async (req, res, next) => {
  try {
    const params = { driver_number: req.params.driver_number, ...req.query };
    const data = await fetch('/position', params);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
