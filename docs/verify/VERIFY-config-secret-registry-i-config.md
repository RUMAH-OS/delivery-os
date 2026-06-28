---
slice: "config-secret-registry-i-config — canonical config/secret registry + I-Config readiness oracle (Sprint 1.2 slice 1)"
verify_status: verified
author: "Sprint-1.2 build session / Builder rumah-os-builder"
verifier: "qa-test (independent invocation) — 2026-06-28T22:26:18Z"
date: "2026-06-28"
independence_basis: "recorded-distinct-invocation"
machine_probe: "node templates/tools/i-config.mjs --self-test"
impl_fingerprint: '{"templates/tools/config-secret-registry.example.json":"62d0a82e790b2923c170c78f483404b80cb9145ecb5e5853e62ee16795515121","templates/tools/config-secret-registry.schema.json":"72580e9b86f4d75b60a3b3939bc797c5579021663331261a3eeee76b4afc220d","templates/tools/i-config.mjs":"dbed1fcd11d1b0fc677d60900a4c7d5e9208b1aef132292daedb0b9cd33e7bbd"}'
---

# VERIFY — Slice config-secret-registry-i-config (canonical Config & Secret Registry + I-Config oracle)

## Verdict
**verify_status:** `verified`  ·  one line: all 5 acceptance criteria PASS on their own surface (the oracle was RUN — self-test 32/32 plus an independent fixture proving the four verdicts on a real local plane, the no-secret-values guarantee, report-only/enforce exit codes, legacy normalization of both live admin+PLOS registries, and JSON-Schema validation of schema+example via ajv).

### How `impl_fingerprint` was produced
`node .claude/os/tools/verify-fingerprint.mjs compute --files templates/tools/i-config.mjs,templates/tools/config-secret-registry.schema.json,templates/tools/config-secret-registry.example.json`
(NB: `--files` is COMMA-separated; the space-separated form silently records only the first file — caught and corrected during verification.)

## Independence header  (Governance §3/§12 — proves author ≠ verifier)
- Verifier identity / invocation: qa-test agent, independent invocation, 2026-06-28T22:26:18Z, repo HEAD `20e8912`. Distinct from the build session.
- Author identity (code under test): Sprint-1.2 build session / Builder `rumah-os-builder`.
- [x] I assert: the verifier did **not** author the production code under test.
- [x] Independence was **real** — a true second invocation that RE-RAN the probe and authored an ADDITIONAL independent fixture (my own registry + planted-secret `.env`), not the author's self-test restyled.

## Execution evidence  (direct runtime output)
| # | Command | Exit | Output (verbatim / abridged) |
|---|---------|------|------------------------------|
| 1 | `node templates/tools/i-config.mjs --self-test` | 0 | `… I-Config self-test: 32/32 passed.` (all 32 lines `PASS`, incl. the four-verdict, no-secret-values, and legacy-normalization assertions) |
| 2 | `node .claude/os/tools/verify-fingerprint.mjs compute --files templates/tools/i-config.mjs,templates/tools/config-secret-registry.schema.json,templates/tools/config-secret-registry.example.json` | 0 | `impl_fingerprint: {"templates/tools/config-secret-registry.example.json":"62d0a82e…","templates/tools/config-secret-registry.schema.json":"72580e9b…","templates/tools/i-config.mjs":"dbed1fcd…"}` |
| 3 | INDEPENDENT fixture: my own canonical registry + `.env.development` with PLANTED secret values, run `i-config.mjs --registry <fix> --project-dir <fix> --env dev --json` | 0 (report-only) | per-key states: `DATABASE_URL => PRESENT` · `MISSING_TOKEN => MISSING` · `PUBLIC_BASE_URL => INVALID` · `LOCAL_ONLY_SECRET => DRIFTED` |
| 4 | `grep -E "QA_PLANTED_DB_PW_9f3x\|QA_PLANTED_DRIFT_SECRET" out.json` (planted DB password + planted out-of-scope drift secret) | 1 (no match) | `NO_LEAK` — neither planted secret VALUE appears in the serialized report |
| 5 | same fixture with `--enforce` | 1 | fail-closed-capable: exits 1 on required MISSING/INVALID |
| 6 | same fixture, default (no `--enforce`) | 0 | report-only default exits 0 regardless of MISSING/INVALID/DRIFTED |
| 7 | `i-config.mjs --registry rumah-admin/infra/config-registry.json --env prod --json` | 0 | `service: rumah-admin · normalized_from_legacy: true · total keys: 10 · crashed: no` |
| 8 | `i-config.mjs --registry property-lead-os/infra/config-registry.json --env prod --json` | 0 | `service: property-lead-os · normalized_from_legacy: true · total keys: 14 · crashed: no` |
| 9 | ajv@8 `compile(schema)` then `validate(example)` (scratch `npm i ajv@8`) | 0 | `SCHEMA_COMPILES: ok (draft-07)` · `EXAMPLE_VALIDATES_AGAINST_SCHEMA: true` |
| 10 | `i-config.mjs --registry <admin legacy> --env prod` → DATABASE_URL row (cmd 7 detail) | 0 | `DATABASE_URL -> data_class: INTERNAL inferred: true` (lossy inference — CAVEAT, see assumptions) |

