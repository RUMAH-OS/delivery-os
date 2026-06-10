#!/usr/bin/env node
// Delivery OS — no-backflow lint (Governance §14). Framework-side; runs on delivery-os itself.
// The clean-room set (core/ agents/ skills/ templates/ processes/ checklists/ domain-packs/) must
// name NO project — a project noun there is backflow (a consumer's lesson leaked into the agnostic
// framework). Mechanizes the guardrail, exactly as check-os-drift mechanizes router-truth.
// EXEMPT (project names allowed here): case-studies/ (worked examples), proposals/ (review history),
// README.md, CLAUDE.md, CHANGELOG*, docs/.
//
//   node scripts/check-no-backflow.mjs        // exit 1 on a project noun in a clean-room file
//
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const DIRS = ["core", "agents", "skills", "templates", "processes", "checklists", "domain-packs"];
// unambiguous PROJECT nouns only (repo names + package scopes). Technologies (a generic process
// doc may legitimately cite Supabase/BullMQ as examples) are NOT backflow and are NOT listed.
const DENY = [/@plos\b/i, /\bproperty-lead-os\b/i, /\bproperty lead os\b/i, /\bPLOS\b/, /\brumah-admin\b/i,
  /\brumah-website\b/i, /\bcontent-os\b/i, /\bthe-floor\b/i];
const SCAN = /\.(md|mjs|sh|json|template|txt)$/i;

function walk(dir, acc = []) {
  let entries = [];
  try { entries = readdirSync(join(ROOT, dir), { withFileTypes: true }); } catch { return acc; }
  for (const e of entries) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) walk(rel, acc);
    else if (SCAN.test(e.name)) acc.push(rel);
  }
  return acc;
}

const hits = [];
for (const d of DIRS) for (const f of walk(d)) {
  let lines = [];
  try { lines = readFileSync(join(ROOT, f), "utf8").split(/\r?\n/); } catch { continue; }
  lines.forEach((line, i) => {
    for (const rx of DENY) if (rx.test(line)) { hits.push(`${f}:${i + 1}  ${line.trim().slice(0, 90)}  [${rx}]`); break; }
  });
}

if (hits.length) {
  console.error("FAIL: project noun(s) found in the agnostic framework (backflow — Governance §14):");
  for (const h of hits) console.error("  " + h);
  console.error(`no-backflow: ${hits.length} violation(s). The framework must name no project; generalize and strip the noun.`);
  process.exit(1);
}
console.log("no-backflow: OK — the clean-room framework names no project.");
process.exit(0);
