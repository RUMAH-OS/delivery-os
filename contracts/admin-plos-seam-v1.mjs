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
// A pdfRef.url must be the AUTHENTICATED Admin PDF endpoint — a relative resource
// path (Admin renders from the FROZEN snapshot — immutability) OR a full https URL
// ending in that same path (with an optional signed-URL query string, e.g.
// ?token=...&expires=...). It is never a raw file, never a public link. PLOS fetches
// it with the same PLOS->Admin token the read seam uses. The endpoint + safe-filename
// form depend on the DOCUMENT KIND (pdfRef.kind below):
//   - invoice    : GET /admin/invoices/<id>/pdf      , filename Factuur-<number>.pdf
//   - creditNote : GET /admin/credit-notes/<id>/pdf  , filename Creditnota-<CN-number>.pdf
// content-encoding is PART of the contract (FV-4 generalised): the right endpoint
// renders the right artifact, the safe filename carries refs only (never PII).
//
// CORRECTION (2026-06-17, v1 in-place — events not yet in prod, no consumer ever
// fetched the broken form, so this is a buggy-pattern fix, NOT a v2 break): the
// Admin app is MOUNTED at /admin (rumah-admin/src/index.ts: `app.route("/admin",
// admin)`), so the REAL, fetchable PDF endpoints are /admin/invoices/<id>/pdf and
// /admin/credit-notes/<id>/pdf. The earlier un-prefixed patterns (/invoices/...,
// /credit-notes/...) matched a path that 404s — PLOS would fetch nothing and the
// email would ship with NO PDF (the cleaning-PDF-defect class). The /admin/ prefix
// is now REQUIRED (corrective tightening, not accept-both): there are no legacy
// un-prefixed emissions to honor, and accept-both would silently re-admit the 404
// path the founder's go-live depends on NOT shipping.
const PDF_KIND = {
  invoice: {
    url: /^(?:https:\/\/[^\s?#]+)?\/admin\/invoices\/[^\s/?#]+\/pdf(?:\?[^\s#]*)?$/,
    urlDesc: "a /admin/invoices/<id>/pdf path or an https URL ending in it",
    filename: /^Factuur-[A-Za-z0-9-]+\.pdf$/,
    filenameDesc: 'the safe form "Factuur-<number>.pdf"',
  },
  creditNote: {
    url: /^(?:https:\/\/[^\s?#]+)?\/admin\/credit-notes\/[^\s/?#]+\/pdf(?:\?[^\s#]*)?$/,
    urlDesc: "a /admin/credit-notes/<id>/pdf path or an https URL ending in it",
    filename: /^Creditnota-[A-Za-z0-9-]+\.pdf$/,
    filenameDesc: 'the safe form "Creditnota-<CN-number>.pdf"',
  },
};

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
// PII smuggled into a URL value (scanPii only inspects KEYS, not value-strings):
// an email anywhere, or an explicit name/email query param. The seam carries the
// invoice id as the only ref in the url — never the human's address/name.
const PII_URL_RE = /([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})|([?&](?:email|name|contactname|legalname)=)/i;

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
  // pdfRef (OPTIONAL, additive — version-safe; pre-pdfRef consumers ignore it) is
  // shape A (URL): { url, mimeType:"application/pdf", filename:"Factuur-<n>.pdf",
  // expiresAt? }. It points PLOS at Admin's authenticated GET /invoices/:id/pdf
  // (rendered from the FROZEN invoice snapshot — immutability) so PLOS can fetch +
  // attach the real BTW/VAT invoice PDF to the customer email. NO PII (url/filename
  // are scanned; PII-strict). Inline base64 (shape B) is rejected — keep the event
  // lean. See pdfRef enforcement block in validateSeamEvent below.
  // period / periodLabel (OPTIONAL, additive — version-safe; pre-period consumers ignore them) carry the
  // BILLED MONTH so PLOS renders the SAME period wording the Admin notice already contains. `period` is the
  // raw stored 'YYYY-MM'; `periodLabel` is the display form ("July 2026", from the shared formatPeriod).
  // DISPLAY ONLY — refs+display, PII-free (no name/email). Absent on a one-off (deposit, period=null) emit.
  "invoice.send_requested": {
    required: ["invoiceId", "number", "tenantId", "contractId", "totalCents", "dueDate", "billerName", "notice"],
    optional: ["pdfRef", "period", "periodLabel"],
    notice: { required: ["subject", "body"], optional: ["bodyHtml"], text: ["body"] },
    pdfRef: { required: ["url", "mimeType", "filename"], optional: ["expiresAt"] },
  },
  // L1488 (reminders/run). The "reminder warranted" SIGNAL (PLOS owns cadence).
  "invoice.reminder_due": {
    required: ["invoiceId", "number", "tenantId", "contractId", "dueDate", "balanceCents"],
    optional: [],
  },
  // L1495 (reminders/run). Operator-equivalent send request the executor acts on.
  // period / periodLabel (OPTIONAL, additive — version-safe) carry the BILLED MONTH so the PLOS reminder
  // renderer shows the SAME period wording as the invoice email/PDF. raw 'YYYY-MM' + display "July 2026"
  // (shared formatPeriod). DISPLAY ONLY, PII-free. Absent when the invoice has no period (one-off).
  "reminder.send_requested": {
    required: ["invoiceId", "number", "tenantId", "contractId", "dueDate", "balanceCents"],
    optional: ["period", "periodLabel"],
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
  // admin.ts POST /invoices/:id/credit-note (creditNoteId branch). A credit note (creditnota) was issued
  // against an invoice — a money + legal artifact that (partly) reverses it; the ORIGINAL invoice is unchanged.
  // REFS + amounts only (PII-FREE): number = the original invoice number, creditNoteNumber = CN-YYYY-NNNN,
  // amountCents = the credited amount. pdfRef (OPTIONAL, additive — same rules as invoice.send_requested.pdfRef
  // but the CN-PDF endpoint /credit-notes/<id>/pdf and the safe filename Creditnota-<CN-number>.pdf): points PLOS
  // at Admin's authenticated GET /credit-notes/:id/pdf (rendered from the FROZEN snapshot — immutability) so PLOS
  // can fetch + attach the real credit-note PDF. NO PII (url/filename scanned). Inline base64 (shape B) rejected.
  //
  // C2 (security review, 2026-06-16): `reason` is REMOVED from the seam. It is operator FREE-TEXT (max 500 chars)
  // — a name/email/address typed into it (e.g. "refund to jan@example.com") would ship to PLOS, because scanPii
  // inspects KEYS not VALUES (a free-text value can carry anything). The seam is refs+amounts only; `reason`
  // remains on the credit_note ARTIFACT (DB row + the CN PDF) where it belongs. `reason` is now an UNKNOWN field
  // here -> the strict per-type shape REJECTS it if an emitter ever re-adds it (fail-closed).
  "invoice.credited": {
    required: ["invoiceId", "number", "creditNoteId", "creditNoteNumber", "tenantId", "contractId", "amountCents"],
    optional: ["pdfRef"],
    pdfRef: { required: ["url", "mimeType", "filename"], optional: ["expiresAt"], kind: "creditNote" },
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
  // POST /contracts/:id/terminate with notifyTenant:true (operator opt-in). Requests a tenant-facing
  // termination confirmation — PLOS drafts, a human approves, Workspace sends (prepare→approve→send).
  // REFS only; PLOS resolves the recipient via tenantId→Contact. NOT auto-fired on every termination.
  "termination.send_requested": {
    required: ["contractId", "tenantId", "propertyId", "terminatedOn"],
    optional: ["reason", "noticeGivenOn"],
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

  // 3. pdfRef (optional) — shape A (URL) only. The content-encoding of the
  //    attachment is PART of the contract (FV-4 generalised): mimeType must be
  //    application/pdf, url must be the AUTHENTICATED Admin PDF endpoint for THIS
  //    document kind, and filename must be that kind's safe form. Inline base64
  //    (shape B) is rejected. PII (email/name) must not appear in url/filename.
  if (spec.pdfRef && "pdfRef" in payload && payload.pdfRef !== undefined) {
    const ref = payload.pdfRef;
    // The pdfRef kind (which endpoint/filename form): default "invoice"; a type
    // whose spec.pdfRef.kind is set (e.g. invoice.credited -> "creditNote") points
    // PLOS at the matching artifact endpoint. An unknown kind is a contract bug.
    const kind = (spec.pdfRef.kind && PDF_KIND[spec.pdfRef.kind]) ? spec.pdfRef.kind : "invoice";
    const rules = PDF_KIND[kind];
    if (!isPlainObject(ref)) {
      violations.push(`payload.pdfRef: must be an object { url, mimeType, filename, expiresAt? } (shape A, URL)`);
    } else {
      validateFields(ref, spec.pdfRef, "payload.pdfRef", violations);
      // Shape B (inline base64) is explicitly refused — keep the PII-strict event lean.
      if ("data" in ref || "base64" in ref || "bytes" in ref || "content" in ref) {
        violations.push(`payload.pdfRef: inline document bytes (data/base64/bytes/content) are forbidden — send a URL ref (shape A), not the PDF inline`);
      }
      if (!isStr(ref.mimeType) || ref.mimeType !== "application/pdf") {
        violations.push(`payload.pdfRef.mimeType: must be exactly "application/pdf"`);
      }
      if (!isStr(ref.url)) {
        violations.push(`payload.pdfRef.url: must be a string (the authenticated ${kind} PDF endpoint)`);
      } else if (!rules.url.test(ref.url)) {
        violations.push(`payload.pdfRef.url: must be the authenticated ${kind}-PDF endpoint (${rules.urlDesc}), not a public/arbitrary link`);
      } else if (PII_URL_RE.test(ref.url)) {
        violations.push(`PII: payload.pdfRef.url contains tenant PII (an email/name) — the url must carry only refs (the document id), PLOS resolves the human`);
      }
      if (!isStr(ref.filename)) {
        violations.push(`payload.pdfRef.filename: must be a string`);
      } else if (!rules.filename.test(ref.filename)) {
        violations.push(`payload.pdfRef.filename: must be ${rules.filenameDesc} (refs only — never a tenant name/email)`);
      }
      if ("expiresAt" in ref && ref.expiresAt !== undefined && !isIso(ref.expiresAt)) {
        violations.push(`payload.pdfRef.expiresAt: must be an ISO-8601 instant when present`);
      }
    }
  }

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
