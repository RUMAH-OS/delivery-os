---
artifact: AUTOMATION STRATEGY — the Delivery OS Execution Infrastructure (every operational activity, classified, with the manual/semi items challenged to automation)
id: NEO-AUTO-08
date: 2026-06-30
status: DESIGN — READ-ONLY. Installs NOTHING, registers no timer, rotates no secret, runs no update, flips no kill-switch. It enumerates every operational activity across the Execution Infrastructure + platform lifecycle, classifies each (fully-automated · semi-automated · founder-approval-required · manual-by-necessity), CHALLENGES every manual/semi item against "can this be automated?", and designs the self-healing / auto-update / scheduled-maintenance mechanisms. A founder gate + §11 panel authorize any build.
forcing_function: The founder's goal — **spend time building products, NOT maintaining infrastructure.** The challenge (NEO-ADV-05 §1) costed the solo-SRE tax at ~1–3 hrs/week steady-state but VARIANCE-dominated (spiky incidents — colima break, FileVault reboot, runner break — each hours-to-days). Reversibility bounds blast radius; it does nothing to reduce the *standing surface* or the *toil*. This document attacks the toil directly: after one-time setup, every repetitive operational task is automated where reasonable, and the only standing manual work is the intentional founder-approval set.
extends:
  - docs/architecture/neo/00-ARCHITECTURE-execution-layer.md (NEO-ARCH-00 — the consolidated architecture; §9.2 the ~14-surface solo-SRE tax; §11 the M-pre→Mn order)
  - docs/architecture/neo/01-execution-node-and-cicd.md (NEO-ARCH-01 — the node, the runner, the launchd model, the rollback levers B.4)
  - docs/architecture/neo/03-heartbeat-and-monitoring.md (NEO-HBM-v1 — the 7-layer heartbeat, the off-node watchdog, the 7-tier recovery ladder §6)
  - docs/architecture/neo/05-adversarial-challenge.md (NEO-ADV-05 — the ~14 standing surfaces §1; the silent-rot class; the cost caveats)
  - docs/architecture/neo/06-neo-node1-operations-and-migration.md (NEO-OPS-06 — Neo limitations + mitigations §2; the FileVault/reboot resolution §3; the migration triggers §4)
governing_invariant: Class-C acts (merge-to-main, prod-deploy authorization) stay founder boundaries (NEO-ARCH-00 §2.1 anti-scope). Automation NEVER crosses a governance boundary; it removes TOIL, not GATES. An auto-update or self-heal that can act unattended MUST be reversible + health-gated, or it becomes a new silent-rot vector (the meta-risk, §7).
audience: the founder (the decision — "what is left for me to do?"), a future builder (the spec), the §11 panel that gates the build.
---

# Automation Strategy — The Delivery OS Execution Infrastructure (NEO-AUTO-08)

> **One-paragraph thesis.** The founder wants to build products, not babysit a node. The architecture (00–06) already
> makes the node *cattle* — no node holds essential state — so most recovery is already automatic (launchd KeepAlive,
> lease-reclaim, dead-letter quarantine). This document goes the rest of the way: it enumerates **~80 operational
> activities** across the whole lifecycle, classifies each, and then **challenges every manual and semi-automated
> item** — moving ~15 of them from "the founder does it" to "a launchd timer / a self-healing loop / a canary-gated
> auto-update / a watchdog-triggered failover does it, and only *pages* the founder when it genuinely can't."
> The line we hold: the **only** things that stay manual are (a) the irreducible one-time setup — install macOS,
> install software, one-time auth — and (b) the **intentional founder-approval gates** the governance model
> *requires* a human to say yes to (merge-to-main, prod-deploy authorization, break-glass, a HALT decision, a
> host-migration call). Everything else is automated, reversible, and health-gated. The honest residual after full
> automation is **minutes-per-week of digest-glancing plus event-driven approval clicks** — with the founder still
> the sole on-call for the *rare* event that defeats every automatic tier (that floor is bounded by one human and
> cannot be automated away; it can only be made rare, detected, and reversible — which it now is).

---

## 0. TL;DR (one screen)

1. **~80 activities, four classes.** Fully-automated **~48** · Semi-automated **~14** · Founder-approval-required
   (intentional gates) **~10** · Manual-by-necessity **~8**. (Full table §2.)
2. **The challenge moved ~15 items manual/semi → automated.** The headline reclassifications (§3): **macOS update**
   (manual → canary-gated auto-update window), **secret rotation** (manual → scheduled programmatic rotation),
   **proof-of-restore** (manual → scheduled restore-test into a scratch project), **off-provider DB dump** (manual →
   timer), **docker prune / disk hygiene** (ad-hoc → timer), **colima wedge** (manual restart → health-triggered
   self-heal), **Tier-4 rollback** (print-the-command → auto-rollback-to-known-good), **Tier-6 runner failover**
   (manual `runs-on` flip → watchdog-triggered repo-variable kill-switch), **post-update re-assertion** (a runbook
   the founder runs → an idempotent boot-assertion job), **M1 parity re-proof** (remembered → CI-triggered on any
   toolchain-touching diff), **dependency bumps** (manual merge → auto-merge patch, gate major).
3. **Self-healing = the 7-tier ladder, mostly automatic.** Tiers 0–2 are *fully* automatic today (launchd relaunch ·
   lease-reclaim · dead-letter quarantine). This doc adds two self-heal loops *below* Tier 5 (a **colima-watchdog**
   and a **disk-reaper**) so Tier 5 (page-a-human) is reached only on a genuinely novel fault. (§4, §5.)
4. **Auto-update is canary-gated so it can NEVER silently break the node.** Every unattended update (runner agent,
   macOS, OS-managed deps) runs inside a wrapper: snapshot known-good → apply → run a synthetic health+parity probe →
   pass commits & re-enables; **fail auto-rolls-back (or holds CI on GitHub-hosted via the one-line `runs-on`
   fallback) and pages.** Pinned components (colima, `postgres:16`, `vercel`, Node) bump *intentionally* through a
   Dependabot PR the founder approves — never silently. (§6.)
5. **The intentional manual set is small and deliberate.** Merge-to-main (Class-C) · prod-deploy authorization (or
   the once-ratified deploy-lane scope) · break-glass grant issuance · a Tier-3 HALT / BoundaryFAP decision ·
   a major-version bump · a migration-trigger-fired host-swap. Plus the irreducible one-time setup + the rare
   FileVault unplanned-reboot login. **That is the whole list.** (§8.)
