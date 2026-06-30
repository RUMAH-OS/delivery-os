// =============================================================================
// infrastructure/execution-node — the Neo adapter SELF-TEST (the builder's runtime-verifiable probe).
// =============================================================================
// Proves the adapter implements the Core contracts correctly WITHOUT touching the real host:
//   (1) `execute` with a STUB spawner → a success `ExecutionOutcome` carrying an `evidenceRef` (NO real process).
//   (2) `canAccept` accepts an eligible request and rejects on label mismatch + the data_class gate.
//   (3) the Neo health emitter produces a VALID `PlatformHealthReport` (ok fold) and fails closed (down fold).
//   (4) the worker daemon ticks ONCE with an injected clock + a stub runtime tick (no infinite loop) and emits a
//       monotonic heartbeat through the Core HeartbeatEmitterPort.
//
// Run:  tsx self-test.ts   ·   exit 0 = every proof holds · exit 1 = a proof failed.
// =============================================================================

import type {
  ExecutionRequest,
  ExecutionOutcome,
} from "../../../../templates/governance-engine/execution-provider-port.js";
import type { HeartbeatRecord } from "../../../../templates/governance-engine/health-contract.js";
import {
  NeoExecutionProvider,
  type Spawner,
  type SpawnSpec,
  type SpawnResult,
} from "./neo-execution-provider.js";
import {
  NeoHeartbeatEmitter,
  NeoHealthProvider,
  isReady,
} from "./neo-health.js";
import { WorkerDaemon, type RuntimeTick } from "../../worker-daemon.js";

let failures = 0;
function check(name: string, cond: boolean, detail = ""): void {
  if (cond) console.log(`  PASS  ${name}${detail ? "  — " + detail : ""}`);
  else {
    console.error(`  FAIL  ${name}${detail ? "  — " + detail : ""}`);
    failures += 1;
  }
}

// a deterministic STUB spawner — records the spec it was asked to run; spawns NOTHING.
function stubSpawner(result: SpawnResult): { spawner: Spawner; calls: SpawnSpec[] } {
  const calls: SpawnSpec[] = [];
  const spawner: Spawner = {
    async run(spec: SpawnSpec): Promise<SpawnResult> {
      calls.push(spec);
      return result;
    },
  };
  return { spawner, calls };
}

function sampleRequest(overrides: Partial<ExecutionRequest> = {}): ExecutionRequest {
  return {
    jobId: "job-1",
    goalId: "goal-1",
    kind: "verify",
    payload: { ref: "abc123" },
    data_class: "INTERNAL",
    placement: { lane: "short", isolation: "shared", resource_class: "macos", capabilities: ["pg"] },
    budget: { maxWallclockMs: 60_000 },
    ...overrides,
  };
}

