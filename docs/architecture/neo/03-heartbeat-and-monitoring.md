---
artifact: Neo Heartbeat & Operational Monitoring — the operational substrate for Execution Node 1
id: NEO-HBM-v1
date: 2026-06-29
status: ARCHITECTURE DESIGN — READ-ONLY. Designs no code into existence; installs/changes NOTHING. A founder gate authorizes any build.
author_role: lead-architect (design only — author≠verifier; an independent panel ratifies before build)
scope: The heartbeat, watchdog, recovery, alerting, monitoring and founder-visibility layers that make Neo
  (Apple MacBook = Execution Node 1) safe to run as the CONTINUOUS execution host of Delivery OS.
extends:
  - docs/reviews/EXECUTION-INFRASTRUCTURE-BLUEPRINT-2026-06-29.md  (EIB-DOS-v1 — §4.4 off-Neo watchdog as a HARD precondition; the cron-drain finding; §10 monitoring; §11 DR)
  - docs/reviews/RUNTIME-SPECIFICATION-2026-06-28.md               (RS-DOS-v1 — §7 supervision tiers C7/C8/C9/C13/C14; §7.5 three-tier independence; §49 I-Ops read model)
reuses_not_reinvents:
  - templates/tools/platform-health.mjs      (buildReport · computeVerdict · classifyFailure taxonomy · runHealth — the canonical /v1/health/platform shape + the silent-stop cure)
  - templates/tools/post-deploy-verify.mjs   (config → health → synthetic fold; the self-heal verification window)
  - templates/tools/rollback-helper.mjs      (last-known-good Vercel deploy + the printed promote command)
scope_guard: No daemon is installed, no monitor is registered, no secret is moved here. This is the design a build
  team executes after the EIB-DOS-v1 founder gate (M0 stands up the watchdog before any meter-bearing move).
---

# Neo Heartbeat & Operational Monitoring (NEO-HBM-v1)

> **Why this doc exists.** EIB-DOS-v1 made the call: the *continuous* supervision tiers (engine-tick, goal-supervisor,
> reconciler) move OFF GitHub-Actions cron — the thing that drained 100% of the Actions allotment by itself — and
> onto **Neo as a launchd worker/queue daemon that owns its own clock** (NOT a cron-of-an-LLM; that was the
> meter-draining anti-pattern). The instant we do that, a new question becomes load-bearing: **a machine a solo
> founder must personally keep alive needs an operational nervous system — heartbeats that prove liveness, a
> watchdog that survives the machine it watches, recovery that needs no human at 2am, and exactly one place the
> founder looks to know "is everything healthy?"** This document designs that nervous system, concretely, for a
> solo founder who *is* the on-call. The single hardest constraint, taken straight from EIB §4.4 / §13 / §17 and
> RS-DOS §7.4, is non-negotiable and frames everything below:
>
> **The dead-man's-switch must NOT live on the machine it watches.** If Neo dies — powered off, kernel-panicked,
> network-cut, daemon-crash-looped — something on a *different failure domain* has to notice and page the founder.
> A watchdog co-located with the watched process is not a watchdog; it is a second thing that dies in the same
> outage (the 76-commit billing-outage class, RS-DOS §7.4). Failure-domain independence is the architecture, not a
> nicety.

---

## 0. TL;DR (one screen)

1. **Seven layers, two clocks, one rule.** The heartbeat stack has seven layers (process supervision → runtime
   engine-tick → runner liveness → health endpoints → goal-progress → off-Neo dead-man → founder alert). Two
   distinct clocks run: launchd's *on-Neo* relaunch clock (intra-domain, fast) and the *off-Neo* dead-man clock
   (cross-domain, the load-bearing one). The rule that orders them: **on-Neo supervision handles the recoverable;
   the off-Neo watchdog handles the case where on-Neo supervision itself is dead.**
2. **The engine-tick owns its own clock.** The worker daemon ticks every ~5s on an internal timer and stamps
   `last_tick_at` on the durable bus. Liveness = a fresh, monotonically-advancing tick row. Because there is no
   per-invocation meter, 5s granularity costs $0 — the exact inversion of the cron model that charged per tick.
3. **The dead-man's-switch is a PUSH check-in to Healthchecks.io, GATED on `/ready` being green.** Neo pings an
   external endpoint *only when it is genuinely healthy*; silence (dead Neo, or a degraded-but-running daemon) →
   Healthchecks alarms the founder over a channel that does not touch Neo. A Windows Scheduled Task pulling Neo's
   tailnet `/ready` is the independent backup. **Two off-Neo failure domains, zero GitHub minutes.**
4. **The monitoring stack is deliberately NOT Grafana/Prometheus.** At N=2 nodes for a solo founder, a Prometheus
   stack is a second full-time job that would also run *on Neo* (shared failure domain). The honest minimal stack:
   **Healthchecks.io** (dead-man) + **the durable Postgres bus AS the metrics store** (already built — the I-Ops
   read model, RS-DOS §49) + **a read-only status page hosted OFF-Neo on Vercel** + **launchd file logs with
   rotation**. Real visibility, no second job.
