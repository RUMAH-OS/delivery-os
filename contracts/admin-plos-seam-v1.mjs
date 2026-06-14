// =============================================================================
// Admin <-> PLOS seam contract — v1  (CANONICAL, executable, zero-dependency)
// =============================================================================
// Canonical home: delivery-os (this file). Consumed by BOTH sides of the seam:
//   - Admin (rumah-admin) = PRODUCER: every outbox event it emits must pass.
//   - PLOS  (property-lead-os) = CONSUMER: every event it drains must pass.
// This module REPLACES the prose "ECR-0006 §4 evolution rule" with an executable
// per-event-type contract: a new event type or payload field cannot reach the
// seam unless it is added here DELIBERATELY (that is the whole point of the gate).
//
// earned_from: FV-4 (HTML markup delivered into a text/plain field) + FV-5
//   (invoice.send_requested emitted with NO notice) — both passed component QA
//   and only detonated at the founder's live send. The fix lives at the seam.
//
// Zero dependencies on purpose: plain JS, no zod. Any repo's CI can `import` it
// without installing anything. Pure functions, no I/O.
//
// Grounded in the REAL emitters (read 2026-06-14):
//   - rumah-admin/src/contracts/events-v1.ts  (the §A envelope + catalog comments)
//   - rumah-admin/src/admin.ts                (13 of 14 outbox.insert emitters)
//   - rumah-admin/src/signing-public.ts       (the 14th: contract.signed)
//   - rumah-admin/src/events-api.ts           (the drain shape: id/type/version/
//                                              occurredAt/aggregate/payload)
//
// Cross-repo DISTRIBUTION of this single file (so PLOS imports the same bytes) is
// v6 capability #11 (os-sync / canonical base) — OUT OF SCOPE here. Today each
// repo imports it by relative path.
// =============================================================================

export const SEAM_VERSION = "v1";

// --- primitives --------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// An ISO-8601 instant. Admin emits createdAt via Date.toISOString() (millis + 'Z').
// We accept the broader ISO-8601 family (with or without millis, with Z/offset).
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
// Any HTML tag: <p>, </p>, <strong>, <a href=...>. This is the FV-4 detector.
const HTML_TAG_RE = /<\/?[a-z][^>]*>/i;

const isUuid = (v) => typeof v === "string" && UUID_RE.test(v);
const isIso = (v) => typeof v === "string" && ISO_RE.test(v);
const isInt = (v) => typeof v === "number" && Number.isInteger(v);
const isStr = (v) => typeof v === "string";
const isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

// =============================================================================
// PII deny-list (data-minimisation invariant, ECR-0006 §2)
// =============================================================================
// No payload field (recursively) may be a tenant-PII key. The seam carries REFS
// (tenantId, contractId, ...) — PLOS resolves the human via tenantId -> Contact.
// ALLOW business/sender identity already ratified onto the seam: billerName,
// ownerName, and any *Id reference. A `tenant`/`recipient` OBJECT carrying a
// name/email is rejected (that is a PII dump masquerading as a ref).
const PII_KEYS = new Set([
  "email",
  "contactemail",
  "legalname",
  "contactname",
  "address",
  "iban",
]);
// Keys that are explicitly fine even though they look name-ish: sender identity.
const PII_ALLOW = new Set(["billername", "ownername"]);
// Object-shaped PII carriers: a `tenant`/`recipient` object that bundles a
// human's name/email is a leak (refs must be flat *Id strings, not objects).
const PII_OBJECT_KEYS = new Set(["tenant", "recipient"]);
const NAME_OR_EMAIL = new Set(["name", "email", "legalname", "contactname", "contactemail"]);

function scanPii(value, path, violations) {
  if (!isPlainObject(value)) return;
  for (const [k, v] of Object.entries(value)) {
    const lk = k.toLowerCase();
    const here = path ? `${path}.${k}` : k;
    // *Id refs are always allowed (and never recursed into as PII).
    if (lk.endsWith("id")) continue;
    if (PII_ALLOW.has(lk)) continue;
    if (PII_KEYS.has(lk)) {
      violations.push(`PII: forbidden field "${here}" (data-minimisation: the seam carries refs, not tenant PII)`);
      continue;
    }
    // A tenant/recipient OBJECT carrying a name/email is a PII dump.
    if (PII_OBJECT_KEYS.has(lk) && isPlainObject(v)) {
      for (const ck of Object.keys(v)) {
        if (NAME_OR_EMAIL.has(ck.toLowerCase())) {
          violations.push(`PII: "${here}.${ck}" — a ${k} object must not carry a name/email (send ${k}Id, PLOS resolves the human)`);
        }
      }
    }
    if (isPlainObject(v)) scanPii(v, here, violations);
  }
}

