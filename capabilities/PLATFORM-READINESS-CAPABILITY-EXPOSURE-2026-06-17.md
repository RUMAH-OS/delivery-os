# Platform Readiness for Cross-System Capability Exposure (DOS UI + Jarvis) — 2026-06-17

> DRAFT — lead-architect authors; founder ratifies. Read-only/planning. No code, no roadmap change.
> Question (founder): under the LOCKED ownership boundary, what PLATFORM-level capabilities are still
> missing that would prevent a future system (e.g. PLOS) from exposing ITS capabilities through the
> Delivery OS UI and eventually through Jarvis?
>
> REFRAMES CAPABILITY-FRAMEWORK-SUFFICIENCY-2026-06-17.md (which asked is-the-framework-sufficient for an
> operational workflow) into a PLATFORM-ENABLEMENT question: not build Lead-to-Contract but build the
> primitives so PLOS CAN, on a platform Admin/DOS owns. Same gaps, different lens + an honest verdict.

## Locked boundary this report obeys
- Admin owns the PLATFORM: Delivery OS, v6 architecture, capability framework, contracts/events,
  skills+wiki propagation, DOS UI foundations, Jarvis readiness, cross-system capability reuse.
- Admin does NOT own operational workflows. Lead-to-Contract, matching, offer/contract content = PLOS.
- So: the WORKFLOW ENGINE / capability-registry / DOS-UI-surface / invocation-seam are platform PRIMITIVES
  Admin/DOS builds; PLOS authors workflows ON them. Lead-to-Contract is used ONLY as the worked consumer
  example, never as something Admin builds. Every prove-it below is on a TRIVIAL platform-owned sample
  capability or on Admin OWN already-built capability (e.g. the Knowledge Harvester), NOT PLOS business logic.

---

## 1. THE PATH-WALK — PLOS has a capability ... it is on the DOS UI and Jarvis can run it

Every hop a capability must travel, with the GAP at each hop (each grounded on disk below).

| Hop | What must happen | Today | Gap |
|---|---|---|---|
| H1 DECLARE | a system declares a capability + its 5 facets in a machine-readable manifest the platform reads | Ownership lives in hand-maintained markdown (06-source-of-truth-registry.md table; CAPABILITY-LEDGER.md table) | No live registry / manifest STANDARD. A system cannot DECLARE; a human edits a doc. |
| H2 DISCOVER | the platform enumerates what capabilities exist across systems + their state | No discovery surface. os-foundation.manifest.json lists 8 OS tools — internal inheritance only, not a cross-system capability catalog | No discovery plane. Nothing reads systems and lists their capabilities. |
| H3 RENDER (DOS UI) | the capability renders in a Delivery OS UI without the system hand-building UI | No DOS UI exists. find delivery-os -iname *.html -> nothing; no delivery-os/ui. The ONLY UI is rumah-admin/scripts/execution-ledger.mjs -> an Admin-local HTML reading Admin telemetry | No UI-surface mechanism. Facet (c) is structurally impossible for ANY system, including Admin own capabilities. |
| H4 INVOKE (Jarvis do-X) | Jarvis calls a capability uniformly across systems | The Admin-PLOS seam is READ + EVENTS only (ECR-0006 PULL). POST endpoints in Admin are domain-specific (/contracts, /invoices/:id/send) — no generic /v1/commands or invoke route (grep=0) | No command/invocation seam. ECR-0006 explicitly DEFERS a push/command path; no uniform do-X interface. |
| H5 OBSERVE/VERIFY | Jarvis observes outcome + verifies completion across systems | Per-system outbox + read seam exist; author-not-equal-verifier holds INSIDE Admin. No cross-system aggregation of capability state | No cross-system observation plane (the founder Health-Framework: systems produce, Founder OS consumes/combines/reasons/acts — asserted in ECR-0007, NOT built). |
| H6 ORCHESTRATE | Jarvis: discover -> plan -> invoke -> verify -> surface, across systems | dispatch-route plans-not-spawns, per-DISPATCH (one agent, one task), Admin-internal. No cross-system planner; no step-state | No Jarvis orchestration interface. Runner is a single-repo agent planner, not a capability orchestrator. |
| H7 INHERIT skill+wiki | the capability skill + wiki flow to the shared layer + are retrievable/enforced per-capability | os-inherit + knowledge-route exist but are NOT capability-scoped and NOT enforced; knowledge-route.mjs/dispatch-route.mjs have NO canonical home in delivery-os (only Admin copies — the false OS-owned header drift) | Skill/wiki inheritance not capability-scoped, not enforced, partially fictional on disk. |

