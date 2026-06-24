# Agent Catalog Review — gaps, overlaps, and an optimal structure for parallel execution (2026-06-24)

> Goal: review the agent catalog; find missing specialists that would improve parallel execution across
> Delivery OS · Admin · PLOS; recommend additions, overlaps, consolidations, and an optimal lifecycle structure
> (research · planning · implementation · verification · rollout · operations).
> Grounded in the on-disk catalog (`delivery-os/agents/`) AND this session's lived use of ~20 spawned agents.

## The #1 finding: there are TWO diverging catalogs
| | On disk (`delivery-os/agents/`, 16 roles) | Spawnable this session (harness types) |
|---|---|---|
| Core build | software-engineer · qa-test · reviewer-critic · lead-architect · documentation · integration-architect | ✅ all present |
| Coordination | **project-manager** (DoD gate, sequencing) | ❌ not spawnable |
| Rollout/ops | **deployment-operator** (deploys + migrations) | ❌ not spawnable |
| Domain packs | **domain--security-compliance · database-data · api-integration · ai-product** | ❌ none spawnable |
| Optional | accessibility · design-parity · seo | ❌ not spawnable |
| UX | *(absent on disk)* | ✅ **founder-experience-reviewer** (only in the harness) |
| Utility | — | Explore · general-purpose · Plan · claude · claude-code-guide |

**Consequence (measured this session):** because the domain/ops/PM agents weren't spawnable, I used **`general-purpose` as a catch-all ~8 times** — for the privacy/GDPR §11 lens, the database/migration analysis, the engine internals, regressions, decisions, and the trigger taxonomy. Each of those *has a designed specialist on disk* that would have brought sharper, role-primed judgment. **The catalog is well-designed but under-surfaced** — the single highest-leverage fix is to make the on-disk roles spawnable and reconcile the two lists into one source of truth.

## Missing specialists (gaps I hit directly)
| Missing agent | Why (evidence from this session) | Lifecycle |
|---|---|---|
| **workflow-engine specialist** | I spawned `general-purpose` 3× for engine internals (enqueue/tick/verify/gate/state-machine, the always-block-gate gap, the trigger lifecycle). The engine is the *platform's core* — it deserves a primed specialist, not a generalist. | implementation/verification |
| **operations / SRE** | The EMAXCONN pool cap, the transaction-pooler fix, the heartbeat/cron, connection-budget reasoning — runtime health, distinct from `deployment-operator` (which does *deploys*). No agent owns "is the running system healthy + performant." | operations |
| **privacy / DPIA** (or a sharpened security-compliance) | The contact-ownership §11 had a dedicated privacy lens (lawful basis, purpose limitation, DPIA, crypto-shred) I ran via `general-purpose`. `domain--security-compliance` covers PII broadly but GDPR/DPIA deserves explicit depth. | verification |
| **cost / quota governor** | Discovery's external-AI/search cost was a real decision factor (AD-5); LLM spend has no owner. | planning/operations |
| **research-synthesist** (beyond Explore) | `Explore` is *search*; the deep multi-source syntheses I ran (ecosystem model, trigger taxonomy) used `general-purpose`. A research role (the `deep-research` skill as its playbook) would standardize fan-out→cited-synthesis. | research |
| **release-readiness** (panel runner) | I ran rollout planning via `lead-architect`; the `production-readiness-review` skill wants an owner that runs the go/no-go panel + owns the rollout artifact. | rollout |

## Overlaps (clarify the boundary or consolidate)
- **`general-purpose` ↔ every domain specialist.** The catch-all overlaps *all* of them. Fix: surface the specialists so `general-purpose` is the genuine residual, not the default.
- **`integration-architect` ↔ `domain--api-integration`.** Real overlap: the former owns *the specific Admin↔PLOS seam*; the latter owns *general API-contract discipline*. For a single-seam ecosystem like this, **fold api-integration into integration-architect**; split again only if a second independent seam appears.
- **`qa-test` ↔ `reviewer-critic`.** Complementary, not redundant (functional PASS/FAIL vs conformance+simplicity+scope) — keep both, but make the handoff explicit (QA gates first, then reviewer-critic). This pairing worked well this session.
- **`lead-architect` ↔ `Plan` ↔ `project-manager`.** Three "planning-ish" roles: shape/order (lead-architect) vs read-only step-plan (Plan) vs DoD/sequencing/flow (project-manager). Keep lead-architect + project-manager as distinct (design vs flow); treat `Plan` as a *mode* of lead-architect, not a separate standing agent.
- **`deployment-operator` ↔ a new operations agent.** Deploy-time vs run-time. Keep separate: deployment-operator *ships*; operations *watches the running system*.

