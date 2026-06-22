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
