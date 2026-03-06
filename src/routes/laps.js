const { Router } = require('express');
const { fetch, getLatestSessionKey } = require('../services/openf1');

const router = Router();

/**
 * GET /laps
 * Returns lap-by-lap data: lap time, sector times, speed traps, pit in/out.
 *
 * Query: session_key, meeting_key, driver_number, lap_number,
 *        lap_duration, duration_sector_1, duration_sector_2, duration_sector_3,
 *        i1_speed, i2_speed, st_speed, is_pit_out_lap,
 *        segments_sector_1, segments_sector_2, segments_sector_3,
 *        date_start
 */
router.get('/', async (req, res, next) => {
  try {
    const data = await fetch('/laps', req.query);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /laps/latest  - laps recorded in the current live session
 */
router.get('/latest', async (req, res, next) => {
  try {
    const sessionKey = await getLatestSessionKey();
    const params = { session_key: sessionKey, ...req.query };
    const data = await fetch('/laps', params);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /laps/driver/:driver_number
 * Query: session_key, lap_number
 */
router.get('/driver/:driver_number', async (req, res, next) => {
  try {
    const params = { driver_number: req.params.driver_number, ...req.query };
    const data = await fetch('/laps', params);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /laps/driver/:driver_number/lap/:lap_number
 */
router.get('/driver/:driver_number/lap/:lap_number', async (req, res, next) => {
  try {
    const params = {
      driver_number: req.params.driver_number,
      lap_number: req.params.lap_number,
      ...req.query,
    };
    const data = await fetch('/laps', params);
    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Lap not found' });
    }
    res.json(data[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
