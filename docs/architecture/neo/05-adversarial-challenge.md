---
artifact: ADVERSARIAL CHALLENGE to the Neo Execution-Layer Design (refute-first hardening review)
id: NEO-ADV-05
date: 2026-06-29
status: REVIEW — READ-ONLY. Attacks the four Neo design streams (01–04) + the EIB blueprint BEFORE any build authorization. Installs nothing, changes no infra. Its product is a verdict per load-bearing claim and a premise recommendation.
role: adversarial reviewer (author≠verifier — this doc does NOT endorse; it refutes, and concedes only what genuinely survives)
reviews:
  - docs/architecture/neo/01-execution-node-and-cicd.md (NEO-ARCH-01)
  - docs/architecture/neo/02-tailscale-and-security.md (NTS-DOS-v1)
  - docs/architecture/neo/03-heartbeat-and-monitoring.md (NEO-HBM-v1)
  - docs/architecture/neo/04-future-execution-layer.md (FEL-DOS-v1)
  - docs/reviews/EXECUTION-INFRASTRUCTURE-BLUEPRINT-2026-06-29.md (EIB-DOS-v1)
bottom_line: RETHINK THE PREMISE (node 1 should be an always-on Linux host, not the laptop), THEN approve-with-changes. The architecture ABOVE the node is sound; the specific choice of a MacBook as the CONTINUOUS execution host is rationalized sunk cost the design itself half-concedes.
---

# Adversarial Challenge — The Neo Execution Layer (NEO-ADV-05)

> **Stance.** The four streams are well-argued and unusually honest — which is exactly why an adversary is
> useful: an honest design that has *named* a risk often believes it has *neutralized* it. Several "mitigations"
> here reduce **blast radius** (good) while leaving **standing toil**, **availability ceilings**, and **a wrong
> host choice** untouched — and the streams reason *downward from a given* (Neo = node 1) rather than *up to the
> premise*. This doc rates each load-bearing claim SURVIVES / WEAKENED / REFUTED with evidence, then gives an
> overall verdict.
>
> **The one-sentence finding:** the design proves *that you can run this on Neo* and *that a node is replaceable*;
> it never proves *that a laptop is the right node to run it on* — and on the questions where the laptop is the
> wrong answer (unattended reboot, macOS-update churn, sleep/thermal, theft of a portable secret store) it either
> assumes the good case or schedules the fix as "the very next node," which is a tell.

---

## 0. Scorecard (read this first)

| # | Load-bearing claim | Verdict |
|---|---|---|
| 1 | "GO — a solo founder can sustain this." | **WEAKENED** — reversibility bounds blast radius, not standing toil or one-human MTTR. |
| 2 | "Neo (a MacBook) is the right execution host / node 1." | **REFUTED (premise)** — the design's own roadmap concedes Linux-should-be-next-for-reliability; only sunk cost makes the laptop first. |
| 3 | "Self-hosting fixes the cost/minutes problem." | **WEAKENED→REFUTED (framing)** — the dominant drain is killed by a *free SaaS*, not by a self-hosted Mac runner; real costs (Supabase/Vercel) are unchanged and staging *adds* spend. |
| 4 | "The off-Neo watchdog is failure-domain independent." | **WEAKENED** — independent of *Neo's* domain (good, sufficient for laptop-death) but NOT of Supabase, a common point under runtime + observability. |
| 5 | "launchd auto-recovers the daemon after a reboot (minutes, automatic)." | **REFUTED** — contradicts the design's own FileVault recommendation + the login-keychain-locked-until-login problem; an unattended reboot does NOT recover. |
| 6 | "Home network / physical layer is handled." | **PARTIALLY SURVIVES** — Tailscale genuinely solves dynamic-IP/NAT; the laptop battery is an unclaimed UPS win; but residential-ISP availability ceiling + portable-secret-theft are real and unforegrounded. |
| 7 | "Ed25519 break-glass is the single highest-leverage hardening." | **SURVIVES (finding) but OVER-stated (leverage)** — the co-located VERCEL_TOKEN is a co-equal prod-mutation path Ed25519 doesn't touch; the symmetric-trust pattern recurs, including in the watchdog itself. |

