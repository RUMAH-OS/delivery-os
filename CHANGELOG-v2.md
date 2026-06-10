# Delivery OS v2 — what changed and why

v2 = v1's agnostic core **+** the strongest lessons from a second source project (an AI agent platform). Each change traces to evidence from one or both projects.

## Structural changes
- **Core vs domain-packs split.** v1 implicitly assumed "one public web app, launched once." v2 separates a 100%-agnostic `core/` from opt-in `domain-packs/` (web, admin, crm, contracts, invoicing, api-first, ai-product). *(Why: v1 broke on admin/CRM/API/AI projects.)*
- **launch → release.** "Launch = DNS cutover" was web-specific; v2 has `processes/deployment-governance.md` (environments, promotion, flags, canary, rollback-by-change-type) with DNS cutover demoted to one annex.
- **Lean default roster.** Lead with **Engineer / QA / Reviewer-Critic + human merge**; scale up. *(The 3-role model proved sharper than a large roster.)*
- **Consequential-decision review gate (Governance §11).** Architectural / migration / production-readiness / security-sensitive / data-sensitive decisions now require an **independent multi-agent review before any recommendation** — role lenses work blind, disagreements are surfaced, then consolidated; no single agent (orchestrator included) concludes alone. *(Why: a single-agent conclusion on a high-stakes call is exactly what the multi-agent model exists to prevent.)*

## Promoted from the AI agent platform (second source)
- **Structural author≠verifier** via CODEOWNERS — the verifier owns `tests/ e2e/ evals/` and cannot edit production code. Upgrades v1's process-only "independent QA."
- **Reviewer/Critic role** — conformance + **simplicity** + **scope-held** (anti-over-engineering, anti-scope-creep), owns no files.
- **Vertical slices + deterministic-spine-first** — small end-to-end PRs; prove the deterministic core before AI/integrations.
- **Status vocabulary** — Engineer says "ready for QA"; only QA says "verified"; only merge says "done." **Defects flow author-ward** (graders never patch).
- **Stakeholder Acceptance gate** + a **Walkthrough** template (business explanation, how-to-test, test data, expected results) — human business sign-off before merge.
- **AI-Product pillar (new):** build-time vs **runtime** agents; **evals** as a test type (golden sets, grounding=no-fact-without-source, deterministic exact-match); **determinism discipline** (deterministic logic out of the LLM path; human-gated learning); **agent-run audit**; prompts/tool-defs as owned artifacts; **graceful degradation**; **no agent performs irreversible/outward actions** (draft, never send) without human approval.
- **Pre-registered decision reviews** — commit hypotheses/metrics/decision-rules/min-sample **before** the data (anti-hindsight-bias); confirmatory vs exploratory.
- **The Waterline Rule** — keep the reusable spine variant-neutral; segment/variant logic lives above it; earn generalization with a 2nd consumer.
- **Migrations governance** — forward-only, reversible, expand→contract, **applies-clean-on-a-fresh-DB** CI check, **backup before**.
- **Ports & adapters + package-boundary contracts** — the mature form of v1's "provider-agnostic seams."

## Reinforced (converged across BOTH projects)
- **Toolchain is a slice prerequisite** — both projects lost a cycle to a missing runtime; the builder must self-verify before "ready for QA."
- **Evidence over assumptions** — both used runtime probes to root-cause; v1's "diagnostic probe" stays a first-class tool.
- **Request external credentials/accounts day one** — both gated their final mile on them.
- **Honest failure** — never a false success on any surface.

## Generalized
- **Testing** — v1's "validation harness" (a crawler) is now one instance of `processes/qa-and-testing.md` (unit/property/contract/integration/e2e/**evals**/smoke).
- **Lessons-learned → `case-studies/`** — relabeled as worked examples, not doctrine.
