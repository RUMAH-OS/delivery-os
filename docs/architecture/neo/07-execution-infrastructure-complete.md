---
artifact: EXECUTION INFRASTRUCTURE — COMPLETE (the Neo Adapter subsystem: the two consumed contracts, bootstrap, supervision, config templates, install scripts, CI/CD + deploy)
id: NEO-EXEC-07
date: 2026-06-30
status: DESIGN + TEMPLATES + SCRIPT-DESIGNS — INSTALLS NOTHING. No node is joined, no daemon loaded, no runner registered, no secret moved, no ACL applied, no script run. This document completes the Neo design streams (00–06) by specifying the REMAINING implementation-ready pieces: the two platform-owned CONTRACTS the infra consumes, the end-to-end BOOTSTRAP, the launchd SUPERVISION plists, the parameterized CONFIGURATION TEMPLATES, the IDEMPOTENT INSTALL SCRIPTS, and the concrete CI/CD + DEPLOY design. It is the buildable Adapter that sits BEHIND the Runtime contracts — never inside the Runtime.
extends:
  - docs/architecture/neo/00-ARCHITECTURE-execution-layer.md (NEO-ARCH-00 — the consolidated master; §2.5/§7 the port, §5 heartbeat, §6 security)
  - docs/architecture/neo/01-execution-node-and-cicd.md (NEO-ARCH-01 — the node responsibility map + the CI/CD handshake + the software stack)
  - docs/architecture/neo/02-tailscale-and-security.md (NTS-DOS-v1 — the HuJSON ACL §D, the secrets bootstrap §F, Tailscale Serve)
  - docs/architecture/neo/03-heartbeat-and-monitoring.md (NEO-HBM-v1 — the seven heartbeat layers, the off-node dead-man, the recovery ladder)
  - docs/architecture/neo/06-neo-node1-operations-and-migration.md (NEO-OPS-06 — FileVault/authrestart resolution §3, System-keychain secrets, the cold-boot M-gate)
governs:
  - docs/architecture/PRINCIPLE-repository-and-dependency-rule.md (RATIFIED 2026-06-30 — Execution Infrastructure is an Adapter in the one repo; dependencies flow inward; Core imports no infra)
consumes_runtime_seam:
  - templates/governance-engine/po-autoloop.ts (the current narrow `SprintExecutor`/`runSprint` hook — FORMALIZED here into the real `ExecutionProviderPort`)
  - templates/tools/platform-health.mjs (buildReport · computeVerdict · classifyFailure — the canonical `/v1/health/platform` shape the Health-Emission Contract standardizes on)
load_bearing_deliverable: §2 (the two contracts: `ExecutionProviderPort` + the Health-Emission Contract — Core-owned, Adapter-implemented) + §5/§6 (the parameterized templates + idempotent install scripts a Founder Installation Guide invokes). Together they make Neo installable from a clean machine without the Runtime ever learning the word "Neo".
companion: docs/architecture/neo/templates-and-scripts-inventory.md (the at-a-glance build manifest of every template + script designed here)
---

# Execution Infrastructure — Complete (NEO-EXEC-07)

> **One-paragraph thesis.** Docs 00–06 decided the *shape* (Neo = Execution Node 1), the *network* (Tailscale),
> the *security model*, the *heartbeat*, the *DR ladder*, and the *operations/migration*. What remained un-designed
> was the **seam and the install**: the exact contracts the infrastructure consumes, and the exact files + scripts
> that turn a clean Neo into a registered, working Execution Node 1. This document delivers both, as a **Delivery OS
> *subsystem* — an Adapter that consumes Runtime contracts, NOT part of the Runtime.** It formalizes the narrow
> `SprintExecutor`/`runSprint` hook into the real platform-owned **`ExecutionProviderPort`**, defines the **Health-
> Emission Contract** (the Runtime *emits* liveness/health; the infra Monitoring *consumes* it), then specifies the
> ordered idempotent **bootstrap**, the launchd **supervision** plists, the parameterized **configuration templates**
> (`{{placeholders}}`, no secrets), the idempotent **install scripts**, and the concrete **CI/CD + deploy** wiring.
> The hard rule throughout: **the Runtime never imports Neo, Docker, or Tailscale.** It depends on two interfaces;
> this folder implements them. Replace Neo with Linux later and not one Runtime file changes (NEO-OPS-06 §5).
> **It installs nothing** — designs, templates, and script designs only.

---

## 0. What this document adds over 00–06 (and what it deliberately does not re-do)

| Already designed (00–06) | This doc adds (07) |
|---|---|
| Node responsibility map, CI/CD handshake (01) | The **real `ExecutionProviderPort`** that supersedes the narrow `SprintExecutor` hook (§2.1) |
| Heartbeat layers + off-node dead-man (03) | The **Health-Emission Contract** that formalizes emit-side vs consume-side (§2.2) |
| Tailscale ACL, secrets bootstrap (02) | The **ordered, idempotent bootstrap sequence** that ties software→tailnet→docker→runner→secrets→daemon→watchdog→health into one re-runnable flow (§3) |
| launchd vs systemd verdict (01 §2.4) | The **actual launchd plist templates** (worker · runner · supervisor · colima), FileVault/App-Nap-aware (§4, §5) |
| HuJSON ACL starter (02 §D) | The **full parameterized template inventory** with `{{placeholders}}` (§5) |
| The `runs-on` rollback lever (01 §B.4) | The **concrete workflow diffs + the GitHub-hosted kill-switch + the token-attributed deploy job** (§7) |
| "the founder is the SRE" honesty (01, 03) | The **automated-vs-manual split** that feeds the Automation workstream (§8) |

It does **not** re-decide the host (ADR HOST-1, settled), re-design the watchdog (NEO-HBM-v1 owns it), or re-argue
the security verdict (NTS-DOS-v1 §G owns it). It **consumes** those decisions and makes them installable.

---

## 1. Position in the architecture — the Adapter, not the Runtime (where this code lives)

Per the ratified Repository & Dependency Principle, Delivery OS is **one repository** with **two boundaries**:
platform⇄consumer (a *repo* boundary) and subsystem⇄subsystem (a *dependency* boundary). Execution Infrastructure
is a **subsystem in the one repo**, in the **outer Adapter ring**: it consumes the Runtime **only through published
contracts** and is **never depended-upon by Core**.

