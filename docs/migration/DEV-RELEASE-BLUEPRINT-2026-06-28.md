---
artifact: DELIVERY OS DEVELOPMENT & RELEASE BLUEPRINT (DRB-v1) — exactly how code moves idea→production while production stays operational throughout the Runtime migration
id: DRB-v1
date: 2026-06-28
status: the final engineering blueprint before implementation begins. Implementation strategy ONLY — it changes no Runtime architecture and implements nothing.
produced by: a 12-agent adversarial review → consensus (8 specialists across the 22 areas → 3 red-team lenses [AI-native reality · production-stability hawk · Waterline/N=1 simplicity] → high-effort consensus synthesis). Workflow run wf_9a334679-306.
authoritative inputs: RS-DOS-v1 (frozen, incl. §57 I-Config) · RA-DOS-v1 (frozen) · DISCOVERY-BLUEPRINT-2026-06-28 · RUNTIME-CONFLICT-LEGACY-AUDIT-2026-06-28 · MASTER-MIGRATION-BLUEPRINT-2026-06-28 (MMB-v1, the plan this blueprint operationalizes — and refines where the review overruled it, §13).
---

# Development & Release Blueprint (DRB-v1)

> How an idea becomes production code in the Delivery OS ecosystem, and how the Runtime is built **without ever
> interrupting the live system** (the rumah-admin invoicing engine + PLOS discovery). Two non-negotiables govern
> every decision: **(1) production stays operational throughout the migration; (2) author≠verifier / DoD is
> mechanically enforced, not asserted.** The dominant failure mode this blueprint guards against is *provisioning
> a human-team-sized release ladder for an N=1, AI-agent-builder ecosystem* — so the default is the cheapest
> design that still guarantees those two things; everything else is build-on-pull.

---

## 1. The three facts that reshape ordinary DevOps here
1. **The builders are ephemeral AI sessions, not a human team.** "Where development happens", "local validation",
   and "a second reviewer" all mean something different. Persistence belongs in **definitions** (the config
   registry, forward-only migrations, synthetic seeds), never in a running machine. Two same-model agents are
   **correlated** (shared blind spots / prompt-injection surface) — so genuine verification independence is
   **neutral-hardware re-execution with a class-specific adversarial probe**, not "another agent looked at it".
2. **One live durable engine carries the risk.** Only rumah-admin (financial SoR + the durable engine on a shared
   `:6543` transaction pooler) has platform-emergent and durable-state risk. The plan must be sized to *that*, not
   replicated across five repos.
3. **N=1 founder.** The founder is a *free, genuinely-distinct verifier identity* and the irreplaceable judge of
   the runtime-empirical unknowns — but a scarce serial resource. Spend founder attention only where it is
   irreducible (Class-C boundaries + the [VALIDATE] unknowns), never on routine slices.

---

## 2. Environment model — **two standing environments, five named scopes**
The single biggest over-build to avoid is a per-repo staging fleet. **Net standing infrastructure the migration
adds: one admin staging.**

| Scope | Standing? | What it is | Data | Purpose |
|---|---|---|---|---|
| **local** | No (ephemeral) | a born-correct per-branch stack inside the agent session: Vercel preview + a Supabase **preview branch cut from the migration chain** (or local docker Postgres), torn down at merge | synthetic, prod-shaped | logic/schema/seam build + parity-by-construction |
| **dev** | **Does not exist as a box** | only an `env_scope` vocabulary value (= "ephemeral-preview") | — | naming only |
| **QA** | No (a CI rung) | `verify-coverage` on the **real Vercel build** + ephemeral Postgres | fixtures | the binding pre-merge proof; catches HE-5 build-shape |
| **staging** | **Yes — the one persistent surface (rumah-admin only)** | prod-**tier**-faithful: same Vercel plan-tier + scope, same `:6543` pooler mode + paid tier, same scheduler substrate/tiers, real build, same migrations | **synthetic, prod-shaped only** | HE-1..6 soak (sized to the real `*/5` heartbeat fan-out — minutes, not 24h), the admin↔PLOS seam round-trip, the readiness/D7 **enforce-flip proving ground**, break-glass rehearsal |
| **prod** | Yes (unchanged) | the live system | real SoR | production |

