// DDL parity for the demo app — the app's applied engine migrations vs the VENDORED canonical engine DDL.
//
// MULTI-TENANT FIX (platform-debt closure, Item A — NOW SOLVED): `os-inherit engine-check`'s ddlParity used to
// read the app migration PATHS from the SHARED canonical manifest (which hardcoded the REFERENCE installer's
// Admin paths), so a 2nd app's ddlParity couldn't resolve. It now reads them PER-APP from a project-local
// .claude/os/engine.config.json — so this demo's `engine:drift:check` runs FULLY green incl. ddlParity against
// THIS app's own paths. This script remains as the STRONGEST form of the same proof: the demo applies the
// canonical engine DDL BYTE-IDENTICALLY (verbatim) into its own sequence, so a sha comparison (not just the
// structural normalise) passes. It compares the four engine files; the app-owned 0000_app_role.sql / outbox are
// NOT engine DDL.
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
  { app: "migrations/0003_engine_agent_runner.sql", canonical: ".claude/os/engine/migrations/0003_engine_agent_runner.sql" },
  { app: "migrations/0004_engine_agent_id.sql", canonical: ".claude/os/engine/migrations/0004_engine_agent_id.sql" },
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
