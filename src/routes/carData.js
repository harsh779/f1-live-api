const { Router } = require('express');
const { fetch, getLatestSessionKey } = require('../services/openf1');

const router = Router();

/**
 * GET /car-data
 * Returns real-time car telemetry: speed, throttle, brake, gear, RPM, DRS.
 *
 * Query params:
 *   session_key, meeting_key, driver_number,
 *   date (ISO), speed, throttle, brake, drs, n_gear, rpm
 *
 * Filtering with comparison operators supported by OpenF1:
 *   speed>=200, throttle>=90, brake=1, drs>=8
 */
router.get('/', async (req, res, next) => {
  try {
    const data = await fetch('/car_data', req.query);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /car-data/latest  - latest telemetry snapshot for the live session
 * Query: driver_number (optional)
 */
router.get('/latest', async (req, res, next) => {
  try {
    const sessionKey = await getLatestSessionKey();
    const params = { session_key: sessionKey, ...req.query };
    const data = await fetch('/car_data', params);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /car-data/driver/:driver_number
 * Query: session_key, meeting_key, date
 */
router.get('/driver/:driver_number', async (req, res, next) => {
  try {
    const params = { driver_number: req.params.driver_number, ...req.query };
    const data = await fetch('/car_data', params);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
