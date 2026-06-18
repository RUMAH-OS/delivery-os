# §11 Decision Review — Durable Execution Engine (build-readiness)

- **Date:** 2026-06-18
- **Decision:** HOW to build the durable execution engine the founder approved (the WHETHER is decided — founder chose "build the full engine"). §11 refines scope/safety before code.
- **Panel (3 blind lenses):** database-data · integration-architect · reviewer-critic.
- **Design under review:** `EXECUTION-ENGINE-DESIGN.md`.

## VERDICT: RATIFY-WITH-CONDITIONS (3/3, no REVISE)
Async/runtime architecture is serverless-correct; persistence split (mutable state + immutable outbox) is right; reuse map is accurate (no parallel planner/bus/lifecycle); boundary held (Admin emits facts, The Room ranks). Build-ready as **Slice 0** AFTER the conditions.

## Convergent BLOCKING conditions (multiple lenses)
- **C1 — Drop pgmq; use `SELECT … FOR UPDATE SKIP LOCKED` on `workflow_step.lease_until`.** pgmq + pg_cron are NOT installed (zero on disk — "defaults" was wrong). SKIP LOCKED makes lease+state+checkpoint+outbox ONE atomic transaction (no dual-write). [data+integration+critic]
- **C2 — Drop the pgmq/BullMQ queue adapter from this design.** Build concretely on SKIP LOCKED behind ECR-0005's thin `enqueue()` port only; generalize when PLOS actually inherits (founder-gated). Premature generalization / Waterline. [integration+critic]
- **C3 — DB-enforced safety (data lens, hard gate):** `BEFORE UPDATE` trigger enforcing the legal-edge whitelist (mirror `invoice_immutability_guard`); **RLS + explicit rumah_app policy** on both tables (the most-repeated repo lesson, omitted); `UNIQUE(run_id, seq)`; partial index on the tick's ready-step predicate; `lease_token` compare-and-swap on write-back (the real anti-double-execute); {state+checkpoint+outbox} in one `db.transaction`.
- **C4 — Slice 0 proves on a REAL workflow: `invoice-prep`** (Admin-owned, multi-step, emit-only/idempotent) — NOT synthetic/self-referential, NOT lead-to-contract (its content is PLOS's). [critic]
- **C5 — Event-lifecycle (retention/ack/`consumed_at` + growth bound) ships in the engine's wave**, not after — the engine 10×'s the append-only log onto an ack-less drain. [integration]
- **C6 — Engine executes only emit-only/idempotent steps unattended; non-idempotent ⇒ `blocked`** (respects dispatch-route's no-spawn ceiling; ratifies OPEN-Q7 as an invariant). [integration+data]
- **C7 — Workflow DEFINITION reuses dispatch-route's plan shape; NO new DSL / third lifecycle.** [all]
- **C8 — Golden-master + CI cage exists BEFORE code** (ECR-0005 §D earn-trigger, only half-met). Slice 0's first deliverable = the harness, not the tables. [integration]

## Reduced Slice 0 (de-risked)
2 additive tables (`workflow_run`/`workflow_step` + trigger + RLS) · transition validator (fail-closed) · SKIP-LOCKED tick · Vercel-Cron heartbeat (confirm, vs aspirational pg_cron) · transactional outbox emit · run `invoice-prep`. Success: #1 reaches terminal unattended · #4 kill-mid-step → resume from checkpoint, no lost/double work · #5 forced failure → `recovered`. Deferred: pgmq, queue adapter, escalation/SLA/dead-letter (Slice 1), cross-repo `fullyProven` (Slice 2, founder-gated), polished live-ledger UI (Slice 0.5; raw query suffices).

## Note for the record (sequencing)
Readiness review + ledger both rank this engine LARGE + lowest-priority; higher-leverage unlocks (inheritance-distribution, cross-project round-trip) are now DONE (Rumah N=2). The founder's build decision stands; §11 only ensures it's built safely + on real value.
