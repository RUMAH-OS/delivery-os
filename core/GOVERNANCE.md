# Governance (agnostic)

The operating principles. Copy as-is; they name no project.

## 1. Evidence over assumptions (prime directive)
Before declaring success **or** root-causing a failure, get **direct runtime evidence** — inspect the real response/header/cert, read the provider's logs, or add a temporary **diagnostic probe** that reports live state (env **presence**, never secret values; the serving build id; the environment). Do not iterate on guesses.

## 2. Autonomous execution
Work the loop continuously; **do not pause** between steps for acknowledgement. Escalate **only** for: (1) a genuine blocker, (2) required **external access** (credentials/DNS/console/account), or (3) a **business decision**. A completed slice, a passing QA, or a green validation is **not** an escalation — keep going and **batch** the report.

## 3. Author ≠ verifier — structural, not advisory
The builder and the validator own **disjoint file trees** (CODEOWNERS): production code vs `tests/ e2e/ evals/`. The verifier **physically cannot edit what it grades**. The validator's tests are the acceptance contract and run in CI. **Defects flow author-ward.**

## 4. Definition of Done is a hard gate
No slice is DONE without: implement → build/validate green → dedicated commit → **independent** QA → required domain review → **stakeholder acceptance** → docs → status. The **Reviewer/Critic** adds conformance + **simplicity** + **scope-held**. (See `DEFINITION-OF-DONE.md`.)

## 5. Honest failure — never a false success
Surfaces report real state. A system that cannot deliver returns an error, not a success. Fail-closed on sensitive paths.

## 6. Irreversible actions require human approval
Merges and outward/irreversible business actions are human-gated. **Automated/AI agents draft; humans act** (no agent holds a "send"/"charge"/"publish"/"delete" tool unguarded). Before any irreversible change, **capture restoreable state** and define the rollback.

## 7. One source of truth per concern
- Business → `project-context.md`. Conflicts are escalated **before** implementation.
- Structure → one manifest for anything otherwise hand-synced (routes, entities, env keys, API contracts). Drift is a defect class — kill it at the source.
- **Scoped derived-state rule (v4):** any fact a **peer repo** consumes (phase, shipped capabilities, contract status, os_version) **MUST be derived/generated, never hand-maintained** — incident 5 fired *between* repos off a hand-maintained status column (a stale cache with no TTL). Intra-repo hand-edits are tolerable at phase cadence only. A hand-edit to a derived section is a **fail-closed drift-lint error**.
- **Registries split LAW vs STATE:** ownership/contracts are LAW (amended by ECR/signature, slow); current state is **derived at read, never stored** (a registry recorded one consumer two phases behind its actual slice number).
- **Decisions live in a question-keyed ledger** — `DECISIONS.md` (`templates/DECISIONS.md.template`): ID · question · status · signature · superseded-by. The ledger fronts **both** body dialects (ADR documents and proposal+founder-signature records are both valid entries — founder ruling F3); it exists so the same question is never asked twice (the duplicate-ask incident) and signatures never scatter into contradiction.

## 8. The Waterline Rule (reuse without lock-in)
The reusable **spine stays variant-neutral** — it never imports a segment/customer/variant assumption. Variant-specific logic lives **above the waterline**. Earn generalization only when a **second** consumer pulls for it (no premature platform; no speculative scaffolding).

## 9. De-risk early
Front-load the riskiest unknowns: ship a thin vertical slice to the **real target environment** (deploy + CI run + one real end-to-end transaction) in Phase 1–2. Request external credentials on day one. Provision the toolchain before the first build so the builder can self-verify.

## 10. Commit & scope discipline
One slice → ≥1 dedicated commit (what + why + slice id); commit history is an artifact — git IS the project log (v4: the hand-maintained log file was retired; decisions reference hashes from `DECISIONS.md`). Hold scope — the Reviewer/Critic rejects anything "smuggled in" beyond the slice. Know your platform's deploy gotchas and keep them in the deployment runbook.

