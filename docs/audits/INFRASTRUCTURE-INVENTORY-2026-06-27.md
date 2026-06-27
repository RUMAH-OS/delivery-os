# Infrastructure Inventory & Drift Audit — RUMAH ecosystem

> **Read-only audit.** No prod data or secrets touched; no code modified. Env vars are
> reported by **name only**, never value. Feeds the new **Infrastructure Platform / Config
> Registry** capability and the proposed `ecosystem-architecture/12-infrastructure-registry.md`.
> Date: 2026-06-27 · Scope: rumah-admin (Admin), property-lead-os (PLOS + Discovery),
> delivery-os (framework), ecosystem-architecture (portfolio truth).

---

## 0. Executive summary

- **No Infrastructure/Config Registry exists today.** The ecosystem-architecture repo records infra
  at the *policy* level (`ECR-0005`) but **no concrete resource inventory** — no Supabase refs, no
  Vercel project IDs, no org-scope IDs, no env-key lists. This document is that first inventory.
- **Two production apps on one plane (Vercel + Supabase EU):** `rumah-admin` and `property-lead-os`.
  Delivery-os is the framework (no runtime); it ships the *conventions* and *templates*.
- **The single most important finding is a pooler INVERSION:** the two apps reached **opposite**
  pooled-vs-direct conclusions, each from its own production 503 — and one of them (Admin) **violates
  the ratified ECR-0005 standard** ("Supavisor transaction pooler, never 5432"). This is a deliberate,
  workload-driven divergence that the registry must **record with rationale, not "fix" by unifying.**
- **Vercel scope is genuinely ambiguous for PLOS:** Admin is provably on the **team** scope; PLOS's
  deploy workflow targets the **team** scope, but two PLOS docs (incl. the live FAP) still name the
  **personal** scope — a documentation/expectation drift with real "founder edits the wrong project" risk.

---

## 1. The complete map (app → infra → provider → owner → state → drift)

### 1.1 rumah-admin (Admin) — `C:\Users\brian\RUMAH\rumah-admin`

| Concern | Fact | Evidence | Drift |
|---|---|---|---|
| Supabase project (prod) | ref **`clfocpodfbtgzivnivck`**, host `aws-0-eu-west-1.pooler.supabase.com` | `src/env.ts:33` (`PROD_DB_REF`), `src/db/guard-prod.ts:28` | typo `clfocpodfbtgzivck` in several docs — **D7** |
| Dev/test DB | local Docker Postgres `55432→5432` (no dev Supabase project) | `docker-compose.test.yml`, `src/env.ts` precedence | — |
| **Pooler mode (app)** | **SESSION pooler `:5432`** (deliberate). `max:5, prepare:false`. Transaction pooler `:6543` was **removed** after the 2026-06-13 incident (query-crossing/hang on the module-level `postgres.js` singleton → 503) | `src/db/client.ts:14-34`, `docs/RUNBOOK-post-deploy-smoke.md:13-31` | **D1 (inversion)**, **D9 (violates ECR-0005)** |
| `DATABASE_URL_POOLER` | the `:6543` transaction string, **repro-only, not consumed by app** | `docs/verify/VERIFY-db-client-session-pooler-config-local.md:56` | **D4 (dup/unused string)** |
| Conn-string env vars | `DATABASE_URL` (app+migrator), `DATABASE_URL_POOLER` (repro), `SPINE_DATABASE_URL` (planned, no code), `LEGACY_DATABASE_URL`/`LEGACY_KV_TABLE` (legacy profiling) | `src/db/client.ts`, `.env.example:18` | SPINE planned-only |
| Prod-write guard | fail-closed: refuses migrate/seed/rollback on prod ref/host unless `ALLOW_PROD_DB=1`+`--prod` | `src/db/guard-prod.ts` | — (good; from 2026-06-25 incident) |
| Migrations | dir `migrations/`, **latest `0051_delivery_tracking_keys.sql`**; ledger `_migrations`; gap at 0040; **gated** 0033/0035/0036 (need `--include-gated`) | `src/db/migrate-core.ts:38-52` | applied-vs-repo **not** recorded in-repo — **D8** |
| Storage | **No Supabase Storage / blob.** Binary stored in-DB as `bytea`+`sha256` | `src/db/schema.ts:125,340,361`, `src/admin.ts:324-356` | — |
| Email | **Gmail API (OAuth2)** — `GOOGLE_OAUTH_CLIENT_ID/SECRET`, `GMAIL_REFRESH_TOKEN`, `GMAIL_SENDER`(/`MAILBOX_OWNER`), `GMAIL_SENDER_NAME`; no-ops if unset (replaced Resend) | `src/mailer.ts` | diverges from ECR-0005 "Resend" standard (intentional) |
| Other integrations | `VERCEL_TOKEN` (deploy/discovery ops), `PLOS_OPS_TOKEN` (Admin→PLOS seam bearer), in-house e-signing (no 3rd party), `AUTH_JWT_SECRET`, `FOUNDER_ADMIN_TOKEN`, `CRON_SECRET`, `PROD_SMOKE_TOKEN` | `src/auth.ts:31`, `src/heartbeat-api.ts:61` | `VERCEL_TOKEN` live in working-tree `.env` — **D6** |
| Vercel project | **`prj_R22oyiDfMf8wvYtG2KXyZThtRNuF`** name `rumah-admin` | `.vercel/repo.json:5` | — |
| **Vercel scope** | **TEAM `team_1CSTFxqvnOe9lvHtCsPHSeax`** | `.vercel/repo.json:8` (`orgId`) | canonical; see **D2** |
| Runtime | framework `hono`, **Node `24.x`** | `.vercel/project.json` | **D5 (Node mismatch vs PLOS 22.x)** |
| Cron | **`/v1/heartbeat` every 5 min (`*/5 * * * *`)** drives engine tick + reminders | `vercel.json` | **D10 — 5-min cron needs Vercel Pro; Hobby runs daily-only. Confirm plan.** |
| Deploy mechanism | **Vercel native Git integration** (no `deploy.yml`). CI = `ci.yml` (binding gate) + `prod-smoke.yml` (post-deploy) | `.github/workflows/` | **D11 (differs from PLOS Actions deploy)** |
| Env contract | bespoke zero-dep `.env` loader (no zod). Keys: see §2 | `src/env.ts` | no schema validation |

