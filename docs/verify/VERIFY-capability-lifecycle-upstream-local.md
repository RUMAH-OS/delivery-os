---
slice: "capability-lifecycle upstream (file-lesson + cross-project census)"
verify_status: verified
author: "claude-opus main build session 2026-06-15"
verifier: "qa-test subagent (independent, 2026-06-15)"
date: 2026-06-15
independence_basis: "recorded-distinct-invocation"
machine_probe: "node templates/tools/census-detector.mjs"   # real corpus must stay exit 0 (no un-triaged cross-project pattern)
---

# VERIFY — Slice capability-lifecycle upstream (file-lesson + cross-project census)

## Verdict
**verify_status:** `verified` · file-lesson appends one correct tagged signal line and rejects bad usage with exit 2; census-detector now promotes any un-triaged pattern spanning ≥2 distinct projects to a CROSS-PROJECT candidate (exit 1) while leaving every original rule (≥3 distinct sources, triaged-suppression, watch, --threshold, --append, malformed-skip, missing-file-graceful) intact; the real `capabilities/signals.jsonl` censuses green and was provably not modified.

## Independence header  (Governance §3/§12 — proves author ≠ verifier)
- Verifier identity / invocation: qa-test subagent · distinct invocation 2026-06-15 · executed against own mktemp corpora, never the build context.
- Author identity (code under test): claude-opus main build session 2026-06-15.
- [x] I assert: the verifier did **not** author the production code under test (no production-code edits made; only temp fixtures created and removed).
- [x] Independence was **real** (a true second invocation: own temp corpora, own assertions, distinct session).

## Execution evidence  (Governance §1 — direct runtime output)
| # | Command | Exit | Output (verbatim / key line) |
|---|---------|------|------------------------------|
| 1 | `file-lesson --project plos --pattern X --source Y --signals <tmp>` | 0 | one line: `{"pattern":"X","project":"plos","source":"plos:Y","date":"2026-06-14"}` — parses; project/source/pattern/date present, NO capability |
| 1b | same + `--capability Z` | 0 | `{"pattern":"X","project":"plos","source":"plos:Y","capability":"Z","date":"2026-06-14"}` |
| 1c | `file-lesson --pattern X --source Y` (no --project) | 2 | usage message |
| 1d | `file-lesson --project plos --source Y` (no --pattern) | 2 | usage message |
| 1e | `file-lesson … --signals <missing>` | 2 | `canonical signals corpus not found at …` |
| 2 | file pattern from admin + plos (2 src, un-triaged) → `census-detector --signals <tmp>` | 1 | `CANDIDATE (2× · 2 projects) [CROSS-PROJECT → promote to delivery-os]: flaky-shared-resource-race-c2tok` |
| 3 | same pattern twice from admin only (1 project, 2 src) → census | 0 | `watch (2×) … PASS` |
| 4 | 2-project pattern, one entry has `capability` → census | 0 | `triaged 1 … PASS` |
| 5a | single-project ≥3 distinct sources, un-triaged → census | 1 | `CANDIDATE (3× · 1 project): thresh3-c5tok` (no cross-project tag) |
| 5b | same 3 sources but triaged → census | 0 | `triaged 1 … PASS` |
| 5d | 2-source single-project pattern with `--threshold 2` → census | 1 | `CANDIDATE (2× · 1 project): two-src-c5tok` |
| 5e | 3-source candidate with `--append <tmp ledger>` | 1 | ledger gained `| (census) append-c5tok | recurred 3× across distinct sources | (triage) | **AUTO** | …` |
| 5f | corpus with `//` comment, `#` comment, `{ not json }`, one valid line → census | 0 | `skipping unparseable signal line: { not json }` then `1 signal(s) … PASS`; missing file → graceful `no signals file … PASS` exit 0 |
| 6 | `node templates/tools/census-detector.mjs` (REAL corpus) | 0 | `16 signal(s) · triaged 6 · watch 0 … PASS` |