## 11. Consequential decisions require independent multi-agent review
A **single agent — including the orchestrator — may not issue a recommendation on a consequential decision.** A decision is **consequential** when it is any of:
- **Architectural** — system shape, boundaries, data model, technology/stack/hosting, ADR-worthy choices.
- **Migration-related** — keep / modernize / partial-migrate / rebuild calls; cutover, backfill, or data-move strategy.
- **Production-readiness** — go/no-go, release/cutover, "is this safe to ship," rollback posture.
- **Security-sensitive** — auth/authz, money/invoicing, e-signatures, secrets, anything touching PII.
- **Data-sensitive** — schema/migration, retention/erasure, irreversible writes, anything risking data loss or integrity.

**The mechanism (not optional theatre):**
- **Independent first, consolidated second.** Each relevant role / domain-pack specialist (e.g. Lead Architect, Engineer, QA, Reviewer/Critic, Database/Data, Security-&-Compliance, API-&-Integration) reaches its own evidence-based finding **blind to the others** — no shared draft, no anchoring on a prior conclusion. Only then is a **consolidated recommendation** produced.
- **Surface disagreements; never smooth them.** The consolidation reports where the perspectives diverge and why; a buried disagreement is a process failure. The point of more agents is *independent viewpoints*, not the appearance of rigor.
- **Author ≠ verifier holds (Principle 3).** Whoever drafts the candidate recommendation does not also adjudicate it; the Reviewer/Critic challenges it adversarially before it reaches the human.
- **Which lenses are required** is set by the decision class above ∩ the project's active **domain pack(s)**. Scale the panel to the stakes (a small reversible call needs fewer lenses than a money/data/cutover one) — but **at least two independent lenses + the Reviewer/Critic** for anything in the list.
- **The human merge gate decides.** The panel informs; it does not replace stakeholder approval (Principle 6). Capture the review (findings + dissents + consolidation) as a durable artifact alongside the decision.

