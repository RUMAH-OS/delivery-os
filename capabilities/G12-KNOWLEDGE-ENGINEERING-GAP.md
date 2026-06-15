# G12 — Knowledge Engineering Ownership Gap (orchestrator-vs-worker review, 2026-06-15)

> Founder question: have we distributed *ownership* into agents, or only distributed build/review work
> while **Claude remains the knowledge & documentation operator**? Target operating model:
> `Founder → Claude (orchestrator/decision layer) → Agents → Skills → Knowledge Layer → Execution`,
> with Claude doing LESS direct work over time. Runtime evidence demanded, not philosophy.

## Headline (honest, evidence-backed): the hypothesis is CONFIRMED
We distributed **reviews** (agent-led ✅) and made **reporting tool-automated** (⚙ ideal). We did **NOT**
distribute **documentation** (🔴 86.6% Claude) or **knowledge management** (🔴 98% Claude), and **build** is
only **🟡 partly** delegated (44% agent). Claude is correctly the **router** (Routing 100% Claude ✅). Net:
*agents own review; the OS automates reporting; but Claude is still the Documentation + Knowledge operator.*

> **Number correction (the probe self-corrected under independent verification):** an initial run reported
> knowledge-docs as **85.5%** Claude. The verifier caught a categorization bug (`includes('verify')` silently
> diverted `docs/**/VERIFY-*.md` knowledge docs into the `test` bucket, asymmetrically). Corrected:
> **knowledge-docs ≈ 71.4% Claude** at the file-category level. The role-area view below (the canonical,
> standing format) is the trustworthy evidence.

## Runtime evidence — the standing role-area table (`scripts/operating-model-check.mjs --json`, independently verified)
Mutation tool-calls (Write+Edit+NotebookEdit) by actor, mapped to the founder's six role-areas. Corpus
2026-06-10→15, ~43.8k transcript lines, 0 skipped. `claude` = main-loop; `agent` = dispatched subagents.

| Area | Claude | Agents | Target | Status |
|---|---|---|---|---|
| Build Work | 487 (55.9%) | 384 (44.1%) | Agent-led | 🟡 YELLOW |
| Reviews | 45 (27.8%) | 117 (72.2%) | Agent-led | ✅ GREEN |
| Documentation | 168 (86.6%) | 26 (13.4%) | Agent-led | 🔴 RED |
| Knowledge Management | 150 (98%) | 3 (2%) | Agent-led | 🔴 RED |
| Reporting | TOOL-AUTOMATED (0 hand-edits) | | Agent-led | ⚙ AUTOMATED (ideal) |
| Routing / Coordination | 1549 (100%) | 0 (0%) | Claude-led | ✅ GREEN |

Overall mutation split: Claude 61.6% · Agents 38.4%.
- **Load-bearing findings:** Reviews ✅ (agents own it) · Routing ✅ (Claude is the router) · Reporting ⚙
  (machine-generated — better than agent-owned) · **Documentation 🔴 + Knowledge Management 🔴** (the real gap).
- Routing counts ONLY orchestration (main-loop Agent-dispatch + TodoWrite + claude-Bash); agent sandbox-Bash
  (3,300+ calls) is correctly EXCLUDED, else agents would falsely appear to out-coordinate Claude.
- Caveat: counts tool CALLS, not lines/volume; main-loop totals include orchestration overhead. The *role-area
  split* is the load-bearing signal, and Knowledge Management at 98% Claude is unambiguous.

## The 7 questions, answered
1. **Still predominantly Claude:** knowledge-docs (85.5%) — ADRs, retrospectives, lessons, memory, reports,
   capability docs, board-synthesis, KU authoring, gap reports; plus ~54% of code and the bulk of git/commit/
   slice orchestration (988 Bash).
2. **Write/edit split:** 58.9% Claude / 41.1% agent overall; **85.5% Claude for knowledge-docs**, 54.5% Claude
   for code, 39% Claude for test.
3. **Should Knowledge Engineering be first-class with a dedicated owner/agent?** **YES.** It is the single
   least-distributed category and the exact work the founder wants to reduce — and the new Knowledge Capability
   (KU creation/promotion/citation-hygiene/dormancy-cleanup) needs an owner that is not Claude.
4. **Should lesson-promotion / ADR-generation / wiki-maintenance / memory-cleanup / KU-creation / capability-
   docs be owned by a Knowledge Engineer?** **YES — with a sharp line.** Delegate the **drafting + maintenance**
   (KU bodies, ADR prose, retro/lesson extraction, memory dedup/cleanup, wiki upkeep, capability-doc updates).
   Claude **retains the DECISION layer**: *what* to promote, architectural calls, board-synthesis that needs
   whole-context judgment, and ratification. The honest nuance: today's 431 Claude knowledge-writes conflate
   **decisions that legitimately stay** with **drafting/maintenance that should move** — the goal is to move the
   latter, not drive the number to zero.
5. **Target operating model:** `Founder → Claude (routes/decides/ratifies/dispatches) → Agents
   (software-engineer builds · qa-test verifies · **knowledge-engineer authors+maintains knowledge** ·
   documentation owns the project log) → Skills → Knowledge Layer → Execution`. Claude's residual direct work:
   dispatch decisions, ratification, last-resort cross-context synthesis, and (optionally) commit orchestration.
