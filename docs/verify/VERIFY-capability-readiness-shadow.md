---
slice: "capability-readiness-shadow — capability requirements + readiness SHADOW gate + I-LegacyGuard config detections (Sprint 1.3 slice 1)"
verify_status: verified
author: "Sprint-1.3 build session / Builder"
verifier: "qa-test (independent invocation) · 2026-06-29T05:50Z"
date: "2026-06-29"
independence_basis: "recorded-distinct-invocation"
machine_probe: "node docs/verify/probes/capability-readiness-shadow.probe.mjs"
impl_fingerprint: '{"templates/tools/capability-config-resolver.mjs":"10a994532d64616dbec2d5eb8c592be9f8b682b1f20e65dd005208e49bfabe88","templates/tools/capability-requirements.schema.json":"fce191aca25f3c4adf458e33e0b62045914863a75c6e34b75481cfb9e43f3e1a","templates/tools/legacy-guard-config.mjs":"d761867eb5ce48a40e0d77916d4eec0c0850cf560fbc3b00004b57559c79871e","templates/tools/readiness-shadow.mjs":"63aaf84498d81912cf53f3e1e7c63f36d0683cfe4835fe95679dd89d724dcc03"}'
---

# VERIFY — Slice capability-readiness-shadow (Sprint 1.3 slice 1)

