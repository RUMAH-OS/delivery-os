// =============================================================================
// THE ZERO-ADMIN-IMPORT SCAN — the load-bearing artifact of the terminal proof.
// =============================================================================
// Starts at the finance consumer's ENTRY files (run-finance-os.ts + src/**), follows EVERY import edge
// transitively, resolves each to a concrete file, and CLASSIFIES it:
//   * consumer-domain  — the consumer's own finance code (run file + src/**)
//   * platform-engine  — the vendored Delivery OS governance-engine (vendor/governance-engine/**)
//   * node-builtin     — a `node:` standard-library import
//   * EXTERNAL/UNRESOLVED — a bare specifier (must be NONE for a self-contained proof)
// and HARD-FAILS if ANY resolved file — or ANY import specifier anywhere in the reachable graph — references
// `rumah-admin`, `property-lead-os`, `@plos`, or a sibling-app source path. This is the whole point: it proves
// the consumer transitively imports NOTHING from another app's Runtime — only the platform + its own domain.
//
// Run:  node scripts/scan-zero-admin-imports.mjs   ·   exit 0 = clean (zero admin imports) · 1 = a violation.

import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { dirname, resolve, relative, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, ".."); // examples/finance-os-demo
const ENGINE = resolve(ROOT, "vendor/governance-engine");

// The forbidden tokens: any import that reaches another app's Runtime fails the proof.
const FORBIDDEN = [/rumah-admin/i, /property-lead-os/i, /@plos\b/i, /[\\/]plos[\\/]/i];

// ── entry files: the consumer's own surface (NOT the vendored engine — we discover that by following edges). ──
function listTs(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...listTs(p));
    else if (e.name.endsWith(".ts")) out.push(p);
  }
  return out;
}
const rootRunFiles = readdirSync(ROOT)
  .filter((n) => n.endsWith(".ts"))
  .map((n) => resolve(ROOT, n));
const entries = [...rootRunFiles, ...listTs(resolve(ROOT, "src"))];

// ── import-specifier extraction (static `import`/`export ... from "..."` only). ──
const IMPORT_RE = /(?:import|export)\s[^;]*?from\s*["']([^"']+)["']/g;
const SIDE_EFFECT_RE = /import\s*["']([^"']+)["']/g;
function stripComments(src) {
  // remove block comments then line comments so comment PROSE (e.g. the words `from "postgres"`) is never
  // mistaken for a real import edge. (String-literal edge cases are irrelevant here — import specifiers are.)
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");
}
function specifiers(file) {
  const src = stripComments(readFileSync(file, "utf8"));
  const specs = [];
  let m;
  while ((m = IMPORT_RE.exec(src))) specs.push(m[1]);
  while ((m = SIDE_EFFECT_RE.exec(src))) specs.push(m[1]);
  return specs;
}

// ── resolve a relative specifier (ESM `.js`) → a concrete `.ts` file on disk. ──
function resolveSpec(spec, fromFile) {
  if (spec.startsWith("node:")) return { kind: "node-builtin", file: spec };
  if (!spec.startsWith(".")) return { kind: "external", file: spec }; // a bare specifier — must be none
  const base = resolve(dirname(fromFile), spec);
  const candidates = [
    base,
    base.replace(/\.js$/, ".ts"),
    base.replace(/\.js$/, ".tsx"),
    base + ".ts",
    join(base, "index.ts"),
  ];
  for (const c of candidates) {
    if (existsSync(c) && statSync(c).isFile()) return { kind: "file", file: c };
  }
  return { kind: "unresolved", file: base };
}

function classify(file) {
  const rel = relative(ROOT, file);
  if (file.startsWith(ENGINE)) return "platform-engine";
  if (rel.startsWith("..")) return "OUTSIDE-CONSUMER"; // reached a file outside this consumer dir
  return "consumer-domain";
}

// ── transitive walk ──
const seen = new Set();
const graph = []; // { file, classification }
const externals = [];
const violations = [];

