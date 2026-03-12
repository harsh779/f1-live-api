# Changelog

All notable updates to the F1 Insights API.

---

## v3.1 — 2026-03-12

- Embedded driver info (name, acronym, team, team colour) into saved session results for accurate past session display
- Renamed project to F1 Insights API
- Comprehensive README rewrite with full field documentation and updated example responses

## v3.0 — 2026-03-10

- Added lat/lon coordinates to all race circuits in calendar data
- Fixed driver standings to include all 22 drivers (was missing drivers without results)
- Full README rewrite with endpoint tables, example responses, and SSE connection guides

## v2.0 — 2026-03-08

- Added mini-sectors (segment-level timing data matching F1 TV colored blocks)
- Added team radio endpoint with audio URLs from F1's CDN
- Added historical data archive — access every session back to 2018
- Archive responses cached in-memory with 5-minute TTL
- BOM stripping for F1 archive JSON responses
- Path validation on archive queries to prevent traversal

## v1.2 — 2026-03-07

- Added rate limiting (100 req/min per IP, 10 SSE connections/min)
- Added optional API key authentication via header or query parameter
- Added CSV export — append `?format=csv` to any endpoint
- Added `/docs` endpoint for machine-readable API reference
- Added `/pits` and `/pits/:number` endpoints for pit stop data
- Added root endpoint (`/`) with API overview and feature list

## v1.1 — 2026-03-06

- Added telemetry endpoints (`/telemetry`, `/telemetry/:number`, SSE streams)
- Added 2026 calendar (`/calendar`, `/calendar/next`, `/calendar/current`, `/calendar/:round`)
- Added session results persistence — auto-saved when feed signals `Finalised`
- Added `/results`, `/results/:filename`, `/results/round/:round` endpoints
- Added driver and constructor championship standings
- Added state persistence to disk every 30 seconds with full restore on restart
- Fixed sector colour coding — BestSectors fallback for finalised sessions
- Fixed S3 showing as `-` by falling back to TimingStats.BestSectors

## v1.0 — 2026-03-05

- Complete rewrite: direct connection to F1's SignalR WebSocket at `livetiming.formula1.com`
- Removed all third-party API dependencies (no OpenF1, no Ergast)
- Subscribed to 16 live topics including compressed CarData and Position
- Zlib decompression for `.z` topics
- Deep merge with array-as-object handling for F1's differential patches
- Exponential backoff reconnection (2s initial, 30s max)
- SSE streaming at ~3.7 Hz (`/stream`, `/stream/timing`, topic filtering)
- Full leaderboard with positions, gaps, sectors, speed traps, tyre data
- Driver status flags (in_pit, pit_out, retired, stopped, knock_out)
- Weather, track status, and race control messages
- DRS label mapping (off, eligible, on, active)

## v0.1 — 2026-03-04

- Initial commit: basic F1 live data API
- Timing endpoint with live driver data
