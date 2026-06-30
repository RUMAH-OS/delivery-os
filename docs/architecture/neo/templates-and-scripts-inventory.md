---
artifact: NEO EXECUTION-INFRASTRUCTURE — TEMPLATES + SCRIPTS INVENTORY (the build manifest)
id: NEO-EXEC-07-INV
date: 2026-06-30
status: DESIGN MANIFEST — INSTALLS NOTHING. The at-a-glance inventory of every configuration template and install
  script DESIGNED in 07-execution-infrastructure-complete.md. No file here is created on disk by this document; it
  is the build list a future builder materializes under `infrastructure/execution-node/`.
companion_of: docs/architecture/neo/07-execution-infrastructure-complete.md (NEO-EXEC-07 — the full design)
---

# Neo Execution-Infrastructure — Templates + Scripts Inventory

> The single-screen build manifest for the **Adapter subsystem** `infrastructure/execution-node/`. Every artifact
> is a **parameterized template** (`{{placeholders}}`, **no secret values**) or an **idempotent script design**.
> Companion to NEO-EXEC-07; this file adds no new design, it *lists* what 07 specifies so a builder can scaffold
> the folder in one pass. **Nothing here is installed or run.**

## A. Where it all lives (the Adapter folder — NOT under `templates/`)

`infrastructure/execution-node/` — top-level subsystem, outer Adapter ring, consumes Core contracts only
(ADR-EXEC-1). The two **contracts** it consumes are **Core-side** (not in this folder): `ExecutionProviderPort` +
the Health-Emission Contract in `templates/governance-engine/ports.ts`, the canonical health shape in
`templates/tools/platform-health.mjs`, re-exported via `contracts/execution-provider-port-v1.d.mts`.

## B. Configuration templates (parameterized; zero secret values)

| # | Template file | Purpose | Key `{{placeholders}}` |
|---|---|---|---|
| B1 | `supervision/com.deliveryos.worker.plist.template` | launchd `LaunchDaemon` for the worker daemon (engine-tick · reconciler · GS slot) | `RUNNER_USER` · `NODE_BIN` · `WORKER_ENTRY` · `NODE_ID` · `TICK_INTERVAL_MS` · `TAILNET_BIND_ADDR` · `LOG_DIR` |
| B2 | `supervision/com.deliveryos.supervisor.plist.template` | launchd daemon for the health bridge (Healthchecks pusher + `/health`+`/ready` server) | `RUNNER_USER` · `TAILNET_BIND_ADDR` · `HEALTH_PORT` · `HC_PING_URL` (keychain-ref) · `LOG_DIR` |
| B3 | `runner/actions.runner.plist.template` | the `svc.sh`-installed launchd agent for the ephemeral GH runner (reference; svc.sh generates it) | `OWNER` · `REPO` · `RUNNER_NAME` · `RUNNER_USER` |
| B4 | `tailscale/acl.hujson.template` | the default-deny policy-as-code + `tests[]` (from 02 §D); `funnel:deny` on `tag:ci-runner` | `FOUNDER_EMAIL` · `HEALTH_PORT` · `DISPATCH_PORT` |
| B5 | `watchdog/healthchecks.config.template` | the off-node dead-man check: cadence, grace, weekly all-green digest | `NODE_ID` · `HC_PERIOD_SECONDS` · `HC_GRACE_SECONDS` |
| B6 | `watchdog/windows-pull-task.xml.template` | the Windows Scheduled Task (pull `/health` + direct Supabase probe — the independent backup domain) | `NEO_MAGICDNS` · `HEALTH_PORT` · `POLL_INTERVAL_MIN` |
| B7 | `runner/runner.config.template` | ephemeral runner registration params (`--ephemeral`, labels, non-admin user) | `OWNER` · `REPO` · `RUNNER_LABEL` · `RUNNER_USER` |
| B8 | `colima/colima-profile.yaml.template` | the pinned colima VM profile (cpu/mem/disk cap, autostart, docker runtime) | `COLIMA_CPU` · `COLIMA_MEMORY_GB` · `COLIMA_DISK_GB` |
| B9 | `config/secret-registry.neo.template` | the i-config **metadata-only** secret manifest (key · store · consumer · scope) — the fail-closed gate's input | `NODE_ID` · `VERCEL_ORG_ID` |
| B10 | `config/env.neo.template` | the daemon env *shape* read from the System keychain (no values) | `NODE_ID` · `TICK_INTERVAL_MS` · `TAILNET_BIND_ADDR` · `HEALTH_PORT` |

