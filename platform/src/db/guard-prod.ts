// =============================================================================
// PROD-DB GUARD (DEFAULT-DENY, ALWAYS ON) — the permanent prevention for the 2026-06-25 incident, hardened
// by Sprint 1.1 to close DRB-v1 CONFLICT-03. RS-DOS-v1 §30/§57.
// =============================================================================
// ROOT CAUSE (confirmed): the repo `.env` carries the PRODUCTION DATABASE_URL (project ref
// `clfocpodfbtgzivnivck`, host `aws-0-eu-west-1.pooler.supabase.com`). Any destructive DB entrypoint that
// resolved DATABASE_URL from `.env` (or the dev machine's ambient env, which is the prod SoR) therefore
// executed against PRODUCTION — that is how dev/test fixtures reached prod (`npm run db:seed`/`db:migrate`).
//
// THIS MODULE is the single fail-closed guard every WRITING / DESTRUCTIVE DB entrypoint MUST call AFTER
// loadEnv() and BEFORE opening a connection. Default = REFUSE when DATABASE_URL targets prod.
//
// ── CONFLICT-03 CLOSURE (Sprint 1.1): the env-var escape hatch is GONE. ───────────────────────────────────
// Previously this guard could be disabled by `ALLOW_PROD_DB_WRITE=1` (legacy) or `ALLOW_PROD_DB=1 + --prod`.
// Those are REMOVED. There is now NO env var, NO CLI flag, NO config toggle that lets a prod write through.
// The ONLY way past the default-DENY is an in-process **consumed break-glass grant proof** (src/db/break-
// glass.ts → consumeGrant), which is founder-signed, single-use, short-TTL, table+operation-scoped, and
// immutably logged (migration 0054). That proof is produced ONLY by the platform-side migration-runner after
// it consumes a real grant; it can never be forged by setting an environment variable.
//
// The financial-SoR immutability triggers (invoice_immutability_guard 0028/0030, operator_audit RLS 0032,
// the c12 append-only guards 0052) are database-level and remain NON-overridable under ANY grant — this
// guard governs whether a prod CONNECTION may be opened for a scoped apply; it never relaxes those triggers.

import { createHash } from "node:crypto";
import { PROD_DB_REF, isProductionDb } from "../env.js";

// The regional Supabase pooler host that fronts the prod project. Matching the host is a COARSE, deliberately
// conservative signal (fail-closed): a throwaway scratch DB uses localhost/docker or a non-eu-west host; the
// local test DB uses localhost and never matches.
export const PROD_POOLER_HOST = "aws-0-eu-west-1.pooler.supabase.com";

/** True when the URL targets the prod project ref OR the prod pooler host. */
export function urlTargetsProd(url: string | undefined): boolean {
  if (!url) return false;
  return isProductionDb(url) || url.includes(PROD_POOLER_HOST);
}

/** sha256 hex of a connection string — matches src/db/break-glass.ts#urlFingerprint exactly. */
export function urlFingerprint(url: string | undefined | null): string | null {
  if (!url) return null;
  return createHash("sha256").update(url).digest("hex");
}

/** Redact the password from a connection string for safe logging. */
function redact(url: string): string {
  return url.replace(/:[^:@/]+@/, ":****@");
}

// The shape of a consumed break-glass grant proof (structurally; the authoritative producer is break-glass.ts).
export type ConsumedGrantProof = {
  __breakGlassConsumed: true;
  actionId: string;
  table: string;
  op: string;
  urlFingerprint: string | null;
  consumedAt: string;
};

// A proof authorizes a prod write ONLY if it is a genuine consumed-grant object (brand) bound to THIS exact
// target database (fingerprint match). It is an in-process object minted by consumeGrant after full
// cryptographic verification + an atomic single-use ledger write — it is NOT, and cannot be, an env var.
function isAuthorizedByConsumedGrant(grant: unknown, url: string): grant is ConsumedGrantProof {
  if (!grant || typeof grant !== "object") return false;
  const g = grant as Record<string, unknown>;
  if (g.__breakGlassConsumed !== true) return false;
  if (typeof g.table !== "string" || typeof g.op !== "string" || typeof g.actionId !== "string") return false;
  // The grant must be bound to the database we are about to write to.
  return g.urlFingerprint === urlFingerprint(url);
}

// Fail-closed guard. Call from any migrate/seed/destructive-script entrypoint AFTER loadEnv().
//   - Not a prod URL                          → returns (safe; the common dev/test/CI path).
//   - Prod URL + a valid consumed-grant proof → logs the authorized grant and returns (platform-runner path).
//   - Prod URL + anything else                → prints a clear refusal and EXITS NON-ZERO (process.exit(3)).
// There is NO env var or CLI flag that satisfies this guard — the consumed-grant proof is the only key.
export function guardProdDb(
  context = "this database operation",
  opts: { grant?: ConsumedGrantProof | null } = {},
): void {
  const url = process.env.DATABASE_URL;
  if (!urlTargetsProd(url)) return; // safe: dev/test/CI DB — proceed.

  if (isAuthorizedByConsumedGrant(opts.grant, url!)) {
    console.error(
      `[guard-prod] PROD write AUTHORIZED by a consumed break-glass grant (action ${opts.grant!.actionId}, ` +
        `scope ${opts.grant!.table}/${opts.grant!.op}) — proceeding with ${context}.\n` +
        `             DB: ${redact(url!)}`,
    );
    return;
  }

  console.error(
    `\n[guard-prod] REFUSING ${context}: DATABASE_URL points at the PRODUCTION database.\n` +
      `  ref:  ${PROD_DB_REF}\n` +
      `  host: ${PROD_POOLER_HOST}\n` +
      `  url:  ${redact(url!)}\n\n` +
      `  This entrypoint WRITES / is DESTRUCTIVE. The default-DENY prod guard is ALWAYS on and NO env var or\n` +
      `  CLI flag can disable it (the legacy ALLOW_PROD_DB_WRITE / ALLOW_PROD_DB escape hatches were removed in\n` +
      `  Sprint 1.1 — DRB-v1 CONFLICT-03).\n\n` +
      `    • For routine work: run against a LOCAL/TEST DB (npm run db:test:up && npm run db:test:migrate;\n` +
      `      create .env.test/.env.development with a LOCAL DATABASE_URL — the loader prefers them over .env).\n` +
      `    • For an AUTHORIZED production apply: use the platform-side migration-runner, which consumes a\n` +
      `      founder-signed, single-use, short-TTL, table+operation-scoped break-glass grant (src/db/break-\n` +
      `      glass.ts, migration 0054). The grant is consumed on neutral hardware — never by pasting a token.\n`,
  );
  process.exit(3);
}
