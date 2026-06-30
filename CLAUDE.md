# Delivery OS — Router (self-hosted kernel; the framework dogfoods its own gate)

> Delivery OS v3 router: the single entrypoint. It **ANSWERS or POINTS, never restates.**
> This is the framework's live kernel — the reference instance of `templates/CLAUDE.md.template`.
> **Honest status (as of v3.3, dogfood-proven):** the framework now **self-installs and runs its own
> verify-gate** (`delivery-os/.claude/` with the hook + `core.hooksPath` pre-push). §5/§6/§9 below are
> **derived from disk** by `.claude/tools/render-kernel.mjs`; `.claude/tools/check-os-drift.mjs` blocks a
> push if they advertise anything not on disk. Evidence: `docs/verify/VERIFY-step3-dogfood.md`,
> `docs/verify/VERIFY-framework-update.md`. The framework consumes the same architecture it ships.
> If this file disagrees with a canonical source under `core/`, the **canonical source wins — fix this file.**
> Last reconciled: 2026-06-10 (v3.3).

## 1. Identity  — *what is this?*
**Delivery OS** — a reusable **AI operating system / delivery framework** for building software with Claude: a navigation **kernel** (this router + skills + wiki) over an intact **execution spine** (loop · DoD · governance · packs). Distilled clean-room from two real projects; **names no project except in `case-studies/`**. → `README.md`, `proposals/DELIVERY-OS-v3-AI-OS-ALIGNMENT.md`

## 2. Mission  — *mission?*
Make Delivery OS **easy for Claude to operate inside** — low cognitive load, high retrieval/routing/reuse — without weakening the delivery spine. **Operability, not governance bloat.**

## 3. North Star  — *north star?*
The **AI Operating System reference model**: CLAUDE.md is the kernel; skills are callable capabilities; the wiki is the context layer; governance is the **enforced floor invoked through** the OS, never the front door.
**Invariants (outrank any change):** POINTS-never-RESTATES · one-source-of-truth-per-concern (§7) · author≠verifier (§3) · **verification is operationally enforced, not remembered (§12)** · no speculative scaffolding (Waterline §8) · surface disagreements, never smooth them (§11) · **infrastructure-agnostic core / Repository Principle** — Delivery OS is one repo of co-evolving subsystems; the repo boundary is NOT the architectural boundary; the Runtime depends on nothing outward (no adapter subsystem, no concrete environment: Neo/Docker/Tailscale/runner/Slack); dependencies flow strictly inward through contracts; consumers stay in separate repos. Dependency direction is clean today (independently re-verified 2026-06-30); to be made structural by a dependency-direction gate + a standing Delete Test — **DESIGNED, not yet built** → `docs/architecture/PRINCIPLE-repository-and-dependency-rule.md` (principle ratified 2026-06-30; enforcement pending implementation).

## 4. Wiki  — *where is the framework's own knowledge?*
Delivery OS keeps its durable knowledge as **append-only history**, not a project wiki:
| Knowledge | Home |
|---|---|
| Design rationale + ratified panels (the WAL) | `proposals/` (v3 R1/R2/R3 · v3.1 verification-enforcement) |
| Lessons earned from live failures | `case-studies/` (v4: `2026-06-incident-ledger.md` — the provenance of every promotion) |
| Version deltas (provenance spine) | `CHANGELOG-v2.md` · `CHANGELOG-v3.md` · `CHANGELOG-v4.md` (+ `docs/feedback/` triages) |
| The wiki layer | **retired at v4 (F6)** → `docs/archive/` + `case-studies/2026-06-wiki-citation-survival.md`; knowledge = three-tier memory + four registries |

## 5. Skills  — *what can be called?*  (`skills/<name>/SKILL.md` — the framework's own verbs)
| Skill | Use when | Status |
|---|---|---|
| discovery-interview | Conduct the Founder Discovery Interview and generate PROJECT-BRI | stable |
| ecosystem-alignment-review | Cross-check a project's owned/consumed entities against the ecos | stable |
| grill-me | Adversarial, deep follow-up interview that pushes each load-bear | experimental |
| migration-assessment | Read-only, capability-by-capability audit of an existing/inherit | stable |
| principle-11-review | Run an independent multi-lens review of a CONSEQUENTIAL decision | stable |
| production-readiness-review | Pre-release / pre-cutover go/no-go | stable |
| verify-gate | Operationalizes author≠verifier (Governance §12) | stable |

## 6. Agents  — *who does the work?*  (`agents/` — lean default + pack roles)
software-engineer · qa-test · reviewer-critic · lead-architect · documentation  +  pack roles (security-compliance · database-data · api-integration · ai-product · seo · design-parity).
Loop: `core/OPERATING-LOOP.md` · DoD: `core/DEFINITION-OF-DONE.md` · Author≠verifier (CODEOWNERS, §3).
Consequential decision → run `principle-11-review` (§11). The router **points, it never adjudicates.**

## 7. Worlds  — *what consumes this framework?*  (POINTERS only — `../ecosystem-architecture/` owns the facts)
| World | Path | Edge |
|---|---|---|
| ecosystem-architecture | ../ecosystem-architecture/ | the portfolio truth (registries · ECRs); Delivery OS is the *how*, not a registered *what* |
| property-lead-os (PLOS) | ../property-lead-os/ | consumer (mature; least-instrumented — no router/skills yet) |
| rumah-admin | ../rumah-admin/ | consumer (mid-flight; adopting v3 + verify-gate as it enters git) |
| the-floor · content-os | ../ (future) | future consumers — born-correct via the scaffolder |

## 8. Sources of Truth  — *what governs how we build?*  (one home per concern)
| Concern | Canonical home |
|---|---|
| Operating loop · DoD · governance (§1–§12) · severity | `core/` |
| Domain packs (what attaches by surface) | `domain-packs/` · `core/DEFINITION-OF-DONE.md` |
| Skills / agents / processes / checklists | `skills/` · `agents/` · `processes/` · `checklists/` |
| Scaffolding a new project | `scripts/new-project.sh` · `GETTING-STARTED.md` · `BOOTSTRAP-PROMPT.md` |
| AI-OS mapping + every deviation's burden of proof | `proposals/DELIVERY-OS-v3-AI-OS-ALIGNMENT.md` |

## 9. Active Now  — *what is currently active?*
**Verification status (derived from disk, §12):** os_version `untagged` · skills installed: 15 · gate: `.claude/hooks/verify-gate.mjs` active.
**Phase: the v4.0 CONSOLIDATION — built, awaiting independent ratification.** Branch `v4.0-consolidation`
carries the founder-authorized promotion of two consumers' learning into the base: `CHANGELOG-v4.md` (the
release packet: full #85 translation ledger + F1–F8 signatures + DO-NOT list) · three retroactive §14 triages
in `docs/feedback/` · `VERSION` = v4.0 (tag applied at merge).
**Open (not yet done — author≠verifier):**
- **NOT merged, NOT pushed, NOT tagged** — the F2 consolidated ratification (an independent verification of
  the packet against the #85 ledger) decides; the author does not self-merge.
- **Self-install lag (stated honestly):** `.claude/{hooks,tools,skills}` + `.githooks/` still run the v3.8
  copies — re-sync from `templates/` + re-render at ratification (CHANGELOG-v4 "Honest notes" #1).
- **Consumer adoption by pin at named moments (F1):** PLOS at its learning-review gate firing; rumah-admin at
  June-invoicing completion. Until re-pin, neither repo uninstalls or re-forks anything (anti-third-fork rule).
