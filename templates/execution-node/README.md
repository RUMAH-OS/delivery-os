# Execution Node — platform capability layer

> The **Execution Layer is a Delivery OS capability, not a machine's.** This directory is the
> *definition* of how any host becomes a Delivery OS **Execution Node**. A node **consumes** these
> capabilities; it never owns them. The platform ships **parameterized scripts + templates only** — no
> machine paths, no hostnames, no project names (clean-room / Governance §14). Each host **renders**
> the templates locally and keeps its own secrets and instance state.

## The split (definition vs instantiation)

| Owned by the **platform** (here) | Owned by the **node** (local, never committed here) |
|---|---|
| node contract, bootstrap scripts, service templates, verify script | registration tokens, auth-keys, materialized creds |
| the *recipe* to install/register/run | the dedicated OS user, loaded services, running processes |
| version + interface | which capabilities are activated here + health |

**Acid test (defines "node is replaceable"):** a fresh host must become an Execution Node from
*this layer + a handful of operator-supplied secrets/grants alone*, with nothing copied from any
existing node.

## Contents

| File | Capability | Operator action needed |
|---|---|---|
| `node-contract.json` | what a valid Execution Node must provide | — |
| `provision-runner.sh` | self-hosted GitHub Actions runner (hardened, ephemeral) | a runner **registration token** (security grant) |
| `provision-heartbeat.sh` | always-on heartbeat/runtime host (launchd) | — (uses an endpoint + secret you pass) |
| `provision-tailscale.sh` | mesh networking bootstrap | `tailscale up` auth (founder authorizes the device) |
| `launchd/*.plist.template` | macOS service templates (placeholders) | — |
| `verify-node.sh` | assert the host satisfies `node-contract.json` | — |

The human runbook that sequences these is `templates/runbooks/EXECUTION-NODE-BOOTSTRAP.md`.

## Conventions
- All scripts: `set -euo pipefail`, idempotent, **fail-closed**, secrets only via env/flags (never args
  that land in shell history or files).
- Parameterized — **no defaults that name a project, repo, host, or path.** Required inputs are explicit.
- macOS arm64 first (the current node class); written so a Linux variant can be added without changing
  the contract.
- The runner is **one capability** of a node, not the reason a node exists.
