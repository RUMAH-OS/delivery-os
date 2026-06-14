// =============================================================================
// parity-oracle — the reusable, fail-closed verification kernel  (v6 capability #4)
// =============================================================================
// Canonical home: delivery-os/skills/parity-oracle (this file). Zero dependencies
// (plain JS ESM, no zod, no test runner) so ANY repo's CI / `node -e` / a skill /
// a gate can `import` it without installing anything. Pure functions, no I/O.
//
// WHY THIS EXISTS (the v6 thesis = turn a repeated lesson into a capability):
// three verification patterns were hand-re-implemented 3x+ each across Admin's
// VERIFY suites, every cross-repo / migration / seam slice paying the same cost:
//
//   1. recursive PII-sentinel byte scan  — re-implemented in:
//        rumah-admin/tests/plos-wave1-independent-qa.test.ts   (collectStrings /
//          collectKeys + the PII_NEVER_ON_SEAM loop, ~L62-77, L190-217)
//        rumah-admin/tests/send-requested-notice.qa.test.ts    (PII_TOKENS loop,
//          ~L27-35, L232-256)
//        rumah-admin/tests/seam-conformance.test.ts            (PII_TOKENS blob
//          grep, ~L35-42, L232-256)
//        delivery-os/contracts/admin-plos-seam-v1.mjs          (scanPii deny-list,
//          ~L55-92)  <- key-based half; this generalises + adds the sentinel half
//
//   2. derivation parity (recompute-from-source vs the seam projection) —
//        plos-wave1-independent-qa.test.ts: status/balance/daysOverdue parity
//          (~L280-321), customer-facts<->company-health concentration parity
//          (rentSharePct + monthlyRentCents, ~L362-371), overdue parity (~L307-315)
//
//   3. event payload parity (validate an event against the seam contract) —
//        seam-conformance.test.ts: validateSeamEvent / validateSeamBatch over a
//          real drain (~L177-185) — this wraps that so any caller composes it.
//
// Each suite re-typed `collectStrings`, the PII key list, and a bespoke recompute
// loop. This module is the single home for those three checks. New cross-repo /
// migration slices CITE it instead of re-typing it (see SKILL.md).
//
// Fail-closed contract: every function RETURNS the list of violations/mismatches
// (it never throws on a finding and never returns a bare boolean that a caller
// could forget to check). Empty array === clean. A caller asserts `=== []` or
// uses the `.ok` helper. An input it cannot scan safely is reported, not skipped.
// =============================================================================

// --- shared primitives -------------------------------------------------------

const isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const isStr = (v) => typeof v === "string";

// Recursively collect every string VALUE anywhere in obj (arrays + nested objects).
// (The `collectStrings` re-typed in plos-wave1 L72-77 and the JSON.stringify blob
//  grep in the seam suites — unified here.)
export function collectStrings(value, out = []) {
  if (Array.isArray(value)) for (const x of value) collectStrings(x, out);
  else if (isPlainObject(value)) for (const k of Object.keys(value)) collectStrings(value[k], out);
  else if (isStr(value)) out.push(value);
  return out;
}

// Recursively collect every KEY anywhere in obj (the `collectKeys` re-typed in
// plos-wave1 L67-71 — used to assert PII NAME-keys never appear on a projection).
export function collectKeys(value, out = new Set()) {
  if (Array.isArray(value)) for (const x of value) collectKeys(x, out);
  else if (isPlainObject(value)) for (const k of Object.keys(value)) { out.add(k); collectKeys(value[k], out); }
  return out;
}

