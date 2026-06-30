---
artifact: MASTER ARCHITECTURE — The Delivery OS Execution Layer (the founder-facing approval artifact)
id: NEO-ARCH-00
date: 2026-06-29
status: DESIGN — CONSOLIDATED + HOST-DECIDED (the founder design gate is RESOLVED on the host axis). Installs nothing, changes no infra, registers no runner, moves no secret, joins no node, applies no ACL. This document SYNTHESIZES five design streams (01–04) + the adversarial challenge (05) + the first-pass blueprint (EIB) into one decision artifact, now OPTIMIZED AROUND the founder decision **ADR HOST-1: Execution Node 1 = Neo (Apple Silicon MacBook), approved 2026-06-30.** The adversarial challenge's TECHNICAL findings are ACCEPTED and incorporated as Neo-specific risks + mitigations; its host-RESEAT recommendation is SUPERSEDED by ADR HOST-1. The Neo-specific operations + migration detail lives in `06-neo-node1-operations-and-migration.md`.
consolidates:
  - docs/architecture/neo/01-execution-node-and-cicd.md        (NEO-ARCH-01 — the node + CI/CD design)
  - docs/architecture/neo/02-tailscale-and-security.md         (NTS-DOS-v1 — the tailnet + the complete security model)
  - docs/architecture/neo/03-heartbeat-and-monitoring.md       (NEO-HBM-v1 — heartbeat, watchdog, monitoring, alerting)
  - docs/architecture/neo/04-future-execution-layer.md         (FEL-DOS-v1 — multi-node, failover, DR, offline, fleet roadmap)
  - docs/architecture/neo/05-adversarial-challenge.md          (NEO-ADV-05 — technical findings ACCEPTED + 5 conditions; its host-reseat SUPERSEDED by ADR HOST-1)
  - docs/reviews/EXECUTION-INFRASTRUCTURE-BLUEPRINT-2026-06-29.md (EIB-DOS-v1 — the first pass: drain post-mortem, the port, M0–M7)
optimized_around:
  - ADR HOST-1 (founder-decided 2026-06-30) — Execution Node 1 = Neo (Apple Silicon MacBook); a reversible host-agnostic deployment choice
related:
  - docs/architecture/neo/06-neo-node1-operations-and-migration.md (NEO-OPS-06 — Neo limitations + mitigations, the FileVault/reboot resolution, the objective migration triggers, the host-swap runbook)
forcing_function: GitHub-hosted Actions minutes EXHAUSTED (2870/3000 → 0). A metered third-party execution provider cannot be the spine of a system whose entire ambition is continuous, unattended, portfolio-scale execution.
audience: the founder (the decision), a future builder (the spec), the §11 panel that gates the build.
load_bearing_decision: §1 — THE HOST DECISION, now RESOLVED. ADR HOST-1 (founder-decided 2026-06-30): Execution Node 1 = Neo (Apple Silicon MacBook). The architecture SHAPE is sound and host-agnostic; the host is therefore a REVERSIBLE deployment choice. The challenge's technical findings (FileVault/reboot, colima overhead, laptop-specific risks) are ACCEPTED and incorporated as Neo risks + mitigations; its host-RESEAT recommendation is SUPERSEDED. Migration of Node 1 to Linux/cloud is a future OPERATIONAL step gated by the objective triggers in `06`, executable via node-registration (the `ExecutionProviderPort`), not redesign.
---

# Master Architecture — The Delivery OS Execution Layer

> **One-paragraph thesis.** GitHub stays the *system of record and the event/gate plane* — PRs, the required-check
> API, branch protection, CODEOWNERS. A self-hosted **Execution Node 1** provides the *compute*: an ephemeral
> GitHub Actions runner for PR-triggered required checks, a supervisor **worker daemon** that owns its own clock and
> drains the durable Postgres bus (killing the cron drain that exhausted the meter), and a deploy executor holding
> the founder's Vercel token. The Windows PC stays the interactive build host; build on Windows, **verify on the
> execution node** — author≠verifier becomes *physical* (neutral hardware, D9) for the first time. Every move is
> reversible by one `runs-on` line or one daemon-unload. An **off-node watchdog on an independent failure domain**
> is a hard precondition, not a nicety. **The architecture above the node is sound and host-agnostic — and because
> it is host-agnostic, the choice of host is a REVERSIBLE deployment decision, not an architectural one.** The host
> question is now **RESOLVED by the founder: Execution Node 1 = Neo (Apple Silicon MacBook), approved 2026-06-30
> (ADR HOST-1, §1.3).** The adversarial challenge's technical findings are ACCEPTED and incorporated below as
> Neo-specific risks each paired with a concrete mitigation; its recommendation to *re-seat the host to Linux now*
> is SUPERSEDED. Replacing Neo later (Linux mini-PC / cloud VM) is **node-registration gated by objective triggers,
> not a redesign** — the operations + migration spec is `06-neo-node1-operations-and-migration.md`.

---

## 1. Executive summary + THE HOST DECISION (RESOLVED — ADR HOST-1: Execution Node 1 = Neo)

### 1.1 What is being proposed, in one screen

The GitHub-hosted Actions allotment was burned to zero — and the post-mortem (EIB §2) shows **the drain was a
cron, not the CI**: `dead-man-switch.yml` at `*/5 * * * *` is ~8,640 billed minutes/month by itself, **2.9× the
entire budget before any PR runs.** That is the empirical proof of the V-H finding: *a serverless/cron substrate
cannot host continuous supervision.* The fix is two moves: (a) move the scheduled supervision tiers onto a
long-running **worker daemon that owns its clock** on owned hardware; (b) move PR-triggered required checks onto a
**self-hosted GitHub Actions runner**. GitHub keeps the event + gate plane; we stop renting its CPU.

This is delivered behind an **`ExecutionProviderPort`** (§2.5, §7) — the buildable form of RS-DOS §46 I-Placement.
The Project Owner describes *what* work needs doing and its *requirements*; it **never names a machine.** A
constraint-first selector picks a node; the node's adapter runs the job; evidence returns on the durable bus.
**Adding/swapping/removing a node is a registration, never a re-architecture.**

### 1.2 The shape is sound and HOST-AGNOSTIC

The adversarial challenge (NEO-ADV-05) attacked all five streams refute-first and **conceded that the architecture
above the node genuinely survives**: durable-bus-as-system-of-record with no node-resident essential state; the
`ExecutionProviderPort` + constraint-first, fail-closed placement; cattle-not-pets DR; the off-node dead-man
*concept* and the failure-domain-independence *rule*; the no-public-ingress Tailscale model; the reversible
`runs-on` lever; and the honest surfacing of the HMAC break-glass gap. **None of those need to change.**

Crucially, the `ExecutionProviderPort` makes **Execution Node 1 swappable with zero Project-Owner change.** A node
is an adapter that publishes `nodeId` / `labels` / `trustDomain` and implements `canAccept` + `execute`. Whether
Node 1 is a MacBook, a Linux mini-PC, or a cloud VM is a *registry entry*, not an architectural fork. **The host
decision (ADR HOST-1: Neo) therefore costs nothing architecturally and is reversible** — it chooses which adapter
ships first, not the design; the eventual swap to Linux/cloud is a registration governed by the triggers in `06`.

### 1.3 ADR HOST-1 (FOUNDER-DECIDED): Execution Node 1 = Neo (Apple Silicon MacBook), approved 2026-06-30

**Decision.** Execution Node 1 = **Neo (Apple Silicon MacBook).** This is a firm founder decision.

**Rationale.** Current stage, available hardware, operational cost, and implementation velocity — a **reversible,
host-agnostic deployment choice, NOT an architectural one.** Neo is the right Node 1 *now*: it is owned and on hand
(zero procurement, zero lead time), it costs ~$0 marginal, and it lets the build start today behind the
`ExecutionProviderPort` rather than blocking on hardware acquisition to maximize theoretical server characteristics
the current stage does not need.

**On the challenge.** The adversarial challenge's **TECHNICAL findings are ACCEPTED** and incorporated below as
Neo-specific risks, each paired with a concrete Neo mitigation (§1.4, §9, and in full in `06`):
- the **FileVault / login-keychain unattended-reboot** behavior (accepted — resolved in `06` §3, summarized §1.4 /
  §9.3 / HOST-3);
- the **colima / macOS-Docker overhead + macOS-update breakage** (accepted — pinned + autostarted, `06` §2);
- the **sleep/wake, App Nap, thermal, lid-closed** laptop-specific risks (accepted — `caffeinate`/`pmset`/App-Nap
  exclusion, `06` §2);
- the **single-machine SPOF + laptop-is-the-founder's-daily-driver contention + consumer SSD/battery wear**
  (accepted — `06` §2 + the migration triggers);
- the **Ed25519 break-glass + co-equal deploy-token** findings (accepted — go-live preconditions, §6.4/§6.5, `06` §5);
- the **migration-path documentation** demand (accepted — `06` is that documentation).

What is **SUPERSEDED** is the challenge's *host-RESEAT* recommendation ("re-seat Node 1 as Linux *now*, demote Neo").
The Delivery OS architecture is intentionally **host-agnostic via the `ExecutionProviderPort`** (§1.2, §2.5, §7):
Node 1 is an adapter that publishes `nodeId`/`labels`/`trustDomain`, so the host is a registry entry, not a design
commitment. The challenge correctly proved *a laptop has laptop-specific costs* — it did **not** prove those costs
exceed, at the current stage, the velocity and cost advantages of using owned hardware now. Optimizing for
maximal server characteristics before they are needed is the speculative-scaffolding the framework forbids
(North-Star Waterline §8).

