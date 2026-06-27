---
goal_id: infra-config-cutover
disposition: boundary
boundary_class: deploy-auth
boundary_evidence_kind: tool_denial
boundary_evidence: "Founder-authorization-class action denied: I may not set production secrets, upgrade a paid plan, or apply production migrations without explicit founder authorization. Corroborated, re-checkably, by `node infra/config-doctor.mjs --env production` in both repos: PLOS-prod reports 8 required keys MISSING (incl. DATABASE_URL, SUPABASE_URL); rumah-admin-prod reports 4 required keys MISSING (incl. DATABASE_URL, AUTH_JWT_SECRET). Only the founder can enter these into Vercel/Supabase."
founder_burden_category: per_action_authorization
autonomous_work_done: true
verify_clean: true
verifier: "node infra/config-doctor.mjs --env production  (per repo; exits 0 when every required key is present & valid)"
supersedes: ["FAP-platform-hardening-v6 (the config/cutover asks only)"]
resume_goal: "/goal resume FAP-infra-config-cutover"
---

# Founder Action Package — Infrastructure Config Cutover (ONE pass)

> This is the SINGLE consolidated list of every production action only you can do. It **replaces all prior
> piecemeal "set this one variable" asks**. Each item is grouped by the platform you do it on, so you can
> finish each platform in one sitting. Everything here is now **machine-verifiable**: after you finish, the
> config-doctor re-checks the live Vercel/Supabase state and tells you exactly what (if anything) is still
> wrong — no more guessing, no more cryptic build crashes.

## 1. Status (one screen)
The new **Infrastructure Registry & Configuration layer** is built and proven. It DECLARES every required
config key (one `infra/config-registry.json` per repo, derived from the real code), VALIDATES the live state
against Vercel (read-only), and is wired into the deploy gates so a misconfig fails with a **clear, complete
diagnostic** instead of the old opaque `Invalid environment configuration … / Failed to collect page data`.
The one thing the layer cannot do for you is **enter the production secrets** — that is this package.

## 2. WHY I stopped (the boundary — proven, not asserted)
Setting production secrets, upgrading a paid plan, and applying production migrations are
**founder-authorization-class** actions. The boundary is re-checkable evidence, not an opinion:

```
$ node infra/config-doctor.mjs --env production   # property-lead-os
RESULT: FAIL — 8 required key(s) MISSING/INVALID.   (DATABASE_URL, SUPABASE_URL, SUPABASE_ANON_KEY,
                                                     SUPABASE_SERVICE_ROLE_KEY, SUPABASE_JWT_SECRET,
                                                     TICK_TOKEN, CRON_SECRET, ANTHROPIC_API_KEY)

$ node infra/config-doctor.mjs --env production   # rumah-admin
RESULT: FAIL — 4 required key(s) MISSING/INVALID.   (DATABASE_URL, AUTH_JWT_SECRET, CRON_SECRET,
                                                     PUBLIC_BASE_URL)
```

