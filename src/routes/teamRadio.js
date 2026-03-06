const { Router } = require('express');
const { fetch, getLatestSessionKey } = require('../services/openf1');

const router = Router();

/**
 * GET /team-radio
 * Returns team radio recordings with a URL to the audio clip.
 *
 * Query: session_key, meeting_key, driver_number, date, recording_url
 */
router.get('/', async (req, res, next) => {
  try {
    const data = await fetch('/team_radio', req.query);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /team-radio/latest
 */
router.get('/latest', async (req, res, next) => {
  try {
    const sessionKey = await getLatestSessionKey();
    const params = { session_key: sessionKey, ...req.query };
    const data = await fetch('/team_radio', params);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /team-radio/driver/:driver_number
 */
router.get('/driver/:driver_number', async (req, res, next) => {
  try {
    const params = { driver_number: req.params.driver_number, ...req.query };
    const data = await fetch('/team_radio', params);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