**Most dangerous gap:** the **FileVault / login-keychain unattended-reboot contradiction** (Challenge 5) —
it silently falsifies the "automatic recovery, minutes-RTO" backbone shared by all five docs, and nobody
reconciled the security stream (recommends FileVault) with the node/HBM streams (claim auto-reboot recovery).

---

## Challenge 1 — "GO, a solo founder can sustain this."

**The claim.** EIB §13 / NEO-ARCH Risks / NTS §G / HBM §9 all land on **GO**, framing the solo-SRE burden as
"mitigated, not removed," with the load-bearing mitigation being **reversibility** ("flip one `runs-on` line").

**Verdict: WEAKENED.**

**Evidence — tally the actual standing surface ONE person must keep alive** (assembled from across the four docs):

1. launchd worker daemon (`com.deliveryos.worker`) — KeepAlive, log rotation, the 5s tick (NEO-ARCH A.3)
2. ephemeral GitHub Actions runner agent — **auto-updates, "can break … silently fail jobs"** (Stack table, own words)
3. colima + `postgres:16` — **"sometimes breaks across a macOS major upgrade"** (Stack table, own words)
4. Tailscale + the HuJSON ACL policy + `tests[]` block (NTS §D)
5. Healthchecks.io account + ping config (HBM §4)
6. Windows Scheduled-Task backup watchdog (HBM §4.2)
7. off-Neo Vercel status page — a deployed SSR app reading Supabase (HBM §8)
8. **permanent staging** — a *net-new* Vercel project + Supabase staging branch (NEO-ARCH B.3.4)
9. key rotation: `VERCEL_TOKEN`, pooler creds, `CRON_SECRET`, break-glass material (NTS §F)
10. macOS updates (the headline break vector, admitted four times)
11. `pmset`/`caffeinate` sleep-defeat config that must *survive* those updates (NEO-ARCH A.4)
12. disk prune / colima disk cap / `newsyslog` rotation (NEO-ARCH A.4, HBM §5)
13. Supabase backup **+ periodic proof-of-restore** ("an untested backup is not a backup," ADR-FEL-3)
14. M1 parity re-proof on every toolchain bump or check move (EIB §15)

That is **~14 standing surfaces**, not "one machine." The design's central mitigation — *reversibility* — is a
property of **blast radius** (a failure is recoverable in one line). It does **nothing** to reduce the **number of
things that can rot**, the **mean-time-to-repair bounded by exactly one human**, or the fact that **continuous-
autonomy availability is now capped by that human's availability to repair** (asleep / travelling / ill / on a
plane = CI and autonomy are down for the duration, and the watchdog converts that into a *ping*, not a *fix*).
The docs conflate "small blast radius" with "sustainable." They are different axes; only the first is addressed.

**Honest weekly-maintenance estimate (the docs never give a number — that omission is itself a finding):**
- **Steady state:** ~1–3 hrs/week — digest triage, the weekly-green check (HBM §7), a dashboard glance, the
  occasional token rotation. Tolerable.
- **But the cost is variance, not mean.** Spiky incidents dominate: a macOS update breaks colima → **all merges
  blocked until fixed** (CI has no test Postgres); a runner auto-update breaks → **merges blocked**; a FileVault
  reboot → **silent outage until physical login** (Challenge 5); an ISP outage → autonomy paused. Each is
  hours-to-days, and roughly **half of these toil sources (colima/macOS-update, FileVault, App-Nap/sleep,
  keychain-lock) are macOS-laptop-specific** and would simply not exist on a Linux node.

**Corrected claim.** *"GO is acceptable on blast-radius grounds, but the design has not minimized the standing
surface — and the standing surface, not the blast radius, is what decays. ~Half the recurring toil is
laptop-specific and avoidable. The honest framing is: a real part-time SRE tax with high variance, whose mean is
survivable only if the surface is first minimized — which points directly at Challenge 2."*

**Must-add work item.** A *standing-surface budget*: enumerate every always-on component and justify each against
"could a host choice or a SaaS delete it?" The exercise itself selects a Linux node 1 and kills items 3, 11, and
the Challenge-5 class.

---

## Challenge 2 — "Neo is the right execution host." (ATTACK THE PREMISE)

