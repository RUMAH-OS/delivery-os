---
slice: "readme — public front door accurately describes the v3.6 enforced baseline"
verify_status: verified
author: "orchestrator-build-session"
verifier: "independent-qa-subagent-readme"
date: "2026-06-10"
independence_basis: "recorded-distinct-invocation"
---

# VERIFY — README is the accurate public front door for the v3.6 enforced baseline

**Question:** *If a new user lands on the GitHub repo today and reads ONLY the `README.md`, will they understand the actual architecture that new projects inherit?*

**Method:** Read the full new `README.md`. For each of 10 concepts, classified Accurately-present / Partial / Missing-Wrong and cross-checked every claim against the framework as it actually exists on disk (templates, scaffolder, governance, dogfood `.claude/`, tags) — not against the README's own word. Ran the contradiction hunt against the four known old-README sins. Resolved every internal link.

## 10-concept table

| # | Concept | Classification | README evidence | Baseline cross-check (on disk) |
|---|---|---|---|---|
| 1 | CLAUDE.md as kernel; §5/§6/§9 derived | **Accurate** | §1: "The entrypoint is `CLAUDE.md`… Its **state** sections (§5 Skills / §6 Agents / §9 verification) are **derived from disk** by `.claude/tools/render-kernel.mjs`… its **intent** sections are hand-authored." | `templates/CLAUDE.md.template` carries the `KERNEL RULE` comment (lines 27-30): §5/§6/§9 are STATE rendered by `render-kernel.mjs`, §1-4,7,8 are INTENT. `render-kernel.mjs` rebuilds the §5 skills table from `.claude/skills/*/SKILL.md` and the §9 line from `.verify-state.json`. Matches exactly. |
| 2 | Verify-gate: in-session + committed pre-push range backstop, monorepo-aware | **Accurate** | §2: "blocks an in-session turn **and** a commit… A committed `pre-push` hook (`core.hooksPath`)… inspects the **committed push range**… monorepo-aware (`apps/**`, `packages/**`, `services/**`)." | `templates/hooks/verify-gate.mjs` has `post-write`/`pre-commit`/`stop`/`pre-push` modes; `pre-push` (lines 158-189) diffs the committed range fed on stdin, reads the VERIFY at the tip commit. `IMPL_BASE` (line 32) = `^(src|app|lib|api|migrations|db)\/|^(apps|packages|services)\/[^/]+\/`. `templates/githooks/pre-push` runs it via `core.hooksPath`. Matches. |
| 3 | Author≠Verifier operationalized (§12) | **Accurate** | §2: "structural write-binding (the verifier cannot edit what it grades)… CODEOWNERS… distinct verifier run where it doesn't. Status… **derived from evidence, never self-asserted**. *Honest limit:*… cannot prove the verification was *truthful*." | `core/GOVERNANCE.md` §12 (lines 51-60): no-VCS fallback = separate verifier run; "Status is derived, never self-asserted"; verbatim "Honest limit (stated, not hidden)… cannot prove the verification was *truthful* or genuinely independent." §13 line 65 calls it "author≠verifier as a structural write-binding". Matches. |
| 4 | Base+Overlay replaces flat-copy, survives bumps | **Accurate** | §3: "Copied-base + Local-overlay… `os-sync` merges them into `.claude/agents/`… survive a framework version bump… *(This replaces the old flat 'copy agents into `.claude/agents/`' model.)*" | `scripts/new-project.sh` lines 25-30 create `.claude/base/agents`+`.claude/overlay/agents`, copy lean+pack agents into **base**; line 108 runs `os-sync.mjs`. `templates/tools/os-sync.mjs` merges base + overlay (wrapped in LOCAL-OVERLAY markers) into `.claude/agents/`. Matches. |
| 5 | Drift detection, run on push | **Accurate** | §2: "fails the push if the router or CODEOWNERS advertises a skill/agent not on disk (phantom dispatch) or a void ownership handle." | `templates/tools/check-os-drift.mjs` fails (exit 1) on §5 skill rows with no `SKILL.md` and on CODEOWNERS `@handle` with no agent file. `templates/githooks/pre-push` Gate 2 runs it and blocks push on exit 1. Matches. |
| 6 | Version boundary (os_version stamp, tags, behind-detection) | **Accurate** | §2: "annotated tags + an `os_version` stamp recording the OS version a project **consumed**, with 'behind' detection." §5/install reaffirm version stamp. | `os-sync.mjs` stamps `state.os_version` (cfg.os_version ?? git describe). Scaffolder line 104 records `os_version` into `.verify-config.json`. `check-os-drift.mjs` lines 43-44 WARN when stamp is behind latest tag. `git tag -l` → v3.0…v3.6, all **annotated** (`git cat-file -t v3.6` = `tag`). Baseline v3.6 matches README. Matches. |
| 7 | Skills — 7 installed; verify-gate fires, rest model-dispatched | **Accurate** | §3: lists 7 (discovery-interview · grill-me · migration-assessment · principle-11-review · production-readiness-review · ecosystem-alignment-review · verify-gate); "`verify-gate` fires mechanically; the rest are model-dispatched **by design**." | `skills/` holds exactly those 7 dirs (+README). Scaffolder line 46 installs all 7. `skills/README.md` line 21: native `.claude/skills/` dispatch by `description` match; §9/§4 of README: "6 of 7 skills are model-dispatched (judgment, not a defect)". Matches. |
| 8 | Wiki contract (kind/as_of/records-vs-understanding) | **Accurate** | §3: "`templates/wiki/FRONTMATTER-CONTRACT.md`… `kind`+`as_of` typed, **records vs understanding** enforced; it POINTS, never restates." | Contract file has `kind` (mandatory, taxonomy), `as_of` (required for `kind: finding`), the explicit "**records vs. understanding**" dividing line, and "POINT, never restate." Scaffolder line 79 installs it; line 125 fail-closes if absent. Matches. |
| 9 | Mechanism vs Policy (§13) | **Accurate** | §2: "**mechanism = key; policy = prompt**… thin kernel mechanisms… non-swappable; the large governance *policy*… versioned and swappable. **Principle 11**… is policy… not a hook." | `core/GOVERNANCE.md` §13 (lines 62-68): "mechanism = key; policy = prompt"; KERNEL MECHANISM list vs GOVERNANCE POLICY list; "**§11 is policy, not a mechanism**… its consequential-decision list and two-lens floor are inherited and non-swappable." Matches. |
| 10 | Dogfooding (live `.claude/` with gate; `docs/verify/` records) | **Accurate** | §4: "live `.claude/` with the verify-gate wired (`core.hooksPath`)… caught real turns… a gitless gate, an `untagged` stamp, a missing wiki contract, a working-tree-only backstop — each fixed." | `delivery-os/.claude/` has `settings.json` (PreToolUse/PostToolUse/Stop → verify-gate.mjs), `hooks/verify-gate.mjs`, `base/overlay/agents` (overlay specializes qa-test), `tools/`, 7 skills; `git config core.hooksPath` = `.githooks`. `docs/verify/` holds 6 verified, independent records (prepush-fix = working-tree→push-range; apps-impl-surface = monorepo widening; inheritance; step3-dogfood; framework-update; enforcement-vs-memory) — each `verify_status: verified`, author≠verifier. The cited defects map to real records. Matches. |

