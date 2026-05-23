# 2026-05-23 Live Timing Stale State Fix

## Scope
- Stop the Live tab from rendering persisted Miami Race timing as current live data during the Canadian GP weekend.
- Keep archived `/results` data intact.

## Constraints
- Do not hardcode a Canadian GP timing payload.
- Preserve graceful fallback when the upstream feed is disconnected.

## Unknowns
- Whether the deployed SignalR connection will reconnect on its own after deploy.

## Decisions
- Treat disconnected finalised persisted state older than a short freshness window as stale for live endpoints.
- Keep stale metadata in `/status`, but suppress live `/timing` driver rows.

## Implementation Sequence
- Add stale-finalised-session detection to API live timing routes.
- Add a defensive stale guard in the app `/api/live-widget` proxy.
- Validate syntax and mocked stale response behavior.

## Validation Sequence
- Run `node --check` on touched JS files.
- Verify a stale finalised Miami payload no longer produces live driver rows.
- Re-check production endpoints to confirm the root cause is still the stale upstream state until deployment.

## Risks
- Recently finished sessions should remain visible briefly; the freshness window avoids hiding immediate post-session data.

# Standings Fetch Plan

## Scope
- Make `/standings/drivers` and `/standings/constructors` fetch official rank/points from Formula1.com result tables.
- Keep wins/podiums race-only by enriching fetched standings from F1 archive race result data already stored by the API.

## Constraints
- Local-only changes.
- Do not add dependencies.
- Preserve existing response shape for the app.
- Sprint points may be included in official points, but Sprint wins/podiums must not be counted.

## Unknowns
- Formula1.com HTML class names may change.
- Formula1.com does not expose podium counts directly in the standings table.

## Decisions
- Fetch official standings pages for position and points.
- Derive only unavailable race stats from Race session result data.
- Fall back to the previous local points calculation only if Formula1.com cannot be fetched or parsed.

## Implementation Sequence
- Add Formula1.com standings fetch/parsing helpers.
- Add race-only wins/podium stat enrichment.
- Update standings endpoints to be async and report source.
- Keep local fallback for availability.

## Validation Sequence
- Run syntax checks.
- Exercise parser against live Formula1.com HTML.
- Exercise endpoints locally if the server can start.

## Risks
- HTML parsing is more brittle than a formal JSON API.
- Race archive metadata inconsistencies can affect race-only stat enrichment.
