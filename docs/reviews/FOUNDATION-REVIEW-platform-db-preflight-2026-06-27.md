---
review: foundation
date: "2026-06-27"
change: "platform DB-preflight hardening — statement_timeout/bounded-pool/env-robustness STANDARD + connect-vs-pool-acquire diagnostics (delivery-os Infrastructure Platform)"
verdict: "STABLE-WITH-FIXES — cheap fixes applied in-branch; structural follow-ups named, not blocking"
lenses: "reviewer-critic (consistency, BLIND) + lead-architect (forward gaps, BLIND), consolidated"
---

# Foundation Review — platform DB-preflight hardening

> Auto-triggered by the Review-Class Trigger (Governance §14 · ADR-003 L2). Two INDEPENDENT lenses worked
> BLIND on the diff (reviewer-critic = contradictions/consistency · lead-architect = forward gaps), then
> consolidated here. No single agent concluded alone (§11).

## Foundation set reviewed
`templates/tools/config-doctor.mjs` (the config-validation engine) · `templates/tools/platform-health.mjs` (the runtime-diagnostics + health engine) · `templates/tools/platform-health.d.mts` · `templates/tools/config-registry.schema.json` · `skills/platform/deploy-vercel-supabase/SKILL.md` (the platform playbook). Cross-checked against the just-built reality (self-tests + a real before/after PLOS client).

## VERDICT: STABLE-WITH-FIXES
- **Consistency (reviewer-critic): STABLE.** Both self-tests pass (config-doctor 21/21, platform-health 46/46). `classifyFailure` ordering is correct (CONFIG → QUERY_TIMEOUT → POOL_EXHAUSTION → DB_UNREACHABLE, each early-returning) — a statement-timeout or acquire-queue symptom can never fall through to the outage class. The comment-strip in `assertDbClientHardening` correctly preserves `://` URLs and does not false-positive on a documented anti-pattern. `d.mts` is in sync with the `.mjs` exports; the SKILL.md standard and schema docs match what the code enforces. (The one surprise — the lens saw the PLOS preflight FAIL — was the tool working as designed against the *pre-fix* client in the shared working tree at that instant; the fixed client PASSES.)
- **Forward gaps (lead-architect): STABLE-WITH-FIXES.** The change is sound and self-tested, but as an ecosystem recurrence-preventer it hardens *diagnosis* and provides a *checker* without yet *forcing* the fix to be present/applied/sane everywhere. The headline limit: a static source check proves a client DECLARES a bound, not that it is APPLIED (wrong-nesting), SANE-valued (over the gateway ceiling), or actually wired into any project's CI.

## Findings + fixes
| # | Sev | Finding (lens) | Fix |
|---|-----|----------------|-----|
| F1 | Should | POOL_EXHAUSTION matched connect-timeout phrasings and was ordered before DB_UNREACHABLE, with an actionable that said "do not chase the network" — could steer an operator away from a real paused-DB outage (lead-architect #3). | **FIXED in-branch:** the POOL_EXHAUSTION actionable now leads with "FIRST confirm the DB is actually up (a paused project can surface a similar connect-timeout message — if down, this is really DB_UNREACHABLE)". |
| F2 | Should | Static check proves DECLARES, not APPLIED/SANE: postgres.js silently ignores a top-level `statement_timeout`; a literal default ≥ the ~25s gateway still hangs; `max:` heuristic was promiscuous and postgres.js-shaped (lead-architect #1). | **PARTIALLY FIXED in-branch:** added a `statement-timeout-not-in-connection` SHOULD (postgres.js wrong-nesting), a `statement-timeout-too-high` SHOULD (literal default ≥ 25000ms), accepted Prisma `connection_limit` as a bounded pool, and constrained the `max:` match to a client-construction context. Residual (declared-vs-applied) → F5. |
| F3 | Nice | `int-positive` message said "empty" though `validate()` short-circuits empty → MISSING upstream (reviewer-critic). | **FIXED:** message trimmed to "0/negative/non-numeric" with a comment noting empty is handled upstream. |
| F4 | Nice | `PreflightSeverity` declared `"should"` though no finding emitted it (reviewer-critic). | **RESOLVED:** the F2 fixes now emit `"should"` findings — the type is exercised. |
| F5 | Should (follow-up, NOT blocking) | A static check structurally cannot prove the bound is APPLIED at runtime; and adoption is unenforced — the preflight + `int-positive` only help once a project wires them into CI and declares the knobs (lead-architect #1+#2). | **NAMED, not built (scope-disciplined, Founder-PENDING):** (i) the highest-value closer — a drop-in boot-time self-assertion that reads back the EFFECTIVE `statement_timeout` (`SHOW statement_timeout`) and fails closed if 0/unbounded or ≥ the gateway ceiling (driver-agnostic, self-wiring); (ii) wire `preflight-db-client` + the three `int-positive` knobs into a blocking pre-deploy chain + the new-project registry template; (iii) promote the generic invariant to a DoD/ADR line, not just platform-skill prose. Recorded in the Learning Review + `capabilities/signals.jsonl`. |

## Conclusion
The foundations are **stable to build on**: the diagnostics taxonomy and the preflight are internally consistent, type-aligned, and proven against the real incident class. The cheap correctness/wording fixes (F1–F4) are applied in-branch. The structural gap (F5 — a static checker is not a runtime proof, and adoption is not yet enforced) is real but **additive-later**; it is named and routed to the capability ledger rather than smoothed over, and the single highest-value follow-up (a boot-time effective-timeout self-assertion) is recorded. Nothing must change before this lands as an additive capability; Founder ratification of the capability is PENDING.