6. **Residual founder burden ≈ minutes/week steady-state.** Down from the challenge's variance-dominated 1–3 hrs/wk:
   a weekly-green digest glance + event-driven approvals. The honest floor that automation *cannot* remove — the
   founder is the only on-call for the rare event past every automatic tier — is minimized (rare + detected +
   reversible), not eliminated. (§9.)

---

## 1. Method — how each activity is classified and challenged

**The four classes (and the bar each must clear):**

| Class | Definition | The bar to land here |
|---|---|---|
| **FA — Fully-automated** | Triggered + executed + recovered with **zero founder action** in the normal path. | A machine trigger (timer, event, health-state) drives a mechanism that completes or self-recovers; the founder is involved only if it *fails* (→ a page). |
| **SA — Semi-automated** | Mostly machine-driven but needs **one human step** (a click, a review, a confirm) — usually because the automatic part is new/risky and wants a human in the loop *for now*. | Has a clear path to FA; the human step is a *transitional* safety, not an intentional gate. **Every SA item is a challenge target.** |
| **FG — Founder-approval-required** | The governance model **requires** a human yes — a Class-C act, a money/legal/identity boundary, an irreversible spend. | The gate is *intentional and load-bearing*; automating it would cross a governance boundary. These are NOT toil; they are the founder doing the one job only the founder may do. |
| **MN — Manual-by-necessity** | A genuine reason it **cannot** be automated (physical, one-time identity, an unforgeable human presence). | No machine trigger exists; or it is a one-time bootstrap; or it is the security trade itself (FileVault unplanned login). **Challenged anyway** — most reduce to "rare + detected." |

**The challenge applied to every MN and SA item:** *can this be automated by a launchd timer, a self-healing loop,
a watchdog-triggered recovery, a canary-gated auto-update, or a scheduled rotation?* If yes → recommend the
mechanism and reclassify. The only items allowed to **stay** manual: **macOS install · software install · one-time
auth · intentional founder approvals.** Anything else that ends manual must *prove* its necessity.

---

## 2. The automation-classification table (every activity → class → trigger → mechanism → why)