```
  ┌──────────────────────────── Delivery OS (one repo) ────────────────────────────┐
  │                                                                                  │
  │   CORE (the Runtime) ── templates/governance-engine, templates/workflow-engine   │
  │     • PO auto-loop · reconciler · goal-supervisor · sprint-engine · agent-runner │
  │     • knows NOTHING of Neo / Docker / Tailscale / launchd / GitHub-runner        │
  │                    ▲  imports inward only                                         │
  │                    │                                                              │
  │   CONTRACTS / PORTS ── §2 below (Core-owned, the ONLY legal cross-layer surface) │
  │     • ExecutionProviderPort (§2.1)        • Health-Emission Contract (§2.2)       │
  │                    ▲  adapter consumes the contract, never Core internals         │
  │                    │                                                              │
  │   ADAPTERS (outer) ── infrastructure/execution-node/  ◀── THIS DOCUMENT           │
  │     • the Neo ExecutionProviderPort adapter (implements §2.1)                     │
  │     • the health bridge (consumes §2.2 → Healthchecks push / Windows pull / page) │
  │     • bootstrap + install scripts + launchd plists + tailscale ACL + colima       │
  │     • CI/CD workflow wiring + the deploy executor                                 │
  └──────────────────────────────────────────────────────────────────────────────────┘
                 Dependencies flow strictly inward: adapter → contract → core. Never outward.
```

### 1.1 Recommended folder (NOT under `templates/`)

`templates/` is the **vendorable Runtime** (a different kind of artifact — it is *consumed* by rumah-admin / PLOS).
The Neo infrastructure is **not vendored into a consumer**; it is the platform's own deployment substrate.
Therefore it gets its **own top-level subsystem folder**:

```
infrastructure/execution-node/                 ← NEW top-level Adapter subsystem (this doc)
  README.md                                    ← what this subsystem is + the inward-only rule + the Delete-Test pointer
  adapters/
    neo/                                        ← the Neo ExecutionProviderPort adapter (implements the §2.1 contract)
      neo-provider.ts                           ← nodeId/labels/trustDomain + canAccept + execute (the runner/worker/deploy surfaces)
      neo-runner-exec.ts                        ← kind:"verify"|"build"|"migrate" → dispatch onto the ephemeral GH runner job
      neo-deploy-exec.ts                        ← kind:"deploy" → vercel --prebuilt --prod (token-attributed) + supabase migrate
    windows/
      windows-provider.ts                       ← nodeId:"windows-node1", labels:["dev"], the build surface (author side)
  health-bridge/                                ← CONSUMES the §2.2 Health-Emission Contract (never imported by Core)
    healthchecks-pusher.ts                      ← reads /ready → POST hc-ping only when green (NEO-HBM §4.2 gate)
    windows-pull-watchdog.*                     ← the off-node pull backup (Windows Scheduled Task body)
    status-page/                                ← the off-Neo Vercel SSR surface (reads Supabase directly)
  bootstrap/
    *.sh                                        ← the idempotent install scripts (§6 — designs only here)
  supervision/
    *.plist.template                            ← the launchd plists (§4/§5 — templates only)
  tailscale/
    acl.hujson.template                         ← the policy-as-code starter (§5, from 02 §D)
  colima/
    colima-profile.yaml.template                ← the pinned VM profile (§5)
  watchdog/
    healthchecks.config.template                ← check name/cadence/grace (§5)
  runner/
    runner.config.template                      ← ephemeral GH runner registration params (§5)
  config/
    secret-registry.neo.template                ← the metadata-only secret manifest (§5 — NO values)
    env.neo.template                            ← the daemon env shape (§5 — NO values)
```

### 1.2 The enforcement that makes the boundary real (not aspirational)

Two checks (from the ratified Principle, §Enforcement) gate this subsystem — designed here, built with it:

1. **Dependency-direction gate** (`residency-guard.mjs`, generalized): a pre-push / CI gate asserting **no file
   under `templates/governance-engine` or `templates/workflow-engine` imports anything under
   `infrastructure/execution-node/`** or any infra SDK (`@actions/*`, `dockerode`, a Tailscale client, `launchd`
   XML). Fails loudly the instant Core reaches outward.
2. **The standing Delete Test:** a CI job that `rm -rf infrastructure/execution-node/` and asserts **Core still
   typechecks and the contracts still resolve.** Green = the boundary held by construction (the execution-layer twin
   of the consumer-independence proof). The Runtime must build with the entire Neo adapter deleted — that is the
   operational definition of "host-agnostic."

---

## 2. The two contracts the infrastructure consumes (platform-owned — designed here as the seam)

These are the **only** coupling between the Runtime and Neo. They live **Core-side** (the contract ring); the Neo
adapter lives **outer**. The Runtime is the **definer + caller** of `ExecutionProviderPort` and the **emitter** of
health; the infra is the **implementer** of the port and the **consumer** of health.

### 2.1 `ExecutionProviderPort` — formalized beyond the narrow `SprintExecutor` hook

**Where it lives:** Core — `templates/governance-engine/ports.ts` (alongside `GoalContractStorePort` /
`RuntimeStoresPort`), re-exported through `contracts/execution-provider-port-v1.d.mts` as a versioned, vendorable
surface (the same pattern as `contracts/admin-plos-seam-v1`). **It is defined by Core; adapters implement it.**

