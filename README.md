# F1 Live Timing API

A self-sufficient Formula 1 live data API that connects **directly** to F1's own live timing infrastructure — no third-party data providers, no OpenF1, no Ergast. Every data point originates from the same feed that powers the official F1 app.

---

## How It Works

The API connects to F1's SignalR WebSocket at `livetiming.formula1.com`, subscribes to 15 live topics, and deep-merges the differential patches into a running in-memory state. Compressed topics (`CarData.z`, `Position.z`) are decompressed on receipt using zlib. State is persisted to disk every 30 seconds and restored on restart. Session results are saved automatically when the feed signals `Finalised`.

---

## Base URL

```
https://your-deployment-url.com
```

---

## Endpoints

### Live Timing

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/status` | Connection status, session info, lap count |
| GET | `/drivers` | All drivers with name, acronym, team, team colour |
| GET | `/timing` | Full leaderboard — gaps, intervals, sector times, tyres |
| GET | `/timing/:number` | Single driver timing data |
| GET | `/weather` | Air temp, track temp, humidity, wind speed, rainfall |
| GET | `/track` | Track status and current flag |
| GET | `/race-control` | All race control messages (penalties, notifications) |
| GET | `/car/:number` | Latest raw telemetry for one car |
| GET | `/snapshot` | Full raw dump of all in-memory state |

### Telemetry Streams (~3.7Hz)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/telemetry` | Latest telemetry snapshot for all drivers |
| GET | `/telemetry/:number` | Latest telemetry for one driver |
| GET | `/telemetry/stream/all` | SSE — all 22 cars, fires on every CarData update |
| GET | `/telemetry/stream/:number` | SSE — single driver telemetry |

**Telemetry fields:** `rpm`, `speed`, `gear`, `throttle` (0–100), `brake` (0/1), `drs`, `drs_label`

DRS label values: `off` / `eligible` / `on` / `active`

### SSE Streams

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/stream` | Every raw feed update as SSE |
| GET | `/stream?topic=CarData` | Filtered to a single topic |
| GET | `/stream/timing` | Full leaderboard pushed on every timing update |

All SSE endpoints send an initial `snapshot` event on connect, then push live `data` events.

**Connecting to an SSE stream:**
```js
const es = new EventSource('https://your-deployment-url.com/telemetry/stream/44');

es.addEventListener('snapshot', e => {
  const data = JSON.parse(e.data);
  console.log('Initial state:', data);
});

es.onmessage = e => {
  const data = JSON.parse(e.data);
  console.log('Live update:', data);
};
```

### Calendar

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/calendar` | Full 2026 season — all 24 rounds |
| GET | `/calendar/next` | Next upcoming session with minute countdown |
| GET | `/calendar/current` | Active race weekend (if any) |
| GET | `/calendar/:round` | Details for a specific round number |

### Results

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/results` | List all saved session results |
| GET | `/results/:filename` | Full result for a saved session |
| GET | `/results/round/:round` | All sessions for a given round number |

Results are saved automatically when a session is finalised. Filenames follow the pattern `2026_R01_Race.json`.

### Standings

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/standings/drivers` | Driver championship standings |
| GET | `/standings/constructors` | Constructor championship standings |

Standings are calculated from saved local result files using the 2026 points system:

- **Race:** 25 / 18 / 15 / 12 / 10 / 8 / 6 / 4 / 2 / 1
- **Sprint:** 8 / 7 / 6 / 5 / 4 / 3 / 2 / 1
- **Fastest Lap:** +1 point (race only, must finish P1–P10)

---

## Example Responses

### `GET /timing`

```json
{
  "timestamp": "2026-03-16T14:32:01.000Z",
  "session": "Race",
  "lap": { "current": 42, "total": 57 },
  "drivers": [
    {
      "position": 1,
      "driver_number": "1",
      "name": "Max Verstappen",
      "acronym": "VER",
      "team": "Red Bull Racing",
      "team_colour": "3671C6",
      "gap_to_leader": "0.000",
      "interval": "0.000",
      "last_lap": "1:21.456",
      "sectors": ["23.1", "28.4", "29.9"],
      "tyre": "S",
      "tyre_laps": 12,
      "in_pit": false,
      "retired": false
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

### `GET /calendar/next`

```json
{
  "round": 4,
  "meeting": "Japanese Grand Prix",
  "circuit": "Suzuka International Racing Course",
  "country": "Japan",
  "city": "Suzuka",
  "session": "race",
  "session_time": "2026-04-05T05:00:00Z",
  "minutes_away": 14523,
  "has_sprint": false
}
```

---

## Running Locally

**Prerequisites:** Node.js 18+

```bash
git clone https://github.com/harsh779/f1-live-api.git
cd f1-live-api
npm install
npm start
```

The API starts on `http://localhost:3000` by default. Set a custom port with the `PORT` environment variable.

```bash
PORT=8080 npm start
```

During an active F1 session the WebSocket connects automatically. Outside of sessions most endpoints still return data from the last persisted state.

---

## Stack

- **Runtime:** Node.js
- **Framework:** Express
- **WebSocket:** `ws`
- **Decompression:** Node.js built-in `zlib`
- **No third-party F1 data APIs**

---

## Data Freshness

| Data | Update Rate |
|------|-------------|
| Telemetry (speed, RPM, etc.) | ~3.7 Hz during session |
| Car positions | ~3.7 Hz during session |
| Timing / gaps / sectors | ~1 Hz during session |
| Weather | Every few minutes |
| Race control messages | As issued |
| Standings | After each finalised race / sprint |
| Calendar | Static (2026 season) |