### 1.2 property-lead-os (PLOS + Discovery) — `C:\Users\brian\RUMAH\property-lead-os`

| Concern | Fact | Evidence | Drift |
|---|---|---|---|
| Supabase project (prod) | **ref NOT committed** anywhere — lives only in Vercel env. All `*.supabase.co` in repo are fixtures | `packages/db/src/client.ts`, tests | **D3 (ref unrecorded)** |
| Dev/test DB | local `localhost:5433/plos`; CI `localhost:5432` | `.github/workflows/ci.yml:28,36` | — |
| **Pooler mode (app)** | **TRANSACTION pooler `:6543`** (deliberate). `getDb()→toTransactionPoolerUrl()` rewrites a `*.pooler.supabase.com:5432`→`:6543`, `prepare:false`, `max=3` (`DB_POOL_MAX`), opt-out `PLOS_DB_TRANSACTION_POOLER=off`. Session pooler `:5432` hit the **15-client EMAXCONN cap → 503** | `packages/db/src/client.ts:46-63,69-95` (verified) | **D1 (inversion)** |
| Rewrite gap | a **direct** host `db.<ref>.supabase.co:5432` (and any non-pooler URL) is returned **UNCHANGED** → no pooling → exhausts under load | `client.ts:41-42,57-62` (verified) | **D1b (503 risk if prod URL is direct host)** |
| Conn-string env vars | `DATABASE_URL` (required), `TEST_DATABASE_URL` (must end `_test`); knobs `DB_POOL_MAX`(3), `PLOS_DB_TRANSACTION_POOLER=off` | `packages/config/src/env.ts` | — |
| Migrations | dir `packages/db/migrations/`, **latest `0035_customer_contact_provenance.sql`** (raw `.sql`, forward-only); separate engine set `packages/engine-install/migrations/0000-0004` | `packages/db/scripts/migrate-check.ts:14,41-45` | `meta/_journal.json` lists only 0000-0003 — **D8b (stale journal, harmless)** |
| Storage | none. Invoice PDFs **fetched from Admin** at `<host>/admin/invoices/:id/pdf` | `env.ts` `resolveInvoicePdfBase` (:504) + `ADMIN_INVOICE_PDF_BASE_URL` (:393-411) | `SUPABASE_*` keys present but unused |
| **Email — keyless DWD** | **`google_dwd_keyless` is the LIVE lane**: ADC (`gcloud auth application-default login`) + IAM Credentials `signJwt` + jwt-bearer exchange, minted **`gmail.send`** only. **No env secret.** Subject (impersonated mailbox) is **DB data** on `org_connectors`, not env | `packages/integrations/src/gmail-mailbox.ts:90-100,176-217` + `registry.ts`; migrations `0020_workspace_org_connectors.sql`/`0021_keyless_dwd_connector_kind.sql` (all verified) | — (keyless by design) |
| Email — alt lanes | `dwd_impersonation` via `GOOGLE_DWD_SA_KEY` (optional, inert if unset); OAuth lane `GOOGLE_OAUTH_CLIENT_ID/SECRET` + tokens AES-256-GCM via `MAILBOX_TOKEN_ENC_KEY`; `GWS_BIN` CLI lane | `gmail-mailbox.ts`, `workspace-cli.ts` | — |
| LLM / 3rd party | `ANTHROPIC_API_KEY` (Claude — A2/Advisor/drafting), `SERPAPI_KEY`(+`SERPER`/`BRAVE`/`BING`), `APOLLO_API_KEY`, `NEVERBOUNCE_API_KEY`, `KVK_API_KEY`; deferred `SMARTLEAD`/`POSTMARK`/`CALCOM`/`REDIS_URL` | `packages/config/src/env.ts` | — |
| Admin seam | least-privilege bearers `ADMIN_OPS_TOKEN`/`ADMIN_EVENTS_TOKEN`/`ADMIN_DELIVERIES_TOKEN`/`ADMIN_DELIVERY_TOKEN`/`ADMIN_CONTACT_SOURCE_TOKEN` + URLs `ADMIN_*_URL`; engine `TICK_TOKEN`, `CRON_SECRET` | `env.ts` | — |
| Vercel project | name `property-lead-os`; **project id NOT committed** (GitHub secret; `.vercel/project.json` gitignored) | `.github/workflows/deploy.yml` | **D3 (id unrecorded)** |
| **Vercel scope** | deploy targets **TEAM `team_1CSTFxqvnOe9lvHtCsPHSeax`** ("Ruma Housing") via `VERCEL_ORG_ID` secret | `deploy.yml:17,87` | **D2** — docs name **personal** `bkasanwiredjos-projects` (`docs/surfaced-to-admin/PLAN-admin-website-migration.md:32`; delivery-os `docs/goals/FAP-platform-hardening-v6.md:49`) |
| Runtime | region **`fra1`**; API `maxDuration:60`; **Node `22.x`** (pinned via API to dodge Node-24 failure); `NODE_OPTIONS=--max-old-space-size=6144` | `apps/web/vercel.json`, `deploy.yml` | **D5 (vs Admin 24.x)** |
| Cron | **3 daily crons** (Hobby-compliant): `dunning-sweep` `0 8`, `admin-events-drain` `0 6`, `discovery-sweep` `0 7` (fail-closed behind `DISCOVERY_ENABLED`+`DISCOVERY_SWEEP_ENABLED`) | `apps/web/vercel.json` | — (respects Hobby) |
| Deploy mechanism | **GitHub Actions `deploy.yml`** — push to `main` → Vercel CLI `@39` prebuilt `--prod` | `.github/workflows/deploy.yml` | **D11 (differs from Admin native)** |
| Env contract | **`packages/config/src/env.ts`** (Zod, fail-fast). Only `DATABASE_URL` required. Full list: §2 | `packages/config/src/env.ts` | `VERCEL_TOKEN`+provider keys live in working-tree `.env` — **D6** |

