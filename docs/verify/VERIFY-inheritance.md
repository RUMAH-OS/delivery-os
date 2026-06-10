---
slice: "inheritance — a new project auto-inherits the AI-OS learnings"
verify_status: verified
author: "orchestrator-build-session"
verifier: "independent-qa-subagent-inheritance"
date: "2026-06-10"
independence_basis: "recorded-distinct-invocation"
---

# VERIFY — inheritance: does a BRAND-NEW project auto-inherit the AI-OS learnings?

## Method (independent, adversarial)

Scaffolded a fresh disposable project as a founder receives it, with NO post-scaffold
patching:

```
PARENT=$(mktemp -d); TMP="$PARENT/app"; mkdir -p "$TMP"; cd "$TMP"
bash /c/Users/brian/RUMAH/delivery-os/scripts/new-project.sh "Verify App" ""
```

Scaffold succeeded and self-reported fail-closed wiring:
`os-sync: 5 base + 0 overlay → .claude/agents/ (os_version=v3.3)` ·
`render-kernel: §5 rebuilt from 7 installed skills` ·
`drift-lint: OK (7 skills checked, 0 warning(s)) — router matches disk` ·
`✓ Scaffolded 'Verify App'`.

I authored this record; I did **not** author the scaffolder or any mechanism under test.

## 10-item classification

| # | Item | Classification | Where (in generated project) | How it got there | Founder action? | Enforced / Documented |
|---|------|----------------|------------------------------|------------------|-----------------|------------------------|
| 1 | CLAUDE.md-as-kernel | **Automatically inherited** | `CLAUDE.md` (rendered §1–9) | `cp CLAUDE.md.template` then `render-kernel.mjs` rebuilds §5/§9 from disk | None | **Enforced** (drift-lint fails on phantom §5 rows; §6 author≠verifier rule stated) |
| 2 | Verify-gate enforcement | **Automatically inherited** | `.claude/hooks/verify-gate.mjs` + `.claude/settings.json` (Pre/PostToolUse, Stop) + `.githooks/pre-push` | copied by scaffolder; `git config core.hooksPath .githooks` set | None | **Enforced** (blocks on impl change w/o fresh independent VERIFY) |
| 3 | Author≠Verifier enforcement | **Automatically inherited** | `verify-gate.mjs` (`fm.verifier !== fm.author`) + `CODEOWNERS` (one owner/file) | copied; CODEOWNERS heredoc | None | **Enforced** (same author/verifier still blocks; drift-lint fails on CODEOWNERS handle w/o agent file) |
| 4 | Base+overlay model | **Automatically inherited** | `.claude/base/agents/`, `.claude/overlay/agents/`, rendered `.claude/agents/` | `os-sync.mjs` merges base+overlay | None (overlay edits optional) | **Enforced** (re-sync preserves overlay AND ingests base updates) |
| 5 | Drift detection | **Automatically inherited** | `.claude/tools/check-os-drift.mjs`, invoked by `.githooks/pre-push` | copied + wired into pre-push | None | **Enforced** for phantom-dispatch (exit 1 → push blocked); see Limitation re: under-advertisement |
| 6 | Version boundary | **Automatically inherited** | `.claude/.verify-config.json` + `.verify-state.json` `os_version: "v3.3"` | scaffolder stamps `git describe --tags` of OS | None | **Documented + meaningful** (real consumed tag, not `untagged`; drift-lint WARNs if behind) |
| 7 | Updated wiki contract | **Automatically inherited** | `wiki/FRONTMATTER-CONTRACT.md` (+ `wiki/_index.md`) | `cp` (travels with project) | None | **Documented** (contract present w/ `kind`/`as_of`/`locked`/`frozen`) |
| 8 | Skill architecture | **Automatically inherited** | `.claude/skills/<7>/SKILL.md` (native mechanism) | `cp` per skill | None | **Enforced** (drift-lint guards §5↔disk for phantom dispatch) |
| 9 | Mechanism-vs-policy split (§13) | **Automatically inherited** | `delivery-os/core/GOVERNANCE.md` §13 + `CLAUDE.md` pointers to `delivery-os/core/*` | doctrine vendored via `cp -r core`; fail-closed check on GOVERNANCE.md | None | **Documented + reachable** (pointers resolve; earlier dangling fixed) |
| 10 | Dogfooding requirements | **Automatically inherited (as discipline)** | `docs/verify/_TEMPLATE.md`, DoD/operating-loop in vendored `delivery-os/core/*`, `.verify-config.json impl_extra` hook | copied; OS itself now dogfoods (`delivery-os/.claude/` committed, gate wired) | None | **Enforced via the gate** (every impl slice needs an independent VERIFY) |

