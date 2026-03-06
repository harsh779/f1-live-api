const { Router } = require('express');
const { fetch } = require('../services/openf1');

const router = Router();

/**
 * GET /meetings
 * Query: meeting_key, meeting_name, meeting_official_name,
 *        circuit_key, circuit_short_name, country_code, country_key,
 *        country_name, location, year, date_start, gmt_offset
 */
router.get('/', async (req, res, next) => {
  try {
    const data = await fetch('/meetings', req.query, true);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /meetings/latest
 */
router.get('/latest', async (req, res, next) => {
  try {
    const data = await fetch('/meetings', { meeting_key: 'latest' });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
