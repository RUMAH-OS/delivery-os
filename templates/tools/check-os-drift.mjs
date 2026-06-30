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

// --- CODEOWNERS handles → an AGENT handle must have a backing .claude/agents/<handle>.md;
//     a REAL GitHub identity (human/bot owner) does NOT. Real identities are project-declared
//     in .claude/codeowners-humans.txt (one handle per line; # comments ok) so the framework
//     stays project-agnostic. The legacy role tokens owner/founder are exempt by default.
//     (The phantom-agent guard holds: a handle that is neither an agent file nor a declared
//     identity still fails — a typo'd agent role is still caught.) ---
const co = read(join(ROOT, "CODEOWNERS"));
if (co) {
  const humans = new Set(["owner", "founder"]);
  for (const line of read(join(ROOT, ".claude", "codeowners-humans.txt")).split(/\r?\n/)) {
    const t = line.trim().replace(/^@/, "").toLowerCase();
    if (t && !t.startsWith("#")) humans.add(t);
  }
  const handles = [...co.matchAll(/@([a-z0-9][a-z0-9-]+)/gi)].map((m) => m[1]);
  for (const h of [...new Set(handles)]) {
    if (humans.has(h.toLowerCase())) continue; // real GitHub identity (human/bot), not an agent role
    if (!existsSync(join(ROOT, ".claude", "agents", `${h}.md`)))
      fails.push(`CODEOWNERS binds @${h} but .claude/agents/${h}.md does not exist and @${h} is not a declared identity in .claude/codeowners-humans.txt (void author≠verifier binding)`);
  }
}

// --- os_version: MUST derive from the .verify-config.json PIN — FAIL-CLOSED (v4, B7/C2) ---
// Earned: a consumer's router §9 simultaneously claimed "derived from disk" and carried a
// hand-minted version label two days past its own header — a hand-edit asserting it is derived
// is itself the lint failure. The pin is the one authority; prose never is.
let stamp = "?"; try { stamp = JSON.parse(read(join(ROOT, ".claude", ".verify-state.json"))).os_version || "?"; } catch {}
let pin = "?"; try { pin = JSON.parse(read(join(ROOT, ".claude", ".verify-config.json"))).os_version || "?"; } catch {}
if (pin !== "?" && stamp !== "?" && stamp !== pin)
  fails.push(`os_version stamp (${stamp}) != .verify-config.json pin (${pin}) — derived state was hand-edited or os-sync not re-run (run os-sync; never hand-edit)`);
// Anchor on a version-SHAPED value (v4 round-3 finding 7): the unanchored form
// first-matched the router's own doctrine prose ("`os_version` derives from the …"),
// capturing prose and blocking every fresh project's first push.
const routerVer = (kernel.match(/os_version\s*`(v\d[^`]*)`/) || [])[1];
if (routerVer && pin !== "?" && routerVer !== pin)
  fails.push(`router §9 claims os_version \`${routerVer}\` but the .verify-config.json pin says ${pin} — a "derived" field that disagrees with its source was hand-edited (re-run render-kernel; overlays never mint OS versions — Governance §14/F1)`);
let latest = "?"; try { latest = execSync("git describe --tags --abbrev=0", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch {}
if (pin === "?") { // no pin = the framework itself (versioned by its own tags) — prefix-warn only
  if (latest !== "?" && stamp !== "?" && !stamp.startsWith(latest))
    warns.push(`stamped at os_version=${stamp}; latest tag is ${latest} — may be BEHIND (run os-sync to refresh)`);
  if (routerVer && stamp !== "?" && routerVer !== stamp)
    warns.push(`router §9 os_version \`${routerVer}\` != stamp ${stamp} — re-run render-kernel`);
}

// --- Repository Principle: the dependency-enforcement layer must be PRESENT on disk if declared ---
//     Closes the "kernel advertises enforcement that disk doesn't have, un-gated" gap (the WAVE1-CHALLENGE
//     most-dangerous-gap: CLAUDE.md §3 claims the boundary is enforced; nothing checked that the enforcement
//     artifacts exist). If architecture.config.json declares the boundary, the gate script + the split Core
//     tsconfig + the Delete Test + the schema + the pre-push Gate-5 wiring must ALL exist — so the enforcement
//     claim is checkable, not remembered. (The boundary is itself drift-gated.)
{
  const archConfigPath = join(ROOT, "architecture.config.json");
  if (existsSync(archConfigPath)) {
    let archCfg = null;
    try { archCfg = JSON.parse(read(archConfigPath)); }
    catch (e) { fails.push(`architecture.config.json is present but not valid JSON (${e.message}) — the boundary spec must parse (fail-closed)`); }
    if (archCfg) {
      const need = [
        ["scripts/arch-boundary-guard.mjs", "the dependency-direction + infra-SDK gate"],
        [(archCfg.deleteTest && archCfg.deleteTest.coreTsconfig) || "tsconfig.core.json", "the split Core tsconfig (the 'Core builds' assertion)"],
        ["scripts/delete-test.mjs", "the standing Delete Test"],
        ["architecture.schema.json", "the config schema (fail-closed validation)"],
      ];
      for (const [rel, what] of need) {
        if (!existsSync(join(ROOT, rel)))
          fails.push(`architecture.config.json declares the dependency-enforcement layer but ${rel} (${what}) is MISSING — the kernel would advertise enforcement that disk does not have`);
      }
      const prePush = read(join(ROOT, ".githooks", "pre-push"));
      if (prePush && !/arch-boundary-guard/.test(prePush))
        fails.push(`architecture.config.json declares the boundary but .githooks/pre-push has no Gate-5 (arch-boundary-guard) wiring — the static gate is un-invoked (enforced-by-nothing)`);
    }
  }
}

for (const w of warns) console.error(`WARN: ${w}`);
if (fails.length) {
  for (const f of fails) console.error(`FAIL: ${f}`);
  console.error(`drift-lint: ${fails.length} phantom-dispatch failure(s) — build blocked.`);
  process.exit(1);
}
console.log(`drift-lint: OK (${skillRows.length} skills checked, ${warns.length} warning(s)) — router matches disk.`);
process.exit(0);
