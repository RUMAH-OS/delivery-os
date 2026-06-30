# VERIFY — M3.2: DB-plane dead-man's-switch (detection live, delivery deferred)

- **Slice:** M3.2 (ADR-005) — replace the GitHub-Actions dead-man-switch with a `pg_cron` watchdog in the
  Engine DB. **Detection implemented + verified now; DELIVERY deferred to Sprint 5.3** (the canonical Slack
  Control Surface), per founder direction — no temporary webhook / alternative notifier introduced.

## What was implemented
- `templates/execution-node/watchdog/dead-man-switch.sql` (idempotent): enables `pg_cron` + `pg_net`;
  `engine_config(key,value)` (alert_webhook = NULL until Sprint 5.3); `engine_heartbeat_alarm` log;
  `engine_dead_man_check(threshold default 15m)`; a `*/5` `cron.schedule('engine-dead-man-switch', …)`.
- `infra/config-secret-registry.json`: declares **`ENGINE_ALERT_WEBHOOK`** (SECRET, **not-required** until
  Sprint 5.3) — the endpoint is configurable through the platform secret registry; value lives in
  `engine_config.alert_webhook`.
- `verify-node.sh`: mesh check strengthened to verify **real tailnet connectivity** (`tailscale ip -4`), not
  just the binary.

## Verified (on the live Engine DB)
| Check | Result |
|---|---|
| `pg_cron` + `pg_net` enabled via SQL (no dashboard/founder action) | PASS (`select extname …` → both present) |
| Watchdog cron registered | PASS — `cron.job` `engine-dead-man-switch`, `*/5 * * * *`, active=t |
| **Detection** — inject a 30-min-stale node → run the check | PASS — `engine_dead_man_check()` returned `new_alarms=1`; alarm recorded with **`delivered=false`** (delivery off) |
| No false positive on the live node | PASS — `neo` (fresh) produced 0 alarms |
| **Delivery disabled by design** | PASS — `engine_config.alert_webhook` is NULL → the watchdog records but never POSTs |
| Mesh real-connectivity (after founder `tailscale up`) | PASS — `verify-node --require heartbeat,mesh` → NODE OK, `mesh: connected to tailnet (100.82.253.6)` |

## Behavior contract
- Engine healthy (beats ~every 20s) → no rows match the threshold → **silent** (no alarm, no delivery).
- Engine stalls / Neo dies → `last_beat_at` ages past 15 min → an alarm row is recorded; **delivery happens
  only once `engine_config.alert_webhook` is set** (Sprint 5.3) — the same job, no code change.
- The watchdog runs **inside the managed Engine DB** (different failure domain than the Neo compute plane),
  at **zero GitHub Actions minutes**.

## NOT done (intentionally)
- **No alert delivery** — deferred to Sprint 5.3's Slack Control Surface (roadmap order; no interim notifier).
- **M3.3 not executed** — the GitHub `dead-man-switch.yml` / `heartbeat-driver.yml` are still in rumah-admin
  (untouched). Retiring them edits a **consumer's production safety workflow** and is founder-gated. **Timing
  note:** the GHA dead-man-switch's only current "delivery" is a red-run/Actions email (also SHADOW — it
  pages no real channel either). Deleting it now saves ~8,640 min/mo and loses only that weak signal, while
  the DB watchdog records alarms durably until Sprint 5.3 wires real delivery. Recommend founder approve M3.3
  now; until then the minutes drain continues.
