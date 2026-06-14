---
slice: "census-detector (v6 #10 — extraction over accumulation, auto-feeds the one ledger)"
verify_status: verified
author: "claude-opus main build session 2026-06-15"
verifier: "qa-test subagent (independent, 2026-06-15)"
date: "2026-06-15"
independence_basis: "recorded-distinct-invocation"
machine_probe: "node templates/tools/census-detector.mjs"
---

# VERIFY — Slice census-detector (v6 #10)

## Verdict
**verify_status:** `verified`  ·  All 8 acceptance criteria PASS on their own surface (real node execution of the tool, my own mktemp fixtures). Load-bearing criteria 2 (un-triaged ≥3× fails closed, exit 1) and 3 (a `capability` on any entry silences it, exit 0) both hold — the extraction-over-accumulation guarantee is mechanical.

## Independence header  (Governance §3/§12 — proves author ≠ verifier)
- Verifier identity / invocation: qa-test subagent, distinct invocation 2026-06-15 (NOT the build session).
- Author identity (code under test): claude-opus main build session 2026-06-15.
- [x] I assert: the verifier did **not** author the production code under test.
- [x] Independence was **real** — a true second invocation; fixtures authored independently by the verifier via `mktemp`, not reused from the author.

## Execution evidence  (Governance §1 — direct runtime output)
| # | Command | Exit | Output (verbatim) |
|---|---------|------|------------------------------|
| 1 | `node templates/tools/census-detector.mjs` (real corpus) | 0 | `census-detector · 16 signal(s) · threshold 3× distinct sources · triaged 6 · watch 0` / `PASS: no un-triaged pattern has recurred >=3× — every recurring lesson is a capability (or below threshold).` |
| 2 | `… --signals f2.jsonl` (3 distinct sources, no capability) | 1 | `census-detector · 3 signal(s) · … triaged 0 · watch 0` / `FAIL: 1 un-triaged recurring pattern(s) MUST become a capability (extraction over accumulation):` / `  CANDIDATE (3×): flaky thing` |
| 3 | `… --signals f3.jsonl` (same 3×, one entry has `capability`) | 0 | `… triaged 1 · watch 0` / `PASS: no un-triaged pattern has recurred >=3× …` |
| 4 | `… --signals f4.jsonl` (3 lines, 2 distinct sources) | 0 | `… triaged 0 · watch 1` / `  watch (2×): flaky thing` / `PASS …` |
| 5 | `… --signals f5.jsonl` (2 distinct, un-triaged) | 0 | `… triaged 0 · watch 1` / `  watch (2×): flaky thing` / `PASS …` |
| 6 | `… --signals f5.jsonl --threshold 2` | 1 | `… threshold 2× … ` / `FAIL: 1 un-triaged …` / `  CANDIDATE (2×): flaky thing` |
| 7 | `… --signals f2.jsonl --append ledger.md` | 1 | `FAIL …` / `  CANDIDATE (3×): flaky thing` / `  -> appended 1 candidate(s) to …ledger.md (the ONE canonical ledger).` + row landed in file (see below) |
| 8a | `… --signals f8.jsonl` (comments `//`/`#` + malformed JSON line) | 1 | `census-detector: skipping unparseable signal line: this is not json at all` / `… 3 signal(s) …` / `CANDIDATE (3×): flaky thing` (3 valid lines parsed, no crash) |
| 8b | `… --signals does-not-exist.jsonl` | 0 | `census-detector: no signals file at … (nothing to census yet).` / `… 0 signal(s) …` / `PASS …` |

Criterion-7 ledger landing (verbatim tail of the temp ledger copy after the run):
```
<!-- census-detector auto-appended candidates -->
| (census) flaky thing | recurred 3× across distinct sources | (triage) | **AUTO** | census-detector: un-triaged >=3× recurrence — convert to a capability |
```

