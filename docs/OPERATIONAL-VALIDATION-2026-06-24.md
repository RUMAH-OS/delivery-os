# Delivery OS — Operational Validation & Gap Register (2026-06-24)

Phase goal: prove Delivery OS workflow execution in **real operational usage** + identify the gaps before Slack becomes the founder control surface. Evidence-backed.

## 1. Engine behaviours — PROVEN (capability), with evidence
The engine's behaviours are proven by dedicated proof scripts + independent VERIFY docs (author≠verifier), and the deployed engine is **byte-identical** to the proven canonical source (os-inherit drift-gated), so the deployed instance carries the same guarantees.

| Founder "prove X" | Evidence |
|---|---|
| Workflow execution (enqueue→plan→execute→complete) | `engine-proof`, `engine-goal-e2e-proof`; **PROD run `49983faa` completed on the deployed PLOS app** |
| Verification behaviour (T1 + T2–T4 + LLM judge, advise-vs-gate) | `VERIFY-verifier-framework-slice-a`, `VERIFY-verifier-real-e2e-slice-b`, `VERIFY-llm-judge-slice-b` |
| Verification LOOP (act→verify→retry/improve→stop) + retry + stop conditions (max_attempts) | `engine-loop-proof`, `VERIFY-verifier-real-e2e-slice-b` |
| Agent ownership / multi-agent / parallel | `engine-multiagent-real-proof`, `engine-runner-real-proof`, `VERIFY-multiagent-slice2-parallel`, `VERIFY-production-runner-slice-a/b`, `VERIFY-dispatch-runner` |
| Recovery / idempotency | `engine-recovery-guard-proof`, `engine-idempotency-proof` |
| Capability propagation (DOS→app, byte-identical, drift-gated) | os-inherit; engine vendored byte-identical into PLOS + Admin (`engine:drift:check` green) |
| Completion criteria (verified-stop) | run `49983faa`: `engine.verify` T1 pass `[no_send_no_money, gated_honestly]` → completed |

**Conclusion:** the engine is proven-CAPABLE across every behaviour the founder listed.

## 2. Operational status — NOT YET in meaningful real usage (the honest finding)
The deployed PLOS app runs the engine and completes runs (`49983faa`), **but that run was a no-op** (the dunning resolved no entities because the deployed runtime uses a *default empty email*). Meaningful real operational usage is currently **blocked** by the gaps below.

## 3. GAP REGISTER (what prevents daily operational usage)
**G1 — Per-run input not threaded to handlers (TOP BLOCKER).** `StepContext = {tx, runId, seq, attempt, checkpoint, emit}` — no `input`. Handlers can't see `run.input` (they'd have to query it via `tx`+`runId`). The dunning pack works around this by closing over a *fixed* email → **the deployed dunning can only no-op for real emails.** Fix options: (a) engine enhancement — add `input` to `StepContext` (clean, benefits every capability); (b) per-handler `run.input` query (pack-local). Recommend (a). *Until closed, no capability can process real per-run input in production.*

**G2 — No automatic trigger / heartbeat.** The engine has no daemon; the tick is driven manually (I used the `X-Tick-Token` lane). `pg_cron`→`/api/cron/tick` (or Vercel Cron on Pro) is **not wired**, so runs don't self-advance. Also no *business* trigger (no scheduled dunning sweep, no mailbox-event trigger). → workflows don't start or progress on their own.

**G3 — No founder-facing trigger or visibility.** Triggering needs the engine primitive or an HTTP call with a human JWT; run status/results live only in the DB. There is no founder surface to start a workflow or see its state/verdict. (This is exactly what Slack closes.)

**G4 — Verifier verdict not on the run-read projection.** `GET /v1/workflow/runs/:id` returns FACTS only; the `engine.verify` verdict (rung/pass/reasons) isn't in the projection → a surface can't show verifier results without reading steps directly.

**G5 — No pending-approvals listing.** Only `workflow.gate.resolved` is emitted; there's no "gate requested" event or pending-approvals query → no founder approvals inbox.

**G6 — Mailbox connectable but not connected.** `/api/mailbox/authorize` now works (302→Google), but no mailbox is connected yet (a one-time human OAuth consent). Until connected, no real mailbox-driven workflows.

**G7 — Human-JWT path unverified in prod.** The prod e2e used the engine primitive + tick-token; `SUPABASE_JWT_SECRET`-verified human triggers (enqueue/goals/approvals over HTTP) are untested in prod (and the value is stored "Sensitive").

**G8 — Dunning verifier is T1-only.** Judgment flows (classification/intent) need T2–T4 calibration (eval-the-evaluator) before they can gate.

## 4. Slack control surface — plan (reuse the existing repo)
Full plan: `jarvis-slack-control-surface/docs/SLACK-CONTROL-SURFACE-PLAN.md`. **Reuse `RUMAH-OS/jarvis-slack-control-surface`** (working seed; correct platform boundary — HTTP-only client to the engine; do NOT create a new repo). Surface→mechanism: status=`GET /v1/workflow/runs/:id`; approvals=`POST /v1/approvals` (human JWT); notifications=`GET /v1/events` drain (poll); progress=`workflow_step`; verifier=the Verdict (needs G4). Auth: PULL-only; service token (runtime+observe+events) for trigger/status, separate human JWT (admin) for approvals. Deploy: a long-running **worker** (Socket Mode + poller), not Vercel serverless. Slack depends on G1 (rich triggers), G4 (verdict display), G5 (approvals inbox), G2 (so runs actually progress).

## 5. Recommended sequence (de-risk order)
1. **G1** (thread run.input) — unblocks real per-run workflows; smallest highest-leverage engine change.
2. **G2** (wire pg_cron heartbeat) — runs self-advance; removes the manual tick (the main manual step).
3. **First REAL operational dunning** on prod (real email → Admin payment read → decision → verify → complete) — the actual "operational in real usage" proof, possible once G1+G2 land.
4. **G4 + G5** (verdict-in-projection + approvals listing) — prerequisites for Slack's status/approvals surfaces.
5. **Slack** install into `jarvis-slack-control-surface` (trigger + status + approvals + notifications + verifier display).
6. **G6** (connect the mailbox) + **G8** (T2–T4 calibration) as the capability set grows.
