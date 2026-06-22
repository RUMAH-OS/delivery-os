# Capability Pack — Install & Registration Contract (the install-readiness spec)

> The precise surface a capability pack + its host app must satisfy to be installed into Delivery OS and
> executed through the runtime. Derived from the proven N=2 reference installer (`examples/engine-demo-app/`)
> + Admin (N=1). This is the target PLOS's Mailbox Intelligence pack (and any future pack) prepares against.
> **Scope rule:** a pack contributes CAPABILITY CONTENT only. Runtime/orchestration/state-machine/verifier-
> FRAMEWORK/human-gate/callback mechanics are OWNED BY DELIVERY OS — never re-introduced in a pack.

## 1. What a CapabilityPack may contain (and what it may NOT)
**MAY (capability content):**
- Workflow **definitions** (dispatch-route-plan-shaped step lists; reuse the existing StepEffects: `emit-only`/`idempotent`/`irreversible`/`await-callback` + `engine.verify`/`engine.human-gate`).
- Verifier **INSTANCES** (a `{id, verify}` registered into the engine's verifier framework — a T1 deterministic check today; T2–T4 rungs are an ENGINE capability the pack consumes when DOS ships them, not something the pack builds).
- **Handlers** (the act steps — domain actions).
- Domain **projections / events / manifests**.

**MUST NOT (engine-owned — re-introducing any of these violates the boundary):**
- A workflow runtime, state machine, lease/tick loop, await/resume, recovery, or callback completer.
- A verifier FRAMEWORK, eval-the-evaluator, scoring/confidence machinery, or the human-gate mechanism.
- An agent runner / orchestration engine. (The engine runs what dispatch-route plans; a pack supplies the plan + the step work, not the runner.)

## 2. What the HOST APP must provide to install (the 6-point install surface)
The reference is `createCapabilityRuntime({ context, humanPrincipal, auth, packs })`. To get there an installer must:
1. **Install the engine** via `os-inherit sync` (vendored byte-identical to canonical, sha-pinned in `INHERITED-engine.json`); `engine:drift:check` GREEN. The engine is OS-owned — never edited in the app (enforced by the verify-gate, per ENGINE-OWNERSHIP-GOVERNANCE.md).
2. **Apply the engine-owned migrations** (`.claude/os/engine/migrations/0001_engine_core.sql` + `0002_engine_await_loop.sql`) into the app's OWN db plane (ECR-0005), and add the **app-owned outbox** (the canonical engine DDL intentionally omits it — each installer creates its own).
3. **EngineContext** `{ db, tables }` — the app's drizzle client + the engine table objects (`workflowRun`/`workflowStep`/`outbox`). *(Today the app re-declares the drizzle tables — see install-surface issue #1.)*
4. **HumanPrincipalPort** + an **auth ScopeGuard** mapping `WORKFLOW_SCOPES` (`workflow:runtime`/`workflow:admin`/`workflow:observe`) — a REAL impl (JWT verify + scope grants), not a stub. Plus a least-privilege machine/service scope if the pack uses agent/system callbacks.
5. **Register** the pack(s): `createCapabilityRuntime({ context, humanPrincipal, auth, packs:[…] })` → returns `{ enqueue, tick, workflowRoute, approvalsRoute, enqueueKeys }` (enqueueKeys derived).
6. **Mount** the route factories (`workflowRoute`, `approvalsRoute`) + any domain callback transport the pack needs (e.g. an `outcomeArrived` hook + a callback endpoint for `await-callback` steps), under the engine scopes.

## 3. Install-surface issues a new installer WILL hit (from N=2 + readiness assessment)
1. **Per-app drizzle table boilerplate** — the engine ships DDL, not a drizzle schema, so the app re-types `workflowRun/workflowStep/outbox`. *Platform polish owed: the engine should ship its drizzle table objects.*
2. **ddlParity is single-tenant (BUG-1)** — `engine-check`'s DDL-parity sub-check reads app-migration paths from the shared manifest (hardcoded to Admin's). A non-Admin installer's paths don't resolve, so the DDL sub-check can't run (the file-hash drift lock — the real ownership guarantee — still enforces). *Fix owed before PLOS: make `appMigrations` per-app/project-local.*
3. **Outbox is app-owned** — add it per-plane (the engine DDL omits it).
4. **Own RLS role** — don't reuse `rumah_app`; each app needs its own least-privilege role.
5. **Real auth** — a non-stub HumanPrincipalPort + scope minting (the demo used a stub).
6. **await-callback packs** need an `outcomeArrived` race hook + a callback transport; note the block source is currently `system-callback` (the `agent-result` source is reserved — an engine enhancement, not pack work).
7. **CI drift gate** needs the canonical repo checked out alongside (cross-repo secrets) to be a hard gate; the local verify-gate hook already enforces per-commit.

## 4. PLOS Mailbox Intelligence — readiness posture (this trigger phase)
- **Preserve + document the pack** as capability content: the mailbox pipeline DEFINITIONS + classification/intent verifier INSTANCES + comms/contact HANDLERS + projections. No runtime/orchestration/verifier-framework.
- **Collect real-world validation evidence** — the pack's proof, and the first real workflow DOS will execute through the runtime at the install trigger.
- **Prepare the 6-point install surface** (§2) for the PLOS plane; flag any §3 issue that bites PLOS specifically.
- **What PLOS does NOT build (DOS owes these before a full mailbox install):** T2–T4 verifiers + eval-the-evaluator (PLOS verifies AI judgment — needs the advise-vs-gate safety), the production runner (concurrent/polling), multi-agent coordination (the pipeline fan-out). These are DELIVERY-OS engine capabilities the pack consumes — PLOS waits for them, never re-implements them.

## 5. The trigger
The next major milestone = **Delivery OS installs + executes capability packs through the runtime**. Until then the posture is: stability (freeze the pack), validation (collect evidence), install-readiness (the §2 surface). No new runtime/orchestration/execution/verifier concepts in any pack.
