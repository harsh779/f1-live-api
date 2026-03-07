const { Router } = require('express');
const { calendar2026 } = require('../data/calendar');

const router = Router();

/** GET /calendar — full 2026 season calendar */
router.get('/', (req, res) => {
  res.json(calendar2026);
});

/** GET /calendar/next — next upcoming session */
router.get('/next', (req, res) => {
  const now = new Date();

  for (const race of calendar2026) {
    const sessions = race.sessions;
    const sessionOrder = race.hasSprint
      ? ['fp1', 'sprint_qualifying', 'sprint', 'qualifying', 'race']
      : ['fp1', 'fp2', 'fp3', 'qualifying', 'race'];

    for (const key of sessionOrder) {
      if (!sessions[key]) continue;
      const sessionTime = new Date(sessions[key]);
      if (sessionTime > now) {
        return res.json({
          round:        race.round,
          meeting:      race.name,
          circuit:      race.circuit,
          country:      race.country,
          city:         race.city,
          session:      key,
          session_time: sessions[key],
          minutes_away: Math.round((sessionTime - now) / 60000),
          has_sprint:   race.hasSprint,
          track:        race.track,
          all_sessions: sessions,
        });
      }
    }
  }

  res.json({ message: 'Season complete' });
});

/** GET /calendar/current — the current race weekend (if ongoing) */
router.get('/current', (req, res) => {
  const now = new Date();

  const current = calendar2026.find(race => {
    const firstSession = new Date(race.sessions.fp1 || race.sessions.sprint_qualifying);
    const lastSession  = new Date(race.sessions.race);
    lastSession.setHours(lastSession.getHours() + 4); // buffer after race ends
    return now >= firstSession && now <= lastSession;
  });

  if (!current) {
    return res.json({ active: false, message: 'No race weekend currently active' });
  }

  res.json({ active: true, ...current });
});

/** GET /calendar/:round — specific round */
router.get('/:round', (req, res) => {
  const round = parseInt(req.params.round);
  const race  = calendar2026.find(r => r.round === round);
  if (!race) return res.status(404).json({ error: `Round ${round} not found` });
  res.json(race);
});

module.exports = router;
