// DDL parity for the demo app — the app's applied engine migrations vs the VENDORED canonical engine DDL.
//
// WHY THIS EXISTS (a flagged N=2 rough edge): `os-inherit engine-check`'s ddlParity reads the app migration
// PATHS from the SHARED canonical manifest (capabilities/os-foundation.manifest.json), which currently hardcodes
// the REFERENCE installer's (Admin's) paths — migrations/0034_*, 0037_*, 0038_*. A 2nd app's migration files
// live elsewhere, so that check's ddlParity portion can't resolve them (the file-HASH drift lock, the actual
// "engine is OS-owned" guarantee, passes fine). Future polish: make the manifest's appMigrations per-app
// (e.g. a project-local override the tool reads), so engine-check's DDL parity is multi-tenant.
//
// This script proves the DEMO app's equivalent: its applied engine migrations are BYTE-IDENTICAL to the
// vendored canonical engine DDL (the demo applies them verbatim into its own sequence — the strongest form of
// structural equivalence). It compares the two engine files; the app-owned 0000_app_role.sql is NOT engine DDL.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const sha = (p: string) => createHash("sha256").update(readFileSync(p)).digest("hex");

const PAIRS: Array<{ app: string; canonical: string }> = [
  { app: "migrations/0001_engine_core.sql", canonical: ".claude/os/engine/migrations/0001_engine_core.sql" },
  { app: "migrations/0002_engine_await_loop.sql", canonical: ".claude/os/engine/migrations/0002_engine_await_loop.sql" },
];

let ok = true;
for (const p of PAIRS) {
  const a = sha(join(root, p.app));
  const c = sha(join(root, p.canonical));
  const same = a === c;
  if (!same) ok = false;
  console.log(`${same ? "PASS" : "FAIL"}  ${p.app}  ==  ${p.canonical}  ${same ? "(byte-identical)" : `(DRIFT a=${a.slice(0, 12)} c=${c.slice(0, 12)})`}`);
}
console.log(ok ? "DDL PARITY: PASS — the app applies the canonical engine DDL verbatim." : "DDL PARITY: FAIL");
process.exit(ok ? 0 : 1);
