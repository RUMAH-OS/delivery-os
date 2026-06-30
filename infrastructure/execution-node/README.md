# `infrastructure/execution-node/` — the Execution-Infra Adapter subsystem (Neo = Execution Node 1)

> **What this is.** A NEW top-level Delivery OS **Adapter** subsystem — the platform's own deployment substrate.
> It is **not** vendored into a consumer (that is what `templates/` is); it is the outer ring that **implements
> the Core-owned contracts** so the Runtime can run real compute on a real node without ever learning the word
> "Neo". **Neo (an Apple MacBook) is Execution Node 1.** Replace Neo with a Linux box later and not one Core
> file changes — that is the operational definition of *host-agnostic*, proved here by construction.

## The one rule: dependencies flow inward (`adapter → contract → core`, never outward)

Per `architecture.config.json`, this folder is the **`adapters`** layer. It may import **contracts** and sibling
**adapters** — it may **never** import a Core internal, and **Core never imports it**.

```
  CORE (templates/governance-engine)  ── knows NOTHING of Neo / child_process / colima / launchd
        ▲  imports inward only
  CONTRACTS (Core-owned, the ONLY legal cross-layer surface)
        • execution-provider-port.ts   — ExecutionProviderPort / ExecutionRequest / ExecutionOutcome / PlacementPort
        • health-contract.ts           — HeartbeatEmitterPort / PlatformHealthProvider / isReady
        ▲  this adapter consumes the contract, never a Core internal
  ADAPTERS (this folder)  ── infrastructure/execution-node/
        • adapters/neo/neo-execution-provider.ts  — IMPLEMENTS ExecutionProviderPort (the host/process detail)
        • adapters/neo/neo-health.ts              — IMPLEMENTS HeartbeatEmitterPort + PlatformHealthProvider
        • worker-daemon.ts                        — the launchd-supervised drain loop (boundary-clean)
```

**The host/process vocabulary lives ONLY here.** The published capability strings (`"macos"`, `"arm64"`,
`"colima"`, `"self-hosted-runner"`) and the `child_process` subprocess are legal in this adapter and would be a
knowledge leak in Core. Core matches the *string* structurally; it never enumerates the vocabulary.

## What each file implements

| File | Implements (Core contract) | Notes |
|---|---|---|
| `adapters/neo/neo-execution-provider.ts` | `ExecutionProviderPort` | `nodeId` = the canonical `"neo-node2"` (sourced from `DOS_NODE_ID` at the daemon, else the default), opaque `labels`/`trustDomain`, pure `canAccept`, `execute` dispatches by `ExecutionKind` via an **injectable `Spawner`** (default = real `child_process`; stub in the self-test). Returns an `ExecutionOutcome` with a durable-bus `evidenceRef`. |
| `adapters/neo/neo-health.ts` | `HeartbeatEmitterPort` + `PlatformHealthProvider` | collects node liveness / disk / runner status → a `PlatformHealthReport` (the canonical platform-health shape, worst-wins fold); emits `HeartbeatRecord`. The Core `isReady` predicate is **consumed, never re-derived**. Probes + sink are injectable. |
| `worker-daemon.ts` | (consumes both contracts) | the `com.deliveryos.worker` LaunchDaemon body: owns its clock, ticks the runtime, emits the heartbeat. Holds an **injected `RuntimeTick` seam** — it does **not** import `createGovernanceRuntime` (that would break the boundary). Injectable clock/scheduler ⇒ no infinite loop under test. |
| `index.ts` | — | the subsystem barrel. |

## The composition root (the `composition` layer — `bootstrap/*.mjs`)

Wiring Core's `createGovernanceRuntime` to the Neo provider + the worker daemon requires importing **both** Core
and this adapter. No file in a *gated* layer may do that (Core can't import the adapter; the adapter can't import
Core). The wiring therefore lives in the **composition root** — the Clean-Architecture `main`, the outermost
ring, declared as its own `composition` layer in `architecture.config.json` (mayImport: core + contracts +
adapters). The launchd entries the plists invoke are:

| Entry | Plist placeholder | Role |
|---|---|---|
| `bootstrap/worker-entry.mjs` | `{{WORKER_ENTRY}}` | the worker `main`: keychain secrets → `openPostgres` → `createGovernanceRuntime` → `WorkerDaemon`; config-doctor fail-closed boot |
| `bootstrap/runtime-tick.mjs` | `{{RUNTIME_TICK_ENTRY}}` | adapts the runtime drain into the daemon's injected `RuntimeTick` seam |
| `bootstrap/supervisor-entry.mjs` | `{{SUPERVISOR_ENTRY}}` | the health bridge: serves `/health`+`/ready` (tailnet-only) + the `/ready`-gated Healthchecks push |

Each is an **exact-file** entry in the `composition` layer, so only these three reclassify (longest-prefix wins);
the rest of `infrastructure/` stays `adapters`. They are removed with `infrastructure/` by the Delete Test, so
Core still builds without them. That the composition root is the *only* place allowed to touch both sides is the
architecture working as intended.

## The two gates that make the boundary real (not aspirational)

1. **`node scripts/arch-boundary-guard.mjs`** — asserts every file here classifies as `adapters` (importing only
   contracts — `adapter → contract`, legal — and no Core internal) **except** the three `bootstrap/*.mjs`
   composition-root entries, which classify as `composition` (the enumerated both-layer exception), and that Core
   imports nothing from `infrastructure/`.
2. **`node scripts/delete-test.mjs`** — `rm -rf infrastructure/execution-node/` in a throwaway worktree ⇒ the
   **real Core still builds** (`tsc -p tsconfig.core.json`) and its self-tests pass. Green = the keystone held.

## Self-test

`adapters/neo/self-test.ts` (run via the finance-os-demo `tsx` toolchain) proves, with **no real process
spawned**: a stub-spawner `execute` → an `ExecutionOutcome`; `canAccept` accept/reject; the health emitter
produces a valid report; the daemon ticks once with an injected clock and emits a monotonic heartbeat.

## Status

DESIGN + ADAPTER CODE. **Installs nothing** — no node joined, no daemon loaded, no runner registered, no secret
moved. The launchd plists, bootstrap scripts, Tailscale ACL, and colima profile are designed in
`docs/architecture/neo/07-execution-infrastructure-complete.md`; this folder builds the seam (the contracts'
implementation) that those install scripts target.
