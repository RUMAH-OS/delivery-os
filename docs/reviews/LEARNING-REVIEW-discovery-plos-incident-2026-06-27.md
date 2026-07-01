---
event: "incident"
date: "2026-06-27"
change: "Discovery→PLOS production incident closeout (reachability HTTP-000 hang + empty-contacts) → framework DB-preflight hardening"
triaged_by: "build session, reconstructed from the 5 blind RCAs + the converged RCA + the shipped fixes (#208/#209/#210 + BUG-209-1)"
milestone: "PLOS prod reachability restored (#209, 0/60 hangs) + contacts pipeline built (#210, founder go-live pending)"
---

# Learning Review — Discovery→PLOS production incident (2026-06-27)

> Converts the incident into ROUTED CAPABILITY (Governance §14 · ADR-003 L2). Every lesson → a
> skill/gate/standard/ledger candidate; every capability that FAILED to catch it → a strengthened capability.

## 1. Reconstruct from artifacts
PLOS prod intermittently hung to **HTTP 000** (a blank/timeout page) and, when it loaded, held **zero contacts**.
Five independent BLIND investigators (database-plane · discovery-pipeline · UI/contacts · production-e2e ·
vercel/deploy) converged on a **DUAL root cause** (`docs/audits/RCA-CONVERGED-discovery-plos-2026-06-27.md`):
**(A) reachability** — the serverless DB client had a bound only on connection *establishment*
(`connect_timeout`), not on *pool-acquire / query runtime*; high per-page fan-out against a `max:3` pool with
no `statement_timeout` queued unboundedly and ran past the gateway → 000. **(B) contacts** — discovery was
disabled-by-design + the sweep had no autonomous seed + a failed sweep, so prod was never populated.
Fixes: `#209` added `statement_timeout` (the load-bearing reachability fix — 0/60 hangs after); `#210` added a
seed cron (contacts; founder go-live pending); this closeout adds **BUG-209-1** (empty-env `Number(env)||default`)
and the framework **DB-preflight hardening** (this delivery-os change).

## 2. Were any framework-level lessons discovered?
Yes — five, all routed below. The most important is methodological: the blind, independent board CAUGHT and
corrected a contradiction (connect-establishment vs pool-acquire — #208 vs #209) that a single anchored
investigator would likely have missed; the two hypotheses had OPPOSITE remedies.

## 3. Capability impact (the §14 routing)
| Lesson | Layer | Asset | Destination |
|--------|-------|-------|-------------|
| The blind board caught the connect-vs-pool-acquire contradiction (opposite remedies) — the independence is what found it. | Delivery OS | doctrine + diagnostics taxonomy | PRESERVE the blind-multi-lens method (principle-11 / RCA); ENCODED as `QUERY_TIMEOUT` vs `POOL_EXHAUSTION` vs `DB_UNREACHABLE` in `platform-health.mjs` so the misclassification fails a self-test, not a prod cycle. |
| The empty-env trap: `Number(env ?? d)` lets an empty-string env coerce to 0 and silently disable the bound (BUG-209-1). | Delivery OS + project | lint/preflight + config rule | `assertDbClientHardening` flags `Number(env ?? d)` as a BLOCKER; config-doctor `int-positive` fails an empty/0 numeric knob at the gate; PLOS `numEnv` fix (PR #211). |
| `statement_timeout` is the ONLY ceiling on a pool-acquire/query hang (postgres.js has no pool-acquire timeout) — connect_timeout is not a substitute. | Delivery OS | STANDARD (doctrine) | Documented hang-safe DB-client STANDARD in the deploy-vercel-supabase platform skill; asserted by `preflight-db-client`. |
| A static source check proves DECLARES, not APPLIED/SANE (wrong-nesting, value over the gateway ceiling, adoption-not-wired). | Delivery OS | follow-up capability | NAMED: a boot-time `SHOW statement_timeout` self-assertion (driver-agnostic, self-wiring) + wire the preflight into a blocking pre-deploy chain + new-project registry template. |
| The seed-cadence gap: an autonomous sweep that only ADVANCES leads with no autonomous SEED step produces 0 output forever; and disabled-by-design flags + a failed sweep look identical to "broken". | project (PLOS) + ecosystem | wiring + observability | PLOS seed cron (#210); ecosystem note — a self-feeding pipeline needs a seed cadence, and a "disabled" 503 must be visibly distinct from a crash. |

## 4. Did any EXISTING capability fail to catch this?
- **The deploy/preflight layer did NOT assert DB-client hang-safety** → it does now (`preflight-db-client` + `int-positive`). This is how THIS review's own hardening was earned.
- **The runtime diagnostics could have misread the hang as a connection outage** (the #208 vs #209 trap) → the taxonomy now distinguishes acquire/query hangs from establishment failures.
- **The post-deploy health check alarmed RED yet shipped GREEN** (`continue-on-error: true`) → recorded; follow-up to make the alarm gate the release (PLOS-side).

## 5. Blast-radius fork
- **Project-local (PLOS), implemented in this series:** `numEnv` empty-env fix (PR #211) · seed cron (#210) · the converged RCA + a zero-tech Founder Review (PLOS `docs/reviews/`).
- **OS-base / cross-system, DESIGN-FIRST here (the framework change this review gates):** the `int-positive` config rule, the `QUERY_TIMEOUT` diagnostics + connect-vs-pool-acquire distinction, `assertDbClientHardening` + `preflight-db-client`, and the documented hang-safe DB-client STANDARD — all additive, Founder ratification PENDING. Follow-ups (boot-time self-assertion · blocking pre-deploy wiring · DoD/ADR promotion) recorded in `capabilities/signals.jsonl`.
