---
slice: "ci-release-orchestrator — CI & Release Orchestrator spine (zero-dep Node tool)"
verify_status: verified
author: "implementation-session(coordinated)"
verifier: "independent-qa-subagent"
date: "2026-06-25"
independence_basis: "recorded-distinct-invocation"
machine_probe: "node templates/tools/ci-release-orchestrator.mjs --self-test"
---

# VERIFY — Slice ci-release-orchestrator (CI & Release Orchestrator spine)

## Verdict
**verify_status:** `verified`  ·  one line: self-test PASS (exit 0), syntax valid, zero-dep confirmed, and the load-bearing safety invariant holds — the merge gate is HUMAN-ONLY with no auto-merge path and a fail-closed override guard; no unsafe path found.

> A verdict of `verified` is permitted ONLY if: every acceptance criterion PASSes on its OWN surface,
> every load-bearing claim is Confirmed/Evidence-backed, all required gates are closed, and the
> verifier was a REAL distinct lens from the author. Otherwise the slice caps at `executed`.

## Independence header  (Governance §3/§12 — proves author ≠ verifier)
- Verifier identity / invocation: `independent-qa-subagent` · distinct QA subagent invocation · 2026-06-25 (NOT the build/implementation session)
- Author identity (code under test): `implementation-session(coordinated)` — authored `templates/tools/ci-release-orchestrator.mjs`
- [x] I assert: the verifier did **not** author the production code under test.
- [x] Independence was **real** (a true second invocation, not the same context restyled).

## Execution evidence  (Governance §1 — direct runtime output, never a description of what *would* happen)
| # | Command | Exit | Output (verbatim) |
|---|---------|------|-------------------|
| 1 | `node templates/tools/ci-release-orchestrator.mjs --self-test` | 0 | `ci-release-orchestrator --self-test PASS — 5 signal fixtures classify correctly (F1–F5 + experience-review->F5 + unrelated->none), safe-to-auto split holds (SAFE:[F2,F3] APPROVAL:[F1,F4] NEVER:[F5], F3-real=NEEDS-APPROVAL), merge gate is human-only (no auto-merge without --merge; --merge cannot override red/missing).` |
| 2 | `node --check templates/tools/ci-release-orchestrator.mjs` | 0 | (no output — `SYNTAX_OK`) valid ESM |
| 3 | `Grep` import scan | n/a | only `node:child_process`, `node:fs`, `node:path`, `node:url` — no npm import |
| 4 | `Grep` merge/push path scan | n/a | one `pr merge` (line 410); one `push` via `gitCommitPush`→`applySafeFix` (lines 305/314) |

> Self-test is pure: no live `gh`/`git` calls, no repo mutation, no merge/push/deploy. Verification was performed off the static module + its pure exports; no live CI→merge→deploy loop was driven (and the tool was not allowed to perform any real merge/push/deploy).

## Acceptance criteria  (each PASS/FAIL + its evidence pointer)
| # | Criterion | Surface exercised | Evidence (→ cmd #) | PASS/FAIL |
|---|-----------|-------------------|--------------------|-----------|
| a | **Zero-dep** — only `node:` builtins + `gh`/`git` via child_process; no npm import | Module import graph (read + grep) | #2, #3 | **PASS** |
| b | **Merge gate is HUMAN-ONLY** — no path merges without `--merge` AND all 3 required checks green; `--merge` refuses on red/missing (fail-closed) | `decideMerge` + the single `pr merge` call site + self-test asserts | #1, #4 | **PASS** |
| c | **Autonomy split** — SAFE-TO-AUTO (F2/F3-partial) mutate only under `--apply-safe`; NEEDS-APPROVAL (F1/F4/F3-real) propose-only; F5 NEVER-AUTO/escalate | `safeToAutoSplit`, `applySafeFix` guard, fixer dispatch | #1, #4 | **PASS** |
| d | **Fail-closed** when `gh` missing/unauthed | `orchestrate` preflight | #1 (logic) + code read | **PASS** |

### Per-claim proof

**(a) Zero-dep — PASS.** The only imports (lines 30–33) are `node:child_process`, `node:fs`, `node:path`, `node:url`. No npm/package import anywhere; `gh` and `git` are shelled via `execFileSync` (line 231/238) with `shell:false` (array argv, no `shell:true`). `node --check` confirms valid ESM with no resolution needed beyond builtins.

**(b) Human-only merge gate — PASS (load-bearing invariant holds).** There is exactly one merge invocation in the file (line 410), and it is structurally unreachable without `--merge` + all-green:
- `decideMerge` (lines 217–225) is the sole decision function:
  ```
  const allGreen = missing.length === 0 && notPass.length === 0;
  if (!allGreen) return { action: "blocked", ... reason: "required checks not all green" };
  if (!merge)    return { action: "await-human", ... };
  return { action: "merge", ... };
  ```
  `"merge"` is returned ONLY when `allGreen === true` AND `merge === true`. A red (`bucket !== "pass"`) or missing required check forces `allGreen=false` → `blocked` **regardless of `--merge`** (the override is impossible).