**Migration is an OPERATIONAL step, not a redesign.** Moving Node 1 off Neo to a Linux mini-PC or a cloud VM later
is **gated by the objective triggers in `06` §4** and executed via **node-registration + workload-drain** (`06` §5)
— provision the new node, join the tailnet, register the adapter, drain Neo's leases, deregister Neo. Zero
Project-Owner change; RPO 0 (all durable state on the bus). The author≠verifier point the challenge conceded
("the verifier wants hardware the author/Windows doesn't control") is satisfied **today** by Neo as a second,
distinct node; if a second node is ever added for reliability, **it is added as a Linux node (reliability before
re-seat, §7.5 / `06` §4 trigger f)** — an addition, not a migration.

### 1.4 The host risk table — every accepted challenge finding paired with its Neo mitigation

The host is **decided (Neo, ADR HOST-1)**. This table is therefore *not* a choice menu — it is the **honest risk
ledger**: every valid challenge finding stays on the books, each paired with the concrete Neo mitigation that makes
Neo the right Node 1 *now*, and the trigger/target that governs the eventual migration. Full detail in `06`.

| Axis (accepted finding) | The Neo reality (honest) | The Neo mitigation NOW (`06`) | Future migration target / trigger |
|---|---|---|---|
| **Unattended reboot** | FileVault ON ⇒ a power-loss/forced reboot leaves the disk locked at a pre-login screen; `LaunchDaemons` do not run until a human logs in (`pmset autorestart` does not bypass it). | **FileVault stays ON** (portable secret store); the **MacBook battery is the built-in UPS** so power blips don't reboot at all; **planned reboots use `fdesetup authrestart`** (key held in RAM for one boot → unattended recovery for the dominant reboot event, macOS updates); the **rare** unplanned reboot (panic / battery fully drained) takes an **explicitly-accepted manual-login RTO** — the off-node watchdog pages the founder to log in (`06` §3). | Linux mini-PC / cloud VM (TPM/clevis/network-bound LUKS unattended boot). Trigger 4c: ≥1 reboot-caused outage exceeding the agreed RTO. |
| **Boot-time secret access** | A boot daemon reading a *user-login* keychain may find it locked at boot even with FileVault off. | Secrets come from a **System keychain / file-with-strict-perms (root or `ci-runner`, `chmod 600`), NEVER a login keychain** — readable by the root `LaunchDaemon` at boot; `config-doctor --enforce` fail-closes a half-bootstrapped node (`06` §2, §3). | unchanged on Linux (systemd-creds / file ACLs) — a clean carry-over. |
| **colima / macOS-Docker overhead** | colima is a Lima-VM layer for Docker; it can break across a macOS major upgrade (no native dockerd). | **Pin colima + `postgres:16`; autostart colima via its Homebrew launchd service**; macOS-update runbook re-checks the Docker socket before re-enabling required checks; the `runs-on` fallback covers a broken socket in one line (`06` §2). | native dockerd on Linux removes the VM layer entirely. Trigger 4b: laptop-specific ops toil > 3 hrs/wk. |
| **Sleep / wake / App Nap / thermals / lid-closed** | A laptop sleeps, App-Naps background processes, and throttles thermally under sustained load; `pmset`/`caffeinate` can be reset by some updates. | `sudo pmset -a sleep 0 disablesleep 1` + `caffeinate -dimsu` on the daemon; **App-Nap exclusion** on the worker; **lid-closed clamshell on power**; the post-update runbook re-asserts `pmset` (`06` §2). | a server does not sleep/App-Nap. Trigger 4e: sustained thermal throttling / CI-duration regression. |
| **Single-machine SPOF + daily-driver contention** | One machine concentrates CI+verify+worker+deploy, and it is also the founder's daily-driver laptop that may travel/sleep. | No node holds essential state (durable bus); the **one-line `runs-on` rollback** restores CI; the worker resumes on any node from the bus. Honest residual: when Neo is away/asleep, continuous autonomy pauses-and-resumes safely (`06` §2). | add a **Linux node as Node 2 for reliability first** (reliability before re-seat). Trigger 4d/4f. |
| **Consumer SSD / battery wear** | A laptop's SSD and battery are consumer-grade and wear under 24/7 duty; a degraded battery loses the UPS property. | Warm-not-hammered duty (coarse tick cadence, §M0); **battery-health + SMART monitored**; a degraded battery is itself a migration trigger (`06` §2, §4). | server/cloud hardware. Trigger 4c-adjacent (battery health < threshold). |
| **Theft / physical (portable secret store)** | A laptop is portable and commonly stolen *while suspended* (FileVault key in RAM); it holds `VERCEL_TOKEN`, pooler creds, break-glass material. | FileVault ON; **Ed25519 break-glass before go-live** (the prod-signing key never lives on Neo); deploy-token co-equal control; instant Tailscale device-removal + secret-rotation runbook (§6.4/§6.5, `06` §5). | non-portable mini-PC / no-local-device cloud VM. Trigger 4a (security, hard). |
| **Availability ceiling (residential ISP/power)** | Continuous-autonomy uptime is ceilinged by a no-SLA home ISP + home power. | Stated explicitly in the DR table (§9, §7.3); a bus/ISP outage is a **safe pause-and-resume**, not data loss; the battery covers power flicker (`06` §2). | datacenter connectivity (cloud VM). Trigger 4d. |

### 1.5 What this means for the build

**Neo is Execution Node 1 now, and the architecture stays fully host-agnostic** so that replacing it later is
node-registration, never redesign. The rest of this document describes the architecture in host-agnostic terms,
flagging the host-specific split (macOS: colima + launchd vs Linux: Docker + systemd) wherever it bites, and using
**Neo** for the specific laptop instance and **"Execution Node 1"** for the role. The Neo-specific operations
(every mitigation above, in build-ready detail), the FileVault/reboot resolution, the **objective migration
triggers**, and the **host-swap runbook** are owned by **`06-neo-node1-operations-and-migration.md`**. The two
go-live preconditions the challenge surfaced — **Ed25519 break-glass** and the **co-equal deploy-token control** —
are carried forward as hard gates (§6.4, §6.5, `06` §5).

---

## 2. Execution-node architecture (from 01)

**The load-bearing discipline: three roles, one or two substrates, one trust posture.** A capability lives on the
execution node only if it is *continuous* (wants an owned host) or *neutral-hardware-required* (verify). Everything
interactive, secret-personal, or last-resort stays off it.

### 2.1 The node responsibility map (capability → where it runs → process model)

| # | Capability | Runs where | Process model | Host-specific note |
|---|---|---|---|---|
| 1 | Interactive build / headless Claude `/goal` sessions | **Windows (Node 1/dev)** | the founder's terminal / `claude -p` | host-agnostic |
| 2 | Local pre-push gate (`.githooks/pre-push`) | **Windows** + the exec node, unchanged | git hook, synchronous | machine-independent; travels in the repo |
| 3 | PR-triggered **required checks** (`ci`/build-and-migrate, `migration-lint`, `gitleaks-scan`, `config-gate`) | **Execution Node** | **ephemeral GH Actions runner** (one job → fresh runner → de-register) | runner agent supervised by **launchd (macOS)** or **systemd (Linux)** |
| 4 | The independent **VERIFY** + `machine_probe` (D9 binding-gate compute) | **Execution Node** | same ephemeral runner, a `verify`-kind job | placed on a node the author (Windows) does not control |
| 5 | **Deploy executor** (Vercel `--prebuilt --prod` + Supabase migrate) | **Execution Node** | a job on the ephemeral runner holding `VERCEL_TOKEN` | identity travels with the *token*, not the host |
| 6 | **The autonomy worker daemon** (engine-tick · PO-reconciler · goal-supervisor) | **Execution Node** | **launchd `LaunchDaemon` (macOS)** / **systemd unit (Linux)**, long-lived Node, KeepAlive | the V-H worker that owns its clock; $0 marginal → ticks at 5s |
| 7 | **Test Postgres** (replaces GH `services: postgres:16`) | **Execution Node** | **colima VM + `postgres:16` (macOS)** / **native Docker `postgres:16` (Linux)** | torn down per job or kept warm |
| 8 | **Permanent staging** (Vercel staging project + Supabase staging branch) | **Vercel + Supabase** (deployed *from* the node) | a deploy job on merge-to-`dev` | the node deploys it; it does not *host* it |
| 9 | **The dead-man's-switch** (watches the worker) | **OFF the node** — Healthchecks.io + a Windows Scheduled Task backup | external HTTP monitor + a Windows task | a different failure domain entirely |
| 10 | Secrets-of-record (CI/deploy) | **GitHub Actions Secrets** | injected as job env, never to disk | ephemeral runner = no persisted secret |
| 11 | Worker daemon's own secrets | **macOS Keychain** / **a dedicated keystore + file ACLs (Linux)** | read at process start | see §9.3 — a boot-time daemon must NOT depend on a user-login keychain |
| 12 | Durable bus / system state | **Supabase Postgres** (unchanged) | the existing run/step engine | **no node holds essential RAM state** — this is what makes every node replaceable |

**The line, as a rule:** *the execution node runs what is continuous (the worker), must be neutral (verify/CI), or
is token-attributed (deploy). Windows keeps what is interactive (build) and the last-resort watchdog backup. The
bus keeps all durable state. Nothing essential lives in any node's RAM.*

**Anti-scope (equally load-bearing):** the node does **not** host the durable bus, does **not** run its own
dead-man's-switch, does **not** authorize Class-C acts (merge-to-main / prod-deploy stay founder boundaries), does
**not** run PR code with `pull_request_target` *ever*, does **not** store personal secrets reachable by the runner
user, and is a single point of *compute* failure only — never of *state* (bounded by the one-line `runs-on`
rollback).