5. **The founder looks at ONE place: the Vercel-hosted I-Ops status page.** It reads Supabase directly, so it
   **survives Neo being down** — which is precisely when the founder needs it most. Healthchecks' dashboard and the
   Tailscale device list are the two dead-simple "is the node even powered" backstops.
6. **Alerting pages only on P1.** Neo down · supervisor silent · circuit-breaker HALT · runner offline blocking
   merges. *Degraded* is a daily digest, not a 2am page. A **weekly "all-green" heartbeat** proves the alerting
   path itself is alive — so silence can be trusted (a dead-man for the dead-man).

---

## 1. The supervision chain, restated for Neo

Delivery OS already specifies the supervision organs (RS-DOS §7); this doc does not invent them, it gives them an
*operational home* on Neo and an *independence guarantee*. The chain, from cheapest/fastest to last-resort:

| Organ | RS-DOS id | What it proves | On the old (cron) substrate | On Neo (this design) |
|---|---|---|---|---|
| Process supervision | (OS) | the daemon process exists | n/a (serverless) | **launchd `KeepAlive`** relaunch |
| Engine-step tick | **C13** [BUILT `/v1/heartbeat`] | **liveness** — work is *moving* | Vercel cron ~5min | **worker-daemon internal timer ~5s** (owns its clock) |
| Goal Supervisor | **C7** [DESIGNED] | **progress** — the *goal* is moving (≠ liveness) | GH-Actions cron ~30min | **worker-daemon slot** (separate state reads) |
| Pre-flight gate | C9 [DESIGNED] | the goal is *reachable* at hour 0 | (CI) | unchanged (CI, before sprint 1) |
| Dead-man's-switch | **C8** [DESIGNED] | **the supervisor itself is alive** | external monitor | **Healthchecks.io + Windows task (OFF-NEO)** |

**The invariant that orders them (RS-DOS §7.5):** *liveness ≠ progress ≠ supervisor-aliveness*, and each tier is
**independent of the one it watches**. C13 says "steps are advancing." C7 says "the goal is closing" — and it
re-probes the metric under its *own* identity so the driver never grades its own homework. C8 says "C7 is even
running" — and it must be on a *different machine* than C7, or one outage silences both. This doc's whole job is
to preserve that three-way independence while collapsing three GH-Actions crons into one owned-hardware daemon
plus one external monitor.

---

## 2. The layered heartbeat design (the deliverable table)

Each row is a **distinct heartbeat with its own emitter, consumer, cadence, and miss-action**. Read it top-to-bottom
as fastest/most-local → slowest/most-independent. The two rows in **bold** are the load-bearing ones: the engine-tick
(proves the autonomy host is alive) and the off-Neo dead-man (proves *that* is true even when Neo cannot speak for
itself).

| # | Layer | Emitter | Consumer | Cadence | Miss-action (what a miss triggers) |
|---|---|---|---|---|---|
| A | **launchd process supervision** (on-Neo, intra-domain) | macOS `launchd` watching the daemon + runner PIDs | `launchd` itself (`KeepAlive=true`) | event-driven (process exit) + `ThrottleInterval` (10s) | **relaunch immediately**; after a rapid crash-loop, launchd throttles → the engine-tick goes stale → Layer F surfaces it as a real outage |
| B | **Runtime heartbeat — engine-tick (C13)** | the worker daemon's **internal interval timer** (NOT cron); each tick advances ready steps AND writes/updates `engine_heartbeat{node, tick_seq, last_tick_at}` on the durable bus | the durable bus row → read by `/ready` (Layer D), the dead-man gate (Layer F), and the status page (§8) | **~5s** (no per-invocation meter — the inversion of the cron model) | `last_tick_at` older than **60s** ⇒ `classifyFailure → HEARTBEAT_STALE` ⇒ `/ready` reports the heartbeat subsystem `down` ⇒ Neo stops pinging Healthchecks ⇒ Layer F fires |
| C | **Runner heartbeat** (GitHub self-hosted runner) | the GH Actions runner agent → GitHub's runner-status API (online/offline + job pickup) | GitHub (runner status) + a coarse poller in the status page | runner→GitHub continuous (~30–60s); we poll **every 5–10 min** | runner `offline` **and** required checks queued ⇒ CI is stalled ⇒ **P1 page** + the one-line rollback lever (flip `runs-on` back to `ubuntu-latest`, EIB §11/§12) |
| D | **Health endpoints** (`/health`, `/ready`) | the worker daemon's tiny HTTP server, **bound to the tailnet only** (MagicDNS `neo-node2`, no public bind) | the off-Neo dead-man (F), the Windows backup task, the status page (§8), `post-deploy-verify.mjs` | polled on demand | `/health` (liveness) unreachable ⇒ daemon hung ⇒ launchd should have caught it; `/ready` (readiness) `down`/503 ⇒ a critical subsystem failed ⇒ Layer F |
| E | **Goal-progress (Goal Supervisor C7)** | a daemon slot with **separate state reads** from the PO reconciler; re-probes the acceptance metric under the GS identity; appends `ProgressSample` to the goal-delta ledger | the goal-delta ledger; on a hard trip → HALT (breaker OPEN) → `BoundaryFAP` to the founder | **coarse, ~30 min** | a **trip** (flat-delta / loop-fingerprint / H1 cap / `goal_metric_reachable:false`) ⇒ **HALT + summon founder** (P1). The GS *itself going silent* ⇒ Layer F (it is what C8 watches) |
| F | **Off-Neo dead-man's-switch (C8)** — load-bearing | **Neo PUSHES a check-in** to `https://hc-ping.com/<uuid>` **only when `/ready` is green** (gated — §4) | **Healthchecks.io** (off-Neo SaaS) + a **Windows Scheduled Task** pulling `neo-node2/ready` over the tailnet (the independent backup) | check-in **every 1 min**, grace **5–10 min** | **no check-in within grace** ⇒ Healthchecks alarms the founder over an independent channel (§7) ⇒ "the supervisor stopped responding — autonomous work is paused" (RS-DOS J9) |
| G | **Founder alert + visibility** | Healthchecks (page) · the Vercel status page (pull, §8) | **the founder** (the only on-call) | page = immediate on P1; surface = always-on, glanceable | the founder acknowledges, opens the status page (off-Neo), and runs the recovery flow (§6) or the rollback lever |