function walk(file) {
  if (seen.has(file)) return;
  seen.add(file);
  const cls = classify(file);
  graph.push({ file, cls });
  for (const f of FORBIDDEN) {
    if (f.test(file)) violations.push({ where: relative(ROOT, file), reason: `resolved file path matches ${f}` });
  }
  for (const spec of specifiers(file)) {
    for (const f of FORBIDDEN) {
      if (f.test(spec)) violations.push({ where: relative(ROOT, file), reason: `import specifier "${spec}" matches ${f}` });
    }
    const r = resolveSpec(spec, file);
    if (r.kind === "file") walk(r.file);
    else if (r.kind === "external") externals.push({ from: relative(ROOT, file), spec });
    else if (r.kind === "unresolved") externals.push({ from: relative(ROOT, file), spec: spec + " (UNRESOLVED)" });
    // node-builtin: terminal, allowed.
  }
}

console.log("─".repeat(96));
console.log("ZERO-ADMIN-IMPORT SCAN — transitive import graph of the finance-os-demo consumer");
console.log("─".repeat(96));
console.log("entry files:");
for (const e of entries) console.log("  " + relative(ROOT, e));
for (const e of entries) walk(e);

const byClass = graph.reduce((acc, g) => ((acc[g.cls] = (acc[g.cls] || 0) + 1), acc), {});
console.log("\nreachable files by classification:");
for (const [k, v] of Object.entries(byClass).sort()) console.log(`  ${k.padEnd(18)} ${v}`);

console.log(`\nconsumer-domain files (the consumer's OWN code):`);
for (const g of graph.filter((g) => g.cls === "consumer-domain")) console.log("  " + relative(ROOT, g.file));

console.log(`\nplatform-engine files reached (the vendored Delivery OS governance-engine): ${byClass["platform-engine"] || 0}`);

// node builtins seen across the graph (informational).
const nodeBuiltins = new Set();
for (const g of graph) for (const s of specifiers(g.file)) if (s.startsWith("node:")) nodeBuiltins.add(s);
console.log(`node builtins used (terminal, allowed): ${[...nodeBuiltins].sort().join(", ") || "(none)"}`);

// ── the verdict ──
console.log("\n" + "─".repeat(96));
const externalBad = externals.filter((e) => !e.spec.startsWith("node:"));
let ok = true;

if (violations.length) {
  ok = false;
  console.log(`FAIL: ${violations.length} ADMIN/SIBLING-APP reference(s) found in the reachable graph:`);
  for (const v of violations) console.log(`  - ${v.where}: ${v.reason}`);
} else {
  console.log("PASS: ZERO references to rumah-admin / property-lead-os / @plos anywhere in the reachable graph.");
}

if (externalBad.length) {
  ok = false;
  console.log(`FAIL: ${externalBad.length} bare/unresolved (non-node) import(s) — a self-contained proof must have none:`);
  for (const e of externalBad) console.log(`  - ${e.from} → "${e.spec}"`);
} else {
  console.log("PASS: the consumer + the vendored engine import NOTHING outside themselves (only node: builtins).");
}

const outside = graph.filter((g) => g.cls === "OUTSIDE-CONSUMER");
if (outside.length) {
  ok = false;
  console.log(`FAIL: ${outside.length} reachable file(s) live OUTSIDE the consumer dir (unexpected):`);
  for (const g of outside) console.log("  - " + g.file);
}

console.log("─".repeat(96));
if (ok) {
  console.log("VERDICT: CLEAN — finance-os-demo transitively imports ONLY the vendored platform engine + its own");
  console.log("         finance domain. ZERO rumah-admin / property-lead-os Runtime imports. The consumer is");
  console.log("         independent: delete rumah-admin and this consumer still has the entire Runtime.");
} else {
  console.log("VERDICT: VIOLATION — the consumer is NOT independent (see FAIL lines above).");
}
process.exit(ok ? 0 : 1);