### 2.2 The CI/CD handshake (GitHub is the plane, the node is the compute)

The key handshake fact (and a security property): the runner **long-polls *outbound* to GitHub** for work. GitHub
never connects *in*. **No inbound port is opened; no public IP is exposed.** This is why a self-hosted runner works
behind home NAT with zero network configuration, and why the tailnet ACL can be inbound-deny for the runner.

```
 ┌─ Windows (dev) ─┐                 ┌──────────── GitHub (the plane) ────────────┐                ┌── Execution Node (compute) ──┐
 │ build a slice   │                 │                                            │                │                              │
 │ pre-push gate ✔ │ ── git push ──▶ │  PR opened/synchronized → workflow_run     │                │                              │
 └─────────────────┘                 │  job has `runs-on: [self-hosted, exec]`    │                │                              │
                                     │       │ enqueue job (long-poll)            │── HTTPS poll ─▶│ ephemeral runner picks up ONE │
                                     │       └────────────────────────────────────┼─ (outbound;    │  job, gets a job-scoped token │
                                     │                                            │   no inbound    │                              │
                                     │  check-run status ◀────────────────────────┼── status API ──┤ runs: ci / verify / migration │
                                     │  (pending→success/failure)                 │                │  / gitleaks (test pg up)      │
                                     │       │ branch protection reads required   │                │ runner EXITS, de-registers    │
                                     │       │ all green + CODEOWNERS review       │                │  (ephemeral)                  │
                                     │       ▼                                    │                │                              │
                                     │  founder approves → merge to main (★ C-C)  │── poll ───────▶│ deploy job: vercel --prebuilt │
                                     │       │ push: main → deploy.yml             │                │  --prod (founder VERCEL_TOKEN)│
                                     │  deployment_status ◀──────────────────────  │◀── token ──────┤  + supabase migrate (pooler)  │
                                     │       │ → prod-smoke (binding health)       │                │                              │
                                     └────────────────────────────────────────────┘                └──────────────────────────────┘
                                                                  │
                          OFF-PLANE: the worker daemon on the node drains the bus on its OWN clock
                          (engine-tick · reconciler · goal-supervisor) — NOT triggered by GitHub at all.
                          Watched by Healthchecks.io (off-node) → SMS/email the founder on silence.
```

### 2.3 Runner isolation (the decided posture)

A self-hosted runner that executes PR code is the classic foot-gun; GitHub's guidance is *"do not use self-hosted
runners on public repositories."* These are **solo, private repos with no external contributors** — so the primary
vector (a stranger's fork PR) does not exist today. The residual (a compromised dependency, or a future second
contributor) is real but bounded by defense-in-depth:

1. **Ephemeral runners (`--ephemeral`)** — fresh per job, de-register after one job; no secret/checkout/artifact
   persists. The single highest-leverage control.
2. **A dedicated non-admin user** (`ci-runner`) — no admin, no sudoers, no access to the founder's personal
   keychain/keystore, browser profiles, SSH keys, or cloud accounts.
3. **Never `pull_request_target`** on the self-hosted runner — the documented fork→secret exfiltration path. An
   absolute rule, enforced by review of every workflow change.
4. **Least-scope, short-lived tokens** — `GITHUB_TOKEN` job-scoped + auto-expiring; `VERCEL_TOKEN` deploy-scoped;
   the supervisor's probe identity read-only. No long-lived god token on the node.
5. **Tailscale ACLs** — the runner tag is outbound-only to GitHub/Vercel/Supabase; no inbound except founder +
   health monitor.
6. **Pinned action SHAs + lockfile-only installs** — pin third-party Actions to a commit SHA; `npm ci` against the
   committed lockfile; gitleaks + Dependabot/`npm audit` guard the dependency vector.

**Honest residual:** for a solo private repo the exposure is **low but not zero** — a compromised dependency could
reach the job's injected secrets before teardown. **Re-evaluate the moment a second contributor or a public fork
appears** (then harden, or move untrusted-PR checks back to GitHub-hosted — a one-line `runs-on` away). See ADR-EN-3.

### 2.4 What is host-specific vs host-agnostic (the migration's most important table)

| Concern | macOS (Neo) | Linux (mini-PC / cloud VM) | Verdict |
|---|---|---|---|
| Process supervisor | **launchd** (`LaunchDaemon`, KeepAlive, RunAtLoad) | **systemd** (unit, `Restart=always`, `WantedBy=multi-user.target`) | both native; Linux is the more standard server idiom |
| Container runtime | **colima** + Lima VM + `docker` CLI (a layer of indirection; breaks across macOS upgrades) | **native dockerd** (no VM layer, no macOS-upgrade churn) | **Linux is materially simpler** — colima is a named rot vector |
| Sleep/thermal | `pmset -a sleep 0 disablesleep 1` + `caffeinate` (reset by some macOS updates; fights a lid-closed laptop) | n/a (a server does not sleep) | **Linux removes this class entirely** |
| Encrypted-disk unattended boot | **FileVault locks until physical login** (§9.3 — the killer) | TPM / clevis / network-bound LUKS — **a solved unattended-boot pattern** | **Linux is the reason to switch** |
| Boot-time secret access | user-login keychain may be locked at boot (§9.3) | a dedicated keystore / file ACLs the daemon unlocks non-interactively | Linux is cleaner; macOS needs a dedicated (non-login) keychain |
| The runner, the worker logic, the toolchain | identical (Node/Postgres/gitleaks/Vercel CLI are platform-agnostic) | identical | **host-agnostic** — the actual work does not care |

The bottom row is the whole point: the *workload* is platform-agnostic; only the *supervision + storage substrate*
is host-specific, and on every host-specific row **Linux is simpler.** Under ADR HOST-1 (Neo now), these
host-specific rows are exactly the axes the **objective migration triggers measure** (`06` §4): each is mitigated on
Neo today, and if a mitigation stops holding, the trigger fires and the workload moves to Linux by node-registration.

### 2.5 The forward-looking seam: the `ExecutionProviderPort`

This node is the **first concrete adapter** of the port (EIB §9 / RS-DOS §46). The selector places a `verify`-kind
job on a *different* node than the `build`-kind job **by policy** — author≠verifier enforced at the placement
layer, not by convention. Building Node 1 correctly = building the port's first real proof. A third node (Linux,
Mac Studio, cloud) is then a *registration, not a migration* (§7). Full port detail in §7.

---

## 3. Network topology (from 02)

### 3.1 The one-sentence model

*Tailscale is the private transport + the identity gate; it carries no secrets, authorizes no writes, and trusts no
node by default — it decides **who may reach what**, and everything else (secrets, prod writes, data-class) is
gated **behind** that reachability by mechanisms that assume the network is already hostile.* **Tailscale is the
control/ops plane, not the data plane** — the heavy paths (the Postgres bus, deploys, git) are outbound public-TLS
egress to SaaS and are *unaffected by a tailnet outage.*

### 3.2 On-tailnet vs reached-over-the-public-internet

| Entity | On the tailnet? | How reached |
|---|---|---|
| Windows dev PC (`windows-node1`, `tag:dev`) | **YES** | MagicDNS name |
| Execution Node (`tag:exec-node,tag:ci-runner`) | **YES** | MagicDNS name |
| Future Linux / Mac Studio nodes | **YES** | MagicDNS name |
| Future cloud worker (`tag:external`) | **YES — but quarantined** | MagicDNS, ACL-fenced |
| Founder laptop / phone (`group:founder`) | **YES** | MagicDNS name |
| **Healthchecks.io** (the watchdog) | **NO** | the node pushes heartbeats *out* over public TLS |
| **Vercel** (deploy + prod) | **NO — SaaS** | outbound TLS, `VERCEL_TOKEN` (identity in the token, not the host) |
| **Supabase** (durable bus + prod DB) | **NO — SaaS** | outbound TLS to `*.pooler.supabase.com:6543/5432` |
| **GitHub** (system of record, runner control) | **NO — SaaS** | the runner long-polls outbound; git over HTTPS |

**The rule that makes it secure: bind to the tailnet, not the world.** The worker's health endpoint and any
dispatch listener bind to the tailnet interface (or Tailscale Serve); the test Postgres binds `127.0.0.1` only. Net
inbound listening surface on the node = SSH (Tailscale SSH) + the health endpoint (Serve), both tailnet-only. **No
public IP, no opened port, no public `sshd`, no Funnel** — the external attack surface of the execution layer is
*the SaaS providers' surfaces, not the founder's machines.*

### 3.3 ASCII topology

```
   PUBLIC INTERNET (TLS + platform creds — NOT the tailnet)
   ┌──────────────┐   ┌───────────────────────┐   ┌──────────────────────┐   ┌────────────────────┐
   │   GitHub     │   │  Vercel (deploy+prod)  │   │  Supabase (bus+DB)   │   │  Healthchecks.io   │
   │ (runner ctl, │   │  api.vercel.com        │   │  *.pooler.supabase   │   │  (push watchdog)   │
   │  git, checks)│   │  (VERCEL_TOKEN)        │   │  :6543/:5432 (TLS)   │   │  (node pings OUT)  │
   └──────▲───────┘   └──────────▲────────────┘   └──────────▲───────────┘   └─────────▲──────────┘
          │ outbound long-poll   │ outbound TLS              │ outbound TLS            │ outbound TLS
  ════════╪══════════════════════╪═══════════ TAILNET (WireGuard mesh, 100.x, MagicDNS) ═══════════════
          │                      │                           │                         │
  ┌───────┴──────────────────────┴───────────────────────────┴─────────────────────────┴────────────┐
  │   windows-node1            EXEC NODE                   [linux-node3]        founder laptop/phone   │
  │   tag:dev                  tag:exec-node,ci-runner     tag:exec-node        group:founder          │
  │   • build / Claude         • GH self-hosted runner     (future)             • admin + observe      │
  │   • git push (gate)        • worker daemon             • Tailscale SSH in (founder only)           │
  │   • tailnet WATCHDOG ──────▶ • health endpoint (Serve, tailnet-only) ◀──────── (watchdog: health only)
  │     (pulls node /ready+    • test Postgres (127.0.0.1 only)                                        │
  │      /health + Supabase)   • deploy executor (VERCEL_TOKEN, outbound)        [cloud-node5]         │
  │                                                                              tag:external          │
  │                                                                              (QUARANTINED)         │
  └────────────────────────────────────────────────────────────────────────────────────────────────────┘
        services bind to the tailnet interface (or 127.0.0.1), NEVER to 0.0.0.0 / a public IP
```