**Reading the table as a flow.** A→B→...→F is a *cascade of independence*: a recoverable fault is absorbed at the
lowest layer that can fix it (launchd relaunch, lease-reclaim re-tick), and only a fault that defeats every on-Neo
layer reaches the *off-Neo* dead-man and pages a human. The cascade is the design — it is what converts "Neo rotted
silently for six months" into "the founder got one ping."

---

## 3. Each layer, precisely

### 3.1 Runtime heartbeat — the engine-tick (Layer B), and *how it proves liveness*
The worker daemon is the V-H worker the runtime always demanded: a long-lived Node process (the engine
`agent-runner` drain loop) under launchd, draining the durable Postgres bus with SKIP-LOCKED + lease. It carries an
**internal interval timer** that fires every ~5s and, on each fire:
1. **advances ready/blocked-on-timer durable steps** (the C13 contract — liveness work), and
2. **upserts an `engine_heartbeat` row** `{node_id, tick_seq (monotonic), last_tick_at}` in the same transaction.

**Liveness is proven by data, not by the process merely existing:** a fresh `last_tick_at` *and* a strictly
increasing `tick_seq`. A process that is alive but wedged (event-loop blocked, deadlocked on a lease) stops
advancing `tick_seq` — and that is exactly the "alive but not moving" failure the incident taught us to distrust
(RS-DOS §7.1: "the incident agent was alive throughout"). The tick is **liveness ONLY**; it is *removed from every
`ProgressSample` producer set* (RS-DOS B-3/CL-2 — `LivenessSample` from C13 vs `ProgressSample` from C7). Conflating
the two is the original sin this whole spec corrects.

**Why an internal timer and not cron (the anti-pattern, named).** The drained meter was `*/5 * * * *` billing a
30-second job as a full minute, 288×/day. A daemon that owns its clock has **no per-invocation meter**, so it can
tick at 5s instead of 5min for $0 marginal — *finer* liveness at *lower* cost. The cron model was not just
expensive, it was a cron-of-an-LLM (a third-party scheduler re-invoking a stateless function); the worker is the
opposite — it holds the clock, drains durable state, and a crash is recovered by lease-expiry, not by the
scheduler's next fire.

### 3.2 Runner heartbeat (Layer C)
The GitHub self-hosted runner is a *different* liveness question from the daemon: not "is the autonomy worker
moving" but "is the CI substrate online and picking up jobs." It is event-driven (GitHub dispatches a queued
required check to the runner), so its failure mode is silent: the runner goes offline and **required checks simply
queue forever** — a PR sits "Expected — waiting for status" and never merges. Detection: poll GitHub's
`actions/runners` API on a coarse cadence (every 5–10 min) for `status: online`; cross-check against any queued
workflow run. A runner offline *with* queued required checks is a **P1** (delivery is blocked) and the immediate
mitigation is the EIB rollback lever — flip the affected workflow's `runs-on` back to `ubuntu-latest` (one line),
restoring CI on hosted runners while Neo is fixed.

### 3.3 Health endpoints (Layer D)
Two endpoints, two questions, both on the canonical `platform-health.mjs` shape — **reuse, do not reinvent**:
- **`/health` (liveness)** — *is the process up and its event loop responsive?* Cheap, no DB touch, returns 200 if
  the daemon can answer at all. This is what catches a fully hung process that launchd's PID-watch missed.
