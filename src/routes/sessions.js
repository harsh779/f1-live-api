const { Router } = require('express');
const { fetch } = require('../services/openf1');

const router = Router();

/**
 * GET /sessions
 * Query: meeting_key, session_key, session_type, session_name,
 *        circuit_key, circuit_short_name, country_code, country_key,
 *        country_name, location, year, date_start, date_end
 */
router.get('/', async (req, res, next) => {
  try {
    const data = await fetch('/sessions', req.query, true);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /sessions/latest
 */
router.get('/latest', async (req, res, next) => {
  try {
    const data = await fetch('/sessions', { session_key: 'latest' });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
