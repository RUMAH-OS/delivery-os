# Workflow Engine — Ownership Boundary Review (Delivery OS ← Admin)

> Founder target: the Workflow Engine RUNTIME LIVES in Delivery OS and is INSTALLED into Admin + PLOS
> (vendored via os-inherit). "Generic engine code inside Admin" is NOT the goal. Admin contributes
> capabilities/workflows/verifiers/actions/projections only. DESIGN-ONLY — this review GATES further engine work.

## Target architecture
- **Delivery OS owns:** Workflow Engine · Runtime · State Machine · Await/Resume · Verified Loops · Verifier Framework · Human Gates · Agent Execution · Multi-Agent Coordination · Eventing · Dispatch.
- **Admin owns:** Invoice · Contract · Payment · Property · Tenant domains (workflow DEFINITIONS · verifier INSTANCES · ACTIONS/handlers · PROJECTIONS).
- **PLOS owns:** Mailbox · Communication · Contact · Outreach Intelligence.

## HEADLINE (honest)
The domain-free refactor is **real** (`src/engine/*` grep-clean of invoice/contract; domain content in `src/engine-admin/invoice-workflows.ts`). **But domain-free ≠ DOS-hosted ≠ installable.** The engine is still Admin-hosted + Admin-coupled at three hard points, and os-inherit can't carry it as-is. **No promotion until the portability work (Phase A) lands** — promoting a non-portable engine would vendor Admin's db coupling into PLOS and fail at install (the exact "generic code inside Admin" outcome rejected).

## 1. What must MOVE to Delivery OS (the runtime)
| Runtime piece | Current Admin path | DOS destination |
|---|---|---|
| Engine runner (enqueue/tick/lease/CAS/verified-loop) | `src/engine/engine.ts` | `delivery-os/templates/workflow-engine/engine.ts` |
| State machine (7 run + 5 step states, legal edges) | `src/engine/state-machine.ts` | `…/workflow-engine/state-machine.ts` |
| Definition mechanism (types + registry) | `src/engine/definitions.ts` | `…/workflow-engine/definitions.ts` |
| Verifier FRAMEWORK (Verdict + VerifierInput + registry) | `src/engine/verifiers.ts` | `…/workflow-engine/verifiers.ts` |
| Handler mechanism (StepContext + registry) | `src/engine/handlers.ts` | `…/workflow-engine/handlers.ts` |
| Human-gate completer route | `src/approvals-api.ts` | `…/workflow-engine/approvals-route.ts` (router factory) |
| Completer contract | `src/contracts/approvals-v1.ts` | `…/workflow-engine/contracts/approvals-v1.ts` |
| Human-principal auth | `src/auth.ts` `requireHumanPrincipal` | engine declares the **port**; app supplies the impl |
| Engine SCHEMA | `migrations/0034*` + `0037*` (Admin-numbered) | engine-OWNED migration set (see §3) |
| The cage | `scripts/engine-golden-master.ts` | `…/workflow-engine/golden-master.ts` (travels with the engine) |
| Eventing/outbox PATTERN + Dispatch | `engine.ts emitTx`; dispatch-route (already DOS-canonical) | pattern travels; the outbox/workflow TABLES stay per-app (ECR-0005) |

### PORTABILITY BLOCKERS (the gating, unfinished work — "not installable" means)
1. **DB-client coupling (hard blocker):** `engine.ts:17-18` imports the singleton `../db/client` + Admin Drizzle table objects `../db/schema`. A vendored engine in PLOS would import a nonexistent `../db/client`. *Only `engine.ts` is db-bound — the other engine modules are already pure.*
2. **Admin-numbered migrations:** `0034`/`0037` interleave in Admin's 0001-0037 timeline; the engine can't own its schema across consumers when its DDL is a slice of Admin's sequence. Also restated in Admin's `src/db/schema.ts` (a 2nd Admin-owned representation).
3. **Admin-mounted routes + Admin auth:** `approvals-api.ts` imports Admin `db`/`auth`; mounted in Admin `index.ts`. tick/enqueue mounted in `admin.ts` (`/workflow/tick`, `/workflow/enqueue`) gated by Admin `requireAuth("invoice:write")`. The engine has NO installable route module — its HTTP surface lives in Admin's app files.
4. **os-inherit mechanism gap:** `os-inherit.mjs` vendors flat single `.mjs` files into `.claude/os/tools/`; a multi-file TS engine with relative imports can't survive flattening. Needs a directory-vendoring section (the skills branch already copies whole dirs) or a bundled artifact.

