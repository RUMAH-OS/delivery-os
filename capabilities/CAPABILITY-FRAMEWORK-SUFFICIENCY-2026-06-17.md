# Capability-Framework Sufficiency for Operational Workflows — Gap Analysis (2026-06-17)

> DRAFT — lead-architect authors; founder ratifies. Read-only/planning pass; no code, no roadmap change.
> Question: is the capability framework (exercised on KNOWLEDGE) general enough for an autonomous
> Lead-to-Contract operational workflow, or did we build a knowledge-only framework?

Method: every claim is grounded in a file on disk. Where docs claim a capability is OS-owned/vendored/on
the inherit path, I checked whether it is actually in delivery-os and in os-foundation.manifest.json. The
finding diverges from the prose in several load-bearing places.

---

## 1. Promote-to-Delivery-OS: works, or aspirational?

VERDICT: the mechanism EXISTS and is verified in isolation, but it is NOT enforced, and -- decisively --
the capabilities the founder cares about are NOT on it. For KNOWLEDGE specifically, promotion is currently
ASPIRATIONAL: the just-built Harvester and even knowledge-route itself are stuck in Admin with no canonical
home in delivery-os.

1. os-inherit is real and verified -- templates/tools/os-inherit.mjs exists; CAPABILITY-LEDGER.md line 42
   marks it verified (independent QA; sync/check/drift/missing all proven). The PIPE works.
2. But the inherit set is tiny. os-foundation.manifest.json lists 8 tools (seam/lifecycle/workflow/
   experience gates + skill/agent frontmatter+route), 1 contract (admin-plos-seam-v1.mjs), 1 skill
   (learning-review), 2 agents. grep -c knowledge-route+dispatch-route on the manifest = 0.
3. knowledge-route.mjs has NO canonical home in delivery-os. find delivery-os -name knowledge-route.mjs ->
   nothing. It exists ONLY at rumah-admin/.claude/os/tools/knowledge-route.mjs. Same for dispatch-route.mjs.
   Both headers CLAIM OS-owned/vendored/drift-gated -- FALSE on disk: no upstream to vendor from, not in the
   manifest, so os-inherit check does not police them. Drift between prose and reality.
4. The Knowledge Harvester is Admin-local: rumah-admin/scripts/knowledge-harvester.mjs (not .claude/os/
   tools/, not delivery-os). Its header (lines 14-16): PROVING-GROUND PLACEMENT ... Promotes to delivery-os/
   templates/tools/ once proven. Report-only, Admin-only, not yet on the promotion path. Same for
   knowledge-curator.mjs.
5. The route-up hop is INERT. CAPABILITY-LEDGER.md lines 70,82: census-detector = Verified -- INERT, wired
   into NO CI/hook, never actually runs; file-lesson = Verified, not yet invoked in a real flow. The FIRST
   hop does not fire automatically. signals.jsonl has 566 lines but nothing aggregates it on a schedule.

Conclusion: promotion is a manual hope, not an enforced gate, for everything outside the small gate-family.
The pipe is proven; the pressure to use it (census-detector -> ledger) is inert; the knowledge capability
has not traveled the pipe. No gate says a proven capability MUST be promoted (anti-decay rule, lines 89-92,
is a convention).

---

## 2. The 5-facet complete-capability standard -- formalized + matrix