### 1.3 delivery-os (framework) — `C:\Users\brian\RUMAH\delivery-os`

Runs **no app, no DB**. Ships **conventions + templates** only. Owns **no registry** (CLAUDE.md §7).

| Concern | What the framework PRESCRIBES | Evidence |
|---|---|---|
| DB connection doctrine | **operator/migrator → session pooler `:5432`**; **serverless app → transaction pooler `:6543`** (`prepare:false`, small pool); `db.<ref>.supabase.co` direct `:5432` is **IPv6-only/unreachable**; pooler user = `<role>.<ref>` | `skills/platform/deploy-vercel-supabase/SKILL.md:31-36` |
| Env var convention | single **`DATABASE_URL`** (+`DEV_DATABASE_URL` secret). **No `DIRECT_URL`** convention — pooled/direct expressed via host/port on one var | deploy skill, `templates/runbooks/FOUNDER-RUNBOOK-DEV-PROVISIONING.md` |
| Test-DB guard | DB name must end `_test` (no override) | `templates/test-harness/assert-test-database.mjs` |
| Vercel templates | `templates/workflows/{dev-preview,promote-to-prod,...}.yml` referencing `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID_DEV`; Node `22.x` pin; CLI `@39`; deploy-lane denylist `templates/.deploy-lane.json` | `templates/workflows/`, `docs/deploy-lane-setup.md` |
| Scope convention | prescribes the **mechanism** (`VERCEL_ORG_ID` secret), **not** a personal-vs-team rule. Concrete values appear only as consumer examples | `templates/runbooks/FOUNDER-RUNBOOK-DEV-PROVISIONING.md` |
| Infra registry | **does not exist here**; no `docs/audits/` previously. Closest: `docs/ECOSYSTEM-STATE-ASSESSMENT-2026-06-24.md`, `docs/goals/FAP-platform-hardening-v6.md` | — |

