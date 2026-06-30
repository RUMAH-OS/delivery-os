// =============================================================================
// MetricProbe substrate (C12 / RS-DOS-v1 §36) — the Goal Supervisor's / Completion Review's independent eyes.
// =============================================================================
// PLATFORM EXTRACTION SLICE 3. This is the port-injected mirror of `rumah-admin/src/metric-probe.ts`. The admin
// module carries a top-level `import postgres from "postgres"` used ONLY by the DEFAULT reader
// (`makeReadOnlySqlReader`). THIS module imports NO driver — every read crosses an injected `ProbeReaderPort`
// resolved by an injected `CredentialResolver` (both defined in `./ports.js`). The `postgres`-backed
// `makeReadOnlySqlReader` + `sqlCredentialResolver` ship as the CONSUMER adapter (they stay admin-side / PLOS-
// side); the probe DESCRIPTORS (the domain SQL strings) are likewise consumer-supplied. The residency invariant
// is enforced by `residency-guard.mjs`.
//
// WHAT CHANGED vs admin (and ONLY this): the DRIVER residency. The substrate — `MetricProbe<T>`, `ProbeRegistry`,
// `invokeProbe`, the L3 read-only allow-list `assertReadOnlyTarget`, `ProbeResult` — is BYTE-FOR-BYTE identical
// to the verified admin organ. The two `postgres`-backed functions (`makeReadOnlySqlReader`, `sqlCredentialResolver`)
// are REMOVED from the package (they become the consumer adapter), and the `ProbeReader`/`CredentialResolver`
// port types are now IMPORTED from `./ports.js` instead of declared here. Not one line of substrate logic changed.
//
// ── The least-privilege guarantee (the independent observation the whole safety case rests on) ──
//   A probe NEVER writes and NEVER reads more than the metric. This is enforced in FOUR layers
//   (defense-in-depth), so a bug in any one layer does not breach the boundary. The split across the package
//   boundary PRESERVES all four:
//     L1  credential boundary  — the credential_ref resolves to a connection whose DB ROLE has only SELECT.
//                                (CONSUMER adapter — `makeReadOnlySqlReader`'s read-only role.)
//     L2  read-only transaction — every read runs inside `SET TRANSACTION READ ONLY` (Postgres 25006 on a write).
//                                (CONSUMER adapter — the adapter's `read()` body.)
//     L3  statement allow-list — the target must be a single read statement; a smuggled write/DDL/second
//                                statement is refused before execution. (PACKAGE — `assertReadOnlyTarget`, below;
//                                a consumer adapter SHOULD call it, and the package's own use of a reader is
//                                always a registered, version-pinned target.)
//     L4  no write surface     — the `ProbeReaderPort` exposes ONLY read(); there is no write method to call.
//                                (PACKAGE — the port shape in `./ports.js`.)
// =============================================================================

// The ProbeReader/CredentialResolver port types live in ./ports.js (the residency-clean seam). They are
// re-exported here under their admin names so a consumer/organ that imports them from "./metric-probe.js"
// (as admin's completion-review-c6.ts does) keeps the identical import shape after extraction.
import type { ProbeReaderPort, CredentialResolver } from "./ports.js";
export type { ProbeReaderPort, CredentialResolver } from "./ports.js";
/** `ProbeReader` — the admin-era name for `ProbeReaderPort` (kept as an alias for byte-identical import shape). */
export type ProbeReader = ProbeReaderPort;

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

// A single read statement: optional leading CTE(s) then SELECT. No `;`-separated second statement,
// no write/DDL keyword. This is L3 (statement allow-list) — defense-in-depth over the role grant (L1)
// and the read-only transaction (L2), and it lives in the PACKAGE (the portable read guard).
const READ_ONLY_STATEMENT = /^\s*(with|select)\b/i;
const FORBIDDEN_TOKEN = /\b(insert|update|delete|merge|truncate|drop|alter|create|grant|revoke|copy|call|do|set\s+role|reset\s+role|comment|vacuum|analyze|lock)\b/i;

/** L3 — refuse any target that is not a single read statement. Exported so a consumer's `ProbeReaderPort`
 *  adapter (`makeReadOnlySqlReader`) calls the SAME portable guard the package relies on. */
export function assertReadOnlyTarget(target: string): void {
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
 * @param resolver     maps the descriptor's credential_ref → a least-privilege `ProbeReaderPort` (injected)
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
    const rows = await reader.read(probe.target); // canonical-source re-read, least-privilege (consumer adapter)
    const value = probe.extract(rows);            // pure parse/extract → typed value
    return { probe_id: probe.probe_id, version: probe.version, metric_kind: probe.metric_kind, value, probed_at: new Date() };
  } finally {
    await reader.close();
  }
}
