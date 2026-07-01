// =============================================================================
// AUDITED BREAK-GLASS — the founder-signed, single-use, short-TTL, table+operation-SCOPED grant that
// REPLACES the ALLOW_PROD_DB_WRITE env-var escape hatch. RS-DOS-v1 §30/§57; DRB-v1 CONFLICT-03 closure.
// =============================================================================
// This is the ONLY mechanism by which a write may reach production. No env var, no CLI flag, no config
// toggle authorizes a prod write: the default-DENY prod guard (src/db/guard-prod.ts) is ALWAYS on, and the
// single way past it is a grant that has been:
//   * founder-SIGNED       HMAC over a canonical payload, keyed by a secret resolved through a credential_ref
//                          to a PLATFORM store (Vercel/GitHub/Supabase) -- NEVER hardcoded, NEVER tree-resident.
//   * SINGLE-USE           enforced structurally by a partial unique index on the immutable ledger (0054):
//                          a 2nd consume can never insert a 2nd consumed row.
//   * short-TTL            an absolute expiry; an expired grant is refused (the replay window is bounded).
//   * SCOPED               to exactly one (table, operation); a grant for _migrations/migrate cannot
//                          authorize any other table or any other operation.
//   * immutably LOGGED     every issue / consume / denied attempt is appended to prod_write_override_events
//                          (append-only RLS + immutability trigger, 0054).
//   * consumed PLATFORM-side  consumeGrant is called by the migration-runner on neutral hardware, never by an
//                          agent pasting a token (the token comes from the platform secret store).
//
// WHAT A GRANT CANNOT DO (non-overridable under ANY grant): it mints NO database privilege and cannot disable
// a trigger. The financial source-of-record immutability triggers (invoice_immutability_guard 0028/0030,
// operator_audit append-only RLS 0032, the c12 append-only guards 0052) keep firing regardless. Break-glass
// authorizes WHO/WHEN a scoped apply runs; it never relaxes the database-level immutability of the ledgers.

import postgres from "postgres";
import type { Sql } from "postgres";
import { createHmac, randomUUID, randomBytes, createHash, timingSafeEqual } from "node:crypto";

export const DEFAULT_TTL_SECONDS = 600;                 // short TTL: 10 minutes (a tight replay window)
export const MAX_TTL_SECONDS = 3600;                    // hard ceiling: a grant may never be minted long-lived
export const LEDGER_TABLE = "prod_write_override_events";
// credential_ref -> the PLATFORM store entry holding the signing key. Format: "<scheme>:<ENV_NAME>". The key
// is read from process.env[ENV_NAME] (injected by the platform), NEVER written in code or a registry.
export const DEFAULT_CREDENTIAL_REF = process.env.BREAK_GLASS_CREDENTIAL_REF || "platform:BREAK_GLASS_SIGNING_KEY";

export type Scope = { table: string; op: string };

export type IssuedGrant = {
  actionId: string;
  token: string;            // the HMAC signature -- the bearer proof handed to the platform store (not the key)
  table: string;
  op: string;
  issuedBy: string;
  credentialRef: string;
  nonce: string;
  urlFingerprint: string | null;
  expiresAt: string;        // ISO
  ttlSeconds: number;
};

// The proof returned by a SUCCESSFUL consume. guard-prod.ts accepts ONLY this object (in-process, never an
// env var) as authorization to proceed against prod, and only for the matching target.
export type ConsumedGrantProof = {
  __breakGlassConsumed: true;
  actionId: string;
  table: string;
  op: string;
  urlFingerprint: string | null;
  consumedAt: string;       // ISO
};

export class BreakGlassError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "BreakGlassError";
  }
}

// sha256 hex of the target DATABASE_URL -- binds a grant to a database WITHOUT storing the url/secret.
export function urlFingerprint(url: string | undefined | null): string | null {
  if (!url) return null;
  return createHash("sha256").update(url).digest("hex");
}

// Resolve the signing key from a credential_ref to a platform store. FAIL CLOSED if absent.
export function resolveSigningKey(credentialRef = DEFAULT_CREDENTIAL_REF): string {
  const envName = credentialRef.includes(":") ? credentialRef.split(":").slice(1).join(":") : credentialRef;
  const key = process.env[envName];
  if (!key || key.length < 16) {
    throw new BreakGlassError(
      "no-signing-key",
      "break-glass signing key is unavailable via credential_ref '" + credentialRef + "' (expected a >=16-char " +
        "secret in the platform store entry " + envName + "). The key is NEVER hardcoded or tree-resident -- " +
        "inject it from the platform secret store. Refusing to issue/consume a grant (fail-closed).",
    );
  }
  return key;
}

// The canonical signed payload. Stable field order -> a deterministic string to HMAC.
function canonicalPayload(g: {
  actionId: string; table: string; op: string; nonce: string; urlFingerprint: string | null;
  expiresAt: string; issuedBy: string;
}): string {
  return JSON.stringify([
    "rumah-admin/break-glass/v1",
    g.actionId, g.table, g.op, g.nonce, g.urlFingerprint ?? "", g.expiresAt, g.issuedBy,
  ]);
}