### 1.4 ecosystem-architecture (portfolio truth) — `C:\Users\brian\RUMAH\ecosystem-architecture`

| Concern | Fact | Evidence |
|---|---|---|
| Infra strategy (policy) | **ECR-0005** (Accepted/Ratified 2026-06-11): Plane A serverless **Vercel + Supabase + Resend**; Plane B always-on **Hetzner** (PLOS only). Standards: Vercel region `fra1`, Supabase **one project per bounded context**, EU region pinned, access via **Supavisor transaction-mode pooler, NEVER port 5432**; default async = **pgmq + pg_cron** | `decisions/ECR-0005-infrastructure-and-compute-plane-strategy.md` |
| Store locality | **ECR-0004**: Admin owns a **separate** Postgres; consumes the Spine read-only | `decisions/ECR-0004-...md` |
| Shared systems | Resend, DNS **Cloud86**, Vercel, Hetzner, Supabase EU, GitHub org `bkasanwiredjo` | `04-shared-systems-map.md` |
| Source-of-truth | Spine (physically PLOS Supabase) owns Org/Lead/Contact/Signal; Admin owns Property/Deal/Tenant/Contract/Invoice | `06-source-of-truth-registry.md` |
| **Concrete resource registry** | **NONE.** No Supabase refs, no Vercel project IDs, no org-scope IDs, no env-key lists. The `team_*`/personal scopes appear nowhere (zero grep hits) | — |

---

## 2. Declared env contracts (the authoritative "what each runtime needs")

