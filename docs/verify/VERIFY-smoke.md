---
slice: "smoke — Smoke / Production-Verify HTTP health probe (zero-dep, fail-closed)"
verify_status: verified
author: "implementation-session(coordinated)"
verifier: "independent-qa-subagent"
date: "2026-06-25"
independence_basis: "recorded-distinct-invocation"
machine_probe: "node templates/tools/smoke.mjs --self-test"
---

# VERIFY — Slice smoke (Production-Verify HTTP health probe)

## Verdict
**verify_status:** `verified`  ·  one line: zero-dep (only `node:http`/`node:https`/`node:fs`/`node:url`), read-only (GET-only, mutates nothing), and FAIL-CLOSED by construction — a network error, timeout, thrown probe, wrong status, or missing body-substring all classify FAIL; ANY failing check → overall FAIL → non-zero exit so CI gates; `--self-test` PASS (exit 0).

## Independence header  (Governance §3/§12 — proves author ≠ verifier)
- Verifier identity / invocation: independent-qa-subagent · distinct verification invocation · 2026-06-25 (NOT the build session).
- Author identity (code under test): implementation-session(coordinated).
- [x] I assert: the verifier did **not** author the production code under test.
- [x] Independence was **real** (a true second invocation: commands run + code read fresh from disk).

## Execution evidence  (Governance §1 — direct runtime output)
| # | Command | Exit | Output (verbatim) |
|---|---------|------|-------------------|
| 1 | `node templates/tools/smoke.mjs --self-test` | 0 | `smoke --self-test PASS — a 200-vs-expected match is PASS; a 500 / timeout / connection-error / wrong-body-substring is FAIL (fail-closed: a network error and even a THROWN probe are FAIL, never a pass); the overall verdict is FAIL if ANY check fails; an optional route's 404 is SKIP (200-if-present) and a lone SKIP does not flip a passing run; malformed --config throws.` |
| 2 | `node --check` ×4 (templates/ + .claude/ for release-notes & smoke) | 0 | `OK templates/tools/smoke.mjs` / `OK .claude/tools/smoke.mjs` (all four OK) |
| 3 | `sha256sum templates/tools/smoke.mjs .claude/tools/smoke.mjs` | 0 | both `ecad2b4fc0147b1c0740cb7823534e3969a93b4a6e856fe03d5e0d885795e95e` — byte-identical twins |

## Acceptance criteria  (each PASS/FAIL + evidence pointer)
| # | Criterion | Surface exercised | Evidence | PASS/FAIL |
|---|-----------|-------------------|----------|-----------|
| 1 | Self-test passes (exit 0) | tool's own assertions over an injected HTTP spy (no real net) | #1 | PASS |
| 2 | Zero external deps — only `node:` builtins (http/https/fs/url) | `grep` of imports | #imports | PASS |
| 3 | 200-vs-expected → PASS; wrong status → FAIL | `classifyResult` unit assertions | #1 | PASS |
| 4 | Network error / timeout / connection-refused → FAIL (fail-closed) | `classifyResult` + `runSmoke` over spy | #1 | PASS |
| 5 | A THROWN probe → FAIL, never a pass | `runSmoke` try/catch wraps probe → `{error}` | #1 | PASS |
| 6 | Wrong body-substring → FAIL; matching → PASS | `classifyResult` bodyIncludes assertions | #1 | PASS |
| 7 | ANY check FAIL → overall FAIL → non-zero exit (CI gates) | `overallVerdict` + CLI exit map | #1, code | PASS |
| 8 | Read-only — no mutation (GET-only) | code review: no write/POST/PUT/DELETE | #review | PASS |
| 9 | Optional route 404 → SKIP; lone SKIP doesn't flip a PASS | `classifyResult` + `overallVerdict` | #1 | PASS |
| 10 | `.claude/` twin byte-identical to `templates/` source | sha256 match | #3 | PASS |

