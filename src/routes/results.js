const { Router } = require('express');
const { listResults, loadResult } = require('../f1timing/persistence');

const router = Router();

const FILENAME_RE = /^\d{4}_R\d{2}_\w+\.json$/;

/** GET /results — list all saved sessions */
router.get('/', (req, res) => {
  const files = listResults();
  const sessions = files.map(filename => {
    const result = loadResult(filename);
    return {
      filename,
      round:        result?.meta?.round        || null,
      meeting:      result?.meta?.meeting      || null,
      session_name: result?.meta?.session_name || null,
      session_type: result?.meta?.session_type || null,
      date:         result?.meta?.date         || null,
      circuit:      result?.meta?.circuit      || null,
    };
  });
  res.json(sessions);
});

/** GET /results/round/:round — all sessions for a specific round number */
router.get('/round/:round', (req, res) => {
  const round = String(req.params.round).padStart(2, '0');
  const files = listResults().filter(f => f.includes(`_R${round}_`));
  if (files.length === 0) return res.status(404).json({ error: `No results for round ${req.params.round}` });
  res.json(files.map(f => loadResult(f)).filter(Boolean));
});

/** GET /results/:filename — single saved session result */
router.get('/:filename', (req, res) => {
  const { filename } = req.params;
  if (!FILENAME_RE.test(filename)) {
    return res.status(400).json({ error: 'Invalid filename' });
  }
  const result = loadResult(filename);
  if (!result) return res.status(404).json({ error: 'Result not found' });
  res.json(result);
});

module.exports = router;
