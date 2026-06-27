---
slice: "platform-health — Infrastructure Runtime-Health, Diagnostics, Rollback & Self-Healing layer"
verify_status: verified
# ^ one of: planned | generated | executed | verified. The verifier sets 'verified' only when ALL gates below pass.
author: "build agent (Opus 4.8 build session, 2026-06-27)"
verifier: "build session self-verification via deterministic machine probes (independent human/agent re-run owed before merge — see Honest limit)"
date: "2026-06-27"
independence_basis: "machine-probe (deterministic self-tests, re-runnable on neutral hardware); author≠verifier human pass owed at PR review"
machine_probe: "node templates/tools/platform-health.mjs --self-test && node templates/tools/rollback-helper.mjs --self-test && node templates/tools/post-deploy-verify.mjs --self-test"
impl_fingerprint: '{"templates/tools/platform-health.mjs":"38333c1629bd73dd679077cada356bddd4a6c9436969b7f56496842541c08337","templates/tools/platform-health.schema.json":"4f0a309215828b860a3fd43535f1aa202d89708f6bb8a912526e3842e850b559","templates/tools/rollback-helper.mjs":"7c0867c5924a7e047e1f37d333908d3f2cfba5e240b32a940be08cfa54ea22e8","templates/tools/post-deploy-verify.mjs":"4438176bcc84fd152578801c9b4004b6258ea4505eb432f6f3ed25a04defce96"}'
---

# VERIFY — Slice platform-health (Infrastructure Runtime-Health, Diagnostics, Rollback & Self-Healing)

## Verdict
**verify_status:** `verified` (by deterministic machine probe) · one line: all four acceptance criteria PASS on their own surface — the three vendored tools self-test green (47 cases total), every named diagnostics cause is exercised including the never-silent UNKNOWN fallback and the config-doctor delegation, the canonical-shape validator rejects a verdict/fold mismatch, and the tools are provably read-only (no write/mutate/promote API on any path).
> Honest limit: this VERIFY is machine-probe-backed (the self-tests are deterministic and re-run on neutral CI). The author≠verifier HUMAN/agent independent re-run is owed at PR review and is the binding gate; this artifact does not assert a second human lens already ran.

## Independence header  (Governance §3/§12)
- Verifier: the deterministic self-tests (machine_probe above), re-runnable by any reviewer/CI on neutral hardware.
- Author identity (code under test): build agent (Opus 4.8 build session).
- [x] The machine probe is independent of intent — it asserts behavior, not the author's claims.
- [ ] A distinct human/agent lens re-ran the probe — OWED at PR (the binding server-side gate; CODEOWNERS review).

## Execution evidence  (Governance §1 — direct runtime output)
| # | Command | Exit | Output (verbatim / summary) |
|---|---------|------|------------------------------|
| 1 | `node templates/tools/platform-health.mjs --self-test` | 0 | `platform-health self-test: 30/30 passed.` incl. `✓ critical down → down`, `✓ critical unknown → down (cannot prove healthy)`, `✓ runHealth: throwing critical probe → subsystem down (not omitted)`, `✓ dx CONFIG_KEY_MISSING (env required) + delegates`, `✓ dx config beats db ordering (env error not misread as outage)`, `✓ dx UNKNOWN (unrecognized) — but NOT silent` |
| 2 | `node templates/tools/rollback-helper.mjs --self-test` | 0 | `rollback-helper self-test: 7/7 passed.` incl. `✓ last-known-good skips current → d2b`, `✓ ERROR deploy excluded from candidates`, `✓ single good deploy → no last-known-good to roll back to` |
| 3 | `node templates/tools/post-deploy-verify.mjs --self-test` | 0 | `post-deploy-verify self-test: 10/10 passed.` incl. `✓ one fail → ALARM`, `✓ verdict=down → step fail`, `✓ verdict=degraded → step ok but flagged`, `✓ skipped step does not fail the verdict` |
| 4 | `echo '{"subsystem":"database","error":"connect ETIMEDOUT","code":"ETIMEDOUT"}' \| node …/platform-health.mjs diagnose` | 0 | `diagnosis: DB_UNREACHABLE` + actionable naming the Supabase/pooler/config-doctor next step |
| 5 | `… validate` on a verdict/fold-mismatched report | 1 | `INVALID … ✗ verdict (ok) does not match the worst-wins fold of subsystems (down)` — drift is caught |
| 6 | `… validate` on a buildReport output | 0 | `valid — canonical /api/health/platform shape` |
| 7 | source audit: `grep -nE "writeFile\|appendFile\|unlink\|rmSync\|mkdir\|\.post\(\|method:\s*[\"']POST\|vercel promote\b\|spawnSync\(.*deploy" templates/tools/platform-health.mjs templates/tools/rollback-helper.mjs templates/tools/post-deploy-verify.mjs` | — | no write/mutate API; `vercel promote` appears ONLY inside a printed string (never executed); the sole `spawnSync` invokes `config-doctor.mjs --env production` (read-only); all network calls are `GET`/Vercel read endpoints |

## Acceptance criteria  (each PASS/FAIL + its evidence pointer)
| # | Criterion | Surface | Evidence | PASS/FAIL |
|---|-----------|---------|----------|-----------|
| 1 | Unified health: a canonical report shape with per-subsystem status + a worst-wins verdict; a CRITICAL down/unknown subsystem ⇒ overall down; the shape validates against `platform-health.schema.json` and the validator catches drift | self-test fold + validate CLI | #1, #5, #6 | PASS |
| 2 | Runtime diagnostics: every named cause (DB_UNREACHABLE · POOL_EXHAUSTION · CONFIG_KEY_MISSING[→config-doctor] · STUCK_CONSUMER_CURSOR · HEARTBEAT_STALE · EXTERNAL_API_ERROR) is classified, a thrown probe surfaces as down-with-cause (never silent), and an unrecognized failure is UNKNOWN-but-named | self-test taxonomy + diagnose CLI | #1, #4 | PASS |
| 3 | Rollback: the last-known-good production deploy is selected (READY + production only; current excluded; ERROR/preview excluded) and the exact promote command is produced — and NEVER executed | self-test + source audit | #2, #7 | PASS |
| 4 | Self-healing verification: post-deploy compose of config-doctor + health(not-down) + synthetic probe folds to HEALTHY/ALARM, a down verdict alarms, a skipped step does not fail, and the whole layer is read-only | self-test + source audit | #3, #7 | PASS |
> Surfaces exercised on the tools' own runtime (pure self-tests + CLI). The probe WIRING into each app (the live DB/heartbeat/cursor probes) is verified in the consumer repos' own tests (PLOS / rumah-admin PRs), not here — this slice is the reusable engine + contract.

## Machine-guard line
All verification is pure/deterministic and read-only: no network, no DB, no secret, no shared mutable store. The tools' read-only posture is asserted by source audit (#7), not merely claimed.
