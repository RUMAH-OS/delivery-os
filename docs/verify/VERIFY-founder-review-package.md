---
slice: "founder-review-package — Founder Review Package generator"
verify_status: verified
author: "implementation-session(coordinated)"
verifier: "independent-qa-subagent"
date: "2026-06-25"
independence_basis: "recorded-distinct-invocation"
machine_probe: "node templates/tools/founder-review-package.mjs --self-test"
test_pins_amended_by: "n/a — no files under tests/ e2e/ evals/ changed by this slice"
---

# VERIFY — Slice founder-review-package — Founder Review Package generator

## Verdict
**verify_status:** `verified`  ·  one line: self-test PASSes (exit 0) pinning every load-bearing invariant, both on-disk copies are byte-identical, the tool is zero-dep (node: builtins + gh/git via execFileSync, no shell), and a real read-only dry-run against delivery-os PR #6 produced a correct package while writing/posting nothing.

> A verdict of `verified` is permitted ONLY if: every acceptance criterion PASSes on its OWN surface,
> every load-bearing claim is Confirmed/Evidence-backed, all required gates are closed, and the
> verifier was a REAL distinct lens from the author. Otherwise the slice caps at `executed`.

## Independence header  (Governance §3/§12 — proves author ≠ verifier)
- Verifier identity / invocation: independent-qa-subagent · distinct subagent invocation · 2026-06-25
- Author identity (code under test): implementation-session(coordinated)
- [x] I assert: the verifier did **not** author the production code under test.
- [x] Independence was **real** (a true second invocation, not the same context restyled).

## Execution evidence  (Governance §1 — direct runtime output, never a description of what *would* happen)

### Cmd 1 — `node templates/tools/founder-review-package.mjs --self-test` → exit 0
Verbatim:
```
founder-review-package --self-test PASS — UI-diff slice lists routes in Screenshots; backend slice emits the exact 'N/A — backend slice (no UI surface changed)'; a review-steps stub is {DEV_URL}-interpolated (live url in, placeholder out); a MISSING stub yields the fail-closed 'Testing guide unavailable' message (NEVER hallucinated steps); a missing `## Why` -> 'Not stated'; and the --post step is gated (default + --dry-run never call `gh pr comment`; --post calls it exactly once; --post under --dry-run is refused).
EXIT=0
```

### Cmd 2 — `node --check templates/tools/founder-review-package.mjs` → `NODECHECK_OK`

### Cmd 3 — byte-identity of the two installed copies
```
8d852ff0a62ec0830b430cb2d27f175fdcff2a24870170b6e3f319276faf6843 *templates/tools/founder-review-package.mjs
8d852ff0a62ec0830b430cb2d27f175fdcff2a24870170b6e3f319276faf6843 *.claude/tools/founder-review-package.mjs
diff: BYTE_IDENTICAL_DIFF_EMPTY
```

### Cmd 4 — zero-dep grep
```
imports (only node: builtins):
  40: import { execFileSync } from "node:child_process";
  41: import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
  42: import { join, dirname } from "node:path";
  43: import { fileURLToPath } from "node:url";
"shell" appears only in a comment (line 317) — no `shell:true` anywhere.
All execFileSync calls pass argv arrays (gh/git), never a shell string:
  320: execFileSync("gh", args, {...})        327: execFileSync("git", args, {...})
  323: execFileSync("gh", ["--version"], ...)  324: execFileSync("gh", ["auth","status"], ...)