Net: of 7 hops, only the RAW MATERIALS of H4/H5 partly exist (a read seam + an outbox, Admin-PLOS only).
H1, H2, H3, H6 have no mechanism at all. A PLOS capability cannot reach the DOS UI or Jarvis today; it stops at H1.

---

## 2. PRIMITIVE x {exists / partial / missing} MATRIX (with evidence)

The 7 candidate primitives, confirmed/corrected. Status is the HONEST disk state.

| # | Platform primitive | Status | Evidence (on disk) |
|---|---|---|---|
| P1 | Capability registration / manifest standard (system DECLARES a capability + 5 facets, machine-readable) | MISSING | 06-source-of-truth-registry.md + CAPABILITY-LEDGER.md are hand-maintained markdown tables. os-foundation.manifest.json is an OS-internal inherit list (8 tools/1 contract/1 skill/2 agents), not a capability registry with facets/owner-system/invocation. No schema, no per-capability declaration format. |
> **UPDATE (post-authoring, 2026-06-17): the Capability Registration/Manifest standard + registry + 9 manifests were BUILT (report-only). P1 status MISSING -> BUILT-not-enforced; H1 declare-hop now has a mechanism.**
| P2 | Capability invocation / command interface (uniform cross-system do-X) | MISSING | Seam = read (/v1/ops,/v1/finance) + events (GET /v1/events PULL) only. No /v1/commands or invoke (grep=0); Admin POSTs are domain-specific business actions. ECR-0006 Deferred-decisions table lists push/relay as a FUTURE earn-trigger; no command seam designed. |
| P3 | Delivery OS UI-surface mechanism (registered capability -> renders, no bespoke UI) | MISSING | No delivery-os/ui, no *.html in delivery-os. Only UI = rumah-admin/scripts/execution-ledger.mjs -> docs/execution-ledger.html, an Admin artifact reading Admin telemetry (header: surfaces what the repo already recorded). Facet (c) DOS-UI = NO MECHANISM (Sufficiency report sec2). |
| P4 | Cross-system observation / event-choreography backbone (Health-Framework: produce -> consume/combine/reason/act) | PARTIAL -> mostly MISSING | Per-system outbox + a PULL read seam EXIST (ECR-0006). But nothing AGGREGATES capability state across systems; nothing maps an event -> the next workflow step (outbox is one-way emit; PLOS polls). The Health-Framework is named as canon (ECR-0007) but UNBUILT. |
| P5 | Skill + wiki inheritance for capabilities (os-inherit-scoped) | PARTIAL + drifted | os-inherit.mjs verified; knowledge-route exists. BUT inheritance is NOT capability-scoped (no this-capability skill+wiki travel together); knowledge-route/dispatch-route are NOT in delivery-os or the manifest (find=0, grep=0) despite OS-owned/vendored headers — drift between prose and disk. Adoption broken (2 KU triggers ever; 12/14 skills idle). |
| P6 | Jarvis orchestration interface (discover -> plan -> invoke -> verify -> surface, cross-system) | MISSING (single-repo planner exists) | dispatch-route plans-not-spawns (RUNNER-SPAWNER verdict A), per-dispatch (one agent/one task), Admin-internal, harness-bound to Claude as spawner. No cross-system planner, no step state, no capability-level orchestration. AUTO-EXEC Layer B = Partial (no automated runner). |
| P7 | Capability health + identity/auth across the UI surface | PARTIAL | Per-system: capability-health.mjs (9/9 ALIVE in Admin) measures wired-vs-inert INSIDE a repo, not a cross-system aggregate. Auth: scoped service JWTs (ops:read/events:read, HS256) exist for the READ seam (ECR-0006 secE) — but UI-surface auth (DOS UI rendering another system capability securely; per-user/cross-system render auth) is UNPROVEN; no UI exists to need it yet. |

Reusable PATTERN that DOES exist (the spine is the right shape): the executable contract + events pair —
admin-plos-seam-v1.mjs (the canonical, zero-dep, per-event-type contract) + the outbox. This is facets (a)+(b)
proven, the genuine exemplar to generalize from. The platform foundation is sound; the missing primitives are
ADDITIVE, not a redesign.

