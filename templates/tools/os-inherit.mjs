#!/usr/bin/env node
// =============================================================================
// Delivery OS — os-inherit (the OS UPGRADE PATH for skills + tools). Zero-dep.
// =============================================================================
// The capability chain ends at "Every Project Inherits". os-sync already propagates
// AGENTS (base+overlay). This propagates the OS-FOUNDATIONAL tools, contracts, and
// skills listed in capabilities/os-foundation.manifest.json INTO a consuming project —
// VENDORED (byte-for-byte) so the project is self-contained (the gates run in its CI
// without the OS mounted), and DRIFT-CHECKED so the inherited copy can never silently
// diverge from canonical. A capability is only complete when this carries it.
//
//   node os-inherit.mjs sync  --from <delivery-os> --into <project>   # vendor + record
//   node os-inherit.mjs check --from <delivery-os> --into <project>   # fail-closed drift gate
//
// Vendored layout in the project:
//   .claude/os/tools/<basename>      <- tools + contracts (flat, byte-identical)
//   .claude/skills/<name>/           <- OS-foundational skills (whole dir)
//   .claude/os/INHERITED.json        <- {osVersion, manifestVersion, files:[{rel, sha256}]}
// =============================================================================

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync, rmSync } from "node:fs";
import { join, dirname, basename, relative } from "node:path";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";

const argv = process.argv.slice(2);
const mode = argv[0];
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const FROM = opt("--from", join(process.cwd(), "..", "delivery-os")); // OS canonical source
const INTO = opt("--into", process.cwd()); // the consuming project

const sha = (buf) => createHash("sha256").update(buf).digest("hex");
const read = (p) => readFileSync(p);
const ensureDir = (p) => mkdirSync(p, { recursive: true });
function osVersion(repo) {
  try { return execSync("git describe --tags --always", { cwd: repo, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); }
  catch { return "untagged"; }
}
function listFiles(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) listFiles(p, out); else out.push(p);
  }
  return out;
}

function loadManifest() {
  const mp = join(FROM, "capabilities", "os-foundation.manifest.json");
  if (!existsSync(mp)) fail(2, `manifest not found at ${mp} (is --from a delivery-os checkout?)`);
  return JSON.parse(readFileSync(mp, "utf8"));
}
function fail(code, msg) { console.error(`os-inherit: ${msg}`); process.exit(code); }

// Resolve the manifest into concrete (sourceAbsPath, vendorRelPath) pairs.
function plan(man) {
  const items = [];
  for (const t of [...(man.tools || []), ...(man.contracts || [])]) {
    items.push({ src: join(FROM, t), rel: join(".claude", "os", "tools", basename(t)) });
  }
  for (const s of man.skills || []) {
    const sdir = join(FROM, ".claude", "skills", s);
    if (!existsSync(sdir)) fail(2, `manifest skill "${s}" not found at ${sdir}`);
    for (const f of listFiles(sdir)) items.push({ src: f, rel: join(".claude", "skills", s, relative(sdir, f)) });
  }
  return items;
}

function doSync(man) {
  const items = plan(man);
  const records = [];
  for (const it of items) {
    if (!existsSync(it.src)) fail(2, `manifest source missing: ${it.src}`);
    const buf = read(it.src);
    const dest = join(INTO, it.rel);
    ensureDir(dirname(dest));
    writeFileSync(dest, buf); // byte-for-byte — exact, so `check` is exact
    records.push({ rel: it.rel.replace(/\\/g, "/"), sha256: sha(buf) });
  }
  const inh = {
    osVersion: osVersion(FROM), manifestVersion: man.manifestVersion,
    note: "VENDORED from delivery-os via os-inherit. Do NOT hand-edit these files; re-run `os-inherit sync`. `os-inherit check` fails if they drift from canonical.",
    files: records.sort((a, b) => a.rel.localeCompare(b.rel)),
  };
  ensureDir(join(INTO, ".claude", "os"));
  writeFileSync(join(INTO, ".claude", "os", "INHERITED.json"), JSON.stringify(inh, null, 2) + "\n");
  console.error(`os-inherit sync · OS ${inh.osVersion} · vendored ${records.length} file(s) into ${INTO}`);
  for (const r of records) console.error(`  + ${r.rel}`);
  console.error(`agents (${(man.agents || []).join(", ")}) propagate via os-sync (base+overlay) — run that separately.`);
}

function doCheck(man) {
  const items = plan(man);
  const violations = [];
  for (const it of items) {
    const dest = join(INTO, it.rel);
    if (!existsSync(dest)) { violations.push(`MISSING: ${it.rel} (run \`os-inherit sync\` — project has not inherited this capability)`); continue; }
    if (sha(read(dest)) !== sha(read(it.src))) violations.push(`DRIFT: ${it.rel} differs from canonical (re-sync, or stop hand-editing a vendored OS capability)`);
  }
  console.error(`os-inherit check · OS ${osVersion(FROM)} · ${items.length} inherited file(s)`);
  if (violations.length === 0) { console.error(`PASS: every inherited capability is byte-current with the OS.`); process.exit(0); }
  console.error(`FAIL: ${violations.length} inheritance violation(s):`);
  for (const v of violations) console.error(`  - ${v}`);
  process.exit(1);
}

const man = loadManifest();
if (mode === "sync") doSync(man);
else if (mode === "check") doCheck(man);
else fail(2, `usage: os-inherit.mjs <sync|check> --from <delivery-os> --into <project>`);
