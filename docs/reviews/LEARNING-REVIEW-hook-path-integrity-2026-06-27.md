---
event: "incident"
date: "2026-06-27"
change: "Hook/tool reference-path integrity — root-cause fix for the founder-action-package MODULE_NOT_FOUND"
triaged_by: "software-engineer (reconstructed from disk state + git, not memory)"
milestone: "platform-integrity slice"
---

# Learning Review — Hook/tool reference-path integrity

> Auto-triggered by the Review-Class Trigger (Governance §14 · ADR-003 L2): a platform-capability change
> (a new fail-closed governance gate + a hook-path fix) is L2. This is its L2 artifact.

## 1. Reconstruct from artifacts (commits · VERIFY docs · ledgers · disk state)

- The `founder-action-package` skill (`.claude/skills/founder-action-package/SKILL.md`, mirror of
  `skills/founder-action-package/SKILL.md`) names its mechanical spine as
  `templates/tools/boundary-classify.mjs`, `templates/tools/goal-stop.mjs`, and
  `templates/FOUNDER-ACTION-PACKAGE.md.template`.
- Those files live at the **delivery-os root** `templates/tools/` and `templates/` (confirmed on disk:
  `templates/tools/boundary-classify.mjs`, `templates/tools/goal-stop.mjs` both exist, `node --check`-clean,
  `--self-test` exit 0). The skill's own directory contains **only `SKILL.md`** — no `templates/` subtree.
- Every hook/tool invocation in this framework runs with **cwd = the delivery-os root** (`$CLAUDE_PROJECT_DIR`):
  `.claude/settings.json` calls `node .claude/hooks/verify-gate.mjs …`; `.githooks/pre-push` (wired via
  `core.hooksPath`) calls `node .claude/tools/…`. So a repo-root-relative `templates/tools/X.mjs` resolves;
  a path resolved against the **skill's base dir** becomes
  `…/.claude/skills/founder-action-package/templates/tools/boundary-classify.mjs` → **does not exist** → MODULE_NOT_FOUND.
- The prior format lint (`validate-skills.mjs`) checks frontmatter shape only; it never proves a referenced
  `.mjs` resolves or loads. Nothing on the push path tested reference resolution.

## 2. Were any framework-level lessons discovered?

Yes — one structural lesson: **skill-relative vs repo-root path ambiguity is a recurring trap.** The tools
were never missing or unpropagated; they were **MISREFERENCED** by a path style that is correct from the
repo root but wrong from the skill's own dir. A skill author cannot tell the two apart by reading the file,
and no gate caught the difference. This is a class, not a one-off (the same trap recurs for any new skill
that names a tool by bare filename or by a path a reader could anchor to the wrong base).

## 3. Capability impact (the §14 routing)

| Lesson | Layer | Asset | Destination |
|--------|-------|-------|-------------|
| Tool/hook references must resolve unambiguously from the repo root, never the skill dir | Delivery OS | **lint** (new fail-closed gate) | `templates/tools/check-hook-paths.mjs` + `scripts/check-hook-paths.mjs`; pre-push Gate 4/5 + `templates/workflows/hook-path-integrity.yml` |
| The canonical path convention was never stated in-band | Delivery OS | **skill** | `founder-action-package/SKILL.md` now states "every path is repo-root-relative (`$CLAUDE_PROJECT_DIR`), never the skill's own dir" + makes every spine reference explicit `templates/tools/…` |
| A misreferenced hook could reach production | Delivery OS | **process/ledger-row** | gate wired into the scaffolder install + post-install verify, both pre-push templates, and the manifest `workflows[]` (consumers inherit it) |

## 4. Did any EXISTING capability fail to catch this?

- **`validate-skills.mjs`** — should arguably have caught a dead tool reference, but by charter it lints
  frontmatter FORMAT, not reference RESOLUTION. Rather than overload it, the new `check-hook-paths.mjs` owns
  reference integrity (one source of truth per concern). It is the capability that "should have fired and
  didn't" — and its absence is exactly what earned this review's gate (same pattern that earned the trigger
  which produced this review).
- **The verify-gate / pre-push stack** — proves VERIFY coverage + drift + agent routing, but had no check
  that a referenced `.mjs` exists and loads. Now closed by Gate 4 (framework) / Gate 5 (consumer template).

## 5. Blast-radius fork

- **Project-local lessons** → implemented in this same series:
  - `founder-action-package/SKILL.md` (both trees, byte-identical): all spine references made explicit
    repo-root `templates/tools/…` paths; convention stated in-band; version 1.0.0 → 1.0.1.
  - New gate `templates/tools/check-hook-paths.mjs` (+ `scripts/check-hook-paths.mjs` wrapper) with
    `--self-test` (proves it FAILS on missing / broken-`node --check` / unresolvable-bare / the exact
    skill-relative-nested class, and PASSES valid explicit/bare/co-located refs).
  - Wired into `.githooks/pre-push` (Gate 4) + `templates/githooks/pre-push` (Gate 5) + `scripts/new-project.sh`
    (install + post-install verify) + `templates/workflows/hook-path-integrity.yml` (server-side, registered
    in `capabilities/os-foundation.manifest.json` `workflows[]`).
- **OS-base / cross-system lessons** → the canonical convention is now machine-enforced for every consumer
  via the inherited tool + workflow; no separate OS-FEEDBACK design is required (the fix IS the design,
  shipped through the normal inheritance seam). Honest note: the gate enforces resolution + load, not prose
  hygiene — a tool named only in narrative prose by bare filename still resolves (it is found in
  `templates/tools/`), so authors should keep naming the explicit path; the gate guarantees no
  MODULE_NOT_FOUND regardless.

## Verification (runtime-evidence)

- `node scripts/check-hook-paths.mjs --self-test` → exit 0 (flags missing + broken + unresolvable-bare +
  skill-relative-nested; passes valid explicit/bare/co-located).
- `node scripts/check-hook-paths.mjs` → exit 0, 33 references, 0 broken (every governance hook + skill tool
  reference resolves + `node --check`-loads).
- Governance tool load probes all exit 0: `boundary-classify --self-test`, `goal-stop --self-test`,
  `review-trigger --self-test`, `learning-trigger --self-test`, `learning-classify --self-test`,
  `founder-review-package --self-test`, `verify-gate.mjs` `node --check`, `check-os-drift`, `agents-check`.
  No MODULE_NOT_FOUND.
