# Decisions

Technical decisions for the F1 Live API — what was decided, why, what
alternatives were weighed, and when. Append new entries at the top.
Reference commits/PRs/issues so the reasoning stays traceable from the
code. Established 2026-06-07.

---

## 2026-06-07 — Migrate to SignalR Core instead of trying to restore classic SignalR

**Decision:** switch the live-timing connection from F1's classic SignalR
1.5 endpoint (`/signalr/negotiate`) to its replacement, SignalR Core
(`/signalrcore/negotiate`).

**Reason:** the classic endpoint returns a hard `401 Unauthorized` with
`WWW-Authenticate: Basic/Bearer` challenge headers from the origin
(`Server: Kestrel`) — reproducible regardless of User-Agent, cookies,
referer, or source IP (the configured residential proxy got the
*identical* 401, ruling out IP-blocking). This is F1 retiring/locking the
endpoint, not a transient or bypassable block. SignalR Core was proven
alive and fully functional: direct negotiate returned 200 with a valid
token, and a full end-to-end connection received 450 real frames/30s of
live Monaco GP Race data.

**Alternatives considered:**
- *Find a way past the 401* — rejected; it's a genuine auth wall from the
  origin server, not a WAF/IP gate. Not spoofable from the client side.
- *Switch the app to a third-party live-timing API* — explicitly rejected
  by the project owner ("API is also mine, I want to use that and API
  works correctly"). Would also have discarded this repo's own working
  infrastructure (proxy, diagnostics, archive persistence) for nothing.
- *SignalR Core* — chosen. Same upstream (F1), proven live, and the only
  endpoint that ever delivers `TeamRadio` (see issue #1).

**Commits:** c7dbd96 (combined fix), f59e9e2 (merge to master)

---

## 2026-06-07 — Combine master's diagnostics-aware client with the Core protocol, rather than merging the older branch as-is

**Decision:** instead of merging the existing unmerged branch
`fix/signalr-core-teamradio` (commit 53d8066, opened 2026-05-02 / PR #1)
directly, port its protocol work on top of master's *current* client.

**Reason:** that branch predates `d6cc6de` (2026-05-23, "Expose live
timing connection diagnostics"). Merging it as-is would have silently
regressed `markConnectionPhase`/`connectionDiagnostics` — the exact
feature that made *today's* live diagnosis possible via `/status`.
Losing it would have made the next incident harder to debug, not easier.

**Alternatives considered:**
- *Merge the branch as-is* — fixes data flow + TeamRadio, but
  `/status` silently stops reporting connection phase/attempts/errors.
- *Combine* — chosen. Take master's client (diagnostics +
  `F1_PROXY_URL` + cookie-forwarding pattern it already had for classic),
  apply the Core protocol switch + the cookie fix proven on the branch.
  Result: fixes everything, loses nothing.

**Commits:** c7dbd96

---

## 2026-06-07 — Forward AWSALB/AWSALBCORS sticky-session cookies on the WebSocket upgrade

**Decision:** capture `Set-Cookie` headers from the SignalR Core negotiate
response and forward them as a `Cookie` header on the WebSocket connect.

**Reason:** without this, the WS upgrade returned `404 "No Connection
with that ID"` — root-caused via systematic curl probing
(`/signalrcore` → `400 Connection ID required`; `/signalrcore?id=<token>`
→ `404 No Connection with that ID`) to AWS ALB sticky-session affinity:
the connection token is registered on one specific backend instance at
negotiate time, and without the ALB's session cookie, the WS upgrade can
land on a *different* instance that has never heard of that token.
Forwarding the cookie → GET returns 200 → full handshake succeeds.

**Alternatives considered:** none viable — this is a hard requirement of
AWS ALB + SignalR's stateful per-connection model, not a config choice.

**Commits:** 55b1f51 (proven on branch), carried into c7dbd96

---

## 2026-06-07 — Handle SignalR Core's `type:3` Completion message (initial-state snapshot)

**Decision:** add a `case 3` to the frame handler: when a Completion
message answers our `Subscribe` invocation (`invocationId: '0'`), iterate
its `result` object as `{topic: data}` pairs through the normal feed
pipeline.

**Reason:** in production, live deltas flowed correctly (`TimingData`,
`TopThree`, `RaceControlMessages`, `TeamRadio`, pit stops — all `type:1`
pushes) but `DriverList`/`SessionInfo`/`TrackStatus`/`ExtrapolatedClock`
stayed null, and the app kept showing stale persisted "Qualifying" data
instead of the live "Race". Cause: those topics are sent **once**, as the
`result` payload of the Subscribe call's completion (`type:3`) — Core's
direct equivalent of classic SignalR's `R` initial-state field, which the
old client *did* handle. The new `handleFrames` had no `case 3` at all,
so the entire snapshot was silently dropped.

**Alternatives considered:** none — this is the only delivery path Core
uses for these topics; there is no `type:1` fallback to rely on instead.

**⚠ Lesson — this is exactly the knowledge-loss this log exists to
prevent:** this *exact* handler was already written once before, on
2026-05-02 (commit `3a23fb5`, message: *"Handle type 3 Completion msg:
initial state backfill from Subscribe result"*) — then reverted **two
minutes later** (`93098ee`, "revert: restore original client.js", no
reason recorded in the commit message, the PR, or any issue) and never
carried into the successor branch (`fix/signalr-core-teamradio`,
`53d8066`, opened that same day, which omitted it). The fix had to be
fully rediscovered ~5 weeks later, live, under production pressure. If
the revert had recorded *why*, or this decision log had existed then,
that rediscovery cost would have been zero.

**Commits:** 40ca499 (fix), dc47445 (merge); original/lost: 3a23fb5,
reverted by 93098ee (2026-05-02)

---

## 2026-06-07 — Prefix team radio `audio_url` with `sessionInfo.Path`

**Decision:** build the team radio audio URL as
`AUDIO_BASE + sessionInfo.Path + cap.Path`, not `AUDIO_BASE + cap.Path`.

**Reason:** `cap.Path` from the `TeamRadio.Captures` feed is relative to
the *session's* static folder (e.g. `TeamRadio/BEA_87_...mp3`), not the
static root. The old construction produced
`.../static/TeamRadio/...mp3` → confirmed `403 Forbidden` by direct
fetch. The real file lives at
`.../static/<sessionInfo.Path>/TeamRadio/...mp3` (e.g.
`2026/2026-06-07_Monaco_Grand_Prix/2026-06-07_Race/TeamRadio/...mp3`) —
confirmed `200 OK`, `audio/mpeg`, 114816 bytes by direct fetch, and the
patched route handler emits this exact URL when run against live-shaped
state.

**Note:** pre-existing latent bug — invisible until today, because
classic SignalR never delivered the `TeamRadio` topic at all (issue #1),
so this code path had never executed in production before the Core
migration shipped. The migration didn't introduce it; it exposed it.

**Alternatives considered:** none — this is the only correct construction
given F1's CDN folder layout.

**Commits:** de4b047 (fix), b6aeeb6 (merge)
