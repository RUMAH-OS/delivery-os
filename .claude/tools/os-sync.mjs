#!/usr/bin/env node
// Delivery OS — base+overlay sync (the consume primitive).
// Builds the live .claude/agents/<name>.md by MERGING the pristine OS base
// (.claude/base/agents/, copied at scaffold/bump time, NEVER hand-edited) with the
// consumer's LOCAL-OVERLAY (.claude/overlay/agents/, NEVER clobbered) — so a project's
// specialization SURVIVES a framework version bump. Self-contained: the base is cached in
// .claude/base/, so a bump = re-copy base → re-run this; the OS need not stay mounted.
// Also stamps the OS version the consumer is on (the version boundary).
//
//   node .claude/tools/os-sync.mjs
//
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";

const ROOT = process.cwd();
const OPEN = "<!-- LOCAL-OVERLAY (survives version bumps; edit in .claude/overlay/) -->";
const CLOSE = "<!-- /LOCAL-OVERLAY -->";
const baseDir = join(ROOT, ".claude", "base", "agents");
const overlayDir = join(ROOT, ".claude", "overlay", "agents");
const outDir = join(ROOT, ".claude", "agents");

const read = (p) => { try { return readFileSync(p, "utf8"); } catch { return null; } };
const ensure = (p) => mkdirSync(dirname(p), { recursive: true });
function osVersion() {
  try { return execSync("git describe --tags --always", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); }
  catch { return "untagged"; }
}

let bases = [];
try { bases = readdirSync(baseDir).filter((f) => f.endsWith(".md")); } catch {}
let merged = 0, copied = 0;
for (const f of bases) {
  const base = read(join(baseDir, f));
  if (base == null) continue;
  const overlay = read(join(overlayDir, f));
  let out = base;
  if (overlay != null) out = base.replace(/\s*$/, "") + `\n\n${OPEN}\n${overlay.replace(/\s*$/, "")}\n${CLOSE}\n`;
  const o = join(outDir, f); ensure(o); writeFileSync(o, out);
  if (overlay != null) merged++; else copied++;
}

const statePath = join(ROOT, ".claude", ".verify-state.json");
let state = {}; try { state = JSON.parse(readFileSync(statePath, "utf8")); } catch {}
state.os_version = osVersion();
ensure(statePath); writeFileSync(statePath, JSON.stringify(state));

console.log(`os-sync: ${copied} base + ${merged} overlay → .claude/agents/ (os_version=${state.os_version})`);
if (!bases.length) console.error("os-sync: WARN — .claude/base/agents/ is empty; nothing to sync (did the scaffolder cache the base?)");