**PLOS — `packages/config/src/env.ts` (Zod):** *Required:* `DATABASE_URL`. *Defaulted:* `NODE_ENV`,
`LOG_LEVEL`, `SEARCH_PROVIDER`, `SEARCH_MIN_INTERVAL_MS`, `A2_MODEL`, `A2_PROMPT_VERSION`,
`RESEARCH_FRESHNESS_TTL_DAYS`, `ENRICHMENT_TTL_DAYS`, `A2_DAILY_SPEND_CAP_EUR`, `USD_PER_EUR`,
`A2_MAX_ITERATIONS`, `A2_MAX_SEARCHES_PER_RUN`, `DISCOVERY_MAX_SEARCHES_PER_RUN`,
`INVOICE_EMAIL_LANGUAGE`. *Optional:* `SUPABASE_URL/ANON_KEY/SERVICE_ROLE_KEY/JWT_SECRET`, `REDIS_URL`,
`DISCOVERY_ENABLED`, `TICK_TOKEN`, `ANTHROPIC_API_KEY`, `APOLLO_API_KEY`, `NEVERBOUNCE_API_KEY`,
`SERPAPI_KEY`, `SERPER_API_KEY`, `BRAVE_API_KEY`, `BING_API_KEY`, `KVK_API_KEY`, model overrides
(`PLOS_*_MODEL`, `A2_RUN_SPEND_CAP_EUR`), mailbox (`MAILBOX_TOKEN_ENC_KEY`, `GOOGLE_OAUTH_CLIENT_ID/SECRET`,
`GOOGLE_DWD_SA_KEY`, `GWS_BIN`, `MAILBOX_OWNER(S)`, `MAILBOX_PRIMARY_OWNER`, `INVOICE_SEND_MAILBOX`,
`FOLLOWUP_SEND_MAILBOX`, `MAILBOX_SENDER_IDENTITY`), invoice profile (`INVOICE_FROM_DISPLAY_NAME`,
`COMPANY_LEGAL_NAME/ADDRESS/KVK/BTW/IBAN/IBAN_HOLDER/BILLING_EMAIL/BILLING_PHONE/LOGO`,
`INVOICE_SIGNATURE_NAME/ROLE`), Admin seam (`ADMIN_OPS_URL/TOKEN`, `ADMIN_UI_URL`,
`ADMIN_EVENTS_URL/TOKEN`, `ADMIN_DRAIN_INTERVAL_MS`, `ADMIN_HANDOFF_CANARY_EVENT_ID`, `ADMIN_EXPECTED_DB`,
`ADMIN_HANDOFF_STALE_MS`, `ADMIN_DELIVERIES_URL/TOKEN`, `ADMIN_INVOICE_PDF_BASE_URL`,
`ADMIN_DELIVERY_TOKEN`, `ADMIN_DELIVERY_PACKAGE_BASE_URL`). *Read outside schema:* `DB_POOL_MAX`,
`PLOS_DB_TRANSACTION_POOLER`, `TEST_DATABASE_URL`, `CRON_SECRET`, `DISCOVERY_SWEEP_*`.

**Admin — `src/env.ts` (bespoke `.env` loader, no schema):** DB: `DATABASE_URL`, `DATABASE_URL_POOLER`,
`DB_POOL_MAX`, `SPINE_DATABASE_URL`, `LEGACY_DATABASE_URL`, `LEGACY_KV_TABLE`, `RUMAH_APP_DB_PASSWORD`,
`ALLOW_PROD_DB`, `ALLOW_PROD_DB_WRITE`, `RUMAH_ENV`, `NODE_ENV`. Server/auth: `PORT`, `CORS_ORIGINS`,
`AUTH_JWT_SECRET`, `AUTH_DEV_TOKENS`, `FOUNDER_ADMIN_TOKEN`, `CRON_SECRET`, `PUBLIC_BASE_URL`,
`RUMAH_INTERNAL_EMAIL`. Gmail: `GOOGLE_OAUTH_CLIENT_ID/SECRET`, `GMAIL_REFRESH_TOKEN`, `GMAIL_SENDER`,
`MAILBOX_OWNER`, `GMAIL_SENDER_NAME`. Invoice: `INVOICE_EMAIL_BRAND/LANG/DISCLAIMER`. Engine:
`ENGINE_PACKS`, `COMMS_GO_LIVE`, `OWNER_INVOICE_SYNC`, `ENGINE_VERIFY_FORCE_FAIL`, `ENGINE_FORCE_FAIL`,
`CLAUDE_BIN`. Ops: `VERCEL_TOKEN`, `PLOS_OPS_TOKEN`, `SUPABASE_PUBLISHABLE_KEY`. Smoke: `PROD_BASE_URL`,
`PROD_SMOKE_TOKEN`. Frontend (Vite): `VITE_API_URL`.

---

## 3. Drift / inconsistency register (ranked)