6. **Risks of moving too aggressively:**
   - **Document-graveyard / shallow KUs** — an agent with narrow context writes inconsistent or thin knowledge
     (the exact thing the founder said he does NOT want). Mitigate: KUs go through the citation/quality bar +
     promotion gate, not raw append.
   - **author≠verifier collapse** — if the knowledge-engineer authors AND self-certifies, a *wrong KU* (a
     trusted wrong fact — worse than prose, per the board's "adoption≠correctness") propagates. Mitigate:
     independent verification/ratification of promoted knowledge stays mandatory.
   - **Orchestration overhead** — dispatching for a one-line back-link is slower/costlier than inline. Not
     everything should be delegated; trivial edits stay inline.
   - **Loss of orchestrator situational awareness** — if Claude never touches knowledge, it loses the context
     to route well. Keep Claude in the decision loop.
   - **Goodhart** — "Claude does less" can be gamed by trivial delegation. Measure *category share* + outcome,
     not raw delegation count.
7. **Proof that Claude became an orchestrator (not the primary worker):** a **measured, declining trend** in
   Claude's knowledge-docs mutation share (re-run `actor-activity-probe.mjs` per milestone); a
   `knowledge-engineer` agent with **adoption evidence** (USED + material-effect, not idle) owning KU/ADR/memory
   mutations; agent-driven-mutation ratio trending up; and the standing question applied to the orchestrator:
   *"Did Claude DECIDE, or did Claude DO?"*

## G12 backlog item — Knowledge Engineering as a first-class owned capability
**Gap:** Knowledge Engineering is unowned-by-agents; Claude is the knowledge operator (85.5% runtime).
**Proposed owner:** a new `knowledge-engineer` agent (drafts/maintains; never self-certifies).
**Proof requirements (Built→Triggered→Used→Influenced→Trusted→Enforced + measured shift):**
- **P1 Built+routable:** `knowledge-engineer` agent exists, registered, and `agent-route` deterministically
  selects it for KU/ADR/memory/promotion/wiki tasks (selection-log evidence).
- **P2 Used (not idle):** it owns ≥1 real knowledge mutation end-to-end (promotes a lesson→KU OR drafts an
  ADR) with agent-health USED + material-effect evidence.
- **P3 author≠verifier preserved:** the promoted knowledge is independently verified/ratified; a deliberately
  wrong KU is caught (adversarial test) — knowledge defects do not propagate.
- **P4 Measured shift (the load-bearing proof):** `actor-activity-probe.mjs` becomes a **standing milestone
  report section**, and Claude's knowledge-docs mutation share **declines** against a target (baseline 85.5%
  → < 50% as the capability matures; the *decision* residual may legitimately plateau — report it honestly).
- **P5 Enforced:** knowledge-mutation tasks route through the knowledge-engineer by default (or, at minimum,
  the split is measured + reported every milestone so regression surfaces). Built ≠ Adopted — the agent must
  affect the ratio, not merely exist.
**Decoupled from PLOS** (same logic as Knowledge Adoption C5 — Admin-internal completeness item).
**NOT a mandate to delegate everything:** decision/synthesis/ratification stay with the orchestrator; the
target is to move drafting+maintenance and prove the move with the probe.

## Target-state role distribution (founder-defined; the goal is ROLES, not a % for its own sake)
| Role | Owns |
|---|---|
| **Claude / Orchestrator** | routing · prioritization · conflict resolution · founder interaction · validation/ratification · cross-context synthesis-of-last-resort |
| **Agents** | implementation · testing · reviews · documentation · knowledge management · migrations · wiki maintenance · skill/knowledge promotion · report generation |
Mapped to the six areas: Build/Reviews/Documentation/Knowledge-Management/Reporting → **Agent-led**;
Routing/Coordination → **Claude-led**. Today: Routing ✅, Reviews ✅, Reporting ⚙automated; Build 🟡; the two
RED areas (Documentation, Knowledge Management) are the work of G12.

## The standing Operating-Model Check (BUILT + WIRED this slice — not a one-time review)
`scripts/operating-model-check.mjs` (independently verified, `verify_status: verified`) emits the table above
+ `--json` + Green/Yellow/Red against the role-targets, fail-closed on UNMEASURED. It is wired REPORT-ONLY into:
- **`slice-close`** → every slice record now embeds a `## Operating-Model Check` region (after EVERY slice).
- **`milestone-report`** → an OPERATING-MODEL CHECK section (after every milestone), never an `overallVerdict` input.
- Available to gap-report reruns + the completion report (before declaring a capability complete).
It is **report-only** today (a RED area never fail-closes — orchestrator-decision slices are legitimately
Claude-heavy). `--block` exists to HARD-GATE (exit non-zero if any agent-led area is RED) when the founder
chooses to enforce. The purpose: make drift back toward `Founder → Claude → Execution` **visible every slice**.

## New operating principle (added to the V6 standard)
**Agent Exists ≠ Agent Owns The Work.** Alongside *Exists ≠ Used* and *Built ≠ Adopted*: a registered agent
is not ownership. Ownership is proven only when the role-area telemetry shows the agent ACTUALLY does the work
(the area moves toward its target), measured every slice/milestone by the standing Operating-Model Check.

## G12 status
Measurement + standing check: **BUILT + VERIFIED + WIRED** (this slice). The OWNERSHIP MOVE itself
(knowledge-engineer agent owning Documentation + Knowledge Management) is the **open** work, gated on founder
ratification of the new agent. Proof = the two RED areas trend toward GREEN on the standing check, with the
agent showing adoption evidence (USED + material-effect), author≠verifier preserved on promoted knowledge.
