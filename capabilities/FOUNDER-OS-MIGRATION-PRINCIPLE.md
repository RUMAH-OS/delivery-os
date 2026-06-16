# Founder OS Migration Principle — Shared Intelligence, Single Source (founder-ratified 2026-06-16)

> Founder directive: stop building the same concepts (knowledge, workflows, monitoring, routing, verification,
> skills, objectives, health checks, founder visibility) separately in Admin, PLOS, and future Founder OS.
> Build each capability ONCE in Founder OS / Delivery OS and reuse it everywhere. Sharpens + supersedes the
> framing in `v6-end-state-architecture`.

## The GOAL (sharpened 2026-06-17) — separate project-context from shared intelligence
The goal is **NOT "build a new UI."** The goal is to **separate project-specific context from shared company
intelligence.** Today, company knowledge is scattered as markdown across projects. Target end-state: each
project keeps ONLY its project-local context in its `CLAUDE.md`; the shared intelligence layer becomes Founder
OS / Delivery OS, expressed in STRUCTURED forms (not prose collections). Over time Founder OS becomes the
canonical home of shared intelligence and Admin & PLOS become CONSUMERS, not maintainers of separate copies.
Benefits: one source of truth for knowledge/workflows/skills; easier Jarvis reasoning; less duplication/drift.

## The classification taxonomy (canonical classifier — 6 buckets)
For every major document/capability under review, ask which ONE bucket it belongs to, and record where it
should live. This is the canonical classifier (it ADDS `Health` and `Objective` as first-class structures
beyond the coarse migration table below; and it makes explicit that project-context STAYS in `CLAUDE.md`):

| If it is… | It goes to… | Structure |
|---|---|---|
| project-specific context | stays local | `CLAUDE.md` (per project) |
| reusable knowledge (architecture, decisions, lifecycles, operating principles, playbooks) | **Wiki** | `wiki/` (KUs) |
| executable behavior (outreach, invoicing, onboarding, matching, contract handling, verification, workflow execution) | **Skill** | `skills/` |
| lifecycle definition (lead / invoice / contract / tenant / payment lifecycle) | **Workflow** | (workflow structure) |
| monitoring logic (seam health, workflow health, company health) | **Health** | (health structure) |
| completion logic (completion rules, success criteria, founder-attention models) | **Objective** | (objective structure) |

`Health` (monitoring-logic) and `Objective` (completion-logic) are first-class shared structures, beyond the
original migration table. Project-context is NOT migrated — it explicitly STAYS in `CLAUDE.md`.

## Classify, don't delete (promote-AND-preserve)
**This is NOT deletion of markdown. It is CLASSIFICATION.** No source markdown is removed by this principle.
Classifying a document decides its TARGET bucket; the physical move is separate, gated, and gradual (below).
When a capability eventually moves, the source stays and gets a `promoted-to:` back-link; the structured unit
carries its provenance. Knowledge-Lost = 0.

## Standing strategy — GRADUAL, no big-bang (backlog item)
This is NOT a big-bang migration. The standing rule, added to the architecture roadmap as a backlog item:
**as capabilities are reviewed, classify them into the 6 buckets and record where they SHOULD live — rather
than creating new project-specific markdown collections.** Classification (deciding the bucket) happens NOW at
review time; the physical MOVE stays gated to the post-proof steps and the proven-reuse gate. New shared
intelligence should be authored toward its bucket from the start, not as fresh per-project prose.

## The target architecture
```
Admin        └── CLAUDE.md         (project-specific context + execution)
PLOS         └── CLAUDE.md         (project-specific context + execution)
Founder OS / Delivery OS ── Skills · Wiki · Workflows · Monitoring · Objectives ·
                            Verification · Knowledge · Dispatch · Company Health · Founder Experience
```

## The role split (what each system IS)
- **Admin → System of Record + System of Execution.** Owns business facts/artifacts (inventory, contracts,
  invoices, payments, signatures) and the execution logic to mutate them. Project-specific.
- **PLOS → System of Record + System of Execution.** Owns demand/comms execution. Project-specific.
- **Founder OS / Delivery OS → System of Intelligence + System of Coordination + the Founder-facing OS.**
  Owns the SHARED intelligence layer: how work is routed, verified, learned, measured, and surfaced.

