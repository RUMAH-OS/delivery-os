# Workflow Engine — FINAL Migration Plan (Delivery OS = canonical platform)

> Supersedes the sequencing in WORKFLOW-ENGINE-OWNERSHIP-BOUNDARY-REVIEW.md. DESIGN-ONLY.
> **Founder correction (binding):** Delivery OS becomes the canonical owner of the engine **immediately**.
> Admin must NOT be the engine's home-then-moved-later. Admin + PLOS **register capabilities into** the engine.
> Delivery OS is the reusable platform for Admin, PLOS, Rumah, and future systems.

## The inversion (what changed from the prior plan)
- **Old (rejected):** build/prove in Admin → promote → vendor back. Admin was the temporary home.
- **New (this plan):** the engine **source-of-truth moves to Delivery OS now**. Admin holds **no engine source** — it installs the engine (vendored, sha-pinned) and registers its domain capabilities. PLOS does the same.
- **Reconciling "canonical now" with the N=1→N=2 governance gate:** *canonical home* ≠ *proven-at-scale*. The source lives in DOS from day one; Admin is the **first installer** (the N=1 proving ground, on real invoice work); PLOS is **N=2**. The already-passing Slice-0 (`VERIFY-execution-engine-slice0`) + Slice-1 (`VERIFY-workflow-engine-slice1`) verifications travel **with the code** — relocation is behavior-preserving, guarded by the golden-master cage. Nothing is re-proven from scratch; "proven-as-shared" is still earned when the 2nd app runs green.

---

## 1. What becomes CANONICAL in Delivery OS (the platform)
Home: `delivery-os/templates/workflow-engine/` (vendored as a unit). Every item below has its single source of truth here; apps carry only sha-pinned installed copies.

**Runtime + workflow engine + state machine + await/resume + recovery + timers**
- `engine.ts` — runner (enqueue/tick/lease/CAS), verified-loop control, recovery (interrupted/backoff/recovered), timer/wake slot. **Portabilized:** receives a db/tx handle + table accessors via an injected `EngineContext` — imports zero app infra.
- `state-machine.ts` — 7-state run + 5-state step machines, legal-edge asserts, the unattended-safety classifier. (Already pure.)
- The two **DB legal-edge triggers** (run + step) ship as engine DDL, byte-mirrored to the in-code machines (the cage pins the parity).

**Verifier framework + verified loops**
- `verifiers.ts` — the `Verdict`/`VerifierInput`/registry **contract** (instances are app-registered). Verdicts are coded/PII-free by contract.
- The verified-loop pattern: act→`engine.verify`→branch(stop/improve/cap-trip→human-gate). The reserved `engine.*` handler namespace (`engine.verify`, `engine.human-gate`) is **engine-owned** and travels with the runtime (no longer a string convention living in app definitions).

**Human gates + callback handling**
- `approvals-route.ts` — the human-response completer, as a **router factory** `createApprovalsRoute({ db, tables, humanPrincipal })`.
- The **generic idempotent callback-completer pattern/factory** (correlation on `awaiting_event_id`, CAS, in-txn, 23505→idempotent) — the shared shape behind both human-response and system-callback completers.
- `contracts/approvals-v1.ts` — the uniform callback contract (pure zod).
- The **`HumanPrincipalPort`** interface + `NON_HUMAN_ROLES` policy + the `approvals:write` scope *semantics* (the verified-human, no-machine-role, single-floor-on-irreversible doctrine). The token-format *impl* is supplied per-app.

**Workflow definitions runtime**
- `definitions.ts` — the definition TYPE + execution **registry** (`registerDefinition`/`getDefinition`), dispatch-route-plan-shaped. DOS owns how a definition is *executed*; apps own the definition *content*.
- `handlers.ts` — the handler `StepContext`/`HandlerResult` + execution **registry** (`registerHandler`/`runHandler`).

**Engine schema (DDL owned-by-engine, applied-per-app)**
- An **engine-owned migration set** (re-baselined from the current Admin-numbered 0034+0037): `workflow_run`, `workflow_step`, `workflow_approval_audit` (engine infra, NOT domain), the triggers, RLS, the await/loop columns. The engine owns the SHAPE; each app applies it into its OWN db plane and owns the INSTANCE rows (ECR-0005).

**Capability installation (now an explicit DOS-owned concern)**
- The **install + register mechanism** itself (see §4): the os-inherit directory-vendoring, the capability-manifest spec, the registration contract, the boot sequence. This is platform, not app.

**Plumbing that travels with the engine**
- The **golden-master cage** + the proof **mechanisms** (Slice-0/Slice-1 harnesses, fixtures excluded), the `engine:*` npm script definitions, the heartbeat tick-driver pattern, the `/workflow/*` + `/v1/approvals` **route factories**.

**Already canonical in DOS (no work):** agent orchestration / multi-agent — `dispatch-route`/`agent-route`/`skill-route` (vendored, sha-pinned, drift-gated). The engine RUNS what dispatch-route PLANS; an agent step = an await-callback step whose other system is an agent runner.

---

