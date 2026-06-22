# engine-demo-app — install Delivery OS into a fresh app (the worked N=2 reference)

This is a **genuinely separate, minimal app** that proves Delivery OS's Workflow Engine is a **reusable
installable platform** — not Admin-specific. It **installs the engine via `os-inherit`** (the exact mechanism
Admin uses), applies the **engine-owned DDL** into its **own throwaway DB**, supplies its **own ports**,
registers **one trivial `CapabilityPack`** via `createCapabilityRuntime` (the same contract Admin uses), and
runs **one workflow GREEN**.

> It imports **NOTHING** from `rumah-admin` and requires **ZERO** engine code changes. Admin = N=1, this = N=2.

## The 5 steps to install Delivery OS into an app

### 1. Vendor the engine (`os-inherit sync`)
The engine is **OS-OWNED** and **vendored byte-identical** into your app under `.claude/os/engine/`. From the
app dir:
```
node ../../templates/tools/os-inherit.mjs sync --from ../.. --into .
# (after the first sync, the tool is vendored too:)
npm run engine:install     # === node .claude/os/tools/os-inherit.mjs sync --from ../.. --into .
```
This writes `.claude/os/engine/**` + `.claude/os/INHERITED-engine.json` (the sha-pinned record). Your app
imports the engine **only** from the vendored barrel `.claude/os/engine/index.js`.

The fail-closed **drift lock** ("engine is OS-owned, only installed here"):
```
npm run engine:drift:check   # os-inherit engine-check — byte-identical canonical <-> installed
```

### 2. Apply the engine DDL into your OWN DB plane
The engine ships its migrations under `.claude/os/engine/migrations/`. Your app applies an equivalent instance
into its own plane. This demo applies them **verbatim** (`migrations/0001_engine_core.sql` +
`0002_engine_await_loop.sql`, byte-identical copies) plus an app-owned `0000_app_role.sql` (the least-privilege
role the engine RLS policies grant — substitute your own role name in a real app).
```
npm run db:up        # throwaway Postgres on :55433 / db engine_demo (NEVER prod)
# migration is applied automatically by `npm run demo` (scripts/migrate.ts)
npm run ddl:parity   # proves the applied engine DDL == canonical engine DDL
```

### 3. Supply your ports (your app owns its plane)
- `src/engine-app/tables.ts` — your Drizzle table objects for `EngineContext.tables`
  (`workflowRun` / `workflowStep` / `outbox` + `workflowApprovalAudit`), matching the engine DDL.
- `src/engine-app/db.ts` — your Drizzle client = `EngineContext.db`.
- `src/engine-app/ports.ts` — your `HumanPrincipalPort` impl + your `auth` `ScopeGuard` (maps your auth onto
  the engine's `WORKFLOW_SCOPES`). The demo uses a stub principal (sufficient for the demo).

### 4. Declare ONE CapabilityPack + bootstrap with `createCapabilityRuntime`
- `src/demo-pack/demo-ping.ts` — your capability content as a `CapabilityPack`
  (`definitions` / `verifiers` / `handlers`).
- `src/engine-app/runtime.ts` — the **single** bootstrap:
  `createCapabilityRuntime({ context, humanPrincipal, auth, packs })`. Returns
  `{ enqueue, tick, workflowRoute, approvalsRoute, enqueueKeys }`. The enqueue allow-list is **derived** from
  the registered pack definitions — you hand-maintain nothing.

### 5. Run a workflow
```
npm run demo   # migrate -> enqueue -> tick(s) -> print evidence -> ASSERT completed + verdict pass
```

## Full commands (from this directory)
```
npm install
npm run engine:install        # vendor the engine (os-inherit sync)
npm run engine:drift:check    # the engine drift lock (byte-identical to canonical)
npm run typecheck             # tsc --noEmit (app + vendored engine)
npm run db:up                 # throwaway Postgres :55433
npm run demo                  # THE PROOF — runs the workflow GREEN
npm run db:down               # destroy the throwaway DB
```

## The demo workflow (`demo-ping`)
Two steps, the minimum that exercises register -> enqueue -> step -> verify -> complete:
- **seq 0 `demo.say-hello`** (emit-only) — emits a `demo.ping` event + records `{ pinged: true, nonce }`.
- **seq 1 `engine.verify`** (T1 verifier `demo.ping-verifier`) — reads seq-0's checkpoint, returns `pass`; the
  engine stores the verdict, evaluates `stopCondition: verdict-equals pass`, the loop stops, the run completes.

## Independence
This app imports **only** its own `src/**` + the vendored `.claude/os/engine/**`. Prove it:
```
grep -rn "rumah-admin" src run-demo.ts scripts   # -> no matches
```

## Known rough edges (honest flags)
1. **Per-app table-definition boilerplate** — `src/engine-app/tables.ts` re-types the engine tables (Admin has
   the identical block). The engine ships the DDL but not a drizzle schema. *Future polish: the engine ships
   its drizzle table objects so apps import typed tables and own only DDL application + instance rows.*
2. **`engine-check`'s ddlParity is single-tenant** — it reads the app migration **paths** from the shared
   canonical manifest, which hardcodes the reference installer's (Admin's) paths. The **file-hash drift lock**
   (the real "engine is OS-owned" guarantee) is fully multi-tenant and passes here; only the DDL-parity portion
   needs per-app paths. This app uses `npm run ddl:parity` (byte-identity vs the vendored canonical DDL) as the
   equivalent. *Future polish: make the manifest's `appMigrations` per-app (a project-local override).*