**The claim.** Neo (an Apple MacBook) is **Execution Node 1** — the continuous host for verify + CI + the
autonomy worker + deploy (NEO-ARCH thesis; EIB §3–4).

**Verdict: REFUTED on the premise.** (The narrow author≠verifier-needs-a-second-node point survives; the choice
of a *laptop* as the *continuous* host does not.)

**Evidence — the design refutes itself.** FEL-DOS §6.1/§6.3 and §10 say, in the design's own words:
- the first node to add after Neo is **"a Linux node for reliability (a redundant home for the continuous
  workload — the first add, for SPOF removal not capacity)"**;
- the Mac Studio step **"buys a *proper* always-on host so the MacBook returns to being a laptop"**;
- the growth order is **"reliability before capacity before burst."**

So the design *already knows* (a) the laptop is not a proper always-on host, and (b) the very next move is to put
the continuous workload somewhere more reliable. The only argument offered for laptop-**first** is sunk cost:
**"already-owned hardware: ~$0 marginal"** (EIB §0.5/§14). That is a financing argument, not an engineering one.

**Why the laptop is the wrong *first* continuous node — point by point the design under-weighs:**
- **No macOS-specific workload exists in this portfolio.** It is Node + Postgres + Vercel web apps (PLOS,
  rumah-admin). The one thing only a Mac can do (iOS/macOS builds) is **named nowhere**. So the Mac's unique
  capability buys nothing here, while its unique costs (colima indirection, 10×-billed macOS minutes on the
  *fallback*, macOS-update churn, FileVault, App Nap) are all paid.
- **A cheap always-on Linux mini-PC (~$150–350 one-time; N100/used SFF):** Docker-native (no colima, no Lima VM
  layer, no macOS-upgrade break), built to run headless lid-never-an-issue, full-disk-encryption-with-unattended-
  boot is a *solved, documented* pattern (TPM/clevis/network-bound LUKS) — deletes the entire Challenge-5 class.
- **A $5–20/mo cloud VM (e.g. Hetzner ~$5):** removes home ISP, home power, and physical theft from the model
  entirely; datacenter connectivity; a real server. At "$0–5/mo electricity" the design's own cost framing, a
  $5/mo VM is **economically indistinguishable** while being operationally far superior for the continuous role.
- **"Just pay GitHub Actions + a Vercel/Supabase tier":** weakest alternative for the *continuous-worker* need
  (the cron drain genuinely wants a host) — but see Challenge 3: the *minutes* part of the problem does not need a
  self-hosted runner at all.

**What survives:** author≠verifier wants the verifier on hardware the author (Windows) doesn't control. True — but
that is satisfied by **any** second node; a Linux box satisfies it *better* (cheaper, more stable). "Two nodes" is
right; "the second node must be this laptop" is not.

**Corrected claim.** *"Execution Node 1 (the continuous host: worker daemon + CI + deploy) should be a cheap
always-on Linux host — a home mini-PC or a $5/mo cloud VM. Neo (the laptop) should occupy the role the design
itself assigns the Mac Studio: an optional, non-continuous node, usable for neutral-hardware verify if ever a Mac
is needed — never the autonomy spine."* This reorders the build plan: Linux is M1, not "step 2, later."

**Must-add work item.** A one-page node-1 trade study (laptop vs Linux mini-PC vs $5 cloud VM vs pay-the-meter)
that the design conspicuously skips — EIB §14 compares Neo only against GitHub-hosted, never against the obvious
middle option, which is precisely the comparison that decides this.

---

## Challenge 3 — "Self-hosting fixes the cost/minutes problem."

**The claim.** Self-hosting on Neo solves the exhausted-minutes forcing function (EIB forcing_function, §2, §14).

**Verdict: WEAKENED, bordering REFUTED on framing.**

