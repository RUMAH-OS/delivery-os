// =============================================================================
// Delivery OS — CANONICAL contract: Inventory Properties projection, v1.
// =============================================================================
// THE single source of truth for the public, read-only Property projection that
// Rumah Admin PRODUCES (system of record, ECR-0002) and Rumah Website CONSUMES.
// Zero-dependency (no Zod) so an app can import + validate it with nothing vendored
// but this file. Distributed via os-inherit (vendored byte-identical, drift-checked):
// a consumer never re-declares this shape — it INHERITS it.
//
// Derived from Rumah Admin's ratified contract:
//   rumah-admin/docs/contracts/inventory-api-v1.md         (the prose contract — WINS)
//   rumah-admin/src/contracts/inventory-v1.ts              (Admin's Zod mirror)
//   rumah-admin/src/index.ts  toProjection() ~L118-133     (the real emit path)
//
// RULES (mirrors the prose contract §1):
//  - Read-only, versioned, projection-only. /v1 is ADDITIVE-ONLY.
//  - .strict(): EXACTLY these keys. An undeclared key is a violation (PII-leak guard).
//  - No PII, ever (owner legal_name/email/iban/address, owner_id, tenant identity).
//  - A field's TYPE includes its encoding: every string here is PLAIN TEXT, not HTML.
// =============================================================================

/** @typedef {"available"|"unavailable"|"upcoming"} AvailabilityStatus */
export const AVAILABILITY_STATUS = /** @type {const} */ (["available", "unavailable", "upcoming"]);

/** The exact public key set (.strict()). Single source for the conformance check. */
export const PROPERTY_V1_KEYS = [
  "id", "slug", "city", "area", "bedrooms", "photos", "description",
  "suitableFor", "minStayMonths", "availability", "price", "updatedAt",
].sort();

const isStr = (v) => typeof v === "string";
const isPlainText = (v) => isStr(v) && !/<[a-z!/][\s\S]*>/i.test(v); // encoding IS part of the type (FV-4)
const isInt = (v) => typeof v === "number" && Number.isInteger(v);
const isNullOr = (pred) => (v) => v === null || pred(v);

/**
 * Validate ONE property against the v1 projection. Returns {ok, errors[]}.
 * Pure, zero-dep, fail-closed: unknown keys, wrong types, or HTML in a plain-text
 * field are violations. Both producer and consumer call THIS — one artifact, both sides.
 * @param {unknown} p
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateProperty(p) {
  const errors = [];
  const E = (m) => errors.push(m);
  if (p === null || typeof p !== "object" || Array.isArray(p)) {
    return { ok: false, errors: ["property: not an object"] };
  }
  const o = /** @type {Record<string, unknown>} */ (p);

  // .strict() — no undeclared keys (a PII field leaking in is caught here).
  const allowed = new Set(PROPERTY_V1_KEYS);
  for (const k of Object.keys(o)) if (!allowed.has(k)) E(`unexpected key: ${k}`);
  for (const k of PROPERTY_V1_KEYS) if (!(k in o)) E(`missing key: ${k}`);

  if (!(isStr(o.id) && o.id.length > 0)) E("id: must be a non-empty string (uuid)");
  if (!(isStr(o.slug) && o.slug.length > 0)) E("slug: must be a non-empty string");
  if (!isNullOr(isPlainText)(o.city)) E("city: must be plain-text string or null");
  if (!isNullOr(isPlainText)(o.area)) E("area: must be plain-text string or null");
  if (!isNullOr((v) => isInt(v) && v >= 0)(o.bedrooms)) E("bedrooms: must be a non-negative integer or null");

  if (!Array.isArray(o.photos)) E("photos: must be an array");
  else o.photos.forEach((ph, i) => {
    if (ph === null || typeof ph !== "object") return E(`photos[${i}]: must be an object`);
    const keys = Object.keys(ph);
    if (keys.some((k) => k !== "url" && k !== "alt")) E(`photos[${i}]: unexpected key`);
    if (!isStr(/** @type {any} */ (ph).url)) E(`photos[${i}].url: must be a string`);
    if (!isPlainText(/** @type {any} */ (ph).alt)) E(`photos[${i}].alt: must be plain text`);
  });

  if (!isNullOr(isPlainText)(o.description)) E("description: must be plain-text string or null (no HTML — FV-4)");
  if (!Array.isArray(o.suitableFor) || !o.suitableFor.every(isStr)) E("suitableFor: must be a string[]");
  if (!isNullOr((v) => isInt(v) && v > 0)(o.minStayMonths)) E("minStayMonths: must be a positive integer or null");

  if (o.availability === null || typeof o.availability !== "object") E("availability: must be an object");
  else {
    const a = /** @type {Record<string, unknown>} */ (o.availability);
    for (const k of Object.keys(a)) if (k !== "status" && k !== "leadTime") E(`availability: unexpected key ${k}`);
    if (!AVAILABILITY_STATUS.includes(/** @type {any} */ (a.status))) E(`availability.status: must be one of ${AVAILABILITY_STATUS.join("|")}`);
    if (a.leadTime !== undefined && !isPlainText(a.leadTime)) E("availability.leadTime: must be plain text when present");
  }

  if (o.price !== null) {
    if (typeof o.price !== "object") E("price: must be an object or null");
    else {
      const pr = /** @type {Record<string, unknown>} */ (o.price);
      for (const k of Object.keys(pr)) if (!["amount", "currency", "period"].includes(k)) E(`price: unexpected key ${k}`);
      if (!(isInt(pr.amount) && /** @type {number} */ (pr.amount) >= 0)) E("price.amount: integer minor units (cents), non-negative");
      if (!isStr(pr.currency)) E("price.currency: must be a string");
      if (pr.period !== "month") E('price.period: must be "month"');
    }
  }

  if (!isStr(o.updatedAt)) E("updatedAt: must be an ISO-8601 string");

  return { ok: errors.length === 0, errors };
}

/**
 * Validate the LIST envelope `{ data: Property[], meta }` (or a bare Property[]).
 * Fail-closed: the index of every non-conforming property is reported.
 * @param {unknown} body
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validatePropertyList(body) {
  const errors = [];
  let list;
  if (Array.isArray(body)) {
    list = body;
  } else if (body && typeof body === "object" && Array.isArray(/** @type {any} */ (body).data)) {
    list = /** @type {any} */ (body).data;
    const meta = /** @type {any} */ (body).meta;
    if (meta !== undefined) {
      if (meta === null || typeof meta !== "object") errors.push("meta: must be an object when present");
      else if (meta.version !== "v1") errors.push('meta.version: must be "v1"');
    }
  } else {
    return { ok: false, errors: ["body: expected { data: Property[] } or Property[]"] };
  }
  list.forEach((p, i) => {
    const r = validateProperty(p);
    if (!r.ok) r.errors.forEach((e) => errors.push(`data[${i}].${e}`));
  });
  return { ok: errors.length === 0, errors };
}
