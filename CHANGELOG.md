# Changelog

All notable updates to the F1 Insights API.

---

## v3.6 — 2026-06-13

- Fixed live leaderboard showing wrong data **during** a session while the finished result stayed correct. Two root causes:
  - **No state reset between sessions.** F1 sends changed-fields-only differential updates, but state was only ever reset in the constructor — a new session (`SessionInfo.Key` change) deep-merged its deltas on top of the *previous* session's leaderboard, so positions/gaps/sectors/best-laps/stints bled across until each field was eventually overwritten. The board was a mix of old + new mid-session and only became correct once the session finalised. Now a `SessionInfo.Key` change clears all per-session timing via `_resetSessionScopedState()` before merging; driver identity (`DriverList`) is preserved because F1 does not re-send it intra-weekend without a fresh subscribe.
  - **Liveness judged by socket connection.** `isStaleFinalisedSession()` required `connected === false`, but the socket stays connected (and keeps sending `Heartbeat`) long after a session ends — so a finalised/idle session was served as "live". Replaced with `isLiveTimingActive()`: an active `SessionStatus` (`Started`/`Aborted`/`Finished`) **and** a recent *timing* update (tracked via `_lastTimingUpdate`; Heartbeat/clock excluded, 10-minute feed timeout). `/status` and `/timing` now expose `live` and `last_timing_update`.

## v3.5 — 2026-06-07

- Migrated live timing from classic SignalR (`/signalr`) to SignalR Core (`/signalrcore`) — F1 retired the classic endpoint (hard `401` with `WWW-Authenticate` challenge from origin, regardless of user-agent, cookies, or proxy IP); Core is now the only working source, and the only one that ever delivered `TeamRadio` (see #1)
- Forward `AWSALB`/`AWSALBCORS` sticky-session cookies from negotiate onto the WebSocket upgrade — without this the hub returns `404 "No Connection with that ID"` because the connection lands on a different backend instance than the one that issued the token
- Handle SignalR Core's Subscribe-completion message (`type:3`) — carries the one-time initial snapshot for `DriverList`/`SessionInfo`/`TrackStatus`/`ExtrapolatedClock` (Core's equivalent of classic SignalR's `R` field). These topics are sent once and rarely re-broadcast — without this handler they stayed null/stale indefinitely while every other topic streamed live
- Extended `F1_PROXY_URL` tunnel coverage to the negotiate request (previously only wrapped the WebSocket connect — would have failed negotiate when a proxy is required)
- Fixed team radio `audio_url` — was built without the session folder prefix and 403'd on F1's CDN; now correctly resolves via `sessionInfo.Path` to the real playable file
- Expanded subscribed topics 16 → 18: added `TeamRadio`, `AudioStreams`, `ContentStreams`
- Connection diagnostics (`markConnectionPhase`/`connectionDiagnostics`, added in v3.3) carried over to the new protocol intact, plus a new `handshake_failed` phase for Core's handshake step

## v3.4 — 2026-06-07

- Fixed duplicate archive round backfill
- Persisted archived timing detail

## v3.3 — 2026-05-23

- Exposed live timing connection diagnostics via `/status` (`connection.phase`, attempt count, last error, last connect/disconnect timestamps and close codes)
- Suppressed stale finalised live timing — persisted state from a prior session no longer presented as current

## v3.2 — 2026-05-04

- Added optional HTTP CONNECT proxy support (`F1_PROXY_URL`) — routes the F1 SignalR connection through a residential IP to bypass CloudFront WAF datacenter-IP blocks
- Persisted session results to a database to survive ephemeral container restarts
- Fixed archive session-type matching (Race↔Sprint, Qualifying↔Sprint Qualifying confusion)
- Corrected 2026 session start times (timezone conversion from f1calendar.com)

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
