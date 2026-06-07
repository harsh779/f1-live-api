const { Router } = require('express');
const state = require('../f1timing/state');

const router = Router();

const AUDIO_BASE = 'https://livetiming.formula1.com/static/';

function buildRadioMessages() {
  const captures = state.teamRadio?.Captures || [];
  const drivers  = state.driverList || {};
  const arr = Array.isArray(captures) ? captures : Object.values(captures);

  return arr.map(cap => {
    const num = cap.RacingNumber || null;
    const d   = num ? (drivers[num] || {}) : {};
    return {
      driver_number: num,
      name:          d.FullName  || null,
      acronym:       d.Tla       || null,
      team:          d.TeamName  || null,
      timestamp:     cap.Utc     || null,
      // cap.Path is relative to the session's static folder (e.g. "TeamRadio/BEA_87_..mp3"),
      // NOT the static root — must prefix with sessionInfo.Path
      // ("2026/2026-06-07_Monaco_Grand_Prix/2026-06-07_Race/") or the file 403s.
      audio_url:     cap.Path ? `${AUDIO_BASE}${state.sessionInfo?.Path || ''}${cap.Path}` : null,
    };
  }).sort((a, b) => {
    if (!a.timestamp || !b.timestamp) return 0;
    return new Date(b.timestamp) - new Date(a.timestamp);
  });
}

/** GET /team-radio — all team radio messages, newest first */
router.get('/', (req, res) => {
  const messages = buildRadioMessages();
  res.json({
    timestamp: new Date().toISOString(),
    session:   state.sessionInfo?.Name || null,
    total:     messages.length,
    messages,
  });
});

/** GET /team-radio/:number — team radio for a single driver */
router.get('/:number', (req, res) => {
  const messages = buildRadioMessages().filter(
    m => m.driver_number == req.params.number,
  );
  if (messages.length === 0) {
    return res.status(404).json({ error: 'No team radio found for this driver' });
  }
  res.json({
    driver_number: req.params.number,
    total:         messages.length,
    messages,
  });
});

module.exports = router;