export function signGrant(payload: string, key: string): string {
  return createHmac("sha256", key).update(payload).digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length || a.length === 0) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

// Open a short-lived connection if the caller did not inject one (the runner gives only a url; tests inject sql).
async function withSql<T>(sql: Sql | undefined, url: string | undefined, fn: (sql: Sql) => Promise<T>): Promise<T> {
  if (sql) return fn(sql);
  const u = url || process.env.DATABASE_URL;
  if (!u) throw new BreakGlassError("no-url", "break-glass: no sql handle and no DATABASE_URL/url to connect to.");
  const own = postgres(u, { max: 1, onnotice: () => {} });
  try {
    return await fn(own);
  } finally {
    await own.end({ timeout: 5 });
  }
}

// Append a denied attempt to the immutable ledger (best-effort audit; failures here never mask the refusal).
async function recordDenied(
  sql: Sql, actionId: string, scope: Scope, urlFp: string | null, reason: string,
): Promise<void> {
  try {
    await sql`
      INSERT INTO prod_write_override_events (action_id, event_type, table_name, op, url_fingerprint, denied_reason)
      VALUES (${actionId}, 'denied', ${scope.table}, ${scope.op}, ${urlFp}, ${reason})`;
  } catch {
    /* the refusal stands regardless of whether the audit insert succeeded */
  }
}

// =============================================================================
// issueGrant -- mint a founder-signed, single-use, short-TTL, scoped grant + append its 'issued' event.
// =============================================================================
export async function issueGrant(params: {
  table: string;
  op: string;
  issuedBy: string;                 // founder identity (audit + bound into the signature)
  url?: string;                     // the target prod DATABASE_URL (binds the grant; fingerprinted, never stored raw)
  ttlSeconds?: number;
  reason?: string;
  credentialRef?: string;
  sql?: Sql;                        // injected in tests; otherwise a connection is opened from url/DATABASE_URL
}): Promise<IssuedGrant> {
  const { table, op, issuedBy } = params;
  if (!table || !op) throw new BreakGlassError("bad-scope", "issueGrant: table and op are required (the grant scope).");
  if (!issuedBy) throw new BreakGlassError("no-signer", "issueGrant: issuedBy (the founder identity) is required.");

  const credentialRef = params.credentialRef || DEFAULT_CREDENTIAL_REF;
  const key = resolveSigningKey(credentialRef);     // FAIL CLOSED if the platform key is absent

  let ttlSeconds = params.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  if (ttlSeconds <= 0) throw new BreakGlassError("bad-ttl", "issueGrant: ttlSeconds must be > 0.");
  if (ttlSeconds > MAX_TTL_SECONDS) ttlSeconds = MAX_TTL_SECONDS;  // clamp: never long-lived

  const actionId = randomUUID();
  const nonce = randomBytes(16).toString("hex");
  const urlFp = urlFingerprint(params.url);
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  const signature = signGrant(
    canonicalPayload({ actionId, table, op, nonce, urlFingerprint: urlFp, expiresAt, issuedBy }),
    key,
  );

  await withSql(params.sql, params.url, async (sql) => {
    // One issued row per action_id (partial unique index). randomUUID makes a collision impossible.
    await sql`
      INSERT INTO prod_write_override_events
        (action_id, event_type, table_name, op, issued_by, credential_ref, signature, nonce, url_fingerprint,
         expires_at, ttl_seconds, reason)
      VALUES
        (${actionId}, 'issued', ${table}, ${op}, ${issuedBy}, ${credentialRef}, ${signature}, ${nonce}, ${urlFp},
         ${expiresAt}, ${ttlSeconds}, ${params.reason ?? null})`;
  });

  return {
    actionId, token: signature, table, op, issuedBy, credentialRef, nonce,
    urlFingerprint: urlFp, expiresAt, ttlSeconds,
  };
}