// =============================================================================
// Per-type payload registry — derived from the real admin.ts emitters.
// =============================================================================
// Each entry: { required:[...], optional:[...], text?:[...] }
//   required = keys that MUST be present (and non-undefined).
//   optional = keys that MAY be present.
//   text     = dot-paths whose string value must be PLAIN TEXT (no HTML) — the
//              FV-4 content-encoding rule (e.g. "notice.body").
// Any key in the payload that is neither required nor optional => violation
// (strict per-type shape; additive evolution is DELIBERATE, edited here).
//
// admin.ts line refs (read 2026-06-14) cited per type below.
const REGISTRY = {
  // L208 / L301 (POST /contracts + /contracts/:id/extend). ownerId optional
  // (resolved best-effort from the property; omitted when unavailable).
  "contract.created": {
    required: ["contractId", "tenantId", "propertyId", "kind", "startDate", "endDate", "isExtension"],
    optional: ["ownerId"],
  },
  // L367 (POST /contracts/:id/terminate). reason omitted when absent.
  "contract.terminated": {
    required: ["contractId", "tenantId", "propertyId", "terminatedOn"],
    optional: ["reason"],
  },
  // POST /contracts/:id/terminate, clearing branch (terminatedOn=null). The INVERSE
  // of contract.terminated — emitted when a termination is cleared so a consumer that
  // marked the contract ended can undo it. Closes the reversible-lifecycle gap LC-1
  // (terminate had a fact, reinstate did not → silent consumer drift). REFS only.
  "contract.reinstated": {
    required: ["contractId", "tenantId", "propertyId"],
    optional: [],
  },
  // signing-public.ts L106 (the public last-sign handler — the ONLY emitter
  // outside admin.ts). A binding contract is fully signed (once per contract,
  // existence-guarded; intentions never emit). templateVersion nullable.
  "contract.signed": {
    required: ["contractId", "tenantId", "propertyId", "signingId", "signedAt"],
    optional: ["templateVersion"],
  },
  // L1530 (POST /contracts/expiring/scan).
  "contract.expiring": {
    required: ["contractId", "tenantId", "propertyId", "endDate", "daysRemaining"],
    optional: [],
  },
  // L989 (prepareInvoice / prepare-batch). A DRAFT is ready for review — refs +
  // totals only, NO snapshot/PII, NOT a send request.
  "invoice.prepared": {
    required: ["invoiceId", "kind", "contractId", "tenantId", "totalCents", "dueDate", "period"],
    optional: [],
  },
  // L1171 (prepare-batch roll-up). batchId is a correlation id (no batch table).
  "invoice.batch_prepared": {
    required: ["batchId", "count", "invoiceIds"],
    optional: ["label"], // emitted as `label: ... ?? null` — present but nullable.
  },
  // L936 / L1039 (createInvoice + issueInvoice). The ISSUED (frozen, numbered)
  // fact; issuedBy = the irreversible event's actor REF (condition D) — required.
  "invoice.generated": {
    required: ["invoiceId", "number", "kind", "contractId", "tenantId", "totalCents", "dueDate", "issuedBy"],
    optional: [],
  },
  // L1448 (POST /invoices/:id/send). THE FV-4/FV-5 type: operator-approved send.
  // notice is REQUIRED ({subject, body}); body is PLAIN TEXT; bodyHtml optional
  // rich form. billerName (sender identity) is allowed.
  "invoice.send_requested": {
    required: ["invoiceId", "number", "tenantId", "contractId", "totalCents", "dueDate", "billerName", "notice"],
    optional: [],
    notice: { required: ["subject", "body"], optional: ["bodyHtml"], text: ["body"] },
  },
  // L1488 (reminders/run). The "reminder warranted" SIGNAL (PLOS owns cadence).
  "invoice.reminder_due": {
    required: ["invoiceId", "number", "tenantId", "contractId", "dueDate", "balanceCents"],
    optional: [],
  },
  // L1495 (reminders/run). Operator-equivalent send request the executor acts on.
  "reminder.send_requested": {
    required: ["invoiceId", "number", "tenantId", "contractId", "dueDate", "balanceCents"],
    optional: [],
  },
  // L1504 (reminders/run). The "became overdue" fact, emitted once per invoice.
  "invoice.overdue": {
    required: ["invoiceId", "number", "tenantId", "contractId", "dueDate", "balanceCents"],
    optional: [],
  },
  // L1375 (POST /invoices/:id/payments). fullyPaid is a derived boolean fact.
  "payment.received": {
    required: ["paymentId", "invoiceId", "amountCents", "fullyPaid"],
    optional: [],
  },
  // L514 / L567 (mintSigning + refresh). variant=contract path. REFS only —
  // NEVER the token secret. expiresAt is an ISO instant.
  "signature.send_requested": {
    required: ["signingId", "contractId", "tenantId", "propertyId", "party", "variant", "expiresAt"],
    optional: [],
  },
  // L514 / L567 (mintSigning + refresh). variant=extension|intention path.
  "renewal.send_requested": {
    required: ["signingId", "contractId", "tenantId", "propertyId", "party", "variant", "expiresAt"],
    optional: [],
  },
};

