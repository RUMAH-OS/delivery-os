# OS v6 Review & Redesign — Charter (LOCKED basis)

> Founder-mandated (2026-06-14). The complete, locked basis for the v6 review. The review runs against THIS — not
> the most recent discussion alone. **North star: a system that gets EASIER to operate as it learns.** If learning
> produces more process instead of more capability, v6 has failed regardless of how much doctrine it contains.

## 0. The standard v6 is judged by (NOT "more documentation")
Building → integrating → deploying → validating → operating must feel **materially smoother** than v5. Concretely:
fewer bugs · fewer surprises · fewer seam mismatches · fewer late decisions · fewer handoffs · less coordination
overhead · clearer ownership · stronger specialization · better skill reuse · more automation · better workflow
validation · **lower founder burden**. **Every proposed asset must SUBTRACT** (a rule, a manual step, a doc) — not
only add. More doctrine / markdown / process / verification artifacts = failure, not progress.

## 1. The complete lesson corpus (first concern → most recent — review as ONE synthesis, not isolated incidents)
founder burden · deployment ownership · integration ownership · seam mismatches · late discovery of issues ·
prod-vs-dev confusion · handoff quality · founder readiness · repeated coordination overhead · HTML-vs-text
mismatch · contract mismatches · event-shape mismatches · excessive runbooks · too much manual setup · process
accumulation · insufficient conversion of learning→capability · underuse of skills · underuse of specialized
agents · underuse of automation · CLAUDE.md growth · kernel growth · wiki flow · knowledge extraction · cross-repo
ownership gaps · workflow-validation gaps.

