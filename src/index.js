require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const morgan  = require('morgan');

const errorHandler = require('./middleware/errorHandler');

const sessionsRouter    = require('./routes/sessions');
const meetingsRouter    = require('./routes/meetings');
const driversRouter     = require('./routes/drivers');
const carDataRouter     = require('./routes/carData');
const positionRouter    = require('./routes/position');
const intervalsRouter   = require('./routes/intervals');
const lapsRouter        = require('./routes/laps');
const stintsRouter      = require('./routes/stints');
const pitRouter         = require('./routes/pit');
const locationRouter    = require('./routes/location');
const weatherRouter     = require('./routes/weather');
const raceControlRouter = require('./routes/raceControl');
const teamRadioRouter   = require('./routes/teamRadio');
const liveRouter        = require('./routes/live');
const timingRouter      = require('./routes/timing');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ─────────────────────────────────────────────────────────────
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// ── Routes ─────────────────────────────────────────────────────────────────
app.use('/sessions',     sessionsRouter);
app.use('/meetings',     meetingsRouter);
app.use('/drivers',      driversRouter);
app.use('/car-data',     carDataRouter);
app.use('/position',     positionRouter);
app.use('/intervals',    intervalsRouter);
app.use('/laps',         lapsRouter);
app.use('/stints',       stintsRouter);
app.use('/pit',          pitRouter);
app.use('/location',     locationRouter);
app.use('/weather',      weatherRouter);
app.use('/race-control', raceControlRouter);
app.use('/team-radio',   teamRadioRouter);
app.use('/live',         liveRouter);
app.use('/timing',       timingRouter);

// ── Root ───────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    name: 'F1 Live Data API',
    description: 'Proxies and aggregates OpenF1 real-time Formula 1 data',
    upstream: 'https://openf1.org',
    endpoints: {
      sessions:     '/sessions',
      meetings:     '/meetings',
      drivers:      '/drivers',
      car_data:     '/car-data',
      position:     '/position',
      intervals:    '/intervals',
      laps:         '/laps',
      stints:       '/stints',
      pit_stops:    '/pit',
      location:     '/location',
      weather:      '/weather',
      race_control: '/race-control',
      team_radio:   '/team-radio',
      live_snapshot: '/live/snapshot',
      live_stream:   '/live/stream  (SSE)',
      timing_sheet:  '/timing/latest',
      timing_stream: '/timing/stream  (SSE)',
    },
    tips: {
      latest:  'Append /latest to most routes for the current live session',
      filter:  'Pass any field as a query parameter to filter results',
      compare: 'OpenF1 supports comparison operators, e.g. ?speed>=300',
    },
  });
});

// ── 404 ───────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ── Error handler ─────────────────────────────────────────────────────────
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`F1 Live Data API running on http://localhost:${PORT}`);
  console.log(`Upstream: ${process.env.OPENF1_BASE_URL}`);
});

module.exports = app;
