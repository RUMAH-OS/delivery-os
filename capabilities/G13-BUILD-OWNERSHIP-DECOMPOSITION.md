# G13 — Build Ownership Decomposition (one programmer + advisors → specialist ownership, 2026-06-15)

> Founder question: are we still "one general-purpose programmer (Claude) + advisors," or true specialist
> ownership? The Build area is 🟡 (55.9% Claude). Should build be decomposed much more aggressively into
> specialist-owned execution? Runtime-backed analysis demanded. Hypothesis: *agent existence solved → agent
> adoption in progress → the next step is agent OWNERSHIP.*

## Headline (evidence): we have "TWO programmers + advisors," not specialist ownership
Of **1,090 code/Build mutations** (`scripts/build-ownership-probe.mjs`, 99.5% meta.json attribution, 2026-06-10→15):
- **Claude (main-loop): 53.1%**
- **Builder agents: 41.0% — but ~all ONE agent:** software-engineer **37.2%**, frontend-engineer 1.5%, general-purpose 2.4%
- **Reviewer/advisor agents: 5.9%** (all qa-test, incidental)

So build IS distributed off Claude to a builder — but to **one general builder (software-engineer)**, not to
**specialists**. The specialist builders are idle on build: **frontend-engineer 1.5%**, **integration-architect 0**,
**database-data 0**, **api-integration 0**. Every reviewer/architect agent made **0** code mutations (correct —
they advise). Verdict: not "one programmer + advisors" (there's a real builder agent), but **"Claude + one
general builder + advisors"** — build ownership is *concentrated*, not *decomposed by specialty*. The founder's
hypothesis holds: existence ✓, adoption partial, **specialist ownership not yet achieved**.

## 1. Current build-task distribution (per-agent-type, code category)
| Actor | Role | code-mut | % of all code |
|---|---|---|---|
| Claude (main-loop) | orchestrator-building | 579 | 53.1% |
| software-engineer | BUILDER (general) | 405 | 37.2% |
| qa-test | reviewer (incidental) | 64 | 5.9% |
| general-purpose | catch-all | 26 | 2.4% |
| frontend-engineer | BUILDER (FE) | 16 | 1.5% |
| integration-architect · database-data · api-integration | BUILDER/architect | **0** | 0% |
| all reviewers/architects (10 types) | advisor | 0 | 0% |
- Productivity (code-mut/invocation): software-engineer **9.0**, frontend-engineer **8.0** (high when used — not a quality problem, a USAGE problem), qa-test 0.74, general-purpose 0.17.
- Other categories: **test 57.4% agent** (qa-test owns it ✅), **knowledge-docs 28.4% agent** (Claude-dominated — G12).

## 2. Candidate ownership model
- **What should move from Claude:** the 53% Claude direct code-writing — split by specialty to the existing builders.
- **Underutilized agents (exist, idle on build):** frontend-engineer (1.5%), database-data (0), integration-architect (0, but it's an *architect/advisor*, not a builder — its build output is a contract/seam, owned then built by software-engineer), api-integration (0).
- **Missing roles:** essentially NONE for build — software-engineer is the de-facto backend engineer; frontend-engineer covers FE; database-data covers migrations. The founder's example "Backend Engineer" = today's software-engineer (optionally rename for clarity). **The gap is ROUTING + USAGE, not missing agents** — consistent with "the goal is not more agents."

## 3. Multi-agent execution model (which agents auto-participate per slice type)
The load-bearing change: the BUILD step routes to a **specialist BUILDER**, with Claude orchestrating the chain (not writing the code), and author≠verifier preserved (builder ≠ verifier).
- **Frontend slice:** frontend-architect (shape) → **frontend-engineer (BUILD/own)** → ux-reviewer (craft) → founder-experience-reviewer (runtime) → qa-test (verify) → reviewer-critic (conformance).
- **Backend/API slice:** lead-architect / integration-architect (shape + seam contract) → **software-engineer (BUILD/own)** → security-compliance (if auth/money/PII/e-sign) → qa-test (verify) → reviewer-critic (conformance).
- **Migration/data slice:** lead-architect (shape) → **database-data (BUILD/own the migration)** → qa-test (verify) → security-compliance (if PII).
- **Workflow slice:** workflow-reviewer + customer-journey-reviewer + product-designer (design) → **software-engineer/frontend-engineer (BUILD/own)** → qa-test (verify).
- **Knowledge slice:** **knowledge-engineer (own/draft)** → independent verifier (qa-test/reviewer-critic) → founder ratifies.

## 4. Adoption proof — OWN vs merely REVIEW (telemetry)
- The split already exists in `build-ownership-probe.mjs`: **builder-agent code-mutations vs reviewer code-mutations vs Claude.** Ownership transfer = **Claude's code share ↓ AND specialist-builder share ↑** (not reviewer share — reviewers reviewing more is not ownership).
- **New standing dimension** (Operating-Model Check v3): split the Build area three ways — **Claude / specialist-builder / general-builder/reviewer** — and per-specialty (FE→frontend-engineer, BE→software-engineer, data→database-data). Target: specialist-builder-led; Claude trends down.
- Per-slice signal: did a BUILDER agent author the slice's code, or did Claude? Track "Claude-authored build slices" vs "agent-authored build slices" over time. **Built ≠ Owned: an idle frontend-engineer that exists is not ownership** (the G12 principle, applied to build).

## 5. Operating-Model impact (projected)
- Today: Build = Claude 53% / agents 47% (of which specialists ~3%, general builder 37%, reviewers 6%).
- If Claude routes substantial build to specialists instead of writing inline: Build agent-share can realistically reach **80–85%** (not 100% — trivial edits, gate wiring, probes, and orchestration glue legitimately stay inline). **55.9% → 80%+ is achievable**, BUT the number alone is insufficient: the win is the **specialist split** (frontend-engineer, database-data, api-integration moving off 0), not just shifting more to software-engineer. A Build area that hits 85% agent but is still 80% one general builder has NOT decomposed.

## 6. Guardrails — permanent Claude responsibilities / never delegated
**Stays with Claude (orchestrator):** routing · prioritization · conflict resolution · founder interaction ·
validation/ratification · cross-context synthesis · dispatch decisions · *which agent owns a slice*.
**Never delegated:** author≠verifier enforcement (an agent never self-certifies; Claude/founder ratifies) ·
security/money/legal/e-signature final sign-off (founder) · the orchestration loop itself · consequential
architectural decisions (§11) · the decision to create/spawn agents · production cutover/irreversible go-no-go.

## G13 plan + proof requirements (added to the V6 backlog)
**Gap:** build ownership is concentrated (Claude + one general builder); specialists idle. **Goal:** decompose
build into specialist-owned execution; Claude orchestrates, does not build.
- **P1 — Build-ownership telemetry (verify the probe first).** `build-ownership-probe.mjs` is currently
  UNVERIFIED (the prior probe had a categorization bug a verifier caught — do not trust until independently
  verified). Verify it, then add the **Build-ownership dimension** (Claude / specialist-builder / general /
  reviewer, per-specialty) to the standing Operating-Model Check.
- **P2 — Routing discipline.** Claude routes substantial frontend build → frontend-engineer, migrations →
  database-data, API/seam build → software-engineer (after integration-architect's contract); trivial edits
  may stay inline. Measured, not asserted.
- **P3 — Specialists move off 0.** frontend-engineer, database-data, api-integration show non-trivial,
  USED-with-material-effect build mutations (Built ≠ Owned).
- **P4 — Measured shift.** Build area trends 55.9% → 80%+ agent on the standing check, AND the specialist
  split widens (not all to software-engineer).
- **P5 — author≠verifier preserved.** Builder ≠ verifier on every build slice.
**Decoupled from PLOS** (Admin-internal completeness item). **Not more agents — more specialist ownership of
the agents we have.**