Proposed standard (formalizing founder requirement #2). A capability is COMPLETE only when it has all five
facets, each reachable through the seam, not merely present as a file:

| Facet | Meaning | Checked today by |
|---|---|---|
| (a) Contract/interface | versioned machine-checkable interface (schema + conformance test) | seam:check vs admin-plos-seam-v1.mjs |
| (b) Events | emits business events on the outbox in the frozen vocabulary | seam-gate over outbox emitters |
| (c) Delivery OS UI surface | a founder-facing surface answering what-happened/is-it-done | NO MECHANISM |
| (d) Skill | a routable, cited execution procedure | skill-route / skill-health |
| (e) Wiki | a routable KU (claim/trap/why/rollback) | knowledge-route / knowledge-health |

Add this to CAPABILITY-LEDGER.md as the definition of in-OS completeness -- today in-OS only means the
artifact landed canonical, which is why gate rows are in-OS with no skill/wiki/UI facet.

### Matrix (current capabilities x 5 facets). YES=real pattern, PART=partial/exemplar, NO=missing.

| Capability | (a) Contract | (b) Events | (c) DOS UI | (d) Skill | (e) Wiki |
|---|---|---|---|---|---|
| admin<->plos seam | YES (THE exemplar) | YES outbox | NO | NO | PART (ECR prose, not a KU) |
| seam/lifecycle/workflow gates | PART (gate~=contract-of-behavior) | NO | NO | NO | PART (some KUs) |
| ux-safety/audit-label/nav/crud lints | NO | NO | NO | NO | NO |
| Knowledge Harvester (just built) | NO | NO | NO | NO | NO (the knowledge capability has no wiki facet) |
| Knowledge Curator | NO | NO | NO | NO | NO |
| dispatch-route (the runner) | PART DispatchPlan | PART dispatch-log.jsonl | PART ledger reads it | NO | NO |
| execution-ledger (founder screen) | NO | NO | YES (the ONLY UI; Admin HTML) | NO | PART cites a KU |
| invoicing (operational capability) | PART ops-v1 | YES invoice.* | PART (Admin UI, not DOS) | PART | PART |

Two systemic gaps (founder hypothesis CONFIRMED):

1. Delivery OS has NO UI-surface mechanism. CONFIRMED: ls delivery-os/ui and find delivery-os -name *.html
   -> nothing. The ONLY UI is rumah-admin/scripts/execution-ledger.mjs -> docs/execution-ledger.html, an
   Admin artifact reading Admin telemetry. No bucket, no router, no template, no inherit-path for UI. Facet
   (c) is structurally impossible today for ANY capability. The 7-bucket model never even lists UI -- it
   lists Objective (completion logic), which is not a surface.
2. Capabilities do NOT auto-acquire skill+wiki. CONFIRMED: no lifecycle step generates a KU/skill when a
   capability is built. They are hand-authored and mostly un-routed (ledger line 68: skill-router NOT
   auto-dispatched, no real routing in work; adoption memory: 2 triggers ever, 12/14 idle).

Net: only (a) Contract and (b) Events are a real reusable PATTERN (proven on the seam). (c) has no
mechanism; (d)(e) exist as types but with no auto-generation and broken adoption. A 5-facet complete
capability is not achievable for ANY capability today -- including knowledge.

---

## 3. Lead-to-Contract mapped onto the framework

Ownership per 06-source-of-truth-registry.md (Lead = Demand/CRM Spine = PLOS; Admin owns Property/Inventory/
Deals/Contracts/Invoices) and ECR-0007 (PLOS = Contact SoR + comms; Admin = SoR for inventory/offer/contract/
signing; Founder OS = orchestration above).

| Step | Owner | (a) | (b) | (c) | (d) | (e) | Built? |
|---|---|---|---|---|---|---|---|
| 1 Inbound enquiry | Website->PLOS | NO (email-only, no structured record, ECR-0007 ln26) | NO | NO | NO | NO | unbuilt |
| 2 Applicant extraction | PLOS (Contact resolver) | PART (resolver designed) | NO | NO | NO | NO | designed, gated post-V6+N=1 |
| 3 Inventory matching | Admin | PART /v1/ops read seam | NO | NO | NO | NO | matching unbuilt |
| 4 Offer generation | Admin | NO | NO | NO | NO | NO | unbuilt |
| 5 Contract generation | Admin (SoR) | PART contract lifecycle | YES contract.* | NO | PART | PART | partial (prod) |
| 6 Signing workflow | Admin (SoR) | PART signing-public.ts | YES contract.signed | NO | PART | PART | partial (prod) |

The cross-system orchestration question -- answered: there is NO workflow engine.

- find rumah-admin/src for state-machine|workflow-engine|orchestrat|saga returns only DOMAIN code
  (invoicing, migration transforms) -- no generic step-runner.
- workflow-gate.mjs is a GATE that checks cross-repo lifecycle invariants, not an engine that RUNS a
  multi-step workflow. It validates; it does not execute or hold step state.
- Workflow/Health/Objective buckets do not exist on disk (ls delivery-os/workflows|health|objectives ->
  none). Create-when-needed, never created. No workflow-route.
- dispatch-route is per-DISPATCH (one agent, one task) and plans-not-spawns (RUNNER-SPAWNER-ASSESSMENT
  verdict A). It cannot sequence step-2-then-step-3-across-two-systems, hold per-step state, or pause for a
  human gate between steps.
- Events exist (contract.*, invoice.*, payment.received in events-v1.ts) but NO choreography layer consumes
  enquiry.received to trigger the next step. The outbox is one-way emit; PLOS polls it (ECR-0006 PULL).
  Nothing routes an event into the NEXT step of a named workflow.

So Lead-to-Contract today = single-system pieces (some prod, most unbuilt) + manual stitching by a human or
Claude. The framework holds the ARTIFACTS of each step but has NO mechanism to RUN the chain end-to-end,
multi-system, with human gates. The runner=planner-not-spawner gap and the un-built Workflow bucket are the
same hole from two angles.

---

## 4. The GAP LIST (concrete, prioritized)

| # | Gap | Evidence | Severity |
|---|---|---|---|
| G1 | No cross-system, multi-step, human-gated WORKFLOW ENGINE. Only per-dispatch planning + per-repo gates. No step state, no sequencing, no inter-step approval, no event->next-step choreography. | no engine in src; workflow-gate is a checker; dispatch-route plans-not-spawns | CRITICAL -- central blocker |
| G2 | Workflow/Health/Objective buckets designed-not-built. No dirs, no routers (all proposed). The operational half of the 7-bucket model is vapor. | KNOWLEDGE-ARCHITECTURE sec1 bucket MISSING; dirs absent | CRITICAL |
| G3 | No Delivery OS UI-surface mechanism. Only UI is Admin execution-ledger.html. Facet (c) unsatisfiable; UI not even a bucket. | no delivery-os/ui, no html | HIGH |
| G4 | Promotion unenforced + knowledge tools never traveled it. census-detector/file-lesson INERT; knowledge-route/dispatch-route/Harvester absent from delivery-os + manifest. | manifest grep=0; find=none; ledger ln70,82 | HIGH |
| G5 | Lead-to-Contract steps 1-4 (enquiry, applicant-extraction, inventory-matching, offer-generation) UNBUILT. Step 2 designed but gated post-V6+N=1. | ECR-0007; registry; no code | HIGH (product), downstream of G1 |
| G6 | No automatic skill+wiki(+event+UI) generation per capability. Facets (d)(e) hand-authored; adoption broken (12/14 skills idle; 2 KU triggers ever). | adoption memory; ledger ln68 | MEDIUM |
| G7 | No step-level human-approval gate as a reusable mechanism. ADR-006/007 require human gates; enforced ad-hoc, not a reusable workflow-pauses-here primitive. | ADR-006/007; no primitive | MEDIUM |
| G8 | Event choreography missing. Outbox emits; nothing maps an event to the NEXT workflow step. | events-v1.ts emit-only; ECR-0006 PULL | MEDIUM (subset of G1) |
| G9 | Runner plans but does not spawn -- ratified V6 ceiling, but means even a built engine needs Claude/a human as executor; not autonomous. | RUNNER-SPAWNER verdict A; AUTO-EXEC Layer B Partial | MEDIUM (bounds autonomy) |

---

## 5. Propagation of validated learnings: automatic or manual?

Manual, and it relies on someone remembering. The enforcement gap is concrete:

- First hop (file-lesson -> census-detector -> ledger) is INERT (ledger ln70-71: census-detector wired into
  NO CI/hook, never runs). A validated learning does NOT auto-route up; a human files and promotes it.
- learning-review IS auto-executed (fail-closed, commits-since-retro) -- it forces a retro to be WRITTEN --
  but a human still authors the retro (ledger ln69), and nothing forces the retro lessons into canonical units.
- This session illustrates it: the ECR-0007 comms/Contact ruling lives as ECR prose + a decision-review .md,
  NOT as a KU on knowledge-route. The verify-gate-frontmatter lesson and the mirror-KU=vendoring refinement
  (commits bfeb1a8, 873cb01) are git history + prose, not routable units. The Harvester uncovered-durable
  count is the MEASUREMENT of this gap; report-only + Admin-local means we can SEE the backlog but nothing
  DRAINS it automatically.

Named enforcement gap: no gate fails a slice/milestone close when a validated durable learning has NOT been
converted to a canonical unit AND promoted. learning-review forces the RETRO; nothing forces extraction ->
promotion -> inherit. Propagation is reproducible by discipline, not by construction.

---

## VERDICT

INSUFFICIENT for operational capabilities as-is -- but the foundation is the right shape, and the gaps are
additive, not a redesign.

The framework is sufficient for the (a) Contract and (b) Events facets (proven on the admin<->plos seam -- a
genuinely reusable exemplar). It is a knowledge-leaning framework IN PRACTICE: the only buckets built are
Wiki/Skill/Contract; the operational buckets (Workflow/Health/Objective) and the UI facet are designed-not-
built; and even the knowledge capability has not completed the promotion path. An autonomous Lead-to-Contract
needs the three things the framework most lacks: a workflow engine, the Workflow/Health/Objective buckets,
and a UI-surface mechanism -- none of which exist on disk today. The promotion path and the propagation of
learnings work in isolation but are not enforced, so they depend on memory.

One-line answer to the founder: we built the spine (lifecycle + os-inherit + contract/events facets)
general, but only exercised it on knowledge, and we stopped before building the operational organs (workflow
engine, Workflow/Health/Objective buckets, UI surface) and before wiring the promotion/propagation pressure
that makes the spine fire by itself.

### TOP 5 GAPS (ranked)
1. G1 -- No cross-system, multi-step, human-gated workflow engine (central blocker; everything else is
   artifacts without a conductor).
2. G2 -- Workflow/Health/Objective buckets designed-not-built (build the Workflow bucket + workflow-route
   first, on Lead-to-Contract as the proving instance).
3. G3 -- No Delivery OS UI-surface mechanism (facet (c) unsatisfiable; only UI is Admin-local).
4. G4 -- Promotion unenforced and the knowledge tools never traveled it.
5. G5/G6 -- Per-capability auto-generation of skill+wiki+event+UI absent; adoption broken.

### What must be ADDED to support Lead-to-Contract
1. A Workflow Engine capability (the missing organ): a definition format (states - transitions - per-step
   owner-system - entry/exit - human-approval gates between steps) + a runner that holds per-step state and
   consumes events to advance. Honor the ratified ceiling: it ORCHESTRATES scripted+gated+human-approved
   steps and PLANS agent dispatches (does not self-spawn). Prove on Lead-to-Contract first. Subsumes G1, G2
   (Workflow bucket), G7, G8.
2. Build the Workflow/Health/Objective buckets + routers so the 7-bucket model is whole. Lead-to-Contract
   gives the Workflow bucket its first units (lead/offer/contract/signing lifecycles).
3. A Delivery OS UI-surface mechanism (a real bucket + inherit-path template) -- generalize Admin execution-
   ledger into an OS surface every capability/workflow renders into, so the founder one-screen works across
   systems, not just Admin.
4. Formalize + ENFORCE the 5-facet standard in CAPABILITY-LEDGER.md: a capability cannot reach in-OS until
   it has Contract/Events/UI/Skill/Wiki (or explicit n/a); a learning-bearing slice cannot close until its
   durable learning is extracted->promoted->inherited. Turns G4/G5/G6 from discipline into construction.
5. Actually travel the promotion path with the knowledge capability (proof-of-life): give knowledge-route +
   the Harvester a canonical home in delivery-os/templates/tools/, add to os-foundation.manifest.json, wire
   census-detector to a CI/cadence hook. If the framework cannot promote the capability it was built on, it
   will not promote Lead-to-Contract.

Sequencing (de-risking): item 1 (Workflow Engine, proven on Lead-to-Contract) is the riskiest unknown and
the one whose absence makes everything else moot -- build a thin vertical slice FIRST (enquiry->matching->
offer with one human gate), then generalize the bucket/router/UI/enforcement around the proven instance. Do
NOT build buckets/UI/standard abstractly before the engine is proven on one real chain (Waterline Rule).

---

## Appendix -- evidence index
- delivery-os/capabilities/CAPABILITY-LIFECYCLE.md (promotion path ln9-28)
- delivery-os/capabilities/CAPABILITY-LEDGER.md (single path 14-22; inert census/file-lesson 70-71,82;
  skill-router not auto-dispatched 68; anti-decay convention 89-92)
- delivery-os/capabilities/KNOWLEDGE-ARCHITECTURE.md (7-bucket model + Workflow/Health/Objective bucket
  MISSING sec1; auto-injection sec6; Harvester report-only sec3.2)
- delivery-os/capabilities/os-foundation.manifest.json (8 tools/1 contract/1 skill/2 agents;
  knowledge-route + dispatch-route absent, grep=0)
- delivery-os/capabilities/RUNNER-SPAWNER-ARCHITECTURE-ASSESSMENT-2026-06-16.md (plans-not-spawns = ratified)
- delivery-os/capabilities/G9-DISPATCH-RUNNER-ARCHITECTURE.md (per-dispatch composer; honest ceiling)
- delivery-os/capabilities/AUTO-EXEC-CRITERIA.md (Layer B Partial; automated runner does not exist)
- delivery-os/ : wiki/, skills/, contracts/ exist; workflows/, health/, objectives/, ui/ do NOT exist
- rumah-admin/.claude/os/tools/knowledge-route.mjs and dispatch-route.mjs (ONLY copies; no upstream)
- rumah-admin/scripts/knowledge-harvester.mjs (report-only, Admin-local) and execution-ledger.mjs (ONLY UI)
- rumah-admin/.claude/os/tools/admin-plos-seam-v1.mjs (the Contract exemplar; facets a+b proven)
- rumah-admin/src/contracts/events-v1.ts (contract.*, invoice.*, payment.received; no enquiry/lead events)
- ecosystem-architecture/06-source-of-truth-registry.md (Lead=PLOS; Admin=Inventory/Contracts/Invoices)
- ecosystem-architecture/decisions/ECR-0007-canonical-contact-and-single-comms-system.md (applicant/Contact
  = PLOS; Founder OS = orchestration above; gated post-V6+N=1)
