---
event: "milestone"
date: "2026-06-27"
change: "Infrastructure Platform milestone — config-registry + config-doctor + fail-closed pre-build config gate; health/diagnostics/rollback/self-healing layer; infra inventory + drift register; A-to-Z e2e verification"
triaged_by: "learning-review (reconstructed from artifacts — PLOS deploy saga, infra inventory, e2e verification, the config-gate PRs — not memory)"
milestone: "Infrastructure Platform capability milestone"
---

# Learning Review — Infrastructure Platform

> Auto-triggered by the Review-Class Trigger (Governance §14 · ADR-003 L2). An Infrastructure Platform
> milestone is unambiguously L2 (new fail-closed gates + a cross-app architecture/registry + significant
> production-config surface). This is its L2 Learning artifact; the Foundation + Founder reviews accompany it.
> Discipline: **every lesson → a routed CAPABILITY candidate; every capability that FAILED to catch something
> → a strengthened capability.** Not a feelings document. NO prod was touched producing this review.

## 1. Reconstruct from artifacts (the saga, cited)

**What drove the milestone — the PLOS prod-deploy failure saga.** A single prod deploy failed across FOUR
distinct layers, each discovered ONE-FAILED-BUILD-AT-A-TIME (the masking pattern, lesson 5):

1. **Node-24 build failure** — the Vercel build broke on Node 24; the fix was to pin Node `22.x` via the
   Vercel API (now recorded as drift **D5** in the inventory: Admin still `24.x`, PLOS `22.x`).