No require(, no execSync, no spawn.
```

### Cmd 5 — real read-only dry-run against delivery-os PR #6: `node templates/tools/founder-review-package.mjs --dry-run 6` → exit 0
Generated a real package (backend slice → exact N/A; missing `## Why` → Not stated; missing review-steps stub → fail-closed message). Tail of output:
```
## Screenshots

N/A — backend slice (no UI surface changed)
...
## How to test it yourself (zero technical knowledge)

**Testing guide unavailable — author `docs/review/review-steps-repo-governance-capability.md`.**
...
founder-review-package · PR 6
  · --dry-run: read-only — wrote nothing, posted nothing.
result: ok
EXIT=0
```
Read-only proof: `docs/review/` did not exist before the run and `git status --porcelain docs/review/` reported nothing created after — the dry-run wrote no artifact and posted no comment.

> A row with no command + real output is not evidence. Prose is not evidence.
> Machine-guard line: this verification touches no shared store/queue/port. The one effectful surface (`gh pr comment`) was never exercised — only `--dry-run` (read-only) and `--self-test` (pure, spy-mocked IO) were run.

## Acceptance criteria  (each PASS/FAIL + its evidence pointer)
| # | Criterion | Surface exercised | Evidence (→ cmd #) | PASS/FAIL |
|---|-----------|-------------------|--------------------|-----------|
| 1 | `--self-test` PASSes exit 0 | runs the script (`selfTest()` via CLI) | #1 | PASS |
| 2 | backend slice → exact `N/A — backend slice (no UI surface changed)` | self-test assert + live dry-run on PR#6 | #1, #5 | PASS |
| 3 | missing review-steps stub → fail-closed "Testing guide unavailable", no invented steps/URL | self-test (4) + live dry-run on PR#6 | #1, #5 | PASS |
| 4 | present review-steps stub → `{DEV_URL}` interpolated (placeholder out, live url in) | self-test (3) | #1 | PASS |
| 5 | missing `## Why` → `**Not stated**` | self-test (5) + live dry-run on PR#6 | #1, #5 | PASS |
| 6 | `--post` gated; `--post --dry-run` refused before any IO | self-test (6) + planEffects/generate code | #1, code | PASS |
| 7 | zero-dep: node: builtins only, no shell | grep | #4 | PASS |
| 8 | `.claude/` copy byte-identical to `templates/` | sha256 + diff | #3 | PASS |
| 9 | dry-run is read-only (writes/posts nothing) | git status before/after | #5 | PASS |

## Surface statement  (anti-Slice-1.0)
- The slice's real surface: a Node CLI/ESM module. Driven by: actually running the script (`--self-test`, `--dry-run 6`), not by reading it. The pure invariants are pinned by the in-process self-test; the live path is exercised against a real GitHub PR (#6).
- [x] No criterion was "verified" via a surface that bypasses the slice.

## Load-bearing claim — FAIL-CLOSED TESTING GUIDE  (quoted code path)
`sTestingGuide(d)` (lines 223–240) branches on the stub being absent BEFORE any rendering. When `d.reviewStepsRaw == null` it returns ONLY the unavailable message — there is no code path that fabricates numbered steps or a URL:
```js
function sTestingGuide(d) {
  if (d.reviewStepsRaw == null) {
    return [
      `**Testing guide unavailable — author \`docs/review/review-steps-${d.slice}.md\`.**`,
      "",
      "_(Fail-closed: the step-by-step is engineer-seeded product knowledge — the exact",
      "clicks a founder makes are NOT invented from the diff. ...)_",
    ].join("\n");
  }
  const interpolated = String(d.reviewStepsRaw).replace(/\{DEV_URL\}/g, d.devUrl || "{DEV_URL}");
  ...
}
```
`reviewStepsRaw` is sourced at line 402 via `io.readIfExists("docs/review/review-steps-<slice>.md")` which returns `null` when the file is absent. Steps only ever come from the stub's literal text — never synthesized. Self-test assertion (4) explicitly forbids both invented `1. Go to` steps and a URL leak: `ok(!/^\s*1\.\s+Go to/m.test(guide) && !guide.includes("https://dev.example.app"), ...)`. Confirmed live on PR#6 (#5).
**Verdict: PASS — fail-closed, no fabrication.**

## Load-bearing claim — `--post` IS GATED  (quoted guards)
Two layers, both before the one effectful `gh pr comment` call:
1. `planEffects(opts)` (lines 293–299) — pure:
```js
export function planEffects(opts) {
  if (opts.post && opts.dryRun) {
    return { error: "refusing to --post under --dry-run (read-only) — drop --dry-run to post the comment." };
  }
  if (opts.dryRun) return { writeArtifact: false, postComment: false, error: null };
  return { writeArtifact: true, postComment: !!opts.post, error: null };
}
```
Default → `postComment:false`; `--dry-run` → write+post both false; `--post --dry-run` → error.
2. `generate()` (lines 424–426) runs the plan FIRST and aborts on its error before any IO (no gh preflight, no gather, no write):
```js
const plan = planEffects(opts);
if (plan.error) { report.result = "error"; report.messages.push(plan.error); return report; }
```
The sole effectful call lives in `runEffects` (line 310) behind `if (plan.postComment)`:
```js
if (plan.postComment) {
  io.ghText(["pr", "comment", String(opts.pr), ...repoArgs, "--body", comment]);
  done.posted = true;
}
```
Self-test (6) spy proves: default plan → 0 `gh pr comment` calls; `--dry-run` plan → 0 calls; `--post` plan → exactly 1 call. Live dry-run on PR#6 reported `comment (NOT posted — print only)` and `posted nothing`.
**Verdict: PASS — effectful post is gated and `--post --dry-run` is refused before any IO.**

## Load-bearing claim — SCREENSHOTS real-or-N/A  (quoted code path)
`sScreenshots(d)` (lines 201–212): when no changed path matches a UI pattern it returns the exact backend string; otherwise it lists route placeholders only — never an image:
```js
function sScreenshots(d) {
  const uiPaths = (d.diffStat.changedPaths || []).filter(isUiPath);
  if (!uiPaths.length) return "N/A — backend slice (no UI surface changed)";
  const routes = deriveRoutes(uiPaths);
  const lines = [ "This slice changes UI. Capture a screenshot of each surface below.",
    "_(Placeholders to capture by hand — no images are auto-generated or fabricated.)_", "" ];
  for (const r of routes) lines.push(`- [ ] \`${r}\``);
  ...
}
```
`deriveRoutes` (lines 100–117) maps UI files to routes/file-paths only; no image bytes/links are emitted anywhere in the module. Self-test (1) asserts a UI slice lists `/room` and is NOT the N/A string; (2) asserts a backend slice is exactly the N/A string. Live on PR#6 (a backend slice) → exact `N/A — backend slice (no UI surface changed)`.
**Verdict: PASS — real route placeholders or the exact N/A string; never a fabricated image.**

## Classified open assumptions
| Claim | Confirmed / Evidence-backed / Assumption / Unverified / Failed | Severity |
|-------|---------------------------------------------------------------|----------|
| Pure parsers/derivers/effect-plan behave per spec | Confirmed (self-test exit 0, #1) | — |
| Both installed copies are identical | Confirmed (sha256 + empty diff, #3) | — |
| Zero-dep, no shell injection surface | Confirmed (grep, #4) | — |
| Live gh path gathers a real PR correctly | Evidence-backed (dry-run on PR#6, #5) | Safe-to-defer |
| `--post` posts exactly one comment on the live path | Evidence-backed via spy; live posting NOT exercised (read-only verification by design) | Safe-to-defer |

## Gate ledger
| Gate | Status | Evidence |
|------|--------|----------|
| Build/validate green (`node --check`, self-test) | ✅ | #1, #2 |
| Dedicated commit + slice id | ⬜ | uncommitted by design (verifier does not commit) |
| CI green — machine-read at merge | ⬜ | n/a — not at merge |
| Migration reversible | n/a | no migrations |
| Failure paths → honest error, no false success | ✅ | fail-closed gh-missing/gh-unauth + stub-absent + `--post --dry-run` refusal (#1, code) |
| Effectful action gated (`gh pr comment` behind `--post`) | ✅ | planEffects/runEffects + spy (#1, code) |

## FAIL history
- none

## Bug reports
1. none — no defects found. (Note, not a defect: the dry-run header shows `PR (NOT posted — print only)` correctly; `gh` was available+authed in this environment so the live read path executed.)

## Honest limits
- The effectful `--post` path was intentionally NEVER executed (no comment was posted to any PR); its single-call behavior is proven by the in-process spy and by code review, not by a live post.
- The live dry-run exercised a backend PR (#6), so the UI-route branch of `sScreenshots`/`deriveRoutes` was verified by self-test only, not against a live UI PR.
- DEV-url / CI-run resolution returned "not provisioned / none found" for PR#6; the success branches of `resolveDevUrl`/`resolveCiRunUrl` were not exercised live (no GitHub deployment exists for this repo).
- Verification was performed on Windows (Git Bash); behavior on other shells was not separately exercised, though execFileSync(no shell) makes it shell-agnostic.
