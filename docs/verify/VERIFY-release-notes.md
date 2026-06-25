---
slice: "release-notes — Release Lifecycle: conventional-commit changelog generator (zero-dep)"
verify_status: verified
author: "implementation-session(coordinated)"
verifier: "independent-qa-subagent"
date: "2026-06-25"
independence_basis: "recorded-distinct-invocation"
machine_probe: "node templates/tools/release-notes.mjs --self-test"
---

# VERIFY — Slice release-notes (Release Lifecycle changelog generator)

## Verdict
**verify_status:** `verified`  ·  one line: zero-dep, all CHANGELOG writes are gated behind `--write` (off by default, suppressed by `--dry-run`), `--gh-release` only PRINTS the `gh release create` command and never executes it; `--self-test` PASS (exit 0); read-only `--dry-run` against this repo produced grouped notes and wrote nothing (`git status` unchanged).

## Independence header  (Governance §3/§12 — proves author ≠ verifier)
- Verifier identity / invocation: independent-qa-subagent · distinct verification invocation · 2026-06-25 (NOT the build session).
- Author identity (code under test): implementation-session(coordinated).
- [x] I assert: the verifier did **not** author the production code under test.
- [x] Independence was **real** (a true second invocation: commands run + code read fresh from disk).

## Execution evidence  (Governance §1 — direct runtime output)
| # | Command | Exit | Output (verbatim) |
|---|---------|------|-------------------|
| 1 | `node templates/tools/release-notes.mjs --self-test` | 0 | `release-notes --self-test PASS — commits group by conventional-commit type (feat/fix/docs/refactor/test/chore + other, ordered), rendered notes emit PR links ([#n](url/pull/n)) + short hashes (bare #n when no repoUrl), the --write effect is GATED (default + --dry-run write NOTHING; --write prepends exactly once above the H1), and --gh-release only PRODUCES the `gh release create` command (never cuts a release).` |
| 2 | `node --check` ×4 (templates/ + .claude/ for release-notes & smoke) | 0 | `OK templates/tools/release-notes.mjs` / `OK .claude/tools/release-notes.mjs` (all four OK) |
| 3 | `sha256sum templates/tools/release-notes.mjs .claude/tools/release-notes.mjs` | 0 | both `b7c30ef365a9104e74c470bf7e45d02b419b43857122bc96f71c9ef3721e7b47` — byte-identical twins |
| 4 | `node templates/tools/release-notes.mjs --dry-run --max 8` | 0 | grouped markdown (`## Unreleased (2026-06-25)`, `### Features/Bug Fixes/...`) printed; footer `range: v5.0..HEAD · commits: 144 · merged PRs: 0` |
| 5 | `git status --porcelain` before vs after #4 | 0 | identical — **no CHANGELOG.md created/modified**; dry-run wrote nothing |

## Acceptance criteria  (each PASS/FAIL + evidence pointer)
| # | Criterion | Surface exercised | Evidence | PASS/FAIL |
|---|-----------|-------------------|----------|-----------|
| 1 | Self-test passes (exit 0) | runs the tool's own assertions (no git/gh/net — injected spy IO) | #1 | PASS |
| 2 | Zero external deps — only `node:` builtins | `grep` of imports | #imports | PASS |
| 3 | No shell injection — git/gh shelled via `execFileSync` (no `shell:true`) | `grep` execFileSync | #imports | PASS |
| 4 | Default + `--dry-run` write NOTHING | spy IO assertions + live dry-run on this repo | #1, #4, #5 | PASS |
| 5 | `--write` is the ONLY mutation; prepends once above H1 | spy IO `calls.write === 1` | #1 | PASS |
| 6 | `--gh-release` only PRINTS the command, never executes | self-test asserts exact command string | #1 | PASS |
| 7 | `.claude/` twin byte-identical to `templates/` source | sha256 match | #3 | PASS |

## Surface statement  (anti-Slice-1.0)
- The slice's real surface: a Node CLI + its pure exported core. Driven by: executing `--self-test` (pure assertions over injected spy IO) and a live `--dry-run` against this repo's real git history.
- [x] No criterion was "verified" via a bypassing surface — the gated-effect claim is proven both by the spy-IO write-counter (=0 default, =1 on `--write`, =0 on `--dry-run`) AND by a real `git status` diff being empty after a live dry-run.

## Gated-effects proof  (the load-bearing safety claim)
The tool defaults to read-first (PRINTS notes to stdout). The CHANGELOG write is fenced:
- `release-notes.mjs:272-281` — `const wantWrite = !!opts.write;` then `if (wantWrite && opts.dryRun) { ...[dry-run] would prepend... (no write performed). } else if (wantWrite) { ...io.writeFile(...) }`. The only `io.writeFile` is reachable ONLY when `opts.write && !opts.dryRun`.
- `release-notes.mjs:284-287` — `if (opts.ghRelease) { report.ghReleaseCmd = ghReleaseCommand(...); report.messages.push(\`gh release is a human/CI step — run: ...\`); }` — it COMPOSES a command string and pushes a message; it never invokes `execFileSync` for it. `ghReleaseCommand` (`:153-157`) is a pure string builder.
- Self-test confirms all three: `calls.write === 0` (default), `calls.write === 1` (`--write`), `calls.write === 0` (`--dry-run + --write`), and `rRel.ghReleaseCmd === "gh release create v1.2.0 --title v1.2.0 --notes-file CHANGELOG.md"` with `calls.write === 0`.
- Live confirmation: a real `--dry-run` against this repo left `git status` byte-for-byte unchanged (no CHANGELOG.md appeared).

## Classified open assumptions
| Claim | Status | Severity |
|-------|--------|----------|
| Effects fully gated (write only on `--write && !--dry-run`; gh-release only printed) | Confirmed (code + self-test + live dry-run) | Blocker-class, cleared |
| Zero external deps; `execFileSync` with arg-array, no `shell:true` | Confirmed (grep) | Should-fix, cleared |
| `.claude/` twin matches source | Confirmed (sha256) | Should-fix, cleared |
| Live `--write` / `--gh-release` not exercised here (would mutate / call gh) | Assumption (intentionally untested per scope) | Safe-to-defer |

## Honest limits
- The live `--write` path and the actual `gh release create` execution were deliberately NOT run (the verification brief forbids mutation). They are covered by the spy-IO self-test, not by a live mutation.
- The gh/PR-enrichment live path (`gh pr list/view`) was not exercised; the dry-run reported `merged PRs: 0` because PR enrichment was skipped (gh path not driven). Commit-derived grouping — the load-bearing output — was fully exercised over 144 real commits.

## Gate ledger
| Gate | Status | Evidence |
|------|--------|----------|
| Build/validate green (`node --check` all copies) | ✅ | #2 |
| Self-test green | ✅ | #1 |
| Byte-identical vendored twin | ✅ | #3 |
| Read-only verification left tree clean | ✅ | #5 |
| Dedicated commit | ⬜ | not committed (per brief — do not commit) |

## FAIL history
- none.

## Bug reports
1. none.