**Staging mirrors prod on tier/pooler/scheduler/platform/scope/migrations — explicitly NOT on data.** HE-3 (pool
starvation) and HE-4 (silent plan clamp) are *account/tier* properties; a cheaper-tier staging is false-confidence
*worse* than none. But real PII/financial SoR (§54.2) must never be copied into a non-prod env — a **hard,
fail-closed "no prod→non-prod data copy" guard** mirrors the prod-DB write guard. Fidelity = tier+pooler+scheduler
parity with synthetic data. **The closed-loop prod canary (deploy≠release, single dark cohort on the real
tier/pooler) is the *primary* HE-3/HE-4 catch;** staging is the *pre-canary* soak/seam/enforce surface for changes
too risky to dark-ship. A **data-plane Supabase branch at the prod pooler mode is pulled forward into Phase 1** to
gate the C12 store concurrency proofs. PLOS staging is build-on-pull when the discovery port (P4) reaches it;
rumah-website (near-static) and jarvis (undeployed) get none.

---

## 3. Branch · merge · deploy
- **Branches (all 5 repos): trunk-based, short-lived, slice-scoped.** One slice → one ephemeral branch →
  **squash-merge to a linear main** → branch deleted. **No** develop/release/hotfix/per-environment branches; **no**
  monorepo/submodule migration during the safety floor. *High AI velocity is a reason to make branches cheap, not
  to bypass the gate.* Staging is a **deploy target** (Vercel promote/alias), never a git branch.
- **Merge is evidence-gated, never time-boxed.** A slice merges the moment its independent `VERIFY-<slice>.md`
  exists and the binding CI floor is green. **Agents never self-merge** — the orchestrator skill *recommends and
  observes only* (it cannot be a gate, by its own contract).