### 3.4 The default-deny ACL shape

Principle: **default-deny, tag-based, least-privilege.** Five tags: `tag:dev` (Windows — broad-but-scoped),
`tag:exec-node`+`tag:ci-runner` (the node — outbound-mostly, a tailnet *sink*), `tag:watchdog` (health only),
`tag:external` (cloud — quarantined). The full HuJSON starter policy (with a `tests[]` block that turns the ACL
from an assertion into a *gate*) lives in 02 §D. In words: the founder's devices reach everything; the CI runner is
a tailnet sink (nothing reaches it; it can't pivot); the watchdog hits only `:8787` (health); `tag:external` is
physically fenced from every trusted node — the network enforcement of the `data_class` boundary. **Ship the
`tests[]` block with the policy** (validate-the-validator discipline).

---

## 4. Execution flow diagrams (synthesized)

### 4.1 Build → verify → deploy (the CI/CD flow + GitHub↔node handshake)

```
Windows: build slice → pre-push gate (verify-gate · os-drift · agents-check · hook-paths) ✔ → git push
   │
GitHub: PR → required checks enqueued (runs-on: [self-hosted, exec])
   │ outbound long-poll
EXEC NODE (ephemeral runner, one job each): ci/build-and-migrate → migration-lint → gitleaks → config-gate
   │                                          + independent VERIFY + machine_probe (node ≠ author's box)
   │ status API → GitHub
GitHub: branch protection (all required green) + CODEOWNERS review + verify-coverage binding status
   │
Founder ★: approve → merge to main  [Class-C boundary — the node executes, never authorizes]
   │ push main → deploy.yml
EXEC NODE: vercel --prebuilt --prod (founder token) + supabase migrate (pooler, expand/contract, before code)
   │ deployment_status
GitHub: prod-smoke (BINDING post-deploy health — no continue-on-error)
   │ pass → done   │ fail → rollback-helper prints last-known-good `vercel promote`
```

### 4.2 Goal lifecycle on a node (the worker daemon, off-plane)

```
worker daemon (systemd/launchd, KeepAlive) — owns its OWN clock, NOT triggered by GitHub
   │
   ├─ every ~5s: engine-tick → advance ready/blocked-on-timer durable steps  (LIVENESS, C13)
   │             + upsert engine_heartbeat{node, tick_seq++, last_tick_at} in the SAME txn
   │
   ├─ ~30 min:  goal-supervisor → re-probe the acceptance metric under ITS OWN identity (PROGRESS, C7)
   │             → append ProgressSample to the goal-delta ledger
   │             → hard trip (flat-delta / loop-fingerprint / H1 cap / goal_metric_reachable:false)
   │                  ⇒ circuit-breaker OPEN (durable) ⇒ HALT ⇒ BoundaryFAP summon (founder ★)
   │
   └─ every drain: SKIP-LOCKED + lease over the durable Postgres bus
                   crash → lease expires → next tick (any live node) reclaims from last checkpoint
                   completeAwaitingStep is idempotent + CAS-guarded ⇒ NO double-execute
```

### 4.3 Placement-selector decision flow (constraint-first, optimize-second)

```
            ExecutionRequest (kind + data_class + placement_req + budget)
                                  │
                                  ▼
   STEP 1 — CONSTRAIN (eligible ONLY if all three hold)
     a) live?            liveness lease fresh            (else skip)
     b) capable?         labels ⊇ capabilities ; resource_class satisfiable   (else skip)
     c) trusted-enough?  trustBoundaryOk(data_class, trustDomain)
                         PII/SECRET → trusted only       (else skip)
                                  │
                 ┌────────────────┴─────────────────┐
           eligible = ∅                       eligible ≠ ∅
                │                                    │
                ▼                                    ▼
   FAIL-CLOSED:                          STEP 2 — OPTIMIZE within eligible
    • transient shortage → job WAITS      rank: lowest-queue-depth → lowest-cost → lowest-latency
    • structural (no trusted node         (author≠verifier: a `verify` job is placed on a
      for PII) → HALT + summon founder     DIFFERENT node than its `build` job, by policy)
    NEVER downgrade the boundary;                    │
    NEVER invent a node.                             ▼
                                          execute(req, signal) on the chosen node
                                                     │
                                                     ▼
                              ExecutionOutcome.evidenceRef → completeAwaitingStep
                              (idempotent, CAS-guarded, lease released — durable bus)
```

### 4.4 Heartbeat → watchdog → alert flow

```
ON-NODE (intra-domain, fast — handles the recoverable)        OFF-NODE (cross-domain — handles "on-node supervision is itself dead")
 ┌──────────────────────────────────────────────┐
 │ launchd/systemd KeepAlive (process exists)     │
 │   │ relaunch on exit; crash-loop → throttle    │
 │   ▼                                            │
 │ engine-tick ~5s → engine_heartbeat row fresh?  │
 │   │ last_tick_at > 60s ⇒ HEARTBEAT_STALE       │
 │   ▼                                            │
 │ /ready (DB reachable AND tick fresh AND cursor │
 │   advancing AND GS posted-in-window)           │
 │   │ green?                                     │
 └───┼────────────────────────────────────────────┘
     │ green → PUSH ping ──────────────────────────────────▶ Healthchecks.io (every 1 min, grace 5–10 min)
     │ NOT green → ping STOPS (gated — ADR-HBM-3)            │  no check-in within grace ⇒ ALARM
     │                                                       ▼
     │  Windows Scheduled Task (every ~5 min) ── pull ──▶ node /ready + /health + DIRECT Supabase probe
     │   (independent domain; disambiguates node-fault                │  (challenge §4 fix: don't mislabel
     │    from Supabase-fault — §5.4)                                 │   a Supabase outage as "node down")
     ▼                                                                ▼
  founder phone (the ONLY shared dependency) ◀───── P1 page ◀─────────┘
  weekly "all-green" digest proves the alarm path itself is alive (a dead-man for the dead-man)
```

---

## 5. Heartbeat & monitoring (from 03)

### 5.1 The layered heartbeat (seven layers, two clocks, one rule)

The rule that orders them: **on-node supervision handles the recoverable; the off-node watchdog handles the case
where on-node supervision itself is dead.** Liveness ≠ progress ≠ supervisor-aliveness (RS §7.5), each tier
independent of the one it watches.

| # | Layer | Emitter | Consumer | Cadence | Miss-action |
|---|---|---|---|---|---|
| A | Process supervision (on-node) | launchd/systemd watching daemon+runner PIDs | itself (KeepAlive) | event + throttle (10s) | relaunch; crash-loop throttle → tick goes stale → Layer F |
| B | **Engine-tick (C13, liveness)** | worker daemon **internal timer**; upserts `engine_heartbeat{node,tick_seq,last_tick_at}` | the bus row → `/ready`, the dead-man gate, the status page | **~5s** (no per-invocation meter) | `last_tick_at`>60s ⇒ `HEARTBEAT_STALE` ⇒ `/ready` down ⇒ ping stops ⇒ Layer F |
| C | Runner heartbeat | GH runner agent → GitHub runner-status API | GitHub + a coarse status-page poller | runner↔GitHub ~30–60s; poll **5–10 min** | runner offline **and** required checks queued ⇒ **P1** + flip `runs-on` to `ubuntu-latest` |
| D | Health endpoints `/health`,`/ready` | the worker's tiny HTTP server, **tailnet-only bind** | the off-node dead-man, the Windows backup, the status page | on demand | `/health` unreachable ⇒ hung; `/ready` 503 ⇒ critical subsystem ⇒ Layer F |
| E | **Goal-progress (GS C7)** | a daemon slot with **separate state reads**; re-probes the metric under the GS identity | the goal-delta ledger; hard trip → HALT + BoundaryFAP | **~30 min** | a trip ⇒ HALT + summon (P1); GS *going silent* ⇒ Layer F |
| F | **Off-node dead-man (C8)** | the node **PUSHES** a check-in to `hc-ping.com/<uuid>` **only when `/ready` is green** | **Healthchecks.io** + a **Windows Scheduled Task** pulling `/ready` over the tailnet | check-in **1 min**, grace **5–10 min** | no check-in in grace ⇒ Healthchecks alarms the founder over an independent channel |
| G | Founder alert + visibility | Healthchecks (page) · the off-node status page (pull) | the founder (the only on-call) | page = immediate P1; surface = always-on | founder acks, opens the off-node page, runs recovery (§5.x) or the rollback lever |

### 5.2 The off-node watchdog (push, gated on `/ready`)

The dead-man's-switch **must not share the failure domain of the thing it watches** — hardware, OS, power, network,
or process tree. It must survive: node powered off · kernel panic · off the network · daemon crash-looping ·
supervisor wedged · logged out · disk full · a botched OS update.

- **Primary — push:** the daemon `POST`s to Healthchecks.io every 1 min, grace 5–10 min. Push beats pull: no
  inbound exposure, and **absence is unforgeable** (a dead node *cannot* ping).
- **The gate (ADR-HBM-3):** the node pings **only when its own `/ready` is green** (heartbeat fresh AND cursor
  advancing AND GS posted-in-window). A naive unconditional ping would hide a *degraded-but-running* daemon. The
  gate makes the dead-man catch "alive but not supervising," not just "powered off."
- **Backup — pull (independent domain):** a Windows Scheduled Task pulls `/ready` over the tailnet every ~5 min. If
  Healthchecks itself is dark, the Windows task still catches a dead node, and vice-versa. They share nothing but
  the founder's phone.

### 5.3 The minimal monitoring stack (no Prometheus)

At N=2 for a solo founder, a Prometheus/Grafana stack is a *second full-time job that would also run on the node*
(shared failure domain) — **REJECT.** The honest minimal stack:

1. **Dead-man:** **Healthchecks.io** (free). The only thing that *must* exist before any meter-bearing move (M0).
2. **Metrics:** **the durable Postgres bus IS the metrics store.** Queue depth, tick sequence, F1–F15 rates,
   breaker state, cost ledger, goal-delta are *already durable* — the I-Ops read model (RS §49) is a SQL view. No
   time-series DB, no exporters, no second store.
3. **Logs:** structured JSON lines to `~/.../Logs/delivery-os/*.log` (launchd) or journald (systemd), rotated with
   a hard size cap; searched over Tailscale SSH. Escalation (not day-1): ship to a cheap hosted sink only if
   grep-over-SSH hurts.
4. **Dashboard:** **one off-node status page** (Vercel SSR, reads Supabase directly — §5.5).
5. **Free up/down backstops:** the Tailscale device list ("is the node even powered?") + the Healthchecks
   dashboard ("is the dead-man happy?").

### 5.4 Founder visibility (one place to look) + the challenge's caveats

**The surface: a read-only I-Ops status page, hosted OFF-node on Vercel, reading Supabase directly.** Because it is
off-node, the node can be a smoking crater and the page still renders (it shows `exec-node: DOWN`, last-tick red,
the dead-man's last check-in). It shows: nodes up/down + last-seen · runtime heartbeat age (green<30s · amber<2m ·
red>2m) · runner online/queued-checks · active goals + goal-delta + any HALTED/summon · breaker state · queue
depth/oldest-step/dead-letter · last deploy + verify verdict + rollback target · month-to-date cost · the
watchdog's own last check-in · the worst-wins overall verdict (ok/degraded/down).

**Challenge corrections folded in (AUTHORITATIVE):**

- **Integrity vs availability (challenge §7).** The watchdog defends against a **dead** node, not a **lying** one.
  The `/ready` gate is *cooperative, not enforced* — a maliciously compromised node can ignore the gate and ping
  unconditionally (suppressing the alarm) or fake `/ready` green to the Windows puller. **State this plainly: the
  dead-man covers *availability*, not *integrity*.** Detecting a lying node needs an integrity signal the watched
  node cannot forge — named, out of scope now, not assumed away.
- **The Supabase shared-dependency blind spot (challenge §4).** Supabase is a **common-mode dependency** under the
  runtime *and* its observability: the worker drains Supabase, `/ready` checks Supabase, the page reads Supabase,
  the Windows pull hits `/ready` (which 503s when Supabase is down). A Supabase outage therefore (1) halts the
  runtime, (2) makes the node stop pinging → Healthchecks pages *"node down"* when the node is *up* (misattributed
  fault), and (3) darkens the "one place to look." **Fix (must-do):** point the Windows pull-watchdog at **both
  `/health` (liveness, no DB — Supabase-independent) AND a direct Supabase probe**, so the page can say "bus down,
  node fine" instead of a false "node down." Only two signals are genuinely Supabase-independent — the Healthchecks
  dumb-timer and the Tailscale device list — and both are crude up/down.

### 5.5 Alerting policy

Page only on **P1**: node down (dead-man) · GS silent · circuit-breaker HALT + summon · runner offline *with*
queued required checks · prod deploy health-verify ALARM. **P2 (daily digest):** a non-critical subsystem degraded
· disk >80% · runner auto-update · a self-healed blip · cost over a soft threshold. **P3 (dashboard-only):** normal
elevated queue depth, latency within band, routine tick history. Channel independence: the page originates
**off-node** (Healthchecks → phone push/SMS); the phone is the only shared dependency. A **weekly "all-green"
digest** proves the alerting path itself is alive (a dead-man for the dead-man) — so silence can be trusted.

---

## 6. Security model (from 02)

### 6.1 Trust boundaries (concentric)

1. **Tailnet membership** — inside = authenticated + approved + tagged; outside = the public internet. *Membership
   ≠ trust* (a member still gets only what its tag's ACL grants, default-deny).
2. **Tag/trust-domain** (RS §54.2) — `group:founder` (full) ⊃ `tag:dev` (broad-but-scoped) ⊃ `tag:exec-node`/
   `tag:ci-runner` (sink, outbound-mostly) ⊃ `tag:external` (quarantined). The ACL is the *enforcement* of
   `data_class` placement: PII/SECRET physically cannot traverse to `tag:external`.
3. **OS-user** — `ci-runner` (non-admin, no founder-keystore access) vs the founder's personal account.
4. **Secret-store** — secrets live in platform stores (Vercel/GitHub) + the `ci-runner` keystore; never the tree,
   never a dotfile.
5. **Write boundary (prod)** — default-DENY; the only crossing is a founder-signed, single-use, scoped,
   target-bound, immutably-logged break-glass grant; even a valid grant cannot disable the ledger immutability
   triggers.

### 6.2 The headline threat + its bounds

A self-hosted runner that executes PR code runs attacker code if the PR is hostile. Decomposed for this profile:
malicious external-fork PR = **not today** (private, solo; `pull_request_target` banned); **compromised dependency
= the real residual** (bounded by ephemeral + non-admin user + ACL sink + least-scope token + RLS-bounded DB cred);
secret exfiltration = bounded (the stealable secret is itself least-privilege); persistence = bounded (ephemeral);
lateral movement = closed by the ACL (`tag:ci-runner` is a tailnet sink, proven by `tests[]`). **Net: low but not
zero**, acceptable for solo/private/founder-controlled code, and a **re-evaluate-now** residual the moment the code
stops being founder-controlled.

### 6.3 Secrets bootstrap (chicken-and-egg, solved)

Two distinct consumers, never conflated: (1) **GitHub Actions jobs** get secrets injected into the job env over
GitHub's TLS — same path as a hosted runner, vanish with the ephemeral runner; (2) **the worker daemon** reads
`DATABASE_URL`/`CRON_SECRET`/signing material from a dedicated keystore under the non-admin `ci-runner` user, seeded
**once** by the founder over Tailscale SSH from the platform stores, rotated via the config platform. **No secret
is ever tree-resident** (gitleaks floor + registry-metadata-only invariant hold). The fail-closed
`config-doctor`/`i-config --enforce` gate refuses to let the daemon run with an incomplete/invalid secret set — a
half-bootstrapped node fails loud, not silent.

> **Host caveat (challenge §9.3, AUTHORITATIVE):** on macOS, do **NOT** read from a *user-login* keychain in a
> boot-time daemon (it may be locked at boot). Use a dedicated keychain the daemon can unlock non-interactively, or
> a documented at-rest secret with file ACLs — and **prove the daemon comes back green after a cold boot with no
> human present** as an explicit M-gate. On Linux this is the standard pattern (a keystore / file ACLs the systemd
> unit reads at start); it is another reason the Linux host is simpler.

### 6.4 Break-glass + the Ed25519 fix (do before go-live)

The audited break-glass (`src/db/break-glass.ts`) is the only path a write reaches prod, and already assumes
neutral hardware. The founder *issues* a grant from a trusted device (HMAC-signed, single-use, ≤10 min TTL, scoped
to one `(table,op)`, bound to the prod `DATABASE_URL` fingerprint); the node's migration-runner *consumes* it
(injected, never pasted), spent atomically, every issue/consume/deny immutably logged.

**The honest weakness (surfaced, not smoothed):** break-glass is **HMAC (symmetric)** — the verifying node holds
the key that can also *sign*, so a fully-compromised node could *self-issue* a grant. The grant is still
single-use/short-TTL/target-bound/logged, and no grant can disable the ledger immutability triggers, so the blast
radius is "a scoped, logged, non-ledger-tampering prod write," not "silent forgery." **ADR-SEC-3: migrate to
Ed25519** — the private signing key lives **only on the founder's device**, the node ships only the public key to
verify; a compromised node then *cannot mint a grant at all.* **Do this before go-live**, not "on the horizon"
(challenge §6/§7).

### 6.5 The deploy token is a CO-EQUAL prod-mutation path (challenge §7, AUTHORITATIVE)

Ed25519 is **necessary but not sufficient.** A fully-compromised node (the precondition for self-issue) *also*
holds **`VERCEL_TOKEN`**, which can **deploy attacker code to prod as the founder** (the design makes "no manual
click" a *feature*). Attacker code in the prod runtime can then write to prod DB **through the app's own legitimate
paths**, bypassing break-glass entirely. So Ed25519 removes one prod-mutation path while leaving a co-equal one
wide open on the same node. **Treat the deploy token co-equally with break-glass:** deploy author≠verifier, a
deploy-approval gate, or a token that cannot self-serve a prod deploy without a second factor. Also: **"not silent
forgery" holds only for append-only ledgers** — a self-issued grant to a *mutable* business table (contract status,
a balance field, a feature flag) is a quiet real write the triggers don't cover, so **bound and enumerate the
break-glass `(table,op)` set** or "scoped" is doing unproven work. The symmetric-trust pattern also recurs in
`CRON_SECRET`/`PROD_SMOKE_TOKEN` and **in the watchdog's own liveness signal** (§5.4 — a lying node can
suppress/fake it).

### 6.6 The 6 hard preconditions + re-evaluate triggers

**Six hard preconditions (drop one and the GO verdict weakens):**
1. **Ephemeral runner** (clean per job; no secret persists).
2. **Dedicated non-admin `ci-runner` user** (no founder-keystore/OS access).
3. **ACL outbound-only for `tag:ci-runner`** (tailnet sink; the `tests[]` block proves it).
4. **Off-node push-watchdog** (Healthchecks.io, independent domain) — converts silent rot into a ping.
5. **No Funnel** anywhere in the execution layer (no public ingress, ever).
6. **Never `pull_request_target`** on a self-hosted runner (the fork-PR secret-theft vector).

**Re-evaluate triggers (any one flips "safe for now"):** a second human contributor · a public repo or external
fork PR · an external/cloud node joins · the node holds the HMAC prod key long-term (do ADR-SEC-3 first) · a second
tenant's PII flows through the node. Tailnet lock is **deferred** with a named trigger (first of: a cloud node · a
second human · the node becoming sole holder of a high-value signing key).

