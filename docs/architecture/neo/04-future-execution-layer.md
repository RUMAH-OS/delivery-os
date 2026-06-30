---
artifact: FUTURE EXECUTION LAYER — how the Delivery OS execution architecture scales from one node (Neo) to N
id: FEL-DOS-v1
date: 2026-06-29
status: DESIGN ONLY — RESEARCH + ARCHITECTURE. Changes no code, installs nothing, registers no node, moves no secret. A founder gate authorizes any build.
scope_guard: A future-proof design over the already-specified contracts. Invents no new architecture — it makes the I-Placement / ExecutionProviderPort path concrete from N=1 (Neo) to N nodes (Windows, Linux, Mac Studio, cloud).
extends:
  - docs/reviews/EXECUTION-INFRASTRUCTURE-BLUEPRINT-2026-06-29.md (EIB-DOS-v1 — the ExecutionProviderPort §9, the two-node topology, the migration ladder M0–M7, DR §11, risks §17)
  - docs/reviews/RUNTIME-SPECIFICATION-2026-06-28.md (RS-DOS-v1 — §8 durable bus + lease/completer, §14 failure matrix F1–F15, §46 I-Placement, §45 I-Resource, §47 I-Provider, §54 data_class + trust boundary, §51 I-Version)
load_bearing_invariant: state is 100% on the durable Postgres bus; no node holds essential RAM state; therefore every node is replaceable (a registration, not a migration). The one irreplaceable asset is the Supabase database — back it up.
---

# Future Execution Layer (FEL-DOS-v1) — one node (Neo) to N

> **What this designs.** EIB-DOS-v1 named the `ExecutionProviderPort` and stood up the first two nodes
> (Windows = build, Neo = verify/CI/worker/deploy). This document designs the **layer above a single node**:
> how that port plus a **constraint-first Placement Selector** routes work across Neo *and every future node*,
> how a node failure is survived, how the whole fabric is recovered after a disaster, how it degrades offline,
> how a node stays **cattle, not a pet**, and **when to add what** as the fleet grows. It is future-proofing on
> top of contracts that already exist — not a redesign.

---

## 0. The one load-bearing idea (everything else follows from it)

**All durable state lives on the Postgres bus (RS-DOS §8.1). No node holds essential RAM state (§14 F2/F3).
Therefore a node is a replaceable execution surface, never a system of record.** Adding a node = registering an
adapter. Losing a node = a leased step expires and another node reclaims it. Recovering the world = stand up a
fresh node, point it at the same bus, resume. The port is what turns each of those into a configuration change
instead of an engineering project. Read every section below as a consequence of this one sentence.

Honest caveat stated once, up front (so the rest of the doc need not hedge every line): **only the
*checkpointed* step is durable. In-flight work between checkpoints — an LLM call mid-generation, a half-written
build — is at-risk and is re-run, not recovered.** "Every node replaceable" is true at the granularity of the
durable step, not the in-flight instruction. §3 makes the cost of that re-run bounded (the H1 budget cap); it
does not pretend the re-run is free.

---

## 1. The multi-node execution model

### 1.1 The three moving parts (none new — all from the established contracts)