// =============================================================================
// consumeGrant -- verify (signature + not-expired + not-consumed + scope-match) and atomically mark consumed.
// CALLED BY THE PLATFORM RUNNER (scripts/migration-runner.mjs), never by an agent.
//
// Two accepted call shapes (the runner uses the first; tests/direct callers may use either):
//   consumeGrant({ table, op, url })                  // actionId+token resolved from the platform env
//   consumeGrant(actionId, token, { table, op, url }) // explicit identity + scope
// =============================================================================
export async function consumeGrant(
  a: { table: string; op: string; url?: string; actionId?: string; token?: string; credentialRef?: string; sql?: Sql } | string,
  b?: string,
  c?: { table: string; op: string; url?: string; credentialRef?: string; sql?: Sql },
): Promise<ConsumedGrantProof> {
  // Normalize the two call shapes.
  let actionId: string | undefined;
  let token: string | undefined;
  let table: string, op: string;
  let url: string | undefined, credentialRef: string | undefined, sql: Sql | undefined;

  if (typeof a === "string") {
    actionId = a;
    token = b;
    table = c?.table ?? "";
    op = c?.op ?? "";
    url = c?.url;
    credentialRef = c?.credentialRef;
    sql = c?.sql;
  } else {
    table = a.table;
    op = a.op;
    url = a.url;
    credentialRef = a.credentialRef;
    sql = a.sql;
    // The runner passes only { table, op, url }; the grant identity comes from the PLATFORM secret store,
    // injected as env (BREAK_GLASS_ACTION_ID / BREAK_GLASS_TOKEN) -- the token is NEVER pasted by an agent.
    actionId = a.actionId ?? process.env.BREAK_GLASS_ACTION_ID;
    token = a.token ?? process.env.BREAK_GLASS_TOKEN;
  }

  if (!table || !op) throw new BreakGlassError("bad-scope", "consumeGrant: a requested scope { table, op } is required.");
  if (!actionId || !token) {
    throw new BreakGlassError(
      "no-grant-presented",
      "consumeGrant: no grant presented. The platform runner must supply the founder-issued action_id + token " +
        "from the platform secret store (BREAK_GLASS_ACTION_ID / BREAK_GLASS_TOKEN). Refusing (fail-closed).",
    );
  }
  const requested: Scope = { table, op };
  const credRef = credentialRef || DEFAULT_CREDENTIAL_REF;
  const key = resolveSigningKey(credRef);            // FAIL CLOSED if the platform key is absent
  const presentedUrlFp = urlFingerprint(url);

  return withSql(sql, url, async (db) => {
    // (1) the grant must exist (its immutable issued event).
    const issued = await db<{
      table_name: string; op: string; nonce: string; url_fingerprint: string | null;
      expires_at: string; issued_by: string; signature: string;
    }[]>`
      SELECT table_name, op, nonce, url_fingerprint, expires_at, issued_by, signature
      FROM prod_write_override_events WHERE action_id = ${actionId} AND event_type = 'issued' LIMIT 1`;
    if (issued.length === 0) {
      await recordDenied(db, actionId!, requested, presentedUrlFp, "no-such-grant");
      throw new BreakGlassError("no-such-grant", "consumeGrant: no issued grant for action_id " + actionId + ".");
    }
    const g = issued[0]!;

    // (2) signature must verify (founder-signed, untampered) AND match the presented token.
    const expectSig = signGrant(
      canonicalPayload({
        actionId: actionId!, table: g.table_name, op: g.op, nonce: g.nonce,
        urlFingerprint: g.url_fingerprint, expiresAt: g.expires_at, issuedBy: g.issued_by,
      }),
      key,
    );
    if (!safeEqualHex(expectSig, g.signature) || !safeEqualHex(token!, g.signature)) {
      await recordDenied(db, actionId!, requested, presentedUrlFp, "bad-signature");
      throw new BreakGlassError("bad-signature", "consumeGrant: signature verification failed (tampered grant or wrong token).");
    }

    // (3) must not be expired (short-TTL replay window).
    if (new Date(g.expires_at).getTime() <= Date.now()) {
      await recordDenied(db, actionId!, requested, presentedUrlFp, "expired");
      throw new BreakGlassError("expired", "consumeGrant: grant " + actionId + " expired at " + g.expires_at + ".");
    }

    // (4) scope must match EXACTLY (table + operation).
    if (g.table_name !== requested.table || g.op !== requested.op) {
      await recordDenied(db, actionId!, requested, presentedUrlFp, "scope-mismatch");
      throw new BreakGlassError(
        "scope-mismatch",
        "consumeGrant: scope mismatch -- grant is for " + g.table_name + "/" + g.op +
          ", request is for " + requested.table + "/" + requested.op + ".",
      );
    }

    // (5) optional target binding: if the grant was bound to a database, the apply target must match it.
    if (g.url_fingerprint && presentedUrlFp && g.url_fingerprint !== presentedUrlFp) {
      await recordDenied(db, actionId!, requested, presentedUrlFp, "target-mismatch");
      throw new BreakGlassError("target-mismatch", "consumeGrant: this grant is bound to a different database target.");
    }

    // (6) SINGLE-USE: insert the consumed event. The partial unique index makes a 2nd consume impossible --
    //     a concurrent or repeated consume hits SQLSTATE 23505 and is refused. This is the atomic spend.
    const consumedAt = new Date().toISOString();
    try {
      await db`
        INSERT INTO prod_write_override_events (action_id, event_type, table_name, op, url_fingerprint)
        VALUES (${actionId}, 'consumed', ${requested.table}, ${requested.op}, ${presentedUrlFp})`;
    } catch (e: any) {
      if (e && e.code === "23505") {
        await recordDenied(db, actionId!, requested, presentedUrlFp, "already-consumed");
        throw new BreakGlassError("already-consumed", "consumeGrant: grant " + actionId + " was already consumed (single-use).");
      }
      throw e;
    }

    return {
      __breakGlassConsumed: true as const,
      actionId: actionId!,
      table: requested.table,
      op: requested.op,
      urlFingerprint: presentedUrlFp,
      consumedAt,
    };
  });
}

export default { issueGrant, consumeGrant, urlFingerprint, resolveSigningKey, signGrant, BreakGlassError };
