# Delivery OS v3 — AI-OS reference-model alignment

> Per founder mandate: for **every major component**, document (a) how it **maps** to the AI Operating System reference model, (b) where it **intentionally differs**, (c) **why** that deviation is necessary. **The burden of proof is on the deviation.** The reference model remains the target philosophy: *"align Delivery OS as closely as possible with the operating-system model while preserving the strengths we have already built,"* interpreted as **build the OS concepts in their minimal, earned form.**

The governing principle behind every deviation is one of: **Waterline** (`GOVERNANCE §8` — don't build a platform until a second consumer pulls), **one-source-of-truth** (`§7` — no duplication/drift), **author≠verifier / §11 independence** (`§3/§11`), or **honest failure** (`§5` — no mechanism that fails silently). Where none of these is invoked, there is **no deviation** — we match the model.

---

## 1. CLAUDE.md Router
- **Maps to:** the OS **kernel / entrypoint** — the single always-loaded artifact through which Claude reaches everything (identity, mission, north-star, wiki, skills, agents, worlds, ecosystem docs, active state) **without remembering where things live.** Full match to "CLAUDE.md is the router, not a prompt, not an index, the entrypoint into the ecosystem."
- **Deviation:** the router **POINTS, never RESTATES** — it carries addresses + the project's own owned facts (identity, phase, own edges), never restated cross-project facts or inlined canonical content. It is **hand-maintained** (with a visible "Last reconciled" date), not CI-generated-between-markers.
- **Why (burden met):** *one-source-of-truth* — a router that inlines the gate criteria / invariants / ownership rows becomes a second store on the most-loaded file in the repo, and a duplicate is *more* to keep in sync = *more* cognitive load, the opposite of the goal. *Honest failure* — a CI generator/linter that cannot run (projects without CI, e.g. Rumah Admin) would fail silently; hand-maintenance + the Write-back step + a reconcile date is the honest minimal form. **CI generation is deferred, not rejected** — it's added when a project has CI (the second consumer that earns it).

## 2. Skills system
- **Maps to:** the OS **Capabilities layer** — reusable verbs the system invokes. Full match: existing procedures (discovery, grill-me, migration-assessment, the §11 panel, production-readiness, ecosystem-alignment) are promoted to first-class callable skills.
- **Deviation:** we **reuse Claude Code's native skill mechanism** (`.claude/skills/<name>/SKILL.md`, `description` = dispatch) instead of a bespoke skill runtime; **no registry, resolver, or dependency-solver**; versioning is a frontmatter field + in-file changelog; **improvement is human-gated** (a skill never self-tunes). Six skills, not eight (architecture/roadmap reviews are decision-class parameterizations of `principle-11-review`).
- **Why (burden met):** *Waterline* — the native mechanism already does discovery + dispatch; a custom registry/resolver is speculative platform with no second consumer pulling. *author≠verifier* — a self-tuning skill would let the instrument rewrite its own ruler. *§11 independence* — the skill encodes §11 but never lets the orchestrator pre-conclude; it makes the *required* review **easier to invoke**, never **more often required.**

## 3. Wiki / knowledge layer
- **Maps to:** the OS **Context layer** — durable, navigable knowledge Claude can traverse. Match: project-local narrative, learnings, customer/market understanding, business processes, operational context live locally and are navigable via `_index.md`.
- **Deviation:** **subordinate, not sovereign.** Ecosystem facts stay owned by `ecosystem-architecture/`; `wiki/{decisions,glossary,projects}` are **dropped** (LOCKED duplicates); `wiki/customers` is **playbook-only, zero records**; folders are **earned, not scaffolded**; every page carries a `source_of_truth`/`last_verified` contract.
- **Why (burden met):** *one-source-of-truth* — the ecosystem layer self-declares as "the single source of truth for portfolio knowledge" and is LOCKED (ECR-0003); a parallel wiki copy is a guaranteed drift defect. The CRM zero-records rule is *ratified* (ECR-0003 — "no second CRM store"). The model wants "a knowledge layer Claude can navigate naturally"; we deliver exactly that for the *homeless* slice and **point** for everything owned elsewhere — which is the model's intent (navigate naturally) achieved without its failure mode (a second brain).

## 4. Knowledge cadence (Write-back)
- **Maps to:** the OS **continuous-write-back / context-hygiene** concern — knowledge must flow back or the layer decays. Full match, and treated as first-class (the founder calls it possibly the most important addition).
- **Deviation:** implemented as **one step in the existing operating loop** (`… Status → Write-back → Continue`) + a periodic hygiene pass — **not** a separate subsystem, agent, cron, or ceremony. A single routing table sends each learning to its **one** home (memory = inbox/WAL, never authority; cross-project → ECR, never the wiki).
- **Why (burden met):** *minimal-not-governance* — a separate "context-hygiene rite" is the bureaucracy the founder rejected; a loop step is cheap enough to actually happen every slice, which is what prevents rot. *one-source-of-truth* — the single-destination router is what stops write-back from *creating* duplication (the same insight landing in memory + wiki + an ECR).

## 5. Ecosystem awareness / Worlds routing
- **Maps to:** the OS **"other worlds" routing** — Delivery OS, Ecosystem Architecture, Rumah Website, Property Lead OS, Rumah Admin, and future projects are **explicitly routable and discoverable**, not discovered accidentally. Match: the router §7 declares them.
- **Deviation:** Worlds is a **section of the router**, not a separate `ECOSYSTEM.md`/`WORLDS.md` or a routing *engine*; a project declares **only its own edges** and **points** to `ecosystem-architecture` for the far end; it is a pointer list, not a portfolio catalog.
- **Why (burden met):** *one-source-of-truth* — `ecosystem-architecture/{02,05,06,09,11}` already own the cross-project graph; a per-project catalog of other worlds' internals re-creates and drifts from it. *Minimal/one-entrypoint* — once the CI reconciliation machinery is deferred (honest-failure), a separate file only adds a navigation hop on the most cross-cutting question; a router section keeps the single entrypoint the founder asked for. **Promote to a separate, linter-verified `ECOSYSTEM.md` when the worlds list grows or CI exists** (the earning trigger).

---

## Content OS (future consumer — NOT built)
- **Maps to:** a future **consumer** of this substrate (router + skills + knowledge corpus + write-back) for its *upstream half* (capture/retrieve/transform); its *downstream half* (synthesis, posting, avatar, voice) is **runtime product** governed by `processes/ai-product-engineering.md`, human-gated per §6.
- **Deviation from "build it":** we build **nothing** content-specific. Only 5 cheap, **today-justified** affordances (`audience`/`confidentiality`/`author`/`id`/the documented contract) are added — each would be added even if Content OS never existed (security/operability/clarity).
- **Why (burden met):** *Waterline* — a Status-Future/Priority-Medium project that isn't even registered is not a pulling consumer; it earns zero speculative build. Content OS is **evidence the minimal shape is right**, recorded in `ecosystem-architecture/03` as a candidate — not a build target.

---

## Summary: where we MATCH vs DEVIATE
| Component | Match to AI-OS model | Deviation | Governing reason |
|---|---|---|---|
| Router | full (entrypoint kernel) | points-never-restates; hand-maintained | §7, honest-failure |
| Skills | full (capabilities) | native mechanism; no registry; human-gated | Waterline, §3/§11 |
| Wiki | full (context) for homeless knowledge | subordinate; zero-records; earned folders | §7, ECR-0003 |
| Cadence | full (write-back) | a loop step, not a subsystem | minimal, §7 |
| Worlds | full (other worlds) | a router section; own-edges-only | §7, one-entrypoint |

**Every deviation is a *narrowing* toward the minimal earned form — never an expansion. The burden of proof on each is met by a named Governance principle.**
