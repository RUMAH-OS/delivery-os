# `config-templates/` — parameterized config for the Execution-Infra subsystem (Neo = Execution Node 1)

> **What this is.** The parameterized **configuration templates** the Founder Installation Guide and the bootstrap
> scripts render and install onto Neo. Every file is a **template** (`{{PLACEHOLDER}}`) — it contains **NO secret
> values, NO tokens, NO keys, NO real IPs**. Secrets live only in the System keychain (seeded once by the founder)
> and the platform stores; this folder records **metadata and shape**, never a value.
>
> **It installs nothing.** These are inert templates. They are rendered (`{{...}}` → resolved values) and applied
> by the bootstrap scripts (`infrastructure/execution-node/bootstrap/*.sh`, designed separately) and the
> `docs/architecture/neo/FOUNDER-INSTALLATION-GUIDE.md`. Design sources: NEO-EXEC-07 §4/§5,
> NTS-DOS-v1 §D, NEO-HBM-v1 §4, NEO-OPS-06 §3.

## The template set

> **Layout (canonical).** Organized into the subfolders the bootstrap scripts + the design inventory
> (NEO-EXEC-07-INV §B) reference — `supervision/ tailscale/ config/ colima/ runner/ watchdog/ logging/` —
> with the `.template` basenames the scripts resolve (`render_template`/`require_template`, fail-closed if a
> required one is missing). `_lib.sh` sets `TEMPLATE_DIR=…/config-templates`.

| File | Kind | Installs via / consumed by | Inventory |
|---|---|---|---|
| `supervision/com.deliveryos.worker.plist.template` | launchd LaunchDaemon (XML) | `install-daemons.sh` → `launchctl bootstrap` | B1 |
| `supervision/com.deliveryos.supervisor.plist.template` | launchd LaunchDaemon (XML) | `install-daemons.sh` → `launchctl bootstrap` | B2 |
| `runner/actions.runner.plist.template` | launchd LaunchDaemon (XML, reference) | `register-runner.sh` → `svc.sh install` | B3 |
| `colima/com.colima.plist.template` | launchd service (XML, reference) | `install-daemons.sh` confirms autostart | (B8-adjacent) |
| `tailscale/acl.hujson.template` | Tailscale policy-as-code (HuJSON + tests[]) | `join-tailnet.sh` renders; founder pastes into admin console | B4 |
| `watchdog/healthchecks.config.template` | dead-man check config (JSONC) | `install-daemons.sh` writes period/grace; founder creates check | B5 |
| `watchdog/windows-pull-task.xml.template` | Windows Scheduled Task (XML) | founder imports on windows-node1 | B6 |
| `runner/runner.config.template` | GH runner registration shape (JSONC) | `register-runner.sh` → `config.sh` | B7 |
| `colima/colima-profile.yaml.template` | colima VM profile (YAML) | `colima start` / `install-daemons.sh` | B8 |
| `config/secret-registry.neo.template` | i-config metadata-only manifest (JSON) | `bootstrap-secrets.sh` + `verify-health.sh` (config-doctor) | B9 |
| `config/env.neo.template` | daemon env-var NAMES only | `verify-health.sh` (config-doctor --enforce) | B10 |
| `logging/newsyslog.deliveryos.conf.template` | macOS log rotation | `install-daemons.sh` → `/etc/newsyslog.d/` | (§4 log rotate) |

## The placeholder inventory (what the founder fills — maps 1:1 to FOUNDER-INSTALLATION-GUIDE §0)

| Placeholder | Example | Used in |
|---|---|---|
| `{{NODE_ID}}` | `neo-node2` | worker/supervisor plists, healthchecks, secret-registry, .env.shape |
| `{{RUNNER_USER}}` | `ci-runner` | all plists, runner.config, newsyslog |
| `{{NODE_BIN}}` | `/opt/homebrew/bin/node` | worker/supervisor plists |
| `{{WORKER_ENTRY}}` | `.../bootstrap/worker-entry.mjs` | worker plist, .env.shape |
| `{{RUNTIME_TICK_ENTRY}}` | `.../bootstrap/runtime-tick.mjs` | worker plist, .env.shape |
| `{{SUPERVISOR_ENTRY}}` | `.../bootstrap/supervisor-entry.mjs` | supervisor plist |
| `{{WORKING_DIR}}` | `/Users/ci-runner/delivery-os` | worker/supervisor plists |
| `{{TICK_INTERVAL_MS}}` | `20000` (NOT 5000) | worker plist, .env.shape |
| `{{TAILNET_BIND_ADDR}}` | the `tailscale0` addr (NEVER `0.0.0.0`) | worker/supervisor plists, .env.shape |
| `{{HEALTH_PORT}}` | `8787` | supervisor plist, tailscale-acl, windows-watchdog, .env.shape |
| `{{DISPATCH_PORT}}` | `9443` | tailscale-acl |
| `{{HC_PERIOD_SECONDS}}` | `60` | supervisor plist, healthchecks, .env.shape |
| `{{HC_GRACE_SECONDS}}` | `300`–`600` | healthchecks |
| `{{LOG_DIR}}` | `/Users/ci-runner/Library/Logs/delivery-os` | all plists, newsyslog |
| `{{FOUNDER_EMAIL}}` | the founder's tailnet identity | tailscale-acl, windows-watchdog |
| `{{OWNER}}` / `{{REPO}}` | `RUMAH-OS` / `delivery-os` | actions.runner plist, runner.config |
| `{{RUNNER_NAME}}` | `neo` | actions.runner plist |
| `{{RUNNER_LABEL}}` | `neo` | runner.config |
| `{{RUNNER_HOME}}` | `/Users/ci-runner/actions-runner` | actions.runner plist |
| `{{COLIMA_BIN}}` | `/opt/homebrew/bin/colima` | com.colima plist |
| `{{COLIMA_PROFILE}}` | `default` | com.colima plist |
| `{{COLIMA_CPU}}` / `{{COLIMA_MEMORY_GB}}` / `{{COLIMA_DISK_GB}}` | `4` / `8` / `60` | colima.yaml |
| `{{VERCEL_ORG_ID}}` | the deploy team scope id | secret-registry |
| `{{NEO_MAGICDNS}}` | `neo` | windows-watchdog |
| `{{POLL_INTERVAL_MIN}}` | `5` | windows-watchdog |
| `{{WATCHDOG_SCRIPT}}` | the pull-probe script path | windows-watchdog |

## What is deliberately NOT here

- **No secret values, tokens, keys, or real IPs.** Secrets are seeded into the System keychain (`bootstrap-secrets.sh`);
  `secret-registry.template.json` records only metadata; `.env.shape` records only names. The HC ping URL, the GH
  registration token, `DATABASE_URL`, `VERCEL_TOKEN`, and the break-glass material are all keychain/store-resident.
- **No adapter code or scripts.** The contracts' implementation lives in `../adapters/`; the install scripts live in
  `../bootstrap/` (designed separately). This folder is config templates only.