---

## 3. RANKED MISSING PLATFORM PRIMITIVES (the founder actual ask)

Ranked by absence-blocks-the-most-downstream-hops. Each: what it is, why it blocks exposure, who builds,
how to prove GENERICALLY (never by building a PLOS workflow).

### #1 — Capability Registration / Manifest Standard (P1)  [DECLARE — H1]
- What: a machine-readable per-capability manifest a system commits in its repo: id, owner-system, version,
  5 facets (contract ref, events, UI-surface descriptor, skill ref, wiki/KU ref), invocation descriptor,
  health endpoint; + a platform aggregator that reads all registered systems into one catalog.
- Why it blocks: it is hop H1. With no declaration STANDARD, the platform cannot discover, render, invoke,
  or inherit anything generically; every other primitive has nothing to operate on. It is the root.
- Builds: Admin/platform (it is the framework). Replaces the hand-maintained registry/ledger tables.
- Prove generically: declare a TRIVIAL platform-owned sample capability (a ping/echo capability) AND Admin
  OWN Knowledge Harvester via the manifest; the aggregator lists both with their facets. NO PLOS, no business
  logic; proven on a sample + an existing Admin capability.

### #2 — Delivery OS UI-Surface Mechanism (P3)  [RENDER — H3]
- What: a real DOS UI bucket + an inherit-path template + a capability-to-surface contract, so a registered
  capability renders (status, what-happened, is-it-done) WITHOUT each system hand-building UI. Generalize the
  Admin execution-ledger.html into an OS surface that reads the registry (P1), not Admin telemetry only.
- Why it blocks: it is hop H3 and facet (c), structurally impossible today for ANY capability. It is the
  founder North Star (the ONE founder-facing screen) AND focus area #4. Without it expose-through-DOS-UI is undefined.
- Builds: Admin/platform (DOS UI foundations are explicitly Admin per the locked boundary).
- Prove generically: the DOS UI renders the #1 sample capability + the Harvester from the registry alone,
  before any PLOS capability exists. Proves the surface is capability-driven, not bespoke.

### #3 — Workflow Engine primitive (subsumes P4 choreography)  [the conductor across H4-H6]
- What: a definition format (states, transitions, per-step owner-SYSTEM, entry/exit, human-approval gates
  between steps) + a runner that holds per-step state and consumes events to advance. Honors the ratified
  ceiling: it ORCHESTRATES scripted+gated+human-approved steps and PLANS agent dispatches; it does NOT
  self-spawn. This is the platform PRIMITIVE; PLOS authors Lead-to-Contract ON it (content is PLOS).
- Why it blocks: today the framework holds the ARTIFACTS of steps but has no mechanism to RUN a chain
  multi-system with human gates (Sufficiency sec3: no engine in src; workflow-gate is a CHECKER not an engine;
  dispatch-route is per-dispatch). It is the central blocker for any cross-system capability sequence.
- Builds: Admin/platform (the engine is a primitive). PLOS owns the workflow CONTENT.
- Prove generically: run a 2-step TRIVIAL platform-owned workflow with one human gate between steps (e.g.
  harvest-knowledge -> human-approves -> promote) using Admin OWN Harvester/Curator capabilities; proving
  step-state, event-advance, and the human-gate primitive on Admin-internal capabilities, NOT on Lead-to-Contract.

### #4 — Capability Invocation / Command Seam (P2)  [INVOKE — H4]
- What: a uniform, versioned, authenticated cross-system invoke-capability-X-with-args interface (the
  symmetric counterpart to ECR-0006 read+events), with the same data-minimisation + human-gate discipline.
- Why it blocks: Jarvis/DOS-UI cannot ACT on a capability without it; ECR-0006 deferred it. Today every
  cross-system action would be a bespoke domain endpoint.
- Builds: Admin/platform (a new ECR; the command seam ECR-0006 reserved). MUST preserve destructive +
  outward-facing actions remain human-gated (AUTO-EXEC secA6).
- Prove generically: invoke the #1 sample/echo capability through the seam end-to-end (auth + contract +
  human-gate for any side-effecting class). No PLOS capability needed to prove the seam shape.

