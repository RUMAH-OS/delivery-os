---
review: foundation
date: 2026-06-27
change: "hook-path integrity fix + check-hook-paths regression gate (commit 778f51f) — founder-action-package MODULE_NOT_FOUND class, ADR-003 L2"
author: software-engineer (implementing engineer agent — authored commit 778f51f)
reviewer: reviewer-critic + lead-architect (blind, independent lenses — NOT the author)
verdict: STABLE — build on it
lenses: "reviewer-critic (internal consistency / contradictions) + lead-architect (forward structural gaps), run blind + in parallel, then consolidated"
---

# Foundation Review — hook-path integrity + check-hook-paths regression gate

> Auto-triggered by the Review-Class Trigger (Governance §14 · ADR-003 L2) for a platform-capability /
> governance change. Question: **are the foundations this change builds on still internally consistent +
> still valid?** Two INDEPENDENT lenses worked BLIND + in parallel (reviewer-critic = contradictions /
> consistency · lead-architect = forward gaps), then consolidated. No single agent — orchestrator included —
> concludes alone (§11). Constraint: do not redesign unless necessary.

## Foundation set reviewed

The load-bearing foundations this change rests on, cross-checked against the just-built reality on disk
(commit 778f51f) and the independent verification (`docs/verify/VERIFY-hook-path-integrity.md`, PASS):

- **The hook/tool execution model** — every framework hook and skill-named tool runs with `cwd` =
  the delivery-os root (`$CLAUDE_PROJECT_DIR`): `.claude/settings.json` invokes `node .claude/hooks/…`;
  `.githooks/pre-push` (wired via `core.hooksPath`) invokes `node .claude/tools/…`. The repo-root is the
  one resolution base.
- **The repo-root-relative tool-path convention** — a skill that names a mechanical tool must name it by a
  path that resolves from the repo root (e.g. `templates/tools/boundary-classify.mjs`), never by a bare
  basename or a path a reader could anchor to the skill's own directory.
- **The fail-closed governance-gate pattern** — the existing pre-push spine (verify-gate · check-os-drift ·
  review-trigger) is fail-closed: an unprovable condition blocks. `check-hook-paths` is the newest member of
  that family and must inherit the same posture.
- **One-source-of-truth-per-concern (§7)** — reference-resolution integrity should have exactly one owner,
  not be smeared across `validate-skills` (frontmatter format) and ad-hoc reading.
- **The self-install lag (CLAUDE.md §9, v3.8)** — `.claude/{hooks,tools}` and `.githooks/` are known to trail
  `templates/`; any new gate must degrade honestly on the consumer layout until the re-sync.

## VERDICT: STABLE — build on it

- **Consistency (reviewer-critic):** Coherent. The root cause was correctly diagnosed as a *misreference*,
  not a missing tool — the two spine tools (`boundary-classify.mjs`, `goal-stop.mjs`) exist, are
  `node --check`-clean, and pass `--self-test`; only the SKILL.md path style was wrong. The fix removes the
  contradiction at its source: both SKILL.md tree copies (`skills/` + `.claude/skills/`) are made byte-identical
  (same sha256 in the VERIFY) and every spine reference is made an explicit `templates/tools/<x>.mjs` path,
  with the convention now stated in-band. No new contradiction is introduced; the previously-silent ambiguity
  is closed by an executable check rather than by prose alone.
- **Forward gaps (lead-architect):** The model still supports the vision. Reference integrity gains a single
  owner (`check-hook-paths.mjs` — source of truth at `templates/tools/`, framework wrapper at `scripts/`),
  cleanly separated from `validate-skills` (format) — one-source-of-truth-per-concern is honored rather than
  overloaded. The gate is wired at every place a misreference could enter or propagate: pre-push Gate 4
  (framework), pre-push Gate 5 (consumer template), the scaffolder (`new-project.sh` install + post-install
  verify), and CI (`templates/workflows/hook-path-integrity.yml`, registered in
  `capabilities/os-foundation.manifest.json` `workflows[]` so consumers inherit it). This is additive-only —
  no redesign of the existing spine — and it strengthens, not weakens, the governance floor.

## Findings + fixes

| # | Sev | Finding | Fix applied / required |
|---|-----|---------|------------------------|
| F1 | Should | Reference-resolution was un-owned: `validate-skills` lints frontmatter format only and never proved a referenced `.mjs` resolves + loads. A dead/misreferenced reference could reach production. | Closed — `check-hook-paths.mjs` owns reference integrity as a distinct concern; fail-closed; `--self-test` reproduces the exact incident class (skill-relative nested path) plus missing-tool, `node --check` syntax-error, and unresolvable-bare-ref, and asserts an exact failure count so a flag-everything checker cannot pass. |
| F2 | Should | The canonical path convention existed only as tribal knowledge — a skill author could not tell a repo-root path from a skill-relative one by reading the file. | Closed — convention stated in-band in `founder-action-package/SKILL.md`; every executable invocation carries the explicit `templates/tools/<x>.mjs` path. |
| F3 | Nice | Fail-closed correctness depends on the self-test actually biting, not being a stub. | Verified independently (VERIFY §1): the self-test builds a real temp tree and asserts the gate FAILS on each sub-class via real `must(...)` assertions; not stubbed. |
| F4 | Nice (caveat, non-blocking) | The framework repo does NOT yet contain `.claude/tools/check-hook-paths.mjs`; Gate 5's `.claude/tools/…` reference (the CONSUMER install layout) is soft-guarded by `[ -f … ]`. | Accept as-is for this slice — the framework's own Gate 4 runs `scripts/check-hook-paths.mjs` (present), so the framework IS protected; the soft-guard is correct for a consumer template copied by the scaffolder. Consistent with the documented v3.8 self-install lag (CLAUDE.md §9, VERIFY C1). Flagged for the eventual re-sync; not a defect here. |

## Conclusion

The foundations are STABLE to build this change on. The repo-root-relative tool-path convention is sound and
is now consistently applied (both SKILL.md copies byte-identical, convention in-band) and machine-enforced for
every consumer via the inherited tool + CI workflow. The new gate's fail-closed design is correct and proven to
bite (independent VERIFY: PASS, 34 references, 0 broken; self-test catches all four sub-classes). The fix
strengthens the governance foundation — it gives reference-resolution integrity a single owner and makes the
founder-action-package MODULE_NOT_FOUND class impossible to ship again. The only open item is the honest,
non-blocking C1 self-install lag (Gate 5's consumer path soft-guarded), which is pre-existing, documented, and
correctly deferred to the re-sync. Nothing must change first.