| Part | What it is | Source |
|---|---|---|
| **`ExecutionRequest`** | the provider-agnostic job description: *what* + *requirements*, never *which machine* | EIB §9.2 (derived from RS-DOS §54.4 `WorkPackage`) |
| **`ExecutionProviderPort`** | the one app↔node coupling; each node is an adapter implementing it | EIB §9.3 (mirrors the engine's injected `AgentExecutor`) |
| **Placement Selector** | constraint-first map of `requirements → eligible node`, optimize second | EIB §9.4 (mirrors RS-DOS §54.2 trust-boundary rule) |

The Project Owner / Sprint Engine describes **WHAT** must happen and its **REQUIREMENTS** and **never names a
machine** (RS-DOS §46: "the PO never knows *where* execution happens"). The selector maps requirements to a node;
the injected port runs the job there; the result returns on the durable-bus completer. That is the whole model.

### 1.2 The job description (what the PO emits)

```ts
interface ExecutionRequest {                       // EIB §9.2 — no invented fields
  jobId: string;                                   // idempotency key (write-ahead-intent; dup = no-op)
  goalId: string;                                  // tenancy scope — a node may only touch its own goal_id (RS §54.3)
  kind: "build"|"verify"|"deploy"|"supervise"|"migrate"|"probe";
  payload: Record<string, unknown>;                // OPAQUE, PII-free refs/codes
  data_class: "PUBLIC"|"INTERNAL"|"CONFIDENTIAL"|"PII"|"SECRET";   // GATES eligibility FIRST (RS §54.1/§54.2)
  placement_req: {
    lane: "short"|"long";                          // short = a check (runner); long = a soak/build/autonomy run (worker)
    isolation: "shared"|"dedicated";
    resource_class: "cpu-small"|"cpu-large"|"gpu"|"macos"|"any";
    capabilities?: string[];                       // ["pg","docker","vercel-token"] — matched against node labels
  };
  budget: { maxWallclockMs: number; maxCost?: number };   // the H1 cap travels WITH the job (bounds any re-run)
}
```

Three fields do the routing work, and they are deliberately orthogonal so the fleet can grow along any axis
without the others changing:
- **`data_class`** — *who is allowed to see this?* Gates trust domain. This is why a cloud node can be added
  later without re-auditing PII handling: the contract already refuses to place `PII`/`SECRET` on an `external`
  node (§1.5).
- **`resource_class` + `capabilities`** — *what does the work need?* GPU, macOS, a warm Postgres, a Vercel
  token. Matched against node labels.
- **`lane`** — *short check or long soak?* Separates the event-driven runner surface from the continuous worker
  surface. A `short` job wants a runner; a `long` job wants the worker daemon.

### 1.3 The node adapter (what each machine provides)

```ts
interface ExecutionProviderPort {                  // EIB §9.3 — the ONE app/runtime coupling
  readonly nodeId: string;                         // "windows-node1" | "neo-node2" | "linux-node3" | ...
  readonly labels: string[];                       // ["self-hosted","macos","neo","pg","vercel-token"]
  readonly trustDomain: "trusted"|"contractual"|"external";   // RS §54.2 gate
  canAccept(req: ExecutionRequest): boolean;       // label + resource + data_class eligibility (PURE, no side effects)
  execute(req: ExecutionRequest, signal: AbortSignal): Promise<ExecutionOutcome>;  // does the work, honors budget
}

type ExecutionOutcome =
  | { ok: true;  jobId: string; evidenceRef: string; metrics?: Record<string, number> }   // evidenceRef → bus
  | { ok: false; jobId: string; error: string; retryable: boolean };
```

**"Add a node = register an adapter, zero PO change"** is exactly this: a new machine ships a `canAccept` +
`execute` and appends itself to the registry. The PO/Sprint-Engine code is untouched — the §44 acceptance test
("adding an implementation must not change Runtime behavior"). The registry is the only thing that grows.

### 1.4 The node registry (the fleet, as data not code)

The registry is a list of live adapters, each self-describing via its `nodeId` / `labels` / `trustDomain`.
Membership is **dynamic, not compiled**: a node joins the tailnet (EIB §8), comes up, and registers; it drains
and de-registers on shutdown. The selector reads whatever is currently registered. This is the difference
between *the architecture changing* (never) and *the registry getting longer* (every time the fleet grows).

A node's registry entry is the join of three facts it already publishes:

| Fact | Carried by | Used for |
|---|---|---|
| identity + reachability | tailnet MagicDNS name (`neo-node2`) | addressing, liveness (EIB §8) |
| trust domain | `trustDomain` | the `data_class` gate (§1.5) |
| capabilities | `labels` (`pg`, `docker`, `vercel-token`, `macos`, `gpu`) | resource/capability match |

Heartbeat: each registered node refreshes a liveness lease on the bus (the same lease primitive the steps use).
A node whose liveness lease expires is treated as offline by the selector — it stops receiving placements
without anyone editing the registry (this is the seam that makes failover automatic, §2).

### 1.5 The placement decision flow (constraint-first, optimize-second)

```ts
function selectNode(req: ExecutionRequest, registry: ExecutionProviderPort[]): ExecutionProviderPort | "no-eligible-node" {
  const eligible = registry.filter(n =>
    isLive(n) &&                                         // liveness lease not expired (§1.4)
    n.canAccept(req) &&                                  // labels + resource_class + capabilities match
    trustBoundaryOk(req.data_class, n.trustDomain));     // RS §54.2 — PII/SECRET → trusted only, FAIL-CLOSED
  if (eligible.length === 0) return "no-eligible-node";  // → the job WAITS, or the goal HALTS+summons. NEVER invent a node.
  return optimize(eligible, ["lowest-queue-depth", "lowest-cost", "lowest-latency"]);
}
```

```
            ExecutionRequest (kind + data_class + placement_req + budget)
                                  │
                                  ▼
   ┌──────────────────────────────────────────────────────────────────────┐
   │ STEP 1 — CONSTRAIN (a node is eligible ONLY if all three hold)         │
   │   a) live?            liveness lease fresh           (else: skip node) │
   │   b) capable?         labels ⊇ capabilities          (else: skip node) │
   │                       resource_class satisfiable                       │
   │   c) trusted-enough?  trustBoundaryOk(data_class, trustDomain)         │
   │                       PII/SECRET → trusted only      (else: skip node) │
   └──────────────────────────────────────────────────────────────────────┘
                                  │
                ┌─────────────────┴───────────────────┐
          eligible = ∅                          eligible ≠ ∅
                │                                       │
                ▼                                       ▼
   ┌────────────────────────────┐      ┌────────────────────────────────────────┐
   │ FAIL-CLOSED:               │      │ STEP 2 — OPTIMIZE within the eligible set│
   │  • short-lived shortage →  │      │  rank by: lowest-queue-depth →           │
   │    the job WAITS on queue  │      │           lowest-cost → lowest-latency   │
   │  • structural (no trusted  │      │  (author≠verifier: a `verify` job is     │
   │    node for PII) →         │      │   placed on a DIFFERENT node than its    │
   │    HALT + summon founder   │      │   `build` job, by policy — §1.6)         │
   │  NEVER downgrade the       │      └────────────────────────────────────────┘
   │  boundary; NEVER invent.   │                       │
   └────────────────────────────┘                       ▼
                                          execute(req, signal) on the chosen node
                                                         │
                                                         ▼
                                   ExecutionOutcome.evidenceRef → completeAwaitingStep
                                   (idempotent, CAS-guarded, lease released — RS §8.2)
```

Two properties make this future-proof rather than merely functional:
- **Constraint before optimization.** `data_class` eligibility is decided *before* cost/latency. A cheaper
  cloud node never wins a PII job, because it is filtered out in Step 1, not out-bid in Step 2. The optimization
  policy can be tuned freely without ever weakening the trust boundary.
- **Fail-closed on empty.** No eligible node is a first-class outcome, never a silent downgrade. A transient
  shortage (every node busy) parks the job on the durable queue; a structural shortage (no trusted node exists
  for a PII goal) halts-and-summons the founder. This is `selectAgentFor`'s no-match discipline lifted to nodes.

### 1.6 How results return, and how author≠verifier becomes physical

Unchanged from the built engine. The chosen node's `execute` writes `evidenceRef` (a VERIFY artifact, a build
ref, a deploy URL, a `ProgressSample`) and the step completes through the existing `completeAwaitingStep`
completer on the durable bus — idempotent, CAS-guarded, lease-released (RS §8.2). **No new return path is
invented**; the port plugs in exactly where `AgentExecutor` does today.