- **Boundary class:** `deploy-auth` · **evidence kind:** `tool_denial` (corroborated by the doctor's `gate_state`).
- The known root cause is confirmed: the PLOS prod env vars are **blank**, which is why the prod build crashes
  on `DATABASE_URL is required / SUPABASE_URL: Invalid url` and prod is stuck on an old deploy that exhausts DB
  connections and 503s on Discovery. The DATABASE_URL rule below (pooler **6543**) is both the build fix AND the
  503 cure.

---

## 3. Do this — grouped by platform (each item appears exactly ONCE)

> **⚠ CANONICAL VERCEL SCOPE — read first.** Both projects live under the **TEAM** scope
> **`team_1CSTFxqvnOe9lvHtCsPHSeax`** ("Ruma Housing") — NOT your personal `bkasanwiredjos-projects`
> scope. This is proven on disk: PLOS `deploy.yml` sets `VERCEL_ORG_ID=team_1CSTFxqvnOe9lvHtCsPHSeax`
> and rumah-admin `.vercel/repo.json` has `orgId: team_1CSTFxqvnOe9lvHtCsPHSeax` (infra inventory finding
> **D2**). Open the Vercel **team** workspace switcher → "Ruma Housing" BEFORE editing either project. If you
> set the variables on the personal-scope project, the deploy reads from the team project and the secrets
> **silently never take effect** — this is the single highest-risk step. (Supersedes the stale
> `FAP-platform-hardening-v6.md` line that named the personal scope.)

### A. Vercel — team **`team_1CSTFxqvnOe9lvHtCsPHSeax`** → project `property-lead-os` → Settings → Environment Variables → **Production**
Set each of these (the doctor prints the exact source for every one):

| Variable | Value / source | Why |
|---|---|---|
| **DATABASE_URL** *(the blocker + the 503 cure)* | Supabase → Settings → Database → Connection string → **Transaction pooler (port 6543)** URI | Required by the build; the **6543 pooler** is what stops the connection-exhaustion 503. **Not** the `:5432` direct string. |
| **SUPABASE_URL** | Supabase → Settings → API → **Project URL** (`https://<ref>.supabase.co`) | The "SUPABASE_URL: Invalid url" half of the crash. |
| **SUPABASE_ANON_KEY** | Supabase → Settings → API → **anon public** | Client-safe API key. |
| **SUPABASE_SERVICE_ROLE_KEY** | Supabase → Settings → API → **service_role** | Server-side only. |
| **SUPABASE_JWT_SECRET** | Supabase → Settings → API → **JWT Secret** | The workflow-engine surface 401s every request without it. |
| **TICK_TOKEN** | a random secret ≥16 chars (`node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`) | Authorizes the engine heartbeat; durable work never advances without it. |
| **CRON_SECRET** | a random secret ≥16 chars | The `/api/cron/*` relays (tick, dunning, drain) fail-closed without it. |
| **ANTHROPIC_API_KEY** | console.anthropic.com | The advisor / dunning-draft lanes. |
| *(optional)* **DISCOVERY_ENABLED**, **DISCOVERY_SWEEP_ENABLED**, **SERPAPI_KEY** | set `=1` + the key only when you want the autonomous Discovery sweep to run/spend | Stays inert until set. |

### B. Vercel — plan
- **Upgrade the `team_1CSTFxqvnOe9lvHtCsPHSeax` ("Ruma Housing") team to a paid (Pro) plan** (the team the `property-lead-os` project lives in). Hobby caps crons (2, once/day) — too few/slow for the heartbeat + delivery drain + Discovery sweep on a `*/5`-style schedule. This is the structural switch that makes "runs without manual intervention" true.

### C. Vercel — team **`team_1CSTFxqvnOe9lvHtCsPHSeax`** → project `rumah-admin` → Settings → Environment Variables → **Production**
| Variable | Value / source | Why |
|---|---|---|
| **DATABASE_URL** | Supabase → Settings → Database → **Transaction pooler (6543)** URI (prod ref `clfocpodfbtgzivnivck`) | Build + 503 cure; use a non-service-role principal so RLS applies. |
| **AUTH_JWT_SECRET** | Supabase → Settings → API → **JWT Secret** | Every authed admin route 401s without it. |
| **CRON_SECRET** | a random secret ≥16 chars | Authorizes the **/v1/heartbeat** cron (already scheduled every 5 min in `vercel.json`) — the scheduler/heartbeat that drives the engine. |
| **PUBLIC_BASE_URL** | the deployed prod API base (e.g. `https://rumah-admin.vercel.app`) | Used for links in outbound invoice/notification emails. |

### D. Supabase — apply production migrations
- **rumah-admin** — apply the **reliability** migrations (heartbeat/scheduler + scheduled-send + drain/dedup fixes).
- **property-lead-os** — apply migrations **0036–0039** (the PLOS reliability P0s: atomic claim-before-send, callback reconcile, drain liveness, capture idempotency).
- Apply these **in lockstep with** the corresponding deploy — do not merge the code ahead of the columns.

---

## 4. How to confirm you're done (no technical knowledge needed)
After you finish A–D, re-run the verifier in each repo (or just re-run the deploy — the gate runs it for you):

```
node infra/config-doctor.mjs --env production
```

- **Success looks like:** `RESULT: PASS — every required key for production is present and valid.` (exit 0).
- In CI the **PLOS deploy** runs this as a pre-build gate, and **rumah-admin** runs it as the `config-gate`
  workflow. A green gate means the cutover is complete; a red gate prints the exact remaining item.

## 5. The single remaining action
**Enter the production secrets above (A, C), upgrade the plan (B), and apply the migrations (D).** That is the
one founder-authorization step the whole layer now makes verifiable end-to-end. Once the doctor reports PASS in
both repos, tell me and I sequence the merges/deploys + the live walkthrough.

## 6. Rollback
Nothing to undo — this is forward provisioning. No destructive change is requested here.