## Acceptance criteria  (each PASS/FAIL + evidence pointer)
| # | Criterion | Surface exercised | Evidence (→ cmd #) | PASS/FAIL |
|---|-----------|-------------------|--------------------|-----------|
| 1 | Four verdicts: required+present+valid→PRESENT; required+absent→MISSING; present-but-rule-failing→INVALID; out-of-`env_scope` SECRET on a plane→DRIFTED | Running the oracle over a real local plane (my fixture) + self-test injected-plane path | #3, #1 | PASS |
| 2 | No-secret-values: a planted secret VALUE never appears in the serialized report | grep of the real JSON report for two distinct planted sentinels | #4, #1 (self-test no-secret assertions) | PASS |
| 3 | Report-only by default (exit 0); `--enforce` proves fail-closed (exit 1); nothing blocks by default | Real exit codes from the oracle | #6 (exit 0), #5 (exit 1) | PASS |
| 4 | Reads admin + PLOS legacy registries (auto-normalized) without crashing | Oracle run against both live `infra/config-registry.json` files | #7, #8 | PASS |
| 5 | Schema is a valid JSON-Schema + the example validates against it | ajv@8 compile + validate | #9 | PASS |

## Surface statement  (anti-Slice-1.0)
- The slice's real surface: a Node CLI readiness oracle + its JSON-Schema/registry. Driven by RUNNING `i-config.mjs` (its `--self-test` probe and direct `--registry/--env/--enforce/--json` invocations) and by compiling the schema with a real validator (ajv). No criterion was proven by reading code.
- [x] No criterion was "verified" via a surface that bypasses the slice. The four verdicts were exercised through the full `evaluateKey()` path on a real `.env` plane (not only the author's injected-plane self-test); the no-secret guarantee was grepped on actual serialized output; legacy normalization was run against the two real consumer registries; the schema was validated by an independent JSON-Schema engine.

## Classified open assumptions
| Claim | Confirmed / Evidence-backed / Assumption / Unverified / Failed | Severity |
|-------|---------------------------------------------------------------|----------|
| The four verdicts resolve correctly on a real local plane | Confirmed (#3) | — |
| No secret VALUE is emitted in the report | Confirmed — two distinct planted sentinels absent from real JSON (#4) + self-test guard (#1) | — |
| Report-only by default; `--enforce` is fail-closed-capable; default never blocks | Confirmed (#5/#6) | — |
| Both live legacy registries normalize without crashing | Confirmed (#7/#8) | — |
| Schema is valid draft-07; example validates | Evidence-backed via ajv@8 (#9) | — |
| **data_class is INFERRED lossily by the auto-normalizer** — `DATABASE_URL` from the admin/PLOS legacy registries infers `INTERNAL` though it is truly `SECRET` | Confirmed as an HONEST, FLAGGED limitation: the oracle stamps `data_class_inferred: true` (rendered with a `?` suffix) on every normalized key (#10). For THIS slice (oracle + schema) it is Safe-to-defer; the LATER per-repo "identical schema" DoD check MUST consume HAND-AUTHORED canonical registries, not the auto-normalized form. | Should-fix / Safe-to-defer |
| `--files` to verify-fingerprint is comma-separated (space-separated records only file #1) | Confirmed — corrected during verification; fingerprint covers all three files (#2) | Safe-to-defer (tooling ergonomics, not this slice) |

## Gate ledger
| Gate | Status | Evidence |
|------|--------|----------|
| Build/validate green (probe) | ✅ | self-test 32/32 (#1) |
| Independent re-execution on a distinct surface | ✅ | my own fixture (#3–#6) + ajv (#9) |
| Failure paths → honest error, no false success | ✅ | DRIFTED/MISSING/INVALID surfaced with FIX; malformed/no-registry inputs `fail(2)` with a clear message; report-only never falsely "ready" |
| No-secret-values invariant (§57.2) | ✅ | #4 |
| Dedicated commit + slice id | ⬜ | not in scope of this verification (impl uncommitted on working tree at HEAD `20e8912`) |
| CI green — machine-read at merge | ⬜ | deferred to merge gate (out of scope here) |
| Migration reversible / fresh-DB | n/a | no DB migration in this slice |

## FAIL history
- none

## Bug reports
1. none (the data_class lossy-inference item is an author-declared, honestly-flagged limitation, recorded above as Should-fix/Safe-to-defer — NOT a defect of this slice; no fix requested for the oracle).