- The only `pr merge` shell call sits inside the `decision.action === "merge"` branch, after the `blocked` and `await-human` branches each `return` first:
  ```
  // decision.action === "merge" — explicit --merge AND all green: the human authorized it.
  io.ghText(["pr", "merge", String(opts.pr), ...repoArgsOf(opts), "--squash"]);
  ```
- Default (no `--merge`) yields `await-human`: it prints the mechanical gate command (`node merge-pr.mjs <pr>`) and STOPS (lines 401–406).
- Self-test (#1) independently pins all four corners: `await-human` without `--merge`; never `merge` without `--merge`; `merge` only with `--merge`+green; and `--merge` → `blocked` on a RED required check AND on a MISSING required check (lines 571–576).

No auto-merge path exists. **No unsafe path found — invariant intact.**

**(c) Autonomy split — PASS.** `safeToAutoSplit()` derives bands from the data (`FAILURE_CLASSES`), asserted by self-test as SAFE:[F2,F3] / APPROVAL:[F1,F4] / NEVER:[F5]. Mutation is gated: `applySafeFix` (lines 309–316) is reached only when `effective.safeToAuto === "SAFE-TO-AUTO" && opts.applySafe && !opts.dryRun` (line 459). `applySafeFix` itself only knows F2 and F3-non-escalated; F3 escalated/real throws `"escalated/real fix is NOT auto-appliable"` (line 313). F1/F4/F3-real (NEEDS-APPROVAL) take the propose-only branch (lines 474–478, no mutation). F5 (NEVER-AUTO) escalates with no fix attempt (lines 479–483). The single `push` in the tool is `gitCommitPush` (line 305), reachable only through `applySafeFix` — i.e. only under `--apply-safe` and never under `--dry-run`.

**(d) Fail-closed on gh missing/unauthed — PASS.** `orchestrate` preflight (lines 359–368) returns `result: "error"` with a clear remediation message before any poll/mutate: gh-not-found → "gh CLI not found on PATH … re-run"; gh-not-authed → "Fail-closed: refusing to poll or mutate without an authenticated session." Additionally zero-checks (line 380) and unclassified reds (line 432) both fail-closed (never guess a fix), and the CLI exits non-zero on any non-`ok`/non-`awaiting-human` result (lines 620–621).

## Surface statement  (anti-Slice-1.0)
- The slice's real surface: a zero-dep Node CLI/state-machine module. Driven by: its own pure `--self-test` (deterministic fixtures over the real exports `classifyFailure` / `safeToAutoSplit` / `decideMerge`) + `node --check` + direct source read of every merge/push/mutate call site.
- [x] No criterion was "verified" via a surface that bypasses the slice. The safety invariants are exercised through the actual decision/dispatch functions, not a paraphrase. The one surface NOT exercised — a live `gh`-driven CI→merge→deploy round-trip — is called out under honest-limits and exercised separately; it does not touch the autonomy/merge-gate logic verified here.

## Classified open assumptions
| Claim | Confirmed / Evidence-backed / Assumption | Severity |
|-------|------------------------------------------|----------|
| No code path merges without `--merge` + all-green | Confirmed (single call site, structural reachability + self-test) | Blocker (resolved) |
| `--merge` cannot override red/missing checks | Confirmed (decideMerge + self-test #1) | Blocker (resolved) |
| Only `node:` builtins imported (zero-dep) | Confirmed (#2, #3) | Should-fix (resolved) |
| Mutation/push only under `--apply-safe && !--dry-run` for SAFE-TO-AUTO | Confirmed (guard line 459 + applySafeFix) | Blocker (resolved) |
| Fail-closed when gh absent/unauthed | Confirmed (preflight 359–368) | Should-fix (resolved) |
| Live `gh`/`git` round-trip behaves as the pure model predicts | Assumption (not driven here; logic verified, live loop exercised separately) | Safe-to-defer |

## Gate ledger
| Gate | Status | Evidence |
|------|--------|----------|
| Build/validate green (`node --check` + `--self-test`) | ✅ | →cmd #1, #2 |
| Dedicated commit + slice id | ⬜ | uncommitted in working tree (branch feat/ci-release-orchestrator); not committed per instruction |
| CI green — machine-read at merge | ✅ (by design) | the tool ITSELF enforces machine-read merge via `decideMerge` reading the checks API; never piped/watched output |
| Migration reversible / fresh-DB | n/a | no migration in this slice |
| Failure paths → honest error, no false success | ✅ | fail-closed preflight, unclassified→escalate, non-zero exits (→cmd #1 + code read) |
| Merge-gate safety invariant (human-only, no override) | ✅ | →cmd #1 + lines 217–225, 392–414 |

## FAIL history
- none

## Bug reports
- none — no defects found. No unsafe/auto-merge path exists.

## Honest limits
Logic + safety invariants were verified off a live repo (pure `--self-test`, `node --check`, and source review of every merge/push/mutate call site); a full live CI→merge→deploy loop (real `gh` polling, real squash-merge, real Vercel deploy watch) is exercised separately and was deliberately NOT driven here — the tool was not permitted to perform any real merge/push/deploy during this verification.