- **`/ready` (readiness)** — the canonical **`/v1/health/platform`** report from `buildReport()`: DB reachable,
  **engine heartbeat fresh** (`HEARTBEAT_STALE` if not), consumer cursor advancing (`STUCK_CONSUMER_CURSOR` if
  wedged), config valid (delegated to config-doctor), GS posted within its window. `computeVerdict()` folds them
  worst-wins; a critical subsystem `down`/`unknown` ⇒ verdict `down` ⇒ HTTP **503** (`httpStatusForVerdict`). Every
  failure is a **named, actionable cause** from `classifyFailure()`, never a silent omission.

Both bind to the **tailnet interface only** (`neo-node2` MagicDNS) — no public listener, no inbound exposure. This
is why the dead-man uses a *push* model (§4): the founder's off-Neo monitors are the only things that need to reach
Neo, and the tailnet (or the push-out) gives them that without opening Neo to the internet.

### 3.4 Goal-progress (Layer E)
The Goal Supervisor moves from a GH-Actions cron to a **slot inside the worker daemon** — but with the independence
RS-DOS §7.2/§7.5 demands: it does **separate state reads** from the PO reconciler and **re-probes the acceptance
metric from its canonical external source under its own identity**, never the worker-written value. On a hard trip
(H1 cap · portfolio-cost ledger · flat-delta/loop-fingerprint · independent `goal_metric_reachable:false`) it opens
the **durable** circuit-breaker, HALTs the loop, and emits a `BoundaryFAP{class=...}` summon. It is in the *miss*
table not because progress-failure is a "miss" but because **the GS going silent** is the precise thing the off-Neo
dead-man (Layer F) exists to catch. (Honest carry-forward, RS-DOS §15.1: a *slow-asymptotic* goal reads "reachable"
and is bounded only by the H1 cap, not the GS — named, unsolved, out of scope here.)

---

## 4. The off-Neo dead-man's-switch (the load-bearing design)

> This is the one piece that, if omitted, makes the whole self-hosting move irresponsible for a solo founder
> (EIB §13/§17, RS-DOS §7.4). It gets its own section and its own ADR (ADR-001).

### 4.1 The failure-domain argument (why it cannot live on Neo)
A watchdog exists to detect the failure of the thing it watches. If it shares **hardware, OS, power, network, or
process tree** with that thing, then the very outage it must report *also takes the watchdog out* — it reports
nothing, and the founder learns of the outage from a customer, a bounced invoice, or a billing alert weeks later.
That is the 76-commit billing-outage class verbatim (RS-DOS §7.4): the supervisor went silent and *nothing
independent was watching the supervisor*. Therefore the dead-man must satisfy **failure-domain independence**: a
single fault that disables Neo's supervision must **not** disable the dead-man. Concretely, the dead-man must
survive: Neo powered off · Neo kernel-panic · Neo off the network · the daemon crash-looping · launchd wedged · the
macOS user logged out · a full disk · a botched macOS update. None of those can be detected by anything *on Neo*.

### 4.2 The design — PUSH check-in, GATED on health
- **Primary: Healthchecks.io (push / dead-man semantics).** Neo's daemon `POST`s to a private ping URL
  (`https://hc-ping.com/<uuid>`) **every 1 minute**, with a **grace of 5–10 minutes**. Healthchecks is a "tell me
  you're alive or I alarm" service — the canonical dead-man shape. If the check-in is absent for longer than the
  grace, Healthchecks pages the founder (§7). **Push beats pull here** because (a) it needs **no inbound exposure**
  of Neo's tailnet endpoint to a public SaaS, and (b) absence is unforgeable — a dead Neo *cannot* send a ping, so
  silence is a true signal, not a network artifact.
- **The gate (the subtle, critical part — ADR-003).** The daemon pings Healthchecks **only when its own `/ready`
  is green** (heartbeat fresh AND cursor advancing AND GS posted within its window). A naive unconditional ping
  would hide a *degraded-but-running* daemon — the process is up, dutifully pinging, while the engine-tick has
  been stale for an hour. Coupling the check-in to a real `/ready` evaluation means **a stale heartbeat or a silent
  GS also stops the ping**, so the dead-man catches "alive but not actually supervising," not just "powered off."
  This closes the alive≠working gap inside the watchdog itself.
- **Backup: a Windows Scheduled Task (pull, independent domain).** The Windows box (Node 1) runs a Scheduled Task
  every ~5 min that pulls `http://neo-node2/ready` over the **tailnet** (the tailnet *can* reach Neo's private
  endpoint; the public SaaS deliberately cannot). On 503/unreachable for K consecutive polls it alerts the founder
  via an independent channel. This is a *second, different* off-Neo failure domain — if Healthchecks itself has an
  outage, the Windows task still catches a dead Neo, and vice-versa. The two share nothing but the founder's phone.

