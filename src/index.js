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
const pitsRouter      = require('./routes/pits');
const teamRadioRouter = require('./routes/teamRadio');
const historyRouter   = require('./routes/history');

const { globalLimiter, sseLimiter } = require('./middleware/rateLimiter');
const apiKeyAuth                    = require('./middleware/apiKey');
const csvFormat                     = require('./middleware/csvFormat');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Start direct F1 live timing WebSocket ─────────────────────────────────────
f1client.start();

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(globalLimiter);
app.use(apiKeyAuth);
app.use(csvFormat);

// ── Root ──────────────────────────────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.json({
    name: 'F1 Live Timing API',
    version: '3.0.0',
    description: 'Direct connection to F1 live timing feed — no third-party APIs',
    source: 'livetiming.formula1.com (SignalR WebSocket)',
    features: {
      live_streaming:  'SSE at ~3.7Hz, real-time push from SignalR WebSocket',
      mini_sectors:    'Segment-level timing in /timing — colored blocks like F1 TV',
      team_radio:      'Audio URLs for team radio messages at /team-radio',
      historical_data: 'Full F1 archive access at /history (all seasons)',
      csv_export:      'Add ?format=csv to any endpoint for CSV output',
      rate_limiting:   '100 req/min per IP (RateLimit-* headers)',
      authentication:  'API key via x-api-key header or ?api_key= (optional when unconfigured)',
    },
    endpoints: {
      status:            'GET /status',
      drivers:           'GET /drivers',
      timing:            'GET /timing',
      timing_driver:     'GET /timing/:number',
      weather:           'GET /weather',
      track:             'GET /track',
      race_control:      'GET /race-control',
      car_telemetry:     'GET /car/:number',
      pits:              'GET /pits',
      pits_driver:       'GET /pits/:number',
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
      team_radio:        'GET /team-radio',
      team_radio_driver: 'GET /team-radio/:number',
      history:           'GET /history',
      history_year:      'GET /history/:year',
      history_session:   'GET /history/session?path=...&topic=TimingData',
      docs:              'GET /docs',
    },
  });
});

// ── Documentation ────────────────────────────────────────────────────────────
app.get('/docs', (_req, res) => {
  res.json({
    title: 'F1 Live Timing API Documentation',
    version: '3.0.0',
    base_url: `${_req.protocol}://${_req.get('host')}`,
    authentication: {
      description: 'API key authentication (optional when no keys configured)',
      methods: [
        'Header: x-api-key: YOUR_KEY',
        'Query: ?api_key=YOUR_KEY',
      ],
    },
    rate_limits: {
      global: '100 requests per minute per IP',
      sse_streams: '10 stream connections per minute per IP',
      headers: ['RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset'],
    },
    formats: {
      json: 'Default. All endpoints return JSON.',
      csv:  'Add ?format=csv to any endpoint. Returns CSV with flattened columns.',
    },
    endpoints: [
      { method: 'GET', path: '/status',         description: 'Connection state, session info, clock, track flags' },
      { method: 'GET', path: '/drivers',         description: 'List all drivers in current session' },
      { method: 'GET', path: '/timing',          description: 'Full leaderboard — positions, gaps, sectors, tyres, telemetry' },
      { method: 'GET', path: '/timing/:number',  description: 'Single driver timing data' },
      { method: 'GET', path: '/weather',         description: 'Current weather conditions' },
      { method: 'GET', path: '/track',           description: 'Track status and session state' },
      { method: 'GET', path: '/race-control',    description: 'Race director messages (newest first)' },
      { method: 'GET', path: '/car/:number',     description: 'Telemetry for one driver (RPM, speed, gear, throttle, brake, DRS)' },
      { method: 'GET', path: '/pits',            description: 'Pit stop data — all drivers, stint history, current tyre' },
      { method: 'GET', path: '/pits/:number',    description: 'Pit stops for a single driver' },
      { method: 'GET', path: '/snapshot',        description: 'Raw dump of all 16 F1 timing topics' },
      { method: 'GET', path: '/stream',          description: 'SSE — every raw topic update. Filter: ?topic=TimingData' },
      { method: 'GET', path: '/stream/timing',   description: 'SSE — full leaderboard on each timing change' },
      { method: 'GET', path: '/calendar',        description: 'Full 2026 season calendar' },
      { method: 'GET', path: '/calendar/next',   description: 'Next upcoming session with countdown' },
      { method: 'GET', path: '/calendar/current', description: 'Current race weekend (if active)' },
      { method: 'GET', path: '/calendar/:round', description: 'Specific round details' },
      { method: 'GET', path: '/results',         description: 'List all saved session results' },
      { method: 'GET', path: '/results/:filename', description: 'Single saved result by filename' },
      { method: 'GET', path: '/results/round/:round', description: 'All results for a round' },
      { method: 'GET', path: '/standings/drivers', description: 'Driver championship standings' },
      { method: 'GET', path: '/standings/constructors', description: 'Constructor championship standings' },
      { method: 'GET', path: '/telemetry',        description: 'Latest telemetry for all drivers' },
      { method: 'GET', path: '/telemetry/:number', description: 'Latest telemetry for one driver' },
      { method: 'GET', path: '/telemetry/stream/all', description: 'SSE — all drivers telemetry at ~3.7Hz' },
      { method: 'GET', path: '/telemetry/stream/:number', description: 'SSE — single driver telemetry at ~3.7Hz' },
      { method: 'GET', path: '/team-radio',          description: 'All team radio messages with audio URLs (newest first)' },
      { method: 'GET', path: '/team-radio/:number',  description: 'Team radio for a single driver' },
      { method: 'GET', path: '/history',             description: 'List available seasons from F1 archive' },
      { method: 'GET', path: '/history/:year',       description: 'List meetings and sessions for a season' },
      { method: 'GET', path: '/history/session', description: 'Archived session data. Query: ?path=...&topic=TimingData' },
    ],
  });
});

// ── SSE rate limit on stream endpoints ────────────────────────────────────────
app.use('/stream',           sseLimiter);
app.use('/telemetry/stream', sseLimiter);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/',          apiRouter);
app.use('/pits',      pitsRouter);
app.use('/calendar',  calendarRouter);
app.use('/results',   resultsRouter);
app.use('/standings', standingsRouter);
app.use('/telemetry',   telemetryRouter);
app.use('/team-radio',  teamRadioRouter);
app.use('/history',     historyRouter);

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
