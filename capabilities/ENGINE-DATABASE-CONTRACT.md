# Engine Database Contract — what the platform Engine DB owns (and does NOT)

> Founder verification, requested **before** any new database is created (2026-06-30). Grounded in the
> actual engine DDL (`templates/workflow-engine/migrations/0001–0004`), not assumption. Establishes that the
> Engine DB holds **only Delivery OS platform execution state — PII-free, refs-only, zero consumer foreign
> keys** — so it is safe to provision as a dedicated platform plane (ADR-005, M3/M4).

## Not new infrastructure — a relocation
The engine tables already exist as **platform-canonical DDL** and were explicitly designed to be applied
into a *separate plane*: 0001 — *"each installer applies it into its OWN db plane and owns the INSTANCE
rows."* Today the instance lives **inside rumah-admin's Postgres** (app-role `rumah_app`), co-located with
Admin domain tables. ADR-005 changes only the **plane** (consumer DB → platform-owned), not the schema.
ECR-0005 defined Planes A/B but never carved out the engine's plane; this contract is that refinement.

## Why a dedicated DB is required (not optional)
The engine **is** a durable transactional state machine. Its core primitives are Postgres-specific:
`SELECT … FOR UPDATE SKIP LOCKED` step-leasing, CAS write-backs (`WHERE lease_token = mine`),
crash-recovery (a blocked step holds no lease), `BEFORE UPDATE` legal-edge **triggers** (fail-closed DB
backstop), **RLS**, partial indexes. No store ⇒ no lease, no recovery, no idempotency, no tamper-evident
audit ⇒ no engine. It cannot run on memory, files, or SQLite (no `SKIP LOCKED`/RLS/triggers).

## What it owns — the COMPLETE surface (3 tables)
All platform execution state; the DDL itself marks every payload **refs-only / PII-free**.

| Table | Owns | Data discipline (from the DDL) |
|---|---|---|
| `workflow_run` | the 7-state run; `definition_key`(text recipe), `input`(jsonb), idempotency, attempt, was_interrupted, blocked_reason, retry/terminal timestamps; legal-edge trigger; RLS | `input` = *"data-minimised IDs/refs, NOT PII dumps"* |
| `workflow_step` | the leasable dispatch unit; state/lease/CAS, step_type/owner/handler/skill (registry **text** keys), effect, attempt/max_attempts, checkpoint, result, error; await (await_source, awaiting_event_id, stop_condition, verdict); runner claim; agent_id; triggers; RLS | `result` = *"refs only, PII-free"*; `error` = *"forensic; PII-free"* |
| `workflow_approval_audit` | append-only, tamper-evident human-gate evidence; action_id, decision, actor_sub (**operator principal**), actor_role; RLS INSERT+SELECT only (no update/delete) | *"PII-FREE BY CONTRACT… never names/emails/free-text"*; actor identity = the operator, never customer PII |

**Zero consumer coupling, verified:** the *only* foreign key is `workflow_step.run_id → workflow_run.id`
(self-contained). `definition_key`/`owner`/`handler`/`skill` are text registry keys; `input`/`result`/
`checkpoint` are jsonb refs. **No engine table references any consumer schema** — it is domain-free by
construction and *cannot* hold consumer relational data.

## What stays in consumers (does NOT move to the Engine DB)
- The **domain rows** the refs point at (invoices, contracts, contacts, leads — Admin/PLOS systems of record).
- The **workflow definitions/handlers** (invoice/contract logic) — registered with the engine; code in the consumer.
- All **customer / 3rd-party PII** — never enters the engine.

## The one boundary decision (recommended, for M3 ratification)
The **`outbox`** is *not* engine-owned today (0001: *"the engine does not own the outbox table — it is app
infra"*). In the extracted model the engine's emitted-event log naturally becomes **platform-owned** (the
stream consumers *pull* from, ECR-0006), while each consumer keeps its own **consume inbox**.
**Recommendation:** platform engine owns an **emit outbox**; consumers own their **inbox**. Ratify at M3.

## Delete Test
- Delete the node → platform state survives in the managed Engine DB; a new node resumes. ✓ (replaceability)
- Delete a consumer → the engine runs on; only that consumer's definitions/goals vanish. ✓
- Delete the Engine DB → that is the platform's execution memory ⇒ it must be a deliberately-owned,
  **backed-up** platform asset, never buried in a consumer or on a disposable node. ✓

## Provisioning guidance (for M4 — no infra created by this doc)
- **Managed, off-node Postgres** (e.g. a dedicated Supabase project), reachable via `ENGINE_DATABASE_URL`.
- A **least-privilege app role** substituted for the reference `rumah_app` (0001 portability note).
- Apply migrations 0001–0004 via `provision-engine-runtime.sh` (idempotent ledger).
- **Rejected alternatives:** SQLite (no SKIP LOCKED/RLS); node-local Postgres (state dies with the node —
  breaks ADR-005); reuse a consumer DB (re-couples platform state to a consumer — the inversion ADR-005 fixes).

## Platform Secret Contract (I-Config-validated)
The platform now has its **own** Config & Secret Registry (`delivery-os/infra/config-secret-registry.json`)
— the first one (previously only consumers had registries, which is why the oracle could not discover a
platform secret). The **Secret Validation Capability (`i-config.mjs`) validates it exactly as it does a
consumer registry** — verified output:

```
I-Config readiness — delivery-os [prod]
XX MISSING  ENGINE_DATABASE_URL  (required, SECRET, supabase)
RESULT: NOT READY — 1 required key MISSING   (report-only)
```

**Complete current platform runtime-secret set (1 required):**
| Key | data_class | rule | required | source | notes |
|---|---|---|---|---|---|
| `ENGINE_DATABASE_URL` | SECRET | postgres-url | prod ✓ (local optional) | supabase (dedicated platform project) | the engine's managed off-node store; **not** the `:6543` pooler (always-on node → persistent pool → direct URL); never a consumer DB |

**Anticipated future platform secrets (NOT declared yet — Waterline: added with the capability that needs them):**
- a goal-API auth/signing secret — when the platform exposes `/v1/goals` to control surfaces (ADR-004) + Sprint 5.3.
- agent-execution credentials — if/when the platform engine runs real agent-result steps.

These are deliberately **not** pre-declared (no speculative secrets). The registry grows as runtime capabilities land.

**Oracle limitation (honest):** the engine secret lives on the Execution **node** plane (a 0600 env file),
not vercel/github; the oracle confirms the *declaration* (shape/class/required) but cannot remotely read the
node plane — node-plane presence is `verify-node.sh`'s job at deploy.

## Verdict
The Engine DB contains **only Delivery OS platform execution state**, PII-free and consumer-FK-free. It is
safe and correct as a dedicated platform plane, and conceptually pre-existing (the engine schema, relocated).
The platform secret contract is now declared and I-Config-validated; the sole open design item is outbox
ownership (above), recommended for M3.
