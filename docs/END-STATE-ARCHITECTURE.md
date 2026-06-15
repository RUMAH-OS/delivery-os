# V6 End-State Architecture — the destination (2026-06-15)

> **RATIFIED 2026-06-15 — founder closed the architecture discussion.** This is the LOCKED intended end-state + future migration target. Source-of-Truth=Delivery-OS · Projection=.claude/os · Domain=Application. Roadmap unchanged; prove in Admin before any large-scale PLOS migration.

> Founder-defined DESTINATION. NOT a roadmap change, NOT a migration now, NOT a delay to G4. The current
> backlog + G-sequence stand. This document fixes where v6 is ultimately heading + the board's honest
> refinement of how to make that destination sound. Migration is sequence steps 8–14 (after v6 proven).

## Founder vision (the destination)
Applications should not contain the organizational brain. Apps hold only domain code, workflows, events,
business logic, state. **The organizational brain exists ONCE, in Delivery-OS; applications consume it.**
Knowledge is learned once and reused everywhere. The relationship inverts: today Admin *contains* the OS;
target = **Delivery-OS serves Admin / PLOS / Content-OS / future systems.**

## Board refinement (4 seats; the adversarial seat issued REQUEST-CHANGES — heeded)
The destination is SOUND **as a distribution model**, NOT as a runtime "central brain apps load from."