---

## 7. Future execution layer (from 04)

**The one load-bearing idea:** all durable state lives on the Postgres bus; no node holds essential RAM state;
therefore every node is a replaceable execution surface. Adding a node = registering an adapter; losing a node = a
leased step expires and another reclaims; recovering the world = stand up a fresh node, point at the same bus,
resume. The port turns each into a config change.

### 7.1 Multi-node routing

The PO emits a provider-agnostic `ExecutionRequest` (`jobId` · `goalId` · `kind` · `payload` · `data_class` ·
`placement_req{lane,isolation,resource_class,capabilities}` · `budget`). Each node is an `ExecutionProviderPort`
adapter (`nodeId` · `labels` · `trustDomain` · `canAccept` · `execute`). The constraint-first selector filters the
live registry by liveness + capability + trust domain (fail-closed on empty), then optimizes by
queue-depth/cost/latency. **Adding a node = registering an adapter, zero PO change** (the §44 acceptance test).
author≠verifier becomes physical: `verify` is placed on a different node than `build`, by policy.

### 7.2 Failover (+ the in-flight-work caveat)

Every step is leased on the bus (CAS lease). A dead node stops renewing → the lease expires → the SKIP-LOCKED tick
on any live node re-leases and resumes **from the last durable checkpoint**; `completeAwaitingStep` is idempotent +
CAS-guarded ⇒ no double-execution. **The honest caveat:** only the *checkpointed* step is durable — in-flight work
between checkpoints (an LLM call mid-generation, a half-written build) is **re-run, not recovered**, bounded by the
job's `budget` cap (no double-spend past the cap). "Every node replaceable" is true at the granularity of the
durable step, not the in-flight instruction. **Design rule:** no capability the continuous autonomy loop depends on
may live on exactly one node (the moment a `resource_class` is single-homed, that node is a pet again).