### 4.3 What the dead-man explicitly does NOT do
It does not restart Neo, does not promote a deploy, does not modify state. It is a *dumb timer that pages a human*
(RS-DOS §7.4: "an independent dumb timer"). Recovery is §6's job; the dead-man's only contract is **turn silence
into a ping.** Keeping it dumb is what keeps it trustworthy — a watchdog with logic is a watchdog with bugs.

---

## 5. Monitoring stack — the honest, solo-founder-appropriate recommendation

**The question is not "what is the best observability stack" — it is "what gives a solo founder real visibility
without becoming a second full-time job (and without itself running on the machine it is supposed to watch)."**

### 5.1 Options evaluated
| Option | Real visibility? | Solo-founder cost | Failure-domain | Verdict |
|---|---|---|---|---|
| **Prometheus + Grafana (self-hosted)** | high | **high** — scrape configs, exporters, dashboards, alert rules, *and its own uptime to mind* | would run **on Neo** → shares the watched domain | **REJECT** at N=2 — a second job that dies in the same outage |
| Grafana Cloud / Datadog (hosted) | high | medium — another bill + agent install + config | off-Neo (good) | **DEFER** — real, but overkill until N is large or a team exists |
| **Healthchecks.io** (dead-man) | targeted (liveness) | **near-zero** (free tier, 1 check) | **off-Neo** | **ADOPT** — the load-bearing piece |
| **Postgres bus AS the metrics store** (already built) | high (queue depth, tick age, F1–F15 rates, cost ledger) | **$0** — the data is *already* durable | the bus (Supabase) | **ADOPT** — the I-Ops read model, RS-DOS §49 |
| **Off-Neo status page** (Vercel, reads Supabase) | high (the single screen) | low (free Vercel project) | **off-Neo** (survives Neo down) | **ADOPT** — the founder surface |
| launchd file logs + rotation (`newsyslog`) | medium (forensics) | low | on-Neo (fine — logs are forensic, not the alarm) | **ADOPT** — grep-over-Tailscale-SSH; ship to a hosted sink *only if* that proves insufficient |

### 5.2 The recommended stack (the simplest thing that gives real visibility)
1. **Dead-man:** **Healthchecks.io** (free). The only thing that *must* exist before any meter-bearing move (EIB M0).
2. **Metrics:** **the durable Postgres bus is the metrics store.** The daemon already writes queue depth, tick
   sequence, F1–F15 failure counts, breaker state, cost ledger, and goal-delta to durable tables. **The I-Ops read
   model (RS-DOS §49) is a SQL view over those tables — no Prometheus, no exporters, no second store.** Metrics
   that are already durable do not need a time-series database bolted alongside them.
