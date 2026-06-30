---
artifact: NEO EXECUTION NODE ARCHITECTURE + CI/CD (Execution Node 1 of the Delivery OS execution layer)
id: NEO-ARCH-01
date: 2026-06-29
status: DESIGN — RESEARCH + ARCHITECTURE ONLY. Installs nothing, changes no infra, registers no runner, moves no secret. A founder build-authorization gate decides what is built and in what order.
extends:
  - docs/reviews/EXECUTION-INFRASTRUCTURE-BLUEPRINT-2026-06-29.md (EIB-DOS-v1 — the first-pass blueprint: Neo = ephemeral self-hosted runner + launchd worker; the ExecutionProviderPort; the cron-drain finding; GO-incrementally)
  - docs/reviews/RUNTIME-SPECIFICATION-2026-06-28.md (RS-DOS-v1 — the worker/queue autonomy host; the supervision tiers; §54 trust boundary)
forcing_function: GitHub-hosted Actions minutes EXHAUSTED. The metered execution provider can no longer be the spine. Neo (an Apple MacBook) becomes Execution Node 1 — the first non-Windows execution provider behind the port.
scope_guard: Deepens EIB-DOS-v1 sections A (Execution Node Architecture) and B (CI/CD Architecture) into a buildable, opinionated node design. Names actual tools + versions. Honest about what a solo founder can sustain. Designs for the multi-node future.
audience: the founder (decision), a future builder (the spec), and the §11 panel that gates the build.
---

# Neo — Execution Node 1: Architecture + CI/CD

> **One-paragraph thesis.** GitHub stays the *system of record and the event/gate plane* — PRs,
> required-check API, branch protection, CODEOWNERS. Neo provides the *compute*. Neo runs three things and
> nothing else: (1) an **ephemeral, non-admin, self-hosted GitHub Actions runner** for PR-triggered required
> checks; (2) a **launchd-managed worker daemon** that owns its own clock and drains the durable bus — the home
> the V-H finding demanded for the supervision tiers, killing the cron drain; (3) the **deploy executor** that
> holds the founder's Vercel token so the Hobby author rule is satisfied without a manual click. The Windows PC
> stays the interactive build/dev host. Build on Windows, **verify on Neo** — author≠verifier becomes *physical*
> (neutral hardware, D9) for the first time. Every move is reversible by one `runs-on` line or one `launchctl
> unload`. The whole thing is one machine owned by one person with no on-call — so an **off-Neo watchdog** is a
> hard precondition, not a nicety.

---

## 0. What this document adds over the blueprint (EIB-DOS-v1)

EIB-DOS-v1 established the *topology and the verdict* (two nodes, the port, GO-incrementally). This document is
the **buildable node design**: the exact responsibility map, the GitHub↔Neo CI/CD handshake at the signal level,
the runner-isolation model with the specific macOS controls, the pinned software stack with honest
Docker-Desktop-vs-colima and launchd-vs-pm2 trade-offs, the failure-recovery levers as operations, the scaling
path from 1 runner to N nodes, and four ADRs for the load-bearing choices. Where EIB-DOS-v1 said "do X," this
says "X is `command`, run as user `Y`, supervised by `Z`, and here is what breaks and how you roll it back."

---

## A. Execution Node Architecture

### A.1 The Neo responsibility map (capability → where it runs → process model)

The load-bearing discipline: **three roles, three substrates, one trust posture.** A capability is on Neo only
if it is *continuous* (wants an owned host) or *neutral-hardware-required* (verify). Everything interactive,
secret-personal, or last-resort stays off Neo.

