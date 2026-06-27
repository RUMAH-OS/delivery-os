#!/usr/bin/env node
// Delivery OS — check-hook-paths (v1). FAIL-CLOSED hook/tool reference integrity lint.
//
// EARNED FROM: the founder-action-package MODULE_NOT_FOUND incident (2026-06-27). A skill
// named its spine tools by a path that, resolved against the skill's OWN base dir, pointed at
// a file that does not exist (…/.claude/skills/<skill>/templates/tools/boundary-classify.mjs).
// The tools were never missing — they were MISREFERENCED. validate-skills.mjs checks frontmatter
// FORMAT but never proves a referenced `.mjs` actually RESOLVES + LOADS. This gate closes that hole:
// a governance/review hook or a skill tool reference that cannot be found, or cannot `node --check`,
// can never reach production again.
//
//   node check-hook-paths.mjs            # scan this repo (cwd); exit 1 if any reference is broken
//   node check-hook-paths.mjs --json     # machine-readable rows
//   node check-hook-paths.mjs --self-test# prove the checker FAILS on a broken ref / PASSES on a good one
//
// CANONICAL CONVENTION it enforces (the one true resolution rule):
//   Every hook/tool reference is REPO-ROOT-relative — resolved from the delivery-os root
//   (= $CLAUDE_PROJECT_DIR, the cwd for every hook/tool invocation), NEVER from a skill's own dir.
//   Tools live at templates/tools/<x>.mjs (source of truth), mirrored to .claude/tools (partial),
//   hooks at .claude/hooks/<x>.mjs, vendored CI tools at .claude/os/tools/<x>.mjs.
//   A reference is one of: (a) an explicit repo-root path; (b) a `<tools>/` portable placeholder;
//   (c) a bare tool basename that resolves against a canonical tool dir (or the owning skill's dir
//   for the co-location convention, e.g. skills/parity-oracle/parity.mjs). A bare filename that
//   resolves NOWHERE, an explicit path that does not exist, or a file that fails `node --check` FAILS.

