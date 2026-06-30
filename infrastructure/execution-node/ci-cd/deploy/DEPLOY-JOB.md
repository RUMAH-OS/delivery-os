# The deploy job — token-attributed Vercel + pooler Supabase + a BINDING verify

> The deployment pipeline on the Neo substrate (NEO-ARCH-01 §B.3.3, NEO-EXEC-07 §7.3). It keeps the
> proven PLOS `deploy.yml` prebuilt flow and changes exactly three things: it runs on Neo (via the
> `vars.CI_RUNNER` kill-switch), it migrates Supabase over the pooler **before** the code ships, and
> it makes the **post-deploy health verify binding** — fixing PLOS's known soft spot.

Two forms ship:

- `deploy-job.snippet.yml` — a single `deploy:` job to drop into an existing `deploy.yml`.
- `reusable-deploy.yml` — a `workflow_call` reusable workflow; the consumer's `deploy.yml` becomes a
  thin caller. Use this when more than one repo should share one deploy definition.

## The identity property (why the Hobby author rule is satisfied with no manual click)

`vercel deploy --prebuilt --prod --token=$VERCEL_TOKEN` performs **no actor check** — the **token**
carries the deploy identity. So a deploy executed on Neo lands **attributed to the founder
(bkasanwiredjo)** without anyone pressing "Redeploy" in the Vercel UI (resolves the
`plos-vercel-deploy-identity-constraint` foot-gun). The token is read only from `secrets.VERCEL_TOKEN`
and is never written to the tree or echoed.

## The binding post-deploy verify (the fix)

PLOS `deploy.yml` runs its post-deploy health check with `continue-on-error: true` — a failing
health probe **does not fail the release**. On Neo this becomes **binding**: the
`Post-deploy health verification` step has **no `continue-on-error`**, so an unhealthy deploy (after
the retry/self-heal window) **fails the job and surfaces loudly**.

```diff
       - name: Post-deploy health verification
-        continue-on-error: true
         run: |
           node infra/post-deploy-verify.mjs \
             --base "${{ steps.deploy.outputs.url }}" \
-            --service property-lead-os \
+            --service "${{ inputs.service_name }}" \
             --retries 4 --retry-delay-ms 5000
```

This is safe to harden because a permanent staging rung (NEO-ARCH-01 §B.3.4) catches the HE-1…HE-6
class before prod, and the retries give the heartbeat/drain self-heal its window. An ALARM after the
retries is a real bad-release signal, not a transient blip to swallow.

## Supabase migrate over the pooler, before code

- **Session pooler (`:5432`)** for `supabase migration up`, **transaction pooler (`:6543`)** for the
  app runtime. Neo is **IPv4** — it must use the pooler, never the IPv6-only `db.<ref>.supabase.co`
  direct host.
- **Forward-only, expand/contract, applied before the code** that reads the new schema.
- The connection string is read from `secrets.SUPABASE_DB_URL` — never a literal.

## What stays a founder boundary (Class-C)

The runner **executes** an authorized deploy (a merge to `main`); it does not **authorize** one.
Merge-to-main and the deploy authorization remain founder acts; the `deployment-operator`
`.deploy-lane.json` scope still binds. Because `VERCEL_TOKEN` can deploy attacker code to prod as the
founder, it is treated **co-equally with break-glass** (NEO-ARCH-00 §6.5) — a deploy-approval /
second-factor gate before any standing self-serve prod deploy is a hard go-live precondition, carried
here, not deferred.

## Per-repo prerequisites (checked at apply-time, not assumed)

The template references three consumer-resident scripts/keys. The apply procedure (`../apply-cicd.md`)
verifies each exists before wiring the job:

| Reference | Source of truth | If absent |
|---|---|---|
| `infra/config-doctor.mjs --env production` | the consumer repo (PLOS has it) | provide it or drop the pre-build gate step for that repo |
| `infra/post-deploy-verify.mjs` | the consumer repo (PLOS has it) | provide it; the binding verify cannot be wired without a real probe |
| `secrets.SUPABASE_DB_URL` (session pooler) | GitHub Actions secret | add it; or, if the repo has no Supabase, drop the migrate step |
| `vars.DEPLOY_SERVICE_NAME` (snippet form) | GitHub repo variable | set it, or inline the service name |

> **PLOS** already has `infra/config-doctor.mjs`, `infra/post-deploy-verify.mjs`, and the three Vercel
> secrets — for it this is a near-drop-in plus the `SUPABASE_DB_URL` secret and the binding flip.
> **rumah-admin's** prod deploy path differs; confirm its deploy mechanism before applying (the apply
> procedure flags it as a per-repo check, not an assumption).
