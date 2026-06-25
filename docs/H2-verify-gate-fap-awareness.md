# H2 — verify-gate FAP-awareness (precise diff spec; NOT yet applied)

> **Status: SPEC ONLY — `verify-gate.mjs` is deliberately left UNCHANGED in this slice.** Flagged for the
> coordinator. The /goal Execution Contract build (`feat/goal-execution-contract`) shipped goal-init /
> goal-stop / boundary-classify / the FAP template / the founder-action-package skill, and wired goal-stop
> as a second Stop entry in `templates/settings.json.template`. H2 (making verify-gate FAP-aware) is the one
> change that touches the LIVE enforcement element, so it is specified here rather than applied, for three
> concrete reasons:
>
> 1. **The live gate fires during this very build.** `.claude/hooks/verify-gate.mjs` runs on my own Stop and
>    pre-commit events. A bug introduced here half-breaks the gate mid-session — exactly the "do NOT
>    half-break the live gate" failure the task warns against.
> 2. **The two copies have already diverged (documented self-install lag).** `templates/hooks/verify-gate.mjs`
>    is the v4 canonical (engine-ownership, write-scoping, probe re-exec, §14 detectors);
>    `.claude/hooks/verify-gate.mjs` is the older v3.8 copy. CLAUDE.md §9 "Open" item 2 states the `.claude/`
>    copies are re-synced from `templates/` at ratification. Editing both consistently is a coordinator-owned
>    re-sync action, not a single-slice edit.
> 3. **Author≠verifier.** Modifying the verification gate inside the same slice that introduces the FAP
>    notion is precisely the conflict §3/§12 exist to prevent. An independent lens should land this.
>
> This document is the exact, ready-to-apply diff + a failing/passing test matrix so the change is a
> mechanical, reviewable step.

---

## The deadlock H2 closes (why this is mandatory, not cosmetic)

A founder boundary UPSTREAM of verification ("provision DEV", "I need the API key to integration-test" — the
common first slice of every new repo, SDLC §8) leaves implementation that **genuinely cannot be verified yet**.
As built today, BOTH Stop hooks then block forever:

- `verify-gate.mjs stop` blocks: impl changed, no `verify_status: verified` artifact exists.
- `goal-stop.mjs` blocks: no valid FAP / the goal is not complete.

The only "escape" is marking a VERIFY `verified` that never ran — a fake pass that corrupts §12. H2 makes the
two Stop hooks **share the boundary-blocked-verify notion**: an honest `verify_status: blocked-at-boundary`
VERIFY that names the SAME boundary as a valid FAP satisfies the gate **in STOP-mode only** — and
pre-commit/pre-push keep blocking unconditionally so the unverified impl **stays on the branch and cannot ship**.

---

## The contract (exactly three behavior changes)

- **(a) Accept `verify_status: blocked-at-boundary` as satisfying the gate — IN STOP-MODE ONLY — when a
  matching valid boundary-FAP names the same boundary.** This is honest, not a pass: the VERIFY says
  "verification is blocked at boundary X", and a FAP at boundary X exists and is valid (goal-stop's
  `validateFap`). `verify_clean` in the FAP is satisfied by `verified` OR `blocked-at-boundary`.
- **(b) STOP-mode must NOT block a turn carrying a valid boundary-FAP** whose blocked VERIFY names the same
  boundary. (Terminating the *turn* is correct; the impl is still unverified and still on the branch.)
- **(c) pre-commit / pre-push modes keep blocking UNCONDITIONALLY.** Unverified impl must not ship. No change
  to those branches whatsoever. This supersedes the earlier "zero change to verify-gate" claim for STOP-mode
  only; the ship-gates are untouched.

Scope rule: the relaxation is **stop-mode-exclusive** and **gated on a valid FAP existing** (rare), so the
blast radius is a turn that already produced a legitimate boundary FAP.

---

## The diff

### New shared helper (added once, near `freshPassArtifact`, in BOTH copies)

```js
// H2 — boundary-blocked verification. A VERIFY may honestly declare
// `verify_status: blocked-at-boundary` (NOT a pass) when verification cannot run
// because the goal hit a founder boundary upstream of it. In STOP-MODE ONLY this
// satisfies the gate IFF a VALID boundary-FAP names the SAME boundary. pre-commit
// / pre-push never call this — unverified impl must not ship.
function boundaryBlockedVerifyClears() {
  // 1) a fresh, valid boundary FAP must exist (goal-stop owns the canonical check;
  //    we re-derive a minimal version here to avoid a hard import dependency).
  let goal; try { goal = JSON.parse(readFileSync(join(ROOT, ".claude", ".goal-state.json"), "utf8")); } catch { return false; }
  if (!goal || !goal.goal_id) return false;
  const fapPath = join(ROOT, "docs", "goals", `FAP-${goal.goal_id}.md`);
  if (!existsSync(fapPath)) return false;
  const fap = frontmatter(fapPath);
  if (String(fap.disposition).toLowerCase() !== "boundary") return false;
  if (mtime(fapPath) <= (goal.started_at || 0)) return false;            // stale FAP
  const boundary = String(fap.boundary_class || "").trim();
  if (!boundary) return false;
  // 2) a VERIFY must declare blocked-at-boundary naming the SAME boundary.
  for (const d of VERIFY_DIRS) {
    let names = []; try { names = readdirSync(join(ROOT, d)); } catch { continue; }
    for (const n of names) {
      if (!/^VERIFY-.*\.md$/i.test(n)) continue;
      const vfm = frontmatter(join(ROOT, d, n));
      if (String(vfm.verify_status).toLowerCase() === "blocked-at-boundary" &&
          String(vfm.boundary_class || "").trim() === boundary) return true;
    }
  }
  return false;
}
```