### #5 — Cross-System Observation / Health Aggregation plane (P4 + P7 health)  [OBSERVE — H5]
- What: the Health-Framework plane: the platform consumes per-system capability state + health into one
  cross-system view (capability-health aggregated across registered systems). Foundation for Jarvis is-it-done /
  is-it-healthy across the ecosystem.
- Why it blocks: hop H5; without it the DOS UI/Jarvis show one system at a time. Named as founder canon
  (ECR-0007 Health-Framework) but unbuilt.
- Builds: Admin/platform. Generalizes the per-repo capability-health.mjs into a cross-system aggregator fed
  by P1 registry + each system health endpoint.
- Prove generically: aggregate Admin OWN capability-health (9/9) + the sample capability health into one
  view. Two systems can be two registered capability sets; no PLOS required.

### #6 — Jarvis Orchestration Interface (P6)  [ORCHESTRATE — H6]
- What: the cross-system planner that chains discover (P1) -> plan -> invoke (P4) -> verify (P5,
  author-not-equal-verifier) -> surface (P3), honoring planner-not-spawner. The cross-system generalization
  of dispatch-route.
- Why it blocks: it is the Jarvis layer itself. Depends on #1,#2,#4,#5; cannot precede them.
- Builds: Admin/platform. Bounded by the V6 ceiling (Claude/runner pulls the trigger; autonomy is post-V6).
- Prove generically: Jarvis discovers the sample capability from the registry, invokes it via the command
  seam, verifies the outcome, surfaces it on the DOS UI; a full loop on a TRIVIAL platform capability.

### #7 — Capability-Scoped Skill+Wiki Inheritance + enforcement (P5)  [INHERIT — H7]
- What: a capability skill+wiki+contract+events+UI travel TOGETHER through os-inherit (the 5-facet bundle),
  with an enforced a-capability-cannot-reach-in-OS-without-its-facets (or explicit n/a) gate. Fix the drift
  first: give knowledge-route/dispatch-route/Harvester a canonical home in delivery-os + the manifest.
- Why it blocks: it is hop H7; without it a capability knowledge/skill stays local (today reality; the
  knowledge capability never traveled its own pipe; Sufficiency sec1). Lower rank ONLY because the upper hops
  must exist first for there to be a complete capability to inherit.
- Builds: Admin/platform (the framework + os-inherit owner).
- Prove generically: travel the FULL pipe with Admin OWN knowledge capability (Harvester); home in
  delivery-os, in the manifest, 5 facets bundled, os-inherit check policing it. If the framework cannot promote
  the capability it was built ON, it will not promote a PLOS one. This is the proof-of-life.

---

## 4. BUILD SEQUENCE — Waterline (concrete-before-abstract) + the gating

Gating honored: post-V6 (these primitives are platform-enablement, sequenced AFTER V6-complete in Admin per
V6-LANDED-DEFINITION); N=1 master gate (a 2nd app must inherit+run-green before promotion-to-shared); PLOS
FROZEN (no PLOS work; every proof below is on a platform sample or an Admin-internal capability).

Waterline discipline: do NOT build registry/UI/engine ABSTRACTLY. Build each on ONE concrete, already-real
thing (a trivial sample + Admin OWN Harvester), then generalize the standard around the proven instance;
exactly the Sufficiency report sequencing rule (build the engine on a real chain first, generalize after).

Sequence:
0. Pre-req (drift repair, cheap, do first): give knowledge-route/dispatch-route/knowledge-harvester a
   canonical home in delivery-os + add to os-foundation.manifest.json, removing the false OS-owned headers.
   Until the framework can promote ITS OWN tools, no cross-system claim is honest. (P5 proof-of-life.)
1. #1 Capability Registration / Manifest Standard — the root; nothing renders/invokes/inherits without it.
   Prove on a TRIVIAL sample capability + the Harvester. This is the FIRST BUILD.
2. #2 DOS UI-Surface Mechanism — render the registry (the sample + Harvester) on the first real DOS UI.
   Concrete artifact the founder can see; satisfies the North Star screen direction on platform-owned content.
3. #3 Workflow Engine (the riskiest unknown, but proven on Admin OWN 2-step harvest->approve->promote flow,
   NOT on Lead-to-Contract). Build the thin vertical slice FIRST; generalize the bucket/router after.