// =============================================================================
// 1. scanPiiLeak — recursive PII / sentinel byte scan (fail-closed)
// =============================================================================
// Scans ANY object / API response / event for PII, two complementary ways:
//   (a) KEY-based deny-list: a key whose name is a known PII field (case-insensitive)
//       appearing anywhere => a leak. The seam carries REFS (tenantId, contractId);
//       a `legalName` / `email` / `iban` key is a data-minimisation violation.
//   (b) SENTINEL-based byte scan: any provided sentinel STRING appearing anywhere as
//       a substring of any string value => a leak (the "seed known PII into every
//       column, assert the bytes never cross the seam" pattern from the QA suites).
//   (c) OBJECT-carrier check: a `tenant`/`recipient` OBJECT bundling a name/email is
//       a PII dump masquerading as a ref (send the *Id, the consumer resolves it).
//
// `*Id` keys are always allowed (refs). Sender-identity keys (billerName/ownerName)
// are allow-listed. Returns a violations[] (empty === clean). Never throws.
//
// @param obj        any value (object/array/response/event payload)
// @param sentinels  optional string[] of planted secrets that must NOT appear
// @param opts       { piiKeys?, allowKeys?, objectCarrierKeys?, nameOrEmailKeys? }
//                   to extend/override the defaults per call site.
export function scanPiiLeak(obj, sentinels = [], opts = {}) {
  const violations = [];

  // Default tenant-PII key deny-list (lowercased). Mirrors the seam contract's
  // PII_KEYS (admin-plos-seam-v1.mjs L55-62) + the QA suites' PII_NEVER_ON_SEAM.
  const piiKeys = new Set(
    (opts.piiKeys ?? ["email", "contactEmail", "legalName", "contactName", "address", "iban", "kvkNumber"])
      .map((k) => k.toLowerCase()),
  );
  // Keys that look name-ish but are explicitly fine (sender/business identity).
  const allowKeys = new Set((opts.allowKeys ?? ["billerName", "ownerName"]).map((k) => k.toLowerCase()));
  // Object-shaped carriers that must not bundle a human's name/email.
  const objectCarrierKeys = new Set((opts.objectCarrierKeys ?? ["tenant", "recipient"]).map((k) => k.toLowerCase()));
  const nameOrEmail = new Set(
    (opts.nameOrEmailKeys ?? ["name", "email", "legalName", "contactName", "contactEmail"]).map((k) => k.toLowerCase()),
  );

  // (a)+(c): walk the object graph keying on field NAMES.
  const walkKeys = (value, path) => {
    if (Array.isArray(value)) { value.forEach((x, i) => walkKeys(x, `${path}[${i}]`)); return; }
    if (!isPlainObject(value)) return;
    for (const [k, v] of Object.entries(value)) {
      const lk = k.toLowerCase();
      const here = path ? `${path}.${k}` : k;
      if (lk.endsWith("id")) continue;           // *Id refs are always allowed
      if (allowKeys.has(lk)) continue;           // sender identity is allowed
      if (piiKeys.has(lk)) {
        violations.push(`PII: forbidden key "${here}" (data-minimisation: carry refs, not tenant PII)`);
        continue;
      }
      if (objectCarrierKeys.has(lk) && isPlainObject(v)) {
        for (const ck of Object.keys(v)) {
          if (nameOrEmail.has(ck.toLowerCase())) {
            violations.push(`PII: "${here}.${ck}" — a ${k} object must not carry a name/email (send ${k}Id; the consumer resolves the human)`);
          }
        }
      }
      walkKeys(v, here);
    }
  };
  walkKeys(obj, "");

  // (b): sentinel byte scan over every string value (the QA "seed-and-grep" half).
  if (sentinels && sentinels.length) {
    const strings = collectStrings(obj);
    for (const secret of sentinels) {
      if (secret === "" || secret == null) continue; // an empty sentinel matches everything — skip, don't false-positive
      const hit = strings.find((s) => s.includes(secret));
      if (hit !== undefined) {
        violations.push(`PII: planted sentinel "${secret}" leaked into a string value (found in: ${truncate(hit)})`);
      }
    }
  }

  return violations;
}

function truncate(s, n = 80) { return s.length > n ? s.slice(0, n) + "…" : s; }