The selector turns the verify-gate's "neutral hardware" requirement (D9) from an identity claim into a physical
fact: a `verify`-kind job is *placed on a different node than its `build`-kind job by policy*. Build on
`windows-node1`, verify on `neo-node2` — author≠verifier holds on hardware the author does not control. As the
fleet grows the policy generalizes to "never the same node that built it," which N>2 makes trivially satisfiable.

### 1.7 Why this is a platform capability, not a per-consumer one

The port and selector live in **delivery-os** (`templates/workflow-engine/`, beside `agent-runner.ts`),
versioned by the base, **adopted-by-pin** by consumers (RS §51 `I-Version`). rumah-admin and PLOS get
node-independence *for free* when they pin the runtime version that ships the port; a consumer never
re-implements placement — it registers the nodes it physically has. This is the I-Placement row of the §53
interface catalog, made buildable.

---

## 2. Failover — a node goes offline mid-job

### 2.1 The mechanism: durable-bus lease / reclaim

Every step a node works is **leased** on the bus (CAS lease, RS §8.1). The lease is the failover primitive:

```
node N leases step S ──┐
                       │  (N works S; the lease has a TTL; N renews it while alive)
                       │
        N dies / reboots / loses network / launchd kills the daemon
                       │
                       ▼
        N stops renewing the lease  ──→  lease TTL expires
                       │
                       ▼
        the SKIP-LOCKED tick on ANY live node sees an expired-lease step
                       │
                       ▼
        a live node re-leases S and resumes it from the last DURABLE checkpoint
                       │
                       ▼
        completeAwaitingStep is idempotent + CAS-guarded → NO double-execution
        (advance only where awaiting_event_id = mine AND state = blocked)
```

This is RS-DOS DoD-1 ("killing any reconciler/agent/session loses no progress") and failure classes **F2**
(session crash — the blocked step holds no lease, trivially re-leased) and **F3** (reconciler crash — the next
tick re-reads durable state). A Neo reboot is the everyday case: launchd restarts the worker daemon, it
re-reads the bus, it reclaims its own expired leases. No human, minutes, automatic.

### 2.2 Safe vs at-risk state (the honest line)

| State | Class | On node loss |
|---|---|---|
| committed step results, posted `WorkResult`/`VERIFY`, `ProgressSample`, ledger rows, breaker state | **durable, replayable** | survives — it is on the bus |
| the lease itself | **durable** | expires → reclaimed |
| a half-generated LLM response, a half-run build, un-posted in-RAM progress | **AT-RISK** | **lost — re-run from the last checkpoint** |

**The in-flight-work caveat, stated plainly:** the reclaim resumes from the last *durable checkpoint*, not from
the instruction the dead node was mid-execution on. An LLM call that was 80% through generating when the node
died is **re-run from the checkpoint**, not resumed at 80%. That re-run is **bounded by the job's `budget` cap**
(`maxWallclockMs` / `maxCost`, §1.2) — a node that dies and is reclaimed cannot spend the budget twice past the
cap, because the cap travels with the job and is enforced by the completer, not the dead node. So the cost of a
failover is "at most one checkpoint-to-checkpoint segment, re-run, inside the remaining budget" — small, bounded,
and never a runaway.

This is the precise meaning of **"every node replaceable"**: replaceable at the granularity of the durable step.
We do not claim in-flight LLM work is recovered; we claim its *loss is bounded and its re-run is safe* (idempotent
completer ⇒ no double-commit; budget cap ⇒ no double-spend).

### 2.3 Failover targets as the fleet grows

