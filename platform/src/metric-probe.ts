// =============================================================================
// MetricProbe substrate (C12 / RS-DOS-v1 §36) — the Goal Supervisor's independent eyes.
// =============================================================================
// Sprint 1.5, first slice. This is the registered, VERSIONED, LEAST-PRIVILEGE probe the
// Goal Supervisor (C7) uses to RE-READ the acceptance metric from its canonical source under
// its OWN identity — never the PO/worker-written value (RS-DOS §7.2 step 1, §36.1/§36.2).
//
// What this module is, and is NOT:
//   IS  — (a) a MetricProbe descriptor type (§36.1: probe_id, version, metric_kind, source/target,
//             expected_shape, credential_ref, parse/extract); (b) a small registry that resolves
//             a (probe_id, version) → descriptor (VERSION-PINNED — a probe is never silently
//             upgraded under a running goal); (c) an invocation that opens a LEAST-PRIVILEGE,
//             READ-ONLY connection from the descriptor's credential_ref, re-reads the metric from
//             its canonical source, and returns a TYPED value.
//   NOT — the Goal Supervisor trip logic / dGoal-dEffort / halt-and-summon (Sprint 3.2). This slice
//         only PRODUCES the GS's input (the external re-probe + the typed value). It also does NOT
//         build the §36.3 LLM reachability evaluator — that is stubbed in ./reachability-evaluator.ts.
//
// ── The least-privilege guarantee (the independent observation the whole safety case rests on) ──
//   A probe NEVER writes and NEVER reads more than the metric. This is enforced in FOUR layers
//   (defense-in-depth), so a bug in any one layer does not breach the boundary:
//     L1  credential boundary  — the credential_ref resolves to a connection whose DB ROLE has only
//                                SELECT (no INSERT/UPDATE/DELETE/DDL grant). A write is "permission
//                                denied" at the database, not by code discipline.
//     L2  read-only transaction — every read runs inside `SET TRANSACTION READ ONLY`, so even a
//                                 mis-granted role cannot mutate (Postgres raises 25006 on any write).
//     L3  statement allow-list — the target must be a single read statement (SELECT/WITH …); a probe
//                                that smuggles a write/DDL/second statement is refused before execution.
//     L4  no write surface     — the ProbeReader exposes ONLY read(); there is no write method to call.
// =============================================================================
import postgres from "postgres";

// ── Descriptor (§36.1) ───────────────────────────────────────────────────────────────────────────
export type MetricKind = "count" | "sum" | "ratio" | "scalar" | "boolean" | "duration";
export type ProbeType = "sql" | "http" | "script";

export interface MetricProbe<T = number | null> {
  /** Stable logical identity. Stored on the GoalContract as `acceptance.metric_source`. */
  probe_id: string;
  /** Monotonic descriptor version. Resolution is VERSION-PINNED: a goal pins (probe_id, version)
   *  so the metric definition can never drift mid-run. */
  version: number;
  /** What KIND of metric this is (documentation + downstream dGoal interpretation). */
  metric_kind: MetricKind;
  /** The mechanism. This slice BUILDS `sql`; `http`/`script` are reserved (refused at invoke). */
  type: ProbeType;
  /** The CANONICAL SOURCE to read — for `sql`, a single read-only query string. */
  target: string;
  /** Human/contract documentation of the row shape the target returns (e.g. "1 row, col `value`::numeric"). */
  expected_shape: string;
  /** The LEAST-PRIVILEGE, READ-ONLY credential identifier the resolver maps to a connection.
   *  Never an inline secret — a reference resolved at invoke time. */
  credential_ref: string;
  /** Parse/extract a TYPED metric value from the raw read result. Pure; never performs I/O. */
  extract: (rows: ReadonlyArray<Record<string, unknown>>) => T;
}

// ── Registry (§36.1) — resolves (probe_id, version) → descriptor ───────────────────────────────────
export class ProbeRegistry {
  private byKey = new Map<string, MetricProbe<any>>();
  private key(probeId: string, version: number) {
    return `${probeId}@${version}`;
  }
  /** Register a versioned descriptor. Re-registering the SAME (probe_id, version) is refused — a
   *  published probe version is immutable (a changed definition is a NEW version, never a mutation). */
  register<T>(p: MetricProbe<T>): this {
    const k = this.key(p.probe_id, p.version);
    if (this.byKey.has(k)) {
      throw new Error(`MetricProbe ${k} is already registered — bump the version instead of mutating a published probe`);
    }
    if (!Number.isInteger(p.version) || p.version < 1) {
      throw new Error(`MetricProbe ${p.probe_id}: version must be a positive integer (got ${p.version})`);
    }
    this.byKey.set(k, p);
    return this;
  }
  /** VERSION-PINNED resolve. Throws if that exact (probe_id, version) was never registered — the GS
   *  never falls back to "latest" (silent drift is the failure this prevents). */
  resolve<T = number | null>(probeId: string, version: number): MetricProbe<T> {
    const p = this.byKey.get(this.key(probeId, version));
    if (!p) {
      throw new Error(`MetricProbe ${probeId}@${version} is not registered (version-pinned resolution; no latest-fallback)`);
    }
    return p as MetricProbe<T>;
  }
  list(): MetricProbe<any>[] {
    return [...this.byKey.values()];
  }
}