## C. Installation scripts (idempotent; designs only)

| # | Script | Responsibility | Idempotency probe | Split |
|---|---|---|---|---|
| C1 | `bootstrap/install-prereqs.sh` | install + pin brew/node/colima/docker-CLI/gitleaks/vercel-CLI/tailscale/jq/gh | `brew list <pkg>` at pin | AUTOMATED |
| C2 | `bootstrap/join-tailnet.sh` | `tailscale up` with exec-node tags + MagicDNS; render `acl.hujson` | `tailscale status` joined+tagged | SEMI (approval + ACL apply manual) |
| C3 | `bootstrap/register-runner.sh` | download actions/runner; `config.sh --ephemeral` under `ci-runner` | `svc.sh status` registered+online | SEMI (reg token manual) |
| C4 | `bootstrap/bootstrap-secrets.sh` | prompt-seed each missing System-keychain key from the platform stores | `config-doctor --include-local` PRESENT | MANUAL (one-time founder seeding) |
| C5 | `bootstrap/install-daemons.sh` | render the plists (B1–B3) + `launchctl bootstrap` + confirm `com.colima` | `launchctl print system/<label>` loaded | AUTOMATED |
| C6 | `bootstrap/verify-health.sh` | go-live gate: `config-doctor --enforce` → `/ready` green → cold-boot test → parity-prove | always runs (read-only) | AUTOMATED + ★ founder gate |
| C7 | `bootstrap/install-all.sh` | orchestrate C1→C5 in order, pause at the manual gates, then C6 | each sub-step's probe | ORCHESTRATOR |

## D. Adapter code (implements the Core contracts — outer ring, not a template)

| # | File | Implements / consumes | Note |
|---|---|---|---|
| D1 | `adapters/neo/neo-provider.ts` | implements `ExecutionProviderPort` (§2.1) | `nodeId:neo-node2` · labels · `trustDomain:trusted` · `canAccept` + `execute` dispatch-by-kind |
| D2 | `adapters/neo/neo-runner-exec.ts` | `execute` for `verify`/`build`/`migrate` | dispatch onto the ephemeral GH runner + colima `postgres:16` |
| D3 | `adapters/neo/neo-deploy-exec.ts` | `execute` for `deploy` | token-attributed `vercel --prebuilt --prod` + pooler `supabase migrate`; binding post-deploy verify |
| D4 | `adapters/windows/windows-provider.ts` | implements `ExecutionProviderPort` | `nodeId:windows-node1` · the build/author surface |
| D5 | `health-bridge/healthchecks-pusher.ts` | consumes the Health-Emission Contract (§2.2) | `/ready`-gated POST to `{{HC_PING_URL}}` (NEO-HBM ADR-003) |
| D6 | `health-bridge/windows-pull-watchdog.*` | consumes `/health` + a direct Supabase probe | the independent off-node backup domain |
| D7 | `health-bridge/status-page/` | reads the bus + `PlatformHealthReport` | off-Neo Vercel SSR; survives Neo down |

## E. The enforcement (designed with the subsystem — makes the boundary real)

| # | Check | Asserts |
|---|---|---|
| E1 | dependency-direction gate (`residency-guard.mjs`, generalized) | no Core file imports `infrastructure/execution-node/**` or an infra SDK |
| E2 | the standing **Delete Test** (CI) | `rm -rf infrastructure/execution-node/` ⇒ Core still typechecks + contracts resolve |

## F. Build order (the reversible path — pointer to NEO-EXEC-07 §3 + NEO-ARCH-01 build order)

`M0` off-node watchdog (NEO-HBM, hard precondition) → `C1` prereqs → `C2` tailnet → `C3` runner (parity-prove
non-binding) → flip non-binding `runs-on` → `C4` secrets → `C5` daemons → `C6` verify-health + cold-boot test →
★ flip binding checks one-by-one (M3) → ★ deploy + staging (M5) → ship `ExecutionProviderPort` + register
`windows-node1`/`neo-node2` (M6). Every step reverts by clearing `vars.CI_RUNNER` or one `launchctl bootout`.

*End of inventory — a build manifest, not an install. Nothing here is created on disk or executed by this document.*