import { readFileSync, readdirSync, existsSync, statSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

// Canonical tool homes, in resolution order (repo-root-relative).
const TOOL_DIRS = [".claude/hooks", ".claude/tools", ".claude/os/tools", "templates/tools", "scripts"];

// Runtime spawns: tools that other governance tools resolve at RUNTIME via a fallback chain
// (not via a literal `node <path>` in settings/SKILL.md). They must exist somewhere canonical
// + load, else the hook that spawns them MODULE_NOT_FOUNDs at the worst possible moment.
const RUNTIME_SPAWNS = [
  { base: "review-trigger.mjs",  why: ".claude/hooks/verify-gate.mjs spawns it (review-class trigger, §14)" },
  { base: "learning-trigger.mjs", why: "review-trigger.mjs imports level() from it (L2 classifier)" },
];

// Reference extractors.
const RE_NODE = /\bnode\s+(?:-\S+\s+)*["'`]?([^\s"'`|)]+\.mjs)/g;            // `node [flags] <path>.mjs`
const RE_TOOLPATH = /(?:templates\/tools|\.claude\/(?:tools|hooks|os\/tools))\/[\w.+-]+\.mjs/g; // explicit framework tool/hook path

function nodeCheck(p) {
  const r = spawnSync(process.execPath, ["--check", p], { encoding: "utf8" });
  return r.status === 0;
}

// Resolve a single reference string. owningDir is the skill dir (repo-root-relative) when the
// reference comes from a SKILL.md, enabling the co-location convention.
function resolveRef(root, ref, owningDir) {
  const base = ref.split("/").pop();
  if (ref.includes("<")) { // portable placeholder, e.g. <tools>/verify-fingerprint.mjs
    for (const d of TOOL_DIRS) { const p = join(root, d, base); if (existsSync(p)) return { kind: "placeholder", path: p, exists: true }; }
    return { kind: "placeholder", path: join(root, TOOL_DIRS[0], base), exists: false };
  }
  if (ref.includes("/")) { // explicit repo-root path — must exist at that exact path
    const p = join(root, ref);
    return { kind: "explicit-path", path: p, exists: existsSync(p) };
  }
  // bare filename — resolve against the owning skill dir (co-location) then canonical tool dirs
  const dirs = owningDir ? [owningDir, ...TOOL_DIRS] : TOOL_DIRS;
  for (const d of dirs) { const p = join(root, d, base); if (existsSync(p)) return { kind: "bare", path: p, exists: true }; }
  return { kind: "bare", path: join(root, dirs[0], base), exists: false };
}

function extract(text) {
  const refs = new Set();
  for (const m of text.matchAll(RE_NODE)) refs.add(m[1]);
  for (const m of text.matchAll(RE_TOOLPATH)) refs.add(m[0]);
  return [...refs];
}

function walkSkillFiles(root, dir, out) {
  const abs = join(root, dir);
  if (!existsSync(abs)) return;
  for (const e of readdirSync(abs)) {
    if (e.startsWith(".") || e.startsWith("_")) continue;
    const childRel = `${dir}/${e}`;
    const childAbs = join(root, childRel);
    if (statSync(childAbs).isDirectory()) walkSkillFiles(root, childRel, out);
    else if (e === "SKILL.md") out.push(childRel);
  }
}

// Core scan — returns { rows, failures }. Threaded on `root` so --self-test can drive a temp tree.
function scan(root) {
  const rows = [];
  const seen = new Set();
  const add = (source, ref, owningDir) => {
    const key = `${source}|${ref}`;
    if (seen.has(key)) return;
    seen.add(key);
    const r = resolveRef(root, ref, owningDir);
    const loads = r.exists ? nodeCheck(r.path) : false;
    const ok = r.exists && loads;
    rows.push({ source, ref, kind: r.kind, exists: r.exists, loads, status: ok ? "OK" : "FAIL" });
  };

  // 1) live hook surface: settings + the committed pre-push (NOT templates/githooks — that is a
  //    consumer-layout template, validated when installed, not in this repo's tree).
  for (const f of [".claude/settings.json", ".githooks/pre-push"]) {
    const abs = join(root, f);
    if (existsSync(abs)) for (const ref of extract(readFileSync(abs, "utf8"))) add(f, ref, null);
  }

  // 2) every SKILL.md under skills/ and .claude/skills/ — owningDir enables co-location.
  const skillFiles = [];
  walkSkillFiles(root, "skills", skillFiles);
  walkSkillFiles(root, ".claude/skills", skillFiles);
  for (const f of skillFiles) {
    const owningDir = dirname(f);
    for (const ref of extract(readFileSync(join(root, f), "utf8"))) add(f, ref, owningDir);
  }

  // 3) runtime spawn chains — resolved via fallback dirs (found-somewhere + loads).
  for (const s of RUNTIME_SPAWNS) {
    const key = `runtime-spawn|${s.base}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const r = resolveRef(root, s.base, null);
    const loads = r.exists ? nodeCheck(r.path) : false;
    rows.push({ source: `runtime-spawn (${s.why})`, ref: s.base, kind: "runtime-spawn", exists: r.exists, loads, status: r.exists && loads ? "OK" : "FAIL" });
  }

  const failures = rows.filter((r) => r.status === "FAIL");
  return { rows, failures };
}

function printTable(rows) {
  const w = (s, n) => String(s).padEnd(n).slice(0, n);
  console.log(`  ${w("STATUS", 6)} ${w("EXISTS", 6)} ${w("LOADS", 5)} ${w("KIND", 13)} REFERENCE  <-  SOURCE`);
  for (const r of rows) {
    console.log(`  ${w(r.status, 6)} ${w(r.exists ? "Y" : "N", 6)} ${w(r.loads ? "Y" : "N", 5)} ${w(r.kind, 13)} ${r.ref}  <-  ${r.source}`);
  }
}

// ── --self-test: build a temp repo with good + deliberately-broken references and assert
//    the checker flags exactly the broken ones (incl. the founder-action-package nested-path class).
function selfTest() {
  const root = mkdtempSync(join(tmpdir(), "check-hook-paths-"));
  const W = (rel, body) => { mkdirSync(join(root, dirname(rel)), { recursive: true }); writeFileSync(join(root, rel), body); };
  try {
    W("templates/tools/good.mjs", "export const x = 1;\n");
    W("templates/tools/broken.mjs", "export const = ;\n"); // syntax error -> node --check fails
    W(".claude/skills/s-explicit-ok/SKILL.md", "run `node templates/tools/good.mjs`\n");
    W(".claude/skills/s-bare-ok/SKILL.md", "run `node good.mjs`\n");                 // bare -> resolves in templates/tools
    W(".claude/skills/s-missing/SKILL.md", "run `node templates/tools/missing.mjs`\n");
    W(".claude/skills/s-broken/SKILL.md", "run `node templates/tools/broken.mjs`\n");
    W(".claude/skills/s-bare-bad/SKILL.md", "run `node nonexistent-bare.mjs`\n");
    // the EXACT founder-action-package class: a path that only resolves under the skill's own dir
    W(".claude/skills/s-nested/SKILL.md", "run `node .claude/skills/s-nested/templates/tools/good.mjs`\n");
    // co-location convention: a tool sitting next to its SKILL.md, referenced bare
    W("skills/s-colocated/parity.mjs", "export const y = 2;\n");
    W("skills/s-colocated/SKILL.md", "run `node parity.mjs`\n");

    const { rows, failures } = scan(root);
    const failRefs = new Set(failures.map((f) => `${f.source}|${f.ref}`));
    const must = (cond, msg) => { if (!cond) { console.error(`  self-test FAIL: ${msg}`); throw new Error(msg); } };

    must(failRefs.has(".claude/skills/s-missing/SKILL.md|templates/tools/missing.mjs"), "missing tool not flagged");
    must(failRefs.has(".claude/skills/s-broken/SKILL.md|templates/tools/broken.mjs"), "node --check failure not flagged");
    must(failRefs.has(".claude/skills/s-bare-bad/SKILL.md|nonexistent-bare.mjs"), "unresolvable bare ref not flagged");
    must(failRefs.has(".claude/skills/s-nested/SKILL.md|.claude/skills/s-nested/templates/tools/good.mjs"), "skill-relative nested path (the FAP class) not flagged");
    const okRow = (src, ref) => rows.find((r) => r.source === src && r.ref === ref && r.status === "OK");
    must(okRow(".claude/skills/s-explicit-ok/SKILL.md", "templates/tools/good.mjs"), "valid explicit ref wrongly flagged");
    must(okRow(".claude/skills/s-bare-ok/SKILL.md", "good.mjs"), "valid bare->tooldir ref wrongly flagged");
    must(okRow("skills/s-colocated/SKILL.md", "parity.mjs"), "valid co-located ref wrongly flagged");
    // Count only fixture (SKILL.md) failures — the RUNTIME_SPAWNS legitimately fail in the
    // bare temp tree (no review-/learning-trigger present), which itself proves the spawn check bites.
    const skillFailures = failures.filter((f) => f.kind !== "runtime-spawn");
    must(skillFailures.length === 4, `expected exactly 4 skill-ref failures, got ${skillFailures.length}`);
    must(failures.some((f) => f.kind === "runtime-spawn"), "runtime-spawn check did not fire on a tree missing the spawned tools");

    console.log("  self-test PASS: flags missing + broken + unresolvable-bare + skill-relative-nested; passes valid explicit/bare/co-located.");
    return 0;
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

// ── main ──
const argv = process.argv.slice(2);
if (argv.includes("--self-test")) {
  process.exit(selfTest());
}

const { rows, failures } = scan(process.cwd());
if (argv.includes("--json")) {
  console.log(JSON.stringify({ rows, failures: failures.length }, null, 2));
  process.exit(failures.length ? 1 : 0);
}

printTable(rows);
console.log(`\ncheck-hook-paths: ${rows.length} reference(s) — ${failures.length} broken — ${failures.length ? "FAILED (fail-closed)" : "PASSED"}`);
if (failures.length) {
  console.log("\nBroken references (each would MODULE_NOT_FOUND or fail to load at runtime):");
  for (const f of failures) console.log(`  - ${f.ref}  (${f.exists ? "exists but node --check FAILED" : "does not resolve to any canonical location"})  <- ${f.source}`);
}
process.exit(failures.length ? 1 : 0);