**Evidence — decompose the actual drain (EIB §2's own arithmetic):**
- **Dead-man cron: ~8,640 billed min/mo = 2.9× the entire budget, before any PR.** This single line *is* the
  forcing function. Its fix is to move the dead-man **to Healthchecks.io — a free off-Neo SaaS** (HBM §4). **That
  is not self-hosting a runner; it is deleting a cron.** The dominant cost is captured with zero Neo involvement.
- **Heartbeat + goal-supervisor (~10,080 latent min):** these need a *worker that owns its clock* — a genuine
  host need. But that host can be **any** owned box or a $5 VM; it does not imply a self-hosted *GitHub runner* on
  a *Mac*.
- **Per-PR CI fan-out:** *this* is what the self-hosted runner addresses — and it is the **smaller** drain, and
  the design keeps **GitHub-hosted as the fallback that "burns the very minutes we left"** (EIB §6, ADR-004). So
  the runner reduces minutes only while Neo is healthy; every Neo outage re-incurs them.

**The costs that do NOT move (and the ones that grow):**
- The durable bus stays on **Supabase**, deploys on **Vercel**, git/PR/branch-protection on **GitHub**. This is a
  self-hosted *runner in front of unchanged SaaS* — the real recurring spend (Supabase + Vercel) is **untouched**.
- **Permanent staging is net-new spend** (NEO-ARCH B.3.4): a new Vercel project + a Supabase staging branch.
- **Unpriced Supabase load transfer:** the tick goes from cron `*/5` (288/day) to a 5s internal timer
  (**17,280/day — 60×**), each tick an `engine_heartbeat` upsert + a SKIP-LOCKED scan against the pooler, 24/7.
  "$0 because there is no per-invocation meter" is true of GitHub's meter and **false of Supabase's** — compute,
  connection-minutes, and pooler pressure are real, and a free-tier project will throttle/pause. The cost was not
  eliminated; it was **moved from a meter the design dislikes to one it doesn't count.**

**Corrected claim.** *"Killing the cron drain — via Healthchecks.io (free) plus a worker daemon on any owned host
— captures ~90% of the minutes saving and requires no self-hosted runner. The self-hosted *runner* is a separate,
smaller optimization on per-PR CI, partly undone by its own GitHub-hosted fallback, and its host need not be a
Mac. Self-hosting does not 'fix the cost problem'; it relocates compute while the real bills (Supabase, Vercel)
stand and staging adds to them. Count the 60× Supabase tick load before claiming $0."*

**Must-add work item.** Price the M0-only world (Healthchecks + worker daemon, no runner move) against the full
Neo build. If M0 alone returns the meter under budget, the runner migration must justify itself on *its own*
merits (latency, neutral-hardware verify), not on the minutes crisis it does not own.

---

## Challenge 4 — The off-Neo watchdog's independence.

**The claim.** The dead-man's-switch lives on a **"genuinely independent failure domain"** (HBM §4, ADR-001); the
status page **"survives Neo being down"** (HBM §8).

**Verdict: WEAKENED.** (Independent of *Neo's* hardware/power/network domain — the case it most needs — SURVIVES.
The blanket "failure-domain independent" is overstated.)

**Evidence — map the shared dependencies on Supabase:**
- The durable bus **is** Supabase. The worker's liveness is an `engine_heartbeat` row **in** Supabase. The
  `/ready` gate (which **gates the Healthchecks ping**, ADR-003) checks **"DB reachable" = Supabase**. The status
  page reads **Supabase** directly. The Windows pull-watchdog pulls **`/ready`**, which 503s when **Supabase** is
  unreachable.
- Therefore **Supabase is a common-mode dependency under the runtime AND its primary observability.** Walk a
  Supabase outage:
  - worker can't drain → `/ready` 503 (DB unreachable) → Neo **stops pinging Healthchecks** → Healthchecks pages
    **"Neo down."** But Neo is *up*; Supabase is down. **The watchdog misattributes the fault.**
  - the founder, paged, opens the "one place to look" — the status page — which **reads Supabase** and is
    therefore **dark or stale exactly when needed.** HBM §9.5 admits this as residual #5, yet §8 still markets the
    page as the surface that "survives Neo being down." It survives *Neo* down; it does **not** survive *Supabase*
    down, which is the more catastrophic case (Supabase is the crown jewel).
- Only **two** signals are genuinely Supabase-independent: the Healthchecks dumb-timer ("a ping stopped") and the
  Tailscale device list ("the node has power"). Both are crude up/down; neither tells the founder *what* broke,
  and the rich path is blind precisely when the crown-jewel dependency fails.

**What survives.** For the threat the watchdog exists to catch — **Neo dead** (power, panic, network, daemon) —
Healthchecks and the Windows task share none of Neo's hardware/power/network. That independence is real and
sufficient for the laptop-death case. Good.

**Corrected claim.** *"The watchdog is independent of Neo's hardware/power/network domain (sufficient for
laptop-death). It is NOT independent of Supabase, a common point under the runtime, the `/ready` gate, AND the
status page — a Supabase outage simultaneously halts the runtime, misattributes the page to 'Neo down,' and
blinds the rich observability, leaving only two crude signals."*