## 2. What REMAINS in Admin (an installed capability pack — domain only)
Admin holds **no engine source**. It contributes, via registration:
- **Invoice / contract / payment / tenant / property capabilities:** workflow **definitions** (`INVOICE_PREP_*`, future lead-to-contract, renewal), **verifier instances** (`verifyInvoicePrepared` + `VERIFIER_REASON_CODES`), **act handlers** (`resolveBilling`/`prepareDraft`/`emitSummary`, …), domain **projections**, capability **manifests**.
- **Domain events** vocabulary (`invoice.prepared`, `invoice.send_requested`, …) + the **outbox table instance** (per-app data) + the ECR-0006 `/v1/events` drain seam (Admin↔PLOS).
- The **delivery-outcome callback** (`deliveries-api` + contract) — a domain callback (writes `delivery`, advances no workflow step), distinct from the engine's step-completers.
- The **adapters the engine ports require:** the Drizzle `EngineContext` (Admin's db client + the per-app workflow tables), the `HumanPrincipalPort` impl (Admin's HS256 verifier + scope minting), the route mounts (calling the engine factories), the migration runner applying the engine DDL set into Admin's plane.
- Admin's **registration entrypoint** (`registerInvoiceWorkflows()` against the installed engine).

## 3. What REMAINS in PLOS (an installed capability pack — domain only, N=2)
Identical model, PLOS domain:
- **Mailbox / classification / communication / contact-intelligence capabilities:** definitions (the multi-agent mailbox pipeline), classification/intent **verifier instances**, comms/contact act handlers, projections, manifests.
- PLOS's **port adapters** (its db `EngineContext`, its `HumanPrincipalPort` impl, its route mounts, its migration-runner application of the engine DDL set into PLOS's plane).
- PLOS's **registration entrypoint**.
- PLOS is the **N=2 install** that earns "proven-as-shared." (Post-V6, per the master gate.)

---

## 4. Installation / registration mechanism (how DOS connects to Admin + PLOS)
Two complementary seams — **install** (code+schema, build-time) and **register** (capabilities, run-time).

**A. Install (os-inherit — vendoring, sha-pinned, drift-gated).**
- Extend `os-inherit` from flat-file-only to **directory/package vendoring** (the one real mechanism gap): vendor `templates/workflow-engine/**` into each app's `.claude/os/engine/` (or as a versioned package), recorded in `INHERITED.json` with a content hash; `os-inherit check` fails CI on drift. This makes DOS the single source and forbids local engine edits.
- The engine's **migration set** vendors alongside; each app's migration runner applies it into its own plane (engine owns DDL, app owns instance).

**B. Register (the capability contract — apps inject content into the installed engine).**
- The engine exposes the registries `registerDefinition` / `registerVerifier` / `registerHandler` + a **capability-manifest** spec (`*.capability.json`: id, kind, ownerSystem, the registered symbol). Each app's registration entrypoint self-registers on boot.
- The engine declares **ports** the app must supply: `EngineContext` (db/tables) and `HumanPrincipalPort` (auth). No port impl → the engine refuses to boot (fail-closed).

**C. The app boot sequence (Admin and PLOS, identical):**
1. `os-inherit sync` → installs the engine + migration set (sha-pinned).
2. migration runner applies the engine DDL into the app's db plane.
3. app builds its `EngineContext` + `HumanPrincipalPort` impl and **mounts the engine route factories** (`/workflow/*`, `/v1/approvals`) under an engine scope.
4. app's registration entrypoint registers its definitions/verifiers/handlers + discovers its capability manifests.
5. the heartbeat tick drives the engine; the cage re-runs per-app to prove DDL↔validator parity locally.

---

## Execution phases (DOS-first; nothing lands in Admin-as-home)
- **P1 — Relocate + portabilize INTO Delivery OS (canonical from the first commit).** Move the engine source to `delivery-os/templates/workflow-engine/`; in the SAME move, cut the three couplings (inject `EngineContext`, convert completers/tick to route factories, extract `HumanPrincipalPort`) + re-baseline the engine migration set. Cage + Slice-0/Slice-1 proofs stay green against the relocated source. *Admin's `src/engine/*` is deleted, not retained.*
- **P2 — Build the install/register mechanism.** os-inherit directory-vendoring + `INHERITED.json` hashing + drift gate; the capability-manifest spec + registration contract + the fail-closed port boot.
- **P3 — Admin installs + registers (N=1).** Admin vendors the engine, applies the engine migrations, supplies its port adapters, mounts the factories, registers invoice capabilities; re-green Slice-1 against the **installed** engine. Admin now holds only capability code.
- **P4 — PLOS installs + registers (N=2, post-V6).** Same mechanism; earns "proven-as-shared"; the mailbox pipeline is its first real workflow.

## Honest open decisions (call before P1)
1. **Vendored TS source vs published package.** The engine is app-runtime TS (not a `.mjs` tool); decide vendored-source-dir (matches os-inherit/drift-gate precedent, recommended for N=1) vs an npm package (cleaner at N≥2, heavier tooling). Recommend **vendored source dir now**, revisit packaging at PLOS.
2. **Engine scope vocabulary.** `/workflow/*` is currently under Admin's `invoice:write` — define an engine scope (`workflow:run`/`workflow:admin`) the apps mint.
3. **Eventing residual.** The outbox drain-seam stays per-app under ECR-0005/0006; if eventing later becomes a deliberate DOS capability it joins this engine or a sibling — out of scope for this plan, flagged.

## Bottom line
Delivery OS owns the platform (engine + install/register mechanism) as the **immediate canonical source**. Admin and PLOS own **capabilities only** and **register into** the installed engine. The work is P1 (relocate+portabilize into DOS) → P2 (install/register mechanism) → P3 (Admin N=1) → P4 (PLOS N=2). No engine code ever settles in Admin as its home.
