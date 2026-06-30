---
artifact: NEO NODE-1 OPERATIONS + MIGRATION (the build-ready operations spec for Execution Node 1 = Neo, and the host-agnostic migration path off it)
id: NEO-OPS-06
date: 2026-06-30
status: DESIGN — READ-ONLY. Installs NOTHING, joins no node, applies no ACL, moves no secret, runs no test. This document OPTIMIZES AROUND the founder decision ADR HOST-1 (Execution Node 1 = Neo, approved 2026-06-30). It owns, in build-ready detail: Neo's honest limitations, a concrete mitigation for each, the FileVault/unattended-reboot RESOLUTION, the OBJECTIVE migration triggers, and the host-swap runbook that proves the architecture stays host-agnostic.
optimizes_around: ADR HOST-1 — Execution Node 1 = Neo (Apple Silicon MacBook). A reversible, host-agnostic DEPLOYMENT choice, not an architectural one.
extends:
  - docs/architecture/neo/00-ARCHITECTURE-execution-layer.md (NEO-ARCH-00 — §1.3 ADR HOST-1, §1.4 the risk ledger, §9 risks, §11 M-pre)
  - docs/architecture/neo/01-execution-node-and-cicd.md (NEO-ARCH-01 — launchd/colima/runner specifics)
  - docs/architecture/neo/02-tailscale-and-security.md (NTS-DOS-v1 — secrets bootstrap §F, break-glass §F.5, ADR-3 Ed25519)
  - docs/architecture/neo/03-heartbeat-and-monitoring.md (NEO-HBM-v1 — the watchdog, the recovery ladder Tier 0–6)
  - docs/architecture/neo/05-adversarial-challenge.md (NEO-ADV-05 — every TECHNICAL finding accepted here; its host-RESEAT superseded)
load_bearing_deliverable: §3 (the FileVault/reboot resolution) + §4 (the objective migration triggers) + §5 (the host-swap runbook). Together they make Neo honest to run now and trivial to replace later.
---

# Neo — Node-1 Operations + Migration (NEO-OPS-06)

> **Thesis.** Execution Node 1 = **Neo** (ADR HOST-1, founder-decided 2026-06-30). Neo is the right Node 1 *now* —
> current stage, owned hardware on hand, ~$0 marginal cost, immediate implementation velocity — and the
> architecture is **host-agnostic via the `ExecutionProviderPort`**, so the host is a **reversible deployment
> choice, not an architectural one.** The adversarial challenge (NEO-ADV-05) was right about the *technical* costs
> of a laptop-as-server; it was wrong to conclude those costs require re-seating the host *now*. This document does
> the honest work the decision demands: it **names every Neo limitation, pairs each with a concrete mitigation,
> resolves the FileVault/unattended-reboot contradiction with a real chosen approach, defines OBJECTIVE migration
> triggers, and writes the host-swap runbook** — so that when a trigger fires, replacing Neo is **node-registration
> + workload-drain, not redesign** (RPO 0; zero Project-Owner change).
>
> **The one rule that makes all of this true:** *no node holds essential state.* All durable state is on the
> Supabase bus (NEO-ARCH-00 §7, FEL-1). Neo is cattle, not a pet. Everything below either keeps Neo healthy as
> cattle, or describes swapping one head of cattle for another.

---

## 1. ADR HOST-1 (FOUNDER-DECIDED): Execution Node 1 = Neo, approved 2026-06-30

**Decision.** Execution Node 1 = **Neo (Apple Silicon MacBook).** A firm founder decision.

**Rationale.** Current stage, available hardware, operational cost, and implementation velocity — a **reversible
host-agnostic deployment choice, NOT an architectural one.** Neo is owned and on hand (zero procurement, zero lead
time), costs ~$0 marginal, and lets the build proceed today behind the `ExecutionProviderPort` rather than blocking
on hardware acquisition to maximize theoretical server characteristics the current stage does not need. Optimizing
for maximal server characteristics before they are needed is precisely the speculative scaffolding the framework
forbids (North-Star Waterline §8).