**Panel economics (v4 — ceremony is rate-limited by evidence; earned: ~75 lens-runs against 8 operating replies in one consumer's record, with founder pushback "diminishing returns"):**
- **Lens cap by decision class:** irreversible / cross-repo / money / data / cutover → **5–6 lenses max**; reversible-in-one-change → 2–3 or none. Same-model blind lenses are not statistically independent — saturation arrives ~5–6; 14/14 unanimity is repetition, not coverage. A **cross-model second opinion** is an *option on the irreversible class only*, never a standing ceremony.
- **Refusal rule:** a panel REFUSES to run when its inputs are below their own pre-registered gates (gate unfired ⇒ design doc only). The **gate ledger (`gates.md`) is a mandatory pre-read** — panels must read live counters before recommending machinery.
- **One-screen verdict first:** the founder-facing output leads with a one-screen verdict + signature line; the long-form analysis follows. Check the `DECISIONS.md` ledger at ask-time so the same question is never asked twice.
- **Panels lock invariants + pre-registered reversals ONLY — never behavioral predictions.** Falsified twice in the field: 13 blind lens-runs locked a daily-surface placement that one real founder morning reversed. Behavioral surfaces ship as the **cheapest reversible version with a pre-registered reversal**; the friction log settles them (it is the one mechanism with a zero-wrong-answer record). Panels were at their best refusing work; weakest specifying surfaces.
- **Production-readiness is a §11 decision class** (the stock standalone readiness skill is folded into the panel skill), **triggered by the named-cutover rule**: *operating begins at a declared cutover moment* — one consumer named the moment and fired the readiness machinery; the other drifted into operating and its readiness skill never fired. The trigger was the missing piece, not the checklist.

## 12. Verification is operationally enforced, not remembered
**Author ≠ verifier (§3) and consequential-review (§11) are real only when a mechanism — not a person's memory — fires them.** A documented principle that depends on the orchestrator *choosing* to invoke it is not a control; it is a hope. This principle exists because that exact gap let a *generated, unexecuted scaffold* be presented as progress with no independent verifier (see `case-studies/2026-06-10-author-verifier-not-operationalized.md`).

**The enforcement chain (each link is mechanical, installed by the scaffolder, fail-closed):**
- **Git is the substrate (no git ⇒ no build).** The scaffolder runs `git init` + creates `main`/`dev` and installs the gate. Without a repo, CODEOWNERS, CI, and the commit-provenance gate are inert — so implementation work (first commit touching `src/ app/ lib/ api/ migrations/ db/`) may not proceed until the repo and gate exist. Discovery, docs, and throwaway spikes are exempt — the gate never trips until implementation files change.
- **The verify-gate hook fires without the builder's consent.** A `.claude/settings.json` hook (`PreToolUse` deny on `git commit`/`git push` · `Stop` block on turn-end · `PostToolUse` baseline+warn) refuses to let a slice advance when implementation files changed without a **fresh, passing, independent** `docs/verify/VERIFY-<slice>.md`. A committed `.githooks/pre-push` (via `core.hooksPath`) backstops it for *any* git client, even outside Claude.
- **Write-scoping reaches `tests/` (v4).** The author/verifier boundary is not only "the verifier cannot edit production code" — it is also "the author cannot quietly amend QA-owned test pins." The original gate's non-implementation regex **exempted exactly `tests/ e2e/ evals/` — where the boundary lives** — and authors edited QA pins repeatedly (incident 8). The hook now flags implementation changes that arrive together with test-tree changes: the VERIFY artifact must carry an explicit QA-signed `test_pins_amended_by:` acknowledgment from the verifier, or the gate blocks.
- **The gate re-executes one machine-readable probe (v4).** A VERIFY artifact may declare `machine_probe:` — one command the hook re-runs at gate time (exit 0 required). This converts a slice of "the artifact exists" into "part of the evidence still passes," moving verify_status one notch closer to genuinely computed-from-evidence (see Honest limit).
- **Author ≠ verifier — no-VCS fallback.** Where CODEOWNERS-on-a-PR cannot bind (no git, or a single principal playing every role), author≠verifier is satisfied **only** by a *separate verifier run* — a distinct agent invocation/session that did not author the code under test — producing the written, timestamped `VERIFY-<slice>.md`. The artifact records both identities and asserts their disjointness. Where git exists, CODEOWNERS-on-a-PR is the stronger structural form and supersedes the fallback.
- **Status is derived, never self-asserted.** A slice's `verify_status` (`planned → generated → executed → verified`) is computed from evidence (does a fresh passing independent artifact exist?), surfaced in the router, and **never hand-edited by the author**. *Generated* (code exists) and *Executed* (it ran) are not *Verified* (an independent lens confirmed it meets acceptance on its real surface). A builder may never describe a slice as "done"/"complete"/"verified" while its derived status is below `verified`.

**Honest limit (stated, not hidden).** A hook can enforce that a fresh, passing, independence-*claimed* artifact **exists**; it cannot prove the verification was *truthful* or genuinely independent inside a single-agent runtime. The hook raises the cost of faking to deliberate; it does not make honesty automatic. The committed `pre-push` hook + CODEOWNERS-on-a-real-PR-with-a-second-reviewer remain the only fully model-independent layers — which is why git (§12 link 1) is mandatory, not advisory.

## 13. Kernel mechanism vs governance policy (the hard line)
Governance is **two planes**, and conflating them is what made the framework read as "governance is the OS." Use one test: **mechanism = key; policy = prompt.** A *prompt* is consent-based, swappable, and silent on failure — it can only ever be policy. Anything that must hold under *"if it can, it will"* must be a **mechanism**.

- **KERNEL MECHANISM** (thin · non-swappable · fires without consent · fails closed): the verify-gate hook + committed `pre-push`, the git substrate (no-git ⇒ no-build), the derived `verify_status` engine, the drift-lint, key/capability-scoping, and **author≠verifier as a structural write-binding** (the verifier's write-scope excludes the code it grades — CODEOWNERS where git exists; a distinct verifier run where it does not). These are installed by the scaffolder and run whether or not anyone chooses to invoke them.
- **GOVERNANCE POLICY** (large · versioned · swappable, the kernel invokes on demand): which decisions are consequential (§11 classes), which lenses a panel needs, which domain packs attach, where the Waterline sits (§8), and the operating doctrine (§1/§2/§5/§7/§9/§10) + reusable prompts.

**§11 is policy, not a mechanism** (see §11): the *norm* (a consequential decision earns an independent review) is judgment-triggered and context-resolved; only the thin **artifact-existence** shell ("a `DECISION-REVIEW` exists") is mechanism-eligible, and it stays a DoD convention until an observed §11-skip earns a hook — the way §12 was earned by a real failure. **§11's consequential-decision list and the two-lens floor are inherited and non-swappable** (a consumer may deepen a panel, never exempt its own slice). The split keeps the kernel small and the policy large: *a thin enforcement substrate runs a large, swappable governance capability.*

## 14. Delivery OS learns from its consumers (the OS Feedback Loop)
The framework must improve from real projects **without depending on anyone remembering to initiate it**. The loop: *project work → a predefined event → an OS-feedback triage → routing → (maybe) a framework improvement → every future project inherits it.* The **inheritance half is already mechanical** (a framework change → version bump → the scaffolder + version boundary). This principle makes the **capture/promotion half** mechanical at the trigger and human at the judgment — the §13 split applied to learning.

**Mechanical trigger (the OS creates the opportunity to learn).** The verify-gate detects **release-class events** in the push: a **release tag**, and — **v4, because the tag trigger had NEVER fired in the field** (zero feedback artifacts, zero tags, in both consumers; trunk-based continuous projects never create release tags) — two continuous-delivery triggers:
- **Review-artifact detector:** a push that adds/changes a review-class artifact (retrospective, learning review, postmortem, production-readiness or architecture review, a `CHANGELOG-v*`/`VERSION` cut) must also carry an OS-feedback triage (`docs/feedback/OS-FEEDBACK-<event>.md`). The events that produce the richest lessons are exactly the events that fire the trigger — and a retrospective that files no triage is the recorded failure mode this detector closes.
- **N-merges backstop:** if more than N commits (default 30, `.claude/.verify-config.json → feedback_backstop_commits`) accumulate since the last `docs/feedback/` artifact, the next push of implementation changes is blocked until a triage exists. *"No framework lessons discovered." remains a valid triage.*

Both triggers are **HARD-BLOCK, fail-closed** (founder ruling **F7** — the §12 pattern; warn-and-acknowledge was rejected). Template: `templates/OS-FEEDBACK.md.template`.

**Version namespace (founder ruling F1):** OS versions are minted by the **base only** — a version cut is a base changelog + tag + this trigger firing. **A consumer/overlay never mints an OS version label**; a router string with no base tag behind it is unrollbackable prose (the recorded exhibit: an overlay self-minted "v4.0-…" with no tag — there was nothing to roll back from or to). Consumers adopt by **pin** (`.claude/.verify-config.json os_version`) at named moments.

**Batch ratification precedent (founder ruling F2):** a consolidated promotion batch (many lessons, one release packet) may run **one consolidated §11 ratification over the packet** instead of per-promotion panels, **provided** per-promotion earning evidence travels in the packet's changelog and the translation ledger maps every lesson (an unmapped lesson blocks the merge). Per-promotion panels at batch scale would reproduce the ceremony-overrun incident inside the throttling mechanism itself.

**Human judgment (the triage answers three questions).** Were any framework-level lessons discovered? Any **OS Candidates** (`os_candidate: true` — a non-authoritative flag on the record that surfaced it, never a new store)? Route each lesson to its layer:
- **Project-specific** (carries a project noun / only this project cares) → project memory tiers (`memory/` per the three-tier model, v4/F6) + ADR.
- **Ecosystem-specific** (changes who-owns-what / integration) → `ecosystem-architecture/` (ECR).
- **Delivery OS** (statable with **no project noun** AND every future project benefits) → a framework change + a `case-studies/` worked example + a version bump.

*"No framework lessons discovered." is a valid triage outcome — but the triage itself must exist.*

**The promotion bar (the bloat brake).** A framework promotion is earned only by an **observed failure** OR a **second consumer pulling** for it (Waterline §8). The counterfactual — *"would this have prevented the failure if it had existed before the project started?"* — is **confirming evidence only when it cites a recorded failure artifact**, never a leading or imagined signal. Default triage outcome is **close/wait**.

**A promotion is itself a consequential decision.** Promoting a lesson into the framework changes how every future project builds, so **each promotion runs a scaled Principle-11 panel** (§11) before it lands. The loop is recursive by design.

**A promoted lesson goes to the RIGHT place — not assumed a skill.** It may become a **hook · template · doctrine line · skill · agent change · lint · process adjustment · or no framework change at all.** Storing the lesson in the wrong artifact (e.g. forcing every lesson into a skill) is itself a defect.

**Guardrails (mechanized, not hoped).** The **no-backflow lint** (`scripts/check-no-backflow.mjs`) fails the build if a project noun appears in the agnostic framework (`core/ agents/ skills/ templates/ processes/ checklists/ domain-packs/`) — a kernel mechanism alongside the drift-lint. **Honest limit (same as §12):** the gate forces the triage to *exist and be answered*, not to be *insightful*; the independent §11 promotion panel is what gives the answer teeth.

**Mechanism / policy line:** MECHANISM = the event-fired trigger · the no-backflow lint · the version-bump inheritance. POLICY = the triage content, the routing, the bar, and every promotion (§11-gated). *The OS creates the trigger and requires the triage to exist; humans answer it and decide every promotion.*

## 15. Earned doctrine (v4 — each paragraph cites the incident that purchased it; provenance: `case-studies/2026-06-incident-ledger.md`)

**Mechanism-over-prose law.** *Trust in an OS link is proportional to its mechanical fraction.* Across two full consumer records: **every incident occurred at a link that was prose** (merge-on-red, stale routers, the open-gate plan, unenforced DoD rows, the spec fiction); **zero occurred at a link that was a program** (verify-gate, banned-identifier scans, append-only stores, deterministic comparators). A rule without a scan, a fixture, a hook, or a gate is a wish — and the OS should say so at authoring time. The full doctrine seed lives at `templates/memory/doctrine-seed.md` (copied to every project at scaffold).

**Evidence governor.** Build order is law: **capture before the gate; consumers at gate-fire; build-ahead capped at one step.** Every pre-committed evidence gate is registered in `gates.md` with a **live counter** (N/threshold, surfaced on the operating surface), an owner, and a **reconsideration date** — so a gate can fail honestly instead of silently never firing. Earned: consumption machinery compounded for two gates that never fired, while the one correct pre-gate build was capture-only.

**Contracts + probes, never narrative claims.** Cross-system state travels as **versioned contracts and verifiable probes** ("run this command, expect this shape"), never as relayed prose ("X reports Y is live"). Witnessed independently from both sides of the same seam: **every relayed-prose claim contained at least one false statement; every contract+token request worked first time.** Treat narrative state claims as hypotheses to verify; never act on another workload's processes on their basis.

**Credentials are a stop condition.** A missing credential/permission stops the lane — it is never improvised around, and the platform's permission classifier is honored as a **fourth enforcement layer** (recorded: a refused token mint and two refused premature production actions, each correct). Founder acts (credentials, DNS, accounts) are **the long pole**: name them in the slice doc at spec time, request them day one.

**Default runtime posture: gestured-pull, zero background processes.** The default architecture is a gesture-driven monolith — no cron, no daemons, no queues — until a founder-signed amendment adds one. This eliminated whole failure classes in the field. **Honest ceiling, stated:** one operator's gestures are the system's clock — fine for an operator-driven business, a hard ceiling for SaaS; crossing that line is a consequential decision (§11), not drift.

**Toolchain byte/secret rule.** Scripts are written in Node/tsx (or an equivalent real runtime) from the start; a legacy shell (e.g. PowerShell 5.1) is a **launcher only** — never pipe secrets or bytes through it (recorded: a BOM-corrupted env var broke a production deploy; a missing RNG API produced an all-zeros password caught only by inspection).

**Read-canonical-first — a contract existing ≠ a contract read (v5 keystone; THE canonical home for this rule).**
Before building any **cross-system** producer or consumer surface, READ (1) the canonical contract/decision record, (2) the *consumer's actual code*, (3) the source of truth — and record the shape you are building to, **before** the first build edit. This **extends** *Contracts + probes* above: that rule says cross-system state travels as contracts not prose; this adds that **the contract must be read, not modeled** — every cross-system defect in the recorded N18 set (a transport built opposite to the ratified one + a divergent envelope + a duplicate contract doc; a silently-drifted consumer contract; a producer-ranks-for-the-consumer misstep) traced to building against a *model* of a contract that sat ratified on disk the whole time. The operating-loop **"Ground" step**, the `contract-grounding` skill (the HOW), and the DoD cross-system row are **pointers to this clause** (§7 one-home) — not co-equal restatements. **Mechanism deferred:** this is a policy/DoD convention; a hook is earned only by an observed *skip* of the doctrine (the §12/§13 pattern — `os_candidate` until then), never scaffolded ahead of a failure.

**Boundary-first.** Write the cross-system **ownership boundary before building across it** — *the producer (system of record) owns facts; the consumer owns ranking, attention, presentation, and action.* Judge cross-system work by one lens: **"does this help the consumer understand and operate?"** (N22: the boundary — producer-owns-facts/consumer-owns-ranking, don't-edit-the-sibling, don't-build-what-the-consumer-will-replace — arrived as three founder corrections *mid-phase* because it was never written first; the lens would have pre-empted all three). Complements §7 (one-home) and §8 (Waterline).

**Runtime-repro (extends §1).** Reproduce a production bug **on the running thing under realistic conditions** (e.g. real concurrency) **before** declaring a fix, and leave a **checked-in regression guard** (e.g. a post-deploy smoke). Recorded N17: a prod data-corruption bug took three iterations — two fixes from assumptions/curl, one of which (`max:1`) made it *worse* — because curl and unit tests never reproduced the concurrent-shared-connection failure; the session-pooler fix was proven only by a concurrency repro against the running thing, now guarded on every deploy.

## 16. Autonomous execution terminates at the founder boundary — the boundary is success
A `/goal` is the **maximum autonomous execution segment** toward an objective, **not the objective**. It runs the
loop continuously (§2) — unlimited parallel main-loop spawns (G9 — the main loop spawns, never the engine), build ·
verify · merge-to-dev · diagnose · learn — **up to a hard kill-switch cap** (turn/wall-clock/cost; tripping it forces
a `failure` Founder Action Package, not an infinite retry). **The moment the next *required* action can only be done by
a human** (approval · credentials · deploy-auth · manual testing · external login · legal · payment · physical ·
cross-repo) — detected as a permission-classifier denial, a missing credential (presence, never value — §1/§15), a
fail-closed gate state, or a no-tool wall — **the autonomous phase has ended SUCCESSFULLY.** The goal emits a **Founder
Action Package** (`docs/goals/FAP-<id>.md`: status · done · remaining · WHY-stopped · zero-tech steps · links ·
rollback · the exact one-line `/goal resume` command) and **terminates immediately — never waits, polls, idles, or
remains running awaiting input.** Reaching a boundary is **not "unfinished"**; the next autonomous segment is a
brand-new `/goal` after the founder acts. Per §13 this is a **mechanism+policy pair**: the `goal-stop.mjs` exit-gate is
**kernel mechanism** (thin, fires without consent, fails closed — a goal clears only on `objective_complete` or a
valid, evidence-backed FAP); the boundary taxonomy + FAP content are **governance policy**. The SDLC's HUMAN-GATED
tier (C6 greenlight · merge-to-main · prod-auth · rollback) **are** the boundaries — zero SDLC redesign. Canonical
home + the H1–H8 hardening: `capabilities/GOAL-EXECUTION-CONTRACT.md`. *(Earned 2026-06-25: a goal phrased as "merged
to main" looped its Stop-hook dozens of times because merge-to-main is a C6 human gate, never autonomously satisfiable
— the infinite-idle incident this rule kills.)*

## Reusable prompts
- **Red-team audit** — independent skeptic; classify findings **Blocker / Should-fix / Safe-to-defer**; don't implement during the audit.
- **Multi-reviewer readiness audit** — N independent lenses vote ready / ready-with-conditions / not-ready; gate the release on the conditions.
- **Independent decision-review panel** (Principle 11) — for a consequential decision, run the required role lenses **blind to each other**, collect findings + classifications, **surface every disagreement**, then consolidate; the orchestrator never concludes alone.
- **Runtime diagnostic probe** — temporary, token-gated, reports live config/env **presence** (never values) + build id; remove after root-cause.
- **Pre-registered decision review** — commit hypotheses/metrics/decision-rules/min-sample **before** the data (see `processes/pre-registered-decisions.md`).