### 7.3 DR — RPO 0 / RTO honest

Back up the **database obsessively** (PITR + periodic off-provider dump); **back up no node disk** (a node is
cattle — it holds no irreplaceable state). Recovery: restore the DB if lost → stand up a fresh node from the
documented order → rejoin the tailnet → re-vendor secrets (config-doctor fail-closed confirms completeness) →
register the adapter → resume from the bus.

| Scenario | RPO | RTO |
|---|---|---|
| Single node reboot | **0** | **minutes, automatic** (reboot → reclaim leases) — *but see §9.3: NOT automatic on a FileVault Mac* |
| Single node hardware death (bus intact) | **0** | **hours** to stand up a replacement, **OR minutes** via the one-line `runs-on` fail-back to GitHub-hosted |
| Whole fleet lost, DB intact | **0** | **hours** — one fresh node restores full operation |
| **Database lost** | **= the backup interval** (minutes with PITR; up to ~24h on daily dump only) | **hours** (restore DB, then stand up) |

**Honest reading:** RPO is 0 for any compute loss and bounded by the DB backup cadence for a DB loss; RTO is
minutes when automatic and hours when a human must stand up a replacement (no on-call but the founder). The
off-node watchdog bounds *detection* so RTO doesn't silently start late. An untested backup is not a backup — the
founder must periodically prove a restore.

### 7.4 Offline behavior

Three independent reachability planes (tailnet / public internet / a single node's link) degrade independently. A
**tailnet outage** is survived fully (nodes reach SaaS over public TLS; only founder ops-SSH degrades). An
**internet/bus outage** is a **safe pause-and-resume**: in-flight local work continues to its next checkpoint then
blocks (holds no lease); new placements stop; the idempotency store makes reconnect double-execution-free (dup =
no-op); the founder boundary fails closed for Class-C. **No fully-offline autonomy by design** (the system of record
is a hosted DB by choice) — air-gapped operation is named, deferred, not built.

### 7.5 The fleet roadmap (reliability → capacity → burst)

| Step | Node | Role | Add it when |
|---|---|---|---|
| **1 (now)** | `windows-node1` (dev/build) + **Execution Node 1** (verify+CI+worker+deploy) | the spine | already justified — the meter is exhausted; continuous supervision needs a worker |
| **2** | `linux-node3` (cheap Linux server/mini-PC/VM) | **reliability** — a redundant home for the continuous workload | the maintenance tail bites, OR check latency hurts, OR you want failover redundancy for `pg`/worker. *The first add after Node 1 — for reliability, not capacity.* |
| **3** | `studio-node4` (Mac Studio) | **capacity** — a proper always-on heavy/macOS host | the laptop-as-server strain shows, OR a genuine macOS/large-build need appears |
| **4** | `cloud-node5` (on-demand cloud VM) | **burst** — absorb spikes of `short`/`PUBLIC` checks | queue depth spikes at portfolio scale. **`trustDomain: external`** — the `data_class` gate refuses PII/SECRET, fail-closed |

**Reliability before capacity before burst; one node at a time; parity-proven; reversible. The architecture never
changes — the registry just gets longer.** (Note: under ADR HOST-1, Node 1 = Neo now. Step 2 — **a Linux node for
reliability — is the first add, and per `06` §4 trigger f it lands as Node 2 *before* any re-seat of Node 1**:
reliability-first, never two changes at once. Whether the Linux node is *added alongside* Neo (reliability) or
*replaces* Neo (a triggered Node-1 migration, `06` §5) is governed by which trigger fires — both are
node-registration, not redesign.)

---

## 8. Recommended software stack (consolidated)

| Layer | Recommendation | Pin | Honest trade-off |
|---|---|---|---|
| **Runner agent** | GitHub `actions/runner`, `--ephemeral`, installed as a service | track GitHub's release | Auto-update is convenient but *can break and silently fail jobs* — the off-node monitor + `runs-on` fallback are the net. Repo-level first (least blast radius). |
| **Container runtime** | **macOS: colima** (`--cpu 4 --memory 8`) · **Linux: native dockerd** | `postgres:16` (match CI) | colima = lighter/free/headless but a Lima VM layer that *breaks across macOS upgrades* (a rot vector). **Native Docker on Linux has neither problem.** Docker Desktop rejected (GUI/heavy/licensed). |
| **Process supervisor** | **macOS: launchd** · **Linux: systemd** | n/a (OS) | Both native, boot-before-login, OS-owned restart policy, no extra daemon to supervise. **pm2 rejected** (a Node process that itself needs supervising). **cron rejected** for the worker (cron *launches* per tick — the cron-of-an-LLM anti-pattern; the worker must own its clock). |
| **Job/queue runner** | the existing engine **`agent-runner.ts` drain loop** (SKIP-LOCKED + lease over the Supabase bus) | the delivery-os runtime version | **Reuse, not rebuild.** No Redis/BullMQ — the durable Postgres bus *is* the queue. Con: a contention ceiling at portfolio scale (read-replicas/partition later). Pro: one fewer system; crash-safety built in. |
| **Mesh / connectivity** | **Tailscale** (WireGuard) — MagicDNS, ACLs-as-code, Tailscale SSH, tailnet-lock-at-trigger | latest | Zero-config NAT traversal, no opened ports, stable identity, future-node-join is a *join*. Con: a dependency on Tailscale's coordination server (node↔SaaS traffic unaffected if it's down — only founder ops-SSH degrades). |
| **Off-node watchdog** | **Healthchecks.io** (free) `/ready`-gated push + a **Windows Scheduled Task** backup | n/a | Free, genuinely external domain, zero GitHub minutes. Redundancy covers Healthchecks itself going dark. |
| **Node toolchain** | Node 22 (LTS) + npm/pnpm matching each repo's `packageManager` | Node 22.x (PLOS=22, admin=20 — **match per-repo**) | Must match CI exactly or works-on-node-fails-on-hosted drift. |
| **Secret stores** | GitHub Actions Secrets (CI/deploy) + macOS Keychain *(dedicated, non-login — §6.3)* / Linux keystore + file ACLs (the daemon) | n/a | Two stores by necessity. Both least-privilege; neither in the repo (gitleaks-enforced). |
| **Deploy CLI** | Vercel CLI `48.12.1` (pinned) + Supabase via the **pooler** (IPv4 → never the IPv6-only direct host) | `vercel@48.12.1` | Pinned deliberately (API floor ≥47.2.2; `@latest` drifts). |

