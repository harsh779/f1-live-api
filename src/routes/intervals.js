const { Router } = require('express');
const { fetch, getLatestSessionKey } = require('../services/openf1');

const router = Router();

/**
 * GET /intervals
 * Returns gap-to-leader and gap-to-car-ahead for each driver.
 *
 * Query: session_key, meeting_key, driver_number, date,
 *        gap_to_leader, interval
 */
router.get('/', async (req, res, next) => {
  try {
    const data = await fetch('/intervals', req.query);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /intervals/latest
 */
router.get('/latest', async (req, res, next) => {
  try {
    const sessionKey = await getLatestSessionKey();
    const params = { session_key: sessionKey, ...req.query };
    const data = await fetch('/intervals', params);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /intervals/driver/:driver_number
 */
router.get('/driver/:driver_number', async (req, res, next) => {
  try {
    const params = { driver_number: req.params.driver_number, ...req.query };
    const data = await fetch('/intervals', params);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