**Result: 10/10 Accurately present. 0 Partial, 0 Missing/Wrong.**

## Contradiction hunt (the old README actively misled — confirm each sin is gone)

- **(a) Titled "v2"?** NO. Title is "# Delivery OS"; line 5 "**Current baseline: v3.6** (this README current as of v3.7)". The only v2 reference is a backward link `CHANGELOG-v2.md` (history), which is correct. **Resolved.**
- **(b) Entrypoint routed through PROJECT-SELECTION as "the front door"?** NO. §1 names `CLAUDE.md` the entrypoint and explicitly demotes pack-selection: "*(Pack selection… is a pointer: PROJECT-SELECTION.md. It is no longer the entrypoint; the kernel is.)*". **Resolved.**
- **(c) Flat-copy agents into `.claude/agents/`?** NO. §3 teaches base+overlay and explicitly retires the old model: "*(This replaces the old flat 'copy agents into `.claude/agents/`' model.)*". The on-disk scaffolder copies into `.claude/base/agents` and synthesizes `.claude/agents/` via `os-sync`, consistent with the README. **Resolved.**
- **(d) Core loop missing Write-back / verification?** NO. §6: "Implement → Commit (hash) → Independent QA (VERIFY artifact, author≠verifier) → Domain Review → Documentation → Status → **Write-back** → Continue" — both verification and Write-back present; identical to canonical `core/OPERATING-LOOP.md` line 4. **Resolved.**

No residual contradiction.

## Over-claim audit (adversarial)

Probed the strongest enforcement claims for anything asserted-as-enforced that isn't:
- "fail-closed if any mechanism is missing" (§8) — backed: scaffolder lines 117-126 abort on any missing mechanism, missing base+overlay, missing doctrine, missing wiki contract, or absent os_version. Honest.
- The README does **not** over-claim CODEOWNERS: §9 correctly lists it under "By-design / external… needs **GitHub branch protection** enabled by you," and §2's Honest-limit states the gate proves an artifact *exists*, not that verification was *truthful*. This is the honest framing, not an over-claim.
- "annotated tags" (§2) — verified annotated on disk. Not an over-claim.
- The §6 parenthetical "(VERIFY artifact, author≠verifier)" amplifies the canonical loop's "Independent QA" step; it is accurate, not invented.

No over-claim found.

## Link resolution

All README links resolve on disk: `docs/verify/`, `proposals/` (+ `proposals/DELIVERY-OS-AI-OS-ARCHITECTURE-LOCK.md`), `CLAUDE.md`, `PROJECT-SELECTION.md`, `templates/hooks/verify-gate.mjs`, `templates/tools/check-os-drift.mjs`, `templates/wiki/FRONTMATTER-CONTRACT.md`, `core/OPERATING-LOOP.md`, `core/DEFINITION-OF-DONE.md`, `domain-packs/PACKS.md`, `discovery/FOUNDER-INTERVIEW.md`, `GETTING-STARTED.md`, `CHANGELOG-v3.md`, `CHANGELOG-v2.md`. No dangling links.

## Answer to the question

**YES.** A new user who reads only this README will understand the actual architecture that new projects inherit, and the understanding will be correct. Every load-bearing claim — the `CLAUDE.md` kernel with disk-derived state, the dual verify-gate (in-session hook + committed push-range pre-push backstop, monorepo-aware), author≠verifier as a structural write-binding with derived status and a stated honest limit, base+overlay surviving version bumps, drift-lint, the consumed-version stamp, the 7 skills (1 mechanical / 6 model-dispatched by design), the wiki records-vs-understanding contract, mechanism-vs-policy, and dogfooding — was independently confirmed against the framework as it exists on disk, not merely taken from the README's word. All four old-README contradictions are gone, no over-claim survives, and every internal link resolves. The README honestly separates what is enforced from what is by-design/external (notably that CODEOWNERS needs the user to enable GitHub branch protection), so it neither over-sells nor hides a gap.

**verify_status: verified.**
