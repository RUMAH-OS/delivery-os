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
**Invariants (outrank any change):** POINTS-never-RESTATES · one-source-of-truth-per-concern (§7) · author≠verifier (§3) · **verification is operationally enforced, not remembered (§12)** · no speculative scaffolding (Waterline §8) · surface disagreements, never smooth them (§11).

## 4. Wiki  — *where is the framework's own knowledge?*
Delivery OS keeps its durable knowledge as **append-only history**, not a project wiki:
| Knowledge | Home |
|---|---|
| Design rationale + ratified panels (the WAL) | `proposals/` (v3 R1/R2/R3 · v3.1 verification-enforcement) |
| Lessons earned from live failures | `case-studies/` (e.g. `2026-06-10-author-verifier-not-operationalized.md`) |
| Version deltas (provenance spine) | `CHANGELOG-v2.md` · `CHANGELOG-v3.md` |
| The project-wiki *template* shipped to consumers | `templates/wiki/` + `FRONTMATTER-CONTRACT.md` |

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
**Verification status (derived from disk, §12):** os_version `v3.4` · skills installed: 7 · gate: `.claude/hooks/verify-gate.mjs` active.
**Phase: framework maintenance. Version: v3.4.** The AI-OS review sequence (review → lock → dogfood → operationalize → inheritance) is **complete on branch `review/ai-os-hierarchy-alignment`**, awaiting founder authorization to merge → push.
**Resolved (was adversarial-review fidelity debt):**
- The framework **now runs its own verify-gate** (`delivery-os/.claude/`) and it has **caught real turns** (`docs/verify/VERIFY-step3-dogfood.md`, `VERIFY-framework-update.md`).
- **AI-OS learnings are operationalized into the scaffolder and auto-inherited** by a new project — independently verified (`docs/verify/VERIFY-inheritance.md`): verify-gate · author≠verifier · base+overlay · drift-lint · version boundary · wiki contract · §13 mechanism/policy · skills · dogfooding.
- Tags `v3.0…v3.4` exist (local). The architecture lock is `proposals/DELIVERY-OS-AI-OS-ARCHITECTURE-LOCK.md`.
**Open (not yet done):**
- **Not merged to `main`; not pushed to GitHub** — awaiting founder authorization.
- **Consumers not yet adopted:** PLOS + rumah-admin still on the old model; the **PLOS compatibility review** is the next step, then rumah-admin resumes.
- **Bounded limit (cosmetic, cannot bypass enforcement):** a newly-*added* skill is under-advertised in §5 until `render-kernel.mjs` re-runs.