// =============================================================================
// Envelope validation (§A, strict)
// =============================================================================
const ENVELOPE_KEYS = new Set(["id", "type", "version", "occurredAt", "aggregate", "payload"]);

function validateEnvelope(env, violations) {
  if (!isPlainObject(env)) {
    violations.push("envelope: not an object");
    return false;
  }
  // strict: no unknown top-level keys may leak past the contract.
  for (const k of Object.keys(env)) {
    if (!ENVELOPE_KEYS.has(k)) violations.push(`envelope: unknown top-level key "${k}" (strict)`);
  }
  if (!isUuid(env.id)) violations.push("envelope.id: must be a uuid (the idempotency key)");
  if (!isStr(env.type) || env.type.length === 0) violations.push("envelope.type: must be a non-empty string");
  if (!isInt(env.version)) violations.push("envelope.version: must be an integer");
  if (!isIso(env.occurredAt)) violations.push("envelope.occurredAt: must be an ISO-8601 instant");
  if (!isPlainObject(env.aggregate)) {
    violations.push("envelope.aggregate: must be an object {type,id}");
  } else {
    for (const k of Object.keys(env.aggregate)) {
      if (k !== "type" && k !== "id") violations.push(`envelope.aggregate: unknown key "${k}" (strict)`);
    }
    if (!isStr(env.aggregate.type) || env.aggregate.type.length === 0) violations.push("envelope.aggregate.type: must be a non-empty string");
    if (!isUuid(env.aggregate.id)) violations.push("envelope.aggregate.id: must be a uuid");
  }
  // payload is object|null at the envelope level (a typed payload or null).
  if (env.payload !== null && !isPlainObject(env.payload)) {
    violations.push("envelope.payload: must be an object or null");
  }
  return violations.length === 0;
}

// Validate a flat set of fields against {required, optional}. Unknown => violation.
function validateFields(obj, spec, where, violations) {
  for (const k of spec.required) {
    if (!(k in obj) || obj[k] === undefined) violations.push(`${where}: missing required field "${k}"`);
  }
  const known = new Set([...spec.required, ...spec.optional]);
  for (const k of Object.keys(obj)) {
    if (!known.has(k)) violations.push(`${where}: unknown field "${k}" (per-type shape is strict — add it to the seam contract deliberately)`);
  }
}

// =============================================================================
// validateSeamEvent — the single producer/consumer gate.
// =============================================================================
export function validateSeamEvent(envelope) {
  const violations = [];
  const envOk = validateEnvelope(envelope, violations);
  // Without a usable type/payload we can't run the per-type checks.
  if (!envOk && (!isPlainObject(envelope) || !isStr(envelope.type))) {
    return { ok: false, violations };
  }

  const type = envelope.type;
  const payload = envelope.payload;
  const spec = REGISTRY[type];

  // An unknown type is a violation BY DESIGN — a new type must be added here.
  if (!spec) {
    violations.push(`type "${type}": unknown event type — not in the seam contract (add it deliberately)`);
    return { ok: violations.length === 0, violations };
  }

  if (!isPlainObject(payload)) {
    violations.push(`type "${type}": payload must be an object for this event type`);
    return { ok: false, violations };
  }

  // 1. per-type field shape (required/optional/strict-unknown)
  validateFields(payload, spec, "payload", violations);

  // 2. nested notice shape + content-encoding (the FV-4/FV-5 fix)
  if (spec.notice) {
    const notice = payload.notice;
    if (!isPlainObject(notice)) {
      violations.push(`payload.notice: required object {subject, body} is missing or not an object (FV-5)`);
    } else {
      validateFields(notice, spec.notice, "payload.notice", violations);
      for (const f of spec.notice.text || []) {
        const val = notice[f];
        if (isStr(val) && HTML_TAG_RE.test(val)) {
          violations.push(`payload.notice.${f}: must be PLAIN TEXT — found an HTML tag (FV-4; the rich form belongs in notice.bodyHtml)`);
        }
      }
    }
  }

  // 3. any top-level text-path fields (currently only notice.* uses text)

  // 4. PII-free (recursive, data-minimisation)
  scanPii(payload, "payload", violations);

  return { ok: violations.length === 0, violations };
}

// =============================================================================
// validateSeamBatch — aggregate across an array (e.g. a full drain page).
// =============================================================================
export function validateSeamBatch(events) {
  const violations = [];
  if (!Array.isArray(events)) {
    return { ok: false, violations: ["batch: input is not an array"] };
  }
  events.forEach((ev, i) => {
    const r = validateSeamEvent(ev);
    if (!r.ok) for (const v of r.violations) violations.push(`[${i}] (${(ev && ev.type) || "?"}) ${v}`);
  });
  return { ok: violations.length === 0, violations };
}
