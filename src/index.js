require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const morgan  = require('morgan');

const f1client = require('./f1timing/client');
const apiRouter = require('./routes/api');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Start direct F1 live timing WebSocket ─────────────────────────────────────
f1client.start();

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/', apiRouter);

// ── Root ──────────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    name: 'F1 Live Timing API',
    description: 'Direct connection to F1 live timing feed — no third-party APIs',
    source: 'livetiming.formula1.com (SignalR WebSocket)',
    endpoints: {
      status:          'GET /status',
      drivers:         'GET /drivers',
      timing:          'GET /timing',
      timing_driver:   'GET /timing/:number',
      weather:         'GET /weather',
      track:           'GET /track',
      race_control:    'GET /race-control',
      car_telemetry:   'GET /car/:number',
      snapshot:        'GET /snapshot',
      stream_raw:      'GET /stream           (SSE — every raw update)',
      stream_filtered: 'GET /stream?topic=X   (SSE — one topic)',
      stream_timing:   'GET /stream/timing    (SSE — full leaderboard)',
    },
  });
});

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `${req.method} ${req.path} not found` });
});

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`F1 Live Timing API running on http://localhost:${PORT}`);
});

module.exports = app;