**Must-add work item.** Disambiguate Neo-fault from Supabase-fault. The design *has the seam*: `/health`
(liveness, **no DB**) vs `/ready` (readiness, **checks DB**). Point the Windows pull-watchdog at **both** `/health`
(is Neo's process alive, Supabase-independently) **and** a **direct Supabase probe** — so the page can say "bus
down, Neo fine" instead of a false "Neo down." Without this, the first real Supabase outage will send the founder
chasing a healthy laptop.

---

## Challenge 5 — macOS-as-a-server: unattended reboot survival.  ← MOST DANGEROUS GAP

**The claim.** "launchd `LaunchDaemon` runs at boot, before any login … restarts on crash … re-reads durable
state … minutes, automatic" (NEO-ARCH A.3, recovery Tiers 0/6; EIB §11 RTO "minutes (auto)"). This auto-recovery
is the backbone of every DR/RTO number in all five docs.

**Verdict: REFUTED.** The design **assumes** unattended-reboot survival; it does not hold on a FileVault Mac, and
the docs contain a direct internal contradiction nobody reconciled.

**Evidence — the FileVault contradiction (a seam failure between two streams):**
- The **security stream recommends FileVault**: NTS §E.4 lists "Disk encryption (FileVault/BitLocker) on the
  laptop" as the protection for the **laptop-stolen** row, and §G's blast-radius analysis leans on the disk being
  encrypted. For a portable device holding `VERCEL_TOKEN` + pooler creds + the break-glass key, FileVault
  **should** be on.
- The **node/HBM streams claim automatic post-reboot recovery** (above).
- **These are incompatible.** With FileVault ON, after a power-loss reboot or a forced restart, the data volume is
  **locked**; macOS boots to a **pre-login FileVault unlock screen**, and **LaunchDaemons do not run until a human
  physically logs in** and unlocks the volume. `pmset autorestart` does not bypass it; `fdesetup authrestart` is a
  **manual, one-shot, pre-arranged** command, useless for an *unattended* power-blip. So: **FileVault on ⇒ a power
  blip = silent outage until someone walks to the machine** — the opposite of "minutes, automatic." FileVault off
  ⇒ a stolen laptop's Keychain + secrets are exposed, undercutting the §G theft analysis.
- **The login-keychain corollary (also unaddressed).** The worker reads secrets from "the macOS Keychain under the
  `ci-runner` user, read at process start" (NTS §F.1). A **system `LaunchDaemon` boots before any login**; a
  **user login keychain is locked until that user logs in.** A boot-time daemon reading a *user login* keychain is
  a known painful interaction — it may simply be **locked**, so the daemon comes up but **cannot read its
  secrets**, and `config-doctor` fail-closes it (correct, but it means **the daemon does not self-recover after an
  unattended reboot even if FileVault were off**).

The laptop's one genuine advantage here — its **battery absorbs brief power cuts** (a built-in UPS the design
never claims) — *delays* the reboot but does not change the outcome once the battery drains or on any
update/panic/forced restart.

**Other macOS-server rot, audited against "addressed vs assumed":**
- colima break on macOS major upgrade — **admitted**, mitigation = "caught by the health monitor" = *detection,
  not recovery*; while broken, **CI has no test Postgres → all merges blocked.**
- runner agent auto-update break — **admitted**; while broken, **merges blocked**; mitigation again is detection +
  the manual `runs-on` fallback.
- App Nap / sleep — addressed via `pmset`/`caffeinate`, but those settings are **reset by some macOS updates** and
  fight a lid-closed laptop; partial.

