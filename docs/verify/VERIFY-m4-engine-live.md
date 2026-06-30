# VERIFY — M4: platform engine LIVE on Execution Node 1 (Neo)

- **Slice:** M4 (ADR-005) — deploy the platform Execution Engine runtime onto Neo against the
  platform-owned Engine DB, and verify the heartbeat live. Founder-authorized end-to-end provisioning.
- **Date:** 2026-06-30 · **Operator:** founder (Supabase auth + project) · builder (provisioning).

## What was provisioned (end-to-end, real)
| Step | Evidence |
|---|---|
| Dedicated platform DB created | Supabase project **`delivery-os-engine`** ref `vpmebirrlyrsynfjsicg`, org **RUMAH** (`mzmigebxhmjykrhxbmke`, the operational org — NOT a consumer project), region **eu-central-1** (closest to Neo/NL; min tick latency). No billing prompt. |
| Connection configured | `ENGINE_DATABASE_URL` written to `~/.config/deliveryos/engine.env` (0600). Direct `:5432` host is IPv6-only/unresolvable on this network → fell back to the **session-mode pooler** (`aws-1-eu-central-1.pooler.supabase.com:5432`, IPv4, persistent — correct for the always-on node). |
| Secret known to the platform | I-Config oracle declares `ENGINE_DATABASE_URL` (registry merged in PR #32). |
| Schema migrated | `provision-engine-runtime.sh --migrate-only` applied **0001–0004** (after creating the `rumah_app` role the RLS policies reference). Verified: tables `workflow_run`, `workflow_step` (29 cols), `workflow_approval_audit`, `_engine_migrations`; both legal-edge **transition-guard triggers**; **RLS enabled** on all three. |
| Runtime deployed | engine-host runtime deps installed (drizzle-orm@0.45.2, postgres@3.4.5, tsx@4.19) in the node workspace; launchd service **`com.deliveryos.engine`** rendered (absolute node22 + tsx cli — launchd has no PATH) and `launchctl load -w`. |
| Engine LIVE | log: *"Delivery OS engine host LIVE (continuous tick) — durable store is managed/off-node."* `launchctl list com.deliveryos.engine` → **PID 16533, LastExitStatus 0**. KeepAlive + RunAtLoad → survives logout/reboot. |
| DB I/O proven | a probe `workflow_run` insert/delete succeeded against the live DB (`INSERT 0 1` / `DELETE 1`); the engine stayed LIVE with no tick errors. |
| Node contract | `verify-node.sh --require heartbeat` → **NODE OK** (workstation ✅ · localCI ✅ · **heartbeat ✅**). |

## Bug found & fixed at deploy (platform artifact)
The host imported `createEngine` from the engine **barrel** (`index.js`), which re-exports the HTTP route
factories (`goals/workflow/approvals-route`) that need **`hono`** → `MODULE_NOT_FOUND` at boot. Fixed: the
host imports the runner directly from `engine.js` (the tick daemon serves no HTTP; the goal-API is a separate
Sprint-5.3/control-surface capability). Also reconciled the launchd template + provisioner to launchd reality
(absolute node+tsx; node installs the host deps; `node_modules` gitignored — delivery-os stays
dependency-free).

## Compute/state boundary (ADR-005 replaceability — upheld)
Compute (the continuous tick) runs on Neo; **durable state is the managed off-node Supabase project**, not
node-local and not a consumer DB. Neo can be replaced without losing run/step state.

## Honest scope
- **Heartbeat = the engine tick loop live + connected + ticking.** Verified.
- Advancing a *domain* run requires a registered definition pack (`ENGINE_PACKS`) — that is consumer/
  Sprint-5.3 work, intentionally out of scope here (a bare engine cannot plan an unknown definition; the
  probe correctly stayed `queued`).
- **M3 cutover** (retire rumah-admin's tick, re-point consumers) is a separate production step, not done here.

## Node status after M4
**3/5 node-contract capabilities active & verified:** workstation · localCI · **heartbeat**. Remaining:
**runner** (now optional — localCI + the node daemon already solved the exhausted-minutes problem; needs a
founder token if still wanted) and **mesh** (`sudo tailscale up`, founder interactive auth).
