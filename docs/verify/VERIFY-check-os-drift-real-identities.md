---
slice: "check-os-drift-real-identities — accept declared real GitHub identities in CODEOWNERS"
verify_status: verified
author: "build session / Builder rumah-os-builder (delivery-os PR #22, tag v5.1)"
verifier: "qa-test — independent invocation 2026-06-28T21:50:42Z"
date: "2026-06-28"
independence_basis: "recorded-distinct-invocation"
machine_probe: "node docs/verify/probes/check-os-drift-real-identities.probe.mjs"
impl_fingerprint: '{"templates/tools/check-os-drift.mjs":"0a561a7a9f8021a628947372bcda1172acd1790753ad2dbe3da0042399c749fd"}'
---

# VERIFY — Slice check-os-drift-real-identities — accept declared real GitHub identities in CODEOWNERS

## Verdict
**verify_status:** `verified`  ·  one line: all three acceptance criteria PASS on their own surface (the lint run with real exit codes); the phantom-agent guard still HOLDS — accepting declared real identities did not weaken it.

## Independence header  (Governance §3/§12 — proves author ≠ verifier)
- Verifier identity / invocation: qa-test independent invocation · 2026-06-28T21:50:42Z · NOT the build session that authored PR #22.
- Author identity (code under test): build session / Builder `rumah-os-builder`, merged via delivery-os PR #22 (tag v5.1).
- [x] I assert: the verifier did **not** author the production code under test.
- [x] Independence was **real** (a true second invocation, not the same context restyled).

## Execution evidence  (Governance §1 — direct runtime output)
> Machine-guard line (shared resources): each criterion runs in its OWN run-unique fixture root under the OS temp dir
> (`drift-ri-*/c{1,2,3}-*`), built fresh by the probe; the phantom handle carries a run-unique token
> (`nope-phantom-<Date.now()><rand>`) so no fixture, file, or assertion collides with any other run or repo state. The
> lint reads `process.cwd()`, so cwd is set to the fixture for each run — never the repo.

| # | Command | Exit | Output (verbatim) |
|---|---------|------|-------------------|
| 1 | `node templates/tools/check-os-drift.mjs` (cwd = fixture `c1-declared-identity`; CODEOWNERS `* @bkasanwiredjo`, `.claude/codeowners-humans.txt` declares `@bkasanwiredjo`) | 0 | `drift-lint: OK (0 skills checked, 0 warning(s)) — router matches disk.` |
| 2 | `node templates/tools/check-os-drift.mjs` (cwd = fixture `c2-phantom`; CODEOWNERS `* @nope-phantom-1782683420733722358`, NO humans decl, NO agent file) | 1 | `FAIL: CODEOWNERS binds @nope-phantom-1782683420733722358 but .claude/agents/nope-phantom-1782683420733722358.md does not exist and @nope-phantom-1782683420733722358 is not a declared identity in .claude/codeowners-humans.txt (void author≠verifier binding)` / `drift-lint: 1 phantom-dispatch failure(s) — build blocked.` |
| 3 | `node templates/tools/check-os-drift.mjs` (cwd = fixture `c3-agent-file`; CODEOWNERS `* @qa-agent-1782683420733722358`, `.claude/agents/qa-agent-1782683420733722358.md` exists) | 0 | `drift-lint: OK (0 skills checked, 0 warning(s)) — router matches disk.` |
| 4 | `node docs/verify/probes/check-os-drift-real-identities.probe.mjs` | 0 | `3/3 criteria passed.` / `PROBE OK — declared real identities accepted, phantom-agent guard holds.` |
| 5 | `node templates/tools/verify-fingerprint.mjs compute --changed` | 0 | `impl_fingerprint: {"templates/tools/check-os-drift.mjs":"0a561a7a9f8021a628947372bcda1172acd1790753ad2dbe3da0042399c749fd"}` |

## Acceptance criteria  (copied verbatim from the slice — each PASS/FAIL + its evidence)
| # | Criterion | Surface exercised | Evidence (→ cmd #) | PASS/FAIL |
|---|-----------|-------------------|--------------------|-----------|
| 1 | CODEOWNERS binding a handle DECLARED in `.claude/codeowners-humans.txt` (`@bkasanwiredjo`) → check-os-drift exits 0 (no "void author≠verifier binding") | running the lint against a real fixture | #1 (+#4) | PASS |
| 2 | CODEOWNERS binding an UNDECLARED handle with NO `.claude/agents/<handle>.md` → exits 1 with the "void author≠verifier binding" FAIL (phantom-agent guard HOLDS) | running the lint against a real fixture | #2 (+#4) | PASS |
| 3 | A handle with a real `.claude/agents/<handle>.md` file still passes (regression: agent-role path intact) | running the lint against a real fixture | #3 (+#4) | PASS |

## Surface statement  (anti-Slice-1.0)
- The slice's real surface: the `check-os-drift.mjs` CODEOWNERS lint, driven via its actual entrypoint (`node templates/tools/check-os-drift.mjs`) in run-unique fixture dirs with real `CODEOWNERS` / `.claude/codeowners-humans.txt` / `.claude/agents/` inputs and real captured exit codes — not by reading the source.
- [x] No criterion was "verified" via a surface that bypasses the slice.

## Classified open assumptions
| Claim | Confirmed / Evidence-backed / Assumption / Unverified / Failed | Severity |
|-------|---------------------------------------------------------------|----------|
| Declared real identity → exit 0 | Confirmed (cmd #1) | — |
| Phantom-agent guard still fails an undeclared handle | Confirmed (cmd #2) | — |
| Agent-file-backed handle still passes | Confirmed (cmd #3) | — |
| `impl_fingerprint` matches the live impl file | Evidence-backed (cmd #5) | — |

## Gate ledger
| Gate | Status | Evidence |
|------|--------|----------|
| Build/validate green (probe re-executable) | ✅ | →cmd #4 (exit 0) |
| Dedicated commit + slice id | ⬜ | impl merged via PR #22 (tag v5.1); this VERIFY + probe pending commit |
| CI green — machine-read at merge | ⬜ | runs at merge via `merge-pr` |
| Migration reversible / fresh-DB | n/a | no migration in this slice |
| Failure paths → honest error, no false success | ✅ | →cmd #2 (undeclared handle → honest exit-1 FAIL, no false OK) |

## FAIL history
- none

## Bug reports
- none
