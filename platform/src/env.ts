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

/** The platform DATABASE_URL (fail-closed: the OS refuses to boot without its own DB). */
export function databaseUrl(): string {
  loadEnv();
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set — the OS runtime needs a platform-owned Postgres");
  return url;
}