**The host-dependent split in one line:** macOS pays colima + launchd + the sleep/FileVault/keychain tax; Linux
pays none of it (native Docker + systemd + solved unattended-encrypted-boot). The *workload* layers (runner,
queue, toolchain, deploy, mesh, watchdog) are identical on either host.

---

## 9. Risks & trade-offs (consolidated from all five docs)

### 9.1 The SPOF — node + the founder
One machine concentrates CI + verify + the autonomy worker + deploy, owned by one person with no on-call.
**Bounded, not removed:** the off-node dead-man (hard precondition), the one-line `runs-on` rollback, durable-bus
state so any node is replaceable, a backed-up Supabase, and **a Linux reliability node added next** (§7.5). The
blast radius is small because no node holds essential state — but when the node is down at 2am, *the founder is the
on-call.* Mitigated, not removed until N≥3 with redundant capability coverage.

### 9.2 The solo-SRE tax (the standing surface, not the blast radius)
**Reversibility bounds blast radius — it does NOT reduce the number of things that can rot, the MTTR bounded by one
human, or availability now capped by that human's availability to repair** (challenge §1, AUTHORITATIVE). The
standing surface is **~14 components**, not "one machine": worker daemon · ephemeral runner (auto-updates, can
break) · colima+`postgres:16` (breaks on macOS upgrade) · Tailscale+ACL+`tests[]` · Healthchecks · the Windows
backup watchdog · the off-node status page · permanent staging (net-new) · key rotation · macOS updates ·
`pmset`/`caffeinate` that must survive updates · disk-prune/log-rotation · Supabase backup + proof-of-restore · M1
parity re-proof on every toolchain bump. **Honest estimate (the docs never gave one):** ~1–3 hrs/week steady, **but
the cost is variance, not mean** — spiky incidents dominate (a macOS update breaks colima → all merges blocked; a
FileVault reboot → outage until login; an ISP outage → autonomy paused), each hours-to-days, and **~half of these
toil sources are macOS-laptop-specific.** On Neo each is mitigated (colima pinned + autostarted, the
`authrestart` planned-reboot path, the battery-UPS, `pmset`/`caffeinate` re-asserted post-update — `06` §2). The
laptop-specific toil is *measured*, not just noted: **if laptop-specific ops toil exceeds 3 hrs/week over a rolling
4-week window, that is objective migration trigger 4b** (`06` §4) — move Node 1 to Linux, where this class largely
disappears, via node-registration.

### 9.3 The FileVault / keychain unattended-reboot gap (the most dangerous gap)
The security stream recommends FileVault ON; the node/HBM streams claim automatic post-reboot recovery; **nobody
reconciled them.** With FileVault ON, a power-blip/forced-restart leaves the disk locked at a pre-login screen and
**LaunchDaemons do not run until a human physically logs in** — the "minutes, automatic" RTO is *false* for the
dominant unattended event. A boot-time daemon reading a user-login keychain may also be locked even with FileVault
off. **Resolution (ADR HOST-1 = Neo; full detail `06` §3):** FileVault stays **ON** (Neo is a portable secret
store); the MacBook **battery is the built-in UPS** so power blips do not reboot at all; **planned reboots use
`fdesetup authrestart`** (the FileVault key is held in RAM for exactly one boot → unattended recovery for the
*dominant* reboot event, a macOS update); the **rare** unplanned reboot (kernel panic / battery fully drained)
takes an **explicitly-accepted manual-login RTO** — re-based from "minutes, automatic" to "minutes-to-hours,
founder-present," with the off-node watchdog **paging the founder to log in** so the RTO clock never starts late.
Boot-time secrets come from a **System keychain / file-with-strict-perms (`chmod 600`), never a user-login
keychain** — the root `LaunchDaemon` reads them at boot; `config-doctor --enforce` fail-closes a half-bootstrapped
node. A **cold-boot recovery test** is added to the validation plan (`06` §3): planned `authrestart` → assert
`/ready` green with no human; pull-power unplanned → assert the watchdog pages. The current plan only kills the
*process* (Tier 0), never the *machine*. **If a reboot-caused outage ever exceeds the agreed RTO, that is objective
migration trigger 4c** — move Node 1 to Linux (TPM/clevis/network-bound LUKS unattended boot), a node-registration
swap (`06` §4–§5), not a redesign.

### 9.4 The Supabase shared dependency
Supabase is a common-mode dependency under the runtime AND its primary observability (§5.4). A Supabase outage
simultaneously halts the runtime, **misattributes the page to "node down"** (the node is up; the bus is down), and
**blinds the rich observability**, leaving only two crude Supabase-independent signals (the Healthchecks dumb-timer
+ the Tailscale device list). Supabase is the crown jewel — back it up; its outage is provider-bound. **Fix:** the
Windows pull-watchdog probes `/health` (no DB) + Supabase directly to disambiguate node-fault from Supabase-fault.

### 9.5 The integrity-vs-availability watchdog gap
The dead-man defends against a **dead** node, not a **lying** one. The `/ready` gate is cooperative, not enforced —
a compromised node can suppress or fake the signal (§5.4, §6.5). **State explicitly:** the watchdog covers
availability, not integrity; detecting a lying node needs an unforgeable integrity signal (named, deferred).

### 9.6 Self-hosted-runner code-execution exposure
Low for solo private repos, **not zero** (compromised dependency, in-job token theft before teardown). Bounded by
ephemeral + non-admin user + ACL-sink + least-scope short-lived tokens + never-`pull_request_target`.
**Re-evaluate the instant a second contributor or public fork appears** (then VM-per-job isolation, or
untrusted-PR checks back to GitHub-hosted).

### 9.7 Operational rot over the long tail
The real failure mode is not setup — it's six-months-later silent rot ("runner offline and I didn't notice,"
"macOS updated and broke colima," "the token rotated and the daemon didn't reload," "Docker layers filled the
disk"). **Bounded on four fronts:** the off-node dead-man (turns silence into a ping — the single most important
control), the `/ready`-gated check-in (catches degraded-but-running), config-doctor fail-closed (refuses a stale
secret set), and the weekly-green digest (proves the alarm path is alive). **The honest residual: a solo founder is
now the SRE** — and a Linux node removes the macOS-update churn from the critical path.

> **Also carried (challenge §3):** the cost framing. The dominant drain is killed by a *free SaaS* (Healthchecks),
> not by a self-hosted Mac runner. "$0 marginal" omits net-new **permanent staging** spend, the **60× Supabase
> tick load** (cron `*/5` = 288/day → a 5s internal timer = 17,280/day, each an `engine_heartbeat` upsert + a
> SKIP-LOCKED scan against the pooler — real compute/connection-minute/pooler pressure that a free-tier project
> will throttle), and unpriced founder-time. Self-hosting *relocates* compute; the real bills (Supabase, Vercel)
> stand and staging adds to them. **Recommendation (§11): the tick cadence is a tunable — 5s is not free on
> Supabase; pick the interval that buys real liveness granularity without 60×-ing the bus load.**

---

## 10. Consolidated ADR index