### STOP-mode branch — the ONLY behavioral edit

**`.claude/hooks/verify-gate.mjs`** (the v3.8 live copy, current lines 162–166):

```diff
   if (MODE === "stop") {
     const impl = changedImpl();
-    if (impl.length && !freshPassArtifact(impl)) emit({ decision: "block", reason: blocked(impl) });
+    if (impl.length && !freshPassArtifact(impl) && !boundaryBlockedVerifyClears())
+      emit({ decision: "block", reason: blocked(impl) });
     process.exit(0);
   }
```

**`templates/hooks/verify-gate.mjs`** (the v4 canonical copy, current lines 255–261):

```diff
   if (MODE === "stop") {
     const engineBlock = engineDriftBlock();
     if (engineBlock) emit({ decision: "block", reason: engineBlock });
     const impl = changedImpl();
-    if (impl.length && !freshPassArtifact(impl, changedTests())) emit({ decision: "block", reason: blocked(impl) });
+    if (impl.length && !freshPassArtifact(impl, changedTests()) && !boundaryBlockedVerifyClears())
+      emit({ decision: "block", reason: blocked(impl) });
     process.exit(0);
   }
```

Notes:
- `pre-commit` (lines 241–253) and `pre-push` (263+) are **untouched** — they never call
  `boundaryBlockedVerifyClears()`, so unverified impl is still blocked at commit/push (contract (c)).
- `readFileSync`, `readdirSync`, `existsSync`, `statSync`, `join`, `frontmatter`, `mtime`, `VERIFY_DIRS`,
  `ROOT` are all already imported/defined in both copies — the helper adds no new imports.
- The engine-ownership block in the template's stop branch is preserved and still runs first.
- A `frontmatter()` exists in both copies; the v3.8 copy also has `fmText()` (text variant) — the helper uses
  the file-path `frontmatter()` which both copies expose.

### Producer-side change (VERIFY template — additive, no gate risk)

`templates/VERIFY.md.template` frontmatter `verify_status` enum gains `blocked-at-boundary`:

```diff
- verify_status: executed        # planned | generated | executed | verified  (verifier sets 'verified' only when ALL below pass)
+ verify_status: executed        # planned | generated | executed | verified | blocked-at-boundary
+                                #   'blocked-at-boundary' = verification cannot run because the goal hit a founder
+                                #   boundary upstream of it; REQUIRES a matching valid FAP (same boundary_class) and
+                                #   clears the STOP gate ONLY (never commit/push — unverified impl stays on the branch).
```

Plus a `boundary_class:` field (only set when `verify_status: blocked-at-boundary`), matching the FAP's class.

---

## Failing / passing test matrix (add to a `verify-gate --self-test`, or drive live)

Each row sets up `.claude/.goal-state.json`, `docs/goals/FAP-<id>.md`, a `docs/verify/VERIFY-*.md`, and a
changed impl file, then runs the gate in the given mode.

| # | Mode | impl changed? | FAP | VERIFY | Expected |
|---|------|---------------|-----|--------|----------|
| 1 | stop | yes | valid boundary (class=credentials) | `blocked-at-boundary`, boundary_class=credentials | **ALLOW** (exit 0, no block) — (a)+(b) |
| 2 | stop | yes | valid boundary (class=credentials) | none / `executed` | **BLOCK** — no honest blocked-VERIFY, normal §12 block |
| 3 | stop | yes | valid boundary (class=credentials) | `blocked-at-boundary`, boundary_class=**deploy-auth** | **BLOCK** — boundary mismatch (must name the SAME boundary) |
| 4 | stop | yes | none (no goal-state) | `blocked-at-boundary` | **BLOCK** — a blocked VERIFY without a FAP is not honest; fail-closed |
| 5 | stop | yes | invalid FAP (no_tool-alone, H4) | `blocked-at-boundary` | **BLOCK** — FAP invalid (goal-stop rejects it too) |
| 6 | stop | yes | valid boundary, but FAP **stale** (mtime ≤ started_at) | `blocked-at-boundary` | **BLOCK** — stale FAP is not this goal's |
| 7 | stop | yes | none | fresh `verified`, independent | **ALLOW** — ordinary §12 pass, unchanged |
| 8 | **pre-commit** | yes | valid boundary | `blocked-at-boundary` matching | **BLOCK (deny)** — (c): unverified impl must not ship |
| 9 | **pre-push** | yes (in range) | valid boundary | `blocked-at-boundary` matching | **BLOCK (exit 1)** — (c): unverified impl must not ship |
| 10 | stop | **no** impl changed | any | any | **ALLOW** — nothing to verify, unchanged |

Rows 1, 3, 6 are the load-bearing new behavior (honest blocked-at-boundary clears STOP only when the FAP is
valid AND the boundary matches AND the FAP is fresh). Rows 8–9 prove the ship-gates stay closed (the whole
safety of the design). Rows 2, 4, 5, 7, 10 prove no regression to the existing §12 contract.

---

## Why this is safe to land later (the honest limit)

`boundaryBlockedVerifyClears()` only returns true when a goal-state exists, a fresh **valid** boundary FAP
exists (the same validity goal-stop enforces), AND a VERIFY honestly declares `blocked-at-boundary` for that
exact boundary. It cannot manufacture a pass: it requires the agent to have written a real FAP (re-checked by
goal-stop) and a real, honest VERIFY status. And it is **stop-mode only** — the commit/push backstops, the
`.githooks/pre-push`, and the founder reading the FAP all remain. The unverified impl never ships; only the
*turn* terminates.