**Machine-guard line (shared resources):** verification used only verifier-owned `mktemp` fixtures and a temp COPY of a ledger (`$TMP/ledger.md`); the real `capabilities/CAPABILITY-LEDGER.md` was never passed to `--append` and is unmodified. No ports/DB/shared store touched. Temp dir removed post-run.

## Acceptance criteria  (verbatim from the slice — each PASS/FAIL + evidence pointer)
| # | Criterion | Surface exercised | Evidence | PASS/FAIL |
|---|-----------|-------------------|----------|-----------|
| 1 | Real corpus = green: exit 0, reports 6 triaged | node-run of tool on real `capabilities/signals.jsonl` | #1 | PASS |
| 2 | Un-triaged ≥3× = fail-closed: exit 1, names CANDIDATE (3×) | node-run on verifier fixture | #2 | PASS |
| 3 | Triaged ≥3× suppressed: capability on ≥1 entry → exit 0, counted triaged, not candidate | node-run on verifier fixture | #3 | PASS |
| 4 | Distinct-source counting: 3 lines / 2 distinct → not candidate (watch, exit 0) | node-run on verifier fixture | #4 | PASS |
| 5 | Watch band: exactly 2 distinct, un-triaged → "watch", exit 0 | node-run on verifier fixture | #5 | PASS |
| 6 | Threshold honored: `--threshold 2` turns 2× into CANDIDATE, exit 1 | node-run on verifier fixture | #6 | PASS |
| 7 | `--append` feeds the ONE ledger: candidate row appended to that file | node-run, post-run file read | #7 | PASS |
| 8 | Robustness: `//`/`#` + malformed lines skipped no crash; missing file → graceful, exit 0 | node-run on verifier fixtures | #8a, #8b | PASS |

## Surface statement  (anti-Slice-1.0)
- The slice's real surface: a CLI tool (`census-detector.mjs`) executed by node, reading a JSONL corpus and writing a ledger file. Driven by: direct `node …` invocations with verifier-authored `mktemp` fixtures; criterion 7 verified by reading the file after the run, not by reading the source.
- [x] No criterion was "verified" via a surface that bypasses the slice. Every verdict came from running the tool and observing real exit codes / stdout / file contents.

## Classified open assumptions
| Claim | Status | Severity |
|-------|--------|----------|
| Un-triaged ≥3× distinct sources fails closed (exit 1) | Confirmed (#2) | Blocker-class — holds |
| A `capability` on any entry of a pattern silences it (exit 0) | Confirmed (#3) | Blocker-class — holds |
| Counts DISTINCT sources, not raw lines | Confirmed (#4) | Should-fix-class — holds |
| `--append` lands on the file passed (one canonical ledger, no second mechanism) | Confirmed (#7) | Should-fix-class — holds |
| Robust to comments/malformed/missing input | Confirmed (#8a/#8b) | Safe-to-defer — holds |

## Gate ledger
| Gate | Status | Evidence |
|------|--------|----------|
| Build/validate green (tool runs, real corpus exits 0) | ✅ | #1 |
| Dedicated commit + slice id (or NO-GIT flagged) | ⬜ | not committed (instructed: do NOT commit); files untracked in worktree |
| CI green — machine-read at merge | ⬜ | n/a this verification (local, pre-commit) |
| Migration reversible + applies-clean-on-fresh-DB | n/a | no DB/migration in this slice |
| Failure paths → honest error, no false success | ✅ | #2, #6, #8a (un-triaged/over-threshold/malformed all surface, never false PASS) |
| Distinct-source semantics (anti-double-count) | ✅ | #4 |

## FAIL history
- none.

## Bug reports
- none. (Two observations, non-blocking, not defects: (a) `--append` only writes when the target file already `existsSync` — silently a no-op if the ledger path is wrong; acceptable as fail-safe but worth a future log line. (b) candidate `pattern` text is emitted into the ledger un-escaped; benign for the controlled corpus.)