4. #4 Command Seam (new ECR) — invoke the sample capability; preserve human-gates.
5. #5 Observation/Health aggregation — cross-system view over Admin OWN + sample capability health.
6. #6 Jarvis Orchestration — the full loop over the sample capability (depends on 1-5).
7. #7 enforce capability-scoped 5-facet inheritance — the gate that makes it permanent.

Only AFTER #1-#3 are proven on platform-owned/Admin-internal capabilities does PLOS (unfrozen, post-V6, past
the N=1 gate) author Lead-to-Contract as the FIRST real consumer; the worked example, never something Admin built.

---

## 5. Reconciliation with prior canon
- CAPABILITY-FRAMEWORK-SUFFICIENCY-2026-06-17: same gaps (G1 workflow engine, G2 buckets, G3 DOS UI, G4
  promotion-unenforced/knowledge-never-travelled). This report REFRAMES them from what-Lead-to-Contract-needs to
  what-ANY-system-needs-to-expose-a-capability + ADDS the two it under-weighted because they were not needed
  for a single workflow: P1 registration/manifest standard and P2 command/invocation seam (Jarvis cannot
  discover/invoke without them). Both reports agree: spine right-shaped, gaps additive.
- V6-LANDED-DEFINITION: these primitives are PLATFORM-ENABLEMENT, NOT V6-completion blockers. V6-complete
  (3 Admin-internal pillars) does not require any of them. They are the bridge from V6-landed-in-Admin to
  the-AI-Operating-System / Jarvis-across-systems; explicitly the later, stronger claim. Do not let this
  reopen G8/PLOS propagation (REMOVED from active consideration); these are platform primitives proven on
  Admin-internal capabilities, which IS in scope.
- AUTO-EXEC-CRITERIA: #6 (Jarvis orchestration) is bounded by Layer-B Partial; the runner plans, Claude pulls
  the trigger; #4 command seam MUST keep destructive/outward actions human-gated (secA6). None of these
  primitives claims autonomy; they claim CROSS-SYSTEM EXPOSURE under the existing ceiling.
- ECR-0006/0007: the read+events seam is the proven facet (a)+(b) exemplar to generalize. ECR-0006 reserved
  the command seam (#4) as a deferred earn; this report names that earn-trigger as cross-system-capability-
  exposure. ECR-0007 Health-Framework (systems produce capabilities+state; Founder OS consumes/combines/
  reasons/acts) is the founder OWN articulation of primitives #5 + #6; asserted as canon, unbuilt on disk.

---

## VERDICT

NOT READY. The platform can SHARE TRUTH across systems (the read+events seam, a genuinely reusable exemplar)
but it cannot EXPOSE A CAPABILITY across systems. Of the 7 hops a capability must travel (declare -> discover
-> render -> invoke -> observe -> orchestrate -> inherit), four have no mechanism at all (declare, render,
invoke, orchestrate) and the rest are per-system or drifted. A PLOS capability stops at hop 1 today; there is
nothing to declare it to.

The good news: the spine is the RIGHT SHAPE and the gaps are ADDITIVE. The contract+events pattern proves the
platform can carry a versioned, enforced, data-minimised interface; that exact discipline generalizes to the
registry, the command seam, and the UI surface.

TOP 3 GAPS (the founder answer):
1. No capability registration / manifest standard (P1) — the root; nothing can be discovered/rendered/
   invoked/inherited generically. Ownership lives in hand-maintained markdown.
2. No Delivery OS UI-surface mechanism (P3) — facet (c) is structurally impossible for ANY system; the only
   UI is Admin-local. This is also the founder North Star screen.
3. No capability invocation / command seam (P2) — the seam is read+events only; Jarvis cannot do-X across
   systems (ECR-0006 deferred it).

(Close behind, the conductor: no cross-system workflow engine (P-#3); but it must be proven on Admin OWN
capabilities first, never on PLOS content.)

FIRST BUILD: the Capability Registration / Manifest Standard (#1), proven on a trivial platform-owned sample
capability + Admin OWN Knowledge Harvester; preceded by the cheap drift-repair (step 0: give knowledge-route/
dispatch-route/Harvester a real home in delivery-os + the manifest). Everything else operates on what #1
declares; building UI/engine/command-seam before the registry exists would violate Waterline (abstract-before-
concrete) and have nothing to render or invoke.

> DRAFT — founder ratifies. Every claim grounded on disk; evidence index inline in sec1-sec2 and the prior
> Sufficiency report appendix.