## Verdict
**verify_status:** `verified`  ·  one line: all 5 acceptance criteria PASS on their own surface via real runs — the load-bearing SHADOW-never-blocks (C9/D7/C13 all exit 0 when NOT READY) and no-secret-values (a self-planted sentinel never appears in any tool's output) properties both hold under independent fixtures.

## Independence header  (Governance §3/§12 — proves author ≠ verifier)
- Verifier identity / invocation: qa-test agent, independent invocation, 2026-06-29T05:50Z — NOT the Sprint-1.3 build session.
- Author identity (code under test): Sprint-1.3 build session / Builder.
- [x] I assert: the verifier did **not** author the production code under test.
- [x] Independence was **real** — a distinct invocation; the verifier wrote and ran its OWN fixtures/probe (own registry, own capability, own secret sentinel `zX9_QASEKRET_4242_unique_value`), not the builder's self-test values.

## Execution evidence  (direct runtime output)
| # | Command | Exit | Output (verbatim / log path) |
|---|---------|------|------------------------------|
| 1 | `node templates/tools/capability-config-resolver.mjs --self-test` | 0 | `capability-config-resolver self-test: 10/10 passed.` |
| 2 | `node templates/tools/readiness-shadow.mjs --self-test` | 0 | `readiness-shadow self-test: 12/12 passed.` |
| 3 | `node templates/tools/legacy-guard-config.mjs --self-test` | 0 | `legacy-guard-config self-test: 13/13 passed.` (incl. `no-secret-values: the DB password is NEVER emitted`) |
| 4 | `node …/capability-config-resolver.mjs --caps <my qa-cap> --env prod --registry <my registry>` | 0 | `[config] QA_REQUIRED_URL (INTERNAL, rule=url, registry=declared, from=qa-cap)` · `required keys for prod: QA_REQUIRED_URL` |
| 5 | `node …/readiness-shadow.mjs --gate C9 --caps <qa-cap> --env prod --registry <reg>` (MISSING key) | **0** | `readiness: NOT READY` · `would-block-on: QA_REQUIRED_URL [MISSING]` · `THIS IS SHADOW: the engine was NOT blocked. (exit 0.)` |
| 6 | `… --gate D7 …` (MISSING key) | **0** | `NOT READY` · `would FAIL-CLOSED on promotion …` · `the engine was NOT blocked. (exit 0.)` |
| 7 | `… --gate C13 …` (MISSING key) | **0** | `NOT READY` · `would HALT-AND-SUMMON …` · `the engine was NOT blocked. (exit 0.)` |
| 8 | `… --gate D7 … --enforce` (MISSING key) | 1 | stderr banner `*** readiness-shadow --enforce: CAPABILITY PROOF ONLY *** … does NOT enable enforcement for the live engine.` |
| 9 | `grep -n readiness-shadow templates/tools/deployment-auth.mjs templates/tools/deploy-lane.mjs` | 1 | no match — NOT wired into the live deploy engine |
| 10 | `node …/legacy-guard-config.mjs --dir <my planted tree> --json` | 0 | findings: `tree-resident-secret` ×2 (`embedded-db-password`, `STRIPE_API_KEY=<redacted 41 chars>`), `gate-bypass-kill-switch ALLOW_PROD_DB_WRITE` (critical), `duplicate-key env-file-shadow` ×2 |
| 11 | `grep zX9_QASEKRET_4242_unique_value` over lg.json/lg.human/res.json/shadow.json | n/a | `CLEAN: sentinel ABSENT` in all 4 outputs; `grep -c` confirms it WAS present 2× in the source tree |
| 12 | `node …/legacy-guard-config.mjs --dir <tree> --fail-on-find` + md5 before/after | 3 | `FAIL-ON-FIND-EXIT=3` · `TREE UNCHANGED (no remediation)` |
| 13 | `node …/capability-config-resolver.mjs --caps <liar-cap: SECRET under requires_config, undeclared key>` | 0 | ISSUES: `listed under requires_config but data_class='SECRET' … move to requires_secret` + `registry gap — nobody owns this key` |
| 14 | `grep RESOLVER/ORACLE/execFileSync readiness-shadow.mjs` + legacy-guard | 0 | both spawn `i-config.mjs` (and resolver) as child processes — readiness not reimplemented |
| 15 | `node docs/verify/probes/capability-readiness-shadow.probe.mjs` | 0 | 9/9 PASS — `machine_probe: PASS — all load-bearing properties hold` |

> Fixtures were verifier-authored (own registry/capability/secret-sentinel), then removed; the self-contained re-runnable probe (#15) rebuilds them in a tmpdir each run.

## Acceptance criteria  (each PASS/FAIL + evidence pointer)
| # | Criterion | Surface exercised | Evidence (→ cmd #) | PASS/FAIL |
|---|-----------|-------------------|--------------------|-----------|
| 1 | Capability requirements resolve (map→keys, de-dup, honesty/GAP/drift surfaced) | resolver CLI on real descriptors + registry | #1, #4, #13 | PASS |
| 2 | SHADOW never blocks — C9/D7/C13 all exit 0 when NOT READY; `--enforce` exit 1 only behind banner, not wired live | readiness-shadow CLI, MISSING key, all 3 gates | #5, #6, #7, #8, #9 | PASS |
| 3 | No secret VALUE ever emitted (planted sentinel absent across all tools) | grep real outputs of all 3 tools | #11 (+ self-tests #2,#3) | PASS |
| 4 | I-LegacyGuard detections fire (evidence-only, exit 0; `--fail-on-find` exit 3, no remediation) | legacy-guard CLI on verifier-planted tree | #10, #12 | PASS |
| 5 | One source of truth — reuses i-config.mjs / 1.2 registry; registry authoritative | source inspection of child-process reuse | #14 | PASS |

> Criterion 4 note: the config-DRIFT detector path (`detectConfigDrift`) requires the I-Config oracle over live provider planes; with no live planes it cannot be exercised end-to-end here. It IS proven by the legacy-guard self-test's injected-oracle fixture (#3: `drift: out-of-scope SECRET DETECTED + critical`, `undeclared-on-plane key DETECTED`). The three tree-resident detectors were exercised live on the verifier's planted tree.

## Surface statement  (anti-Slice-1.0)
- The slice's real surface: three Node CLIs (resolver / readiness-shadow / legacy-guard) + the additive capability schema. Driven by: real `node` invocations with verifier-authored fixtures (registry, capability descriptors, a planted secret tree), exit codes captured, outputs grepped.
- [x] No criterion was "verified" via a surface that bypasses the slice — every criterion ran the actual tool and read its real stdout/exit code (not the builder's self-test for the independent checks).

## Classified open assumptions
| Claim | Confirmed / Evidence-backed / Assumption / Unverified / Failed | Severity |
|-------|---------------------------------------------------------------|----------|
| SHADOW default never blocks (exit 0 on NOT READY, all 3 gates) | Confirmed (#5–#7, #15) | Blocker (the load-bearing safety property) |
| Secret values are never emitted by any of the three tools | Confirmed (#11, self-tests) | Blocker |
| `--enforce` proves fail-closed capability only; not hooked into deployment-auth internals | Evidence-backed (#8, #9 grep) | Should-fix-if-false |
| Readiness is reused from i-config.mjs (1.2), not reimplemented | Confirmed (#14) | Should-fix |
| config-drift detector end-to-end over live planes | Evidence-backed via injected-oracle self-test (#3), not live planes | Safe-to-defer |

## Gate ledger
| Gate | Status | Evidence |
|------|--------|----------|
| Build/validate green (all self-tests 10/10·12/12·13/13) | ✅ | #1, #2, #3 |
| Independent verifier checks (own fixtures, distinct invocation) | ✅ | #4–#13, #15 |
| Machine probe re-runnable (exit 0 iff all properties hold) | ✅ | #15 |
| Failure paths → honest error, no false success (NOT READY surfaced honestly, never silently ready; UNKNOWN for registry gap) | ✅ | #5–#7, resolver #13, self-test #2 |
| Migration reversible / fresh-DB | n/a (no DB/migration in this slice) | — |
| No production code modified by verifier | ✅ | only `docs/verify/**` written |

## FAIL history
- none.

## Bug reports
- none. No defects found. (Observation, non-blocking: the config-drift detector's live-plane path is only provable with live Vercel/GitHub planes; covered here by the injected-oracle self-test. Recommend the Sprint-2.x enforce-flip verification add a live-plane drift fixture — no action required this slice.)
