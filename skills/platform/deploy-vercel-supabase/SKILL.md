---
name: deploy-vercel-supabase
version: 2.0.0
stability: stable
description: >
  Deploy a Node API + SPA onto Vercel with Supabase Postgres as the system of record — including every
  foot-gun that cost a real deploy cycle. Invoke for any deployment or deployment-debugging on the
  Vercel+Supabase plane. (ECOSYSTEM PLATFORM PACK — catalog-registered, pull-on-need; install only in
  projects deploying on this plane.)
decision_class: production-readiness
inputs:  [Vercel token/team, Supabase project credentials, the smoke battery (templates/release-readiness.md)]
outputs: [live deployments + recorded smoke evidence]
earned_from: "A consumer's production API+UI deployment 2026-06-12: three deploy cycles compressed into this checklist — every foot-gun below is documented platform behavior that was learned the expensive way. Reclassified from project overlay to shared platform pack (ruling C4/N9): the foot-guns are plane-wide, not project-wide — any app on this plane hits them."
mechanical_spine: "the smoke battery rows in templates/release-readiness.md (the deploy is not done until they pass); platform-conventions-first 15-minute pass (doctrine D-PLATFORM)"
---
# Deploy: Vercel + Supabase (ecosystem platform pack)

## Overview
Platform knowledge needs a standard home — "no standard place for platform foot-gun knowledge" was a named
OS gap. This pack is that home for the Vercel+Supabase plane.

## When to use (and NOT)
- Use when: deploying or debugging a deployment on this plane.
- **NOT** for: other planes (each earns its own platform pack); go/no-go calls (→ §11 production-readiness class).

## Platform conventions FIRST (the 15 minutes that save 3 hours — doctrine D-PLATFORM)
- **Vercel framework preset**: check `vercel project inspect` / pull BEFORE writing adapters. The Hono preset
  builds `src/index.ts` as the function and requires `export default app` — a custom `api/` adapter FIGHTS it
  (root route invokes the preset's broken build → FUNCTION_INVOCATION_FAILED). Edge vs Node adapters differ
  (`hono/vercel` = Edge; the Node runtime hangs with it).
- **Supabase connections**: `db.<ref>.supabase.co` (direct, 5432) is **IPv6-only** — unreachable from
  IPv4-only machines. Operator/migrator → **session pooler** (5432); serverless app → **transaction pooler**
  (6543) with `prepare: false` and a SMALL pool. Pooler username = `<role>.<project-ref>`.
- **HANG-SAFE DB CLIENT — the STANDARD (PLOS prod incident 2026-06-27).** A serverless DB client MUST declare,
  or it can hang a request past the gateway to **HTTP 000** (a hung promise never throws, so the page `try/catch`
  cannot rescue it):
  1. **`statement_timeout`** (a per-connection server-side query bound, under the gateway ceiling — e.g. 8000ms <
     Vercel's ~25s). This is the **only** available ceiling on a pool-acquire/query hang: postgres.js has **no
     pool-acquire timeout**, so bounding the WORK each held connection does is what forces connections to cycle
     back → a fast degraded throw, not a gateway-busting hang. `connect_timeout` is NOT a substitute — it bounds
     ESTABLISHING a connection (~17ms; never the problem), not acquiring one or running a query.
  2. **A bounded pool (`max`)** — an explicit, finite ceiling.
  3. **Env-robustness: `Number(env) || default`, never `Number(env ?? default)`.** `??` only catches null/undefined;
     an env present as the **empty string** sails through and `Number("")===0`, silently disabling the timeout/pool
     (BUG-209-1). Declare numeric knobs with the config-registry `int-positive` rule so an empty value FAILS the
     gate up front. **Assert all three in CI/preflight**: `node <tools>/platform-health.mjs preflight-db-client --file
     <db-client>` (the vendored `infra/platform-health.mjs` in a consumer; exits non-zero on a missing bound) — and
     tell a pool-acquire/query hang apart from a connection
     outage with the diagnostics taxonomy (`QUERY_TIMEOUT`/`POOL_EXHAUSTION` vs `DB_UNREACHABLE`).
- **Auth**: new Supabase projects sign **ES256** (asymmetric, UUID key-id); an HS256 verifier needs the
  **Legacy JWT secret** (long base64). Don't confuse the two — an auth design assuming the old issuer model
  cost a cycle.

## Process
1. **DB phase**: migrations via the session pooler; a dedicated app role (LOGIN; password set OUT-OF-BAND via
   `ALTER ROLE` — never in a migration); RLS + policies in the SAME migration as any new table.
2. **Env vars**: `vercel env add` reads stdin — **never pipe from a legacy shell (BOM corrupts the value →
   Invalid URL at runtime; Governance §15 byte/secret rule)**; use the dashboard or a clean runtime. Non-interactive
   CLI needs `--scope <team>` for `link`. Env changes require a redeploy.
3. **SPA project**: its own Vercel project (subdir `link` again, with scope); SPA-fallback rewrite; build-time
   `VITE_*`/public vars; **standalone `npm ci && build` in a Linux container before deploying** (catches
   parent-repo type-hoisting leaks that local installs hide).
4. **CORS**: explicit allowlist env on the API; verify allow AND deny live.
5. **Smoke battery (deploy ≠ done — B28)**: `/health` 200 · dev/debug endpoints 404 · 401 no token / 403 wrong
   scope / 200 right scope · contract-validated body from a real endpoint · CORS both ways · root + unknown
   routes 404 (not 500) · the bundle contains the intended API URL · **login-path smoke: a real user can sign
   in on the deployed surface** (a UI once shipped to production with no working login).
6. **Tokens**: mint service principals with least scope and bounded expiry; deliver via env/secret store;
   record the rotation procedure.

## Red flags
- Writing integration code before reading the platform's auto-detection behavior.
- Logs fetched only as truncated summaries — use `--json` and read the full first error.
- Anything with bytes or secrets passing through a legacy shell pipe.

## Verification (of this skill's own output)
- The smoke battery rows in the release-readiness doc each carry a verbatim probe result.

## Changelog
- 2.0.0 — v4: promoted from a consumer overlay to the shared ecosystem platform pack (C4/N9); login-path smoke folded in (B28); nouns stripped.