**The starting point (today's seam, honestly narrow).** `po-autoloop.ts` couples execution through a goal-lifecycle-
specific hook that **defaults to throwing** and **names no machine, no placement, no evidence return, no budget/
abort**:

```ts
// templates/governance-engine/po-autoloop.ts (CURRENT — the narrow seam)
export interface SprintExecutor {
  admitToExecuting?: (contract: GoalContractRow) => Promise<{ state; transitions; note }>;
  runSprint?: (input: RunSprintInput) => Promise<{ note: string }>;   // DEFERRED — throws by default
}
```

This is enough to *tick the governance* but cannot route a `verify` job to a node the author does not control,
cannot carry a `data_class` gate, and cannot return evidence on the durable bus. **It is a single implicit machine.**

**The formalization (the real port).** Lift the EIB §9 sketch into a built, platform-owned contract. The
`SprintExecutor.runSprint` hook becomes **one caller** that emits an `ExecutionRequest{kind:"supervise"|"build"}`
into the selector; the port does the placement-gated work and returns evidence on the bus:

```ts
// templates/governance-engine/ports.ts (NEW — Core-owned, infra-agnostic)
export type ExecutionKind = "build" | "verify" | "deploy" | "supervise" | "migrate" | "probe";
export type DataClass    = "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "PII" | "SECRET";
export type TrustDomain  = "trusted" | "contractual" | "external";

export interface ExecutionRequest {
  jobId: string;                       // idempotency key (write-ahead-intent; a dup is a no-op)
  goalId: string;                      // tenancy scope — a node may only touch its own goal_id (RS §54.3)
  kind: ExecutionKind;
  payload: Record<string, unknown>;    // OPAQUE, PII-free refs/codes — NEVER an infra handle (no host/socket/token)
  data_class: DataClass;               // gates eligibility FIRST (RS §54.1/§54.2)
  placement_req: {
    lane: "short" | "long";            // short = a check (runner); long = a soak/build/autonomy run (worker)
    isolation: "shared" | "dedicated";
    resource_class: "cpu-small" | "cpu-large" | "gpu" | "macos" | "any";
    capabilities?: string[];           // ["pg","docker","vercel-token"] — matched against node labels (opaque strings)
  };
  budget: { maxWallclockMs: number; maxCost?: number };   // the H1 cap travels WITH the job (bounds any re-run)
}

export type ExecutionOutcome =
  | { ok: true;  jobId: string; evidenceRef: string; metrics?: Record<string, number> }  // evidenceRef → the bus
  | { ok: false; jobId: string; error: string; retryable: boolean };

// The ONE app/runtime coupling for COMPUTE. Each node is an adapter implementing this. Core DEFINES it; the Neo
// adapter (infrastructure/execution-node/adapters/neo) IMPLEMENTS it. Note: NO field names a host, a socket, a
// container, or a tailnet — `labels`/`capabilities` are OPAQUE strings the selector matches, not infra types.
export interface ExecutionProviderPort {
  readonly nodeId: string;             // "windows-node1" | "neo-node2" | "linux-node3" — an ID, not an address
  readonly labels: string[];           // ["self-hosted","macos","pg","vercel-token"] — opaque capability strings
  readonly trustDomain: TrustDomain;   // RS §54.2 gate
  canAccept(req: ExecutionRequest): boolean;                              // PURE — labels + resource + data_class
  execute(req: ExecutionRequest, signal: AbortSignal): Promise<ExecutionOutcome>;  // does the work, honors budget
}

// The constraint-first, fail-closed selector (Core-owned; mirrors RS §54.2). NO node is invented; PII never
// downgrades to an external node.
export interface PlacementPort {
  select(req: ExecutionRequest, registry: ReadonlyArray<ExecutionProviderPort>):
    ExecutionProviderPort | { halt: "no-eligible-node"; reason: string };
}
```

**How the narrow hook is subsumed (back-compatible, zero Runtime-behavior change — the §44 acceptance test).**
The controller stops holding a `SprintExecutor` and instead holds a `PlacementPort` + the `ExecutionProviderPort`
registry. `runSprint` is re-expressed as: build an `ExecutionRequest{kind:"supervise", placement_req.lane:"long"}`,
`select()` a node, `port.execute()`, then complete the step from `ExecutionOutcome.evidenceRef` via the **existing**
`completeAwaitingStep` (idempotent, CAS-guarded, lease-released). The `DEFERRED_EXECUTOR` (default-throws) is
preserved as the **null registry** case — with no adapter registered, `select` returns `{halt:"no-eligible-node"}`
and the governance still ticks over injected observed-state, spawning no real work. **Nothing in the controller
learns what a node *is*.**

**What the Neo adapter implements (outer ring, this folder).** `neo-provider.ts` publishes
`nodeId:"neo-node2"`, `labels:["self-hosted","macos","neo","pg","vercel-token"]`, `trustDomain:"trusted"`, and an
`execute()` that **dispatches by `kind`**: `verify`/`build`/`migrate` → a job on the ephemeral GH runner against
the colima `postgres:16`; `deploy` → the token-attributed Vercel job; `supervise` → the long-lived worker drain.
**Author≠verifier is enforced at the selector by policy** (a `verify`-kind job is placed on a different node than
its `build`-kind job) — placement, not convention. None of this is visible to Core.

> **The discriminator made concrete:** the Runtime emits `ExecutionRequest{kind:"verify", placement_req:{lane:
> "short", resource_class:"macos", capabilities:["pg"]}}`. It never writes `"neo"`, never opens a Docker socket,
> never references a launchd label. The *string* `"macos"` matched against a *label* is the entire coupling.

### 2.2 The Health-Emission Contract — the Runtime EMITS, the infra Monitoring CONSUMES

The symmetric seam: where §2.1 is *compute in*, this is *health out*. The Runtime **emits** two things — a
liveness heartbeat and a structured health report — into surfaces the **infra Monitoring consumes** (the off-node
Healthchecks pusher, the Windows pull-watchdog, the status page). The Runtime knows nothing of Healthchecks.io,
Tailscale Serve, or the Windows Scheduled Task; it knows only the **contract data shapes** and the **`/ready` green
predicate**.

**Where it lives:** Core — `templates/governance-engine/ports.ts` for the emit-side ports;
`templates/tools/platform-health.mjs` already owns the **canonical report shape** (`buildReport` · `computeVerdict`
· `classifyFailure` · `httpStatusForVerdict`). This contract **standardizes on that existing shape** — it reuses,
it does not reinvent.

```ts
// templates/governance-engine/ports.ts (NEW — the EMIT side, Core-owned)

// (a) The liveness heartbeat the engine-tick stamps every ~5s (NEO-HBM Layer B). Emitted in the SAME txn as the
//     step it advanced, so liveness is proven by ADVANCING data, not a live process (RS §7.1 alive≠moving).
export interface HeartbeatRecord {
  nodeId: string;            // which node is ticking (opaque ID)
  tickSeq: number;           // strictly monotonic — a wedged-but-alive daemon stops advancing this
  lastTickAt: string;        // ISO-8601; staleness (> 60s) ⇒ HEARTBEAT_STALE
  consumerCursor?: string;   // the bus drain cursor — must advance, else STUCK_CONSUMER_CURSOR
  gsPostedAt?: string;       // last Goal-Supervisor ProgressSample (its in-window-ness feeds /ready)
}
export interface HeartbeatEmitterPort {
  emit(beat: HeartbeatRecord): Promise<void>;   // → upsert engine_heartbeat{nodeId} on the durable bus
}

// (b) The structured health report — the SAME canonical shape platform-health.mjs already produces. The Runtime
//     COMPUTES it from the durable bus (DB reachable · heartbeat fresh · cursor advancing · config valid · GS in
//     window); every failure is a NAMED classifyFailure() cause, never a silent omission.
export interface PlatformHealthReport {
  service: string;
  verdict: "ok" | "degraded" | "down";
  ok: boolean;                                  // === (verdict === "ok")
  subsystems: Array<{ name: string; status: "ok"|"degraded"|"down"|"unknown"; critical: boolean; cause?: string }>;
  generatedAt: string;
}
export interface PlatformHealthProvider {
  buildReport(): Promise<PlatformHealthReport>;     // the /ready body (503 when verdict==="down")
  liveness(): Promise<{ ok: boolean }>;             // the /health body — process up, NO DB touch (Supabase-independent)
}

// (c) The ONE predicate the watchdog gate keys on (NEO-HBM ADR-003). Core EXPORTS it so the emit and the consume
//     side agree by construction; the infra NEVER re-derives "is it healthy" — it asks this.
export function isReady(report: PlatformHealthReport): boolean {  // === verdict !== "down"
  return report.verdict !== "down";
}
```

**The two emission surfaces (Core renders; the worker daemon exposes; infra consumes):**

| Surface | Emitted by (Core) | Bound where | Consumed by (infra Adapter) |
|---|---|---|---|
| `engine_heartbeat` row | `HeartbeatEmitterPort.emit` each tick | the durable Supabase bus | the status page (reads directly); the Windows pull (cross-checks) |
| `GET /health` (liveness, no DB) | `PlatformHealthProvider.liveness` | **tailnet-only** (Tailscale Serve) | the Windows pull-watchdog (Supabase-independent signal — disambiguates "bus down" from "node down", NEO-HBM §5.4) |
| `GET /ready` (readiness, full report) | `PlatformHealthProvider.buildReport` | **tailnet-only** (Tailscale Serve) | the **Healthchecks pusher** (`isReady` ⇒ POST `hc-ping`; else stop); the Windows pull; the status page |

**The consume side is 100% adapter (this folder), 100% invisible to Core:**

- `health-bridge/healthchecks-pusher.ts` — every 60s: `GET /ready` → `if isReady(report) POST {{HC_PING_URL}}`
  else **withhold** the ping. The withholding is what makes the dead-man catch *degraded-but-running*, not just
  *powered-off* (NEO-HBM ADR-003). **Core never names Healthchecks** — the pusher is an outer-ring daemon.
- `health-bridge/windows-pull-watchdog.*` — the off-node pull body (Windows Scheduled Task) hitting **both**
  `/health` (no DB) **and** a direct Supabase probe, so it can report "bus down, node fine."
- `health-bridge/status-page/` — the off-Neo Vercel SSR surface reading the bus + the `PlatformHealthReport`.

> **Why the contract, not just "an endpoint":** by making `HeartbeatRecord` / `PlatformHealthReport` / `isReady`
> **Core-owned types**, a Linux node's health bridge consumes the *identical* contract — the migration (NEO-OPS-06
> §5) re-points the transport (launchd→systemd, System-keychain→systemd-creds) without touching the emit side. The
> Runtime emits the same report on any host; only the *consumer wiring* is host-specific.