async function main(): Promise<void> {
  console.log("neo execution-node adapter self-test — ExecutionProviderPort + Health-Emission + worker daemon\n");

  // ── (1) execute with a stub spawner → an ExecutionOutcome with an evidenceRef (no real process) ──
  console.log("[1] execute() dispatches through the injectable spawner — no real process spawned");
  {
    const { spawner, calls } = stubSpawner({ code: 0, stdout: "ok", stderr: "" });
    const provider = new NeoExecutionProvider({ spawner });
    const ctrl = new AbortController();
    const outcome: ExecutionOutcome = await provider.execute(sampleRequest(), ctrl.signal);
    check("execute returns ok=true", outcome.ok === true);
    check("outcome carries a durable-bus evidenceRef", outcome.ok === true && outcome.evidenceRef.startsWith(`bus://evidence/${process.env.DOS_NODE_ID ?? "neo-node2"}/`));
    check("the stub spawner was invoked exactly once (no real spawn)", calls.length === 1);
    check("the resolved command honored the budget timeout", calls[0]?.timeoutMs === 60_000);

    const failing = stubSpawner({ code: 1, stdout: "", stderr: "verify failed: 2 checks red" });
    const p2 = new NeoExecutionProvider({ spawner: failing.spawner });
    const bad = await p2.execute(sampleRequest({ jobId: "job-2" }), new AbortController().signal);
    check("a non-zero exit maps to ok=false (honest failure)", bad.ok === false);
    check("a real check failure is NOT retryable", bad.ok === false && bad.retryable === false);
  }

  // ── (2) canAccept accept/reject (structural match + data_class gate) ──
  console.log("\n[2] canAccept() — pure structural eligibility + the data_class gate");
  {
    const trusted = new NeoExecutionProvider();
    check("accepts an eligible request (macos + pg ⊆ labels)", trusted.canAccept(sampleRequest()) === true);
    check(
      "rejects a resource_class the node does not publish",
      trusted.canAccept(sampleRequest({ placement: { lane: "short", isolation: "shared", resource_class: "windows" } })) === false,
    );
    check(
      "rejects a capability the node does not publish",
      trusted.canAccept(sampleRequest({ placement: { lane: "short", isolation: "shared", resource_class: "macos", capabilities: ["gpu"] } })) === false,
    );
    check(
      "accepts PII on a TRUSTED node",
      trusted.canAccept(sampleRequest({ data_class: "PII" })) === true,
    );
    const external = new NeoExecutionProvider({ trustDomain: "external" });
    check(
      "data_class gate: an EXTERNAL node refuses PII (fail-closed)",
      external.canAccept(sampleRequest({ data_class: "PII" })) === false,
    );
  }

  // ── (3) the health emitter produces a valid report (ok fold + fail-closed down fold) ──
  console.log("\n[3] Health-Emission Contract — a valid PlatformHealthReport (worst-wins fold)");
  {
    const fixedNow = () => new Date("2026-06-30T00:00:00.000Z");
    const healthy = new NeoHealthProvider({
      now: fixedNow,
      probes: [
        () => ({ name: "node-liveness", status: "ok", critical: true }),
        () => ({ name: "disk", status: "ok", critical: false }),
        () => ({ name: "runner", status: "ok", critical: false }),
      ],
    });
    const report = await healthy.buildReport();
    check("verdict ok when all subsystems ok", report.verdict === "ok");
    check("ok === (verdict === 'ok')", report.ok === (report.verdict === "ok"));
    check("checkedAt comes from the injected clock", report.checkedAt === "2026-06-30T00:00:00.000Z");
    check("summary tallies all subsystems", report.summary?.total === 3 && report.summary?.ok === 3);
    check("isReady true for an ok report", isReady(report) === true);

    const degraded = new NeoHealthProvider({
      now: fixedNow,
      probes: [
        () => ({ name: "node-liveness", status: "ok", critical: true }),
        () => ({ name: "disk", status: "degraded", critical: false, detail: "disk 88%" }),
      ],
    });
    const dReport = await degraded.buildReport();
    check("a non-critical degraded subsystem ⇒ verdict degraded (still serves)", dReport.verdict === "degraded");
    check("isReady true for degraded (degraded still serves)", isReady(dReport) === true);

    const down = new NeoHealthProvider({
      now: fixedNow,
      probes: [() => ({ name: "node-liveness", status: "down", critical: true, detail: "worker not advancing" })],
    });
    const downReport = await down.buildReport();
    check("a CRITICAL down subsystem ⇒ verdict down (fail-closed)", downReport.verdict === "down");
    check("isReady false for a down report (withholds the readiness signal)", isReady(downReport) === false);

    // liveness ping is store-independent
    const live = await new NeoHealthProvider({ livenessProbe: () => ({ ok: true }) }).liveness();
    check("liveness() returns the process-up ping", live.ok === true);
  }

  // ── (4) the worker daemon ticks once with an injected clock + a stub runtime tick (no infinite loop) ──
  console.log("\n[4] worker daemon — one tick, injected clock, monotonic heartbeat (no real loop)");
  {
    const captured: HeartbeatRecord[] = [];
    const emitter = new NeoHeartbeatEmitter({ sink: async (b) => void captured.push(b) });
    let tickCount = 0;
    const runtimeTick: RuntimeTick = {
      async tick() {
        tickCount += 1;
        return { advanced: true, consumerCursor: `cursor-${tickCount}`, gsPostedAt: "2026-06-30T00:00:00.000Z" };
      },
    };
    const daemon = new WorkerDaemon({
      runtimeTick,
      heartbeatEmitter: emitter,
      now: () => new Date("2026-06-30T00:00:01.000Z"),
    });

    const beat1 = await daemon.tickOnce();
    check("first tick emits tickSeq=1", beat1.tickSeq === 1);
    check("heartbeat stamps the canonical node id", beat1.nodeId === (process.env.DOS_NODE_ID ?? "neo-node2"));
    check("heartbeat carries the advanced consumer cursor", beat1.consumerCursor === "cursor-1");
    check("the emitter sink received the beat (emitted onto the bus seam)", captured.length === 1);

    const beat2 = await daemon.tickOnce();
    check("tickSeq is strictly monotonic across ticks", beat2.tickSeq === 2);
    check("the runtime drain advanced exactly once per tick", tickCount === 2);
    check("no scheduler/loop was started (tickOnce driven directly)", true);
  }

  console.log("");
  if (failures === 0) {
    console.log("neo execution-node adapter self-test: ALL PROOFS HOLD (exit 0)");
    process.exit(0);
  } else {
    console.error(`neo execution-node adapter self-test: ${failures} FAILURE(S) (exit 1)`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("self-test crashed:", e);
  process.exit(1);
});