**Machine-guard line (shared resource = the canonical signals corpus):** every fixture used a `mktemp` file plus run-unique pattern tokens (`c2tok`/`c3tok`/`c4tok`/`c5tok`). The real `capabilities/signals.jsonl` sha256 was captured before (`0d2e67f5a225e4ae769afe47d1a4bb0140654d09ad2fa638c37b5955fd78ea3a`, 20 lines) and re-captured after (identical hash, 20 lines); `git status --porcelain` on it = empty; `grep` for the run-unique tokens in the real corpus = 0; no `/tmp/tmp.*` leftovers.

## Acceptance criteria
| # | Criterion | Surface exercised | Evidence | PASS/FAIL |
|---|-----------|-------------------|----------|-----------|
| 1 | file-lesson appends exactly one well-formed tagged line; --capability optional; missing --project/--pattern/signals → exit 2 | runs file-lesson.mjs against temp corpora | #1,1b,1c,1d,1e | PASS |
| 2 | cross-project (2 distinct projects, 2 sources, un-triaged) → exit 1, names `2 projects` + `[CROSS-PROJECT → promote to delivery-os]` | runs census-detector on filed signals | #2 | PASS |
| 3 | single-project below threshold (1 project, 2 sources) → exit 0 watch, not candidate | census-detector | #3 | PASS |
| 4 | ≥2-project pattern with one triaged entry → exit 0 suppressed | census-detector | #4 | PASS |
| 5 | no regression: ≥3 distinct sources candidate; triaged suppressed; 2-source watch; --threshold 2; --append; malformed/comment skip; missing-file graceful | census-detector | #5a,5b,3,5d,5e,5f | PASS |
| 6 | real `capabilities/signals.jsonl` → exit 0 (no cross-project un-triaged pattern) | census-detector on real corpus | #6 | PASS |

## Surface statement  (anti-Slice-1.0)
- The slice's real surface: two zero-dep Node CLIs (`file-lesson.mjs` writer, `census-detector.mjs` aggregator) operating on a JSONL corpus. Driven by: actual `node …` invocations whose append-effects and exit codes are observed directly — no code-reading substituted for execution.
- [x] No criterion was "verified" via a surface that bypasses the slice. file-lesson criteria were checked by inspecting bytes it actually wrote; census criteria by its actual exit code + emitted candidate line.

## Classified open assumptions
| Claim | Status | Severity |
|-------|--------|----------|
| Cross-project promotion fires on exactly ≥2 distinct `project` values and tags `[CROSS-PROJECT → promote to delivery-os]` | Confirmed (#2) | Blocker — load-bearing |
| Cross-project requires ≥2 DISTINCT projects (single project, 2 sources, stays watch) | Confirmed (#3) | Blocker — load-bearing |
| Original ≥3-distinct-source / triaged / watch / threshold / append / robustness rules unchanged | Evidence-backed (#5a–5f) | Should-fix if broken — all PASS |
| Real corpus unmodified by verification | Confirmed (pre==post sha256, git clean, token grep 0) | Blocker |
| `date` field value = machine clock at runtime (observed `2026-06-14`); criterion only requires a present, ISO-date field | Confirmed | Safe-to-defer (cosmetic only — local clock, not a defect) |

## Gate ledger
| Gate | Status | Evidence |
|------|--------|----------|
| Build/validate green (tools run, all exit codes as specified) | ✅ | #1–#6 |
| Dedicated commit + slice id (or NO-GIT flagged) | ⬜ | NO-GIT: instructed not to commit; verification doc only |
| CI green — machine-read at merge | ⬜ | n/a — no PR opened this session |
| Migration reversible / fresh-DB | ⬜ | n/a — no DB/migration in this slice |
| Failure paths → honest error, no false success | ✅ | exit 2 on bad usage (#1c–1e); graceful exit 0 + message on missing/malformed (#5f); fail-closed exit 1 on candidates (#2,5a,5d,5e) |
| Shared-resource guard (real corpus untouched) | ✅ | sha256 pre==post; git clean; token grep 0; no /tmp leftovers |

## FAIL history
- none

## Bug reports
- none.
