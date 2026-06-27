---
review: foundation
date: "2026-06-27"
change: "Infrastructure Config Platform — config-doctor + config-registry.schema.json + per-repo registries + deploy/config gates + consolidated FAP"
verdict: "STABLE — build on it"
lenses: "reviewer-critic (consistency/contradictions) + lead-architect (forward gaps) — consolidated by the qa-test landing lens"
---

# Foundation Review — Infrastructure Config Platform

> Auto-triggered by the Review-Class Trigger (Governance §14 · ADR-003 L2). Question: are the foundations this
> change builds on still internally consistent + still valid? Consolidated here from the two blind lenses during
> the independent landing/verification pass.

## Foundation set reviewed
The platform rests on, and was cross-checked against, these load-bearing foundations:
- **The env-schema contracts it derives from** — PLOS `packages/config/src/env.ts` (zod boundary; only DATABASE_URL
  is hard-required, the rest zod-optional) and rumah-admin `src/env.ts` (the .env loader + `assertNotProductionDb`
  prod-DB guard, project ref `clfocpodfbtgzivnivck`).
- **The deploy pipelines it gates** — PLOS `deploy.yml` (Vercel prebuilt flow: pull → build → deploy) and
  rumah-admin's Vercel native-Git integration (`vercel.json` + `.vercel/repo.json`).
- **The verify-gate + review-class trigger** (Governance §12/§14) the platform itself must pass to land.
- **The Vercel/Supabase topology** — TEAM scope `team_1CSTFxqvnOe9lvHtCsPHSeax`; Supabase EU Postgres + the
  transaction-pooler-6543 fact (the build-fix + 503-cure).

## VERDICT: STABLE — build on it
- **Consistency (reviewer-critic):** Coherent. The registry schema, the doctor's rule engine, and both per-repo
  registries agree (`postgres-pooler-6543` is encoded identically in all three; vendored doctors are byte-identical
  to the template). The doctor's prod lane reads Vercel read-only and never consults local `.env` — consistent with
  the "prod truth is Vercel" doctrine and the prod-DB guard. ONE inconsistency surfaced and was resolved: the FAP was
  silent on the Vercel scope while a sibling doc (`FAP-platform-hardening-v6.md`) named the WRONG personal scope —
  fixed additively in the FAP (no foundation redesign needed).
- **Forward gaps (lead-architect):** The model is the right shape — a declarative per-service registry + a read-only
  doctor + a CI gate is reusable and additive (it sits beside the env schema, does not replace it). The registry's
  "production-operational required" set is a deliberate superset of the zod-required set, honestly documented. No
  structural gap; the dev-lane pooler rule is a tuning nit (Bug 2 in the VERIFY), not an architectural flaw.

## Findings + fixes
| # | Sev | Finding | Fix applied / required |
|---|-----|---------|------------------------|
| F1 | Should | FAP silent on the Vercel TEAM scope; sibling doc named the personal scope (founder-edits-wrong-project risk) | Fixed additively in `FAP-infra-config-cutover.md` §3 (canonical-scope callout + per-section scope) — see VERIFY Bug 1 |
| F2 | Nice | `postgres-pooler-6543` applied to `--env development` flags a local dev DB INVALID | Forwarded to author (VERIFY Bug 2); dev is not gated, so non-blocking |
| F3 | Nice | Stale wrong-scope line persists in `FAP-platform-hardening-v6.md:49` | Forwarded to that doc's owner (VERIFY Bug 3); already declared superseded |

## Conclusion
The foundations are STABLE to build on. No redesign required; the single accuracy defect was corrected additively in
the founder-facing doc, and the two remaining items are non-blocking nits forwarded author-ward.