| Fleet | A dead node's work is reclaimed by | Caveat |
|---|---|---|
| N=1 (Neo only) | the same node on reboot | if Neo is *down* (not rebooting), nothing reclaims until it returns — the N=1 honest gap, mitigated by the off-Neo dead-man's-switch alarming the founder (EIB §4.4) and the one-line `runs-on` fail-back to GitHub-hosted (EIB §12) |
| N=2 (Windows + Neo) | the surviving node, if it carries the needed labels | a `macos`-only job cannot fail over to Windows — capability, not just liveness, gates reclaim |
| N≥3 | any live, eligible node | label coverage should be **redundant** for any `resource_class` the autonomy loop depends on (don't let one node be the sole `pg` holder) |

**Design rule the fleet roadmap must honor:** *no capability that the continuous autonomy loop depends on may
live on exactly one node.* The moment a `resource_class` is single-homed, that node is a pet again. (§6 sets when
to add the second home.)

### 2.4 The watchdog independence rule (carried, non-negotiable)

The dead-man's-switch that watches the supervisor **must not share the supervisor's failure domain** (EIB §4.4,
RS §7.4 / F4). It runs on a free external monitor (Healthchecks.io) + a Windows Scheduled-Task backup — never on
Neo. If Neo (worker + supervisor) dies, the off-Neo watchdog converts the silence into a founder ping. This is
the only thing that turns "the autonomy host died at 2am" from silent rot into an alarm. It is a hard
precondition of self-hosting, not an optional extra.

---

## 3. Disaster recovery — losing more than one node

### 3.1 What must be backed up (and what must not bother)

| Asset | Backup | Why |
|---|---|---|
| **Supabase / Postgres (the durable bus + ledgers + app data)** | **the crown jewel** — automated daily PITR + a periodic off-provider logical dump | this is the ONE thing whose loss is *not* recoverable by re-registering a node. Everything else is derivable or re-installable. |
| config / secret registry | the config platform is the source of truth; secrets live in GitHub Actions Secrets + the macOS Keychain (`ci-runner` user), never in the tree | re-vendored onto a fresh node, not restored from a node backup |
| the durable-bus *schema* | in the repo (migrations, expand/contract) | re-applied to a fresh Postgres, forward-only |
| a node's local disk | **explicitly NOT backed up** | a node is cattle — it holds no irreplaceable state (§5). Backing it up would be backing up a cache. |

The asymmetry is the whole DR posture: **back up the database obsessively; treat every node as disposable.**

### 3.2 The recovery procedure (fresh node → rejoined fabric → resumed work)

```
DISASTER: a node (or all nodes) lost — hardware death, theft, corrupted OS.

1. STAND UP a fresh node from the documented setup (§5 / EIB §4) — any machine: a spare Mac, a Linux box, a
   cloud VM. The setup is an install order, not a snapshot restore.
2. REJOIN the tailnet (Tailscale up, tailnet-lock approves the new node, ACL tag assigned by data-class).
3. RE-VENDOR secrets: the config-doctor fail-closed gate refuses to start until the complete, valid config set
   is present (GitHub Secrets for CI/deploy; Keychain for the worker daemon). No secret is restored from a node
   image — it is re-issued from the source-of-truth store.
4. REGISTER the adapter: the node comes up, refreshes its liveness lease, appears in the registry. The selector
   begins placing eligible work on it. Zero PO change.
5. RESUME from the durable bus: the worker daemon re-reads bus state; expired leases from the dead node are
   reclaimed (§2.1); in-progress goals continue from their last checkpoint. No goal is re-submitted; no founder
   re-issues anything.

IF THE DATABASE ITSELF WAS LOST: restore Supabase from PITR/dump FIRST (this is the RPO-bound step), then run
steps 1–5 against the restored bus.
```

The deepest property: because the bus is the system of record and nodes are stateless, **DR of the compute fleet
is a re-registration, and DR of the *system* is a database restore.** Those are two very different RTOs and the
plan keeps them separate.

### 3.3 RTO / RPO — honest estimates

| Scenario | RPO (data loss) | RTO (time to resume) | Basis |
|---|---|---|---|
| Single node reboot | **0** (durable bus) | **minutes, automatic** | launchd restart → reclaim leases (§2.1) |
| Single node hardware death (bus intact) | **0** | **hours** (stand up + rejoin + re-vendor a replacement) — *or* **minutes** if the work just fails back to GitHub-hosted via the one-line `runs-on` lever (EIB §12) while a replacement is built | EIB §11 |
| Whole fleet lost, **database intact** | **0** | **hours** — one fresh node restores full operation; the bus never went away | §3.2 |
| **Database lost**, restore from backup | **= the backup interval** — minutes with Supabase PITR; up to ~24h if relying only on the daily logical dump | **hours** (restore DB, then §3.2) | §3.1 |

Honest reading: **RPO is 0 for any compute loss and bounded by the DB backup cadence for a DB loss** — so the
backup cadence *is* the RPO knob, and PITR is what makes it minutes instead of a day. **RTO is minutes when
automatic (reboot/fail-back) and hours when a human must stand up a replacement.** The numbers are a solo-founder
reality, not an enterprise SLA: there is no on-call but the founder (EIB §13), so "hours" assumes the founder is
reachable. The off-Neo watchdog (§2.4) is what bounds *detection* time so RTO doesn't silently start late.

---

## 4. Offline operation — degradation and drain

### 4.1 The connectivity layers (each degrades independently)

The fabric has three independent reachability planes; an outage in one does not take the others (EIB §8/§11):

| Plane | Carries | If it drops |
|---|---|---|
| **Tailnet (Tailscale)** | founder ops-SSH, node↔node health | low impact — nodes reach Supabase/GitHub/Vercel over **public TLS**, not the tailnet; only founder remote-ops degrades |
| **Public internet** | the bus (Supabase pooler), GitHub, Vercel, Claude API | high impact — see §4.2 |
| **A single node's link** | that node's participation | its leases expire → other nodes reclaim (§2); the fleet continues |

### 4.2 What works when the *internet/bus* is offline

The bus is Supabase-hosted (public TLS). If a node loses the internet, it loses the bus — and the durable bus is
the only channel (RS §8.1). So the honest answer is **graceful pause, not offline autonomy**:

- **In-flight local work continues to its next checkpoint**, then **blocks** — it cannot post the result (no
  bus). The work is not lost; the step holds no lease while blocked (crash-while-blocked is trivial, RS §8.1), so
  when connectivity returns it completes the post.
- **New placements stop** — the selector cannot read the registry/queue without the bus. Jobs accumulate as
  unsubmitted intents locally and as un-drained queue rows remotely.
- **No double-execution on reconnect** — the idempotency store (write-ahead-intent, RS §8.3 / F12) means a job
  that was half-recorded before the drop is a no-op on replay. **Dup = no-op** is the invariant that makes
  reconnect safe.
- **The founder boundary degrades safely** — if Slack is down at a boundary, the summon falls back to a non-SaaS
  channel; Class-C boundaries **fail-closed** (the action waits), non-irreversible ones fail-safe to a queued
  summon (RS §3.3 / F14). A chat outage **never** silently unleashes *or* permanently stalls the fleet.

### 4.3 The queue draining when connectivity returns

```
connectivity restored
   │
   ▼
nodes refresh their liveness leases → re-appear in the registry
   │
   ▼
the SKIP-LOCKED tick resumes draining the durable queue (it never knew it paused — level-triggered, RS §4.4)
   │
   ▼
blocked local steps post their held results (idempotent completer; dup = no-op)
   │
   ▼
the selector places the accumulated backlog by lowest-queue-depth first → the fleet catches up
```

The level-triggered, durable-queue design means **reconnect needs no special "recovery mode"** — a late tick is
indistinguishable from a normal tick because both just read durable state and act (RS §4.4, the resync property).
Offline is just "a very late tick."

### 4.4 The honest limit

There is **no fully-offline autonomy** in this design and that is deliberate: the system of record is a hosted
database by choice (RS §8, ECR-0006 — a transactional outbox over a managed Postgres beats a self-hosted
distributed log for a solo operator). A node can survive a *tailnet* outage fully and an *internet* outage as a
safe pause-and-resume. A genuinely air-gapped node would need a local durable bus + later reconciliation — named,
not designed, deferred until a real driver (an offline-first deployment) exists. The contract (`I-Placement` +
the idempotent completer) *admits* it; the build waits.

---

## 5. Portable execution — the node as cattle, not a pet

### 5.1 The reproducibility contract

A node is **reproducible from a documented setup**, never from a backup image. The setup is an *install order*
(EIB §4) — the same order whether the node is Neo, a Linux box, or a cloud VM:

1. OS baseline + a **dedicated non-admin user** (`ci-runner`) — no access to the founder's personal Keychain.
2. Toolchain pinned to CI parity: Node 22, pnpm/npm, gitleaks `v8.18.4`, Vercel CLI `48.12.1`, colima +
   `postgres:16` (test DB parity).
3. Join the tailnet (Tailscale up, tailnet-lock, ACL tag by data-class).
4. Re-vendor secrets from the source-of-truth store (GitHub Secrets / Keychain) — the config-doctor fail-closed
   gate confirms completeness before anything runs.
5. Install the role: the **ephemeral self-hosted runner** (for `short`/check lanes) and/or the **launchd/systemd
   worker daemon** (for `long`/autonomy lanes).
6. Register the adapter → liveness lease → the selector starts placing work.

Every step is idempotent and re-runnable; none restores hidden state. **A node that is hard to reproduce is a
bug** — the fix is to move whatever made it special into the documented order or the config registry.

### 5.2 The "no node holds irreplaceable state" test

A node passes the cattle test iff: **deleting it and running §5.1 on a blank machine resumes all its work with
RPO 0.** Three things must be true (and the design enforces each):
- its *results* are on the bus, not its disk (RS §8) — enforced by "the bus is the only channel";
- its *secrets* come from the config platform, not a dotfile (EIB §7) — enforced by the config-doctor gate;
- its *identity/reachability* is a tailnet name + a registry entry, not a hardcoded reference (EIB §8) — enforced
  by MagicDNS + dynamic registry.

If all three hold, the node is cattle. The DR procedure (§3.2) *is* this test executed under duress.

### 5.3 Version portability (a node can run an old or new runtime)

Runtime contracts are versioned and evolve expand/contract (RS §51 `I-Version`): the bus/ledger schemas are
version-tolerant, so a node pinned to runtime v1 and a node pinned to v2 **coexist on the same durable spine**. A
new node does not force a fleet-wide upgrade; it pins a version and joins. This is what lets the fleet grow
*incrementally* (§6) without a synchronized cutover — the same adopt-by-pin discipline consumers already use.

---

## 6. The fleet-growth roadmap (1 node → N: when to add what)

The governing principle: **add a node only when a real signal demands it — never speculatively (Waterline).**
Each node is justified by a *driver*, plays a *role*, and is reversible (drain + de-register). The architecture
never changes; the registry gets one row longer.

### 6.1 The growth ladder

| Step | Node | Role | **Add it when** (the driver) | Cost / benefit |
|---|---|---|---|---|
| **1 (now)** | `windows-node1` (this machine) + **`neo-node2`** (the MacBook, Execution Node 1) | Windows = dev/build/interactive; Neo = verify + CI + the autonomy **worker daemon** + deploy | already justified — the GitHub-Actions meter is exhausted (EIB forcing function); the continuous supervision workload *needs* a worker, not cron | benefit: ~$80–150/mo + the autonomy ceiling → ~$3–5/mo electricity, 5-second tick granularity. cost: the founder becomes the SRE (EIB §13) |
| **2** | `linux-node3` (a cheap Linux server / mini-PC / always-on VM) | the **cheap CI + worker** node — Docker-native, no macOS-update churn | Neo's maintenance tail bites (colima breaks on a macOS update; the runner offline-rots), OR check latency hurts because one node serializes the queue, OR you want failover redundancy for the `pg`/worker capability (§2.3) | low one-time cost; removes the single-node SPOF on the *continuous* workload; Linux is the cheapest, most stable CI substrate. **The first node to add after Neo, for reliability not capacity.** |
| **3** | `studio-node4` (a Mac Studio) | the **heavy continuous host** — large builds, macOS/iOS-specific work, the always-on worker that Neo (a laptop) shouldn't be | the laptop-as-server strain shows (thermals, "must not sleep" fragility), OR a genuine macOS/large-build need appears that a laptop can't carry | higher one-time cost; buys a *proper* always-on host so the MacBook returns to being a laptop. Add when the workload has *proven* it needs a desktop-class continuous host — not before. |
| **4** | `cloud-node5` (a cloud VM, on-demand) | **burst capacity** — absorb a spike of `short`/`PUBLIC` checks; scale to zero between bursts | queue depth spikes at portfolio scale and owned hardware can't absorb the peak (RS §45 `I-Resource` becomes real) | pay-per-use, scale-to-zero; **`trustDomain: external`** so the `data_class` gate **refuses PII/SECRET on it, fail-closed** (§1.5) — exactly why the contract field is built now while it is vacuous. Burst only; never the spine. |

### 6.2 The heterogeneous-fleet placement (how a mixed fleet routes)

Once N≥3 the selector is doing real heterogeneous routing, all through the same port:

```
ExecutionRequest                          → placed on
─────────────────────────────────────────────────────────────────────────────
build, data_class=PII, resource=cpu-large → linux-node3 or studio-node4 (trusted, large) — NEVER cloud-node5
verify, data_class=INTERNAL               → any trusted node ≠ the build node (author≠verifier, §1.6)
supervise (long), data_class=CONFIDENTIAL → the worker daemon on neo-node2 / studio-node4 (continuous, trusted)
deploy, capabilities=[vercel-token]       → the node holding the founder Vercel token (identity travels with the secret)
probe/check (short), data_class=PUBLIC    → cheapest live node by queue-depth — cloud-node5 wins a burst
```

The optimization policy (`lowest-queue-depth → lowest-cost → lowest-latency`) does the load-balancing; the
`data_class` gate does the safety; the `capabilities` match does the fitness. **The selector grows from "pick the
one eligible node" (N=2) to "balance across N by queue-depth/cost" (N≥3) — a policy change behind the same port**
(RS §45 `I-Resource`, pulled when N makes it hurt). The architecture does not change; the registry gets longer.
That is the entire point of the port.

### 6.3 The order is deliberate (reliability before capacity before burst)

- **Linux (step 2) before Mac Studio (step 3) before cloud (step 4).** The first need after Neo is *reliability*
  (a second home for the continuous workload so Neo isn't a pet), and Linux is the cheapest, most stable way to
  buy it. Capacity (Mac Studio) and burst (cloud) are *later* needs that only a proven workload justifies.
- **Each step is reversible.** Drain the node (stop taking new placements, let leases complete), de-register,
  power off. Nothing depended on it that the durable bus didn't already hold.
- **Never two steps at once.** Add one node, prove parity (the EIB §15 parity test: byte-identical gate verdicts
  on the same commit), then consider the next. Big-bang fleet growth is the anti-pattern.

---

## 7. ADRs (the load-bearing choices)

### ADR-FEL-1 — Durable-bus-backed replaceable nodes (the foundation)

- **Status:** Accepted (design) — inherits EIB §11 + RS §8/§14, made explicit for the fleet.
- **Context:** the fleet must scale from 1 to N nodes without any node becoming a system of record, or every node
  addition is a migration and every node loss is data loss.
- **Decision:** **all durable state lives on the Postgres bus; no node holds essential RAM state; therefore every
  node is a replaceable execution surface.** A node is added by registering an adapter and lost by letting its
  lease expire and reclaiming.
- **Consequences:** (+) add/remove/recover a node = a config change, not an engineering project; (+) failover and
  DR fall out of one mechanism (lease/reclaim); (−) **in-flight work between checkpoints is at-risk** — re-run,
  bounded by the budget cap (§2.2), not recovered; (−) the bus is now the single thing whose loss is
  unrecoverable → it must be backed up obsessively (ADR-FEL-3).
- **Rejected:** node-local durable state with peer replication — adds a distributed-consensus problem a solo
  operator should not own; the managed Postgres outbox (ECR-0006) is the deliberate simpler choice.

### ADR-FEL-2 — Constraint-first placement with a fail-closed trust gate

- **Status:** Accepted (design) — the buildable form of RS §46 + §54.2.
- **Context:** routing must optimize for cost/latency *and* never leak PII/SECRET onto an ineligible (e.g. cloud)
  node, even as untrusted nodes are added.
- **Decision:** the selector **gates on `data_class` eligibility first** (liveness + capability + trust domain),
  **optimizes second** within the eligible set; an empty eligible set is **fail-closed** (wait or halt-and-summon),
  never a silent downgrade, never an invented node.
- **Consequences:** (+) adding an `external` cloud node later is safe by construction — the contract already
  refuses PII on it; (+) the optimization policy can be tuned freely without ever touching the safety boundary;
  (−) a structural shortage (no trusted node for a PII goal) *blocks* the goal — correct, but it means trusted
  capacity must be provisioned ahead of PII workloads.
- **Rejected:** optimize-first-then-filter (a cheaper node could win then be rejected, wasting a placement cycle)
  and best-effort placement (would silently downgrade the boundary — the exact thing §54.2 forbids).

### ADR-FEL-3 — Asymmetric DR: back up the database, treat nodes as cattle

- **Status:** Accepted (design) — EIB §11 made explicit.
- **Context:** with stateless nodes, the database is the only irreplaceable asset; spending DR effort on node
  images would protect a cache while under-protecting the crown jewel.
- **Decision:** **back up Supabase/Postgres obsessively (PITR + periodic off-provider dump); back up no node
  disk.** Recovery = restore the DB (if lost) + stand up a fresh node from the documented order + re-vendor
  secrets + resume from the bus.
- **Consequences:** (+) RPO 0 for any compute loss, bounded by backup cadence for a DB loss; (+) DR of the fleet
  is re-registration, DR of the system is a DB restore — two clean, separate RTOs; (−) the founder must actually
  verify backups restore (an unverified backup is not a backup) and must accept "hours" RTO for a human-driven
  node rebuild (no on-call but the founder).
- **Rejected:** node-image backups (protects the wrong thing) and multi-region active-active (enterprise cost a
  solo operator cannot justify; the one-line GitHub-hosted fail-back lever covers the acute case).

### ADR-FEL-4 — Incremental, reliability-first fleet growth (Linux → Mac Studio → cloud)

- **Status:** Accepted (design) — EIB §16 ordered.
- **Context:** the fleet could grow in any order; the wrong order buys capacity before removing the single-node
  SPOF.
- **Decision:** grow **reliability first (a Linux second home for the continuous workload), then capacity (a Mac
  Studio continuous host), then burst (an on-demand cloud node)** — each justified by a real driver, each
  reversible, never two at once.
- **Consequences:** (+) the most dangerous risk (Neo as a single point of failure for continuous autonomy) is
  retired earliest and cheapest; (+) every addition is parity-proven before the next; (−) requires founder
  discipline to *not* over-provision speculatively (Waterline).
- **Rejected:** "buy the Mac Studio first" (capacity before reliability) and "go straight to cloud autoscaling"
  (an external trust domain as the spine, plus metered cost — the exact model the EIB forcing-function rejected).

---

## 8. Risks and trade-offs

| # | Risk | Severity | Bound (mitigation) | Residual (honest) |
|---|---|---|---|---|
| R1 | **Single point of failure = Neo + the founder** (N=1/N=2 concentrate CI+verify+worker+deploy on one machine, one person, no on-call) | High | off-Neo dead-man's-switch (hard precondition, §2.4); one-line `runs-on` fail-back to GitHub-hosted (EIB §12); durable-bus state ⇒ replaceable; backed-up DB (ADR-FEL-3); **Linux node added next, for redundancy not capacity (§6)** | mitigated, not removed until N≥3 with redundant capability coverage |
| R2 | **In-flight LLM work is lost on failover** (only the checkpoint is durable) | Medium | re-run from checkpoint, **bounded by the budget cap** (§2.2); idempotent completer ⇒ no double-commit; checkpoint granularity can be tightened where re-run cost hurts | a failover always costs ≤ one checkpoint segment of re-run — accepted, not eliminated |
| R3 | **The database is now the one unrecoverable asset** | High | PITR + off-provider dump (ADR-FEL-3); **founder must periodically prove a restore** (an untested backup is not a backup) | a DB loss with a stale backup → RPO = the backup interval; the restore RTO is hours |
| R4 | **Self-hosted runner code-execution exposure** (a malicious PR runs arbitrary code on owned hardware) | Medium (low for solo private repos; rises with any external contributor) | ephemeral runners (clean per job, no persisted secret); dedicated non-admin user; least-scope job tokens; **never `pull_request_target` on self-hosted**; tailnet ACLs outbound-only (EIB §17) | re-evaluate the instant a second contributor or a public fork appears |
| R5 | **Operational rot over the long tail** ("runner offline / macOS update broke colima / token rotated and the daemon didn't reload" — silent, six-months-later) | High (the real long-run risk) | the independent uptime monitor turns silence into a ping; config-doctor fail-closed refuses a stale secret set; **Linux node removes the macOS-update churn from the critical path (§6)** | a solo founder is the SRE — the reversibility lever is what keeps this acceptable |
| R6 | **A node becomes a pet** (a capability single-homed; an undocumented manual setup step) | Medium | the cattle test (§5.2) as a standing check; "no autonomy-critical capability on exactly one node" rule (§2.3); reproducibility-from-documented-order, not from an image | requires discipline to keep the setup order authoritative as nodes drift |
| R7 | **No fully-offline autonomy** (the bus is a hosted DB) | Low (by design) | tailnet outage survived fully; internet outage = safe pause-and-resume (§4); idempotent completer ⇒ safe reconnect | air-gapped operation is named-not-built; pulled only by a real offline-first driver |
| R8 | **Trust-gate provisioning gap** (a PII goal with no trusted node halts) | Low–Medium | fail-closed is *correct* behavior, not a bug; provision trusted capacity ahead of PII workloads | a structural shortage blocks the goal until trusted capacity exists — an honest constraint, surfaced not smoothed |

**The trade-off in one line:** this design buys *unbounded, off-meter, continuous, portfolio-scale execution with
replaceable nodes* at the price of *a standing operational surface a solo founder must personally own.* The
durable bus + the port make the **blast radius of any single node small** (fail back by flipping one line), and
that reversibility is precisely what makes the operational risk acceptable. Without the off-node watchdog and the
fail-back lever, it would not be.

---

## 9. What is built now vs deferred (Waterline honesty)

| Build now (the N=2 spine) | Deferred-until-pulled (named, not built) |
|---|---|
| the `ExecutionProviderPort` interface + the constraint-first selector + the `data_class` gate (vacuous at one trust domain, but present so a cloud node is safe later) | the global cross-project scheduler / `I-Resource` admission control (RS §45) — pulled at portfolio queue contention |
| two adapters: `windows-node1` (build), `neo-node2` (verify/CI/worker/deploy) | the `I-Provider` multi-LLM-provider selection (RS §47) — pulled by a privacy or cost/quality driver |
| the lease/reclaim failover (already in `agent-runner.ts`) + the off-Neo watchdog | N>2 heterogeneous balancing, GPU `resource_class`, the air-gapped local-bus mode — pulled when a real node makes them hurt |
| the DB backup + the documented node-setup order (the DR + cattle contract) | multi-region active-active DR — rejected for a solo operator (ADR-FEL-3) |

The interface **admits** every deferred item; the build waits for the first real driver. The fleet roadmap (§6)
is the schedule of those drivers.

---

## 10. Summary

- **Multi-node routing:** the PO emits a provider-agnostic `ExecutionRequest` (kind + `data_class` +
  `placement_req` + budget); a **constraint-first Placement Selector** filters the live registry by
  liveness + capability + **trust domain** (fail-closed on empty), then optimizes by queue-depth/cost/latency;
  the chosen node's `ExecutionProviderPort` adapter runs it and returns evidence on the durable-bus completer.
  **Adding a node = registering an adapter, zero PO change** (the §44 acceptance test). author≠verifier becomes
  physical: verify is placed on a different node than build, by policy.
- **Failover:** every step is leased on the bus; a dead node's lease expires and **any live, eligible node
  reclaims and resumes from the last durable checkpoint** (idempotent completer ⇒ no double-execution). Durable
  state survives; **in-flight LLM work between checkpoints is re-run, not recovered — bounded by the budget
  cap.** That bounded re-run is the precise, honest meaning of "every node replaceable."
- **DR + RTO/RPO:** back up the **database obsessively (PITR + dump), no node disk**; recover by standing up a
  fresh node from the documented order, rejoining the tailnet, re-vendoring secrets, and resuming from the bus.
  **RPO = 0 for any compute loss**, = the backup cadence for a DB loss. **RTO = minutes when automatic**
  (reboot/fail-back), **hours when a human stands up a replacement** — a solo-founder reality, not an
  enterprise SLA.
- **Offline:** a tailnet outage is survived fully; an internet/bus outage is a **safe pause-and-resume** (work
  blocks at its next checkpoint, holds no lease, posts on reconnect; the idempotent store makes reconnect
  double-execution-free); the founder boundary fails closed for Class-C. No fully-offline autonomy by design —
  named, deferred.
- **Portability:** a node is **cattle** — reproducible from a documented install order, holding no irreplaceable
  state (results on the bus, secrets from the config platform, identity from the tailnet+registry). The cattle
  test = "delete it, rebuild from §5.1, resume with RPO 0." Version-portable via adopt-by-pin (expand/contract).
- **Fleet roadmap (1→N):** **now** Windows + Neo (build / verify+CI+worker+deploy); **next** a **Linux node for
  reliability** (a redundant home for the continuous workload — the first add, for SPOF removal not capacity);
  **then** a **Mac Studio** as a proper always-on heavy host when the laptop strains; **then** an **on-demand
  cloud node** for burst, fenced to `trustDomain: external` so the `data_class` gate refuses PII on it.
  Reliability before capacity before burst; one node at a time; parity-proven; reversible. The architecture never
  changes — the registry just gets longer.