### 2.3 Keeping the Runtime unaware of Neo / Docker / Tailscale (the invariant, enforced)

| Temptation (would couple Core to infra) | The contract discipline that forbids it |
|---|---|
| Pass a Docker socket / container handle in `payload` | `payload` is **opaque, PII-free refs** — the adapter resolves the socket internally; Core never sees it |
| Let Core read `tailscale status` to find a node | Core reads the **registry** (`nodeId`/`labels` strings); reachability is the adapter's MagicDNS concern |
| Have the Runtime POST to Healthchecks directly | Core **emits the report**; the **pusher (adapter)** transports it. Core has no `hc-ping` string anywhere |
| Import `@actions/*` or a launchd lib in the engine | the **dependency-direction gate** fails the push (§1.2) |
| A `verify` job hard-codes `runs-on: neo` | the **selector** places by `data_class`/`labels`; the workflow's `runs-on` is an adapter/CI detail (§7) |

The **Delete Test** (§1.2) is the proof: delete `infrastructure/execution-node/` and Core still typechecks because
it imports only `ports.ts` + `platform-health.mjs`, both Core-resident.

---

## 3. Bootstrap — clean Neo → registered, working Execution Node 1

The end-to-end sequence that a Founder Installation Guide invokes. **Ordered** (each step depends on the prior),
**idempotent** (re-running is a safe no-op when already satisfied), and **automated where it can be / manual where
it must be** (§8). Each step is a script (§6) with a **precondition probe → action → verification** triad; a
re-run that finds the postcondition already true does nothing.

### 3.1 The ordered bootstrap (the canonical sequence)

