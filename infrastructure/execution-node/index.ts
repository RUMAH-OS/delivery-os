// =============================================================================
// infrastructure/execution-node — the Execution-Infra ADAPTER subsystem · barrel.
// =============================================================================
// The single import surface for the Execution Node infrastructure. Neo = Execution Node 1. Everything here is
// the OUTER `adapters` ring: it implements the Core-owned contracts (ExecutionProviderPort + the Health-Emission
// Contract) and is NEVER imported by Core. The Delete Test proves Core builds with this whole folder removed.
//
// Re-exports the Neo adapter (the ExecutionProviderPort impl), the Neo health adapter (HeartbeatEmitterPort +
// PlatformHealthProvider), and the worker-daemon drain loop. The Core↔adapter composition root (the launchd
// WORKER_ENTRY that wires `createGovernanceRuntime`) is intentionally NOT exported here — it is the unclassified
// `main`, outside every gated layer (worker-daemon.ts documents why).
// =============================================================================

// ── the Neo ExecutionProviderPort adapter ──
export { NeoExecutionProvider, defaultSpawner } from "./adapters/neo/neo-execution-provider.js";
export type {
  NeoExecutionProviderOptions,
  Spawner,
  SpawnSpec,
  SpawnResult,
  SuperviseRunner,
} from "./adapters/neo/neo-execution-provider.js";

// ── the Neo Health adapter (HeartbeatEmitterPort + PlatformHealthProvider) ──
export {
  NeoHeartbeatEmitter,
  NeoHealthProvider,
  foldVerdict,
  defaultNeoProbes,
  isReady,
} from "./adapters/neo/neo-health.js";
export type {
  HeartbeatSink,
  NeoHeartbeatEmitterOptions,
  SubsystemProbe,
  NeoHealthProviderOptions,
} from "./adapters/neo/neo-health.js";

// ── the worker daemon (the launchd-supervised drain loop) ──
export { WorkerDaemon } from "./worker-daemon.js";
export type {
  WorkerDaemonOptions,
  RuntimeTick,
  RuntimeTickResult,
  DaemonHandle,
  Scheduler,
} from "./worker-daemon.js";
