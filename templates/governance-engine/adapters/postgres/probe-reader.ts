// =============================================================================
// governance-engine — REFERENCE POSTGRES ADAPTER · ProbeReaderPort + CredentialResolver (the MetricProbe plane).
// =============================================================================
// This is admin's `makeReadOnlySqlReader` / `sqlCredentialResolver` (the `postgres`-backed half of
// `metric-probe.ts`) re-homed as the consumer adapter. The substrate — `ProbeRegistry`, `invokeProbe`, the L3
// allow-list `assertReadOnlyTarget`, the `ProbeReaderPort` shape — stays in the PACKAGE (`../../metric-probe.js`)
// with NO driver import. This file is the consumer plane that opens the least-privilege connection. The four-layer
// least-privilege guarantee is preserved across the split:
//   L1 (read-only DB role)        — the consumer maps `credential_ref` → a read-only role's URL (this file).
//   L2 (SET TRANSACTION READ ONLY) — every read runs in a read-only transaction (this file's `read()` body).
//   L3 (statement allow-list)     — `assertReadOnlyTarget` from the PACKAGE (same portable guard the engine uses).
//   L4 (no write surface)         — the `ProbeReaderPort` exposes only `read()` (the PACKAGE's port shape).
// =============================================================================

import postgres from "postgres";
import type { ProbeReaderPort, CredentialResolver } from "../../ports.js";
import { assertReadOnlyTarget } from "../../metric-probe.js";

/**
 * A least-privilege SQL reader over one connection URL (verbatim from admin metric-probe.ts). The URL SHOULD point
 * at a read-only DB role (L1); independently, every read runs inside a READ ONLY transaction (L2) and the
 * statement is allow-listed (L3); the returned reader exposes no write path (L4).
 *
 * `prepare:false` + `max:1`: a single, dedicated, non-pipelined connection — the probe is a cheap, serial,
 * read-only re-probe, not a concurrent serving path.
 */
export function makeReadOnlySqlReader(connectionUrl: string): ProbeReaderPort {
  const sql = postgres(connectionUrl, { max: 1, idle_timeout: 20, connect_timeout: 10, prepare: false, onnotice: () => {} });
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

/** Build a CredentialResolver from a static map of credential_ref → read-only connection URL (verbatim). */
export function sqlCredentialResolver(refToUrl: Record<string, string>): CredentialResolver {
  return async (credentialRef: string) => {
    const url = refToUrl[credentialRef];
    if (!url) {
      throw new Error(`credential_ref '${credentialRef}' is not provisioned (no read-only connection mapped)`);
    }
    return makeReadOnlySqlReader(url);
  };
}