Organized by lifecycle phase. **Class** uses the §1 codes. The **→** column flags items this doc **reclassifies**
(the challenge result, detailed in §3). The "~14 standing surfaces" (NEO-ADV-05 §1) are tagged **[S#]**.

### 2.A — One-time setup (the irreducible bootstrap)

| # | Activity | Class | Trigger | Mechanism | Why (if not FA) |
|---|---|---|---|---|---|
| A1 | Install macOS / OS provisioning | **MN** | founder, once | physical install | Physical, one-time, pre-network. Cannot be automated on a bare machine. |
| A2 | Install software (Homebrew, colima, Node, Vercel CLI, Tailscale, runner agent, gitleaks) | **MN→SA** | founder, once | a **provisioning script** (`provision-node.sh`) installs + pins everything idempotently | One-time, but **scripted** so re-provision / a Linux swap is repeatable, not artisanal. The *first run* is founder-launched; the script is the artifact. |
| A3 | Create non-admin `ci-runner` user + ACLs | **SA** | founder, once (in A2 script) | scripted `sysadminctl`/`dscl` + file-perm setup | Part of the provisioning script; founder runs once. |
| A4 | One-time auth: Tailscale device-approve · GitHub runner registration token · founder seeds secrets over SSH · Vercel token issuance | **MN** | founder, once | human identity assertion | **Irreducible** — these *are* the human establishing identity/trust. No machine may self-authorize them. |
| A5 | FileVault enable + recovery-key escrow | **MN** | founder, once | `fdesetup enable` | One-time security bootstrap; the recovery key is a founder secret. |
| A6 | Configure `pmset`/`caffeinate`/App-Nap-exclusion/clamshell | **FA** | boot (and re-asserted post-update — see U7) | a **boot-assertion launchd job** re-applies idempotently every boot | Set-once *and* self-healing — survives a macOS update wiping it (the A.4 rot). |
| A7 | Pin + autostart colima (`com.colima` Homebrew service) | **FA** | boot | launchd Homebrew service | colima socket up before any job needs `postgres:16`. |
| A8 | Instrument the migration-trigger tripwires (toil ledger, downtime record, thermal/CI-duration, battery, offline-days, repo-visibility watch) | **FA** | M-pre, then continuous | durable-bus tables + scheduled probes | Data exists before it's needed (NEO-OPS-06 §4). |
| A9 | Milestone build gates (M0/M3/M5 ★) | **FG** | the build reaching each milestone | founder yes | M3/M5 touch the merge/release floor — intentional (NEO-ARCH-00 §11). |

### 2.B — Daily operation: the heartbeat / health loop

| # | Activity | Class | Trigger | Mechanism | Why (if not FA) |
|---|---|---|---|---|---|
| B1 | Worker-daemon process supervision **[S1]** | **FA** | process exit | launchd `KeepAlive=true`, `RunAtLoad=true` | Native, OS-owned restart policy. |
| B2 | Engine-tick liveness heartbeat (15–30s; **not** 5s — bus-load tuned) | **FA** | internal timer | upsert `engine_heartbeat{node,tick_seq,last_tick_at}` | The clock-owning worker; no per-invocation meter. |
| B3 | Goal-supervisor progress re-probe (~30 min) | **FA** | internal timer | re-probe acceptance metric under GS identity → goal-delta ledger | Progress ≠ liveness; independent (RS §7.5). |
| B4 | PO-reconciler drain (SKIP-LOCKED + lease) | **FA** | every tick | the engine `agent-runner` drain loop | Reuse, not rebuild. |
| B5 | Health endpoints `/health` + `/ready` (tailnet-only) | **FA** | on demand | the worker's tiny HTTP server | Consumed by the watchdog + status page. |
| B6 | colima/Docker socket keep-warm | **FA** | boot + on-demand | `com.colima` launchd service | Avoids cold-VM tax per job. |
| B7 | Ephemeral runner lifecycle (poll → run one job → de-register → re-register) **[S2]** | **FA** | GitHub job enqueue (outbound long-poll) | `--ephemeral` runner + launchd relaunch | Clean-per-job; no secret persists. |
| B8 | Test Postgres teardown per job | **FA** | job end | container torn down | No test data leaks forward. |
| B9 | Tailnet rejoin after reboot **[S4]** | **FA** | boot | `tailscaled` autostart | MagicDNS identity stable across reboot. |
| B10 | Log rotation (`newsyslog`, hard size cap) **[S12]** | **FA** | size/time | `newsyslog` | The "logs fill the disk" rot, automated. |

### 2.C — Monitoring / watchdog / founder visibility

| # | Activity | Class | Trigger | Mechanism | Why (if not FA) |
|---|---|---|---|---|---|
| C1 | Off-node dead-man push check-in (1 min, **gated on `/ready`**) **[S5]** | **FA** | internal timer when `/ready` green | `POST hc-ping.com/<uuid>` | Absence is unforgeable; catches degraded-but-running (ADR-HBM-3). |
| C2 | Windows Scheduled-Task pull-watchdog (5 min: `/health` + `/ready` + **direct Supabase probe**) **[S6]** | **FA** | Windows Task Scheduler | independent-domain pull; disambiguates node-fault vs Supabase-fault | Second off-node failure domain (NEO-ADV-05 §4 fix). |
| C3 | Healthchecks alarm → page founder | **FA** | check-in absent past grace | Healthchecks → phone push/SMS | Detection auto; the *ack* is founder (C4). |
| C4 | Founder acknowledges a P1 page | **MN** | a page fired | founder taps ack | An unforgeable human-awareness signal; the point of a page. |
| C5 | Weekly "all-green" digest (a dead-man for the dead-man) | **FA** | weekly timer | Healthchecks scheduled digest | Proves the alarm path itself is alive. |
| C6 | Daily P2 digest generation | **FA** | daily timer | SQL view over the bus → email | Degraded items batched, never a 2am page. |
| C7 | Off-node status page render **[S7]** | **FA** | on load | Vercel SSR reads Supabase directly | Survives Neo down. |
| C8 | P1/P2/P3 alert routing | **FA** | event severity | the alerting policy (HBM §7) | Only P1 pages. |
| C9 | Cost-ledger monitoring + soft-threshold alert | **FA** | per goal-tick | portfolio-cost ledger view → P2 | Runaway-fleet bound. |
| C10 | Dashboard glance ("is everything healthy?") | **MN** | founder chooses | reads the status page | A *pull*, not toil; minutes/week, optional. |

### 2.D — Incident detection + recovery (the 7-tier ladder)

| # | Activity | Class | Trigger | Mechanism | Why (if not FA) |
|---|---|---|---|---|---|
| D0 | **Tier 0** — process exit | **FA** | PID gone | launchd `KeepAlive` relaunch → re-read bus | No RAM state; seconds. |
| D1 | **Tier 1** — crash mid-step | **FA** | lease unrenewed | lease expiry → SKIP-LOCKED reclaim + idempotency store | No double side-effect; ~one tick. |
| D2 | **Tier 2** — stuck cursor / poison-pill | **FA** | `STUCK_CONSUMER_CURSOR` | single re-tick → dead-letter quarantine | Never silent-dropped. |
| D3 | **Tier 3** — bug-loop / runaway / flat-delta / cost-cap | **FA→FG** | breaker trip | circuit-breaker OPEN → HALT → **BoundaryFAP summon** | Auto-HALT (no harm); the *decision* is FG (founder). |
| D4 | **Tier 4** — bad deploy | **SA→FA** | `post-deploy-verify` ALARM | `rollback-helper` — **today: prints** last-known-good `vercel promote`; **recommend: auto-promote** known-good within a bounded window | Reverting to a *known-good* is safe to automate; roll-*forward* is not (§3.7). |
| D5 | **Tier 5** — daemon/GS dead, launchd can't recover (crash-loop throttle / disk full / hung) | **SA** | `/ready` 503 → ping stops → dead-man pages | **today: manual runbook** (SSH → `launchctl print` → tail logs → restart). **Recommend: insert self-heal loops *below* this tier** (disk-reaper D7, colima-watchdog D8) so Tier 5 is reached only on a novel fault | The residual hard cases are bounded by one human; minimized, not removed. |
| D6 | **Tier 6** — node hardware death **[S6/runs-on]** | **SA→SA+** | dead-man alarm | **today: founder flips `runs-on` + re-homes worker.** **Recommend: watchdog auto-flips the `runs-on` repo-variable kill-switch** (runner offline + queued checks > N min) so CI self-restores; worker re-home stays founder (rare) | Auto-failover to a *known-good* fallback (GitHub-hosted) is safe; re-homing the worker is rare + founder-judged. |
| D7 | **disk-reaper self-heal** (NEW) | **FA** | disk > soft cap (probed each tick) | auto `docker system prune` + colima disk reclaim + log-cap enforce; page only if still over after reap | Converts a Tier-5 "disk full" into an absorbed blip (§5). |
| D8 | **colima-watchdog self-heal** (NEW) | **FA** | `docker info` fails | auto `colima restart`; on N failures → flip `runs-on` to GitHub-hosted + P1 | Converts the macOS-update colima break into a self-heal-then-fallback (§5). |

### 2.E — Build · verify · deploy

| # | Activity | Class | Trigger | Mechanism | Why (if not FA) |
|---|---|---|---|---|---|
| E1 | PR required checks (ci/build-and-migrate, migration-lint, gitleaks, config-gate) | **FA** | PR opened/synchronized | ephemeral runner job | Event-driven. |
| E2 | Independent VERIFY + `machine_probe` (D9 binding compute) | **FA** | PR | a `verify`-kind job on a node the author doesn't control | author≠verifier physical. |
| E3 | **Merge to main (Class-C)** | **FG** | all-green + CODEOWNERS | **founder yes** | Intentional governance boundary (NEO-ARCH-00 §2.1). |
| E4 | Prod deploy execution (`vercel --prebuilt --prod`) | **FA** | push to main (post-merge) | deploy job holding `VERCEL_TOKEN` | Execution is auto; *authorization* was E3/E6. |
| E5 | Supabase migrate (expand/contract, before code) | **FA** | deploy job | pooler (session 5432); forward-only | Identity-respecting, idempotent. |
| E6 | **Prod-deploy authorization** (the co-equal-path control, HOST-2) | **FG** | a prod deploy | **deploy author≠verifier / approval gate** OR a once-ratified `.deploy-lane.json` scope the `deployment-operator` executes in-scope without per-action prompts (logging each) | The deploy token is a co-equal prod-mutation path (NEO-ADV-05 §7); ratify the *scope* once, then in-scope acts auto-run + log; out-of-scope fails closed. |
| E7 | Post-deploy smoke / health verify (**binding**, no `continue-on-error`) | **FA** | deployment_status | `post-deploy-verify.mjs` fold | Prod rung must be binding. |
| E8 | Permanent staging deploy on merge-to-`dev` | **FA** | merge to dev | staging deploy job | Always-on staging, the HE-catch surface. |
| E9 | **M1 parity re-proof on toolchain change [S14]** | **SA→FA** | **today: remembered before a flip.** **Recommend: a CI gate auto-runs the parity job whenever a toolchain-touching file changes** (`package.json`, lockfile, `.nvmrc`, colima/postgres pin, runner version) | Byte-identical-verdict drift caught mechanically, not by memory. |

### 2.F — Secrets: bootstrap + rotation

| # | Activity | Class | Trigger | Mechanism | Why (if not FA) |
|---|---|---|---|---|---|
| F1 | Initial secret seeding (founder over SSH) | **MN** | once | founder vendors from platform stores | One-time identity assertion (= A4). |
| F2 | `config-doctor --enforce` fail-closed gate at daemon start | **FA** | daemon start | refuses an incomplete/invalid secret set | A half-bootstrapped node fails loud. |
| F3 | Machine-secret rotation: `VERCEL_TOKEN` · pooler creds · `CRON_SECRET` · `PROD_SMOKE_TOKEN` **[S9]** | **MN/SA→SA** | **today: ad-hoc/manual.** **Recommend: a scheduled rotation timer** drives the provider API to mint a new secret → write to the System keychain/store → `config-doctor --enforce` verifies → reload; on fail, keep the old + page | Programmatically rotatable secrets should rotate on a schedule, not on a memory (§3.2). |
| F4 | **Break-glass grant issue/consume** | **FG** | a prod-write need | founder issues a signed, single-use, scoped, TTL'd grant from a trusted device | The only path a write reaches prod — intentional (NEO-ARCH-00 §6.4). |
| F5 | Ed25519 keypair generation (private key on founder device) | **MN** | once / on rotation | `ssh-keygen`-class on the founder device | Private key must NEVER touch the node (ADR-SEC-3). |
| F6 | Ed25519 public-key distribution to the node | **SA** | keygen/rotation | scripted publish of the *public* key | Public key is non-secret; distribution scriptable; the gen step is F5. |
| F7 | Scheduled Ed25519/cert rotation cadence | **SA** | rotation timer | timer reminds + stages F6; F5 (private) stays founder | Asymmetric key hygiene; the private half is founder-bound. |

### 2.G — Software / OS / runner updates

| # | Activity | Class | Trigger | Mechanism | Why (if not FA) |
|---|---|---|---|---|---|
| U1 | Runner agent auto-update **[S2]** | **FA→FA(canary)** | GitHub releases | **today: auto-updates, "can break silently."** **Recommend: wrap in a canary** — after update, run a synthetic job; pass commits, fail holds CI on GitHub-hosted + pages (§6) | An auto-update that can silently fail jobs must be health-gated. |
| U2 | **macOS OS update [S10]** | **MN/SA→SA(canary)** | **today: manual (the headline break vector).** **Recommend: a scheduled update-window** — snapshot health → `softwareupdate` via `fdesetup authrestart` (unattended) → boot-assertion (A6) re-asserts pmset → post-update self-test (docker socket, parity smoke); pass re-enables, fail holds CI on GitHub-hosted + pages (§6) | The single biggest toil source, automated behind a canary + the `runs-on` safety net. |
| U3 | colima / `postgres:16` version bump **[S3]** | **SA** | a Dependabot-style PR | **pinned**; bumps *intentionally* via a PR the founder approves; parity job (E9) gates it | Pinned = no silent break; bump is a reviewed event, not auto. |
| U4 | Vercel CLI bump (`vercel@48.12.1`) | **SA** | PR | pinned; intentional bump | API-floor sensitive; bump deliberately. |
| U5 | Node toolchain bump (per-repo pin) | **SA** | PR | pinned per-repo; parity job gates | Works-on-node-fails-on-hosted drift guard. |
| U6 | npm dependency / pinned-action-SHA updates | **SA→FA(patch)** | Dependabot | **Recommend: auto-merge patch/minor after CI green; founder-gate major** (the gitleaks + `npm audit` + parity floor make patch auto-merge safe) | Removes routine bump toil; majors stay reviewed. |
| U7 | Post-update re-assertion runbook (pmset, docker socket, re-enable checks) **[S11]** | **SA→FA** | post-boot / post-update | **the boot-assertion job (A6) makes this automatic + idempotent**, not a runbook the founder runs | `pmset` reset-by-update is the rot; re-assert every boot unconditionally. |

### 2.H — colima / Docker / disk maintenance

| # | Activity | Class | Trigger | Mechanism | Why (if not FA) |
|---|---|---|---|---|---|
| H1 | `docker system prune` + colima disk-cap **[S12]** | **SA→FA** | **today: "a weekly prune."** **Recommend: a launchd timer** (weekly) + the disk-reaper (D7) on pressure | A timer, not a memory. |
| H2 | colima restart on wedged socket | **SA→FA** | `docker info` fails | the colima-watchdog (D8) self-heals, then falls back | Health-triggered, not hand-run. |

### 2.I — FileVault / reboot handling

| # | Activity | Class | Trigger | Mechanism | Why (if not FA) |
|---|---|---|---|---|---|
| I1 | Planned reboot (macOS update / deliberate) | **FA** | the update window (U2) | `fdesetup authrestart` (key in RAM for one boot) → autostart → `/ready` green, **no human** | The dominant reboot event, unattended. |
| I2 | Power-flicker absorption | **FA** | a home power blip | the MacBook **battery = built-in UPS** — no reboot occurs | Passive; Neo's structural advantage. |
| I3 | Battery-health + SMART monitoring | **FA** | scheduled probe | `pmset -g batt` / `ioreg` → bus → trigger 4c | A degraded battery loses the UPS property. |
| I4 | Clamshell/lid-closed-on-power | **FA** | boot config | set in A6, re-asserted every boot | Survives updates. |
| I5 | **Unplanned-reboot recovery (kernel panic / battery fully drained)** | **MN** | a rare panic/drain | pre-boot FileVault screen → **watchdog pages → founder logs in** → autostart → `/ready` green | **MN by necessity** — FileVault's security guarantee *is* "no code runs before a human unlocks." The *detection* is FA; the login is the irreducible security trade (§3.8). Rare + detected + non-data-losing (RPO 0). |

### 2.J — Migration-trigger evaluation

| # | Activity | Class | Trigger | Mechanism | Why (if not FA) |
|---|---|---|---|---|---|
| J1 | 4a repo-visibility / contributor / fork-PR watch (HARD security) | **FA→FG** | scheduled GitHub probe | visibility + collaborators API + CODEOWNERS diff + Actions fork-origin scan → status page + **P1** | Detection auto; the *response* (re-seat decision) is FG. |
| J2 | 4b laptop-specific toil rolling-sum | **FA** | continuous | SQL view over the toil ledger → gauge | Auto-summed; incident *logging* see J7. |
| J3 | 4c reboot-outage-vs-RTO + battery-health | **FA** | downtime log / battery probe | watchdog downtime record + battery gauge | Objective threshold. |
| J4 | 4d offline-days tally | **FA** | daily rollup | Tailscale last-seen + `engine_heartbeat` gaps | Planned-offline coverage. |
| J5 | 4e thermal / CI-duration regression | **FA** | thermal probe + per-job metrics | compare to M1 parity baseline → gauge | >30% p50 regression fires. |
| J6 | 4f fleet-count / reliability driver | **FA** | registry count | the driver that justified a node | Reliability before re-seat. |
| J7 | Toil-incident classification (`laptop_specific` tag) | **SA→FA** | an ops incident | **Recommend: auto-tag from `classifyFailure()`** — map known causes (colima/macOS-update/keychain/thermal) to `laptop_specific:true` automatically | The taxonomy already classifies; auto-derive the tag. |
| J8 | **Trigger-fired → execute host-swap runbook** | **FG/MN** | a trigger fires | founder decides + runs the (scripted, §5/06) provision→join→register→drain→deregister | The *decision* is FG; the *execution* is the scripted runbook — rare, deliberate. |

### 2.K — Backups / DR

| # | Activity | Class | Trigger | Mechanism | Why (if not FA) |
|---|---|---|---|---|---|
| K1 | Supabase PITR | **FA** | continuous | provider-managed | The crown jewel, continuously protected. |
| K2 | Periodic off-provider DB dump **[S13]** | **MN/SA→FA** | **today: implied manual.** **Recommend: a launchd/cron-on-an-owned-host timer** dumps to off-provider storage on a schedule | "Back up the DB obsessively" must be a timer, not a memory. |
| K3 | **Proof-of-restore [S13]** | **MN/SA→SA(auto-test)** | **today: "periodically prove a restore" (manual).** **Recommend: a scheduled restore-test** — restore the latest dump into a scratch Supabase project → assert schema + row-count invariants → report to the bus → **page on fail**; founder eyeballs the green periodically | "An untested backup is not a backup" — automate the test, keep a light founder confirm. |
| K4 | No node-disk backup (intentional) | **FA** | n/a | nothing to do — node is cattle | Asymmetric DR (ADR-FEL-3); zero work by design. |

---

## 3. The challenge — every MN/SA item, "can this be automated?", and the recommendation

The rule (§1): only **macOS install · software install · one-time auth · intentional founder approvals** may stay
manual. Each item below is challenged; the verdict is the §2 reclassification.

### 3.1 Software install (A2) — MN → SA (provisioning script)
**Challenge:** the *first* install is founder-launched on a bare machine (irreducible), but the steps are
deterministic. **Recommend:** a single idempotent `provision-node.sh` that installs + pins Homebrew, colima,
`postgres:16`, Node (per-repo), `vercel@48.12.1`, gitleaks, Tailscale, the runner agent, creates `ci-runner`, lays
down the launchd plists (worker, colima, boot-assertion), and sets `pmset`/clamshell. The founder runs *one
command*; re-provisioning or a Linux swap re-runs the same artifact. **The script is the spec** (and it's exactly
what NEO-OPS-06 §5.2's host-swap runbook automates).

### 3.2 Machine-secret rotation (F3) — MN/SA → SA (scheduled programmatic rotation)
**Challenge:** `VERCEL_TOKEN`, pooler creds, `CRON_SECRET`, `PROD_SMOKE_TOKEN` are all programmatically rotatable
via provider APIs / the config platform. Rotating "when I remember" is the silent-rot vector ("the token rotated and
the daemon didn't reload"). **Recommend:** a launchd **rotation timer** (e.g. every 30/90 days per secret class):
mint-new → write to the System keychain/store → `config-doctor --enforce` validates → signal the daemon to reload →
on any failure, **keep the old secret live and page** (fail-safe, never fail-open). The ephemeral runner means no
stale CI secret persists anyway. **Stays SA** only because a first-class founder confirm on the *first* automated
cycle is prudent; thereafter effectively FA. The Ed25519 **private** key (F5) is explicitly excluded — it lives on
the founder device and rotates by founder action (asymmetric by design).

### 3.3 Proof-of-restore (K3) + off-provider dump (K2) — MN/SA → FA/SA
**Challenge:** "an untested backup is not a backup" is the one DR line the founder is told to do *manually and
periodically* — precisely the thing that rots. **Recommend:** K2 is a pure **timer** (FA). K3 is a **scheduled
restore-test**: restore the latest dump into a throwaway Supabase project, run schema + row-count + a smoke query as
invariants, write the verdict to the bus (visible on the status page), and **page on a failed restore**. The founder
keeps a *glance* (is the weekly restore green?) — a digest item, not a procedure.

### 3.4 macOS update (U2) — MN/SA → SA (canary-gated update window)
**Challenge:** named four times as the headline break vector; doing it manually means it either never happens
(security debt) or happens unattended-and-breaks-colima (outage). **Recommend:** a **scheduled monthly update
window** (off-peak, founder-set): (1) snapshot a health baseline + flip CI pre-emptively to GitHub-hosted via the
`runs-on` repo-variable (zero-downtime guard); (2) `softwareupdate -ia` then `sudo fdesetup authrestart` (unattended
reboot); (3) on boot, the **boot-assertion job (A6)** re-asserts `pmset`/caffeinate/clamshell, the **colima-watchdog
(D8)** confirms the Docker socket, and a **post-update self-test** runs a parity smoke; (4) **pass** → flip CI back to
Neo + a P2 digest line; **fail** → stay on GitHub-hosted + **P1 page** with the captured diff. The update can no
longer silently break the node — the canary + the pre-emptive fallback make it safe to run unattended. (Full
mechanism §6.)

### 3.5 Post-update re-assertion (U7) — SA → FA (boot-assertion job)
**Challenge:** "re-assert `pmset` after an update" is a runbook step the founder is asked to remember; `pmset`/App-Nap
settings reset by some updates is the rot. **Recommend:** make it a launchd job (A6) that runs **every boot,
unconditionally and idempotently** — re-apply `pmset -a sleep 0 disablesleep 1`, `caffeinate`, App-Nap exclusion,
clamshell, and verify the colima socket. There is no reason a human re-applies known settings; the machine does it on
every boot.

### 3.6 docker prune / colima wedge (H1/H2) — SA → FA (timer + self-heal)
**Challenge:** "a weekly prune" and "restart colima when wedged" are classic self-hosted-rot chores. **Recommend:**
H1 = a **weekly launchd timer** plus the on-pressure **disk-reaper (D7)**; H2 = the **colima-watchdog (D8)** that
`colima restart`s on a failed `docker info` and falls back to GitHub-hosted after N failures. Both are health- or
time-triggered, never hand-run.

### 3.7 Tier-4 deploy rollback (D4) — SA → FA (auto-rollback to known-good)
**Challenge:** today `rollback-helper` *prints* the `vercel promote` command for the founder to paste. Reverting to
the **last-known-good** deploy is a *safe, reversible* operation (it's the state that just worked). **Recommend:** on
a binding `post-deploy-verify` ALARM, **auto-promote the last-known-good deploy** within a bounded self-heal window,
then page P1 with what happened. The asymmetry is the safety: auto-**rollback** (to known-good) is automatable;
auto-**roll-forward** (a new fix) is not — that stays a founder/`deployment-operator`-in-scope act. This converts a
bad deploy from "prod is down until the founder pastes a command" into "prod self-restored to known-good + a page."

### 3.8 Tier-5/6 recovery (D5/D6) — SA → SA+ (self-heal below, auto-failover at the edge)
**Challenge:** Tier 5 (daemon dead, launchd can't recover) and Tier 6 (hardware death) are where "the founder is the
on-call." We can't automate *novel* hard failures, but we *can* shrink what reaches them. **Recommend:** insert the
**disk-reaper (D7)** and **colima-watchdog (D8)** as self-heal loops *below* Tier 5, so the common Tier-5 causes
(disk full, colima wedge) self-heal before paging. For Tier 6, **auto-flip the `runs-on` repo-variable** when the
runner is offline with queued checks past a threshold — CI self-restores to GitHub-hosted (a known-good fallback)
with no founder action; only the rare *worker re-home* stays founder-judged. The irreducible residual: a genuinely
novel fault that defeats every loop still pages one human (§9).

### 3.9 Unplanned-reboot login (I5) — MN, justified (rare + detected)
**Challenge:** can the FileVault unlock be automated? **No — and that is correct.** FileVault's entire security
guarantee is "no code (no daemon, no `pmset autorestart`) runs before a human unlocks the encrypted volume." Defeating
it would re-open the portable-secret-theft hole (NEO-OPS-06 §2.8, §3.2c). So I5 stays **MN by necessity** — but the
challenge still bites on *frequency and detection*: the **battery-UPS** makes the dominant cause (power blip) a
non-event, **`authrestart`** makes the dominant reboot (updates) unattended, and the **watchdog** makes the rare
residual *detected within grace* (not a silent six-month rot). The login is a rare, paged, founder-present event with
RPO 0 — the only honest place automation stops. (The permanent fix is the Linux migration's unattended LUKS, gated by
trigger 4c — itself the automated escalation.)

### 3.10 M1 parity re-proof (E9) + toil tagging (J7) — SA → FA
**Challenge:** "re-prove parity on a toolchain bump" relies on memory; "tag an incident laptop-specific" relies on
discipline. **Recommend:** E9 becomes a **CI gate** that auto-runs the parity job whenever a toolchain-touching file
changes (the diff is mechanically detectable). J7 **auto-derives** the `laptop_specific` tag from the existing
`classifyFailure()` taxonomy. Both remove a human-memory dependency.

### 3.11 Dependency bumps (U6) — SA → FA for patch/minor
**Challenge:** routinely merging green Dependabot patch PRs is pure toil. **Recommend:** **auto-merge patch/minor**
after the full CI floor (build + migrate + gitleaks + parity) goes green; **founder-gate major** versions only. The
gate moves from "every bump" to "the bumps that can actually break a contract."

**What the challenge deliberately leaves manual:** A1 (macOS install), A4/F1 (one-time auth + secret seeding), F5
(Ed25519 private keygen), and the FG set (§8). Everything else above is reclassified toward FA.

---

## 4. The auto-recovery design — which tiers are automatic

The 7-tier ladder (NEO-HBM §6) with this doc's two added self-heal loops. **Tiers 0–2 + D7/D8 need no human;
Tier 3 auto-halts then asks; Tier 4 self-rolls-back; Tier 6 self-fails-over CI; only the rare hard residual at
Tier 5/6-worker pages a human.**

```
 FAULT ─────────────────────────────────────────────────────────────────────────────────────────────
   │
   ├─ process exit ............... TIER 0  launchd KeepAlive relaunch ............................ AUTO (s)
   ├─ crash mid-step ............. TIER 1  lease-expiry → SKIP-LOCKED reclaim + idempotency ...... AUTO (~tick)
   ├─ stuck cursor / poison ...... TIER 2  re-tick → dead-letter quarantine ..................... AUTO
   │
   ├─ disk pressure ............. [D7]     disk-reaper: prune + reclaim + log-cap ................ AUTO  ← NEW
   ├─ colima/docker wedged ...... [D8]     colima-watchdog: restart → (N fails) runs-on fallback . AUTO  ← NEW
   │
   ├─ bug-loop/runaway/cost ...... TIER 3  breaker OPEN → HALT → BoundaryFAP ......... AUTO-HALT → FOUNDER decides
   ├─ bad deploy ................. TIER 4  post-deploy-verify ALARM → auto-promote known-good .... AUTO-ROLLBACK + page
   ├─ runner offline + queued .... TIER 6' watchdog auto-flips runs-on → GitHub-hosted ........... AUTO-FAILOVER + page
   │
   ├─ daemon dead, launchd stuck . TIER 5  (only if D7/D8 didn't catch it) dead-man pages ........ FOUNDER (rare)
   └─ node hardware death ........ TIER 6  CI self-restored (6'); worker re-home ................. FOUNDER (rare)
```

**The escalation seam (the whole point):** every layer absorbs what it can; only a fault that defeats *every*
automatic loop reaches a human, and the off-node dead-man guarantees that when it does, it's a **ping within grace**,
not a silent rot. The two added loops (D7/D8) specifically target the two most-common Tier-5 causes named in the
risks (disk-full, colima-break), pulling them down to AUTO.

---

## 5. The self-healing design (launchd KeepAlive + lease-reclaim + the new loops)

Self-healing is layered, each layer cheaper than the next:

1. **Process self-heal — launchd `KeepAlive`** (Tier 0). The daemon, colima, and the runner each relaunch on exit;
   a crash-loop throttles → the tick goes stale → the dead-man catches it. *Native, no extra supervisor.*
2. **Work self-heal — lease-reclaim** (Tier 1). A dead worker's leased step expires; the next tick (any live node)
   reclaims from the last durable checkpoint; the idempotency store + CAS prevent double-execute. *No RAM state =
   recovery is a re-read, not a reconstruction.*
3. **Resource self-heal — the disk-reaper (D7, NEW).** Each tick checks disk headroom; over a soft cap it auto-prunes
   Docker layers, reclaims the colima disk, and enforces the log cap; only if *still* over does it page. Kills the
   "Docker layers filled the disk" rot before it becomes a Tier-5 outage.
4. **Runtime self-heal — the colima-watchdog (D8, NEW).** A periodic `docker info`; on failure it `colima restart`s;
   on N consecutive failures it flips the `runs-on` repo-variable to GitHub-hosted (CI keeps flowing) and pages.
   Kills the "macOS update broke colima → all merges blocked" rot.
5. **Secret self-heal — `config-doctor --enforce`** (fail-closed). The daemon refuses to run on a stale/invalid
   secret set; the rotation timer (F3) keeps secrets fresh and reloads them — the "token rotated, daemon didn't
   reload" rot, closed.
6. **Config self-heal — the boot-assertion job (A6).** Every boot re-asserts `pmset`/caffeinate/App-Nap/clamshell +
   verifies the colima socket, idempotently — so a macOS update wiping those settings self-corrects on the next boot.
7. **CI self-heal — the `runs-on` repo-variable kill-switch** (ADR-EN-4). The UI-flippable `runs-on: ${{ vars.CI_RUNNER }}`
   is the lever D8/Tier-6' flip *automatically* — a known-good fallback that's always one variable away.

**The discipline:** every self-heal loop is **reversible + health-gated + page-on-give-up**. A loop never silently
masks a real failure (it pages if it can't fix it within bounds), and never takes an irreversible action (it reverts
to known-good, never invents a new state). This is what keeps self-healing from becoming its own silent-rot vector
(§7).

---

## 6. The auto-update strategy (canary + rollback so an update can NEVER silently break the node)

The risk this section exists for: **an auto-update is the one automation that can silently break an unattended node**
(NEO-ARCH-01 A.2: "does not auto-update silently into a broken state"). The strategy makes that impossible by gating
every unattended update behind a canary with an automatic rollback.

**The canary wrapper (applies to U1 runner-agent, U2 macOS, and any OS-managed dep):**

```
  1. SNAPSHOT   record a known-good marker (current versions; a health baseline; for CI: pre-flip runs-on → GitHub-hosted)
  2. APPLY      perform the update (runner self-update / softwareupdate + fdesetup authrestart / brew upgrade <pinned-excluded>)
  3. BOOT-ASSERT  (A6) re-assert pmset/caffeinate/clamshell; (D8) verify the docker socket
  4. CANARY     run a SYNTHETIC probe: a no-op runner job + a parity smoke (byte-identical verdict on a fixed commit) + /ready green
  5a. PASS  →   commit the update; flip runs-on back to Neo; P2 digest line ("runner updated, canary green")
  5b. FAIL  →   AUTO-ROLLBACK where possible; HOLD CI on GitHub-hosted (runs-on already there from step 1); P1 page with the captured diff
```

**Pinned vs auto-updated — the two-track rule:**
- **Auto-updated, canary-gated:** the GitHub runner agent (it self-updates regardless — so wrap it), macOS security
  updates (scheduled window), npm **patch/minor** (auto-merge after green).
- **Pinned, intentional-bump-only:** colima, `postgres:16`, `vercel@48.12.1`, Node (per-repo), pinned action SHAs,
  npm **major**. These bump through a Dependabot-style PR that runs the **full CI floor + the parity job (E9)** and
  the **founder approves** — never silently, because a drift here corrupts the gate verdict (the parity-drift risk,
  NEO-ARCH-01 Risk 5).

**Why this is safe to run unattended:** the pre-emptive `runs-on` flip means CI never depends on the node *during* an
update; the canary proves byte-identical behavior *before* re-trusting the node; and a failure auto-rolls-back or
holds on a known-good fallback and pages — so the worst case of an auto-update is "a P1 page + CI temporarily on
GitHub-hosted," never "the node silently broke and I found out weeks later." That is the exact silent-rot class
(NEO-ARCH-00 §9.7) the canary closes.

---

## 7. The meta-risk — automation that can act unattended is itself a new failure surface

Honest counter-pressure (Invariant §11 — surface it, don't smooth it): **every automation added here is also a thing
that can rot.** Auto-rotation can mint a bad secret; the canary can have a bug; auto-rollback can promote the wrong
"known-good"; the disk-reaper can prune something live. If added naively, this strategy *grows* the standing surface
it set out to shrink. The discipline that prevents that:

1. **Every unattended action is reversible** — rollback-to-known-good, never invent-a-new-state. (Auto-rollback yes;
   auto-roll-forward no. Auto-flip to GitHub-hosted yes; auto-merge-to-main never.)
2. **Every unattended action is health-gated** — `config-doctor --enforce` after a rotation; the canary after an
   update; `/ready` green after a self-heal. The action only "commits" if health confirms it.
3. **Every loop pages on give-up** — a loop that can't fix within bounds escalates to a human, never masks. Fail-safe,
   never fail-open.
4. **The watchdog watches the automators too** — a rotation/update/self-heal that wedges the daemon stops the tick →
   `/ready` red → ping stops → the dead-man pages. The off-node watchdog is the backstop for the automation itself.
5. **`config-doctor` + the parity gate are the floor** — they fail-close a half-applied change, so a broken
   automation produces a *loud refusal*, not a *silent bad state*.

So the standing-surface *count* doesn't drop (still ~14 things exist) — but each is now **self-reporting and mostly
self-healing**, and the *toil* of tending them drops to near-zero in the normal path. That is the honest framing:
automation converts "things the founder must tend" into "things that tend themselves and page when they can't."

---

## 8. The intentional founder-approval gates (the human-yes set — by design, not by toil)

These are **not** automation gaps; they are the governance model working as intended. Automating any of them would
cross a boundary the architecture deliberately holds.

| Gate | When it fires | Why it MUST stay a human yes |
|---|---|---|
| **Merge to main (Class-C)** | a green, reviewed PR | The node *executes* a merge; it never *authorizes* one (NEO-ARCH-00 §2.1 anti-scope). The release floor is a founder boundary. |
| **Prod-deploy authorization** | a prod deploy | The deploy token is a co-equal prod-mutation path (NEO-ADV-05 §7). Either a per-deploy approval, OR a **once-ratified `.deploy-lane.json` scope** the `deployment-operator` executes in-scope without per-action prompts (logging each); out-of-scope fails closed. The *scope ratification* is the founder yes; in-scope acts then auto-run. |
| **Break-glass grant issuance** | a prod write is genuinely needed | The only path a write reaches prod — single-use, scoped, TTL'd, founder-signed from a trusted device (NEO-ARCH-00 §6.4). |
| **A Tier-3 HALT / BoundaryFAP decision** | the goal-superviser trips (flat-delta / loop / cost-cap) | The system auto-*halts* (no harm); a human decides *what next* — the supervisor must never grade its own homework into a "continue." |
| **A major-version dependency bump** | a Dependabot major PR | A major can break a contract the parity floor can't fully prove; reviewed, not auto-merged. |
| **A migration-trigger-fired host-swap** | a §4 trigger fires (4a hard/immediate) | The *decision* to re-seat Node 1 (or add Node 2) is a founder call; the *execution* is the scripted runbook (NEO-OPS-06 §5). |
| **The M3 / M5 build checkpoints** | the build reaches them | They touch the merge/release floor (NEO-ARCH-00 §11). |
| **The first cycle of a new unattended automation** (rotation, update window, restore-test) | first run | A prudent one-time founder confirm before trusting a new loop unattended; thereafter effectively FA. |

**Plus the irreducible one-time setup (MN):** macOS install · software install (founder-launched script) ·
one-time auth (Tailscale approve, runner token, secret seed, Ed25519 keygen) · FileVault enable.

**Plus the rare reactive MN:** the FileVault unplanned-reboot login (§3.9) · a novel Tier-5 hard recovery the
self-heal loops didn't catch (§3.8).

---

## 9. The residual manual burden (the honest answer to "what's left for me?")

After full automation, the founder's standing involvement is:

**A. One-time (not recurring):** run the provisioning script once; the one-time auth steps; enable FileVault;
generate the Ed25519 keypair. Hours, once, at setup.

**B. Recurring — intentional approvals (event-driven, not time-boxed toil):** approve a merge-to-main; authorize a
prod deploy (or ratify the deploy-lane scope once, then nothing per-deploy); issue a break-glass grant on the rare
prod-write need; decide a Tier-3 HALT; approve a major-version bump. These are **the founder doing the founder's
job** — seconds to minutes each, driven by real product events, not by infrastructure.

**C. Recurring — glance (minutes/week):** read the weekly all-green digest; check the weekly restore-test is green;
an optional dashboard glance. **~5–15 minutes/week.**

**D. Rare reactive (paged, not polled):** log in after a rare FileVault unplanned reboot; recover a novel Tier-5 hard
fault the loops didn't catch; decide + run a host-swap when a migration trigger fires. **Weeks-to-months apart**, and
always *detected* (a page within grace), *reversible*, and *non-data-losing* (RPO 0).

**The weekly-toil estimate, honestly, vs the challenge's ~1–3 hrs/week:**

| | Challenge baseline (NEO-ADV-05 §1) | After this strategy |
|---|---|---|
| **Steady-state recurring** | ~1–3 hrs/week (digest triage, token rotations, prune, glance) | **~5–15 min/week** — a digest glance + a restore-test glance; rotations/prunes/updates are now timers + self-heal |
| **Variance (the dominant cost)** | spiky: macOS-update→colima-break = all merges blocked; runner break = blocked; FileVault reboot = silent outage; each hours-to-days | **mostly absorbed**: colima break → D8 self-heal-then-fallback; bad deploy → D4 auto-rollback; runner offline → 6' auto-failover; macOS update → canary-gated window; FileVault reboot → paged, not silent. Spikes become *pages*, often *auto-recovered* pages |
| **Approval clicks** | not separated (folded into toil) | event-driven, **the only standing recurring action** — and it's governance, not maintenance |

**The honest floor automation CANNOT remove:** the founder is the **sole on-call**, so MTTR for the *rare* event past
every automatic tier is bounded by one human's availability (asleep / travelling = that one rare event waits). The
challenge's core point stands — **reversibility and now self-healing bound the blast radius and the toil; they do not
add a second human.** What this strategy *does* achieve against the founder's goal: it removes essentially all
*standing maintenance* toil (timers + self-heal + canary-gated updates), leaving only (a) governance approvals the
founder *wants* to make and (b) a thin reactive residual that is rare, detected, reversible, and — when a migration
trigger fires — the documented exit to a Linux host where even that residual largely disappears.

**Net:** the founder spends time building products. The infrastructure tends itself, reports itself, heals itself in
the common case, and pages exactly once when it genuinely can't — which is the most a solo-founder execution layer
can honestly promise, and materially better than the variance-dominated 1–3 hrs/week the challenge measured.

---

## 10. Scope honesty — what this document does and does not do

- It **installs nothing** — no timer registered, no secret rotated, no update run, no kill-switch flipped, no
  self-heal loop deployed. It is a classification + a set of automation recommendations for the founder gate + §11.
- It **does not weaken any governance boundary** — every FG gate in §8 is preserved exactly; automation removes
  *toil*, never *gates* (the governing invariant).
- It **builds on, does not re-decide**, ADR HOST-1 (Neo now) and the 00–06 architecture; the auto-update/self-heal
  mechanisms are Neo-shaped today and carry to a Linux host unchanged (timers → systemd timers; launchd → systemd;
  the canary/rotation/restore-test logic is host-agnostic).
- Every recommended automation is **deferred-until-built behind the same M-pre→Mn order** (NEO-ARCH-00 §11): the
  self-heal loops land with the worker daemon (M4); the canary wraps the runner/update at M1/M4; the rotation +
  restore-test timers are M0/M4 hygiene; the auto-rollback hardens deploy at M5. None is speculative — each attaches
  to a step the architecture already sequences.
- Where this file disagrees with a canonical source under `core/`, the **canonical source wins — fix this file.**

*End of NEO-AUTO-08 — the automation strategy. Design only; installs nothing. An independent §11 panel ratifies
(author≠verifier) and a founder gate authorizes before any timer, loop, or canary is built.*