1. **It is os-inherit at FULL SCALE, not a new runtime mechanism.** "Load the brain from OS_ROOT" happens at **sync time** (vendor byte-current); **runtime/CI always execute the vendored `.claude/os/` copy** — never reach for OS_ROOT. This preserves the CI-self-containment that vendoring was invented for. **Honest reframe (reviewer-critic):** the safe model is *"single-authored, vendored-everywhere, pinned, drift-gated,"* not "centralized." The brain is authored once and **duplicated N times by construction** + drift-checked — call it distribution, not centralization. NO runtime path may read OS_ROOT (block that anti-pattern explicitly).
2. **Blast-radius control is load-bearing.** A shared brain means a bad OS release could red-line every app at once (gates are fail-closed). So **pinning + per-app deliberate `os-inherit sync` (commit-gated, never auto-pushed) + `git revert` rollback** stay mandatory. Today an app sits on its pinned `osVersion` until it deliberately syncs — that isolation must NOT be removed.
3. **Layered model (don't erase base/overlay).** A truly-invariant core (author≠verifier, determinism, fail-closed) is shared/vendored; an app-extensible layer (the existing `base`+`overlay` agent split) lets an app specialize without forking the core. Name what may be centralized vs what stays app-local-and-forkable.
4. **"Learned once, reused everywhere" needs a promotion gate.** Default destination for a lesson = **app-local**; promotion to the shared brain requires **proven ≥2-app reuse** (or a named second consumer). Without this, the shared brain becomes a *more prestigious hiding place for one-app accumulation* — the exact disease v6 exists to kill, relocated.
4b. **CLAUDE.md anti-re-accretion:** "thin" must be a **gate** (a `claudemd-size`/section-budget check in CI), not a doctrine — today's CLAUDE.md already exceeds its own "router, never restates" intent.

## CLAUDE.md end-state role (the board recommendation the founder requested)
CLAUDE.md → **bootstrap · identity · OS loader · application manifest · agent entry point.** Concretely, ~1 screen:
- **Identity / Mission / North-Star+invariants** (domain) — STAY (trimmed, pointers to `docs/`).
- **OS_ROOT declaration + pinned OS version + vendored-mirror path** — the one new structural element; a manifest entry, self-contained literal text (no dependency on the brain, to avoid bootstrap circularity).
- **What-to-load by reference to `os-foundation.manifest.json @ pin`** — NOT a restated skills table / agent roster.
- **Application manifest** (domain surface: src/tests/migrations/workflows, domain invariants, domain SoT) — STAY.
- **Agent entry point** — "agents/skills/governance/wiki/lessons: ask the OS" (one pointer, not a roster).
- **Active-Now** (live URLs, phase, operator queue) — the ONLY inlined app content.
**Moves OUT to Delivery-OS canonical** (rendered/derived in CLAUDE.md, not hand-listed): §4 wiki, §5 skills table, §6 agents, §8 OS/portfolio sources-of-truth, §9 hand-typed status counts. The router stops being hand-maintained brain; the "what OS do I have" answer is generated from `INHERITED.json`.

## Knowledge ownership (documentation seat)
- **Reusable by another app → OS:** lessons (the reusable extraction), skills, governance, agent + capability definitions, trust/adoption/review/routing/learning systems, operating principles, wiki.
- **Domain-specific → app:** invoices/tenants/owners/contracts/signatures/business-workflows (Admin); briefings/recommendations/signals/outreach/contacts (PLOS); ADRs, decision-reviews, verify-docs, migration evidence, src/tests/migrations.
- **Disambiguation rule:** *strip the domain nouns; if it still teaches a second app, it's OS-bound; the noun-bound remainder stays as an app binding.* **Default tie-breaker: promote AND preserve** (the reusable extraction additionally goes to OS; the original stays app-side) → **Knowledge-Lost = 0 by construction** (promotion is never deletion). All 14 current Admin skills classify OS-bound; what stays is pure domain. Precedent: `PLOS-V6-MIGRATION-AUDIT.md`.

## Knowledge-Lost = 0 audit skeleton (fill at migration; GO only when LOST=0)
`| Artifact Type | Before | Migrated→ | Archived | Lost |` — covering skills/agents/gates/hooks/ledger/governance/lessons/verify-docs/slice-records/ADRs/decision-reviews/memory/business-docs/wiki/src-tests-migrations. **Loss surfaces to preserve as first-class payload (reviewer-critic):** earned-from provenance, git history, per-app trust telemetry. The audit must be adversarially verified, not self-attested.

## Two genuinely-new pieces (integration-architect; everything else is os-inherit scaled)
1. **Offline currency proof:** record a **foundation-digest** (sha256 over the manifest-resolved canonical bytes) in `INHERITED.json` so an app proves it's current WITHOUT mounting the OS.
2. **Multi-consumer propagation cross-check:** an OS-side tool that reads every consumer's `INHERITED.json` and asserts each manifest entry is byte-current in EVERY app (the G6/G8 hole at foundation scale) — turns the ledger's "propagated" claim into proof.
Honesty ledger: downward (OS→app) is tamper-evident (hash-checked vendoring); upward (app→OS lessons via file-lesson) is trust-based (append-only, no provenance proof) — named, not hidden. The upward auto-promotion (census) is built but not yet CI-wired.

## Success criteria (founder)
Delivery-OS holds the brain · apps hold only domain · CLAUDE.md is a thin bootstrap · lessons→wiki→skills→measurable→triggerable→trusted→adopted · knowledge preserved · new apps inherit existing intelligence automatically.

## Hard preconditions BEFORE pursuing the destination (reviewer-critic master gate — N=1 risk)
The OS is proven in ONE app, partially (PLOS=0%; the cross-repo workflow is "PASS (partial)"). You cannot
validate "reused everywhere" at N=1. **Before locking/pursuing the N-app end-state:**
1. A **second app (PLOS) inherits the core + runs green self-contained**, and **one cross-repo workflow runs end-to-end** (kill the "partial" state).
2. **One capability is demonstrably reused by app #2** (a single real "learned once, reused" instance).
3. Pinning + per-app deliberate sync + rollback are load-bearing; the promotion-to-shared gate (≥2-app reuse) exists; the CLAUDE.md size budget gate exists.

## Sequencing (UNCHANGED — destination only)
1–7 complete remaining v6 backlog + G4 + Wiki + Skills + Trust + Adoption · 7 validate v6 in real operation ·
8 board on CLAUDE.md role (this doc) · 9 centralize Admin intelligence into Delivery-OS · 10 prove Admin
operates on centralized OS · 11 validate knowledge preservation · 12 validate skill adoption · 13 upgrade
PLOS to v6 · 14 migrate PLOS onto centralized OS. **Nothing migrates now.**

## Final
Delivery-OS becomes the brain (memory · learning · governance · routing · trust · adoption · skills ·
lessons · wiki · autonomy). Apps become specialists. Knowledge learned once; skills generated once; trust
earned once; future apps inherit automatically. **CLAUDE.md is reduced to a lightweight bootstrap — not
eliminated.** Reframed honestly: *single-authored, vendored-everywhere, pinned, drift-gated, proven-reuse-
gated* — pursued only after a second app proves the model.
