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
