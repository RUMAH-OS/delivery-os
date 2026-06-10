#!/usr/bin/env node
// Delivery OS — base+overlay sync (the consume primitive).
// Copies the COPIED-BASE (agnostic OS files) into .claude/, then re-applies the
// LOCAL-OVERLAY so a consumer's specialization SURVIVES a framework version bump.
// Overlays live in .claude/overlay/{agents,skills}/<name>.md and are merged as a
// delimited block the base copy never overwrites. Run at scaffold and on every bump.
//
//   node scripts/os-sync.mjs            # self-sync (framework is its own consumer)
//
// Base+overlay is the answer to: "regenerate on bump must not clobber PLOS's qa-tester."

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";

const ROOT = process.cwd();
const OPEN = "<!-- LOCAL-OVERLAY (survives version bumps; edit in .claude/overlay/) -->";
const CLOSE = "<!-- /LOCAL-OVERLAY -->";
const AGENTS = ["software-engineer", "qa-test", "reviewer-critic", "lead-architect", "documentation"];

function osVersion() {
  try { return execSync("git describe --tags --always", { encoding: "utf8" }).trim(); }
  catch { return "untagged"; }
}
function ensure(p) { mkdirSync(dirname(p), { recursive: true }); }
function read(p) { try { return readFileSync(p, "utf8"); } catch { return null; } }

function mergeOne(baseFile, overlayFile, outFile) {
  const base = read(baseFile);
  if (base == null) return { skipped: true };
  const overlay = read(overlayFile);
  let out = base;
  if (overlay != null) {
    out = base.replace(/\s*$/, "") + `\n\n${OPEN}\n${overlay.replace(/\s*$/, "")}\n${CLOSE}\n`;
  }
  ensure(outFile);
  writeFileSync(outFile, out);
  return { merged: overlay != null };
}

let merged = 0, copied = 0;
for (const a of AGENTS) {
  const r = mergeOne(join(ROOT, "agents", `${a}.md`),
                     join(ROOT, ".claude", "overlay", "agents", `${a}.md`),
                     join(ROOT, ".claude", "agents", `${a}.md`));
  if (r.merged) merged++; else if (!r.skipped) copied++;
}

// stamp the OS version the consumer is now on (the version boundary)
const statePath = join(ROOT, ".claude", ".verify-state.json");
let state = {}; try { state = JSON.parse(readFileSync(statePath, "utf8")); } catch {}
state.os_version = osVersion();
writeFileSync(statePath, JSON.stringify(state));

console.log(`os-sync: copied ${copied} base + re-applied ${merged} overlay → .claude/agents/ (os_version=${state.os_version})`);
