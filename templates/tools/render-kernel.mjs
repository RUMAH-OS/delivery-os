#!/usr/bin/env node
// Delivery OS — kernel renderer. Regenerates the PROJECTED kernel sections from disk so
// they cannot drift: §5 Skills table from `.claude/skills/*/SKILL.md`, and the §9 verification
// line from `.claude/.verify-state.json`. INTENT sections (§1-3,7,8) are never touched.
//
//   node scripts/render-kernel.mjs        # rewrites CLAUDE.md §5 + §9 derived line
//
// This is the "STATE is derived, INTENT is hand-authored" rule, executed.

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const KERNEL = join(ROOT, "CLAUDE.md");

function fm(file) {
  const t = readFileSync(file, "utf8");
  const m = t.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const o = {};
  if (!m) return o;
  const lines = m[1].split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const kv = lines[i].match(/^([a-z_]+):\s*(.*)$/i);
    if (!kv) continue;
    const key = kv[1].toLowerCase();
    let val = kv[2].trim();
    if (val === ">" || val === "|" || val === ">-" || val === "|-") {
      // YAML folded/literal scalar: collect the following indented lines
      const buf = [];
      while (i + 1 < lines.length && /^\s+\S/.test(lines[i + 1])) buf.push(lines[++i].trim());
      val = buf.join(" ");
    }
    o[key] = val.replace(/^["']|["']$/g, "");
  }
  return o;
}

// --- gather installed skills from disk (the single source) ---
let skills = [];
try {
  skills = readdirSync(join(ROOT, ".claude", "skills"), { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => {
      const f = fm(join(ROOT, ".claude", "skills", e.name, "SKILL.md"));
      const use = (f.description || "").split(/[.;]/)[0].slice(0, 64);
      // v4 (B35): the task→skill routing surface carries each skill's TRIGGER TIER, derived from
      // mechanical_spine (hook > slash command > description) — rendered, so it cannot go stale.
      const spine = (f.mechanical_spine || "").trim();
      const trigger = !spine || /^none\b/i.test(spine) ? "description" : spine.slice(0, 48);
      return { name: e.name, use, trigger, status: f.stability || "stable" };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
} catch {}

const table = [
  "| Skill | Use when | Trigger | Status |",
  "|---|---|---|---|",
  ...skills.map((s) => `| ${s.name} | ${s.use} | ${s.trigger} | ${s.status} |`),
].join("\n");

let state = {}; try { state = JSON.parse(readFileSync(join(ROOT, ".claude", ".verify-state.json"), "utf8")); } catch {}
// v4 (B7/C2): os_version derives from the .verify-config.json PIN when present (consumers);
// the framework itself (no pin) falls back to the os-sync stamp. Prose never decides.
let cfg = {}; try { cfg = JSON.parse(readFileSync(join(ROOT, ".claude", ".verify-config.json"), "utf8")); } catch {}
const osv = cfg.os_version || state.os_version || "untagged";
const derivedLine = `**Verification status (derived from disk, §12):** os_version \`${osv}\` · skills installed: ${skills.length} · gate: \`.claude/hooks/verify-gate.mjs\` active.`;

let k = readFileSync(KERNEL, "utf8");

// replace the §5 table (everything from the first "| Skill" to the last table row in §5)
k = k.replace(/(##\s*5\.[^\n]*\n)(?:[^\n]*\n)*?(?=\n##\s)/, (block, header) => {
  // keep any prose lines under the header that are NOT table rows
  const prose = block.split("\n").slice(1).filter((l) => l.trim() && !l.trim().startsWith("|"));
  return `${header}${table}\n${prose.length ? prose.join("\n") + "\n" : ""}`;
});

// upsert the derived verification line in §9 (replace existing, else insert after the §9 header)
if (/\*\*Verification status \(derived from disk/.test(k)) {
  k = k.replace(/\*\*Verification status \(derived from disk[^\n]*\n/, derivedLine + "\n");
} else {
  k = k.replace(/(##\s*9\.[^\n]*\n)/, `$1${derivedLine}\n`);
}

writeFileSync(KERNEL, k);
console.log(`render-kernel: §5 rebuilt from ${skills.length} installed skills; §9 derived line refreshed (os_version=${state.os_version || "untagged"}).`);
