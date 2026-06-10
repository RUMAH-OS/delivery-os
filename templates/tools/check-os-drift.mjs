#!/usr/bin/env node
// Delivery OS — drift-lint (read-only; writes nothing). Makes the kernel unable to lie.
// FAILS (exit 1) on phantom-dispatch: the router/CODEOWNERS advertises a skill/agent
// with no backing file on disk (a router that lies). WARNS on cosmetic staleness
// (version behind latest tag) without failing — the reference tolerates an imprecise router.
//
//   node scripts/check-os-drift.mjs
//
// This is the projection's guardrail: a RENDER that disagrees with disk is a build error.

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";

const ROOT = process.cwd();
const fails = [], warns = [];
const read = (p) => { try { return readFileSync(p, "utf8"); } catch { return ""; } };

// --- §5 Skills table → each named skill must exist in .claude/skills/<name>/SKILL.md ---
const kernel = read(join(ROOT, "CLAUDE.md"));
const sec5 = (kernel.match(/##\s*5\.[\s\S]*?(?=\n##\s)/) || [""])[0];
const skillRows = [...sec5.matchAll(/^\|\s*([a-z0-9][a-z0-9-]+)\s*\|/gim)].map((m) => m[1])
  .filter((n) => n.toLowerCase() !== "skill");   // exclude the table header row ("Skill")
for (const s of skillRows) {
  if (!existsSync(join(ROOT, ".claude", "skills", s, "SKILL.md")))
    fails.push(`router §5 advertises skill "${s}" but .claude/skills/${s}/SKILL.md does not exist (phantom dispatch)`);
}

// --- CODEOWNERS handles → each must have a backing .claude/agents/<handle>.md ---
const co = read(join(ROOT, "CODEOWNERS"));
if (co) {
  const handles = [...co.matchAll(/@([a-z0-9][a-z0-9-]+)/gi)].map((m) => m[1]);
  for (const h of [...new Set(handles)]) {
    if (h === "owner" || h === "founder") continue; // human handles, not agent files
    if (!existsSync(join(ROOT, ".claude", "agents", `${h}.md`)))
      fails.push(`CODEOWNERS binds @${h} but .claude/agents/${h}.md does not exist (void author≠verifier binding)`);
  }
}

// --- version stamp vs latest tag (WARN only — cosmetic) ---
let stamp = "?"; try { stamp = JSON.parse(read(join(ROOT, ".claude", ".verify-state.json"))).os_version || "?"; } catch {}
let latest = "?"; try { latest = execSync("git describe --tags --abbrev=0", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch {}
if (latest !== "?" && stamp !== "?" && !stamp.startsWith(latest))
  warns.push(`consumer stamped at os_version=${stamp}; latest tag is ${latest} — may be BEHIND (run os-sync to refresh)`);

for (const w of warns) console.error(`WARN: ${w}`);
if (fails.length) {
  for (const f of fails) console.error(`FAIL: ${f}`);
  console.error(`drift-lint: ${fails.length} phantom-dispatch failure(s) — build blocked.`);
  process.exit(1);
}
console.log(`drift-lint: OK (${skillRows.length} skills checked, ${warns.length} warning(s)) — router matches disk.`);
process.exit(0);
