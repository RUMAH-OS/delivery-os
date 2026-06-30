# PLAN — M3: eliminate GitHub-hosted SCHEDULED execution at the root (ADR-005)

> Founder directive: M3 must **eliminate unnecessary GitHub-hosted execution**, not migrate GitHub Actions
> onto a self-hosted runner. For every remaining **scheduled** workflow, assign a target:
> Engine scheduled job · Neo launchd service · Execution-Runtime task · or remain-on-GitHub-with-justification.
> Prioritize the **dead-man-switch** (the only active GitHub cron — ~8,640 min/mo, the exhaustion source).

## Conclusion up front
- **No self-hosted GitHub runner is needed.** The exhaustion is *scheduled crons*, not CI compute. Solving
  it = removing the crons, not relocating them. This validates the founder's instinct (runner ≠ the fix).
- After M3: **zero active GitHub scheduled crons.** Event-CI stays GitHub-hosted **on purpose** (below).

## Per-workflow disposition (every scheduled or recurring workflow)

| Workflow | Today | Active GH minutes? | M3 target | Why |
|---|---|---|---|---|
| **dead-man-switch** (C8) | `*/5` GitHub cron, ACTIVE | **YES (~8,640/mo)** | **Supabase `pg_cron` job in the Engine DB** (different failure domain from the Neo compute plane) → alerts via `pg_net`. **Retire the workflow.** | A watchdog needs a *different* failure domain than the engine. The engine now runs on Neo (compute plane); the **DB plane** (managed Supabase) is a valid different domain that catches the real failure mode — a silent engine-process stall while the DB is up — at **zero GitHub minutes**. `pg_cron`/`pg_net` are ECR-0005-sanctioned. |
| **heartbeat-driver** (C13) | schedule **commented** (disabled) | no | **RETIRE / delete** | The engine tick is now the **Neo launchd daemon** (`com.deliveryos.engine`, continuous) — superseding the GHA-cron driver. Delete so it can never be re-enabled by accident. |
| **goal-supervisor** (C7) | schedule **commented** (disabled) | no | **Delivery OS Engine scheduled job** (an internal `*/30` engine task) when the live goal flow exists (Sprint 5.3) | The supervisor judges goal-delta progress — it belongs *inside* the engine's own scheduler tier, not a GitHub cron. Keep disabled until then; never enable on GHA. |

## The other GitHub workflows (event-triggered — NOT scheduled, so not the drain)
`ci · config-gate · deploy-gate-d7 · migration-runner · scheduler-tiers · secret-scan` (rumah-admin),
`ci · deploy · orchestrator` (PLOS), `ci` (website) — all fire on **push / pull_request**, bounded by dev
activity. **Disposition: remain on GitHub-hosted, with justification** — and explicitly **NOT** on a
self-hosted runner:
- **ADR-002 invariant:** the binding author≠verifier gate (the required CI `verify-coverage` check) must run
  on **neutral hardware**. A self-hosted runner *on Neo* would let the author's own machine verify the
  author's work — **breaking the governance invariant.** Event-CI staying GitHub-hosted is *correct*, not
  waste.
- `localCI` (already on Neo) reduces *volume* (catch failures before pushing → fewer red re-runs), and the
  team's "build + local VERIFY → batch-land" doctrine cuts PR frequency. That is the right lever for event-CI
  — not relocation.
- `workflow_dispatch`-only jobs (`prod-smoke`, `discovery-seed/sweep`) cost ~0 (manual).

## Dead-man-switch root-cause design (the priority)
1. **Engine writes a heartbeat** — `run-engine-host.ts` upserts `engine_heartbeat(node_id, last_beat_at=now())`
   each tick (small platform change; the engine already owns the DB). Liveness becomes a DB fact.
2. **pg_cron watchdog in the Engine DB** — every 5 min, a `cron.schedule` job runs:
   `if now() - max(last_beat_at) > threshold then pg_net.http_post(<alert_webhook>, {alarm…})`.
   Reads-only on liveness; **never drives the tick** (preserves the "don't mask the failure" rule). Runs in
   Supabase's managed plane — survives the Neo engine process dying.
3. **Retire `dead-man-switch.yml`** — the `*/5` GitHub cron is deleted → the ~8,640 min/mo drain is gone.
4. **Residual closed:** the old workflow flagged "GitHub auto-disables a scheduled workflow after 60 days →
   silent stop." pg_cron has no such auto-disable; and the DB-plane outage case is covered by Supabase's own
   status monitoring (a different concern than an engine stall).

### Why DB-plane, not Neo-launchd or an Engine job (the trap to avoid)
- **Neo launchd** → same failure domain as the engine (Neo dies → watchdog dies). ✗ defeats the watchdog.
- **An Engine scheduled job** → the engine watching itself (engine stalls → its own watchdog stalls). ✗
- **DB-plane pg_cron** → different domain from the engine *process*; catches the real silent-stall class. ✓

## Implementation phases (M3)
- **M3.1 (builder):** add the engine heartbeat write to `run-engine-host.ts` + a migration `0005_engine_heartbeat.sql`
  (a 1-row table). Deploy to Neo (restart the daemon). Verify the row updates each tick.
- **M3.2 (builder + founder grant):** enable `pg_cron` + `pg_net` on the Engine DB; install the watchdog
  `cron.schedule`. **Founder provides the alert webhook** (Slack/paging URL — an access grant).
- **M3.3 (builder, founder-merge):** delete `dead-man-switch.yml` + `heartbeat-driver.yml` from rumah-admin;
  update `scheduler-tiers.json` (C8 → DB-plane; C13 → node-daemon; C7 → engine-job). This edits a consumer's
  production safety workflow → **founder architectural approval** to merge.
- **M3.4 (verify):** confirm 0 active GitHub scheduled crons (`gh api .../actions/workflows` + schedules);
  simulate an engine stall (stop the daemon) → the pg_cron watchdog fires the alert; measure the
  GitHub-minutes delta (≈ −8,640/mo). Document in `VERIFY-m3-cutover.md`.

## Founder-gated items (the only ones)
- The alert webhook URL (access grant, M3.2).
- Approval to edit/delete the consumer's production safety workflows (architectural, M3.3).
- (Enabling `pg_cron`/`pg_net` is a SQL change I can run against the Engine DB with the existing connection.)

## Net result
GitHub-hosted **scheduled** execution → **0**. The watchdog is preserved (DB-plane, different domain, free).
The engine tick is the Neo daemon. The supervisor becomes an engine job when earned. Event-CI stays
GitHub-hosted to keep author≠verifier on neutral hardware. **No self-hosted runner introduced** — the root
cause is removed, not relocated.
