// =============================================================================
// Delivery OS — CANONICAL contract types: Inventory Properties projection, v1.
// =============================================================================
// Type face of inventory-properties-v1.mjs (same canonical artifact, vendored
// byte-identically via os-inherit). A consumer imports PropertyV1 from HERE instead
// of hand-declaring it — that is the dedup. Keep in lockstep with the .mjs validator.
// =============================================================================

export type AvailabilityStatus = "available" | "unavailable" | "upcoming";

export interface PhotoV1 {
  /** Absolute URL (Admin Storage). */
  url: string;
  /** Caption — PLAIN TEXT (encoding is part of the type, FV-4). */
  alt: string;
}

export interface AvailabilityV1 {
  status: AvailabilityStatus;
  /** Optional human string, e.g. "24-48h" — plain text. */
  leadTime?: string;
}

export interface PriceV1 {
  /** Integer minor units (cents). */
  amount: number;
  currency: string;
  period: "month";
}

/** The frozen public projection — EXACTLY these keys (.strict()). No PII, ever. */
export interface PropertyV1 {
  id: string;
  slug: string;
  city: string | null;
  area: string | null;
  bedrooms: number | null;
  photos: PhotoV1[];
  description: string | null;
  suitableFor: string[];
  minStayMonths: number | null;
  availability: AvailabilityV1;
  price: PriceV1 | null;
  /** ISO-8601. */
  updatedAt: string;
}

export interface MetaV1 {
  version: "v1";
  count: number;
  generatedAt: string;
}

export interface PropertyListV1 {
  data: PropertyV1[];
  meta: MetaV1;
}

export const AVAILABILITY_STATUS: readonly AvailabilityStatus[];
export const PROPERTY_V1_KEYS: string[];

export function validateProperty(p: unknown): { ok: boolean; errors: string[] };
export function validatePropertyList(body: unknown): { ok: boolean; errors: string[] };