## 2. What REMAINS Admin-specific capability code (correctly stays)
- `src/engine-admin/invoice-workflows.ts` — the two `WorkflowDefinition`s, the T1 verifier INSTANCE (`verifyInvoicePrepared` + the `VERIFIER_REASON_CODES` domain enum), the three act handlers (`resolveBilling`/`prepareDraft`/`emitSummary`), `registerInvoiceWorkflows()`. Imports invoicing/schema — correct, Admin domain.
- The invoice projections/actions + the invoice capability manifest.
- Admin's registration wiring + the per-app TABLE materializations in `schema.ts` (the engine owns the DDL PATTERN; the app owns the INSTANCE).
- (PLOS-side definitions/verifiers/handlers authored in the PLOS repo at N=2.)
- **Caveat:** `workflow_approval_audit` is ENGINE infrastructure, not invoice domain — it travels with the engine schema (materialized per-app).

## 3. Migration path (ordered, de-risked)
**Phase A — make the engine PORTABLE (the real remaining work; no promotion yet; GATING).**
- A1: replace the `import { db }` singleton with dependency injection — `tick`/`enqueue` receive a db/tx handle (engine `Context { db, tables }`); Drizzle table refs become injected or pure-SQL (the hot path is already raw SKIP-LOCKED SQL).
- A2: turn the completer + tick/enqueue into **router factories** (`createApprovalsRoute({db, tables, requireHumanPrincipal})`, `createWorkflowRoute({…})`); the engine declares the human-principal AUTH PORT (interface); each app supplies the impl.
- A3: keep the cage + Slice-1 proof green throughout. **Done when `src/engine/*` + the route factories grep-clean of `../db`/`../auth`/`../invoicing` AND cage + proof stay green.**

**Phase B — extract to a DOS-canonical home.** `delivery-os/templates/workflow-engine/` (directory template) with the portable engine + route factories + contracts + cage; an ENGINE-OWNED migration set re-numbered from the engine baseline (copies of 0034/0037); extend `os-foundation.manifest.json` to vendor a DIRECTORY (reuse the skills-style whole-dir copy) + a `workflow-engine.capability.json`.

**Phase C — INSTALL into Admin via os-inherit (prove N=1).** `os-inherit sync` vendors the engine dir into Admin (sha-pinned, drift-gated in CI); Admin applies the engine migrations into its OWN db plane, mounts the route factories with Admin's db/auth, registers `registerInvoiceWorkflows()` against the INSTALLED engine; re-green the Slice-1 proof + cage against the vendored copy; delete the in-tree `src/engine/*`.

**Phase D — install into PLOS (gated, N=2, post-V6).** PLOS applies the same engine migrations into ITS plane, mounts routes with PLOS auth/db, registers PLOS-domain content.

**N=1 gate (explicit):** the engine is canonical-in-DOS but classified "proven on 1 app" until a 2nd app (PLOS) installs the byte-identical vendored copy + runs its cage + a real slice green (the v6 master gate).
**Schema owned-by-engine, applied-per-app (ECR-0005):** the engine ships the DDL migration set; it does NOT ship a database. Each app applies it into its own Postgres → its own `workflow_run/step/approval_audit/outbox` tables + row data. Engine owns the SHAPE; app owns the INSTANCE; the cage re-runs per-app to prove DDL↔validator parity (what makes per-app application safe).

## Bottom line for the gate
- Domain-free: **DONE** (verified).
- Installable: **NOT DONE** — 3 live blockers (engine.ts db-coupling; Admin-numbered migrations; Admin-mounted routes/auth) + the os-inherit flat-file gap.
- **Do not promote until Phase A lands.** Phase A (portability) is the next engine work, and it is the prerequisite the founder's target requires.

---

# EXHAUSTIVE ENGINE-CONCERN INVENTORY (completeness pass, 2026-06-22)

> Founder end state: **Delivery OS = reusable platform** (owns the entire Workflow Engine — runtime · workflow
> engine · state machine · await/resume · verified loops · verifier framework · human gates · callback handling ·
> timers · recovery · agent orchestration · multi-agent). **Admin = installed capability pack** (invoices/contracts/
> payments/tenants/properties/financial workflows ONLY). **PLOS = installed capability pack.** This pass enumerates
> EVERY engine touchpoint still in rumah-admin (grep of `workflow|verifier|await|completer|tick|enqueue|blocked|lease|timer|wake_at`).