## Failure-focused probe results (captured)

1. **Verify-gate active?** — `src/index.ts` created, `echo '{}' | node .claude/hooks/verify-gate.mjs stop`
   → `{"decision":"block","reason":"BLOCKED by Delivery OS verify-gate (Governance §12). Implementation files changed (src/index.ts) but no fresh, passing, INDEPENDENT docs/verify/VERIFY-<slice>.md exists…"}`. **PASS — blocks.**
2. **Author≠Verifier enforced?** — VERIFY with `author==verifier` (`verify_status: verified`) → **still blocks**.
   Changed to `author: person-a` / `verifier: person-b` → empty output, exit 0 (**allowed**). **PASS — distinctness required.**
3. **Overlay survivable?** — added `.claude/overlay/agents/qa-test.md` marker `OVERLAY-MARKER-XYZ123`, `os-sync` (marker rendered);
   appended `BASE-UPDATE-LINE-NEW-CAPABILITY-987` to `.claude/base/agents/qa-test.md`, re-ran `os-sync` →
   rendered `.claude/agents/qa-test.md` contains **BOTH** (base update present: YES; overlay marker survived: YES). **PASS.**
4. **Version boundary meaningful?** — `.verify-state.json`/`.verify-config.json` `os_version = "v3.3"` =
   the real latest released tag (`git describe --tags` of the OS). The uncommitted "v3.4" work is untagged,
   so a consumer correctly inherits the last *released* version, NOT `untagged`. **PASS — meaningful.**
5. **Wiki contract present?** — `wiki/FRONTMATTER-CONTRACT.md` exists with all of `kind` / `as_of` / `locked` / `frozen`. **PASS.**
6. **Doctrine reachable (§13)?** — `CLAUDE.md` line 44 points to `delivery-os/core/OPERATING-LOOP.md` & `…/DEFINITION-OF-DONE.md`;
   `delivery-os/core/GOVERNANCE.md` EXISTS with `## 13. Kernel mechanism vs governance policy (the hard line)`.
   Earlier dangling pointer is **fixed**. **PASS.**
7. **Drift detection enforced?** — `rm -rf .claude/skills/grill-me`, `node .claude/tools/check-os-drift.mjs`
   → `FAIL: router §5 advertises skill "grill-me" but .claude/skills/grill-me/SKILL.md does not exist (phantom dispatch)` exit **1**.
   `.githooks/pre-push` runs BOTH verify-gate (deny→block) AND `check-os-drift.mjs` (non-zero→block). **PASS.**
8. **Skills discoverable?** — 7 `.claude/skills/<name>/SKILL.md` (discovery-interview, ecosystem-alignment-review,
   grill-me, migration-assessment, principle-11-review, production-readiness-review, verify-gate), each with `name:` and `description:`. **PASS.**
9. **CLAUDE.md load-bearing?** — §5 rendered from the 7 installed skills; §6 carries the always-on author≠verifier rule;
   §9 carries the derived line `os_version v3.3 · skills installed: 7 · gate: …active`. Drift-lint guards §5↔disk and CODEOWNERS↔agents.
   **Render timing (real limitation, reported below).** **PASS with caveat.**

## Limitation found (reported, not patched)

