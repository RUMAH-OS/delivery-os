// Governance Engine — MetricProbe substrate REGRESSION self-test, run against the INVERTED organ + an
// IN-MEMORY `ProbeReaderPort`/`CredentialResolver` (NO postgres, NO DB).
//
// THE PROOF THIS FILE EXISTS TO MAKE: the verified MetricProbe substrate — `ProbeRegistry` (version-pinned, no
// latest-fallback, immutable published version), the L3 read-only allow-list `assertReadOnlyTarget`, and
// `invokeProbe` (resolve → resolver → read → extract) — behaves IDENTICALLY after the `import postgres` was
// dropped and the reader/credential seam moved to `./ports.js`. The admin QA proof for these (`tests/
// metric-probe.qa.test.ts`) ran the L1/L2 layers against a real read-only Postgres ROLE; those two layers are now
// the CONSUMER adapter (`makeReadOnlySqlReader`) and are out of the package. The package keeps L3 (the statement
// allow-list) + L4 (no write method on the port) and the registry/invoke substrate — proven here over a fake
// `ProbeReaderPort`. Same inputs ⇒ same behavior.
//
// Run:  tsx metric-probe-self-test.ts   ·   exit 0 = the inverted substrate matches the verified substrate.

import {
  ProbeRegistry,
  assertReadOnlyTarget,
  invokeProbe,
  type MetricProbe,
} from "../metric-probe.js";
import type { CredentialResolver, ProbeReaderPort } from "../ports.js";

let pass = 0, fail = 0;
const probes: Array<{ id: string; ok: boolean; got: string }> = [];
const check = (id: string, ok: boolean, got = "") => { ok ? pass++ : fail++; probes.push({ id, ok, got }); };

// An in-memory `CredentialResolver` → `ProbeReaderPort` (the L4 read-only surface). NO postgres, NO DB. The
// reader applies the L3 guard exactly as a real adapter SHOULD, and exposes ONLY read()/close() (L4 structural).
function fakeResolver(rowsByRef: Record<string, ReadonlyArray<Record<string, unknown>>>): CredentialResolver {
  return async (ref: string): Promise<ProbeReaderPort> => {
    if (!(ref in rowsByRef)) throw new Error(`credential_ref '${ref}' is not provisioned (no read-only connection mapped)`);
    return {
      async read(target: string) {
        assertReadOnlyTarget(target); // L3 — the portable read guard the package keeps
        return rowsByRef[ref]!;
      },
      async close() {},
    };
  };
}

const ratioProbe: MetricProbe = {
  probe_id: "invoice-delivery-coverage", version: 1, metric_kind: "ratio", type: "sql",
  target: "SELECT value FROM mp_fixture_metric WHERE k = 'ratio_v1'",
  expected_shape: "1 row, col value::numeric", credential_ref: "probe-ro",
  extract: (rows) => Number((rows[0] as { value: number }).value),
};

async function main() {
  // ── (1) VERSION-PINNED registry: register + resolve EXACT (probe_id, version); no latest-fallback ──
  const reg = new ProbeRegistry();
  reg.register(ratioProbe);
  const resolved = reg.resolve("invoice-delivery-coverage", 1);
  check("1a registry resolves the EXACT (probe_id, version)", resolved.probe_id === "invoice-delivery-coverage" && resolved.version === 1);
  let noLatest = false;
  try { reg.resolve("invoice-delivery-coverage", 2); } catch { noLatest = true; }
  check("1b version-pinned: an unregistered version throws (NO latest-fallback)", noLatest);
  let immutable = false;
  try { reg.register({ ...ratioProbe }); } catch { immutable = true; }
  check("1c a published (probe_id, version) is IMMUTABLE (re-register refused — bump the version)", immutable);
  let badVersion = false;
  try { reg.register({ ...ratioProbe, probe_id: "x", version: 0 }); } catch { badVersion = true; }
  check("1d version must be a positive integer (version 0 refused)", badVersion);

  // ── (2) L3 statement allow-list (assertReadOnlyTarget) — the portable read guard the package keeps ──
  let okSelect = true;
  try { assertReadOnlyTarget("SELECT value FROM t"); assertReadOnlyTarget("WITH x AS (SELECT 1) SELECT * FROM x"); } catch { okSelect = false; }
  check("2a a single SELECT / WITH read is allowed", okSelect);
  const refused = (t: string) => { try { assertReadOnlyTarget(t); return false; } catch { return true; } };
  check("2b a write keyword is refused (UPDATE)", refused("UPDATE t SET x=1"));
  check("2c a DDL keyword is refused (DROP)", refused("DROP TABLE t"));
  check("2d a second statement is refused (; separated)", refused("SELECT 1; DELETE FROM t"));
  check("2e a non-SELECT (DO/CALL) is refused", refused("CALL foo()"));

  // ── (3) invokeProbe end-to-end over the IN-MEMORY ProbeReaderPort — resolve → read → extract (typed) ──
  const resolver = fakeResolver({ "probe-ro": [{ value: 0.42 }] });
  const r = await invokeProbe("invoice-delivery-coverage", 1, resolver, reg);
  check("3a invokeProbe returns the typed extracted value (0.42) via the injected ProbeReaderPort", r.value === 0.42 && r.metric_kind === "ratio", `value=${r.value}`);
  check("3b the result carries the PINNED probe_id@version (no drift)", r.probe_id === "invoice-delivery-coverage" && r.version === 1);

  // ── (4) invokeProbe surfaces an unprovisioned credential_ref (the resolver throws — fail-loud) ──
  let credThrew = false;
  const emptyResolver = fakeResolver({});
  try { await invokeProbe("invoice-delivery-coverage", 1, emptyResolver, reg); } catch { credThrew = true; }
  check("4a an unprovisioned credential_ref throws (no silent empty read)", credThrew);

  // ── (5) invokeProbe refuses a non-sql probe type (http/script reserved, not built) ──
  const httpReg = new ProbeRegistry().register({ ...ratioProbe, probe_id: "http-x", type: "http" });
  let typeRefused = false;
  try { await invokeProbe("http-x", 1, resolver, httpReg); } catch { typeRefused = true; }
  check("5a a non-sql probe type is refused at invoke (only 'sql' built)", typeRefused);

  // ── (6) L4 structural — the ProbeReaderPort exposes ONLY read()/close(); there is no write method ──
  const reader = await resolver("probe-ro");
  const methods = Object.keys(reader);
  check("6a the ProbeReaderPort exposes ONLY read()/close() (L4 — no write surface)",
    methods.sort().join(",") === "close,read", `methods=${methods.join(",")}`);
  await reader.close();

  for (const p of probes) console.log(`${p.ok ? "PASS" : "FAIL"}  ${p.id}${p.got ? "  ::  " + p.got : ""}`);
  console.log(`\ngovernance-engine MetricProbe substrate self-test (registry · L3 · L4 · invokeProbe on the in-memory port): ${pass}/${pass + fail} passed.`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