## The exhaustive table
Legend: RT=runtime · WE=workflow engine · SM=state machine · AR=await/resume · VL=verified loops · VF=verifier framework · HG=human gates · CB=callbacks · TM=timers · RC=recovery · AO=orchestration · MA=multi-agent.

| # | Concern | File:symbol | Cat | Verdict | Coupling to cut |
|---|---|---|---|---|---|
| 1 | Engine runner enqueue/tick/plan/lease/CAS | `engine.ts` | RT/WE | **PROMOTE** | `../db/client` (L17) + `../db/schema` tables (L18) — the ONLY db-bound engine module |
| 2 | Verified-loop control (runVerify/reopen/block/stop) | `engine.ts` | VL | **PROMOTE** | same db/schema |
| 3 | Recovery (interrupted/backoff/recovered) | `engine.ts` | RC | **PROMOTE** | same |
| 4 | Transactional-outbox emit primitive | `engine.ts` emitTx/transitionRun | RT | **PROMOTE (pattern)** | PATTERN=engine; `outbox` TABLE per-app (ECR-0005) |
| 5-7 | Run/step state machines + unattended classifier | `state-machine.ts` | SM | **PROMOTE** | none — pure, portable today |
| 8 | Definition mechanism + registry | `definitions.ts` | WE | **PROMOTE** | none — pure |
| 9 | Verifier FRAMEWORK (Verdict/input/registry) | `verifiers.ts` | VF | **PROMOTE** | none — pure |
| 10 | Handler mechanism + registry | `handlers.ts` | RT/WE | **PROMOTE** | none — pure |
| 11 | **Engine built-in `engine.verify`/`engine.human-gate` reserved-handler convention** | `engine.ts:115,209` | RT/HG/VL | **PROMOTE** | reserved `engine.*` namespace leaks as STRING config into Admin's definition — semantics+convention travel with engine |
| 12 | Human-gate completer route | `approvals-api.ts` | HG/CB | **PROMOTE (factory)** | db + schema tables + auth port |
| 13 | Human-gate completer contract | `contracts/approvals-v1.ts` | HG/CB | **PROMOTE** | none — pure zod |
| 14 | Human-principal auth | `auth.ts` requireHumanPrincipal/NON_HUMAN_ROLES | HG | **PROMOTE as PORT** (impl stays) | engine declares interface+policy; Admin injects HS256 impl |
| 15 | System-callback completer | `deliveries-api.ts` | CB | **SPLIT** — pattern→engine factory; this delivery-OUTCOME instance (writes `delivery`, no step advance) STAYS-Admin |
| 16 | Delivery contract | `contracts/deliveries-v1.ts` | CB | **STAYS-Admin** (domain) |
| 17 | Event drain (outbox PULL seam) | `events-api.ts` | RT/CB | **SPLIT/FLAG** — seam pattern is eventing; ECR-0006 mount + table stay per-app for now |
| 18-22 | Engine SCHEMA: run/step tables, triggers, await/loop cols, audit table, down-files | `migrations/0034*`,`0037*`; `schema.ts` workflow* | WE/SM/AR/HG | **PROMOTE (DDL owned-by-engine, applied-per-app)** | Admin-numbered; restated as Drizzle objects; `workflow_approval_audit` = engine infra not domain |
| 23 | The cage (golden-master) | `scripts/engine-golden-master.ts` | SM/WE | **PROMOTE** | relative paths re-point to vendored dir |
| 24-25 | Proof harnesses (Slice-0/Slice-1) | `engine-proof.ts`,`engine-loop-proof.ts` | RT/RC/VL | **PROMOTE mechanism; STAY fixtures** | import domain fixtures — split mechanism/fixture |
| 26 | npm engine scripts | `package.json` engine:* | WE | **PROMOTE** | travel with template |
| 27 | HTTP runtime: enqueue/tick/runs routes | `admin.ts:2321-2364` | RT/WE | **PROMOTE (factory)** | mounted in admin.ts under `invoice:write` (WRONG scope — needs engine scope) |
| 28 | Heartbeat tick driver (`?max=` cron loop) | `admin.ts:2336` | RT/TM | **PROMOTE** | serverless liveness pattern |
| 29 | Route mounts | `index.ts:41-77` | RT/CB | **PROMOTE** (`/v1/approvals`); events/deliveries per #15/#17 |
| 30 | `approvals:write` scope vocabulary | `auth.ts:74` | HG | **PROMOTE (definition)** | meaning=engine; minting=Admin |
| 31 | Timers `timer`/`wake_at` slot | `0037` CHECK; `schema.ts:498` (DEFERRED) | TM | **PROMOTE when built** — mostly NOT built (only next_retry_at backoff exists) |
| 32 | cross-repo workflow gate | `scripts/workflow-check.ts` + vendored `workflow-gate.mjs` | CB | tool already-DOS; the Admin domain round-trip check STAYS-Admin |