3. **Logs:** launchd writes the daemon + runner `stdout/stderr` to `~/Library/Logs/delivery-os/*.log` as
   **structured JSON lines**, rotated by macOS `newsyslog`/`logrotate` with a hard size cap (the "Docker layers /
   logs fill the disk" rot, EIB §13). Searchable with `jq`/`grep` over **Tailscale SSH**. *Escalation path, not
   built day-1:* if grep-over-SSH proves insufficient, ship lines to a cheap hosted sink (Better Stack / Grafana
   Loki free tier) — a config change, not a re-architecture.
4. **Dashboard:** **one off-Neo status page** (§8). Not Grafana — a single SSR page that queries Supabase and
   renders the I-Ops single-screen.
5. **Cheap up/down backstops (free, already there):** the **Tailscale admin device list** ("is `neo-node2` even
   online?") and the **Healthchecks dashboard** ("is the dead-man happy?"). These cost nothing and answer the
   crudest question without any custom code.

**Net:** Healthchecks + Postgres-as-metrics + a Vercel status page + rotated file logs. **Zero new always-on
infrastructure on Neo, zero Prometheus, zero second job.** Every richer option is *named and deferred*, pulled only
when N-nodes or a team makes the simple thing hurt (the Waterline discipline).

---

## 6. Automatic recovery + escalation flow

The design principle (RS-DOS §4.4/§14, EIB §11): **state is 100% on the durable Postgres bus; no node holds
essential RAM state; therefore every node is replaceable.** Recovery is a *re-read*, not a *reconstruction*. The
ladder runs auto → auto → auto-halt → human, escalating only when the cheaper layer cannot fix it:

| Tier | Trigger | Recovery action | Who/what | Lost work? |
|---|---|---|---|---|
| **0** | daemon/runner process exits | **launchd `KeepAlive` relaunch** → daemon re-reads durable bus → resumes | launchd (auto, seconds) | none — no RAM state |
| **1** | process crashed *mid-step* | the step's **lease expires** → next tick (same node on reboot, or another node) **reclaims via SKIP-LOCKED**; the **idempotency store** (write-ahead-intent) prevents a double side-effect | the engine (auto, ~one tick) | none — CAS lease + idempotency |
| **2** | stuck cursor / poison-pill | `classifyFailure → STUCK_CONSUMER_CURSOR`; the drain **quarantines to the dead-letter terminal**, never silent-drops; a single re-tick is attempted first | the engine (auto) → boundary FAP if breaker-exhausted | none — quarantined, not lost |
| **3** | bug-loop / runaway / flat-delta / cost-cap | **circuit-breaker OPEN (durable)** → **HALT** → `BoundaryFAP` summon; the portfolio-cost ledger caps a runaway fleet | C7 (auto-halt) → **founder decides** | none — halted before harm |
| **4** | bad deploy | `post-deploy-verify.mjs` **ALARM** (config→health→synthetic fold, with a self-heal re-poll window) → `rollback-helper.mjs` prints the **last-known-good `vercel promote`** command | auto-detect → founder (or `deployment-operator` in-scope) promotes; forward-only `down/` migration | none — prior deploy intact |
| **5** | **daemon/GS dead, launchd can't recover** (crash-loop throttled, disk full, hung) | the engine-tick goes stale → `/ready` 503 → **Neo stops pinging Healthchecks** → **dead-man pages the founder** | **founder, manual** (§4) | work *paused*, durable, resumable |
| **6** | **Neo hardware death** | dead-man alarm → founder flips `runs-on` back to `ubuntu-latest` (CI restored in one line) **and** brings the worker up on Windows / a future node (a node is just an adapter — EIB §9) | founder, hours (RTO) | none — durable bus replays on the new node |

**The escalation seam (Tier 4→5) is the whole point.** Tiers 0–4 need no human. Tier 5 is reached *only* when
on-Neo recovery has itself failed — and the **only** thing that surfaces it is the off-Neo dead-man converting
silence into a ping. Without §4, Tier 5 is a silent six-month rot. The **manual recovery runbook** (Tier 5/6):
Tailscale-SSH into Neo → `launchctl print` the daemon/runner units → tail the rotated logs → restart or, if the
machine is unrecoverable, execute the `runs-on` rollback + stand the worker up elsewhere. The reversibility lever
(one-line `runs-on`) is what keeps the operational risk acceptable for a solo founder (EIB §13).

---

## 7. Alerting policy — page on real, stay silent on noise

**Channel independence first (the rule that outranks the rest):** the paging channel **must not depend on the thing
being watched.** A Slack bot that posts from a Neo-hosted process is useless when Neo is down — it is the canonical
mistake. Therefore the page originates **off-Neo**: Healthchecks.io → email + a phone-push integration
(Pushover / ntfy / SMS) that reaches the founder's phone directly. The phone is the only shared dependency between
the watchdog and the founder.

| Class | Examples | Action | Channel |
|---|---|---|---|
| **P1 — PAGE (immediate)** | Neo down (dead-man) · **GS silent** · circuit-breaker HALT + summon · runner offline **with** queued required checks · prod deploy health-verify ALARM | wake the founder | Healthchecks → phone push/SMS (off-Neo) |
| **P2 — DIGEST (daily)** | a *non-critical* subsystem `degraded` · disk >80% · runner auto-update occurred · a single transient probe blip that self-healed within retry · cost ledger over a soft threshold | one daily summary; the founder triages on their schedule | email digest / the status page |
| **P3 — DASHBOARD-ONLY** | queue depth normal-but-elevated · latency within band · routine tick history | no notification; visible if the founder looks | the status page (§8) |

**What deliberately does NOT page (anti-fatigue):**
- a **single** transient failure that the daemon's level-triggered re-tick or `post-deploy-verify`'s retry window
  clears — the recovery layers (§6) absorb blips so the founder never sees them;
- a **job retry that succeeds** (the breaker only trips on *exhaustion*);
- **degraded** (serve-with-alarm) — it is a digest item, never a 2am page; only `down` on a *critical* subsystem
  pages;
- a runner auto-update (expected churn) — digest only, unless it leaves the runner offline (then P1 via Layer C).

**The positive heartbeat (a dead-man for the alerting path).** Healthchecks sends a **weekly "all-green" digest**
even when nothing is wrong. Its *purpose is to prove the alerting path itself is alive* — if that weekly green
stops arriving, the alerting channel has died silently (the deepest rot class, §9). Silence is only trustworthy if
*something* periodically proves the alarm can still ring.

---

## 8. Founder visibility — the one place to look

> The founder's question is binary and constant: **"is everything healthy?"** There must be exactly **one** place
> that answers it, and that place must **survive Neo being down** — because a status page that goes dark exactly
> when the founder needs it is worse than none.

**The surface: a read-only I-Ops status page (RS-DOS §49 Mission Control), hosted OFF-Neo on Vercel, reading
Supabase directly.** It is an `I-Surface` adapter over the *derived* read model — no new control plane, no state of
its own. Because it is hosted off-Neo and reads the durable bus, **Neo can be a smoking crater and the page still
renders the full picture** (it will simply show `neo-node2: DOWN`, last-tick age red, and the dead-man's last
check-in) — which is exactly the moment it earns its keep.

**Single screen, glanceable, shows:**
- **Nodes:** `windows-node1`, `neo-node2` — up/down + last-seen (from `engine_heartbeat` + Tailscale).
- **Runtime heartbeat:** last engine-tick age — **green <30s · amber <2m · red >2m**.
- **Runner:** online? · last job · queued-checks count.
- **Goals:** active goals · goal-delta trend · any **HALTED / summon** (with the FAP link).
- **Breaker:** open/closed per goal.
- **Bus:** queue depth · oldest-waiting-step age · dead-letter count.
- **Deploy:** last prod deploy · `post-deploy-verify` verdict · the `rollback-helper` last-known-good target.
- **Cost:** month-to-date portfolio spend (the runaway-fleet bound).
- **Watchdog:** the off-Neo dead-man's last check-in time + status (so the founder can see the *watchdog* is
  healthy, not just the workload).
- **Overall verdict:** the worst-wins `computeVerdict()` fold across services — one word: **ok / degraded / down**.

**Two free backstops behind the one surface** (for when even Supabase is impaired — see §9): the **Tailscale device
list** (is the node powered/online?) and the **Healthchecks dashboard** (is the dead-man happy?). The Vercel page is
the *primary* single-screen; these two are the crude, dependency-free fallbacks.

---

## 9. Risks & trade-offs (honest)

1. **Alert fatigue → the real page gets ignored.** The dominant failure mode of any monitoring system. **Bound it:**
   strict P1/P2/P3 (only P1 pages); the recovery layers (§6) absorb transient blips so they never reach the founder;
   Healthchecks' grace window damps flapping; **degraded is never a page**. The residual: tuning thresholds is
   ongoing work — start *conservative* (fewer pages) and tighten only when a real incident slips through.
2. **The founder IS the SRE — there is no on-call but one person.** Self-hosting concentrates CI + verify + the
   autonomy worker + deploy on one machine with one human behind it (EIB §17.1). The whole stack is therefore
   designed to **minimize standing toil**: $0 always-on infra beyond the daemon, the dead-man converts silent rot
   to a single ping, and the **one-line `runs-on` rollback** means recovery from a dead Neo is *minutes of typing*,
   not a rebuild. *Mitigated, not removed* — the honest verdict from EIB §13 stands.
3. **The silent-rot class (the dangerous one).** Not a crash — a slow, quiet "runner went offline / colima broke on
   a macOS update / a token rotated and the daemon didn't reload," undetected for months. **Bound it on four
   fronts:** (a) the **off-Neo dead-man** turns absence into a ping; (b) the **`/ready`-gated** check-in means a
   *degraded-but-running* daemon also stops pinging (§4.2 — not just a powered-off box); (c) **config-doctor
   fail-closed** refuses to run on a stale/invalid secret set (the rotated-token rot); (d) the **weekly green
   digest** proves the *alerting path itself* is still alive (§7). The deepest rot — *the alarm channel dies
   silently* — is caught only by (d) plus the **two independent watchdog domains** (Healthchecks + Windows task).
4. **The unconditional-ping trap (designed out).** If the dead-man check-in were *not* gated on `/ready`, a process
   that is up but not supervising would happily ping forever and the founder would believe all is well. ADR-003
   gates the ping on a real health evaluation precisely to close this — but it adds a coupling (a bug in `/ready`
   could suppress a legitimate ping, causing a *false* page). Trade-off accepted: a false page (annoying) is
   strictly safer than a false silence (catastrophic).
5. **Shared-dependency blind spot: Supabase.** The status page and prod both read Supabase; a Supabase outage darkens
   both, and the page cannot then show bus-derived state. **Honest:** Supabase is the crown jewel (back it up — EIB
   §11); its outage is provider-bound. The **Tailscale device list + Healthchecks** remain as Supabase-independent
   up/down signals during such an outage (§8 backstops). This is a known, accepted residual, not a solved problem.
6. **Healthchecks.io as an external dependency.** A free third-party SaaS is now load-bearing for safety. **Bound
   it:** the Windows-task backup is a *second* independent watchdog domain, so a Healthchecks outage alone does not
   blind the founder; and Healthchecks is self-hostable later if the dependency proves uncomfortable.

---

## 10. ADRs (the load-bearing choices)

### ADR-001 — The dead-man's-switch lives OFF Neo (Healthchecks.io push), not on it
- **Status:** PROPOSED (founder-gate before build).
- **Context:** Moving continuous supervision onto Neo (EIB) means a single machine, owned by a solo founder, now
  hosts the autonomy worker. A watchdog co-located with it dies in the same outage (the 76-commit billing-outage
  class, RS-DOS §7.4). Failure-domain independence is mandatory.
- **Decision:** The dead-man's-switch is an **off-Neo PUSH check-in to Healthchecks.io**, with a **Windows
  Scheduled Task pulling `neo-node2/ready` over the tailnet** as a second, independent backup domain. On-Neo
  launchd `KeepAlive` handles *recoverable* process death; the **off-Neo** monitor handles the case where on-Neo
  supervision *itself* is dead. Push beats pull: no inbound exposure of Neo, and absence is an unforgeable signal.
- **Alternatives rejected:** (a) an on-Neo launchd-only watchdog — fails the independence test, dies with Neo;
  (b) UptimeRobot pull against a *public* Neo endpoint — forces inbound exposure of a tailnet-only service;
  (c) a Vercel cron pinging Neo — a cron (the drained substrate) and HE-4 plan-clamp-prone; acceptable only as a
  *tertiary*.
- **Consequences:** a free external dependency becomes load-bearing for safety (mitigated by the Windows backup +
  later self-hosting). This ADR is the hard precondition (EIB M0): **stand the watchdog up before any meter-bearing
  move.**

### ADR-002 — No Prometheus/Grafana; the durable Postgres bus IS the metrics store + an off-Neo status page
- **Status:** PROPOSED.
- **Context:** A solo founder at N=2 nodes needs real visibility, not a second full-time job — and a self-hosted
  Prometheus/Grafana would run *on Neo*, sharing the very failure domain it must observe.
- **Decision:** Use **Healthchecks.io** (dead-man) + **the durable bus as the metrics store** (queue depth, tick
  seq, F1–F15 rates, breaker, cost, goal-delta are already durable — the I-Ops read model, RS-DOS §49, is a SQL
  view) + **a read-only status page hosted OFF-Neo on Vercel** + **rotated launchd file logs**. No time-series DB,
  no exporters, no on-Neo dashboard.
- **Alternatives rejected:** self-hosted Prometheus/Grafana (second job + shared failure domain); hosted
  Grafana Cloud/Datadog (overkill + another bill at this scale — *deferred*, not forbidden, pulled when N grows or a
  team appears).
- **Consequences:** visibility is "good enough and honest," not "best-in-class." Richer observability is a named,
  deferred pull behind the same read model — adding it later does not re-architect anything.

### ADR-003 — The dead-man check-in is GATED on `/ready` (the check-in proves *supervision*, not just *power*)
- **Status:** PROPOSED.
- **Context:** A naive dead-man ping proves only that *a* process is running. It would happily ping while the
  engine-tick is stale or the Goal Supervisor is silent — hiding "alive but not supervising," the exact alive≠working
  gap the runtime spec is built to close (RS-DOS §7.1).
- **Decision:** Neo pings Healthchecks **only when its own `/ready` evaluates green** (heartbeat fresh AND cursor
  advancing AND GS posted within window). A stale heartbeat or silent GS therefore *stops the ping*, so the off-Neo
  dead-man catches degraded-but-running, not just powered-off.
- **Alternatives rejected:** an unconditional heartbeat ping (simpler, but blind to internal degradation — defeats
  the watchdog's purpose).
- **Consequences:** a tighter coupling (a `/ready` bug could suppress a legitimate ping → a *false page*). Accepted:
  a false page is strictly safer than a false silence.

---

## 11. What is built first vs deferred (Waterline honesty)

- **Build first (the M0 safety floor, before any meter-bearing move):** Healthchecks.io dead-man + the
  `/ready`-gated push check-in (ADR-001/003) + the Windows-task backup. *Nothing else is allowed to move until this
  exists* (EIB M0).
- **Build with the worker daemon (EIB M4):** the engine-tick internal timer + `engine_heartbeat` row (Layer B); the
  `/health` + `/ready` endpoints on the tailnet (Layer D); launchd `KeepAlive` + log rotation (Layer A); the GS slot
  (Layer E).
- **Build with the runner (EIB M1):** the runner-status poll (Layer C).
- **Build alongside (low-risk, high-value):** the off-Neo Vercel status page (§8) — it reuses the I-Ops read model
  and the `platform-health` shape, so it is mostly a render over data that already exists.
- **Deferred-until-pulled (named, not built):** hosted log shipping (Better Stack/Loki) — only if grep-over-SSH
  hurts; Grafana Cloud/Datadog — only at larger N or with a team; a rate-of-convergence floor for slow-asymptotic
  goals (RS-DOS §15.1, an open problem, not this doc's). The interfaces *admit* all three; the build waits for the
  first real driver.

---

*End of NEO-HBM-v1 — design only. No daemon installed, no monitor registered, no secret moved. An independent panel
ratifies (author≠verifier) and a founder gate authorizes before any of this is built; M0 (the off-Neo watchdog) is
the hard precondition that precedes every other step.*
