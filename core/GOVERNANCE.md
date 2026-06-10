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

## 12. Verification is operationally enforced, not remembered
**Author ≠ verifier (§3) and consequential-review (§11) are real only when a mechanism — not a person's memory — fires them.** A documented principle that depends on the orchestrator *choosing* to invoke it is not a control; it is a hope. This principle exists because that exact gap let a *generated, unexecuted scaffold* be presented as progress with no independent verifier (see `case-studies/2026-06-10-author-verifier-not-operationalized.md`).

**The enforcement chain (each link is mechanical, installed by the scaffolder, fail-closed):**
- **Git is the substrate (no git ⇒ no build).** The scaffolder runs `git init` + creates `main`/`dev` and installs the gate. Without a repo, CODEOWNERS, CI, and the commit-provenance gate are inert — so implementation work (first commit touching `src/ app/ lib/ api/ migrations/ db/`) may not proceed until the repo and gate exist. Discovery, docs, and throwaway spikes are exempt — the gate never trips until implementation files change.
- **The verify-gate hook fires without the builder's consent.** A `.claude/settings.json` hook (`PreToolUse` deny on `git commit`/`git push` · `Stop` block on turn-end · `PostToolUse` baseline+warn) refuses to let a slice advance when implementation files changed without a **fresh, passing, independent** `docs/verify/VERIFY-<slice>.md`. A committed `.githooks/pre-push` (via `core.hooksPath`) backstops it for *any* git client, even outside Claude.
- **Author ≠ verifier — no-VCS fallback.** Where CODEOWNERS-on-a-PR cannot bind (no git, or a single principal playing every role), author≠verifier is satisfied **only** by a *separate verifier run* — a distinct agent invocation/session that did not author the code under test — producing the written, timestamped `VERIFY-<slice>.md`. The artifact records both identities and asserts their disjointness. Where git exists, CODEOWNERS-on-a-PR is the stronger structural form and supersedes the fallback.
- **Status is derived, never self-asserted.** A slice's `verify_status` (`planned → generated → executed → verified`) is computed from evidence (does a fresh passing independent artifact exist?), surfaced in the router, and **never hand-edited by the author**. *Generated* (code exists) and *Executed* (it ran) are not *Verified* (an independent lens confirmed it meets acceptance on its real surface). A builder may never describe a slice as "done"/"complete"/"verified" while its derived status is below `verified`.

**Honest limit (stated, not hidden).** A hook can enforce that a fresh, passing, independence-*claimed* artifact **exists**; it cannot prove the verification was *truthful* or genuinely independent inside a single-agent runtime. The hook raises the cost of faking to deliberate; it does not make honesty automatic. The committed `pre-push` hook + CODEOWNERS-on-a-real-PR-with-a-second-reviewer remain the only fully model-independent layers — which is why git (§12 link 1) is mandatory, not advisory.

## Reusable prompts
- **Red-team audit** — independent skeptic; classify findings **Blocker / Should-fix / Safe-to-defer**; don't implement during the audit.
- **Multi-reviewer readiness audit** — N independent lenses vote ready / ready-with-conditions / not-ready; gate the release on the conditions.
- **Independent decision-review panel** (Principle 11) — for a consequential decision, run the required role lenses **blind to each other**, collect findings + classifications, **surface every disagreement**, then consolidate; the orchestrator never concludes alone.
- **Runtime diagnostic probe** — temporary, token-gated, reports live config/env **presence** (never values) + build id; remove after root-cause.
- **Pre-registered decision review** — commit hypotheses/metrics/decision-rules/min-sample **before** the data (see `processes/pre-registered-decisions.md`).
