// =============================================================================
// Platform env loader — zero-dependency .env reader for the OS runtime.
// =============================================================================
// The OS runtime reads its platform-owned DATABASE_URL. Config comes from a FILE in a deterministic
// precedence (ambient process.env always wins — CI / Vercel / Neo inject there), loaded BEFORE anything
// reads process.env.DATABASE_URL. This is the OS-owned, tenant-free descendant of rumah-admin/src/env.ts:
// it carries NO tenant project ref and NO tenant prod guard — the OS owns its own platform DB, never a
// tenant's SoR (PLATFORM-HOME-EXTRACTION.md I-PI: no OS code path reads a tenant credential).
//
// Precedence (highest first): ambient env → .env.test (test mode) → .env.
//   Test mode is selected ONLY by an explicit flag (RUMAH_ENV=test OR NODE_ENV=test), never by file presence.

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, ".."); // src/ -> platform/ root

function parseEnvFile(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  const text = readFileSync(path, "utf8");
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    if (!key) continue;
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

let loaded = false;

/** Idempotent. Ambient process.env always wins (never overwritten). Lower-priority files only FILL unset keys. */
export function loadEnv(): void {
  if (loaded) return;
  loaded = true;
  const useTest = process.env.RUMAH_ENV === "test" || process.env.NODE_ENV === "test";
  const files = useTest ? [".env.test", ".env"] : [".env", ".env.test"];
  for (const f of files) {
    const path = resolve(ROOT, f);
    if (!existsSync(path)) continue;
    const parsed = parseEnvFile(path);
    for (const [k, v] of Object.entries(parsed)) {
      if (process.env[k] === undefined) process.env[k] = v;
    }
  }
}

// =============================================================================
// The enforce-flip FLAG — PLATFORM_REASONING_DRIVES_GOALS (the reasoning-driven GoalContract governance).
// =============================================================================
// When UNSET / not exactly "true" (the DEFAULT): the reconciler sweep keeps its EXACT current behavior — it
// assembles gsVerdict:null and drives ZERO autonomous mutation (fail-closed SHADOW). When "true": the sweep
// routes each pre-flight GoalContract through the reasoning goal-driver (src/reasoning/goal-driver.ts), whose
// reasoned verdict feeds the EXISTING sole mutator (po-reconciler-c2.applyReconcilePlan). This is the ONLY
// behavior change the flip introduces, and it is FULLY REVERSIBLE: unset the flag ⇒ current behavior returns.
// Read here (never off a bare process.env at a call site) so precedence + the .env files apply uniformly.
export const REASONING_DRIVES_GOALS_FLAG = "PLATFORM_REASONING_DRIVES_GOALS";

/** True IFF the enforce-flip flag is explicitly set to "true" (case-insensitive). Fail-closed default: any
 *  other value (unset / "false" / "1" / typo) ⇒ false ⇒ the reconciler keeps its exact zero-mutation behavior. */
export function reasoningDrivesGoals(): boolean {
  loadEnv();
  return (process.env[REASONING_DRIVES_GOALS_FLAG] ?? "").trim().toLowerCase() === "true";
}

/** The platform DATABASE_URL (fail-closed: the OS refuses to boot without its own DB). */
export function databaseUrl(): string {
  loadEnv();
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set — the OS runtime needs a platform-owned Postgres");
  return url;
}

// =============================================================================
// Production-DB identity — OS-OWNED, config-driven (I-PI: the OS carries NO tenant project ref in source).
// =============================================================================
// The prod-DB guard (src/db/guard-prod.ts) + the audited break-glass (src/db/break-glass.ts) were relocated
// into the OS in E-PH M2. In rumah-admin these hardcoded that tenant's Supabase project ref. The OS must never
// embed a tenant's identity (PLATFORM-HOME-EXTRACTION.md I-PI), so the "which DB is production" fact is read
// from the platform environment (PLATFORM_PROD_DB_REF) instead of a baked-in ref. Unset ⇒ empty ⇒ the ref
// check matches nothing (the coarse PROD_POOLER_HOST signal in guard-prod still applies); an OS deployment that
// wants ref-level prod protection sets PLATFORM_PROD_DB_REF to its OWN platform prod project ref.
export const PROD_DB_REF = process.env.PLATFORM_PROD_DB_REF ?? "";

// The regional pooler host that fronts the platform production DB — OS-OWNED, config-driven (same I-PI reason
// as PROD_DB_REF: the OS embeds no tenant infra host in source). guard-prod uses it as a COARSE, deliberately
// conservative fail-closed signal on top of the ref check. Unset ⇒ empty ⇒ matches nothing (an empty host must
// never match every URL); an OS deployment that wants host-level prod protection sets PLATFORM_PROD_POOLER_HOST
// to its OWN platform prod pooler host.
export const PROD_POOLER_HOST = process.env.PLATFORM_PROD_POOLER_HOST ?? "";

/** True when the URL targets the configured platform production project ref. Fail-open on the ref alone when no
 *  ref is configured (guard-prod layers the PROD_POOLER_HOST host signal on top); never matches a local/test DB. */
export function isProductionDb(url: string | undefined): boolean {
  if (!url || !PROD_DB_REF) return false;
  return url.includes(PROD_DB_REF);
}
