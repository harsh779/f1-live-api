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

# Duplicate Archive Round Result Recovery

## Scope
- Backfill Monaco qualifying from Formula 1's static timing archive.
- Preserve the existing Miami qualifying result that shares archive round number 6.

## Constraints
- Use only Formula 1 live/static timing sources.
- Preserve existing result filenames when no collision exists.
- Keep result route and saved-result payload contracts compatible.

## Decision
- When the canonical `year + archive round + session` filename belongs to another meeting, save the new result with the meeting name included in the filename.

## Implementation Sequence
1. Detect whether an existing canonical result belongs to the requested meeting and session.
2. Generate a meeting-qualified filename only when a collision exists.
3. Allow archive backfill to pass the validated filename to persistence.

## Validation Sequence
1. Run backfill against Formula 1's current 2026 static index.
2. Verify both Miami and Monaco qualifying files remain present.
3. Verify Monaco qualifying contains a full classification and is listed by `/results`.
4. Run syntax and API endpoint checks.

## Risks
- Future schedule changes may create more duplicate archive round numbers; the meeting-qualified fallback handles the same pattern.

# Archived Qualifying Timing Detail

## Scope
- Persist Formula 1 archive best lap, interval, sector, and speed data in saved session results.
- Refresh saved archive results created before these fields were supported.

## Constraints
- Use only Formula 1 live/static timing sources.
- Preserve the existing saved-result response shape while adding fields.
- Do not fabricate values when Formula 1 does not provide them.

## Implementation Sequence
1. Map archive qualifying stats to best lap and final-session interval values.
2. Persist best sectors and best speed traps with live timing values as fallback.
3. Rebuild matching archive result files when their timing-detail schema is incomplete.

## Validation Sequence
1. Rebuild Monaco qualifying from Formula 1's static archive.
2. Verify all classified drivers have best sectors and best speed where supplied.
3. Verify Gabriel Bortoleto has Formula 1's archived best lap, interval, sectors, and speed.