**Corrected claim.** *"Unattended-reboot recovery is NOT automatic on a FileVault Mac: the disk is locked until a
human logs in, and a boot-time daemon may be unable to read a user login keychain regardless. The 'minutes,
automatic' RTO is false for the power-blip / forced-restart case — the dominant unattended event. Either retract
the auto-recovery claim, or choose a host where encrypted-disk unattended boot is a solved pattern (Linux: TPM /
clevis / network-bound LUKS)."*

**Must-add work items (any approval is conditional on these):**
1. **Decide FileVault explicitly** and reconcile the two streams. If on: replace "automatic reboot recovery" with
   "reboot requires authenticated login" everywhere, and re-derive RTO (it becomes "hours, until the founder is
   physically present" — which, again, argues for a Linux/cloud node).
2. **Do not read secrets from a user login keychain in a boot-time daemon.** Use a dedicated keychain the daemon
   can unlock non-interactively, or accept a documented at-rest secret with file ACLs — and prove the daemon comes
   back **green after a cold boot with no human present** as an explicit M-gate (this proof is absent from EIB
   §15's validation plan).
3. Add a **cold-boot recovery test** to the validation plan: pull power, restore power, assert the worker reaches
   `/ready` green with no human interaction. The current plan (EIB §15.4) only kills the *process*, never the
   *machine* — it never tests the case that actually rots.

---

## Challenge 6 — The home-network / physical layer.

**The claim.** Neo behind home NAT needs "zero network configuration"; Tailscale + FileVault + instant device
removal handle connectivity and theft (NEO-ARCH B.2; NTS §A, §E.4).

**Verdict: PARTIALLY SURVIVES.**

**Evidence — what genuinely survives:**
- **Dynamic IP / NAT / no inbound port:** the runner long-polls **outbound**; Tailscale traverses NAT with stable
  identity. This is **correct** — a residential dynamic IP is a non-issue, and the "no public ingress" property is
  real and strong (NTS §G.3). SURVIVES.
- **Power:** a laptop's **battery is a built-in UPS** — a home power flicker does *not* instantly kill Neo. This
  is the laptop's single structural advantage over a naked mini-PC, and the design **never claims it** (a missed
  positive). But it is finite and degrades, and collides with Challenge 5 the moment battery drains and power
  returns.

**What is under-foregrounded or wrong:**
- **Availability ceiling = a residential ISP with no SLA.** When the home internet drops, Neo loses the bus
  (Supabase) → autonomy **pauses** (FEL §4.2 calls this "safe pause-and-resume," true for *safety*) — but it means
  **continuous-autonomy uptime is now bounded by a consumer ISP's reliability**, with no redundancy. The whole
  pitch is "continuous, unattended, portfolio-scale execution"; running its spine on a home DSL/cable line is a
  quiet downgrade of exactly that promise. A cloud VM has datacenter connectivity. Unforegrounded.
- **Theft of a portable prod-secret store.** Neo "lives on a desk" and holds, in its Keychain, `VERCEL_TOKEN`
  (deploy-as-founder), pooler creds, and — under HMAC — the break-glass **signing** key (NTS §G.4). Laptops are
  commonly stolen **while suspended**, with the FileVault key resident in RAM; a thief with a sleeping laptop may
  reach the Keychain before the founder can remove the device. This is materially worse than a bolted-down mini-PC
  or a cloud VM, and it **sharpens ADR-3's urgency** (a portable device is the worst place for a symmetric
  prod-signing key). The design treats theft as a clean "remove + rotate" runbook and under-weighs the
  suspended-laptop window.

**Corrected claim.** *"Tailscale correctly neutralizes dynamic-IP/NAT/inbound; the laptop battery is a real
(unclaimed) UPS advantage. But continuous-autonomy availability is now ceilinged by a no-SLA residential ISP, and
a portable device holding prod-adjacent secrets is a worse theft target (suspended-laptop key-in-RAM window) —
both reinforce a fixed/cloud host for the continuous role."*

**Must-add work item.** State the residential-ISP availability ceiling explicitly in the DR table, and move the
prod-signing key off the portable device *before* go-live (do ADR-3 first, per its own trigger), not "on the
horizon."

---