- **Merge ≠ deploy.** Decoupled (see §3-deploy). 
- **Engine vendoring across repos:** the drift-gate is pinned to a **TAGGED delivery-os release** (delivery-os has
  no workflows today — **it must start tagging**, which also enables consumers' I-Version adopt-by-pin later), not
  floating `../delivery-os` main. Engine bumps are **dependency-ordered cross-repo PR sequences** (delivery-os
  source PR first → re-vendor PRs), **never atomic**; cross-cutting PRs (config registry, vendored engine) are
  **serialized one-in-flight** by a *mechanical base-freshness required check* (ephemeral agents share no memory —
  collision-avoidance must be a lock, not a habit).

**Deploy timing (decoupled from merge):**
- **Phase 1 (before staging exists):** merge=deploy stays **coupled** (Vercel Git-native), *safe only because* all
  P1 work is **additive/dark** (flags OFF, greenfield stores off the serving path) **+ the P1.0 GitHub-native gate
  + migrate-in-CI + readiness-in-shadow**. This coupled window is the urgent thing P2.2 closes.
- **Phase 2.1+:** prod deploys become **explicit D7-state-gated authorized promotions** (Vercel promote),
  **staging-first**, evidence-gated on the parity pair + a **binding post-deploy health gate → auto-rollback** —
  **not** an automatic consequence of every merge.

---

## 4. The CI/CD gate sequence (the binding floor is small, uniform, and re-run on neutral hardware)

| Stage | Checks | Binding? |
|---|---|---|
| **per-commit** (feature push) | lint · tsc · unit · local verify-gate | **advisory only** — the author agent is the untrusted actor; local-green has zero binding value |
| **per-PR → main** (the binding floor) | `ci` (build/tsc + unit + **engine drift-gate** on the tagged release) · **`verify-coverage`** (D9 `machine_probe` re-run on **neutral CI hardware** with a **class-appropriate** probe) · **`config-gate`** (§57 I-Config readiness — metadata/existence only, **never values**) · **`secret-scan`** (gitleaks/trufflehog, CRLF-normalized) | **REQUIRED** |
| **per-PR, changed-path-gated** | integration / real-surface **seam** round-trip · engine **concurrency/await-callback/abort** repro — only on engine/seam-touching paths | **REQUIRED on those paths** |
| **per-PR, path-filtered + spend-capped** | LLM-spend suites (jarvis proof harness, golden-master replay) | required on those paths, under a daily cap |
| **pre-merge** | all required checks green **AND** a **CODEOWNERS approval by an identity ≠ PR author** (founder as reviewer-of-last-resort) · linear history · no direct push · **no admin bypass** | **REQUIRED** |
| **pre-deploy** (P2.1+) | a **GitHub `production` Environment** requiring **founder approval for migration/Class-C deploys** · D7 `deployment-auth` (SDLC state + I-Config readiness) · forward-only migrations applied **in-lane** (advisory-lock serialized, break-glass-authorized, **EXPAND-before-code**) | **REQUIRED** |
| **post-deploy** (detection, not prevention) | **binding** prod-smoke (NO `continue-on-error`) + post-deploy concurrency smoke + I-Config re-check → wired to **auto-rollback-by-flag** + the closed-loop canary · **C8 dead-man's-switch** on a different failure domain | binding |

**DoD enforcement point:** below "verified" (§37.2) is **fail-closed at merge**; DoD-before-prod is enforced at the
**D7 deploy boundary**. The binding floor *is* the branch-protection required-check set + CODEOWNERS at PR/merge —
everything post-deploy is **detection**. website = `ci` + light verify only; jarvis heavy gates deferred to P5.3.

---

## 5. What "Runtime validation" actually is (and why it is *deleted* as a pipeline stage)
"Runtime validation" is **not a distinct middle stage** — it is behavior-on-the-running-thing checks bound at the
right rungs:
1. **Deterministic C9 serverless-ceiling lint** (a static property of a step handler) → **shift-LEFT** as a
   required PR lint on any step-handler change, *and* re-checked at goal-admission. The **LLM reachability/precedent
   check (§36.3)** runs only at goal-admission with its fail-closed θ rule.
2. **§57 I-Config readiness** as three fail-closed preconditions at **C9 (admission) · D7 (deploy) · C13 (startup)**,
   each with a **standing planted-missing-key regression test**.
3. **bus-lease / idempotency / breaker proofs** via the CI concurrency/abort harness pre-merge, **re-asserted** in
   admin-staging soak under the real transaction pooler.
4. **DoD §37.2 `verify_status`** — below "verified" is not DONE.

**Three properties are explicitly runtime-empirical and are founder `[VALIDATE]` checkpoints, never green
checkmarks:** the **headless-Claude unattended spawn** (provable only in the real target host — *de-risk this as an
EARLY standalone spike, not buried in P3*), the **GS slow-asymptotic miss** (F7 — the H1 hard cap + founder
judgment, not a test), and **fleet-scale pool-acquire starvation** (HE-3 — only in staging concurrency + the prod
canary residual). The only binding validation is **neutral-hardware CI `verify-coverage` with the class-appropriate
probe**; local validation is advisory.

---

## 6. Author≠verifier, redefined for AI-native (the keystone)
Two sessions of the same model are **not** cognitively independent. So independence is redefined as **independence
of execution substrate + a class-appropriate adversarial probe**, *not* independence of agent identity:
- **(a) Mechanical judgment independence:** `verify-coverage`'s `machine_probe` **re-runs on neutral CI hardware**
  with the **class-specific harness in the probe** — concurrency/abort race for C12 stores; real-surface round-trip
  for the admin↔PLOS seam; planted fail-closed for gates; golden-master replay for the discovery port. **Mocks are
  banned at seams and at the verify step.** The verifier is a **separate session/identity with disjoint write-scope**
  (`tests/`, `e2e/`, `evals/` only — §C5).
- **(b) Self-merge is mechanically impossible:** PR-author and approver run under **distinct GitHub identities**.
  The **cheapest sufficient identity at N=1 is the founder as the required CODEOWNERS reviewer-of-last-resort** (a
  real distinct identity, not honor-system). **Two dedicated AI bot accounts are deferred** until founder-review is
  *provably* the throughput bottleneck.
- **(c)** Where a property is not mechanically settleable, the **founder is verifier-of-last-resort.**
- **The builder/verifier identity model is a P1.0 prerequisite** — if impl and approval ever run under one identity,
  CODEOWNERS review is theatre and DoD-6 collapses. *The strength of this floor and the amount of founder gating are
  one coupled decision: a weak floor forces more founder gates.*

---

## 7. Feature-flag model — flags are **registry rows**, the named precondition of minutes-rollback
Flags are **runtime-readable rows in the §57 durable config registry**, read at request/tick time and flipped by a
**single audited write that takes effect on the next tick with no redeploy** — **NOT Vercel/GitHub build-time env
vars.** This is a *named precondition* of "rollback = flag-revert in minutes": a build-time env-var flag can only
flip via a redeploy through the very push-to-main pipeline being hardened — turning the rollback path itself into a
prod-interruption an agent must push-to-main to execute mid-incident. Reuse `config-doctor`/registry as the flag
store; **no third-party flag platform at N=1.** Three classes:
- **RELEASE** (deploy≠release, default-**OFF**, ~6 total, one per coexistence seam: readiness-enforce · D7-enforce ·
  scheduler-new · preflight-enforce · GS-enforce · reconciler-new · discovery-engine-path).
- **MODE** (audit/shadow vs enforce per fail-closed gate; **shadow is the safe default**).
- **KILL-SWITCH** (default-**SAFE**: J0-FREEZE PO→SUSPENDED; prod-write break-glass default-DENY).
Capability flags **fail OFF**, guard flags **fail ON**. **Every release/mode flag is born with a removal ticket** —
a flag that outlives its cutover is flag-debt and a Waterline violation I-LegacyGuard would have to police forever.

---

## 8. Database migration & rollback
**Execution — a CI-driven migration runner is the deploy lane's FIRST organ (stood up at Sprint 1.4, not deferred):**
migrations apply from a **GitHub Actions job on neutral hardware**, serialized by a **pg advisory lock** against a
tracked migrations table, prod-write authorized **only** by the **P1.1 single-use scoped break-glass token**.
**Human-laptop `db:migrate`/`db:seed`/`db:rollback` against any shared env is forbidden from day one.** *(This
overrules MMB Part G's "current pipeline" for any prod schema write — that pipeline IS CONFLICT-02, the exact
0029/0032 missing-migration outage mechanism, and P1.1 removes `ALLOW_PROD_DB_WRITE`, the only existing prod-write
path, in the same phase.)* The zero-infra GitHub-native binding lands at **P1.0**.

**Safety — expand/contract is a machine-enforced MIGRATION LINTER, not a remembered convention:** mandatory
`lock_timeout` + `statement_timeout` (fail-fast, never queue behind pooled traffic); `CREATE INDEX CONCURRENTLY`
only; `NOT NULL` only via `CHECK … NOT VALID` then `VALIDATE CONSTRAINT`; new columns nullable/constant-DEFAULT
only; **batched backfills, never a single full-table UPDATE**; **DROP/RENAME/type-change FORBIDDEN in expand**.
**EXPAND applies BEFORE code** (old serverless instances must tolerate the new schema); **CONTRACT applies ONLY
AFTER the last code referencing the old shape is retired.** *(A bare `CREATE INDEX`/direct `NOT NULL`/type-change
takes `ACCESS EXCLUSIVE` on the shared `:6543` pooler and stalls all live serverless traffic — a self-inflicted
outage regardless of whether prod reads the new table.)* New C12/GoalContract tables **enable RLS in the same
migration** (default-deny → goal_id/tenant-scoped); **DISABLE RLS forbidden**; backfills run under a distinct
`BYPASSRLS` migration role. **Capture a Supabase PITR/snapshot ref before every contract/backfill migration.**

**Schema parity (no permanent staging needed):** prefer **ephemeral Supabase preview/branch DBs born from the same
migration chain** (parity-by-construction). Replace the heavy bidirectional content-hash gate, on
migration-bearing repos only, with the cheaper-stricter pair: **(a) ordered-migration-set check** AND **(b) one
live `pg_dump --schema-only` fingerprint diff** of staging-after vs prod-before+pending (catches break-glass /
out-of-band prod drift a file-hash misses). No parity gate on static/non-migration repos.

**Rollback per phase — a schema is NEVER reversed; corrections roll forward. The cheapest revert per phase:**

| Phase | Cheapest revert |
|---|---|
| P1.1 secrets | re-point to the prior platform-store secret **version** + the hours-long `.env`-fallback read window (the *bypass* is the one complete-removal case) |
| P1.2 registry | dual-read window → read the old registry |
| P1.3 readiness | MODE flag → shadow |
| P1.4/1.5/1.6 stores | greenfield additive → flag off the writers; schema left inert |
| P2.1 D7 | audit-mode (push-deploy still underneath) |
| P2.2 staging | bypass the rung (= today) |
| P2.4 scheduler | old+new concurrent under SKIP-LOCKED → disable old only after soak |
| P3 organs | release flag → shadow/observe-only (GS false-trip flag-reverts) |
| P3.3 reconciler | flag back to the existing tick/dispatch after a **zero-divergence shadow-diff** |
| P4.7 discovery | flag to the old pipeline, kept read-only/archived 30 days |

---

## 9. Secret management & break-glass
- **Sprint 1.1 means MINT NEW, not relocate.** Scan git history (`gitleaks --since`); **any value ever committed,
  tree-resident, or in an agent transcript is COMPROMISED → revoke at the provider** (history rewrite optional at
  N=1; *killing the values is mandatory*). Rotate **expand/contract per secret**: issue new alongside old →
  redeploy so the app reads the store → **verify on the REAL Vercel build + post-deploy smoke that the running app
  authenticates** → **only then revoke old.** The `.env`-fallback read window is gitignored, store-preferred, and
  measured in **hours, scrubbed the moment the store read is proven.** **Rehearse rotation + break-glass +
  revert-to-prior-version in a throwaway preview deploy first.** Binding **CI secret-scan from P1.1** (don't wait
  for I-LegacyGuard at P4.1). *(HE-5: an agent's local read-parity check proves nothing about module-load-time
  reads on the real build — the reviewer's signature must be a CI build+smoke artifact. Mind Windows CRLF.)*
- **Break-glass (replaces `ALLOW_PROD_DB_WRITE`):** a **default-DENY prod-DB guard always on** (no env-var can
  disable it). A write requires a grant that is **founder-signed · single-use · short-TTL · immutable-logged**
  (reusing the financial-SoR immutability guard) · **scoped to a named table+operation**. The grant is **consumed
  by the platform-side runner** (the CI/deploy-lane job holding the write credential), **never by an agent pasting
  a token into a session** (agents are untrusted execution contexts). **Financial-SoR append-only/immutability
  triggers stay NON-overridable under any grant** (overriding them is a distinct, higher, independently-audited
  gate). Exercise once in staging as a workflow artifact (single-use + immutable-log + re-use-fails). The richer
  break-glass workflow (Future ADR §57.8 F-CSM-6) is deferred.

---

## 10. Coexistence & incremental migration (zero prod interruption)
Per seam: **(1) additive greenfield build off the serving path** (P1 stores/MetricProbe/GoalContract, flags OFF);
**(2) the new organ runs in SHADOW**, its output diffed against live behavior (readiness verdicts in P1.3; the
P3.3 reconciler's desired-vs-observed transitions diffed against the live engine's *actual* transitions until
**zero divergence over a representative soak**); **(3) authority flips by a single runtime-registry flag write**
(evidence-gated); **(4) old path → flag-OFF (observable no-op, never silent) → 30-day stable → archive →
config-not-data delete.** Exactly **one path holds authority at a time.**

- **Discovery (the largest object) builds in parallel from P2 but cuts over LAST** (after the governance organs +
  I-LegacyGuard) **as a LIVE DATA MIGRATION of the revenue pipeline:** dual-write with `lead.status` authoritative,
  **backfill** historical lead state into engine state, prove equivalence by **golden-master replay (frozen REAL
  cohort, identical I-Provider/SerpAPI/LLM call sequence, secret-scrubbed fixtures) + parity + throughput BEFORE
  the flag-flip** (P4.7, founder checkpoint). `lead.status` stays intact as the **live rollback anchor**;
  destructive/in-place migration of `lead.status` is forbidden.
- **Old/new isolation is by DISJOINT STATE SPACE + a SHARED idempotency/intent key, not by the bus lease.** The
  fenced trial cohort must be **provably disjoint** from the live cohort; every external side-effect (outreach,
  paid provider call) writes through the **single C12 idempotency/intent-key store shared by both paths**, so a
  lead in both is de-duped to a no-op. Discovery stays **default-OFF**; **never both paths enabled on overlapping
  cohorts** (the irreversible risk is duplicated outreach/spend, which CAS leasing does *not* prevent).
- **Hard ordering (MMB FP3, held as a gate):** the **D7 deploy gate (P2.1) + C8 dead-man's-switch (P2.3) are
  proven BEFORE any acting organ in P3.** **C8 runs on an external, clamp-free, non-Vercel monitor** polling a GS
  heartbeat in a **different failure domain** (a Vercel-cron watchdog inherits the very HE-4 clamp it should
  detect), with a non-SaaS founder summon fallback. **I-LegacyGuard's competing-scheduler / out-of-band-mutation
  detection is pulled FORWARD** to before the P3.3 reconciler flip and the P2.4 scheduler consolidation, so the
  riskiest coexistence windows have a standing detector.

---

## 11. The definitive end-to-end workflow (idea → production)
*The founder's example, corrected. Changes are justified in §12.*
```
0.  PRECONDITION (P1.0): builder/verifier IDENTITY model (PR-author ≠ approver; founder reviewer-of-last-resort)
    + per-repo branch protection (required checks + non-author CODEOWNERS + linear history + no admin bypass)
    + a 'production' GitHub Environment requiring founder approval for migration/Class-C deploys.
1.  IDEA → GoalContract          (founder, or PO-mind once it exists: objective + acceptance metric + data_class + H1 cap → C2-STATE)
2.  PRE-FLIGHT FEASIBILITY GATE  [INSERTED] (C9: refuse statically-unreachable goals at hour 0 → founder FAP)
3.  SPRINT PLANNING              (PO-mind decomposes into slice-scoped work vs frozen acceptance criteria)
4.  BUILD                        (ephemeral Claude session on a born-correct per-branch stack; one slice; short-lived branch)
5.  LOCAL VALIDATION (advisory)  (author agent runs lint/unit/local verify-gate — explicitly NOT a binding rung)
6.  OPEN PR → BINDING CI         (neutral hardware: verify-coverage w/ CLASS-APPROPRIATE probe + secret-scan + drift-gate + config-gate)
7.  INDEPENDENT VERIFY           (separate session/identity, disjoint write-scope → VERIFY-<slice>.md; probe re-runs on neutral CI)
8.  MERGE                        (binding floor green AND non-author CODEOWNERS approval → squash-merge → branch deleted)
9.  MIGRATION (if any)           (forward-only, in-lane, advisory-lock serialized, break-glass-authorized; EXPAND before code; PITR snapshot)
10. DEPLOY TO STAGING (P2.1+)    (prod-tier admin staging; soak sized to the real heartbeat fan-out; seam round-trip)
11. PRODUCTION VALIDATION        (a SEPARATE post-deploy event: D7 state-gate + §57 readiness authorize the promotion;
                                  closed-loop canary on the real tier; binding health gate → auto-rollback; C8 watches GS silence)
        ── continuous overlay across execute ──▶  GOAL SUPERVISOR (C7) re-probes metric every tick → HALT+summon from outside the loop
12. INDEPENDENT COMPLETION REVIEW (C6)  (author≠verifier at the GOAL boundary — the PO does NOT grade its own progress)
13. FOUNDER APPROVAL             (ONLY at Class-C/boundary surfaces, data_class-keyed — never on routine slices)
14. ROLLBACK if needed           (single runtime-registry flag-revert, minutes; never a schema reversal; corrections roll forward)
15. LEGACY RETIREMENT            (flag-OFF observable no-op → 30-day stable → archive → config-not-data delete; I-LegacyGuard polices re-introduction)
```

---

## 12. How the founder's proposed workflow changes (every change justified)
1. **INSERT the Pre-flight Feasibility Gate (C9)** between GoalContract and Sprint Planning — it was *missing* and
   is THE primary incident fix (refuse statically-unreachable goals at hour 0, before effort).
2. **The Goal Supervisor (C7) + dead-man's-switch (C8) are a CONTINUOUS parallel supervision overlay** over the
   whole execute phase (re-probe → dGoal/dEffort → trip → HALT+summon), not the absent/sequential step the linear
   arrow-chain implies.
3. **SEPARATE the independent Completion Review (C6) from "Project Owner Review"** — author≠verifier must hold at
   the goal boundary; the PO must not grade its own progress.
4. **COLLAPSE "Local Validation → Runtime Validation → Verifier" to two rungs:** local-validate (advisory, the
   untrusted author) then the **neutral-hardware CI verify-gate on the real surface** (the one binding verifier).
   **"Runtime Validation" as a distinct middle stage is DELETED** — it is redundant/ambiguous (its real content is
   distributed across the rungs, §5).
5. **REORDER the tail:** "Production Validation" is the **post-deploy** canary + binding health gate that fires
   **after** the D7-authorized promotion — *staging* is the pre-prod validation rung. Add the explicit **D7
   state-gate + §57 readiness precondition** at the prod boundary.
6. **Merge and deploy are DECOUPLED** — merge is evidence-gated to main; prod deploy is a separate D7-authorized
   promotion (P2.1+), not an automatic consequence of merge.
7. **Founder approval is removed from the routine path** and re-scoped to Class-C/boundary surfaces only (keyed on
   `data_class`, §54), not a human stage per slice.

---

## 13. Founder-approval rule (exactly when)
**Boundary/Class-C-triggered and `data_class`-keyed — never a routine pipeline stage. REQUIRED at exactly:**
(1) P1.1 secrets rotation + break-glass policy; (2) P2.1 deploy-authority change (D7 enforce); (3) **P2.4
Hobby-cap/plan-tier+cost decision — a precondition resolved at/before P2.2**; (4) P3.1 goal-acceptance policy
(what pre-flight refuses); (5) P3.2 halt-and-summon behavior + the slow-asymptotic `[VALIDATE]` ruling; (6) the
`[VALIDATE]` **headless-spawn go/no-go** (gates autonomy); (7) **the P3.3 PO reconciler authority flip (Class-C
authority change — newly added)**; (8) P4.7 discovery cutover; (9) every P5 §11 autonomy panel; **plus** any
pre-flight "unreachable" FAP, GS trip/HALT, or cost-runaway/breaker-exhausted boundary FAP.
**NOT required:** any routine reversible Class-A/B slice/merge/forward-only migration where the verify-gate is
green, the independent VERIFY exists, and no Class-C surface is touched — those are **authorized by the D7 STATE
gate unattended.** *Routine human gates re-create the serial-chokepoint fragility the Runtime exists to remove and
starve the N=1 founder queue; spend founder attention on the three irreducible runtime-empirical unknowns, not on
routine deploys.*

---

## 14. Refinements this review makes to MMB-v1 (reconciliation)
The Development & Release strategy **overrules or sharpens** the MMB on six points (the MMB phase structure
otherwise stands):
1. **Migration runner + GitHub-native binding move EARLY** — runner at **Sprint 1.4** as the deploy lane's first
   organ; the zero-infra branch-protection + `production`-Environment + migrate-in-CI binding at **P1.0** (because
   P1.1 removes the only prod-write path; the "current pipeline" is CONFLICT-02).
2. **§57 readiness: BUILD in P1, ENFORCE later.** Ship the gate in **shadow/audit** in Phase 1; the fail-closed
   enforce-flip is a separate flagged event gated on a proving ground (you cannot fail-closed the live engine's
   C13 startup before staging/rollback exists).
3. **Exactly one admin staging**, not "a staging env per repo" (MMB's biggest over-build); the **prod canary** is
   the primary HE-3/HE-4 catch; **P2.4 plan-tier is a precondition of P2.2.**
4. **I-LegacyGuard's competing-scheduler/out-of-band-mutation detection is pulled FORWARD** to before P3.3 and the
   P2.4 scheduler consolidation (not P4.1).
5. **P3.3 PO reconciler is a Class-C REPLACE with a mandatory zero-divergence shadow-diff** + a founder authority
   gate (added to the checkpoint list) — not an additive build.
6. **Expand/contract is a machine-enforced migration linter; feature flags are registry rows (not env vars).** The
   builder/verifier identity model is a **P1.0 prerequisite.**

---

## 15. Deferred — build-on-pull (do NOT build now; N=1 Waterline)
Two dedicated AI bot accounts / GitHub App (until founder-review is *provably* the bottleneck) · PLOS prod-tier
staging (until the discovery port reaches it) · website/jarvis staging (until durable state/hosting) · §51
I-Version multi-version machinery (lock-step migrate under the drift-gate instead) · the richer break-glass
workflow (F-CSM-6) · drift auto-remediation (§50 — detection-only) · Portfolio Mission Control / APM (I-Ops §49 —
default logs suffice) · a load-testing framework (soak = a handful of parallel ticks at the real `*/5` fan-out,
minutes) · third-party flag platforms · a new secret vault · monorepo/submodule migration · all P5 panel-gated
autonomy.

---

## 16. Risk register (the residuals to watch during the build)
1. **author≠verifier identity** — one shared GitHub identity collapses DoD-6 to honor-system; same-model agents are
   correlated, so neutral-hardware re-execution + the class-specific probe is the *only* genuine independence.
   **P1.0 prerequisite.**
2. **Phase-1 coupled merge=deploy until P2.2** — any non-dark P1 change reaches prod with no staging catch; fences
   are the P1.0 gate + migrate-in-CI + additive/dark discipline + readiness-in-shadow. **P2.2 is the urgent decoupler.**
3. **Secret rotation (P1.1)** — highest-blast-radius P1 step, touching live prod auth before staging exists;
   verify-then-revoke, mint-not-relocate, hours-long fallback, rehearse in a preview first.
4. **Staging plan-tier drift vs prod (HE-4)** — a cheaper-tier staging passes silent-clamp changes as green (worse
   than none); P2.4 tier decision precedes P2.2; the prod canary is the more-faithful primary catch.
5. **Real SoR/PII leaking into staging/previews** (inverse of the test-data-in-prod incident) — synthetic-only
   seeds + a hard fail-closed no-copy guard that must actually be built.
6. **P3.3 reconciler flip over the live financial engine** — a short/unrepresentative shadow-diff soak can
   mis-transition in-flight invoicing; CAS prevents corruption, not transition-logic divergence.
7. **Discovery-port lead-quality regression** — not unit-testable; a weak/stale golden-master cohort or
   non-identical provider call sequence lets it regress silently, surfacing weeks later in the metric.
8. **Three runtime-empirical unknowns** (GS slow-asymptotic F7 · headless spawn · fleet pool-starvation HE-3) —
   unprovable pre-prod; over-claiming "tested" re-opens the effort-without-progress incident class. **Keep as
   founder [VALIDATE]; de-risk the headless spawn as an EARLY standalone spike** (it is load-bearing for all
   P3/P5 autonomy).
9. **Windows CRLF normalization** — could false-block valid VERIFYs or false-pass the secret-scan; normalization
   must be deterministic across ephemeral-session and neutral-CI hardware.
10. **Floating-main drift coupling** — until the drift-gate is pinned to a tagged delivery-os release, one source
    commit can silently mutate three consumers' CI; **delivery-os must start tagging.**
11. **Concurrent agent branches colliding on shared cross-cutting files** (config registry, vendored engine) —
    needs the mechanical base-freshness check + serialization, not "rebase discipline".
12. **Founder-summon queue overload** during migration — many boundaries firing into an N=1 founder serializes
    progress without FAP triage (Class-C + feasibility first).
13. **Flag-debt** — every release/mode flag must be born with a removal ticket or it becomes a permanent dual-path.

---

*End of DRB-v1. This is the definitive Development & Release Blueprint: it specifies how code moves idea→production
while guaranteeing production stability throughout the migration. It changes no Runtime architecture and implements
nothing. With the Architecture, Specification (incl. §57), Discovery (frozen), Conflict Audit, Master Migration
Blueprint, and this Development & Release Blueprint, the planning phase is complete and implementation can begin at
Phase 1.0.*
