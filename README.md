# F1 Insights API

A self-sufficient Formula 1 live data API that connects **directly** to F1's own live timing infrastructure — no third-party data providers, no OpenF1, no Ergast. Every data point originates from the same feed that powers the official F1 app.

**Live instance:** `https://f1-live-api.onrender.com`

---

## How It Works

The API connects to F1's SignalR WebSocket at `livetiming.formula1.com`, subscribes to 16 live topics (including TeamRadio), and deep-merges the differential patches into a running in-memory state. Compressed topics (`CarData.z`, `Position.z`) are decompressed on receipt using zlib. State is persisted to disk every 30 seconds and restored on restart. Session results are saved automatically when the feed signals `Finalised`.

---

## Features

| Feature | Details |
|---------|---------|
| Live streaming | SSE at ~3.7 Hz, real-time push from SignalR WebSocket |
| Mini-sectors | Segment-level timing data — the colored blocks you see on F1 TV |
| Team radio | Audio file URLs for team radio messages during live sessions |
| Historical data | Full F1 archive access — every session back to 2018 |
| CSV export | Append `?format=csv` to any endpoint for CSV output |
| Rate limiting | 100 req/min per IP, 10 SSE connections/min (RateLimit-* headers) |
| Authentication | Optional API key via `x-api-key` header or `?api_key=` query param |
| Auto-documentation | `GET /docs` returns full machine-readable endpoint reference |

---

## Quick Start

### Running Locally

**Prerequisites:** Node.js 18+

```bash
git clone https://github.com/harsh779/f1-live-api.git
cd f1-live-api
npm install
npm start
```

The API starts on `http://localhost:3000`. Set a custom port with the `PORT` environment variable:

```bash
PORT=8080 npm start
```

### Development Mode (auto-restart on file changes)

```bash
npm run dev
```

During an active F1 session the WebSocket connects automatically. Outside of sessions most endpoints return data from the last persisted state.

---

## Authentication

Authentication is **optional** — disabled by default when no keys are configured.

To enable it, set the `API_KEYS` environment variable with one or more comma-separated keys:

```bash
API_KEYS=key1,key2,key3 npm start
```

Pass your key with every request using either method:

```bash
# Header
curl -H "x-api-key: YOUR_KEY" https://f1-live-api.onrender.com/timing

# Query parameter
curl https://f1-live-api.onrender.com/timing?api_key=YOUR_KEY
```

| Status | Meaning |
|--------|---------|
| 401 | API key required but not provided |
| 403 | Invalid API key |

---

## Rate Limiting

All responses include standard rate limit headers:

| Header | Description |
|--------|-------------|
| `RateLimit-Limit` | Max requests allowed in window (100) |
| `RateLimit-Remaining` | Requests remaining in current window |
| `RateLimit-Reset` | Seconds until window resets |

| Limit | Scope |
|-------|-------|
| 100 req/min | All endpoints (per IP) |
| 10 connections/min | SSE stream endpoints (per IP) |

---

## CSV Export

Append `?format=csv` to any endpoint to get CSV output instead of JSON:

```bash
curl https://f1-live-api.onrender.com/timing?format=csv
curl https://f1-live-api.onrender.com/calendar?format=csv
curl https://f1-live-api.onrender.com/standings/drivers?format=csv
```

- Nested objects are flattened with `_` separators (e.g. `telemetry_speed`)
- Arrays are JSON-stringified in cells
- Response includes `Content-Type: text/csv` and `Content-Disposition: attachment` headers

---

## Endpoints

### Live Timing

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/status` | Connection status, session info, lap count, clock, track flags |
| GET | `/drivers` | All drivers — name, acronym, team, team colour, headshot URL |
| GET | `/timing` | Full leaderboard — positions, gaps, sectors, mini-sectors, tyres, telemetry |
| GET | `/timing/:number` | Single driver timing data |
| GET | `/weather` | Air temp, track temp, humidity, wind speed, rainfall |
| GET | `/track` | Track status and current flag |
| GET | `/race-control` | Race control messages — penalties, flags, notifications (newest first) |
| GET | `/car/:number` | Raw telemetry for one car (RPM, speed, gear, throttle, brake, DRS) |
| GET | `/snapshot` | Full raw dump of all 16 in-memory timing topics |

### Pit Stops

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/pits` | All drivers' pit stop data — stint history, current tyre, in/out flags |
| GET | `/pits/:number` | Pit stops for a single driver |

Each driver includes:
- `total_stops` — number of pit stops made
- `pit_stops[]` — each stop with `stop_number`, `lap`, `compound`, `new_tyre`, `tyre_life`
- `current_stint` — compound, laps, whether the tyre is new
- `in_pit` / `pit_out` — real-time pit lane flags

