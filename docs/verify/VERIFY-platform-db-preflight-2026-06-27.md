---
slice: "platform db-preflight hardening — statement_timeout/bounded-pool/env-robustness STANDARD + connect-vs-pool-acquire diagnostics"
verify_status: verified
# ^ one of: planned | generated | executed | verified. 'verified' only when ALL gates below pass.
author: "build agent (Opus 4.8 build session, 2026-06-27)"
verifier: "deterministic machine probes (re-runnable on neutral hardware) + two BLIND foundation-review lenses (reviewer-critic + lead-architect); independent human/agent re-run owed at PR (binding gate)"
date: "2026-06-27"
independence_basis: "machine-probe (self-tests) + two blind review lenses ran on the diff; author≠verifier human pass owed at PR review"
machine_probe: "node templates/tools/config-doctor.mjs --self-test && node templates/tools/platform-health.mjs --self-test"
impl_fingerprint: '{"templates/tools/config-doctor.mjs":"8c3ea36b9cf052733f58f937efb557c4ca239fa84b8d2318b63417b3d6e43659","templates/tools/platform-health.mjs":"a586d17f463d99d52ec8fc4b870e486442ad4b645307b0cf6b5bfebc2d1846da","templates/tools/config-registry.schema.json":"c29d69dbe7d41a2f4a50626b47bde18519dd6de536550d01c0fd1c811bc2a08c","templates/tools/platform-health.d.mts":"6f2c20608998bff487e8dd4d1adfe5bf66413fe151f3f8589b43363c68d7f504"}'
---

# VERIFY — platform DB-preflight hardening (Infrastructure Platform)

## Verdict
**verify_status:** `verified` (by deterministic machine probe + two blind review lenses) — one line: the config-doctor `int-positive` rule and the platform-health `QUERY_TIMEOUT` cause, the connect-vs-pool-acquire ordering, and the `assertDbClientHardening` preflight all self-test green, and the preflight provably catches the real-world incident class (it FAILS the pre-fix PLOS client and PASSES the fixed one).
> Honest limit: machine-probe + two blind lenses (reviewer-critic = consistency, lead-architect = forward gaps) ran on this diff. The author≠verifier HUMAN/founder pass is owed at PR — the Founder ratification of this capability is **PENDING** (see the Founder Review).

## Independence header (Governance §3/§12)
- Verifier: deterministic self-tests (machine_probe above) + two BLIND foundation lenses on the diff.
- Author identity (code under test): build agent (Opus 4.8 build session).
- [x] The machine probe is independent of intent — it asserts behavior, not the author's claims.
- [x] Two distinct review lenses worked BLIND on the diff (Foundation Review verdict: STABLE / STABLE-WITH-FIXES; cheap fixes applied, structural follow-ups named).
- [ ] Founder ratification — PENDING at PR.

## Execution evidence (Governance §1 — direct runtime output)
| # | Command | Exit | Output |
|---|---------|------|--------|
| 1 | `node templates/tools/config-doctor.mjs --self-test` | 0 | `self-test: 21/21 passed.` incl. `int-positive accepts a positive integer`, `int-positive REJECTS 0 (= disables the bound)`, `int-positive treats EMPTY as MISSING` |
| 2 | `node templates/tools/platform-health.mjs --self-test` | 0 | `platform-health self-test: 46/46 passed.` incl. `dx QUERY_TIMEOUT (statement_timeout fired, pg 57014)`, `dx QUERY_TIMEOUT is NOT misread as an outage`, `dx POOL_EXHAUSTION (acquire-queue wait, not establishment)`, `dx DB_UNREACHABLE is ESTABLISHMENT-only`, `preflight FAIL: missing statement_timeout is a BLOCKER`, `preflight FAIL: \`Number(env ?? d)\` empty-env trap is a BLOCKER`, `preflight: the anti-pattern quoted in a COMMENT does not false-positive`, `preflight: connection_limit counts as a bounded pool`, `preflight: statement_timeout default >= 25s is flagged`, `preflight: postgres.js statement_timeout outside connection{} is flagged` |
| 3 | `preflight-db-client --file <PLOS client @ origin/main>` (pre-fix) | 1 | `✗ [blocker] env-nullish-coalesce … FAIL` — catches BUG-209-1 |
| 4 | `preflight-db-client --file <PLOS client @ fix branch>` (post-fix) | 0 | `✓ statement_timeout · bounded pool · env-robustness — all present. … PASS` |

## Acceptance criteria
- [x] (a) A deploy/runtime preflight asserts a prod DB client declares statement_timeout + a bounded pool + `Number(env)||default` robustness — `assertDbClientHardening` + `preflight-db-client`, exit-coded; proven against a real before/after client.
- [x] (b) statement_timeout + env-robustness documented as the STANDARD — config-doctor `int-positive` rule + registry schema + the deploy-vercel-supabase platform skill.
- [x] (c) Diagnostics distinguish a pool-acquire/query hang from a connection failure — `QUERY_TIMEOUT` + reordered `POOL_EXHAUSTION` before `DB_UNREACHABLE` (establishment-only), with self-tests.

## Honest limits / residual (carried, not hidden — see Foundation Review)
- A STATIC source check proves a client DECLARES the bound, not that it is APPLIED or sane-valued at runtime. Cheap value/nesting checks were added (≥25s default, postgres.js wrong-nesting, connection_limit); the structural closer (a boot-time `SHOW statement_timeout` self-assertion) is the named highest-value follow-up.
- ADOPTION is not yet enforced: the preflight + `int-positive` only help once a project wires them into CI and declares the knobs in its registry. Named as a follow-up (blocking pre-deploy chain + new-project registry template).
