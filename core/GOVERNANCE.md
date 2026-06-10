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

## 8. The Waterline Rule (reuse without lock-in)
The reusable **spine stays variant-neutral** — it never imports a segment/customer/variant assumption. Variant-specific logic lives **above the waterline**. Earn generalization only when a **second** consumer pulls for it (no premature platform; no speculative scaffolding).

## 9. De-risk early
Front-load the riskiest unknowns: ship a thin vertical slice to the **real target environment** (deploy + CI run + one real end-to-end transaction) in Phase 1–2. Request external credentials on day one. Provision the toolchain before the first build so the builder can self-verify.

## 10. Commit & scope discipline
One slice → ≥1 dedicated commit (what + why + slice id); commit history is an artifact (referenced by hash in `project-log.md`). Hold scope — the Reviewer/Critic rejects anything "smuggled in" beyond the slice. Know your platform's deploy gotchas and keep them in the deployment runbook.

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

## Reusable prompts
- **Red-team audit** — independent skeptic; classify findings **Blocker / Should-fix / Safe-to-defer**; don't implement during the audit.
- **Multi-reviewer readiness audit** — N independent lenses vote ready / ready-with-conditions / not-ready; gate the release on the conditions.
- **Independent decision-review panel** (Principle 11) — for a consequential decision, run the required role lenses **blind to each other**, collect findings + classifications, **surface every disagreement**, then consolidate; the orchestrator never concludes alone.
- **Runtime diagnostic probe** — temporary, token-gated, reports live config/env **presence** (never values) + build id; remove after root-cause.
- **Pre-registered decision review** — commit hypotheses/metrics/decision-rules/min-sample **before** the data (see `processes/pre-registered-decisions.md`).