## Orchestration / Multi-agent — ALREADY DOS-CANONICAL (confirmed, no work)
`dispatch-route`/`agent-route`/`skill-route`/`knowledge-route` are vendored in `.claude/os/tools/*` (sha-pinned `INHERITED.json`, drift-gated). AO/MA are already platform-owned + installed; `definitions.ts` deliberately reuses the dispatch-route plan SHAPE rather than re-implementing orchestration. **No Admin-resident orchestration engine code exists.**

## STAYS-Admin (the pure domain capability pack)
`src/engine-admin/invoice-workflows.ts` (definitions `INVOICE_PREP_*`; verifier INSTANCE `verifyInvoicePrepared`+`VERIFIER_REASON_CODES`; act handlers `resolveBilling`/`prepareDraft`/`emitSummary`; `registerInvoiceWorkflows()`) · the invoice domain EVENTS · the per-app TABLE materializations in `schema.ts` · `deliveries-api`+contract (domain callback) · the proof FIXTURES · the auth verifier IMPL behind the port · `.claude/capabilities/invoice-prepared-postcondition.capability.json`.

## Ambiguous / shared — explicit splits
1. **Outbox/drain (#4,#17):** emit-primitive + drain-pattern = engine/eventing; the `outbox` TABLE + invoice event VOCABULARY + the ECR-0006 `/v1/events` mount stay per-app.
2. **Delivery completer (#15):** promote the idempotent-callback-completer PATTERN; the delivery-outcome INSTANCE stays Admin (it resolves a domain outcome, not a workflow step).
3. **Migration runner (`db/migrate.ts`):** STAYS-Admin app infra — the engine ships its DDL SET into Admin's stream; it does not own the runner.
4. **Capability JSON (#5-split):** `invoice-prepared-postcondition.capability.json` `home.path`/`seamValidator` point at the GENERIC `src/engine/verifiers.ts` but the instance lives in `src/engine-admin/` — metadata cut: `seamValidator`→vendored framework, `home`→Admin instance.
5. **requireHumanPrincipal (#14):** policy (verified-human/no-machine-role) = engine doctrine; token-format verifier = Admin. Engine declares `HumanPrincipalPort`; Admin injects impl.

## Would Admin be a clean capability pack after the full promote-list? — ALMOST
Two named residuals: **(a)** the outbox + event-drain SEAM stays Admin-resident by current ratification (ECR-0005 schema per-app; ECR-0006 `/v1/events` is the Admin↔PLOS seam) — acceptable residual, flagged (the TABLE-as-per-app-data is correct; only the drain-seam is platform-shaped-living-in-an-app, pending a deliberate DOS eventing capability). **(b)** the auth verifier IMPL stays Admin by the port pattern — correct, not a leak. Everything else promotes cleanly, leaving `invoice-workflows.ts` + per-app tables + the domain callback + the manifest as the pure pack.

## Net-new this pass adds to the migration backlog (beyond the 4 anchor blockers)
the `engine.*` reserved-handler convention (#11) · `workflow_approval_audit` confirmed engine-infra (#21) · proof mechanism/fixture split (#24-25) · npm engine scripts (#26) · heartbeat driver (#28) · timer/wake_at reserved slot (#31, mostly-unbuilt) · capability-JSON metadata cut · the delivery-completer pattern-vs-instance split (#15). **The 4 gating blockers are unchanged:** engine.ts db-coupling · Admin-numbered migrations · Admin-mounted routes/auth · os-inherit flat-file→directory vendoring.