## Consolidation opportunities
1. **One catalog, one source of truth.** Merge the harness-spawnable list and `agents/` — every on-disk role spawnable; `founder-experience-reviewer` added to `agents/` (it's load-bearing and currently catalog-orphaned).
2. **Fold `api-integration` → `integration-architect`** (single-seam ecosystem).
3. **Optional packs stay opt-in** (accessibility, design-parity, seo) — attach by surface, not by default (correct as-is).
4. **`Plan` → a mode of lead-architect**, not a standing type.

## Optimal agent structure by lifecycle (with the parallelism pattern)
| Phase | Lead | Parallel specialists (fan-out) | Pattern |
|---|---|---|---|
| **Research** | research-synthesist *(new)* | Explore (broad search) ∥ domain readers ∥ founder-experience-reviewer | fan-out per subsystem → cited synthesis (as done: 5-repo map, trigger taxonomy) |
| **Planning** | lead-architect | **principle-11 panel** (≥2 blind lenses + reviewer-critic) ∥ database-data ∥ security-compliance ∥ cost-governor | blind-parallel decision lenses, consolidate without pre-concluding (the AD-1 §11 panel — 7 lenses) |
| **Implementation** | software-engineer | database-data ∥ integration-architect ∥ ai-product ∥ design-parity ∥ workflow-engine *(new)* | **file-disjoint parallel** (Slice A+B); **worktree isolation** when files overlap |
| **Verification** | qa-test (functional gate) | reviewer-critic (conformance) ∥ security-compliance (PII/money) ∥ founder-experience-reviewer (UX) | **author≠verifier**, blind-parallel lenses; QA gates → reviewer-critic verdict (used all session) |
| **Rollout** | release-readiness *(new)* / deployment-operator | production-readiness panel ∥ security-compliance sign-off | go/no-go panel → in-scope deploy (deploy-lane); shadow→measured→trusted |
| **Operations** | operations/SRE *(new)* | workflow-engine (triggers) ∥ cost-governor ∥ documentation (incident ledger) | autonomous engine + heartbeat; human only at approvals (the self-operating target) |

**Standing coordinator: `project-manager`.** This session I *was* the coordinator (decompose → fan-out → consolidate → resolve conflicts → verify). That role should be an explicit, spawnable agent that owns the DoD gate and the fan-out/consolidate loop, so the orchestration is repeatable rather than ad-hoc.

## Concrete recommendations (ranked by leverage)
1. **Surface all on-disk agents as spawnable + reconcile the two catalogs** (one source of truth). *Highest leverage — it removes the `general-purpose` bottleneck and unlocks true domain parallelism.*
2. **Add 3 agents:** `workflow-engine` (the platform core), `operations/SRE` (runtime health), `research-synthesist` (Explore is only search). Each maps to an existing skill as its playbook.
3. **Promote `project-manager` to the standing coordinator** (DoD + fan-out/consolidate) and add `founder-experience-reviewer` to the canonical catalog.
4. **Sharpen verification into a standing parallel panel** (qa-test ∥ reviewer-critic ∥ security-compliance ∥ FX) with author≠verifier — formalize what worked ad-hoc this session.
5. **Fold `api-integration` into `integration-architect`** for now; add `cost-governor` and `release-readiness` when spend/cutover frequency justifies them.

## Parallel-execution playbook (what made it work this session — codify it)
- **Decompose into file-disjoint tasks**; one specialist per task; spawn in one message → true parallelism.
- **Lock the contract first** (the coordinator's job) so parallel builders don't diverge (the `{invoiceIds, tenantId}` contract for Slice A+B).
- **Structured-output briefs** per agent (per-claim table / verdict schema) so consolidation is mechanical, not interpretive.
- **author≠verifier always** — the builder never grades its own work (a different agent QAs; reviewer-critic gives the conformance verdict).
- **Worktree isolation** only when parallel builders touch overlapping files (file-disjoint avoids the no-`node_modules` worktree problem in a pnpm monorepo).
- **Coordinator consolidates + runs the authoritative verification once** (full typecheck + regression) — don't trust per-agent self-checks alone.

## Honest limits
- This review is grounded in *this session's* workload (research/planning/implementation/verification heavy; light on live rollout/operations) — the rollout/operations recommendations are inferred from the gaps, not from running those agents.
- The two-catalog reconciliation is a governance change to the framework's `agents/` + the harness registration; sequence it through the normal slice/verify path.