**Accepted (the challenge's TECHNICAL findings — incorporated below as Neo risks + mitigations):** the FileVault
boot behavior and unattended-recovery assumptions (§2.1 → resolved §3); colima / macOS-Docker overhead +
macOS-update breakage (§2.2); sleep/wake + App Nap killing the daemon (§2.3); thermals / lid-closed (§2.4);
single-machine SPOF (§2.5); the laptop-is-also-the-founder's-daily-driver contention (§2.6); consumer SSD/battery
wear (§2.7); the residential-ISP availability ceiling and portable-secret-theft posture (§2.8); and the
Ed25519 break-glass + co-equal deploy-token findings (§5.1, go-live preconditions). The demand for
migration-path documentation is accepted — **this document is that documentation** (§4, §5).

**Superseded.** The challenge's *host-RESEAT* recommendation — "re-seat Node 1 as Linux *now*, demote Neo." The
host is **agnostic by design**; the challenge proved a laptop has laptop-specific costs, not that those costs
exceed, *at the current stage*, the velocity + cost advantage of using owned hardware now. The migration off Neo is
a future **operational** step (§4 triggers → §5 runbook), not an architectural one.

**Author≠verifier is satisfied today.** The narrow point the challenge conceded — the verifier wants hardware the
author (Windows) does not control — is satisfied by Neo as a second, distinct node *now*. If a second node is ever
added for reliability, **it is added as a Linux node (reliability before re-seat, §4 trigger f)** — an addition,
not a migration.

---

## 2. Neo-specific limitations (honest, complete) + a concrete mitigation for each

The discipline: every limitation is **named at full strength** (no smoothing — Invariant §11), then paired with the
**concrete Neo mitigation that ships at M-pre/M0**, and the **objective trigger** (§4) that would move the workload
off Neo if the mitigation stops holding. Where a mitigation is non-trivial (FileVault), it is resolved in full in §3.

| # | Limitation (accepted, at full strength) | Concrete Neo mitigation NOW | If it bites → trigger |
|---|---|---|---|
| 2.1 | **FileVault / login-keychain unattended-reboot wall.** FileVault ON ⇒ a power-loss or forced reboot leaves the disk locked at a pre-boot screen; `LaunchDaemons` do not run until a human logs in (`pmset autorestart` does not bypass it). A boot daemon reading a *user-login* keychain may be locked even with FileVault off. The "minutes, automatic" RTO is false for the unplanned-reboot case. | **Resolved in §3:** FileVault stays ON + battery-as-UPS + `fdesetup authrestart` for planned reboots + an explicitly-accepted manual-login RTO for the rare unplanned reboot (watchdog pages) + **System-keychain/file-ACL secrets, never a login keychain.** | 4c (reboot outage > RTO) |
| 2.2 | **colima / macOS-Docker overhead + macOS-update breakage.** Docker on macOS is a Lima-VM layer (`colima`), not native dockerd; it *can break across a macOS major upgrade*, and while broken **CI has no test Postgres → all merges block.** | **Pin** `colima` + `postgres:16`; **autostart** colima via its Homebrew launchd service (`com.colima`) so the Docker socket is up before a job needs it; keep the VM **warm** (avoid cold-boot tax). A **macOS-update runbook** re-checks `docker info` / the socket *before* re-enabling required checks; the **one-line `runs-on` fallback** restores CI to GitHub-hosted while colima is repaired. `colima start --cpu 4 --memory 8`. | 4b (toil > 3h/wk) |
| 2.3 | **Sleep/wake + App Nap killing the daemon.** A laptop sleeps and App-Naps background processes; either silently stalls the worker mid-drain. `pmset`/`caffeinate` can be reset by some macOS updates. | `sudo pmset -a sleep 0 disablesleep 1`; `caffeinate -dimsu` wrapping the daemon; **App-Nap exclusion** on the worker process (`LSAppNapIsDisabled` / `NSAppSleepDisabled` for the daemon's domain); the **post-update runbook re-asserts `pmset`** as a checklist item. Engine-tick staleness ( `last_tick_at` > 60s) + the off-node watchdog catch any sleep that slips through (NEO-HBM Layer B/F). | 4b |
| 2.4 | **Thermals / lid-closed.** Sustained Docker/CI load heats a thin laptop; it throttles; lid-closed operation needs care. | **Clamshell on power** (lid-closed, external power, no display) is a supported macOS mode once sleep is disabled; **thermal pressure is probed** (`pmset -g thermlog` / `powermetrics`) and reported to the bus; CI job durations are tracked against the M1 parity baseline so throttling shows up as a measurable regression. | 4e (thermal/perf) |
| 2.5 | **Single-machine SPOF.** One machine concentrates CI + verify + the worker + deploy, owned by one person with no on-call. | **No node holds essential state** (durable bus); the **one-line `runs-on` rollback** restores CI; the worker **resumes on any node** from the bus (SKIP-LOCKED lease-reclaim, idempotent `completeAwaitingStep`). The off-node watchdog (Healthchecks push + Windows pull) converts silence into a page. Reliability redundancy is **a Linux Node 2 added first** when a driver fires (§4 trigger f). | 4d / 4f |
| 2.6 | **Laptop-is-also-the-founder's-daily-driver contention.** Neo may need to travel, sleep, or be used interactively — directly at odds with a continuous host. | When Neo is away/asleep, continuous autonomy is a **safe pause-and-resume** (in-flight local work runs to its next checkpoint then blocks holding no lease; new placements stop; Class-C fails closed) — **RPO 0, no data loss** (NEO-ARCH-00 §7.4). The **contention is measured** (node-offline-days vs total days). Sustained contention is a migration trigger, not a daily annoyance to absorb forever. | 4d (>20% offline-days) |
| 2.7 | **Consumer SSD / battery wear.** Laptop SSD + battery are consumer-grade and wear under 24/7 duty; a degraded battery **loses the UPS property** that §3 leans on. | **Warm-not-hammered duty:** a **coarse tick cadence** (15–30s, NEO-ARCH-00 §11 M0 — *not* 5s) caps write amplification on both the SSD and the Supabase pooler; **SMART + battery-health are probed** (`pmset -g batt`, `ioreg`/`system_profiler SPPowerDataType` max-capacity + cycle count) and reported to the bus. Battery health below threshold is itself a trigger. | 4c-adjacent (battery < 80%) |
| 2.8 | **Residential-ISP ceiling + portable-secret-theft.** Continuous-autonomy uptime is ceilinged by a no-SLA home ISP/power; a portable device holding `VERCEL_TOKEN` + pooler creds + break-glass material is a worse theft target (stolen-while-suspended, key-in-RAM). | The ISP ceiling is **stated in the DR table** (NEO-ARCH-00 §7.3, §9); a bus/ISP outage is a safe pause-and-resume. Theft posture: **FileVault ON** (§3); **Ed25519 break-glass before go-live** (the prod-signing key never lives on Neo, §5.1); **deploy-token co-equal control** (§5.1); instant Tailscale device-removal + secret-rotation (NTS §E.4). The battery covers power flicker (§3). | 4a (security, hard) / 4d |

**The honest summary:** roughly half of these (2.1–2.4, the keychain part of 2.1) are *macOS-laptop-specific* and
would not exist on a Linux server — that is exactly why they are the **axes the migration triggers (§4) measure.**
On Neo, each is mitigated to a known, bounded residual; none is silent; each is instrumented so that *if the
mitigation stops holding, a trigger fires objectively* rather than the founder absorbing creeping toil forever.

---

## 3. The FileVault / unattended-reboot resolution (the chosen approach + trade-offs)

This is the challenge's "most dangerous gap" — a direct contradiction between the security stream (FileVault ON) and
the node/HBM streams ("minutes, automatic" reboot recovery). It is resolved here for Neo with a real, chosen
approach, after honestly evaluating the three candidate mechanisms.

### 3.1 Decompose into two orthogonal decisions

The contradiction conflates two independent problems. Separating them is half the fix:

- **Decision A — the boot daemon's secret store.** *Independent of FileVault.* A `LaunchDaemon` runs as **root at
  boot, before any interactive login** — but a **user *login* keychain is locked until that user logs in.** So a
  boot daemon must **never** read a login keychain. **Chosen (non-controversial, ships regardless): read secrets
  from a System keychain (`/Library/Keychains/System.keychain`, root-readable at boot) or a file with strict perms
  (`chmod 600`, owned by `root` or `ci-runner`).** `config-doctor --enforce` / `i-config --include-local --enforce`
  fail-closes the daemon if any required key is absent/invalid — a half-bootstrapped node fails **loud, not silent.**
  This deletes the "keychain-locked-at-boot corollary" entirely, on either FileVault setting.

- **Decision B — FileVault on/off + unattended-reboot behavior.** *The real trade.* Resolved below.

### 3.2 The three candidate mechanisms, assessed honestly

**(a) FileVault ON + UPS + planned-reboots-only + accepted manual-login RTO + watchdog pages.**
Keep FileVault ON. Make unplanned reboots *rare* and planned reboots *unattended*; accept an explicit manual-login
RTO for the rare residual, with the off-node watchdog paging the founder to log in.
- *Soundness:* high. Power blips are the most common unplanned-reboot cause for a desktop — but **a MacBook's
  battery is a built-in UPS**, so a blip does not reboot Neo at all (the laptop's one structural advantage, which
  the original streams never claimed). The dominant *planned* reboot (a macOS update) is made unattended by
  **`sudo fdesetup authrestart`**, which holds the FileVault key in memory for **exactly one** reboot so the
  machine comes back to a booted, unlocked state with no human at the screen. The residual — a kernel panic or a
  multi-hour outage that fully drains the battery — is genuinely rare, and the founder is typically *co-located
  with their own daily-driver laptop*, so a manual login is usually fast.
- *Trade:* the rare unplanned reboot is **not** "minutes, automatic" — it is a paged, founder-present
  manual-login event. We state that honestly (§3.4) instead of claiming auto-recovery.

**(b) A pre-login mechanism to bring services up "before interactive login without defeating FileVault."**
- *Assessment: partially sound, and we adopt its sound parts — but it does NOT, on its own, solve the cold-boot
  wall.* A `LaunchDaemon` *does* run before interactive GUI login — **but only after the boot volume is mounted and
  unlocked.** With FileVault ON, the volume is **not** unlocked until someone authenticates at the pre-boot screen
  (or `authrestart` pre-stored the key). **There is no macOS mechanism to run code before the FileVault volume is
  unlocked — that is the entire security guarantee of FileVault.** So (b)'s "before interactive login" win is real
  and we *use* it (the root daemon + colima + the runner all autostart at the loginwindow stage, before any GUI
  login, reading System-keychain secrets per Decision A) — but it presupposes an unlocked volume, which after a
  cold power-loss still requires a human or `authrestart`. **Verdict: (b) is a sound *component* (we take its
  root-LaunchDaemon + System-keychain parts), not a standalone solution.** Claiming it defeats the FileVault reboot
  wall would be false.

**(c) FileVault OFF + home physical security + System-keychain + no tree-resident secrets.**
- *Assessment: gives true unattended boot, but the wrong trade for a portable device.* FileVault OFF means the
  volume is always mounted: the root daemon runs at boot, reads its System-keychain/file secrets, and reaches
  `/ready` green with **no human** — the unattended-recovery the streams wanted. **But the disk is plaintext at
  rest.** "No tree-resident secrets" does **not** help here: the secrets are not in the git tree, they are in the
  System keychain / a file *on that disk* — a stolen or borrowed powered-off laptop yields `VERCEL_TOKEN`, pooler
  creds, and break-glass material directly. For a **portable** device this is a materially worse theft posture
  (the exact risk §2.8 names). **Verdict: (c) is the correct answer for a *non-portable* host (a bolted-down mini-PC
  or a cloud VM — the migration target), and the wrong answer for Neo-the-laptop.** We explicitly *defer* (c) to
  the migration target, where unattended encrypted boot is anyway a solved pattern (TPM / clevis / network-bound
  LUKS) that gives both unattended boot *and* at-rest encryption.

### 3.3 The chosen approach

**Decision A (always): System-keychain / file-ACL secrets for the boot daemon — never a login keychain.**

**Decision B (Neo): option (a), combined with option (b)'s sound components.** Concretely:
1. **FileVault stays ON** — Neo is a portable prod-adjacent secret store; at-rest encryption is non-negotiable for a
   laptop (preserves the theft posture of §2.8).
2. **Battery-as-UPS** — keep Neo on power, lid-closed clamshell; the battery absorbs power flickers so the dominant
   unplanned-reboot cause is a non-event. Battery health is monitored (§2.7); a degraded battery is a trigger (4c).
3. **Planned reboots are unattended** — every deliberate reboot (notably macOS updates) goes through
   `sudo fdesetup authrestart`, so Neo returns to a booted, unlocked state and the root `LaunchDaemon` +
   `com.colima` + the ephemeral runner all autostart and reach `/ready` green with **no human**.
4. **The rare unplanned reboot takes an accepted manual-login RTO** — a kernel panic or fully-drained battery leaves
   Neo at the pre-boot FileVault screen; the worker does **not** auto-recover; the **off-node watchdog pages the
   founder to log in** (Healthchecks grace 5–10 min + the Windows pull), so detection is fast and the RTO clock
   never starts late. During the outage, work is **paused and durable** (safe pause-and-resume; RPO 0).
5. **Boot daemon secrets** come from the System keychain / file-ACL per Decision A; `config-doctor --enforce` gates
   daemon start.

**Why this is right for Neo specifically (not a generic server):** the battery makes the most-common unplanned
reboot a non-event (Neo is *better* than a naked mini-PC here); `authrestart` makes the most-common *planned* reboot
unattended; FileVault-ON keeps the portable secret store encrypted; and the only residual is rare, detected, and
non-data-losing. We trade a small, paged, founder-present RTO on rare events for a correct theft posture on a
portable device — a deliberate, stated trade, not an assumed-away one.

### 3.4 The honest RTO restatement (replaces "minutes, automatic")

| Reboot event | Frequency | Recovery | RTO |
|---|---|---|---|
| **Planned reboot** (macOS update, deliberate restart) | the common case | `fdesetup authrestart` → autostart → `/ready` green, **no human** | **minutes, automatic** |
| **Power flicker** | common in a home | **absorbed by the battery — no reboot occurs** | **0 (no event)** |
| **Unplanned reboot** (kernel panic / battery fully drained) | **rare** | pre-boot FileVault screen → **watchdog pages** → founder logs in → autostart → `/ready` green | **manual-login RTO: target ≤ 2 h waking-hours; longer if the founder is unreachable — and that excess is measured (trigger 4c)**; work paused + durable throughout (RPO 0) |

### 3.5 The cold-boot recovery test (a go-live M-gate, run at M4/M5)

The existing validation plan only kills the *process* (NEO-HBM Tier 0). This adds the machine-level tests that
exercise the case that actually rots:
1. **Planned-reboot test:** `sudo fdesetup authrestart` → assert Neo reboots, and the worker daemon + `com.colima` +
   the ephemeral runner autostart and `/ready` goes green and the Healthchecks ping resumes — **with no human
   interaction after the command.**
2. **Unplanned-reboot test:** hard power-cycle with FileVault locked → assert Neo sits at the pre-boot screen, the
   worker does **not** come up, and the **off-node watchdog pages within grace** (Healthchecks 5–10 min + Windows
   pull) → founder logs in → assert recovery to `/ready` green. **This proves the residual is detected, not silent.**
3. **Keychain test:** boot with no GUI login → assert the daemon reads its secrets from the System keychain/file
   (not a login keychain) and `config-doctor --enforce` passes.

---

## 4. Objective migration triggers — measurable thresholds that fire "move Node 1 off Neo"

These convert "Neo is right *for now*" from a vibe into **instrumented, objective thresholds.** Each names: the
**threshold**, **how it is measured** (which heartbeat/metric/log surfaces it), and the **action**. They are
instrumented at **M-pre** (the tripwires) so the data exists before it is needed. A trigger firing is a *signal to
execute §5*, not an emergency — the swap is reversible and RPO 0.

> **Reliability before re-seat (the ordering rule).** When the appropriate response is "more reliability," the first
> move is to **add a Linux Node 2** (trigger f), *not* to re-seat Node 1. Adding Node 2 often relieves the very
> pressure that would have triggered a re-seat; if Node 1 still needs to move afterward, the swap is then trivial
> (Node 2 is already a parity-proven spine candidate).

| # | Trigger | Threshold (objective) | How it is MEASURED (the surface) | Action |
|---|---|---|---|---|
| **4a** | **2nd human contributor OR public repo / external fork** *(security — HARD/IMMEDIATE)* | Any one of: repo visibility flips to **public**; a collaborator/CODEOWNERS entry **beyond the founder**; a `pull_request`/fork-origin run from a **non-founder identity** in Actions logs. | A scheduled **GitHub repo-settings probe** (visibility + collaborators API) + a **CODEOWNERS diff** + an **Actions-log scan** for fork-origin PR runs → surfaced on the I-Ops status page + a **P1 page**. | **Immediate.** Self-hosted runner on untrusted code needs far stronger isolation than a non-admin user — flip untrusted-PR checks back to **GitHub-hosted (one-line `runs-on`)** *now*, and run §5 to move Node 1 off the portable laptop to a hardened host. (Same re-evaluate trigger as NEO-ARCH-00 §6.6.) |
| **4b** | **Laptop-specific ops toil too high** | **> 3 hrs/week** of laptop-specific ops toil over a **rolling 4-week** window (colima/macOS-update/sleep/keychain/thermal incidents). | An **incident/toil ledger** on the durable bus: each ops incident is logged with a duration + a `laptop_specific: bool` tag; a **SQL view** sums the rolling window → a **rolling-toil gauge** on the status page. | **Scheduled migration** — provision the Linux node and run §5. The laptop-specific class largely disappears on Linux. |
| **4c** | **A reboot/FileVault outage exceeded the RTO, or the UPS property is lost** | **≥ 1** reboot-caused node-down event whose duration **> the agreed manual-login RTO** (≤ 2 h, §3.4); **OR** battery max-capacity **< 80%** / cycle count beyond rating. | **Healthchecks downtime log + the Windows-pull downtime record** give outage duration; the incident is classified (reboot/FileVault). **Battery health** from a scheduled `pmset -g batt` / `ioreg` probe → status-page **downtime log + battery gauge.** | **Scheduled migration** — the FileVault wall has materially bitten (or the battery-UPS premise of §3 no longer holds); move to Linux unattended-encrypted-boot via §5 (or replace the battery if that alone restores the premise). |
| **4d** | **Continuous-uptime need conflicts with the founder needing the laptop** | The node is **offline > 20% of days** over a **rolling 4-week** window due to the laptop traveling/sleeping (planned-offline, not a crash). | **Tailscale device-list "last seen" + `engine_heartbeat` gaps** give per-day online coverage; a **daily rollup** counts days with a significant planned-offline window → an **uptime-coverage gauge** on the status page. | **Scheduled** — prefer **add a Linux Node 2 for reliability** (trigger f) so coverage no longer depends on Neo; re-seat Node 1 only if contention persists after. |
| **4e** | **Thermal throttling / perf degradation under sustained load** | Sustained **thermal throttling** under Docker/CI load (`pmset -g thermlog` / `powermetrics` thermal level above nominal sustained), **OR** CI job **p50 duration regresses > 30%** vs the M1 parity baseline over a rolling window. | A periodic **thermal probe** + the durable bus's **per-job duration metrics** (already captured) compared to the **M1 parity baseline** → status-page **thermal gauge + CI-duration trend.** | **Scheduled migration** (or add a capacity node, §7.5 step 3) — Neo is being asked to do server-grade sustained work; move it to hardware built for it. |
| **4f** | **Fleet reaches N ≥ 2** *(reliability before re-seat)* | Any reliability/capacity/burst driver fires (NEO-ARCH-00 §7.5) justifying a second node. | The **node registry count** + the driver that justified it. | **Add a Linux node as Node 2 for reliability FIRST.** This is an *addition*, not a migration; it satisfies author≠verifier on neutral non-laptop hardware and may itself relieve 4d/4e pressure. If Node 1 still needs to move, §5 is then trivial. |

---

## 5. The host-swap runbook (Neo → Linux) — the host-agnostic proof

When a trigger (§4) fires, migrating Node 1 off Neo is **node-registration + workload-drain, demonstrably NOT a
redesign.** The Project-Owner emits a provider-agnostic `ExecutionRequest` and **never names a machine** (NEO-ARCH-00
§7.1); every durable state lives on the Supabase bus; so swapping the host is registry + drain, and **RPO is 0.**
This is the cattle-not-pets path made concrete.

### 5.1 Go-live preconditions carried forward (accepted findings — gate the *current* Neo go-live, and every host after)

These are **accepted** from the challenge and are preconditions before Neo (or any host) becomes the **standing**
prod-write/deploy path:
1. **Ed25519 break-glass (ADR-SEC-3) — BEFORE go-live.** Migrate break-glass from HMAC to asymmetric: the **private
   signing key lives only on the founder's device**, Neo ships only the public key to verify → a compromised
   execution node **cannot mint a grant at all.** A portable always-on node is the worst place for a symmetric
   prod-signing key; do this before Neo is the standing prod-write consumer (before M3/M5 land as the standing path).
2. **The deploy token is a CO-EQUAL prod-mutation path — give it a co-equal control.** `VERCEL_TOKEN` can deploy
   attacker code to prod as the founder, bypassing break-glass entirely. Before it becomes the standing path:
   **deploy author≠verifier, a deploy-approval gate, or a token that cannot self-serve a prod deploy without a
   second factor.**
3. **Bound the break-glass `(table, op)` set** ("scoped" is unproven until enumerated) and **state plainly that the
   off-node watchdog covers *availability*, not *integrity*** (a compromised node can suppress/fake its `/ready`
   ping; detecting a *lying* node needs an unforgeable integrity signal — named, deferred).
4. **The six hard preconditions (NEO-ARCH-00 §6.6):** ephemeral runner · non-admin `ci-runner` · ACL outbound-only
   for `tag:ci-runner` (the `tests[]` block proves it) · off-node push-watchdog · no Funnel · never
   `pull_request_target` on a self-hosted runner.
5. **The §3 FileVault resolution + System-keychain secrets + the §3.5 cold-boot recovery test passing.**

These travel with the *role*, not the host — a Linux replacement inherits the same gate (Ed25519 already keeps the
key off *any* node; on Linux the cold-boot test passes trivially via unattended LUKS).

### 5.2 The swap, step by step (Neo → `linux-node3`)

1. **Provision the new node.** Stand up the Linux host (mini-PC or cloud VM): OS, **native dockerd** (no colima),
   **systemd** unit (`Restart=always`, `WantedBy=multi-user.target` — the launchd→systemd swap, NEO-ARCH-00 §2.4),
   the Node toolchain matched per-repo (Node 22.x PLOS / 20 admin), the Vercel CLI pin, `tailscaled`. **Encrypted
   disk with unattended boot** (TPM / clevis / network-bound LUKS) — option (c) of §3 is now the *correct* trade on
   a non-portable host.
2. **Join the tailnet.** `tailscale up` with **`tag:exec-node`** (+ `tag:ci-runner`); the founder device-approves;
   MagicDNS name `linux-node3`. **No ACL change is needed** — the tag vocabulary and the `tests[]` block already
   cover `tag:exec-node` (NTS §D). This is why the fabric was chosen at the foundation: adding a node is a *join*,
   not a network project.
3. **Vendor secrets.** The founder seeds the new node's keystore (systemd-creds / file-ACL — the Linux analog of the
   §3 System keychain) from the **authoritative platform stores** over Tailscale SSH — the *same* bootstrap as Neo
   (NTS §F.2). `config-doctor --include-local --enforce` confirms completeness **fail-closed** before the daemon
   may start. No secret is ever tree-resident.
4. **Register the adapter.** Add the `ExecutionProviderPort` registry entry: `nodeId: linux-node3`,
   `labels: [self-hosted, linux, pg, vercel-token, …]`, `trustDomain: trusted`, implementing `canAccept` + `execute`.
   **The Project-Owner does not change** — `placement_req` is unchanged; this is the §44 acceptance test (adding a
   node = zero PO change).
5. **Parity-prove.** Run a **non-required duplicate** of `ci` on `linux-node3`; assert **byte-identical verdicts**
   vs Neo / GitHub-hosted on the same commit (the M1 parity discipline). Author≠verifier is preserved — `verify`
   jobs are placed on a node the author does not control, by policy.
6. **Drain Neo's workload via lease-reclaim.** Mark Neo **drain-only** (`canAccept` returns false for new work).
   In-flight **leased** steps complete or their **lease expires**; the **SKIP-LOCKED** tick on `linux-node3`
   **reclaims expired leases from the last durable checkpoint** — `completeAwaitingStep` is idempotent + CAS-guarded
   ⇒ **no double-execute**, **RPO 0** (all state on the bus). Only checkpoint-granular in-flight work is re-run
   (bounded by `budget`), never lost (FEL-2).
7. **Move the standing roles.** Flip `runs-on` for required checks to `linux-node3` **one at a time**, watching the
   required-check status (the M3 discipline). Move the **worker daemon** role (the new node's daemon starts ticking;
   Neo's stops — leasing makes a brief overlap safe). Move **deploy** (`VERCEL_TOKEN` seeded on the new node; with
   Ed25519 already in place per §5.1, the prod-signing key was never on either node).
8. **Deregister Neo.** Remove Neo's adapter from the registry; `tailscale logout` / remove the device; **rotate
   every Neo-resident secret** (deploy token, pooler creds, any break-glass material) via the config platform —
   the standard compromise-hygiene runbook (NTS §E.4). **Neo returns to being a laptop** — or stays as the
   *optional, non-continuous* verify/burst node (the role the design assigned the Mac Studio), if a Mac is ever
   genuinely useful.

### 5.3 Why this proves host-agnosticism

Every step above is **provision · join · register · drain · deregister** — registry entries and a lease-drain, with
**zero Project-Owner change**, **zero architectural change**, and **RPO 0** because no node ever held essential
state. The design "Node 1 is swappable by registering a different adapter" is not an assertion here; it is a runbook.
**Neo now, Linux later, is the same architecture with a longer registry** — exactly the reversibility ADR HOST-1
relies on.

---

## 6. Scope honesty — what this document does and does not do

- It **installs nothing** — no node provisioned, no FileVault toggled, no `authrestart` run, no secret moved, no
  trigger instrumented, no test executed. It is a design for the founder gate + the §11 panel.
- It **optimizes around** the founder decision (ADR HOST-1 = Neo); it does **not** re-litigate the host. The
  challenge's host-reseat is superseded; its technical findings are retained as §2 risks + §3/§5 resolutions.
- It defers, with **named objective triggers (§4)**, everything that is not proportionate at the current stage —
  the Linux re-seat, the Linux reliability Node 2, the unattended-LUKS host — each *built when its trigger fires*
  (Waterline §8), never speculatively.
- Where this file disagrees with a canonical source under `core/`, the **canonical source wins — fix this file.**

*End of NEO-OPS-06 — Neo node-1 operations + the host-agnostic migration path. Design only; installs nothing.*