### Team Radio

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/team-radio` | All team radio messages with audio URLs (newest first) |
| GET | `/team-radio/:number` | Team radio for a single driver |

Each message includes:
- `driver_number`, `name`, `acronym`, `team`
- `timestamp` — UTC time of the radio message
- `audio_url` — direct URL to the MP3 audio file on F1's CDN

> Team radio messages are captured live during sessions. No messages will appear outside of active sessions.

### Telemetry

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/telemetry` | Latest telemetry snapshot for all drivers |
| GET | `/telemetry/:number` | Latest telemetry for one driver |
| GET | `/telemetry/stream/all` | SSE — all 22 cars at ~3.7 Hz |
| GET | `/telemetry/stream/:number` | SSE — single driver telemetry at ~3.7 Hz |

**Telemetry fields:** `rpm`, `speed`, `gear`, `throttle` (0-100), `brake` (0/1), `drs`, `drs_label`

DRS label values: `off` / `eligible` / `on` / `active`

### SSE Streams

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/stream` | Every raw feed update as SSE |
| GET | `/stream?topic=CarData` | Filtered to a single topic |
| GET | `/stream/timing` | Full leaderboard pushed on every timing change |

All SSE endpoints send an initial `snapshot` event on connect, then push live `data` events.

### Calendar

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/calendar` | Full 2026 season — all 24 rounds |
| GET | `/calendar/next` | Next upcoming session with minute countdown |
| GET | `/calendar/current` | Active race weekend (if any) |
| GET | `/calendar/:round` | Details for a specific round number |

### Results & Standings

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/results` | List all saved session results |
| GET | `/results/:filename` | Full result for a saved session |
| GET | `/results/round/:round` | All sessions for a given round number |
| GET | `/standings/drivers` | Driver championship standings |
| GET | `/standings/constructors` | Constructor championship standings |

Results are saved automatically when a session is finalised. Filenames follow the pattern `2026_R01_Race.json`.

Standings use the 2026 points system:
- **Race:** 25 / 18 / 15 / 12 / 10 / 8 / 6 / 4 / 2 / 1
- **Sprint:** 8 / 7 / 6 / 5 / 4 / 3 / 2 / 1
- **Fastest Lap:** +1 point (race only, must finish P1-P10)

### Historical Data

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/history` | List available seasons from F1 archive |
| GET | `/history/:year` | List all meetings and sessions for a season |
| GET | `/history/session?path=...&topic=...` | Fetch archived session data by topic |

The history endpoints proxy the F1 static archive at `livetiming.formula1.com/static/`. Data is cached for 5 minutes.

**Usage flow:**

```bash
# 1. List available seasons
curl https://f1-live-api.onrender.com/history
# Returns: { "years": [2026, 2025, ...] }

# 2. List meetings for a year
curl https://f1-live-api.onrender.com/history/2026
# Returns meetings with session paths

# 3. Fetch specific session data using the path from step 2
curl "https://f1-live-api.onrender.com/history/session?path=2026/2026-03-08_Australian_Grand_Prix/2026-03-07_Qualifying/&topic=TimingData"
```

**Available topics:** `SessionInfo`, `TimingData`, `TimingAppData`, `TimingStats`, `WeatherData`, `TrackStatus`, `RaceControlMessages`, `DriverList`, `LapCount`, `TopThree`, `TeamRadio`, `SessionData`, `ExtrapolatedClock`, `Heartbeat`