**The crystallized root (founder's own, and correct): the OS validates COMPONENTS, not WORKFLOWS — cross-system
validation happens too late.** Local correctness is gated + owned (engineer→verifier per slice); the end-to-end
workflow is gated by no one and owned by no one, so it integrates for the first time at the latest, most expensive
point — the founder, at live validation.

## 2. Scope — cross-portfolio; ingest BEFORE concluding
Read-only ingest of the major assets of ALL repos before any conclusion: **PLOS + Admin + delivery-os** —
CLAUDE.md · kernels · memories · ADRs · roadmap decisions · learning reviews · verification doctrine · operating
procedures · wiki content. Goal = preserve the valuable, CONVERT into a more effective model — not discard.
**Memory + learning systems are explicitly preserved.**

## 3. The panel — a deliberate multi-agent group (NOT a single perspective)
Run as a multi-agent WORKFLOW (founder-authorized). Each is an independent lens; findings are reached blind of each
other; the orchestrator points + synthesizes but does not conclude alone; **the founder is the merge-gate** (§11
discipline, broadened). Required participants:
OS Architect · Systems Architect · Workflow Architect · Integration Architect · Deployment/DevOps Architect ·
Documentation & Knowledge Architect · Founder-Experience Reviewer · Agent-Systems Architect · Skills-Architecture
Specialist · Automation Architect · Verification & Quality Architect · Product/UX Architect · **AI-Systems
Architect** · Organizational-Design Reviewer.
*(AI-Systems Architect is explicitly required to answer: are we using modern agent capabilities effectively, or
still operating as Engineer+Verifier with process layered on top?)*

## 4. Methodology — structural, not incidental; ruthless
Do NOT focus on individual mistakes — focus on **why those mistakes were able to exist** and survive to late
validation. For EVERY significant friction point in the corpus:
`what happened · when discovered · who should have owned it · why it wasn't caught earlier · what capability was
missing · should it become a skill / agent responsibility / automation / wiki playbook / gate?`
Then:
- **Cluster into recurring patterns:** seam · integration · deployment · founder-handoff · late-stage design ·
  coordination overhead · verification gaps.
- **≥3× census:** any knowledge/workflow repeated three or more times → a candidate for skill / automation / agent
  responsibility / reusable workflow.
- **Separate STRUCTURAL from INCIDENTAL** — redesign the structural; let the incidental go.
- For every lesson, ask **"how does this become capability?"** — never default to "add a rule / memory / kernel
  section / CLAUDE.md paragraph."

## 5. External comparative research (study, do NOT copy)
github.com/ruvnet/ruflo · github.com/addyosmani/agent-skills · and other relevant state-of-the-art agent operating
systems, orchestration frameworks, workflow systems, memory systems, capability systems. For each: **what they do
better · what we do better · what to adopt · what to reject · what to invent for our environment.**

## 6. The 15 questions the review must answer
1. What made v5 successful? 2. What made v5 frustrating? 3. What created bugs? 4. What created rework? 5. What
created coordination overhead? 6. What created founder burden? 7. What created seam failures? 8. What should become
skills? 9. What should become agent responsibilities? 10. What should become automation? 11. What should move to
the wiki? 12. What should be removed from CLAUDE.md? 13. What should be removed from the kernels? 14. What should
become a formal gate? 15. What should be measured?

## 7. Deliverables (a migration PATH, not just a critique)
OS v6 architecture proposal · updated README · updated agent model · updated skills model · updated knowledge model ·
CLAUDE.md strategy · kernel strategy · wiki strategy · **Founder-Ready gate spec** · **Integration-ownership
model** · **Deployment-ownership model** · v5→v6 migration guide · **a dedicated migration/update AGENT** that
upgrades existing repositories (incl. PLOS) v5→v6. Plus a **"what we REMOVED and where it went" ledger** (proof of
extraction) and the **founder-burden baseline+target measurement** (§0).

## 8. Acceptance (two hard tests)
(i) **Measurable burden reduction** vs a v5 baseline — count founder manual steps / terminal commands /
env-token-migration actions / cross-repo coordinations / decisions for a representative slice (baseline candidate:
invoice delivery); v6 must drop it toward "open URL → click → expect X". (ii) **Materially smoother** execution per
§0. If shipping is not noticeably smoother, v6 has not solved the problem.

## 9. DIRECTIONAL MANDATE (locked, definitive — not an optional experiment)
**Central problem v6 exists to fix: knowledge accumulates faster than capability.** v5 became excellent at memory,
documentation, doctrine, reviews, process, verification artifacts — and weak at turning lessons into skills, agent
capabilities, automation, reusable workflows, executable knowledge. **v6 must correct that imbalance.**
- **Target routing for every lesson:** `→ skill · → agent responsibility · → automation · → workflow · → wiki
  playbook · → REMOVAL of obsolete process`. NOT the v5 default (`→ memory · → CLAUDE.md · → kernel · → process`).
- **Challenge every accumulated asset** (rule, doc, memory, kernel section, checklist, doctrine item): *Can this
  become a skill? an agent responsibility? automation? a wiki page? — and what can now be REMOVED?*
- **Direction (mandated, substantial):** **skill-first · agent-first · wiki-first**, inspired by the strongest
  ideas in Ruflo, Agent Skills, and other best-in-class systems — adopt aggressively where they beat us.
  Concretely: less reliance on massive CLAUDE.md / growing kernels / accumulated process; more skills, specialized
  agents, workflow ownership, automation, wiki-driven knowledge, capability extraction.
- **PRESERVE (v5 strengths, non-negotiable):** memory · learning · verification (author≠verifier, the gate) ·
  boundaries · determinism. Replace unnecessary *process* with *capability* — never weaken these.

## 10. Dedicated review tracks (run as parallel specialist streams)
Skills Architecture · Agent Architecture · Knowledge Architecture · Workflow Architecture · Integration
Architecture · Automation Architecture · AI-Systems Architecture. Each studies the SOTA externally
(skill-first / wiki-first architectures · specialization models · capability-extraction mechanisms · orchestration
& workflow-ownership patterns · execution frameworks) and proposes the v6 design for its domain.

## 11. THE SINGLE SUCCESS CRITERION + COMPLETION DEFINITION
**Success = "Does the system become easier to operate as it learns?"** NOT documentation quality, NOT doctrine
quality, NOT test count. If the answer is no, v6 failed.
**DONE = IMPLEMENTED, not reviewed.** The effort is complete only when the findings are actually implemented across
the OS (delivery-os) AND existing repositories (Admin, PLOS) have a clear, executed v5→v6 migration path (incl. the
migration/update agent). *Earlier is not success. Implementation is success.*

## Status
**CHARTER LOCKED + COMPLETE 2026-06-14** (no further pre-review edits — refinement happens IN the review). Sequencing:
**A (milestone-first)** chosen; review-PREP ingest of Admin/PLOS/delivery-os COMPLETE (3 corpora gathered, hypothesis
strongly corroborated with a sharper edge: the gap is the cross-*repo* seam, intra-repo workflow validation works).
The full multi-agent review (tracks per §10) + implementation run after the invoice-delivery milestone is
Founder-Ready, using that finished slice as the measured baseline.
