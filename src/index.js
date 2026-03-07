require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const morgan     = require('morgan');

const f1client        = require('./f1timing/client');
const apiRouter       = require('./routes/api');
const calendarRouter  = require('./routes/calendar');
const resultsRouter   = require('./routes/results');
const standingsRouter = require('./routes/standings');
const telemetryRouter = require('./routes/telemetry');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Start direct F1 live timing WebSocket ─────────────────────────────────────
f1client.start();

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// ── Root ──────────────────────────────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.json({
    name: 'F1 Live Timing API',
    description: 'Direct connection to F1 live timing feed — no third-party APIs',
    source: 'livetiming.formula1.com (SignalR WebSocket)',
    endpoints: {
      status:            'GET /status',
      drivers:           'GET /drivers',
      timing:            'GET /timing',
      timing_driver:     'GET /timing/:number',
      weather:           'GET /weather',
      track:             'GET /track',
      race_control:      'GET /race-control',
      car_telemetry:     'GET /car/:number',
      snapshot:          'GET /snapshot',
      stream_raw:        'GET /stream              (SSE)',
      stream_filtered:   'GET /stream?topic=X      (SSE)',
      stream_timing:     'GET /stream/timing       (SSE)',
      calendar:          'GET /calendar',
      calendar_next:     'GET /calendar/next',
      calendar_current:  'GET /calendar/current',
      calendar_round:    'GET /calendar/:round',
      results:           'GET /results',
      result_file:       'GET /results/:filename',
      result_round:      'GET /results/round/:round',
      standings_drivers: 'GET /standings/drivers',
      standings_ctors:   'GET /standings/constructors',
      telemetry_all:     'GET /telemetry',
      telemetry_driver:  'GET /telemetry/:number',
      telemetry_stream:  'GET /telemetry/stream/all   (SSE ~3.7Hz)',
      telemetry_stream1: 'GET /telemetry/stream/:number (SSE ~3.7Hz)',
    },
  });
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/',          apiRouter);
app.use('/calendar',  calendarRouter);
app.use('/results',   resultsRouter);
app.use('/standings', standingsRouter);
app.use('/telemetry', telemetryRouter);

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `${req.method} ${req.path} not found` });
});

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`F1 Live Timing API running on http://localhost:${PORT}`);
});

module.exports = app;