| # | Capability | Runs where | Process model | Isolation | Rationale |
|---|---|---|---|---|---|
| 1 | Interactive build / headless Claude `/goal` sessions | **Windows (Node 1)** | the founder's terminal / `claude -p` | the dev user | Build is interactive + founder-present; no reason to move it. Neo *can* take a long-lane build later via the port (A.6). |
| 2 | Local pre-push gate (`.githooks/pre-push`) | **Windows** (and Neo, unchanged) | git hook, synchronous | the committing user | Machine-independent, travels in the repo; fires identically on either node (§1.3 EIB). |
| 3 | PR-triggered **required checks** (`ci`/build-and-migrate, `migration-lint`, `gitleaks-scan`, `config-gate`) | **Neo (Node 2)** | **ephemeral GH Actions runner** (one job → fresh runner → de-register) | dedicated non-admin user `ci-runner`; clean checkout per job | Event-driven; GitHub's check-status integration is worth keeping. Neutral hardware → author≠verifier physical. |
| 4 | The independent **VERIFY** + `machine_probe` (D9 binding gate compute) | **Neo** | same ephemeral runner, a `verify`-kind job | as #3 | A `verify` job *placed on a node the author (Windows) does not control* — author≠verifier on hardware, not just identity. |
| 5 | **Deploy executor** (Vercel `--prebuilt --prod` + Supabase migrate) | **Neo** | a job on the ephemeral runner holding `VERCEL_TOKEN` | least-scope deploy token; pooler creds injected as env | Vercel attributes deploy to the *token*, not the host → Hobby author rule satisfied, no manual click. |
| 6 | **The autonomy worker daemon** (engine-tick · PO-reconciler · goal-supervisor) | **Neo** | **launchd `LaunchDaemon`**, long-lived Node, `KeepAlive` | runs as `ci-runner` (or a sibling `dos-worker` user); secrets from Keychain | The V-H finding: the autonomy host is a *worker that owns its clock*, not a cron-of-an-LLM. $0 marginal → can tick at 5s. |
| 7 | **Test Postgres** (replaces GH `services: postgres:16`) | **Neo** | **colima** VM + `postgres:16` container, started per job or kept warm | container, torn down per job (or a fixed warm port) | Self-hosted mac has no free `services:` block; supply it. colima is lighter + license-free vs Docker Desktop. |
| 8 | **Permanent staging** (Vercel staging project + Supabase staging branch) | **Vercel + Supabase** (deployed *from* Neo) | a Neo deploy job on merge-to-`dev` | staging token/scope, separate from prod | Always-on staging is cheaper than per-PR previews; catches HE-1…HE-6. Neo deploys it; it does not *host* it. |
| 9 | **The dead-man's-switch** (watches the worker) | **OFF Neo** — Healthchecks.io (free) + a Windows Scheduled Task backup | external HTTP monitor + a Windows task | a different failure domain entirely | A watchdog must not share its target's hardware. A Neo outage must alarm, not silence both. |
| 10 | Secrets-of-record (CI/deploy) | **GitHub Actions Secrets** | injected as job env, never to disk | ephemeral runner = no persisted secret | Unchanged from hosted; the store stays GitHub's. |
| 11 | Worker daemon's own secrets | **macOS Keychain** (under the worker user) | read at process start | non-admin user, no personal Keychain access | The daemon is not a GHA job; it can't read Actions Secrets. Keychain is the macOS-native least-privilege store. |
| 12 | Durable bus / system state | **Supabase Postgres** (unchanged) | the existing run/step engine | network, not node-local | **No node holds essential RAM state.** This is what makes every node replaceable (A.7). |

**The line, stated as a rule:** *Neo runs what is continuous (the worker) or must be neutral (verify/CI) or is
token-attributed (deploy). Windows keeps what is interactive (build) and what is the independent last-resort
watchdog backup. The bus keeps all durable state. Nothing essential lives in any node's RAM.*

### A.2 What Neo explicitly does NOT do (the anti-scope, equally load-bearing)

- **Does not host the durable bus.** State stays on Supabase. Neo is replaceable precisely because it holds none.
- **Does not run the dead-man's-switch.** Same-hardware watchdog = no watchdog (HE-4 plan-clamp class). Off-Neo.
- **Does not authorize Class-C acts.** The runner *executes* an authorized deploy/merge; it never *decides* one.
  Merge-to-main and prod-deploy remain founder boundaries (RS-DOS §15). The `deployment-operator` agent's
  `.deploy-lane.json` scope rules still bind.
- **Does not run PR code with `pull_request_target`.** Ever. That is the one switch that turns the runner from
  "runs my code" into "runs an attacker's code with my secrets" (B.5).
- **Does not store personal secrets accessible to the runner user.** The `ci-runner` user has no access to the
  founder's login Keychain, browser profiles, SSH agent, or iCloud.
- **Does not become a single point of *state* failure** — only a single point of *compute* failure, which the
  one-line `runs-on` rollback to GitHub-hosted bounds (A.7, B.4).
- **Does not auto-update silently into a broken state** without the off-Neo monitor catching the resulting
  silence (the operational-rot risk, §Risks).

### A.3 The process model on Neo (the three supervisors, precisely)

Three independent process trees, deliberately not nested:

1. **The GH Actions runner agent** — installed via `./svc.sh install` which registers a **launchd LaunchAgent/
   Daemon** (`actions.runner.<owner>-<repo>.<name>`). Survives logout/reboot. With `--ephemeral`, the agent
   runs exactly **one** job then exits; a `KeepAlive` relaunch re-registers a fresh runner for the next job.
   This is the clean-per-job property that makes secret-persistence impossible between jobs.