// =============================================================================
// 2. assertDerivationParity — two derivations must agree on the named fields
// =============================================================================
// Assert a seam/projection `a` agrees with the canonical/independently-recomputed
// `b` on every field in `fields` (the "recompute from raw DB rows, compare to the
// seam" pattern: plos-wave1 status/balance/daysOverdue L293-302, rentSharePct +
// monthlyRentCents concentration parity L365-370).
//
// `fields` entries are either a string key (compared with Object.is — exact for
// numbers AND strings, NaN-safe) or { field, eq } with a custom comparator
// (e.g. a cents tolerance). A missing field on EITHER side is a mismatch
// (fail-closed: you cannot pass parity by simply omitting a value).
//
// @param a       derivation under test (e.g. the seam projection)
// @param b       reference derivation (e.g. recomputed-from-source truth)
// @param fields  Array<string | {field, eq?:(x,y)=>boolean}>
// @param label   optional prefix so a multi-row caller can name the row
// @returns mismatches[]  (empty === parity holds)
export function assertDerivationParity(a, b, fields, label = "") {
  const mismatches = [];
  const pfx = label ? `${label}: ` : "";
  if (!isPlainObject(a) || !isPlainObject(b)) {
    mismatches.push(`${pfx}both sides must be objects (a=${typeof a}, b=${typeof b})`);
    return mismatches;
  }
  for (const spec of fields) {
    const field = typeof spec === "string" ? spec : spec.field;
    const eq = (typeof spec === "object" && spec.eq) || ((x, y) => Object.is(x, y));
    const hasA = field in a, hasB = field in b;
    if (!hasA || !hasB) {
      mismatches.push(`${pfx}field "${field}" missing on ${!hasA ? "a (under-test)" : ""}${!hasA && !hasB ? " and " : ""}${!hasB ? "b (reference)" : ""}`.trim());
      continue;
    }
    if (!eq(a[field], b[field])) {
      mismatches.push(`${pfx}field "${field}" mismatch: under-test=${fmt(a[field])} reference=${fmt(b[field])}`);
    }
  }
  return mismatches;
}

function fmt(v) { return typeof v === "string" ? JSON.stringify(v) : String(v); }

// =============================================================================
// 3. assertEventPayloadParity — validate an event against a contract validator
// =============================================================================
// Thin, dependency-free wrapper so payload-parity COMPOSES with the seam contract
// (delivery-os/contracts/admin-plos-seam-v1.mjs validateSeamEvent) — the same
// gate seam-conformance.test.ts runs at L177-185, but importable from anywhere so
// no slice re-types the "run every drained event through the contract" loop.
//
// `contractValidateFn` is ANY (event) => { ok, violations } | violations[] | bool
// (so it accepts validateSeamEvent directly, or a custom per-event validator).
// Always normalises to violations[] (fail-closed: a thrown validator, or a falsy
// non-array return, becomes a violation rather than silently passing).
//
// @param event              one event envelope (or any object)
// @param contractValidateFn the contract validator (e.g. validateSeamEvent)
// @returns violations[]  (empty === valid)
export function assertEventPayloadParity(event, contractValidateFn) {
  if (typeof contractValidateFn !== "function") {
    return [`payload-parity: no contract validator supplied (pass validateSeamEvent or a (e)=>{ok,violations} fn)`];
  }
  let r;
  try {
    r = contractValidateFn(event);
  } catch (e) {
    return [`payload-parity: contract validator threw: ${e && e.message ? e.message : String(e)}`];
  }
  if (Array.isArray(r)) return r;                                   // validator returned violations[] directly
  if (isPlainObject(r) && Array.isArray(r.violations)) return r.violations; // {ok, violations}
  if (r === true) return [];                                         // bare-boolean pass
  if (r === false) return [`payload-parity: contract validator returned false (no detail)`];
  return [`payload-parity: contract validator returned an unrecognised shape (expected {ok,violations} | violations[] | boolean)`];
}

// Convenience: run a whole drain/batch of events through the contract validator.
// (Mirrors validateSeamBatch but keeps the oracle independent of any one contract.)
export function assertEventBatchParity(events, contractValidateFn) {
  const violations = [];
  if (!Array.isArray(events)) return ["payload-parity: batch input is not an array"];
  events.forEach((ev, i) => {
    for (const v of assertEventPayloadParity(ev, contractValidateFn)) {
      violations.push(`[${i}] (${(ev && ev.type) || "?"}) ${v}`);
    }
  });
  return violations;
}

