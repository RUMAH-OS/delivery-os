# Case study: Property Lead OS (`ai-product` + `crm`)

An AI agent platform (a monorepo: web/worker/browser-worker apps; db/core/queue/scoring/agents/browser/integrations packages). The source of most of v2's new pillars.

## Pack & roster (the lean model that became the v2 default)
`ai-product` + `crm` + `api-first`. **Three build-time agents** — Engineer (builds) / QA (validates, owns `tests/ e2e/ evals/`) / Reviewer-Critic (verdicts, no files) — **+ human merge**. CODEOWNERS enforces author≠verifier structurally.

## Patterns this project contributed to v2
- **Structural author≠verifier** via CODEOWNERS (disjoint code/test trees).
- **Reviewer/Critic** — conformance + simplicity + **scope-held** ("nothing smuggled in").
- **Vertical slices + deterministic-spine-first** — slice 1 was "capture → deterministic score → dashboard," **no AI**, proving the spine before any agent.
- **Status vocabulary** ("ready for QA" / "verified" / "done") + **defects flow author-ward**.
- **Stakeholder (Founder) Acceptance Test** + a structured Walkthrough before merge.
- **AI-Product pillar:** `evals/` golden sets + **grounding** (no fact without a source); **determinism** (the scorer is pure code, never the LLM); **agent-run audit** (model/tokens/cost/tools); **no agent has a send tool** (drafts only; human sends); graceful degradation (partial dossier on provider failure).
- **Pre-registered learning review** — hypotheses/metrics/decision-rules/min-N committed before any outreach outcome (anti-hindsight-bias; learning stays human-gated).
- **The Waterline Rule** — segment-specific (EPC) logic above the line; the data/CRM spine below stays segment-agnostic.

## Converged lesson (with Rumah)
Its slice-1 postmortem hit the **same** "toolchain not provisioned → builder couldn't self-verify → QA caught build bugs" failure — independent confirmation that toolchain-as-prerequisite belongs in the framework.