**Kernel render is NOT auto-triggered during normal work — only at scaffold time, on the pre-push
drift *check*, or manual `render-kernel.mjs`.** `.claude/settings.json` wires only the verify-gate
(Pre/PostToolUse + Stop); it does NOT run `os-sync`/`render-kernel`/`check-os-drift`.

Probe: I added a real `.claude/skills/my-new-skill/SKILL.md`, then ran `check-os-drift.mjs` WITHOUT
re-rendering → **exit 0 ("OK")**. drift-lint is deliberately one-directional (its comment: "the
reference tolerates an imprecise router"): it fails on **phantom dispatch** (router advertises a
skill/agent absent on disk — the dangerous lie) and on a **void author≠verifier binding** (CODEOWNERS
handle w/o agent file), but it does **not** fail when a real skill on disk is *not yet advertised* in §5.

Consequence: a newly-added skill is silently **under-advertised** in CLAUDE.md until someone re-runs
`render-kernel.mjs` (or pushes, which still passes because under-advertisement is benign). This cannot
cause a phantom dispatch or a false "done" — the two load-bearing lies are still caught and block the
push. It is bounded cosmetic staleness of a router that explicitly declares itself "hand-maintained —
no generator reconciles it." **It is a DOCUMENTED limitation, not a silent loss of an AI-OS lesson** —
the enforced floor (verify-gate, author≠verifier, phantom-dispatch drift) is intact regardless.

(Separately, the OS's OWN `CLAUDE.md` lines 7/72 still say it "does not run its own verify-gate," yet
`delivery-os/.claude/settings.json` now wires the gate and `delivery-os/.claude/` is committed — i.e.
the OS now DOES dogfood and its self-description is stale. This is the OS's own internal router drift
and does NOT affect what a consumer project inherits; flagged for the maintainer.)

## Explicit answer to the founder's question

**If a founder creates a new project tomorrow with this scaffolder:**

**Received AUTOMATICALLY (zero founder action, enforced where it matters):**
- The verify-gate (blocks impl-without-fresh-independent-VERIFY on write/commit/push/turn-end).
- Author≠verifier (gate requires distinct author/verifier; CODEOWNERS one-owner-per-file; drift-lint voids dangling bindings).
- Base+overlay agents (os-sync merges; overlay customizations survive OS bumps).
- Drift detection against phantom dispatch (pre-push fails closed, model-independent git hook).
- The version boundary (real consumed OS tag stamped, not `untagged`).
- The updated wiki frontmatter contract (`kind`/`as_of`/`locked`/`frozen`).
- The native skill architecture (7 discoverable SKILL.md).
- Mechanism-vs-policy split (§13) + operating-loop/DoD/governance doctrine, vendored so router pointers resolve.
- CLAUDE.md kernel with §5/§9 rendered from disk.
- Dogfooding discipline (DoD verification-artifact requirement + impl_extra hook).

**Could still be SILENTLY LOST (cosmetic only — no enforced lesson lost):**
- A **newly-added skill/agent** stays **un-advertised in CLAUDE.md §5/§6** until `render-kernel.mjs`
  is re-run, because render is not in any auto-hook and drift-lint tolerates under-advertisement. This
  degrades discoverability of the *new* capability; it does NOT bypass the gate, author≠verifier, or
  phantom-dispatch protection. Mitigation a founder should know: run `node .claude/tools/render-kernel.mjs`
  (or rely on pre-push) after adding skills/agents.

No enforced AI-OS lesson (gate, author≠verifier, base+overlay survival, phantom-dispatch drift, version
boundary, wiki contract, §13 reachability) is silently lost on a fresh scaffold.

## Verdict

**INHERITANCE PROVEN.** Every one of the 10 items is automatically inherited and either enforced or
correctly documented, with no silent-loss failure of an enforced lesson. The single limitation (render
not auto-triggered → benign under-advertisement of newly-added skills) is bounded, cosmetic, and
consistent with the router's self-declared "hand-maintained" contract.

`verify_status: verified`.