2. **The worker daemon** — a `LaunchDaemon` (`com.deliveryos.worker`) with `KeepAlive=true`, `RunAtLoad=true`,
   running the engine `agent-runner.ts` drain loop plus internal interval timers for the supervision tiers. A
   `LaunchDaemon` (not Agent) runs **at boot, before any login** — correct, because the worker must run on a
   headless, logged-out Mac. It restarts on crash (launchd's job) and re-reads durable state on restart (the
   engine's job). No essential RAM state.

3. **colima** — `colima start` registers its own launchd agent (`com.colima` via the Homebrew service) so the
   Docker socket is up before a CI job needs `postgres:16`. Kept warm to avoid a cold-VM-boot tax on every job.

**Why launchd and not pm2/cron/tmux:** launchd is the macOS-native supervisor — it owns boot ordering, restart
policy, log redirection, and `KeepAlive`, with no extra daemon to itself supervise (the "who watches pm2"
regress). cron cannot keep a long-lived process alive (it *launches* per tick — the exact cron-of-an-LLM
anti-pattern). tmux/`nohup` die on reboot and have no restart policy. See ADR-002 + the honest stack table (§Stack).

### A.4 Resource isolation on Neo

| Boundary | Mechanism | Protects against |
|---|---|---|
| **User** | dedicated non-admin macOS user `ci-runner` (+ optionally a `dos-worker` sibling); no admin, no sudoers, no personal Keychain | a job/daemon compromise reaching the founder's data/credentials |
| **Per-job filesystem** | ephemeral runner = clean `_work` checkout each job; `--ephemeral` de-registers after one job | secret/artifact bleed between PRs; a poisoned workspace persisting |
| **Test DB** | colima VM (a Linux guest, not the host) + a container torn down per job | a test migration touching anything real; `postgres` data on the host disk |
| **Network egress** | Tailscale ACL: `tag:ci-runner` → outbound to GitHub/Vercel/Supabase **only**; no inbound except founder + health monitor | exfiltration to an arbitrary host if a dependency is compromised |
| **Sleep/thermal** | `sudo pmset -a sleep 0 disablesleep 1` + `caffeinate -dimsu` on the daemon; lid-closed-clamshell with power | the Mac sleeping mid-job/mid-drain and silently stalling the fleet |
| **Disk** | a weekly `docker system prune` + colima disk cap; log rotation on the daemon | Docker layers / job logs filling the disk (a classic self-hosted-rot failure) |

### A.5 What stays on Windows vs moves to Neo (the split, decided)

| Stays on **Windows (Node 1 / dev)** | Moves to **Neo (Node 2 / verify+CI+autonomy)** |
|---|---|
| Interactive `/goal` build sessions, the founder's terminal | PR required checks (ci, migration-lint, gitleaks, config-gate) |
| The local pre-push gate (also runs on Neo unchanged) | The independent VERIFY + `machine_probe` (neutral hardware) |
| Git push (origin = GitHub) | The deploy executor (Vercel token + Supabase pooler) |
| A *backup* dead-man's-switch (Windows Scheduled Task) | The autonomy worker daemon (engine-tick · reconciler · goal-supervisor) |
| Founder ops + decisions | The test Postgres (colima) |

**Neo is not a replacement for Windows; it is a second, neutral, always-on node.** The two-node split is what
makes author≠verifier physical — the same reason you do not let the author run their own CI on their own box.

### A.6 The forward-looking seam: the `ExecutionProviderPort`

This node design is the **first concrete adapter** of the port specified in EIB-DOS-v1 §9 (the buildable form of
RS-DOS §46 I-Placement). Neo is registered as `neo-node2` with labels `["self-hosted","macos","neo","pg",
"vercel-token"]` and `trustDomain: "trusted"`. Windows is `windows-node1` (build). The selector places a
`verify`-kind job on a *different* node than the `build`-kind job **by policy** — that is how author≠verifier is
enforced at the placement layer, not by convention. **Building Neo correctly = building the port's first real
proof.** A third node (Linux, Mac Studio, cloud) is then a registration, not a migration (§Scaling).

### A.7 The DR property this architecture buys

Because **state is 100% on the durable Supabase bus** and **no node holds essential RAM state**, every node is
replaceable. A Neo crash → launchd restarts the daemon + runner → they re-read durable state → resume; a leased
step whose worker died is reclaimed by the next drainer (no double-execute — the lease + idempotency store).
A Neo *death* (hardware) → fail back to GitHub-hosted by flipping `runs-on` (B.4), bring the worker up on
Windows or a Mac Studio via the port. **The one irreplaceable thing is the Supabase database — back it up.**
That is the actual crown jewel, not the node.

---

## B. CI/CD Architecture

### B.1 The division of labor: GitHub is the plane, Neo is the compute

| Concern | Owner | Why it stays there |
|---|---|---|
| PRs, commits, the merge event | **GitHub** | the system of record; we do not leave GitHub |
| Required-check **status API** | **GitHub** | branch protection reads it; the gate *verdict* is GitHub's |
| **Branch protection + CODEOWNERS** | **GitHub** | author≠verifier is a *platform invariant* enforced at the PR, not on a runner |
| The `verify-coverage` binding status | **GitHub** | D9: the *gate* is GitHub's; the *compute* is Neo's |
| **Compute** for every check/build/deploy | **Neo** | we stop renting GitHub's CPU; we keep its event + gate plane |
| Scheduled supervision (the tiers) | **Neo worker daemon** | continuous → owned host, not cron |
| Secrets store (CI/deploy) | **GitHub Actions Secrets** | injected to the runner the same way hosted gets them |

**The principle:** *never leave GitHub; stop renting GitHub's CPU.* GitHub remains the event source and the gate;
Neo is a faithful substrate that produces byte-identical gate verdicts (the M1 parity proof, EIB §15).

### B.2 The GitHub ↔ Neo handshake (the signal-level flow)

```
 ┌─ Windows (dev) ─┐                 ┌──────────────── GitHub (plane) ───────────────┐                 ┌──── Neo (compute) ────┐
 │ build a slice   │                 │                                               │                 │                       │
 │ pre-push gate ✔ │ ── git push ──▶ │  PR opened / synchronized → workflow_run     │                 │                       │
 └─────────────────┘                 │  job has `runs-on: [self-hosted, neo]`        │                 │                       │
                                     │            │ enqueue job (long-poll)          │                 │                       │
                                     │            └──────────────────────────────────┼── HTTPS poll ──▶│ ephemeral runner picks │
                                     │                                               │   (outbound;    │   up ONE job, gets a   │
                                     │                                               │    no inbound   │   job-scoped token      │
                                     │                                               │    port open)   │                       │
                                     │                                               │                 │ runs: ci / verify /    │
                                     │  check-run status ◀───────────────────────────┼── status API ──┤   migration / gitleaks │
                                     │  (pending→success/failure)                    │                 │   (colima pg up)       │
                                     │            │                                  │                 │ runner EXITS, de-      │
                                     │  branch protection reads required checks      │                 │   registers (ephemeral)│
                                     │            │ all green + CODEOWNERS review     │                 │                       │
                                     │            ▼                                  │                 │                       │
                                     │  founder approves → merge to main (Class-C ★) │                 │                       │
                                     │            │ push: main → deploy.yml          │── poll ────────▶│ deploy job: vercel     │
                                     │            │                                  │                 │   --prebuilt --prod    │
                                     │  deployment_status ◀───────────────────────── │◀── token ───────┤   (founder VERCEL_TOKEN)│
                                     │            │ → prod-smoke (binding health)    │                 │ + supabase migrate     │
                                     └───────────────────────────────────────────────┘                 └───────────────────────┘
                                                                          │
                                    OFF-PLANE: the worker daemon on Neo drains the bus on its OWN clock
                                    (engine-tick · reconciler · goal-supervisor) — NOT triggered by GitHub at all.
                                    Watched by Healthchecks.io (off-Neo) → SMS/email the founder on silence.
```

**The key handshake fact (and a security property):** the runner **long-polls *outbound* to GitHub** for work.
GitHub never connects *in* to Neo. **No inbound port is opened; no public IP is exposed.** This is why a
self-hosted runner is reachable from a laptop behind NAT with zero network configuration, and why the Tailscale
ACL can be inbound-deny for `tag:ci-runner`.

### B.3 The three pipelines, on the new substrate

#### B.3.1 Build pipeline
- **Windows** is the interactive build host. A headless `/goal` session produces a slice + commit; the
  **machine-independent pre-push gate** (`.githooks/pre-push` — verify-gate, os-drift, agents-check,
  hook-paths) runs locally before the push reaches GitHub.
- Once the port is live, a **long-lane build** can be *placed on Neo* (`placement_req.lane: "long"`) so it does
  not tie up the founder's terminal — a `placement_req` change, no code change.

#### B.3.2 Verification pipeline (the floor)
- The binding required checks move to `runs-on: [self-hosted, neo]` — **one line changed per workflow.** The
  logic (Node 20/22 + `postgres:16` + gitleaks v8.18.4) is platform-agnostic. The rumah-admin `ci` job's 20+
  steps (typecheck → fresh migrate → idempotent re-migrate → up/down/up rollback proof → gated migrate → test →
  skills/agents/dispatch/route/seam/lifecycle/workflow/quality/experience/slice gates → learning gate) run
  unchanged against the colima `postgres:16` (A.1 #7).
- **The binding verify-gate (D9) is preserved and strengthened:** `verify-coverage` + branch protection +
  CODEOWNERS stay on GitHub; the `machine_probe` re-runs on Neo — **a node the author (Windows) does not
  control.** This is a net security *upgrade* over today's same-pool execution.
- **Parity is a gate, not an assumption (M1):** before flipping a *binding* check to Neo, run it on Neo under a
  non-required name and confirm a **byte-identical verdict** vs GitHub-hosted on the same commit. Only then flip.
- The `engine-ownership` job (which checks out sibling delivery-os via `DELIVERY_OS_REPO`/`DELIVERY_OS_TOKEN`)
  runs on Neo identically — and on Neo the **sibling checkout is local**, so the currently-skipped
  `capability-health` + `census-detector` steps can become *real* (a side-benefit of the move).

#### B.3.3 Deployment pipeline (Vercel + Supabase, identity-respecting)
- The deploy runs on the **Neo runner holding the founder's `VERCEL_TOKEN`** + `VERCEL_ORG_ID`
  (`team_1CSTFxqvnOe9lvHtCsPHSeax`) + `VERCEL_PROJECT_ID`. PLOS `deploy.yml` already proves the pattern:
  `vercel deploy --prebuilt --prod --token=…` does **no actor check** — the *token* carries the identity. So a
  Neo deploy lands **attributed to bkasanwiredjo without a manual click** (resolves MEMORY:
  plos-vercel-deploy-identity-constraint). Pin `vercel@48.12.1` (the API floor is ≥47.2.2). Keep the existing
  pre-build `config-doctor --env production` gate and the project-Node-pin PATCH.
- **Supabase:** migrations via the **session pooler (5432)**; app via the **transaction pooler (6543)** with
  `prepare:false`. **Neo is IPv4** — it *must* use the pooler, never the IPv6-only `db.<ref>.supabase.co:5432`
  direct host (skill `deploy-vercel-supabase`). Forward-only, expand/contract, applied before code.
- **Fix the known soft spot:** PLOS's post-deploy health verify is `continue-on-error: true` — on Neo, make the
  post-deploy health gate **binding** (RS-DOS C19 prod rung: "no continue-on-error"). A staging rung makes this
  safe to harden.
- **Class-C stays a founder boundary.** The runner *executes* an authorized deploy; it does not *authorize* it.

#### B.3.4 Permanent staging (new)
- Stand up a persistent **Vercel staging project + a dedicated Supabase staging branch** (same plan/scope/pooler
  *shape* as prod — the HE-1…HE-6 catch surface). Neo deploys to staging on every merge-to-`dev`; prod stays
  state-gated. Always-on staging is **cheaper than per-PR ephemeral previews** (which multiply minutes/builds).

### B.4 Failure recovery + rollback levers (the operations)

| Lever | Mechanism | RTO | When |
|---|---|---|---|
| **The `runs-on` swap** (the headline lever) | change `runs-on: [self-hosted, neo]` → `runs-on: ubuntu-latest` in the workflow, commit, push | minutes (1 line) | Neo offline/dead, or a runner-env regression. The whole CI floor falls back to GitHub-hosted. |
| **Per-check rollback** | flip *one* check's `runs-on` back while leaving the others on Neo | minutes | a single check is flaky on Neo; isolate it without abandoning the move |
| **Matrix/fallback `runs-on`** (later) | `runs-on: ${{ vars.CI_RUNNER }}` — a repo variable flips the *entire* fleet hosted↔Neo with no diff | seconds | a kill-switch you can flip from the GitHub UI without a commit |
| **Worker daemon restart** | launchd `KeepAlive` auto-restarts on crash; re-reads durable state | seconds–minutes (auto) | daemon crash/OOM |
| **Worker daemon unload** | `launchctl bootout system/com.deliveryos.worker` | seconds | a bug-loop; the GHA crons are still present (disabled, in SHADOW) to re-enable as a fallback |
| **colima restart** | `colima restart` (the Homebrew service relaunches it) | seconds | Docker socket wedged after a macOS update |
| **Token rotation** | rotate via the config platform (`infra/config-doctor.mjs` + registry); ephemeral runner means no stale secret persists | minutes | suspected token leak |
| **Supabase restore** | restore from backup (the *only* unrecoverable-by-re-registration loss) | provider-bound | DB corruption/loss |

**The reversibility principle:** every migration step (EIB §12 M0–M7) is independently reversible by reverting
one `runs-on` line or one `launchctl unload`. Nothing about the Neo move is a one-way door. *That reversibility
is what makes the SPOF acceptable for a solo founder* — without it, this design would be a no.

### B.5 The runner-isolation model (the decided posture)

**The threat, named plainly.** A self-hosted runner that executes PR code is the classic foot-gun: a malicious PR
runs arbitrary code on *your* hardware and can read the job's secrets / the machine's environment. The canonical
GitHub guidance is **"do not use self-hosted runners on public repositories."** These are **solo, private repos
with no external contributors** — so the *primary* vector (a stranger's fork PR) does not exist today. The
residual is real but bounded: a compromised npm dependency, or a future second contributor.

**The decided controls (defense in depth):**

1. **Ephemeral runners (`--ephemeral`)** — every job gets a fresh runner that **de-registers after one job.** No
   secret, no checkout, no artifact persists to the next job. This is the single highest-leverage control.
2. **A dedicated non-admin macOS user** (`ci-runner`) — no admin rights, no sudoers entry, **no access to the
   founder's personal Keychain**, browser profiles, SSH keys, or iCloud. A job compromise is contained to a
   sandboxed user with nothing valuable in reach.
3. **Never `pull_request_target`** on the self-hosted runner — that trigger runs *base-repo* secrets against
   *fork* code and is the documented exfiltration path. Required checks trigger on `pull_request` only. This is
   an absolute rule (A.2), enforced by review of every workflow change.
4. **Least-scope, short-lived tokens** — the job's `GITHUB_TOKEN` is job-scoped and auto-expires; the
   `VERCEL_TOKEN` is deploy-scoped; the supervisor's metric-probe identity is read-only (RS-DOS §7.2). **No
   long-lived god token on Neo.**
5. **Tailscale ACLs** — `tag:ci-runner` gets **outbound-only** to GitHub + Vercel + Supabase; **no inbound**
   except the founder + the health monitor. Tailnet-lock on; Tailscale SSH (no exposed sshd) for ops.
6. **Pinned action SHAs + a lockfile-only install** — pin third-party Actions to a commit SHA (not a moving
   tag); `npm ci` against the committed lockfile (no `npm install` resolving fresh). gitleaks (v8.18.4) already
   guards committed secrets; Dependabot/`npm audit` guards the dependency vector.

**The honest residual (do not pretend otherwise):** for a *solo private repo* the exposure is **low but not
zero** — a compromised dependency could run in the job and reach the job's injected secrets before the ephemeral
runner is torn down. The mitigations shrink the blast radius (sandboxed user, short-lived scoped tokens,
egress-restricted) but do not eliminate it. **Re-evaluate the moment a second contributor or a public fork
appears** — at that point the posture must harden (or move untrusted-PR checks back to GitHub-hosted, which is a
one-line `runs-on` away). See ADR-003.

### B.6 Artifact handling
- **Build artifacts** (the Vercel prebuilt `.vercel/output`, `.next` cache): produced on Neo, consumed by the
  same Neo deploy job — no cross-runner transfer needed for the common path. Where a downstream job needs them,
  use `actions/upload-artifact@v4` / `download-artifact` (works identically on self-hosted).
- **Verify evidence** (the `VERIFY-<slice>.md`, `machine_probe` logs, `impl_fingerprint`): the load-bearing
  artifacts. They return on the **durable bus** as the port's `ExecutionOutcome.evidenceRef` (EIB §9.5), not as
  ephemeral CI artifacts — so they survive the runner's de-registration. The `machine_probe` log must record
  `node: neo-node2` to *prove* physical author≠verifier (the M3 proof).
- **Caches** (`~/.npm`, pnpm store, `.next`): on an *ephemeral* runner these don't persist between jobs by
  default. Use `actions/cache@v4` (GitHub-hosted cache backend, still free) for npm/pnpm to claw back the speed
  that ephemerality costs — the cache is content-addressed and safe to share, unlike a persistent workspace.
- **Test DB**: never an artifact — torn down per job (the colima container), so no test data can leak forward.

### B.7 Scaling strategy: 1 runner → a pool → multi-node

| Stage | Trigger to advance | Shape | Cost |
|---|---|---|---|
| **S1 — one ephemeral runner** | start here | one `--ephemeral` runner on Neo; the job queue serializes naturally | $0 marginal |
| **S2 — a runner pool on Neo** | check *latency* hurts (PRs queue behind each other) | 2–3 ephemeral runners on the same Mac, parallel jobs; labels unchanged | $0 marginal (bounded by Neo's cores/RAM) |
| **S3 — a second physical node** | Neo is saturated, or you want HA, or a non-mac toolchain | register `linux-node3` (cheapest, Docker-native, no macOS-update churn) with its own labels; the selector load-balances by queue-depth | one-time setup; ~$0 marginal |
| **S4 — N nodes behind the port** | portfolio scale (PLOS + admin + future repos) | the `ExecutionProviderPort` registry grows; the Placement Selector goes from "the one eligible node" to "balance across N by queue-depth/cost" (RS-DOS §45 I-Resource) | one-time per node |
| **S5 — burst to cloud** | sustained overflow | a `cloud-node5` with `trustDomain: external`; the `data_class` gate **refuses PII/SECRET on it, fail-closed** (EIB §9.4 / RS-DOS §54.2) | metered, but only for burst |

**The architecture does not change as N grows; the registry gets longer.** That is the entire payoff of the port:
adding capacity is *registering an adapter*, never re-architecting the pipeline. The first move (Neo as
`neo-node2`) is the proof that the registry-not-rebuild property holds.

---

## Recommended software stack (with honest pros/cons)

| Layer | Recommendation | Pin | Honest trade-off |
|---|---|---|---|
| **Runner agent** | GitHub `actions/runner`, `--ephemeral`, installed as a launchd service via `svc.sh` | track GitHub's release (it auto-updates) | Auto-update is convenient but *can break* — a bad runner release silently fails jobs. The off-Neo monitor + the `runs-on` fallback are the safety net. Org-level vs repo-level: **repo-level first** (least blast radius for solo repos); go org-level only when 3+ repos share runners. |
| **Container runtime** | **colima** (`colima start --cpu 4 --memory 8`) + the `docker` CLI via Homebrew | `colima` latest, `postgres:16` (match CI) | colima is **lighter, free, scriptable, no GUI, no licensing** — correct for a headless CI host. **Cons:** it's a Lima VM (a layer of indirection); `colima` sometimes breaks across a macOS major upgrade (a known rot vector — caught by the health monitor). **Docker Desktop** is more turnkey + better-supported but **heavier, GUI-oriented, and license-encumbered for commercial use** — wrong for a headless daemon host. **Decision: colima.** |
| **Process supervisor** | **launchd** (native) — `LaunchDaemon` for the worker + colima, the runner's own `svc.sh`-installed agent | n/a (OS) | launchd is **native, boots-before-login, no extra daemon to supervise, owns restart policy + log redirection.** **Cons:** plist XML is fiddly; `launchctl` UX is arcane. **pm2** has a nicer UX + built-in log rotation/metrics but is **itself a Node process that must be kept alive** (who watches pm2? → launchd anyway) and adds a dependency. **Decision: launchd**, with pm2 explicitly rejected (ADR-002). |
| **Job/queue runner** | the existing engine **`agent-runner.ts` drain loop** (SKIP-LOCKED + lease over the Supabase bus) — *not a new queue tech* | the delivery-os runtime version | **Reuse, not rebuild.** No Redis/BullMQ/SQS — the durable Postgres bus *is* the queue (transactional outbox + level-triggered pull, ECR-0006). **Con:** Postgres-as-queue has a contention ceiling at portfolio scale (read-replicas/partition later, deferred-until-pulled). **Pro:** one fewer system to run; crash-safety already built. |
| **Mesh / connectivity** | **Tailscale** (WireGuard) — MagicDNS names (`neo-node2`), ACLs-as-code, Tailscale SSH, tailnet-lock | latest | Zero-config NAT traversal, no opened ports, stable per-node identity, future-node-join is a *join* not a network project. **Con:** a dependency on Tailscale's coordination server (but node↔SaaS traffic over public TLS is unaffected if the tailnet is down — only founder ops-SSH degrades). |
| **Off-node watchdog** | **Healthchecks.io** (free tier) pinging `/v1/health/platform` → SMS/email on silence + a **Windows Scheduled Task** backup running the same `dead-man-switch.mjs` | n/a | Free, genuinely external failure domain, zero GitHub minutes. The redundancy (Healthchecks + Windows task) covers Healthchecks itself going dark. |
| **Node toolchain** | Node 22 (LTS) + npm/pnpm matching each repo's `packageManager` | Node 22.x (PLOS pins 22; admin pins 20 — **match per-repo**) | Must match CI exactly or you get works-on-Neo-fails-on-hosted drift. Pin per repo. |
| **Secret stores** | GitHub Actions Secrets (CI/deploy) + macOS Keychain (the daemon, under the worker user) | n/a | Two stores by necessity (a launchd daemon can't read Actions Secrets). Both least-privilege; neither in the repo (gitleaks-enforced). |
| **Deploy CLI** | Vercel CLI `48.12.1` (pinned) + Supabase via the pooler | `vercel@48.12.1` | Pinned deliberately (the API floor is ≥47.2.2; `@latest` drifts). Bump intentionally. |

---

## ADRs (the load-bearing choices)

### ADR-001 — Neo runs an *ephemeral* self-hosted GitHub Actions runner for required checks
- **Context.** GitHub-hosted minutes are exhausted; the metered provider cannot be the spine of continuous,
  portfolio-scale execution. GitHub remains the best event + gate + status-API plane. We need to keep the plane
  and move the compute.
- **Decision.** Register an **ephemeral, non-admin self-hosted runner on Neo** for PR-triggered required checks
  and deploys. GitHub stays the system of record, required-check API, branch protection, and CODEOWNERS; Neo is
  the compute. Required checks move via a **one-line `runs-on` change** per workflow.
- **Consequences.** (+) $0 marginal compute; author≠verifier becomes *physical* (verify on a node the author
  doesn't control); the gate plane is unchanged so branch protection still binds. (−) Neo is now a compute SPOF
  (bounded by the `runs-on` fallback, ADR-004); self-hosted-runner code-execution exposure (bounded by ADR-003);
  the founder is now the SRE for the runner agent. **Reversible** by reverting one `runs-on` line.

### ADR-002 — launchd is the process supervisor; pm2/cron are rejected
- **Context.** The worker daemon + colima + the runner must survive reboot/logout on a headless Mac, restart on
  crash, and need no babysitting supervisor of their own.
- **Decision.** Use **launchd** (`LaunchDaemon`, `KeepAlive=true`, `RunAtLoad=true`) for the worker and colima;
  the runner uses its own `svc.sh`-installed launchd agent. **Reject pm2** (a Node process that itself needs
  supervising → who-watches-pm2 regress) and **reject cron** for the worker (cron *launches* per tick — the exact
  cron-of-an-LLM anti-pattern the V-H finding forbids; the worker must *own its clock*).
- **Consequences.** (+) Native, boots-before-login, single supervision layer, OS-owned restart policy. (−) plist
  XML + `launchctl` are arcane; less ergonomic logs than pm2 (mitigated by explicit log redirection + rotation in
  the plist). **The worker can tick at 5s because there is no per-invocation meter** — the whole reason to leave
  cron.

### ADR-003 — accept the self-hosted-runner exposure for solo private repos, with ephemerality + sandboxing + a re-evaluation trigger
- **Context.** Self-hosted runners executing PR code are the canonical foot-gun; GitHub says don't use them on
  *public* repos. These are *private, solo, no-external-contributor* repos.
- **Decision.** Accept the exposure **for now**, bounded by: ephemeral runners (clean per job, no persisted
  secret), a dedicated non-admin user with no personal-Keychain access, never `pull_request_target`, least-scope
  short-lived tokens, Tailscale egress-restriction, and pinned action SHAs + lockfile installs. **Set an explicit
  re-evaluation trigger: the moment a second contributor or a public fork appears, harden the posture or move
  untrusted-PR checks back to GitHub-hosted** (a one-line `runs-on` away).
- **Consequences.** (+) The primary vector (a stranger's fork PR) does not exist today; the residual (compromised
  dependency) is bounded by the sandbox + ephemerality. (−) The residual is **low but not zero** — honest. The
  control that makes it acceptable is reversibility: untrusted work can leave Neo instantly.

### ADR-004 — the `runs-on` swap is the rollback contract; no Neo move is a one-way door
- **Context.** A solo founder concentrating CI + verify + autonomy + deploy on one machine with no on-call needs
  every step to be reversible.
- **Decision.** **Every migration step is reversible by reverting one `runs-on` line or one `launchctl
  unload`.** Adopt a repo-variable `runs-on: ${{ vars.CI_RUNNER }}` (default `ubuntu-latest`) as a UI-flippable
  kill-switch once the move is stable. Keep the (disabled) GHA crons present in SHADOW so the worker tiers have a
  documented fallback.
- **Consequences.** (+) The SPOF is bounded by an instant fall-back to GitHub-hosted; the migration can proceed
  incrementally (EIB M0–M7) with confidence. (−) GitHub-hosted is the fallback, which *costs minutes* — so the
  fallback is a temporary bridge, not a destination (you still need Neo back up). The off-Neo watchdog is what
  turns "Neo silently died" into "the founder got a ping."

---

## Risks + trade-offs (the honest verdict)

1. **SPOF = Neo + the founder.** One machine concentrates CI + verify + the autonomy worker + deploy, owned by
   one person with no on-call. **Bounded, not removed:** the off-Neo dead-man's-switch (a hard precondition), the
   one-line `runs-on` rollback to GitHub-hosted, durable-bus state so any node is replaceable, a backed-up
   Supabase. The *blast radius* is small because no node holds essential state — but when Neo is down at 2am,
   *you are the on-call.*
2. **Self-hosted-runner code-execution exposure** (ADR-003). Low for solo private repos, **not zero**
   (compromised dependency, token theft in-job before teardown). Bounded by ephemerality + a sandboxed user +
   scoped short-lived tokens + egress restriction + never-`pull_request_target`. **Re-evaluate the instant a
   second contributor or public fork appears.**
3. **Operational rot over the long tail** — the real failure mode is not setup, it's six-months-later: "the
   runner went offline and I didn't notice," "macOS updated and broke colima," "the token rotated and the daemon
   didn't reload," "Docker layers filled the disk." **Bounded by:** the off-Neo uptime monitor (turns silence
   into a ping — the single most important control), the config-doctor fail-closed gate (refuses a stale secret
   set), disk-prune + log-rotation, and the `runs-on` fallback. The honest residual: **a solo founder is now the
   SRE.**
4. **macOS as a CI host is heavier than Linux** — colima across a macOS major upgrade is a known break point; the
   Mac must be kept awake (`pmset`/`caffeinate`) and must rejoin Tailscale after reboot. **Mitigation path:** the
   first scale-out node (S3) should be a **Linux box** (Docker-native, no macOS-update churn) precisely to retire
   this class of toil for the bulk of CI, leaving Neo for macOS-specific or verify work.
5. **Parity drift** — a check that passes on Neo but would fail on hosted (or vice-versa) corrupts the gate.
   **Bounded by:** the M1 byte-identical-verdict parity proof *before* flipping any binding check, pinned
   toolchain versions matched per-repo, and `postgres:16` pinned to match CI.
6. **GitHub minutes are still the fallback cost** — falling back to hosted under a Neo outage burns the very
   minutes we left. So the fallback is a *bridge*, not a home; the operational goal is to keep Neo healthy, with
   the monitor as the early-warning. Honest, not free.

**Net verdict (carried + deepened from EIB §13):** **GO, incrementally, with the off-Neo watchdog as a hard
precondition.** Self-hosting is *correct* because the workload is continuous supervision — a metered substrate
charges for that forever and caps it arbitrarily, and the V-H finding *requires* a worker that owns its clock,
which wants a host you control. The architecture (durable bus, no RAM state, the port, the one-line rollback)
makes the blast radius of Neo failure small and every step reversible. That reversibility — not the absence of
risk — is what makes the operational burden acceptable for a solo founder. Without the rollback lever and the
independent watchdog, this would be a no.

---

## Build order (pointer — the reversible path, from EIB §12)

M0 stop the cron bleed (off-Neo watchdog up first) → M1 register the ephemeral runner + parity-prove a
non-binding `ci` clone → M2 flip non-binding checks → M3 flip binding checks one at a time (★ founder gate) → M4
stand up the worker daemon alongside the (disabled) crons → M5 move deploy + stand up permanent staging (★
founder gate) → M6 ship the `ExecutionProviderPort` + register `windows-node1`/`neo-node2` → M7 repeat for PLOS.
Each step reverts with one line. **M3 and M5 are founder ★ checkpoints** (they touch the merge/release floor).