2. **`apps/web` path-doubling (#197)** — the monorepo build resolved a doubled `apps/web/apps/web` path; a
   build-shape defect invisible until the Node pin was past.
3. **Empty-optional `SUPABASE_URL` crashing zod `.optional().url()` (#200)** — a present-but-EMPTY env var
   (`SUPABASE_URL=""`) failed zod's `.optional().url()` because an empty string is "present" to `.optional()`
   yet not a URL. Fixed by `loadEnv()` coercing blank→`undefined` before validation. This var is in PLOS's
   declared OPTIONAL set (inventory §2: `SUPABASE_URL/ANON_KEY/SERVICE_ROLE_KEY/JWT_SECRET`) and is unused
   (PLOS fetches PDFs from Admin) — so an unused, empty, optional var crashed the whole boot.
4. **Genuinely-missing required `DATABASE_URL`** — only AFTER the first three were cleared did the real,
   required missing secret surface. The single key that actually had to be set was the LAST thing seen.

Each layer was a separate failed build cycle. The founder learned of each failure only when the previous fix
unmasked the next — multi-hour, one-secret-at-a-time discovery. **This is the curriculum.**

**What was built in response — the Infrastructure Config Platform** (PRs delivery-os #15 / PLOS #201 /
rumah-admin #17): `config-registry.json` (the per-app declared contract) + `config-doctor.mjs` (validates the
live/declared env against the registry and lists EVERY missing/invalid key at once) + a **fail-closed
pre-build config gate**. Proven in the field: the rumah-admin gate **failed-closed on PR #17, listing all 4
missing keys at once** — the exact inversion of the one-at-a-time saga.

**The health / diagnostics / rollback / self-healing layer** (#16 / #202 / #18): `platform-health` (30/30
self-test both repos), `rollback-helper` (7/7), `post-deploy-verify` (10/10), `diagnose`/health endpoint —
all green by self-test in the e2e verification (`docs/verify/E2E-WORKFLOW-VERIFICATION-2026-06-27.md` §5).

**The infra inventory** (`docs/audits/INFRASTRUCTURE-INVENTORY-2026-06-27.md`) — the first concrete resource
inventory for the ecosystem (ECR-0005 recorded infra at policy level only; NO concrete registry existed). It
surfaced a ranked drift register, headlined by:
- **Pooler INVERSION (D1/D9):** Admin = SESSION pooler `:5432`; PLOS = TRANSACTION pooler `:6543`. Opposite
  conclusions, **both reached from a production 503**, **both correct for their workload** (Admin's long-lived
  module-level `postgres.js` singleton crossed queries on the txn pooler; PLOS's serverless instances hit the
  15-client session-pooler cap). Admin's choice VIOLATES ratified ECR-0005 ("never port 5432") — a deliberate,
  workload-driven exception to RECORD, not "fix" by unifying.
- **Vercel team-vs-personal scope drift (D2):** both apps actually run on **team `team_1CST…` ("Ruma
  Housing")**, but two live PLOS docs (incl. the FAP the founder acts from) still name the **personal** scope
  → "founder edits the wrong project" hazard.
- **Direct-host rewrite gap (D1b):** PLOS's `toTransactionPoolerUrl()` only rewrites the pooler host; a direct
  `db.<ref>.supabase.co:5432` URL is left UNPOOLED → 503 under load. The protection engages only if the URL is
  already the pooler host.

**The A-to-Z e2e verification** (`docs/verify/E2E-WORKFLOW-VERIFICATION-2026-06-27.md`) — independent QA
(author≠verifier), no prod touched. Verdict: **workflow logic PASS (PROVEN-IN-TEST)**; regression bar PASS
with 4 tracked conditions. Three (BUG-1..3) are test-isolation/harness artifacts on shared test DBs, not
product defects (each passes isolated). The fourth (**BUG-4**) is real: **`config-doctor.mjs` is advertised by
`main`'s remediation strings + runbook but exists only on the unmerged branch `infra/config-registry-layer`**
— the documented pre-deploy config GATE the runbook promises is not on the branch that deploys.

**The consolidated FAP** (`FAP-infra-config-cutover.md`, in the consumer repo) carries the founder-gated
cutover actions (set the real `DATABASE_URL`, confirm the team scope, confirm Admin's Vercel plan vs the 5-min
cron D10) — REQUIRE-PROD legs the e2e correctly left founder-gated.

## 2. Were any framework-level lessons discovered?

Yes — five, each routed below. The structural one: **the OS had a deploy DOCTRINE (the deploy-vercel-supabase
skill states the pooler rule + the single-`DATABASE_URL` convention) but no ENFORCEMENT that a deploy's env is
complete and well-shaped BEFORE the build.** Doctrine that isn't a gate is rediscovered the expensive way —
one failed build at a time. The milestone converts that doctrine into fail-closed code.

## 3. Capability impact (the §14 routing)

| # | Lesson (the mechanism, not the virtue) | Layer | Asset | Destination |
|---|----------------------------------------|-------|-------|-------------|
| L1 | Ad-hoc/scattered env config → multi-hour one-by-one secret discovery. A single source-of-truth (`config-registry.json`) + a pre-deploy doctor that lists **ALL** missing/invalid keys at once ends the one-at-a-time saga | Delivery OS | **gate + automation** (config-doctor + registry + fail-closed pre-build config-gate) | `templates/tools/config-doctor.mjs` + `config-registry.json` + `templates/workflows/config-gate.yml`; ledger row `config-doctor + config-registry` advanced to **verified** (field-proven: rumah-admin PR #17 failed-closed listing all 4 keys) |
| L2 | A present-but-EMPTY env var crashes zod `.optional().url()` — `.optional()` sees `""` as present, `.url()` rejects it. `loadEnv()` must coerce blank→`undefined` BEFORE validation | Delivery OS | **doctrine + template** (env-schema pattern future capabilities INHERIT) | the env-contract convention gains the blank→`undefined` coercion rule; `config-doctor` validates registry-declared optionals so an empty-optional is caught pre-build, not at boot. Recorded as a recurring trap in the deploy skill |
| L3 | Pooler `:6543` rule + per-app pooler-mode-WITH-RATIONALE + team-scope-as-canonical must be RECORDED so they can't drift again (the inversion + scope drift were silent until inventoried) | Ecosystem (+ OS template) | **registry (gate-able)** | new `ecosystem-architecture/12-infrastructure-registry.md` (seeded by this inventory): per-app Supabase ref · Vercel id+scope · pooler mode + rationale · Node ver · cron+plan · deploy mechanism · env-key NAMES. Amend ECR-0005 to allow Admin's session-pooler exception |
| L4 | The verify-gate + auto-mode classifier CORRECTLY gated founder-only merges/secrets throughout (no secret leaked, no self-merge, REQUIRE-PROD legs stayed founder-gated) — **working as designed** | Delivery OS | **none (preserve)** | NO change — recorded as a strength to PRESERVE (anti-regression note in the ledger), explicitly NOT "fixed". This is the floor doing its job |
| L5 | Deploy failures were MASKED — each fix revealed the next layer (Node-24 → path-doubling → empty-optional → missing-required). A single preflight running the FULL validation chain (config + build-shape + migration-state) surfaces the complete set up front | Delivery OS | **automation candidate** (deploy-preflight) | new candidate row: `deploy-preflight` — chains config-doctor + build-shape + migration-state into one pre-deploy report so the founder sees ALL blockers in one pass, never N deploy cycles |

## 4. Did any EXISTING capability fail to catch this? (the anti-decay question)

- **The deploy-vercel-supabase skill (doctrine) — failed to PREVENT, by being advice not a gate.** It states
  the pooler rule and the single-`DATABASE_URL` convention, but nothing enforced env completeness or a pooler
  host BEFORE a build burned a deploy cycle. → **Strengthened** by the config-doctor gate (L1) + the registry
  (L3). The doctrine is now machine-checked, not remembered.
- **`check-hook-paths.mjs` (the hook-path-integrity gate, earned the prior milestone) — did NOT catch BUG-4.**
  It proves hook/tool *references in skills* resolve + load; it does NOT check **runbook / remediation-string**
  references. So `main`'s `PLATFORM-HEALTH-RUNBOOK.md` + `platform-health.mjs` remediation strings could
  advertise `node infra/config-doctor.mjs --env production` while that file was absent from the deploy branch.
  → **Strengthened candidate:** extend the reference-integrity check to operator-facing remediation/runbook
  text (a doc-reference resolves on the branch that ships it), OR a release gate that a runbook does not
  promise a tool absent from the deploy branch.
- **No pre-deploy gate existed that BINDS config-doctor to the deploy branch.** BUG-4 is precisely "the gate
  the runbook promises is not on the branch that deploys." → folded into L1 (the config-gate must ride the
  SAME branch that deploys) + L5 (deploy-preflight as the single pre-deploy chain).
- **Anti-decay WIN (the founder's discovery rate trending to zero):** BUG-1..4 were caught by **independent
  QA (author≠verifier)**, not by the founder in prod. The verify discipline surfaced the config-doctor
  branch/main mismatch BEFORE cutover. That is the system being the first user — recorded as the success this
  milestone protects.

## 5. Blast-radius fork

- **Project-local lessons → implemented in this same series:**
  - L1 config-doctor + config-registry + fail-closed pre-build config-gate — BUILT and field-proven
    (rumah-admin PR #17 failed-closed on all 4 keys; PLOS #201; delivery-os #15). Ledger row advanced to
    **verified**.
  - L2 the blank→`undefined` coercion in `loadEnv()` + registry validation of declared optionals — BUILT
    (the #200 fix); recorded as the standard env-schema pattern.
  - The health/diagnostics/rollback/post-deploy-verify layer (#16/#202/#18) — BUILT, self-tests green
    (30/30 · 7/7 · 10/10), ledger candidate row added.
- **OS-base / cross-system lessons → DESIGN-FIRST (never write the base from a retro):**
  - L3 the infrastructure registry (`ecosystem-architecture/12-infrastructure-registry.md`) + the ECR-0005
    session-pooler amendment — owned by ecosystem-architecture; this inventory is its seed data. Recorded as a
    candidate, NOT written into the base here.
  - L5 deploy-preflight (config + build-shape + migration-state chain) — candidate; highest-leverage next
    build (it would have collapsed the four-layer saga into one report). Not scaffolded here — earned, named,
    queued.
  - The Q4 anti-decay extension to `check-hook-paths.mjs` (runbook/remediation reference integrity) —
    candidate; earned by BUG-4.

## Capability ledger entries fed (summary)

**Advanced / added in `capabilities/CAPABILITY-LEDGER.md`:**
- `config-doctor + config-registry + pre-build config-gate` → **verified** (OS-foundational; field-proven PR #17).
- `platform-health / rollback-helper / post-deploy-verify / diagnose` (self-healing layer) → **verified** (self-tests green).
- `deploy-preflight` (config + build-shape + migration-state in one pass) → **candidate** (HIGH — collapses the masking saga).
- `infrastructure-registry` (per-app pooler+scope+refs, gate-able) → **candidate** (ecosystem layer; ECR-0005 amendment).
- `runbook/remediation reference-integrity` (extend check-hook-paths to operator text) → **candidate** (earned by BUG-4).
- **Preserve (anti-regression):** verify-gate + auto-mode classifier correctly gated founder-only merges/secrets — strength, not a bug; no change.

Signals appended to `capabilities/signals.jsonl` (one per lesson, source `delivery-os:learning-review:infrastructure-platform`).

## Verification / honesty notes

- NO prod data, secrets, or deploys were touched producing this review (consistent with the inventory's and
  e2e's own read-only constraint). Env vars referenced by NAME only.
- The config-doctor/config-registry capability is **built and field-proven** but BUG-4 means it is **not yet
  on the deploy branch** — the verified status is for the CAPABILITY's logic (self-test 16/16 + the PR #17
  fail-closed proof); the cutover (merge it onto the branch that deploys, then run it against the live env) is
  REQUIRE-PROD + REQUIRE-MERGE and stays founder-gated. The Learning Review records the capability; it does not
  declare the cutover done.
- This review changes something (it feeds the ledger + queues the highest-leverage candidate) — it was not a meeting.
