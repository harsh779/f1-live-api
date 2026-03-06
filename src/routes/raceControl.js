const { Router } = require('express');
const { fetch, getLatestSessionKey } = require('../services/openf1');

const router = Router();

/**
 * GET /race-control
 * Returns race director messages: flags, safety car, virtual safety car,
 * DRS enabled/disabled, sector flags, penalties, etc.
 *
 * Query: session_key, meeting_key, driver_number, date,
 *        category, flag, lap_number, message, scope, sector
 */
router.get('/', async (req, res, next) => {
  try {
    const data = await fetch('/race_control', req.query);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /race-control/latest  - race control messages for the live session
 */
router.get('/latest', async (req, res, next) => {
  try {
    const sessionKey = await getLatestSessionKey();
    const params = { session_key: sessionKey, ...req.query };
    const data = await fetch('/race_control', params);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /race-control/flags  - filter only flag-related messages
 * Query: session_key, flag (GREEN, YELLOW, RED, CHEQUERED, BLUE, etc.)
 */
router.get('/flags', async (req, res, next) => {
  try {
    const params = { category: 'Flag', ...req.query };
    const data = await fetch('/race_control', params);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /race-control/safety-car  - safety car / VSC deployments
 */
router.get('/safety-car', async (req, res, next) => {
  try {
    const params = { category: 'SafetyCar', ...req.query };
    const data = await fetch('/race_control', params);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