## Surface statement  (anti-Slice-1.0)
- The slice's real surface: a Node CLI + its pure exported core (`classifyResult`, `overallVerdict`, `loadBattery`). Driven by: `--self-test`, which exercises classification AND end-to-end `runSmoke` over an injected HTTP spy (healthy / 500 / network-down / THROWN / 404-optional / config-body-mismatch).
- [x] No criterion was "verified" via a bypassing surface — the fail-closed claim is proven through the actual classifier and the orchestrator, not asserted in prose.

## Fail-closed proof  (the load-bearing safety claim)
- `smoke.mjs:73-91` — `classifyResult`: `if (result && result.error) return { verdict: "FAIL", reason: \`network error...\` };` (network/timeout FIRST, FAIL — even for optional checks, since the optional-404 SKIP branch is reached only when there is no error). `if (status !== check.expectStatus) return { verdict: "FAIL", ... }`. `if (check.bodyIncludes != null && !body.includes(...)) return { verdict: "FAIL", ... }`. PASS is the LAST, narrowest branch.
- `smoke.mjs:157-158` — orchestration wraps the probe: `try { result = await probe(target); } catch (e) { result = { error: ... }; } // any thrown IO -> FAIL, never a pass` — a thrown probe becomes an `{error}`, which `classifyResult` maps to FAIL.
- `smoke.mjs:95-100` — `overallVerdict`: `const verdict = counts.FAIL > 0 ? "FAIL" : (counts.PASS > 0 ? "PASS" : "FAIL");` — ANY FAIL → FAIL; and zero-PASS (e.g. only SKIPs / nothing ran) → FAIL (no weak default to PASS).
- `smoke.mjs:297` — CLI exit map: `process.exit(report.verdict === "PASS" ? 0 : 1); // non-zero on any FAIL so CI gates`. Preflight missing `--url` → `result:"error"` → exit 2 (`:295`).
- `smoke.mjs:48-55` — `loadBattery`: malformed JSON / empty / bad path THROWS (no silent fallback to a weaker battery).
- Read-only: the only network calls are `httpRequest`/`httpsRequest` with `method: "GET"` (`:117`); no POST/PUT/DELETE/write anywhere. Body capture is bounded (`if (body.length < 65536)`, `:120`).
- Self-test confirms each: 500→FAIL, timeout→FAIL, ECONNREFUSED→FAIL, wrong-body→FAIL, THROWN→overall FAIL, any-FAIL→overall FAIL, only-SKIP→FAIL, malformed-config→throws.

## Classified open assumptions
| Claim | Status | Severity |
|-------|--------|----------|
| Fail-closed: error/timeout/throw/wrong-status/wrong-body all FAIL; any FAIL → overall FAIL → exit≠0 | Confirmed (code + self-test) | Blocker-class, cleared |
| Read-only (GET-only, no mutation) | Confirmed (code review) | Blocker-class, cleared |
| Zero external deps (node: builtins only) | Confirmed (grep) | Should-fix, cleared |
| `.claude/` twin matches source | Confirmed (sha256) | Should-fix, cleared |
| Live probe against a real running deploy not exercised here | Assumption (no live URL in scope) | Safe-to-defer |

## Honest limits
- No live HTTP probe was run against a real deployed URL (none in scope); the live `makeProbe` path is covered by the injected-spy self-test, not a real socket. The classification + verdict + exit logic — the load-bearing behavior — is fully exercised.
- `optional` semantics are narrow: ONLY a 404 on an optional route is SKIP; any other non-expected status (e.g. 500) on an optional route still FAILs (self-test asserts this) — correct fail-closed behavior, noted so consumers don't assume "optional" means "ignored".

## Gate ledger
| Gate | Status | Evidence |
|------|--------|----------|
| Build/validate green (`node --check` all copies) | ✅ | #2 |
| Self-test green | ✅ | #1 |
| Byte-identical vendored twin | ✅ | #3 |
| Failure paths → honest FAIL, no false success | ✅ | fail-closed proof |
| Dedicated commit | ⬜ | not committed (per brief — do not commit) |

## FAIL history
- none.

## Bug reports
1. none.