// --- tiny helper -------------------------------------------------------------
// `ok(violations)` for callers that want a boolean AFTER they've kept the detail.
export const ok = (violations) => Array.isArray(violations) && violations.length === 0;

// =============================================================================
// TINY SELF-TEST EXAMPLES (run: `node parity.mjs` — prints PASS/FAIL, exits 1 on fail)
// =============================================================================
// 1) scanPiiLeak catches a forbidden key, a sentinel, and a recipient-object dump:
//      scanPiiLeak({ tenantId: "ok", email: "a@b.c" })            // ["PII: forbidden key \"email\" ..."]
//      scanPiiLeak({ note: "hi SECRET123 there" }, ["SECRET123"]) // ["PII: planted sentinel ..."]
//      scanPiiLeak({ recipient: { name: "Jan", email: "j@x" } })  // 3 violations (carrier name + carrier email + forbidden email key)
//      scanPiiLeak({ tenantId: "t1", billerName: "RUMAH" })       // []  (refs + sender identity OK)
// 2) assertDerivationParity catches a mismatch and a missing field:
//      assertDerivationParity({ balanceCents: 100 }, { balanceCents: 200 }, ["balanceCents"]) // 1 mismatch
//      assertDerivationParity({ a: 1 }, {}, ["a"])  // 1 mismatch (missing on reference)
// 3) assertEventPayloadParity composes with any {ok,violations} contract validator:
//      assertEventPayloadParity(ev, validateSeamEvent)  // [] when ev passes the seam contract

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("parity.mjs")) {
  const cases = [];
  const check = (name, cond) => cases.push({ name, pass: !!cond });

  // scanPiiLeak — key deny-list
  check("scanPiiLeak flags a forbidden email key", scanPiiLeak({ tenantId: "x", email: "a@b.c" }).length === 1);
  check("scanPiiLeak allows refs + sender identity", ok(scanPiiLeak({ tenantId: "t1", billerName: "RUMAH", ownerName: "BV" })));
  // scanPiiLeak — sentinel byte scan
  check("scanPiiLeak catches a planted sentinel anywhere", scanPiiLeak({ a: { b: ["x", "leak-SENT-9 here"] } }, ["SENT-9"]).length === 1);
  check("scanPiiLeak is clean when sentinel absent", ok(scanPiiLeak({ a: { b: ["x", "clean"] } }, ["SENT-9"])));
  // scanPiiLeak — object-carrier
  // recipient.name -> carrier leak; recipient.email -> carrier leak AND a forbidden key on recursion (3 total).
  check("scanPiiLeak flags a recipient object carrying name+email", scanPiiLeak({ recipient: { name: "Jan", email: "j@x" } }).length === 3);
  // assertDerivationParity
  check("assertDerivationParity catches a numeric mismatch", assertDerivationParity({ n: 100 }, { n: 200 }, ["n"]).length === 1);
  check("assertDerivationParity passes on agreement", ok(assertDerivationParity({ s: "a", n: 1 }, { s: "a", n: 1 }, ["s", "n"])));
  check("assertDerivationParity fail-closed on missing field", assertDerivationParity({ a: 1 }, {}, ["a"]).length === 1);
  // assertEventPayloadParity
  check("assertEventPayloadParity normalises {ok,violations}", ok(assertEventPayloadParity({}, () => ({ ok: true, violations: [] }))));
  check("assertEventPayloadParity surfaces a thrown validator", assertEventPayloadParity({}, () => { throw new Error("boom"); }).length === 1);
  check("assertEventPayloadParity fail-closed on missing validator", assertEventPayloadParity({}, undefined).length === 1);

  let failed = 0;
  for (const c of cases) { if (!c.pass) failed++; console.log(`${c.pass ? "PASS" : "FAIL"}  ${c.name}`); }
  console.log(`\n${cases.length - failed}/${cases.length} self-tests passed`);
  process.exit(failed === 0 ? 0 : 1);
}