## Challenge 7 — The Ed25519 break-glass finding: scoped correctly?

**The claim.** Break-glass is HMAC-symmetric, so a compromised Neo can self-issue a (scoped, logged,
ledger-immutable) grant; migrating to Ed25519 (private key only on the founder device) is **"the single
highest-leverage hardening in this whole document"** (NTS §F.5, ADR-3, §G.4).

**Verdict: SURVIVES as a finding (correct, honest, well-scoped) — but OVER-stated as "single highest-leverage,"
and slightly UNDER-stated on blast radius; and the symmetric-trust pattern RECURS in places the streams missed.**

**Evidence — the finding is right.** The HMAC self-issue gap is real and correctly bounded: single-use, TTL,
target-bound, immutably logged, and DB-level ledger immutability triggers fire regardless. Surfacing it (Invariant
§11) instead of smoothing it is exactly right, and Ed25519 is the correct fix. **This part survives cleanly.**

**Where it is OVER-stated (leverage).** The analysis treats break-glass **in isolation from the co-located deploy
token.** A *fully compromised* Neo (the precondition for the self-issue) also holds **`VERCEL_TOKEN`**, which can
**deploy attacker-controlled code to prod as the founder** (NEO-ARCH B.3.3 makes this a *feature*: "identity
travels with the token … no manual click"). Attacker code in the prod runtime can then issue prod DB writes
**through the app's own legitimate paths**, bypassing break-glass entirely. So:
- Ed25519 removes **one** prod-mutation path while leaving a **co-equal** one (deploy) wide open on the same node.
- Calling Ed25519 the "single highest-leverage" control is therefore wrong — it is **necessary but not
  sufficient**, and the deploy token deserves equal billing (deploy author≠verifier, or a deploy-approval gate, or
  a token that cannot self-serve a prod deploy without a second factor).

**Where it is UNDER-stated (blast radius).** "Not silent data forgery" holds only for **append-only ledger
tables** (invoice/audit). A self-issued grant to a **mutable business table** (contract status, a balance/amount
field, config/feature flags, a user record) is a quiet, real write that the immutability triggers do **not** cover.
"Scoped" is only as narrow as the set of `(table, op)` break-glass may target — which is **not enumerated** in the
design. Bound the table set, or "scoped" is doing unproven work.

**Other recurrences of the symmetric-trust / on-node-key pattern (the streams missed these):**
1. **`VERCEL_TOKEN`** — an on-node bearer credential that mutates prod (deploy) as the founder, no asymmetric
   analog proposed. The biggest recurrence.
2. **`CRON_SECRET` / `PROD_SMOKE_TOKEN`** — on-node bearer secrets authenticating to prod endpoints. Symmetric.
3. **The Healthchecks ping URL — symmetric trust *in the watchdog itself*.** The dead-man's safety rests on
   "absence of ping = real signal." But the **watched party controls the signal**: a *maliciously compromised* Neo
   (vs a merely *dead* one) can **ignore the `/ready` gate and ping unconditionally**, suppressing the alarm while
   it exfiltrates — and can **fake `/ready` green** to the Windows puller too. The `/ready` gate is **cooperative,
   not enforced**; a compromised daemon won't honor it. **So both watchdog paths trust Neo to self-report
   honestly. The dead-man is strong against a *dead* Neo and weak against a *lying* Neo — and that limitation is
   nowhere stated.** All five docs lean on the watchdog as the safety keystone without noting it defends
   availability, not integrity.

**Corrected claim.** *"The Ed25519 finding is correct and should be done before go-live. But it is one of several
on-node-credential problems, not the singular fix: the co-located deploy token is a co-equal prod-mutation path
Ed25519 doesn't touch and needs its own control; 'not silent forgery' holds only for append-only ledgers; and the
symmetric-trust pattern recurs in the deploy token, the cron/smoke secrets, and — most importantly — the dead-man's
own liveness signal, which a compromised (lying) Neo can suppress or fake. The watchdog protects against a dead
Neo, not a dishonest one; say so."*

**Must-add work items.** (a) Enumerate and bound the break-glass `(table, op)` set. (b) Give the deploy token an
author≠verifier / approval treatment co-equal with Ed25519. (c) State explicitly that the dead-man covers
*availability* (dead Neo), not *integrity* (compromised Neo lying about its health) — and that detecting a lying
node requires an integrity signal the watched node cannot forge (out of scope now, but named, not assumed away).

---

## Cross-cutting failures the four streams collectively missed

- **A. The build plan contradicts its own logic.** Every stream concedes Linux-should-be-next-for-reliability and
  that the Mac Studio "returns the MacBook to being a laptop" — yet all four put the laptop as node 1. The shared
  rationalization is **sunk cost** ("already owned, $0"). No stream asked whether the first always-on node should
  simply *be* the Linux box, skipping the laptop-server phase. Four streams **deepened the given** rather than
  challenging the premise — the exact gap an adversary exists to close. (→ Challenge 2.)
- **B. "$0 marginal" is the load-bearing economic claim and it is not true.** It ignores net-new staging spend,
  the 60× Supabase tick load, and the unpriced founder-time; and the cost table never compares against the obvious
  $5/mo middle option that would *also* be ~$0 while deleting the laptop toil. (→ Challenge 3.)
- **C. A seam failure between independently-authored streams:** the security stream recommends FileVault; the
  node/HBM streams claim automatic post-reboot recovery; nobody reconciled them. (→ Challenge 5.)
- **D. The watchdog defends availability, not integrity** — all four lean on it as the safety keystone; none noted
  it trusts the watched node to self-report. (→ Challenge 7.)

---

## Overall verdict

**RETHINK THE PREMISE, then APPROVE-WITH-CHANGES.**

The architecture **above the node** is genuinely sound and much of it **survives**: the durable-bus-as-system-of-
record with no node-resident essential state; the `ExecutionProviderPort` + constraint-first, fail-closed
placement; the cattle-not-pets DR posture; the off-Neo dead-man *concept* and the failure-domain-independence
*rule*; the no-public-ingress Tailscale model; the reversible `runs-on` lever; and the honest surfacing of the
HMAC gap. None of those need to change.

The flaw is narrow but load-bearing: **a laptop is the wrong CONTINUOUS execution host**, and the design
rationalizes it via sunk cost while its own roadmap schedules the fix as the very next node. Swapping node 1 to a
**cheap always-on Linux host (home mini-PC or a $5/mo cloud VM)** dissolves the bulk of Challenges 1, 2, 3, 5, and
6 at once: no colima-on-macOS churn, no FileVault unattended-reboot wall, no App Nap/sleep fight, no
keychain-lock-at-boot, Docker-native, non-portable (better theft posture), datacenter (or at least fixed)
connectivity, and encrypted-disk-unattended-boot as a solved pattern. Keep Neo as an *optional* second node for
neutral-hardware verify if a Mac is ever genuinely needed — the role the design itself assigns the Mac Studio.

**Conditions on any approval (each maps to a Must-add above):**
1. **Re-seat node 1 as Linux** (mini-PC or cloud VM); demote the laptop to optional/verify. Produce the node-1
   trade study EIB §14 skips.
2. **Resolve the FileVault / login-keychain unattended-reboot contradiction** and add a **cold-boot recovery test**
   to the validation plan; retract or re-base every "minutes, automatic" RTO accordingly.
3. **Price the M0-only world** (Healthchecks + worker daemon, no self-hosted runner) and justify the runner
   migration on its own merits, not on the minutes crisis it does not own. Count the 60× Supabase tick load.
4. **Disambiguate Neo-fault from Supabase-fault** in the watchdog (probe `/health` + Supabase directly), so the
   "one place to look" does not go dark and mislabel during the crown-jewel outage.
5. **Treat the deploy token as a co-equal prod-mutation path** to break-glass (author≠verifier / approval gate);
   **do ADR-3 (Ed25519) before go-live**, not "on the horizon"; **bound the break-glass `(table, op)` set**; and
   **state that the dead-man covers availability, not integrity.**

Approve the *shape*. Reject the *host*. Then build.

---

*End of NEO-ADV-05 — adversarial review, read-only. Refutes where the evidence refutes, concedes where claims
genuinely survive. An independent panel and a founder gate decide; this doc is one lens, deliberately hostile, so
the design is harder before anything is installed.*