### Documentation

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/docs` | Full machine-readable API documentation (JSON) |

---

## Example Responses

### `GET /timing` (with mini-sectors)

```json
{
  "timestamp": "2026-03-16T14:32:01.000Z",
  "session": "Race",
  "drivers": [
    {
      "driver_number": "1",
      "name": "Max Verstappen",
      "acronym": "VER",
      "team": "Red Bull Racing",
      "team_colour": "3671C6",
      "position": "1",
      "gap_to_leader": "0.000",
      "interval": "0.000",
      "last_lap_time": "1:21.456",
      "best_lap_time": "1:20.123",
      "sectors": [
        {
          "value": "23.145",
          "personal_best": true,
          "overall_best": false,
          "stopped": false,
          "segments": [
            { "index": 0, "status": 2051 },
            { "index": 1, "status": 2049 },
            { "index": 2, "status": 2064 }
          ]
        }
      ],
      "speed_traps": { "i1": "312", "i2": "298", "fl": "321", "st": "315" },
      "tyre_compound": "SOFT",
      "tyre_laps": 12,
      "in_pit": false,
      "telemetry": {
        "rpm": 11823,
        "speed": 312,
        "gear": 8,
        "throttle": 98,
        "brake": 0,
        "drs": 12
      }
    }
  ]
}
```

**Mini-sector status codes:**

| Code | Meaning | F1 TV Color |
|------|---------|-------------|
| 0 | No data | Grey |
| 2048 | Completed | White |
| 2049 | Yellow (slower) | Yellow |
| 2051 | Personal best | Green |
| 2064 | Overall fastest | Purple |

### `GET /pits/44`

```json
{
  "driver_number": "44",
  "name": "Lewis Hamilton",
  "acronym": "HAM",
  "team": "Ferrari",
  "in_pit": false,
  "pit_out": false,
  "total_stops": 2,
  "pit_stops": [
    { "stop_number": 1, "lap": 15, "compound": "MEDIUM", "new_tyre": true, "tyre_life": null },
    { "stop_number": 2, "lap": 38, "compound": "HARD", "new_tyre": true, "tyre_life": null }
  ],
  "current_stint": {
    "number": 3,
    "compound": "HARD",
    "new_tyre": true,
    "laps": 8
  }
}
```

### `GET /team-radio`

```json
{
  "timestamp": "2026-03-16T14:45:00.000Z",
  "session": "Race",
  "total": 12,
  "messages": [
    {
      "driver_number": "1",
      "name": "Max Verstappen",
      "acronym": "VER",
      "team": "Red Bull Racing",
      "timestamp": "2026-03-16T14:44:30.000Z",
      "audio_url": "https://livetiming.formula1.com/static/2026/..."
    }
  ]
}
```

### `GET /telemetry/44`

```json
{
  "driver_number": "44",
  "name": "Lewis Hamilton",
  "acronym": "HAM",
  "team": "Ferrari",
  "team_colour": "E8002D",
  "telemetry": {
    "timestamp": "2026-03-16T14:32:01.123Z",
    "rpm": 11823,
    "speed": 312,
    "gear": 8,
    "throttle": 98,
    "brake": 0,
    "drs": 12,
    "drs_label": "active"
  }
}
```

### `GET /history/2026`

```json
{
  "year": 2026,
  "total": 3,
  "meetings": [
    {
      "key": 1234,
      "name": "Australian Grand Prix",
      "location": "Melbourne",
      "country": "Australia",
      "sessions": [
        {
          "key": 5678,
          "name": "Qualifying",
          "type": "Qualifying",
          "path": "2026/2026-03-08_Australian_Grand_Prix/2026-03-07_Qualifying/",
          "start_date": "2026-03-07T06:00:00",
          "end_date": "2026-03-07T07:00:00"
        }
      ]
    }
  ],
  "usage": "Use session path with GET /history/session?path=<path>&topic=TimingData"
}
```

---

## Connecting to SSE Streams

### Browser / JavaScript

```js
const es = new EventSource('https://f1-live-api.onrender.com/telemetry/stream/44');

es.addEventListener('snapshot', e => {
  const data = JSON.parse(e.data);
  console.log('Initial state:', data);
});

es.onmessage = e => {
  const data = JSON.parse(e.data);
  console.log('Live update:', data);
};
```

### Python

```python
import requests

response = requests.get(
    'https://f1-live-api.onrender.com/telemetry/stream/all',
    stream=True
)

for line in response.iter_lines():
    if line:
        decoded = line.decode('utf-8')
        if decoded.startswith('data: '):
            data = decoded[6:]
            print(data)
```

### curl

```bash
curl -N https://f1-live-api.onrender.com/stream/timing
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `API_KEYS` | *(none)* | Comma-separated API keys. Auth is disabled when unset |

---

## Data Freshness

| Data | Update Rate |
|------|-------------|
| Telemetry (speed, RPM, gear, throttle, brake, DRS) | ~3.7 Hz during session |
| Car positions | ~3.7 Hz during session |
| Timing / gaps / sectors / mini-sectors | ~1 Hz during session |
| Team radio | As transmitted |
| Weather | Every few minutes |
| Race control messages | As issued |
| Pit stops | On each stint change |
| Standings | After each finalised race/sprint |
| Calendar | Static (2026 season) |
| Historical data | Cached 5 min from F1 archive |

---

## Stack

- **Runtime:** Node.js 18+
- **Framework:** Express 5
- **WebSocket:** `ws`
- **Rate Limiting:** `express-rate-limit`
- **Decompression:** Node.js built-in `zlib`
- **No third-party F1 data APIs**

---

## Author

**harsh779**