/** The process-wide default registry. Callers may also pass their own ProbeRegistry. */
export const defaultProbeRegistry = new ProbeRegistry();

// ── Least-privilege read surface ───────────────────────────────────────────────────────────────────
/** The ONLY surface a probe is given over a data source: a single read(). No write method exists (L4). */
export interface ProbeReader {
  read(target: string): Promise<ReadonlyArray<Record<string, unknown>>>;
  close(): Promise<void>;
}

/** Resolves a descriptor's credential_ref → a least-privilege ProbeReader. In production this maps
 *  a ref to a read-only DB role's connection (from the config registry); in tests it maps to the
 *  throwaway test DB's read-only role. */
export type CredentialResolver = (credentialRef: string) => Promise<ProbeReader>;

// A single read statement: optional leading CTE(s) then SELECT. No `;`-separated second statement,
// no write/DDL keyword. This is L3 (statement allow-list) — defense-in-depth over the role grant (L1)
// and the read-only transaction (L2).
const READ_ONLY_STATEMENT = /^\s*(with|select)\b/i;
const FORBIDDEN_TOKEN = /\b(insert|update|delete|merge|truncate|drop|alter|create|grant|revoke|copy|call|do|set\s+role|reset\s+role|comment|vacuum|analyze|lock)\b/i;

function assertReadOnlyTarget(target: string): void {
  const trimmed = target.trim().replace(/;\s*$/, ""); // tolerate a single trailing semicolon
  if (trimmed.includes(";")) {
    throw new Error("MetricProbe target rejected: multiple statements are not allowed (read-only single-statement only)");
  }
  if (!READ_ONLY_STATEMENT.test(trimmed)) {
    throw new Error("MetricProbe target rejected: must be a single SELECT/WITH read statement");
  }
  if (FORBIDDEN_TOKEN.test(trimmed)) {
    throw new Error("MetricProbe target rejected: contains a write/DDL/role-mutating keyword");
  }
}

/**
 * A least-privilege SQL reader over one connection URL. The URL SHOULD point at a read-only DB role
 * (L1). Independently, EVERY read here runs inside a READ ONLY transaction (L2) and the statement is
 * allow-listed (L3). The returned reader exposes no write path (L4).
 *
 * `prepare:false` + `max:1`: a single, dedicated, non-pipelined connection — the probe is a cheap,
 * serial, read-only re-probe, not a concurrent serving path.
 */
export function makeReadOnlySqlReader(connectionUrl: string): ProbeReader {
  const sql = postgres(connectionUrl, { max: 1, idle_timeout: 20, connect_timeout: 10, prepare: false });
  return {
    async read(target: string) {
      assertReadOnlyTarget(target); // L3
      // L2: a read-only transaction — any write attempt raises 25006 regardless of the role's grants.
      const rows = await sql.begin(async (tx) => {
        await tx.unsafe("SET TRANSACTION READ ONLY");
        return tx.unsafe(target); // trusted, registered query string — never caller-interpolated input
      });
      return rows as unknown as ReadonlyArray<Record<string, unknown>>;
    },
    async close() {
      await sql.end({ timeout: 5 });
    },
  };
}

/** Build a CredentialResolver from a static map of credential_ref → read-only connection URL. */
export function sqlCredentialResolver(refToUrl: Record<string, string>): CredentialResolver {
  return async (credentialRef: string) => {
    const url = refToUrl[credentialRef];
    if (!url) {
      throw new Error(`credential_ref '${credentialRef}' is not provisioned (no read-only connection mapped)`);
    }
    return makeReadOnlySqlReader(url);
  };
}

// ── Invocation (§36.2 I-Probe) ─────────────────────────────────────────────────────────────────────
export interface ProbeResult<T = number | null> {
  probe_id: string;
  version: number;
  metric_kind: MetricKind;
  value: T;
  probed_at: Date;
}

/**
 * Invoke a registered probe under least-privilege, read-only credentials and return a TYPED value.
 * This is the §36.2 I-Probe mechanism: a direct read under the GS's own identity, independent of the
 * acting agent, least-privilege, versioned. It NEVER writes and reads ONLY the metric.
 *
 * @param probeId      the registered probe identity
 * @param version      the PINNED descriptor version (no latest-fallback)
 * @param resolver     maps the descriptor's credential_ref → a least-privilege ProbeReader
 * @param registry     the registry to resolve from (defaults to the process-wide registry)
 */
export async function invokeProbe<T = number | null>(
  probeId: string,
  version: number,
  resolver: CredentialResolver,
  registry: ProbeRegistry = defaultProbeRegistry,
): Promise<ProbeResult<T>> {
  const probe = registry.resolve<T>(probeId, version);
  if (probe.type !== "sql") {
    // http / script are reserved by the descriptor but not built in this slice.
    throw new Error(`MetricProbe ${probeId}@${version}: type '${probe.type}' is not implemented in this slice (only 'sql')`);
  }
  const reader = await resolver(probe.credential_ref);
  try {
    const rows = await reader.read(probe.target); // canonical-source re-read, least-privilege
    const value = probe.extract(rows);            // pure parse/extract → typed value
    return { probe_id: probe.probe_id, version: probe.version, metric_kind: probe.metric_kind, value, probed_at: new Date() };
  } finally {
    await reader.close();
  }
}
