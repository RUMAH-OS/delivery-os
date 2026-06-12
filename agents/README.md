# Agents — roster selection & wiring

## Build-time vs runtime agents (critical distinction)
- **Build-time / delivery agents** (this folder) **write and verify the product**. They are the team.
- **Runtime / product agents** are **part of the product** (an AI feature). They are governed by `processes/ai-product-engineering.md` (prompts, tool defs, evals, determinism, agent-run audit) — **not** by this folder.
Conflating the two is a classic mistake; keep them on separate planes.

## Lean default (start here)
- **software-engineer** — builds; owns production code.
- **qa-test** — validates independently; owns `tests/ e2e/ evals/`.
- **reviewer-critic** — conformance + simplicity + scope; owns no files.
- **+ human merge gate.**

Three roles + human merge is the sharpest default. **Scale up only as the project demands.**

## Scale-up roster
- **Standard add-ons:** `lead-architect` (architecture/ADRs/sequencing), `documentation`, `project-manager` (DoD gate, flow).
- **Optional (by surface):** `optional--seo` (public/search), `optional--design-parity` (design fidelity), `optional--accessibility`.
- **Domain (by risk):** `domain--security-compliance`, `domain--database-data`, `domain--api-integration`, `domain--ai-product`.

Your **domain pack** (`domain-packs/PACKS.md`) tells you which to switch on.

## The structural rule: author ≠ verifier via ownership
Encode roles in **CODEOWNERS** so the verifier cannot edit what it grades:
```
*            @software-engineer        # all production code
/tests/      @qa-test
/e2e/        @qa-test
/evals/      @qa-test
/docs/       @owner                    # specs/ADRs
/CODEOWNERS  @owner
```
Production code and its tests live in **different trees owned by different agents** — the structural form of "author ≠ verifier." Defects flow author-ward; no grader patches the work it grades.

## Wiring into Claude Code
Copy the agent files you need into the project's `.claude/agents/` (drop the `optional--`/`domain--` prefix; keep frontmatter `name`/`description`/`tools`). They then load as selectable subagents. Add the CODEOWNERS block. Keep `docs/` (specs, ADRs, this framework) owned by a human.

## Parallelization
Multiple Engineer instances may run in parallel **partitioned by a code-ownership boundary** (e.g. one package each) so one-owner-per-file always holds. Default to **one** instance, one slice at a time (lean first).

## Composition vocabulary (v4, B36)
Three primitives compose the build-time system — name them precisely, because conflating them produced the
panel-sprawl anti-pattern (lenses multiplied where a *procedure* should have been reused):
- **Skill** — a *procedure* (versioned playbook → artifact). Reuse it; don't re-derive it.
- **Persona/agent** — a *lens* (a viewpoint with a tool allowlist + file ownership). Add one for a genuinely
  independent perspective, never for volume — same-model lenses saturate at ~5–6 (Governance §11).
- **Command** — a *trigger* (one keystroke routing intent to a skill: `/friction`, `/panel <class>`, …).
A panel is: a **skill** (principle-11-review) convening a class-sized set of **personas**, fired by a
**command**. "More rigor" means a better procedure or an independent lens — not more of the same lens.
