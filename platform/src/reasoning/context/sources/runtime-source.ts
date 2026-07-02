// =============================================================================
// OS-RUNTIME INVESTIGATE SOURCE — C0-INVESTIGATE over the LIVE Runtime truth domain (Frozen §10.2, I17).
// =============================================================================
// A REAL C0-INVESTIGATE source at N=1: it reads the OS's own liveness — the engine heartbeat (the host-written
// liveness row, src/heartbeat.ts) — and emits a CITED finding about whether the runtime this node is beating,
// and when it last beat. This is the "am I even alive / how fresh is my world" fact a consequential thought
// should not reason without. Cited `os_runtime:<nodeId>` (I4).
//
// ADDITIVE / READ-ONLY: it only READS via the existing exported `readHeartbeat` — it never stamps a beat,
// never ticks the engine, never sweeps the reconciler. The reader + clock are INJECTED (defaults = the real
// readHeartbeat + Date.now) so the assembler stays DB-free and deterministic in tests.

import type { Finding, InvestigateQuery, InvestigateSource } from "../context-brief.js";
import { readHeartbeat, NODE_ID } from "../../../heartbeat.js";

/** The read seam this source depends on — the existing heartbeat read API (injectable for tests). */
export type HeartbeatReader = (nodeId: string) => Promise<string | null>;

/** Source id — stable, for audit/dedup. */
export const OS_RUNTIME_SOURCE_ID = "os-runtime";

/** Freshness horizon (ms): a beat older than this is reported as STALE (a fact the thought should weigh). */
export const HEARTBEAT_STALE_MS = 30_000;

export interface RuntimeSourceOptions {
  /** Which node's liveness to read (default: this process's NODE_ID). */
  readonly nodeId?: string;
  /** Clock seam for deterministic freshness in tests; default Date.now. */
  readonly now?: () => number;
}

/**
 * Build the OS-runtime investigate source. `read` defaults to the real `readHeartbeat`; inject a fake in
 * tests. Emits a cited finding on the runtime's liveness (beating + freshness). If the node has never beat,
 * that ITSELF is a cited finding ("no heartbeat recorded") — an honest observation, not silence.
 */
export function runtimeInvestigateSource(
  read: HeartbeatReader = readHeartbeat,
  opts: RuntimeSourceOptions = {},
): InvestigateSource {
  const nodeId = opts.nodeId ?? NODE_ID;
  const now = opts.now ?? Date.now;
  const source = `os_runtime:${nodeId}`;
  return {
    id: OS_RUNTIME_SOURCE_ID,
    async investigate(_query: InvestigateQuery): Promise<Finding[]> {
      const lastBeat = await read(nodeId);
      if (!lastBeat) {
        return [{ id: "runtime.heartbeat", claim: `OS node ${nodeId} has no recorded heartbeat.`, source }];
      }
      const ageMs = now() - new Date(lastBeat).getTime();
      const fresh = Number.isFinite(ageMs) && ageMs <= HEARTBEAT_STALE_MS;
      return [
        {
          id: "runtime.heartbeat",
          claim: `OS node ${nodeId} last beat at ${lastBeat} (${fresh ? "FRESH" : "STALE"}${
            Number.isFinite(ageMs) ? `, ~${Math.round(ageMs / 1000)}s ago` : ""
          }).`,
          source,
          observedAt: lastBeat,
        },
      ];
    },
  };
}
