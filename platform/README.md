# delivery-os `platform/` — the runnable OS runtime (E-PH M1)

This directory makes **`delivery-os` a runnable platform**, not just a design-time template repo. It boots the
**engine + reconciler tick loop** as a running process against a **platform-owned DB**, with **ZERO tenant
programs registered**. This is the founder-locked *platform-independence* milestone (M1): everything the OS
needs to run lives and runs here, so deleting any tenant program (`rumah-admin`, PLOS, the website) cannot break
the OS.

> Ground truth: `../_ops/PLATFORM-HOME-EXTRACTION.md` (the extraction spec + the I-PI invariant + its bare-OS
> acceptance battery). This is **M1** of the M1→M4 migration. It stands the OS up **alongside** rumah-admin —
> it does **not** delete rumah-admin's platform code (that's M3).

## What's here

| Piece | File | Role |
|---|---|---|
| Entrypoint | `src/index.ts` | Boot: migrate → construct engine (zero packs) → serve `/v1` → start tick loop |
| The flip | `src/engine-runtime.ts` | Constructs the engine with **zero tenant packs** + the **runtime registration API** (`registerCapabilityPacks`) a tenant calls to consume the OS |
| Goal spine | `src/goal-contract.ts` | **Byte-faithful vendor** of the live GoalContract (sole `transition()` door + PR-#50 event dual-write) |
| Sole mutator | `src/po-reconciler-c2.ts` | **Byte-faithful vendor** of the reconciler (the only `transition()` call site) |
| Tick driver | `src/reconciler-loop.ts`, `src/heartbeat.ts` | The C2-LOOP sweep + liveness heartbeat (idle on a bare OS) |
| HTTP surface | `src/server.ts` | `/v1/health`, `/v1/heartbeat`, `/v1/capabilities`, `POST /v1/goals` (fail-closed) |
| Engine | `src/engine/` | The vendored `templates/workflow-engine` source, **run** (not templated) |
| Migrations | `migrations/` | The OS-owned set: role bootstrap (`0000`) + engine (`0001-0005`) + outbox (`0006`) + platform spine (`0052/0053/0054/0055`, incl. PR #50) |
| Proof | `test/bare-os.test.ts`, `docs/VERIFY-platform-independence-M1.md` | The bare-OS survival battery (§2.2 steps 1–3) + the VERIFY doc |

## Bare-OS quickstart (prove it locally, like CI)

Against a **local throwaway Postgres** (never a real production DB):

```bash
# 1. a throwaway Postgres (any local PG works; Homebrew shown)
initdb -D /tmp/os-pg -U os -A trust
pg_ctl -D /tmp/os-pg -o "-p 55433" -l /tmp/os-pg.log -w start
createdb -h 127.0.0.1 -p 55433 -U os delivery_os_platform
echo 'DATABASE_URL=postgres://os@127.0.0.1:55433/delivery_os_platform' > .env

# 2. install + migrate + boot
npm install
npm run db:migrate           # applies ONLY OS migrations (11), clean + idempotent
npm run boot                 # boots bare: serves /v1, ticks, zero tenant packs

# 3. the bare-OS battery (boot + migrate + idle tick + bare goal lifecycle w/ stamped events)
DATABASE_URL=... npm test
```

`GET /v1/health` → `{"zeroTenants":true,"tenantPackCount":0}`. `POST /v1/goals` on the bare OS → `422 no-match`
(fail-closed, never a crash).

## The vendor→consume flip

Today the platform is vendored **from** `delivery-os` templates **into** each tenant (rumah-admin's
`.claude/os/engine/` + `engine-instance.ts` register tenant packs). Here the direction is flipped: the **OS hosts
the engine**; a tenant **consumes** it by registering its capabilities as **data** (`CapabilityPack`) at runtime:

```ts
os.registerCapabilityPacks([{ id: "rumah-admin.invoice", definitions: [...], handlers: [...], selectors: [...] }]);
```

The OS imports **zero** tenant code and holds **zero** tenant credentials. A capability is data registered into
the OS registry, never OS code.

## What still lives in rumah-admin (moves in M2/M3)

**M2 — move the rest of the organ set into this runtime** (from `rumah-admin/src`): the full Goal Supervisor
(C7 — here only its **type surface** is vendored, `goal-supervisor-c7.ts`), `po-autoloop-c2.ts`, C1
(`goal-intake-c1`, `founder-summon-c1`), C2-MIND (`boundary-plan-c2mind`), C6 (`completion-review-c6`), C9
(`preflight-gate-c9`, `reachability-evaluator`), C10 (`sprint-engine-c10`), `metric-probe`, `runtime-stores.ts`,
`db/break-glass.ts` + `db/guard-prod.ts`, and the full `heartbeat-api.ts` domain-sweep. The admission edges
(CREATED→FEASIBILITY→ACTIVE) become reconciler/C9-driven (M1 drives them through the sole door in the proof).

**M3 — turn rumah-admin into a consumer:** delete its `.claude/os/engine/` vendored copy + platform code; it
registers `invoice.send` + its mail adapter + its Data-DB read seam with this OS via the registration API. Then
battery steps 4–6 (register cell #1 → delete it → OS keeps running) go green.

**M4 — PLOS as cell #2 + the Control Surface CORE.**

## Infra to provision for real deployment (the M1 follow-up)

M1 proves against a local DB. Real deployment (a separate, gated step) needs:

- A **platform-owned Supabase** project (the OS's own DB — separate from any tenant's Supabase). Set its
  session-pooler `DATABASE_URL`; run `npm run db:migrate` against it (break-glass grant for the prod apply).
- Set the `rumah_app` role password out-of-band (`ALTER ROLE rumah_app WITH PASSWORD …`).
- A **Vercel/Neo runtime** target running `src/index.ts` (the `execution-node/` provisioning in
  `templates/execution-node/` defines the runtime home).
- A **DB-plane watchdog** (Supabase `pg_cron`) reading `engine_heartbeat.last_beat_at` — the dead-man switch.
- Real auth: the asymmetric-JWKS impl replacing the M1 **dev** `ScopeGuard`/`HumanPrincipalPort` in
  `engine-runtime.ts` (earned-on-proof at P6 — not pre-empted here).
- CI: the **dependency-direction lint** (fail the OS build on any import/schema-name resolving into a tenant)
  + this bare-OS smoke on every push (no tenant fixtures on the OS test path).

## Frozen invariants preserved

Sole mutator (reconciler is the only `transition()` call site) · author≠verifier (the VERIFY is the author's
evidence; an independent verifier ratifies) · per-scope tenant partition (`tenant_id`/`stream_id`, I11) · the
canonical 11-state enum + the 0053 DB-enforced legality trigger.
