# Delivery OS — Router (the framework dogfoods its own kernel)

> Delivery OS v3 router: the single entrypoint. It **ANSWERS or POINTS, never restates.**
> This is the framework operating from its **own** live CLAUDE.md — the reference implementation
> of `templates/CLAUDE.md.template`. If this file disagrees with a canonical source under
> `core/`, the **canonical source wins — fix this file.**
> **Hand-maintained — no generator reconciles it.** Last reconciled: 2026-06-10 (v3.1).

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
| discovery-interview | founder discovery → BRIEF/MISSION/NORTH-STAR | stable |
| grill-me | adversarial follow-up to confidence thresholds | experimental |
| migration-assessment | read-only audit + capability register of an existing system | stable |
| principle-11-review | independent multi-lens review of a consequential decision | stable |
| production-readiness-review | pre-release / cutover go/no-go | stable |
| ecosystem-alignment-review | owns/consumes vs registry; ECR conflicts | stable |
| verify-gate | produce/check a slice's independent VERIFY artifact; diagnose a gate block (§12) | stable |

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
**Phase: framework maintenance.** **Version: v3.1** (verification enforcement — §12 + verify-gate hook).
**Open gates / in-flight:**
- `fix/operationalize-author-verifier` — v3.1 verify-gate (hook dogfood-tested in isolation; **not yet caught a real turn in a live project**; not merged — awaiting ratification).
- `review/ai-os-hierarchy-alignment` — this AI-OS reframing review (see `proposals/DELIVERY-OS-v3-AI-OS-HIERARCHY-REVIEW.md`).
**Known fidelity debt (from the hierarchy review):** README header still says "v2"; no git tags (`v3.0`/`v3.1` are commit subjects, not tags); consumer routers over-claim on-disk capabilities (rumah-admin lists absent `.claude/skills`; PLOS has no router).
**Verification status (§12):** framework changes are governed by the same gate they ship.