```
  M-pre  PREREQUISITES (founder, mostly one-time manual)
   0. Create non-admin macOS user `ci-runner`; enable FileVault; set pmset (sleep 0, disablesleep 1);
      clamshell-on-power. [MANUAL — §8: founder console acts; a script VERIFIES + prints the residual.]

  ── from here, `infrastructure/execution-node/bootstrap/*.sh`, runnable over Tailscale SSH ──

   1. install-prereqs.sh        SOFTWARE   Homebrew · node@{{NODE_VERSION}} · colima · docker CLI · gitleaks ·
                                           vercel@{{VERCEL_CLI_VERSION}} · tailscale · jq · gh.   [AUTOMATED, idempotent]
   2. join-tailnet.sh           NETWORK    `tailscale up --advertise-tags=tag:exec-node,tag:ci-runner --hostname=neo`
                                           → founder DEVICE-APPROVES in the console.   [SEMI — approval is manual]
   3. (colima up)               RUNTIME    `colima start` per the profile; warm `postgres:16`; assert docker socket.
                                           [AUTOMATED — folded into install-daemons or run standalone]
   4. register-runner.sh        CI         download actions/runner; `config.sh --ephemeral --labels self-hosted,neo`
                                           with a founder-supplied short-lived REGISTRATION TOKEN.   [SEMI — token is manual]
   5. bootstrap-secrets.sh      SECRETS    founder seeds the System keychain / file-ACL store from the AUTHORITATIVE
                                           platform stores, over Tailscale SSH.   [MANUAL — the one-time founder act, §F]
   6. install-daemons.sh        SUPERVISE  load the launchd plists: worker daemon · runner agent · on-node
                                           supervisor · confirm `com.colima` autostart.   [AUTOMATED, idempotent]
   7. (watchdog wiring)         WATCHDOG   create the Healthchecks check → write {{HC_PING_URL}} into the daemon
                                           config; install the Windows pull Scheduled Task.   [SEMI — check create is manual]
   8. verify-health.sh          GATE       `config-doctor --include-local --enforce` → /ready green → cold-boot
                                           recovery test (NEO-OPS-06 §3.5) → runner parity-prove.   [AUTOMATED checks + ★ founder gate]
```

### 3.2 The idempotency contract (every step)

Each script is **declarative-by-probe**: it asks "is the postcondition already true?" before acting.

| Step | Idempotency probe (skip if true) | Action if false | Verification (must pass to exit 0) |
|---|---|---|---|
| 1 install-prereqs | `brew list <pkg>` present at the pinned version | `brew install`/pin | every pinned tool resolves at its pin |
| 2 join-tailnet | `tailscale status` shows `neo` online with the tags | `tailscale up …` (prints the approval URL) | MagicDNS `neo` resolves; tags present |
| 3 colima | `docker info` returns + `postgres:16` reachable on the warm port | `colima start` + `docker run postgres:16` | `docker info` OK; pg accepts a connection |
| 4 register-runner | `./svc.sh status` shows the runner registered | `config.sh --ephemeral …` | the runner appears `online` in the GH runners API |
| 5 bootstrap-secrets | `config-doctor --include-local` reports all keys PRESENT | prompt the founder to seed each missing key | `config-doctor --enforce` exits 0 (fail-closed) |
| 6 install-daemons | `launchctl print system/{{label}}` loaded for each | `launchctl bootstrap` each plist | all three labels loaded; KeepAlive active |
| 7 watchdog | the daemon config has a non-empty `{{HC_PING_URL}}`; the Windows task exists | write the URL; register the task | a test ping reaches Healthchecks; the task runs |
| 8 verify-health | — (always runs; it is the gate) | — | `/ready` 200/green · cold-boot test passes · parity verdict byte-identical |

**The bootstrap is re-runnable end-to-end** — `bootstrap/install-all.sh` calls 1→8 in order; a fully-installed Neo
re-run is a sequence of green no-ops that re-verifies the node. This is what makes "did the macOS update break it?"
a one-command answer.

### 3.3 The bootstrap state machine (what a re-run converges to)

A node is **READY** iff: tailnet-joined+tagged · docker+pg up · runner online · secrets complete (config-doctor
green) · all three daemons loaded · watchdog pinging · `/ready` green. Any step regressing (a macOS update breaks
colima; a token rotates and the daemon can't read it) drops the node to **DEGRADED**, which the off-node watchdog
surfaces (NEO-HBM Layer F) and a `verify-health.sh` re-run diagnoses to the exact failing step via `classifyFailure`.

---

## 4. Service supervision — the launchd design (FileVault-aware, App-Nap-excluded)

Three independent, **deliberately not-nested** process trees (NEO-ARCH-01 §A.3), each a launchd job. `LaunchDaemon`
(not `LaunchAgent`) for the worker + colima so they run **at boot before any GUI login** (correct for a headless,
logged-out Mac) — subject to the FileVault unlock from NEO-OPS-06 §3 (the volume must be unlocked first; planned
reboots use `fdesetup authrestart`; the rare unplanned reboot is a paged manual-login event).

| Job | launchd label | Type | Key directives | FileVault/boot behavior |
|---|---|---|---|---|
| Worker daemon | `com.deliveryos.worker` | `LaunchDaemon` | `RunAtLoad` · `KeepAlive=true` · `ThrottleInterval=10` · `ProcessType=Background`+App-Nap exclusion · `caffeinate -dimsu` wrap · log redirect+rotate | starts at the loginwindow stage **after** the volume unlocks; reads secrets from the **System keychain / file-ACL**, never a login keychain |
| Runner agent | `actions.runner.{{OWNER}}-{{REPO}}.{{RUNNER_NAME}}` | `LaunchDaemon` (via `svc.sh install`) | `--ephemeral` (one job → exit → re-register) · `KeepAlive` re-registers a fresh runner | same unlock gate; long-polls outbound to GitHub (no inbound) |
| On-node supervisor | `com.deliveryos.supervisor` | `LaunchDaemon` | `RunAtLoad` · `KeepAlive` · runs the **health bridge** (Healthchecks pusher + the `/health`+`/ready` server bound tailnet-only) | the thing that PUSHES the dead-man ping; gated on `/ready` |
| colima | `com.colima` (Homebrew service) | `LaunchAgent`/service | autostart so the Docker socket is up before a CI job needs `postgres:16` | re-checked by the macOS-update runbook before re-enabling required checks |

**The four supervision properties, made explicit in the plists (§5 templates):**
1. **KeepAlive** — launchd relaunches on crash; a crash-loop is throttled (`ThrottleInterval`), which lets the
   engine-tick go stale and **escalates to the off-node dead-man** rather than hot-looping invisibly.
2. **FileVault-aware boot** — the daemon does **not** read a login keychain (NEO-OPS-06 §3, Decision A); secrets
   come from `/Library/Keychains/System.keychain` or a `chmod 600` root/`ci-runner` file. `config-doctor --enforce`
   in the `ProgramArguments` preamble fail-closes a half-bootstrapped boot.
3. **App-Nap exclusion** — `ProcessType=Background` plus the worker process disabling App-Nap
   (`NSAppSleepDisabled`/`LSAppNapIsDisabled` for the domain) so macOS does not throttle the background drain.
4. **colima autostart** — the Homebrew launchd service brings the VM up at boot; the worker's start does not race
   the socket because `verify-health` (and a `WaitForDocker` preamble) gate on `docker info`.

---

## 5. Configuration templates (parameterized, `{{placeholders}}` — NOT secrets, NOT installed)

Every template ships with `{{placeholders}}` resolved at install by the Founder Installation Guide / the
config platform. **No template contains a secret value** (the gitleaks floor + the registry metadata-only invariant
hold). Below: the design + the key content; the full file list is in the companion inventory.

### 5.1 launchd worker daemon — `supervision/com.deliveryos.worker.plist.template`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0"><dict>
  <key>Label</key>            <string>com.deliveryos.worker</string>
  <key>UserName</key>         <string>{{RUNNER_USER}}</string>          <!-- ci-runner (non-admin) -->
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/caffeinate</string><string>-dimsu</string>        <!-- no sleep mid-drain -->
    <string>{{NODE_BIN}}</string>                                        <!-- /opt/homebrew/bin/node -->
    <string>{{WORKER_ENTRY}}</string>                                    <!-- the agent-runner drain loop -->
  </array>
  <key>RunAtLoad</key>        <true/>
  <key>KeepAlive</key>        <true/>
  <key>ThrottleInterval</key> <integer>10</integer>
  <key>ProcessType</key>      <string>Background</string>                <!-- App-Nap exclusion class -->
  <key>EnvironmentVariables</key>
  <dict>
    <key>DOS_NODE_ID</key>            <string>{{NODE_ID}}</string>        <!-- neo-node2 -->
    <key>DOS_SECRET_SOURCE</key>      <string>system-keychain</string>   <!-- NEVER login-keychain -->
    <key>DOS_TICK_INTERVAL_MS</key>   <string>{{TICK_INTERVAL_MS}}</string><!-- 15000–30000 on battery, §2.7 -->
    <key>DOS_HEALTH_BIND</key>        <string>{{TAILNET_BIND_ADDR}}</string><!-- tailnet iface, NEVER 0.0.0.0 -->
  </dict>
  <key>StandardOutPath</key>  <string>{{LOG_DIR}}/worker.out.log</string>
  <key>StandardErrorPath</key><string>{{LOG_DIR}}/worker.err.log</string>
</dict></plist>
```

> Boot fail-closed: the real `WORKER_ENTRY` runs `config-doctor --include-local --enforce` first and exits non-zero
> (letting KeepAlive throttle → dead-man fires) rather than draining with an incomplete secret set.

### 5.2 launchd supervisor (health bridge) — `supervision/com.deliveryos.supervisor.plist.template`
Same shape; `ProgramArguments` runs `health-bridge/healthchecks-pusher` + serves `/health`+`/ready` on
`{{TAILNET_BIND_ADDR}}:{{HEALTH_PORT}}` (default 8787, the ACL's health port). Env carries `{{HC_PING_URL}}`
(written at step 7 — it is a capability URL, treated as a low-value secret in the System keychain, not the tree).

### 5.3 Tailscale ACL — `tailscale/acl.hujson.template` (from 02 §D, parameterized)
The full default-deny HuJSON with the `tests[]` block, `{{FOUNDER_EMAIL}}` / `{{HEALTH_PORT}}` /
`{{DISPATCH_PORT}}` parameterized. Ships **with** its `tests[]` (an ACL without tests is an assertion; with tests
it is a gate). `funnel:deny` pinned on `tag:ci-runner`.

### 5.4 colima profile — `colima/colima-profile.yaml.template`
```yaml
cpu: {{COLIMA_CPU}}            # 4
memory: {{COLIMA_MEMORY_GB}}   # 8
disk: {{COLIMA_DISK_GB}}       # 60 (capped — disk-prune weekly; a known self-hosted rot vector)
runtime: docker
autoStart: true                # com.colima brings the socket up before a CI job needs postgres:16
```

### 5.5 Healthchecks / watchdog — `watchdog/healthchecks.config.template`
```jsonc
{ "check_name": "{{NODE_ID}}-deadman",
  "period_seconds": {{HC_PERIOD_SECONDS}},   // 60 — the gated push cadence
  "grace_seconds":  {{HC_GRACE_SECONDS}},    // 300–600
  "ping_url_secret_ref": "HC_PING_URL",      // METADATA only — the value lives in the System keychain
  "weekly_all_green_digest": true }          // the dead-man for the dead-man (NEO-HBM §7)
```

### 5.6 GH runner — `runner/runner.config.template`
```jsonc
{ "url": "https://github.com/{{OWNER}}/{{REPO}}",
  "labels": ["self-hosted", "{{RUNNER_LABEL}}"],   // neo
  "ephemeral": true,                                 // clean per job — the highest-leverage isolation control
  "runner_user": "{{RUNNER_USER}}",                  // ci-runner (non-admin)
  "registration_token_ref": "GH_RUNNER_REG_TOKEN" } // METADATA — the short-lived token is founder-supplied at install
```

### 5.7 Secret registry + env — `config/secret-registry.neo.template` · `config/env.neo.template`
**Metadata only — never a value.** The registry lists each required key, its authoritative store, its consumer,
and its scope; the env template lists the variable *shape* the daemon reads from the System keychain. Both are the
input to the fail-closed `config-doctor`/`i-config --enforce` gate.

```jsonc
// secret-registry.neo.template — the i-config manifest (NO values; gitleaks-safe)
{ "node": "{{NODE_ID}}",
  "secrets": [
    { "key": "DATABASE_URL",      "store": "system-keychain", "consumer": "worker-daemon", "scope": "pooler-6543", "plane": "local-trusted" },
    { "key": "VERCEL_TOKEN",      "store": "github-actions || system-keychain", "consumer": "deploy-exec", "scope": "deploy-only:{{VERCEL_ORG_ID}}" },
    { "key": "CRON_SECRET",       "store": "system-keychain", "consumer": "worker-daemon" },
    { "key": "HC_PING_URL",       "store": "system-keychain", "consumer": "supervisor" },
    { "key": "BREAK_GLASS_PUBKEY","store": "system-keychain", "consumer": "migrate-exec", "note": "Ed25519 PUBLIC key only — private stays on the founder device (ADR-SEC-3)" }
  ] }
```

---

## 6. Installation scripts (designed, idempotent — NOT run)

Each is a `bash` script under `bootstrap/`, runnable individually or via `install-all.sh`. Specified by
**responsibility · idempotency · manual-vs-automated split**. They **template-render** (§5) and **verify**; they
move secrets only by prompting the founder (never embedding).

| Script | Responsibility | Idempotency | Manual ↔ Automated |
|---|---|---|---|
| `install-prereqs.sh` | install + pin the software stack (brew, node, colima, docker CLI, gitleaks, vercel CLI, tailscale, jq, gh) | skips any tool already at its pin; re-pins drift | **AUTOMATED** — fully scriptable |
| `join-tailnet.sh` | `tailscale up` with the exec-node tags + MagicDNS hostname; render `acl.hujson` (founder applies it in the admin console) | no-op if already joined+tagged | **SEMI** — device-approval + ACL-apply are founder console acts |
| `register-runner.sh` | download actions/runner, `config.sh --ephemeral --labels self-hosted,neo` under `ci-runner` | no-op if the runner is already registered+online | **SEMI** — the short-lived registration token is founder-supplied |
| `bootstrap-secrets.sh` | drive the §F flow: for each registry key not PRESENT, prompt the founder to paste the value into the System keychain (`security add-generic-password … -U`) | re-run only prompts for the *missing* keys | **MANUAL** — the one-time founder seeding; values typed into the SSH session, never a file |
| `install-daemons.sh` | render the launchd plists (§5) with the resolved placeholders; `launchctl bootstrap` each; confirm `com.colima` | no-op if each label is already loaded; re-render on drift | **AUTOMATED** |
| `verify-health.sh` | the go-live gate: `config-doctor --include-local --enforce` → `/ready` green → cold-boot recovery test (NEO-OPS-06 §3.5) → runner parity-prove (byte-identical verdict) | always runs; pure read/verify, mutates nothing | **AUTOMATED checks + ★ FOUNDER GATE** (M3/M5 are founder checkpoints) |

**`install-all.sh`** orchestrates 1→6 above in order, pausing at the two manual gates (secrets seeding; the
founder-approval points) with a clear printed instruction, then runs `verify-health.sh`. **Every script is a no-op
on an already-satisfied node** — the bootstrap is the same command the founder runs to *diagnose* a degraded node.

> **Honest manual-vs-automated ledger (feeds §8 / the Automation workstream):** fully automated = prereqs, daemons,
> health-verify. Irreducibly manual (by security design) = the founder's macOS-user/FileVault setup, the Tailscale
> device approval, the GH registration token, the one-time secret seeding. These are manual **because** automating
> them would require a standing god-credential on disk — the exact thing the security model forbids. The Automation
> workstream's target is not "remove the manual steps" but "make each a single, guided, re-checkable prompt."

---

## 7. CI/CD + deployment (concrete)

### 7.1 The `runs-on` change (the one-line move + the kill-switch)
Per workflow, the binding required checks move from `ubuntu-latest` to the self-hosted label. Adopt a **repo
variable** so the entire fleet flips hosted↔Neo from the GitHub UI with **no commit** (the rollback lever that
works even when Neo is dead):

```yaml
# .github/workflows/ci.yml (the change)
jobs:
  build-and-migrate:
    runs-on: ${{ vars.CI_RUNNER == '' && 'ubuntu-latest' || fromJSON(vars.CI_RUNNER) }}
    # vars.CI_RUNNER = ["self-hosted","neo"] flips CI to Neo; clearing it (or setting "ubuntu-latest")
    # is the INSTANT GitHub-hosted fallback — the kill-switch, flippable from the UI, no diff, no Neo dependency.
```

Flip **non-binding** clones first (parity-prove a byte-identical verdict, NEO-ARCH-01 §B.3.2 M1), then **binding**
checks **one at a time** (★ M3 founder gate).

### 7.2 The build/verify pipeline on Neo (ephemeral runner)
Each PR check runs as a job on the **ephemeral, non-admin** runner against the colima `postgres:16`: typecheck →
fresh migrate → idempotent re-migrate → up/down/up rollback proof → test → the skills/agents/seam/lifecycle/quality
gates → the **independent VERIFY + `machine_probe`**. The `machine_probe` log records `node: neo-node2` to **prove
physical author≠verifier** (the build runs on Windows; verify runs on a node Windows does not control). Evidence
returns on the durable bus as `ExecutionOutcome.evidenceRef` (it survives the ephemeral runner's de-registration),
**not** as a CI artifact. Caches via `actions/cache@v4` (GitHub-hosted backend, still free) claw back the speed
ephemerality costs.

### 7.3 The deploy job (token-attributed Vercel + pooler Supabase) — the binding post-deploy gate
On merge-to-main, the Neo runner holds `VERCEL_TOKEN` + `{{VERCEL_ORG_ID}}` + `{{VERCEL_PROJECT_ID}}`:

```yaml
# deploy.yml (on Neo) — identity travels with the TOKEN, not the host (resolves the Hobby author rule, no manual click)
- run: config-doctor --env production                       # the pre-build fail-closed gate (unchanged)
- run: supabase migration up --db-url "$SESSION_POOLER_5432"  # forward-only, expand/contract, BEFORE code; IPv4 ⇒ pooler, never the IPv6 direct host
- run: vercel pull --environment=production --token="$VERCEL_TOKEN"
- run: vercel build --prod --token="$VERCEL_TOKEN"
- run: vercel deploy --prebuilt --prod --token="$VERCEL_TOKEN"   # attributed to the founder via the token — no actor check
- run: node post-deploy-verify.mjs                          # BINDING (NO continue-on-error — fix PLOS's soft spot); config→health→synthetic fold
```

- **Class-C stays a founder boundary:** the runner *executes* an authorized deploy; merge-to-main / the deploy
  authorization remain founder acts (the `deployment-operator` `.deploy-lane.json` scope still binds).
- **Co-equal-token control (NEO-ARCH-00 §6.5, go-live precondition):** because `VERCEL_TOKEN` can deploy attacker
  code to prod as the founder, it is treated **co-equally with break-glass** — deploy author≠verifier / a deploy-
  approval gate / a second-factor before a standing self-serve prod deploy. Carried as a hard gate, not "later."

### 7.4 The GitHub-hosted rollback lever (the safety net)
Three tiers, fastest first: (a) **flip `vars.CI_RUNNER`** in the GitHub UI → the whole CI floor falls back to
`ubuntu-latest` in seconds, no commit, **no Neo needed** (this is why the kill-switch is a repo variable, not a
file on Neo); (b) **per-check** `runs-on` revert to isolate one flaky check; (c) **`rollback-helper.mjs`** prints
the last-known-good `vercel promote` command when the binding post-deploy verify ALARMs. The lever lives on
**GitHub** precisely so a dead Neo cannot disable its own escape hatch.

---

## 8. Automated vs manual — the honest split (feeds the Automation workstream)

| Phase | Automated (scriptable, idempotent) | Manual (by design — security or platform-gated) |
|---|---|---|
| Prereqs | brew/node/colima/docker/gitleaks/vercel/tailscale install + pin | the `ci-runner` user, FileVault enable, `pmset`, clamshell (founder console) |
| Network | `tailscale up` + ACL render | **device approval**, **ACL apply** in the admin console |
| CI | runner download + `config.sh --ephemeral` | the **short-lived registration token** (founder-supplied) |
| Secrets | `config-doctor --enforce` verification | the **one-time secret seeding** into the System keychain |
| Daemons | plist render + `launchctl bootstrap` + colima autostart | — |
| Watchdog | the Windows pull task body + the daemon ping wiring | the **Healthchecks check creation** (founder account act) |
| Go-live | health-verify + cold-boot test + parity-prove | the **M3/M5 founder ★ gates** (touch the merge/release floor) |
| Reboot recovery | **planned** reboot via `fdesetup authrestart` (unattended) | the **rare unplanned** reboot = a paged manual-login (NEO-OPS-06 §3.4) |

**The standing manual residual is small and bounded:** four one-time founder acts (user/FileVault, device approval,
registration token, secret seeding) + two founder ★ gates + the rare paged login. Everything else is a re-runnable
script. **The honest framing (NEO-ARCH-01 §Risks, NEO-HBM §9.2): the founder is the SRE.** The Automation
workstream cannot delete the manual steps without violating the security model; its job is to make each a single
guided, re-checkable prompt and to keep the *re-run* path frictionless.

---

## 9. ADRs (the load-bearing choices in this layer)

### ADR-EXEC-1 — Execution Infrastructure is a top-level Adapter subsystem (`infrastructure/execution-node/`), NOT under `templates/`
- **Context.** The ratified Principle puts platform subsystems in one repo with inward-only dependencies;
  `templates/` is the *vendorable Runtime* consumed by rumah-admin/PLOS — a different artifact class.
- **Decision.** Place the Neo infra in its own top-level `infrastructure/execution-node/` folder; the contracts it
  consumes (`ExecutionProviderPort`, the Health-Emission Contract) live **Core-side** (`ports.ts` /
  `platform-health.mjs`). Enforce with the dependency-direction gate + the standing Delete Test.
- **Consequences.** (+) the boundary is guaranteed by construction (Core builds with the adapter deleted); a Linux
  re-seat is registry+drain, not redesign. (−) one more top-level folder + two new CI gates to maintain.

### ADR-EXEC-2 — Formalize the narrow `SprintExecutor` hook into the real `ExecutionProviderPort`
- **Context.** Today's `runSprint` hook is goal-lifecycle-coupled, single-implicit-machine, no placement/data_class/
  evidence/budget. It cannot enforce author≠verifier at placement or gate `data_class`.
- **Decision.** Build the EIB §9 port as a Core-owned contract; re-express `runSprint`/`admitToExecuting` as callers
  that emit `ExecutionRequest`s into a `PlacementPort` over the registry; keep `DEFERRED_EXECUTOR` as the
  null-registry (no-op) case. Zero Runtime-behavior change (the §44 acceptance test).
- **Consequences.** (+) the Runtime becomes genuinely host-agnostic; author≠verifier is enforced by the selector.
  (−) a focused refactor of the controller's executor seam (back-compatible, behind the existing hook shape).

### ADR-EXEC-3 — The Health-Emission Contract: the Runtime emits the canonical shape; the infra transports it
- **Context.** A naive design would have the engine POST to Healthchecks directly — coupling Core to a SaaS.
- **Decision.** Core **emits** `HeartbeatRecord` (to the bus) + `PlatformHealthReport` (the existing
  `platform-health.mjs` shape) and exports the `isReady` predicate; the **adapter** transports it (the
  `/ready`-gated Healthchecks pusher, the Windows pull, the status page). Core names no monitor.
- **Consequences.** (+) the dead-man's `/ready` gate (NEO-HBM ADR-003) is shared by construction; a Linux node
  reuses the identical emit contract. (−) one indirection (emit → bridge → SaaS) vs a direct POST — accepted, it is
  the coupling-avoidance.

---

## 10. Scope honesty — what this document does and does not do

- It **installs nothing** — no node joined, no daemon loaded, no runner registered, no secret moved, no ACL
  applied, no script executed. Designs, parameterized templates, and script *designs* only.
- It **completes** the Neo streams (00–06) on the seam + install axes; it does **not** re-decide the host (ADR
  HOST-1), the watchdog (NEO-HBM), or the security verdict (NTS-DOS-v1 §G).
- It is **host-agnostic at the Runtime boundary by construction**: the two contracts are Core-owned and infra-free;
  the Delete Test proves Core builds without this folder; the Linux migration (NEO-OPS-06 §5) re-points transport,
  not contract.
- It is **honest about automation**: §8 names every irreducibly-manual step and *why* it cannot be automated
  without breaking the security model — the input the Automation workstream needs.
- Where this file disagrees with a canonical source under `core/` or a ratified Principle, the **canonical source
  wins — fix this file.**

*End of NEO-EXEC-07 — the Execution Infrastructure Adapter, complete on the seam + install axes. Design + templates
+ script-designs only; installs nothing. An independent §11 panel ratifies (author≠verifier) and a founder gate
authorizes before any of this is built; the off-node watchdog (NEO-HBM M0) remains the hard precondition that
precedes every meter-bearing step.*