| # | Drift | Severity | Detail |
|---|---|---|---|
| **D1** | **Pooler INVERSION across the two apps** | **HIGH** | Admin app = **session pooler `:5432`** (txn pooler crossed queries on a `postgres.js` singleton → 503); PLOS app = **transaction pooler `:6543`** (session pooler hit the 15-client `EMAXCONN` cap → 503). Same plane, **opposite** conclusions, **both from a 503**. **Both are correct for their workload** — record per-app with rationale; do NOT unify. |
| **D9** | **Admin violates ratified ECR-0005** | **HIGH** | ECR-0005 mandates "Supavisor transaction pooler, **never port 5432**". Admin deliberately uses the **session pooler `:5432`**. Needs an **ECR-0005 amendment / recorded exception** (session pooler is required when a long-lived module-level client can't safely share a transaction-pooler connection). |
| **D2** | **Vercel scope ambiguity (PLOS personal-vs-team)** | **HIGH** | Admin is provably **team `team_1CSTFxqvnOe9lvHtCsPHSeax`** (`.vercel/repo.json`). PLOS's **deploy.yml targets the same team**, but two docs — incl. the live `FAP-platform-hardening-v6.md` the founder acts from — name the **personal `bkasanwiredjos-projects`** scope. Risk: founder sets `DATABASE_URL` on the wrong (personal) project; the team project stays broken. |
| **D1b** | **PLOS rewrite doesn't cover the direct host** | **MED-HIGH** | `toTransactionPoolerUrl()` only rewrites `*.pooler.supabase.com:5432→:6543`. A **direct** `db.<ref>.supabase.co:5432` URL is left unpooled → connection exhaustion → 503. The protection engages only if the prod URL is already the *pooler* host. **Confirm prod `DATABASE_URL` is the `:6543` pooler host.** |
| **D3** | **Supabase ref + Vercel project id unrecorded** | **MED** | Admin ref `clfocpodfbtgzivnivck` is hardcoded in `src/env.ts` only; **PLOS's prod Supabase ref and Vercel project id are nowhere on disk** (Vercel/GitHub-secret only). No single registry holds them. |
| **D10** | **Admin 5-min cron vs Vercel plan** | **MED** | Admin `vercel.json` runs `/v1/heartbeat` every 5 min. Vercel **Hobby runs crons daily-only**; a `*/5` schedule needs **Pro**. PLOS deliberately uses daily crons to stay Hobby-safe. **Confirm Admin's plan** — if Hobby, the heartbeat is not firing every 5 min. |
| **D5** | **Node version mismatch** | **MED** | Admin pinned **`24.x`** (`.vercel/project.json`); PLOS pinned **`22.x`** (deploy guards against a Node-24 build failure). Framework template prescribes `22.x`. Inconsistent runtime baseline. |
| **D11** | **Two deploy mechanisms on one plane** | **MED** | Admin = Vercel **native Git integration** (no `deploy.yml`); PLOS = **GitHub Actions** `deploy.yml` (CLI prebuilt). Neither fully adopts the framework's `templates/workflows/` (`dev-preview` + `promote-to-prod`). |
| **D6** | **Production-capable secrets in working-tree `.env`** | **MED** | Both repos' local `.env` (gitignored, not committed) carry **live** `VERCEL_TOKEN` + provider keys (PLOS: Anthropic, SerpAPI, Apollo, NeverBounce, Google OAuth secret, `MAILBOX_TOKEN_ENC_KEY`; Admin: `AUTH_JWT_SECRET`, `RUMAH_APP_DB_PASSWORD`, `PLOS_OPS_TOKEN`, `FOUNDER_ADMIN_TOKEN`). ECR-0005 §C says "platform secret stores, never in code." |
| **D4** | **Admin duplicate/unused connection string** | **LOW** | `DATABASE_URL_POOLER` (`:6543`) is carried in prod `.env` but **only for the hang repro** — easy to mistake for the live config. Label it explicitly or remove. |
| **D7** | **Supabase ref typo in docs** | **LOW** | Canonical `clfocpodfbtgzivnivck` (code) vs typo `clfocpodfbtgzivck` in `docs/migration/*`, a test. |
| **D8 / D8b** | **Migration applied-state not recorded; PLOS journal stale** | **LOW** | Neither repo commits an applied-vs-repo ledger (prior 2026-06-25 missing-migration incident class). PLOS `meta/_journal.json` lists only 0000-0003 while repo is at 0035 (harmless — raw `.sql` apply, not Drizzle journal). |

---

## 4. Recommended clean target architecture

**Principle: the registry records reality (incl. deliberate divergence), and reconciles only the
true drift.** Where two apps differ for a *proven workload reason* (the pooler), the target is to
**document the divergence + rationale**, not force uniformity.

1. **Vercel scope — single canonical: team `team_1CSTFxqvnOe9lvHtCsPHSeax` ("Ruma Housing").**
   Both prod apps live here (Admin confirmed; PLOS deploy targets it). **Retire the personal
   `bkasanwiredjos-projects` scope** from all expectations and **correct the two PLOS docs**
   (`PLAN-admin-website-migration.md`, `FAP-platform-hardening-v6.md`). One scope, recorded in the registry.

2. **Supabase — one project per app (ECR-0004/0005), refs recorded in the registry.**
   Admin = `clfocpodfbtgzivnivck` (canonical; fix the doc typo). PLOS = **capture its prod ref** into the
   registry (currently only in Vercel). Keep EU region; keep "one project per bounded context."

3. **Pooler — record per-app as a ratified divergence, do NOT unify.**
   - PLOS (serverless, small per-instance pools) → **transaction pooler `:6543`** (matches ECR-0005 + framework doctrine).
   - Admin (long-lived module-level `postgres.js` singleton) → **session pooler `:5432`** — **amend ECR-0005**
     to allow this exception, with the 2026-06-13 incident as the rationale.
   - **Harden PLOS** `toTransactionPoolerUrl()` to also handle (or fail-closed reject) a **direct** host, so a
     mis-set prod URL can't silently run unpooled. Add a startup assertion that prod `DATABASE_URL` is a pooler host.

4. **Env contract — single `DATABASE_URL` var** (already the convention; no `DIRECT_URL`). In Admin, **drop or
   clearly label `DATABASE_URL_POOLER` as repro-only.** Consider giving Admin a Zod boundary like PLOS's
   `packages/config/src/env.ts` so the contract is validated, not just read.

5. **Secrets — out of working trees into the platform store.** Move `VERCEL_TOKEN` + all provider keys to
   Vercel/GitHub secret stores; **rotate** anything that has sat in a working-tree `.env`. PLOS keyless-DWD
   (no key) is the model to extend.

6. **Node — standardize on `22.x`** (framework default + the version PLOS pins to dodge the Node-24 failure).
   Align Admin's Vercel project from `24.x` → `22.x` after a smoke test.

7. **Deploy lane — adopt the framework `templates/workflows/`** (`dev-preview` → `promote-to-prod`) on both
   apps, or at minimum **record both mechanisms** (Admin native Git vs PLOS Actions) in the registry as the
   known state with a convergence plan.

8. **Crons — confirm Admin's Vercel plan.** A 5-min heartbeat requires Pro; if Admin is on Hobby, either
   upgrade or move the tick to an external scheduler. Record plan + cron cadence per app in the registry.

9. **Migration state — record latest-applied per environment** (close the 2026-06-25 incident class). Fix
   PLOS's stale `meta/_journal.json` or document that raw-`.sql` apply is the source of truth.

10. **Registry home — create `ecosystem-architecture/12-infrastructure-registry.md`**, operationalizing
    ECR-0005: per-app rows of *Supabase project ref · Vercel project id + scope · region · pooler mode +
    rationale · Node version · cron cadence + plan · deploy mechanism · env-key NAMES · external integrations
    · owner · drift-flag*. Extend `templates/shared-system-entry.md`. ECR-0005 stays the **rationale**; the new
    registry holds the **facts**. This audit is its seed data.

---

## 5. Top findings to report (TL;DR)

1. **Pooler inversion (D1/D9):** Admin=session `:5432`, PLOS=transaction `:6543` — opposite fixes for the
   same 503 symptom; Admin contradicts both ECR-0005 and the framework doctrine. **Deliberate; record, don't unify.**
2. **Vercel scope ambiguity (D2):** apps run on **team `team_1CST…`**, but the live PLOS founder docs still
   say **personal `bkasanwiredjos-projects`** — a real "edit the wrong project" hazard.
3. **PLOS direct-host rewrite gap (D1b):** the pooler rewrite skips a direct `db.<ref>…:5432` URL → unpooled →
   503; confirm prod uses the `:6543` pooler host.
4. **No concrete infra facts are recorded anywhere (D3):** PLOS's Supabase ref + both Vercel project ids live
   only in Vercel/GitHub secrets. The registry must capture them.
5. **Admin 5-min cron vs plan (D10):** confirm Pro, or the heartbeat isn't firing as scheduled.
6. **Clean target:** one team Vercel scope · one Supabase project per app (refs recorded) · per-app pooler
   recorded with rationale (amend ECR-0005 for Admin's session-pooler exception) · single `DATABASE_URL` ·
   secrets in platform stores · Node `22.x` everywhere · framework deploy templates · a new
   `12-infrastructure-registry.md` as the system of record.