## The migration (move shared intelligence OUT of apps, INTO Founder OS)
| Today (per-app) | Founder OS (once) |
|---|---|
| Documentation | Wiki |
| Learned behavior | Skills |
| Operational knowledge | Knowledge Base |
| Monitoring | Founder OS Monitoring |
| Workflow orchestration | Founder OS Workflows |
| Cross-system visibility | Founder OS Dashboards |

**Goal:** never maintain an Admin version + a PLOS version + a Founder version of the same capability.
**Long-term:** Admin uses Founder OS; PLOS uses Founder OS; future Jarvis UI uses Founder OS — a single shared
Wiki + Skills + Workflow engine underneath all systems.

## SHARED intelligence (migrates to Founder OS) vs what STAYS in the app
- **Shared intelligence (build once in Founder OS, apps inherit):** dispatch/routing, verification (author!=
  verifier), the completeness gates (nav-reachability, crud-completeness, surface-sweep/manifest, workflow/
  continuation), skills, knowledge/wiki, monitoring/health, objectives, the deploy spine, founder-experience
  surfaces (the execution ledger / dashboards). These are the V6 "Jarvis-core" set.
- **Stays in the app (System of Record / Execution):** the business domain + its execution logic - e.g. Admin's
  invoices/contracts/payments/credit-notes/signing, PLOS's demand/comms. The SHAPE of how these are routed/
  verified/surfaced is shared; the THING itself is the app's.
- **The seam between them is itself shared** - the executable contract lives canonically in Founder OS /
  Delivery OS and is vendored into the apps via os-inherit. Already the live pattern.

## Reconciliation with the current phase (no contradiction)
This is the DESTINATION, not an instruction to stop current work. The founder-ratified sequence stands: Admin
is the proving ground - prove the V6 operating model in Admin first; PLOS frozen; migration to Founder OS
canonical is gated to AFTER the model is proven. So:
- The V6 capabilities currently being PROVEN Admin-native (rumah-admin/scripts/*, .claude/os/tools/*:
  nav-reachability, crud-completeness, surface-sweep, ownership-gate, deploy-spine, execution-ledger,
  dispatch-route) ARE shared intelligence in its proving phase. Once proven they MIGRATE to Founder OS /
  Delivery OS canonical and Admin inherits them (os-inherit) - they do not stay forked in Admin.
- Capabilities already canonical + vendored (the os-foundation tool templates, the admin-plos seam contract)
  already live this principle.
- The recalibration's Jarvis-core set = the Founder OS migration candidates. The reporting layer (ownership %,
  Claude-reduction, routing-compliance) is transitional and likely does NOT migrate.

## Present-vs-missing target structures (backlog — read-only check 2026-06-17)
Of the 6 target structures, which already EXIST as real directories/mechanisms in delivery-os:
- **Wiki** — PRESENT (`wiki/`, KUs with the frontmatter contract).
- **Skill** — PRESENT (`skills/`, plus `.claude/skills/`).
- **Workflow** — MISSING (no workflow engine/dir; "Workflow orchestration" is only named aspirationally in the
  migration table).
- **Health** — MISSING (only a `capabilities/health-snapshot.json` artifact exists; no Health structure/mechanism).
- **Objective** — MISSING (completion logic lives as prose in `AUTONOMOUS-EXECUTION-DEFINITION.md` /
  `V6-LANDED-DEFINITION.md` completeness gates; no first-class Objective structure).

**Backlog rule:** the 3 missing structures (Workflow / Health / Objective) are **create-when-first-needed**,
NOT built now. Classification can still TARGET a missing bucket today (record the intended home); the structure
gets created the first time a real capability needs to land there.

## Standing rule (added to the architecture roadmap)
When building any capability, ask: is this shared intelligence or app-specific execution? If shared, author it
once for Founder OS (proven in Admin during the proving phase, then promoted to canonical + inherited), never
re-implemented per app. Promotion-to-shared still requires the proven-reuse gate (a 2nd app inherits + runs
green) from v6-end-state-architecture. Migration executes in the gated post-proof steps.