| ADR | Source | Decision (one line) |
|---|---|---|
| **EN-1** | 01 ADR-001 | The execution node runs an **ephemeral** self-hosted GitHub Actions runner for required checks; GitHub keeps the event+gate plane, the node is the compute; required checks move by a one-line `runs-on` change. |
| **EN-2** | 01 ADR-002 | **launchd (macOS) / systemd (Linux)** is the process supervisor; **pm2 and cron are rejected** (the worker must own its clock). |
| **EN-3** | 01 ADR-003 | Accept the self-hosted-runner exposure for solo private repos, bounded by ephemerality + non-admin user + no-`pull_request_target` + scoped tokens + ACL egress, **with an explicit re-evaluation trigger** (second contributor / public fork). |
| **EN-4** | 01 ADR-004 | The **`runs-on` swap is the rollback contract** — no node move is a one-way door; adopt `runs-on: ${{ vars.CI_RUNNER }}` as a UI-flippable kill-switch; keep disabled GHA crons in SHADOW as a fallback. |
| **SEC-1** | 02 ADR-1 | **Tailscale (WireGuard mesh) is the foundational execution-layer fabric** — services bind the tailnet/`127.0.0.1`, never a public IP; SaaS stays off-tailnet as outbound TLS; Tailscale is the control plane, not the data plane. |
| **SEC-2** | 02 ADR-2 | **Tailscale SSH (keyless, ACL-governed) replaces host SSH keys; no public `sshd`**; `check`-mode on `root` for the prod-token node; a local-console fallback. |
| **SEC-3** | 02 ADR-3 | **Migrate break-glass from HMAC to Ed25519** so the signing key never lives on the execution node — the highest-leverage hardening; **do it before go-live.** |
| **SEC-4** | 02 ADR-4 | **`tag:external` is the network enforcement of the `data_class` trust boundary** — a future cloud node is quarantined by ACL; PII/SECRET physically cannot reach it. |
| **HBM-1** | 03 ADR-001 | **The dead-man's-switch lives OFF the node** (Healthchecks.io push) + a Windows-task pull backup — failure-domain independence; push beats pull (no inbound, unforgeable absence). |
| **HBM-2** | 03 ADR-002 | **No Prometheus/Grafana** — the durable Postgres bus IS the metrics store + an off-node Vercel status page + rotated logs; no second job, no shared failure domain. |
| **HBM-3** | 03 ADR-003 | **The dead-man check-in is GATED on `/ready`** — the ping proves *supervision*, not just *power* (catches degraded-but-running). A false page is strictly safer than a false silence. |
| **FEL-1** | 04 ADR-FEL-1 | **Durable-bus-backed replaceable nodes** — all state on the bus, no node holds essential RAM state; in-flight work between checkpoints is re-run (bounded by budget), not recovered. |
| **FEL-2** | 04 ADR-FEL-2 | **Constraint-first placement with a fail-closed trust gate** — gate on `data_class` eligibility first, optimize second; an empty eligible set is fail-closed (wait or halt-and-summon), never a silent downgrade. |
| **FEL-3** | 04 ADR-FEL-3 | **Asymmetric DR** — back up the database obsessively (PITR + off-provider dump), back up no node disk; recovery = restore DB + stand up a fresh node + re-vendor secrets + resume. |
| **FEL-4** | 04 ADR-FEL-4 | **Incremental, reliability-first fleet growth** (Linux → Mac Studio → cloud) — each justified by a real driver, reversible, never two at once. |
| **★ HOST-1 (FOUNDER-DECIDED 2026-06-30)** | 00 §1.3 / `06` | **Execution Node 1 = Neo (Apple Silicon MacBook).** Rationale: current stage, available hardware, operational cost, implementation velocity — a REVERSIBLE host-agnostic deployment choice, NOT an architectural one (the port makes Node 1 swappable with zero PO change). The challenge's TECHNICAL findings are ACCEPTED + incorporated as Neo risks + mitigations (§1.4, `06`); its host-RESEAT recommendation is SUPERSEDED. Migration of Node 1 to Linux/cloud is a future OPERATIONAL step, gated by the objective triggers in `06` §4, executed via node-registration (`ExecutionProviderPort`), not redesign. |
| **★ NEW — HOST-2 (Ed25519 timing)** | 00 / 05 cond. 5 | **Do ADR-SEC-3 (Ed25519) BEFORE go-live**, not "on the horizon" — a portable/always-on node is the worst place for a symmetric prod-signing key; and **treat the `VERCEL_TOKEN` as a co-equal prod-mutation path** (deploy author≠verifier / approval gate) + **bound the break-glass `(table,op)` set** + **state the dead-man covers availability, not integrity.** |
| **★ HOST-3 (FileVault resolution — RESOLVED for Neo)** | 00 §1.4 / `06` §3 | **The FileVault / login-keychain unattended-reboot contradiction is resolved on Neo:** FileVault stays ON (portable secret store); the MacBook battery is the built-in UPS; **planned reboots use `fdesetup authrestart`** (unattended recovery for the dominant reboot event); the **rare** unplanned reboot takes an explicitly-accepted **manual-login RTO** (watchdog pages the founder). Boot-time secrets come from a **System keychain / file-ACL, never a login keychain**. A **cold-boot recovery test** (planned-authrestart reboot → assert `/ready` green, no human; unplanned reboot → assert the watchdog pages) is a go-live M-gate (`06` §3, §5). A reboot-caused outage exceeding the agreed RTO is migration trigger 4c. |

---

## 11. Recommended installation order (M-pre → Mn, reversible + founder-gated)

Every step is independently reversible (one `runs-on` line or one daemon-unload). Founder ★ checkpoints touch the
merge/release floor. The 5 adversarial conditions are folded in as gates.

| Milestone | Action | Rollback (one line) | ★? |
|---|---|---|---|
| **M-pre** *(the host decision — RESOLVED: ADR HOST-1 = Neo)* | The host is decided (Neo). M-pre is now **Neo provisioning + the FileVault/reboot resolution + migration-trigger tripwires instrumented:** create the non-admin `ci-runner` user; **FileVault ON + System-keychain/file-ACL secrets (never a login keychain)** + the `fdesetup authrestart` planned-reboot procedure; `pmset`/`caffeinate`/App-Nap-exclusion + clamshell; pin + autostart colima; and **instrument the objective migration triggers** (`06` §4 — the toil log, the watchdog downtime/RTO record, the thermal/CI-duration metric, the battery-health probe, the offline-days tally, the repo-visibility/contributor watch). The **cold-boot recovery test** (`06` §3) is staged here, run at M4/M5. | revert provisioning; nothing is installed on the meter-path yet | **★** |
| **M0** *(the safety floor — must precede every meter-bearing move)* | Stand up the **off-node watchdog** (Healthchecks.io `/ready`-gated push + the Windows-task backup) and the **worker daemon** on the chosen host. **Price this "M0-only" world** (Healthchecks + worker, **NO runner**): it captures ~90% of the minutes saving by *deleting the cron*, with no self-hosted runner at all. **Pick the tick cadence deliberately** — 5s = 17,280 ticks/day = ~60× the cron load on Supabase; recommend a coarser interval (e.g. 15–30s) that buys real liveness granularity without 60×-ing the pooler. Pause the SHADOW + dead-man crons on GitHub. | re-enable the GHA cron | **★** |
| **M1** | Register the **ephemeral self-hosted runner**; add a `runs-on: [self-hosted, exec]` **non-required duplicate** of `ci`; **parity-prove byte-identical verdicts** vs GitHub-hosted on the same commit. *(If M0-only already returned the meter under budget, the runner must justify itself on its own merits — latency, neutral-hardware verify — not the minutes crisis it doesn't own.)* | delete the runner; required checks untouched | |
| **M2** | Flip the **non-binding** checks (`config-gate`, `deploy-gate-d7`, `scheduler-tiers`) to the node. | flip `runs-on` back | |
| **M3** | Flip the **binding** checks (`ci`/build-and-migrate, `migration-lint`, `gitleaks-scan`) to the node, **one at a time**, watching the required-check status. author≠verifier now physical. | flip back per check | **★** |
| **M4** | Wire the heartbeat layers to the worker (engine-tick + `engine_heartbeat`, `/health`+`/ready` tailnet-only, KeepAlive + log rotation, the GS slot). Run alongside the disabled GHA crons in SHADOW. **Add the cold-boot recovery test** (HOST-3) here. | unload the daemon; nothing depended on it | |
| **M5** | Move **deploy** to the node (founder Vercel token) + stand up **permanent staging**; make the post-deploy health gate **binding** (no `continue-on-error`). **Do Ed25519 + the deploy-token co-equal control BEFORE this lands as the standing path** (HOST-2). | deploy from Windows / founder click | **★** |
| **M6** | Ship the **`ExecutionProviderPort`** in delivery-os; register `windows-node1` + the exec-node adapter; route a real `verify`-kind job by policy; prove a 3rd **mock** adapter takes a job by changing only `placement_req`/labels (zero PO change). | the engine still runs single-executor (back-compat) | |
| **M7** | Repeat M1–M5 for **PLOS** (per-repo, independent). Add the **Linux reliability node** when its driver fires (§7.5) — or, if HOST-1 made Node 1 Linux, this is already the spine. | per-repo | |

---

## 12. Open decisions for the founder

1. **THE HOST — DECIDED (ADR HOST-1, 2026-06-30): Execution Node 1 = Neo (Apple Silicon MacBook).** No longer
   open. The challenge's technical findings are accepted + mitigated (§1.4, `06`); its host-reseat is superseded;
   migration to Linux/cloud is a future operational step gated by the `06` §4 triggers and executed by
   node-registration. The remaining open decisions below are *within* the Neo build.
2. **M0-only vs full-runner scope.** Does M0 (Healthchecks + worker daemon, no self-hosted runner) return the meter
   under budget on its own? If yes, the runner migration (M1–M3) must justify itself on latency + neutral-hardware
   verify, not the minutes crisis. **Decide whether to stop at M0 or proceed to the full runner.**
3. **The tick cadence.** 5s gives the finest liveness but is ~60× the cron load on Supabase (17,280 ticks/day, each
   a bus upsert + SKIP-LOCKED scan). **Pick the interval** (recommend 15–30s) that buys real granularity without
   straining the pooler / tripping the free tier.
4. **Ed25519 now?** ADR-SEC-3 keeps the prod-signing key off the execution node (a compromised node then cannot
   mint a grant). The challenge says **do it before go-live**, not "on the horizon" — *especially* if Node 1 is a
   portable laptop. **Decide whether to do Ed25519 (plus the co-equal deploy-token control) as a go-live
   precondition.**

---

## Appendix — provenance

This master document consolidates, without re-designing: NEO-ARCH-01 (node + CI/CD), NTS-DOS-v1 (tailnet +
security), NEO-HBM-v1 (heartbeat + monitoring), FEL-DOS-v1 (future layer), and EIB-DOS-v1 (the first-pass
blueprint) — incorporating the AUTHORITATIVE *technical* corrections of NEO-ADV-05 (the adversarial challenge):
the FileVault/keychain reconciliation, the M0-only pricing + 60× Supabase tick caveat, the
Neo-fault-vs-Supabase-fault watchdog disambiguation, the co-equal deploy-token treatment + bounded break-glass set,
the availability-not-integrity statement of the watchdog, and the residential-ISP availability ceiling. The
challenge's **host-RESEAT recommendation is SUPERSEDED by the founder decision ADR HOST-1 (Execution Node 1 = Neo,
2026-06-30)**; every technical finding it raised is retained as a Neo-specific risk + mitigation (§1.4) and owned
in build-ready form by `06-neo-node1-operations-and-migration.md` (Neo limitations + mitigations · the
FileVault/reboot resolution · the objective migration triggers · the host-swap runbook). Where this file disagrees
with a canonical source under `core/`, the canonical source wins — fix this file. **Installs nothing; a §11 panel
ratifies (author≠verifier) and a founder gate authorizes before any build; M-pre (Neo provisioning + the
FileVault/reboot resolution + the migration-trigger tripwires) and M0 (the off-node watchdog) precede every other
step.**

*End of NEO-ARCH-00 — the founder-facing master architecture + approval artifact. Design only.*
