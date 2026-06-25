#!/usr/bin/env node
// =============================================================================
// Delivery OS — verify-coverage-ci (SERVER-SIDE coverage gate, board 2026-06-25).
// The CI complement to the local pre-push hook: on a PR it PROVES that a fresh,
// independently-authored VERIFY semantically covers EVERY changed implementation
// file. This is the binding floor moved from the local hook to the PR/merge.
//
// It is a thin CI WRAPPER around the canonical semantic core — it REUSES (never
// rebuilds) `verify-fingerprint.mjs::verifyCoversImpl(fm, changedImplRel, root)`,
// so coverage is SEMANTIC (a behavioral change → not covered; comments/whitespace
// → still covered), never mtime-based. Fail-closed throughout: a missing field,
// an unparseable VERIFY, an unreadable file, or any error → NOT covered.
//
// USAGE
//   node verify-coverage-ci.mjs --base <ref> [--root DIR] [--json]
//       → diffs <base>..HEAD, selects changed IMPL files, and checks that every one
//         is covered by some `verify_status: verified` VERIFY's impl_fingerprint.
//         Exit 0 = all covered; exit 1 = at least one uncovered (files listed).
//   node verify-coverage-ci.mjs --self-test
//
// Zero external deps — node builtins + the vendored verify-fingerprint helper only.
// =============================================================================

import { existsSync, readFileSync, readdirSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

// ── resolve + load the canonical semantic core (vendored-path aware) ────────────
// Consumers vendor this beside verify-fingerprint.mjs at `.claude/os/tools/`; the OS
// repo runs it from `templates/tools/`. Try the declared consumer path first, then the
// OS path, then a sibling import (correct in BOTH layouts). Fail-closed if none exist.
function resolveFingerprint(root) {
  const candidates = [
    join(root, ".claude", "os", "tools", "verify-fingerprint.mjs"),
    join(root, "templates", "tools", "verify-fingerprint.mjs"),
    join(HERE, "verify-fingerprint.mjs"),
  ];
  return candidates.find((c) => existsSync(c)) || null;
}
async function loadFingerprint(root) {
  const p = resolveFingerprint(root);
  if (!p) throw new Error("verify-fingerprint.mjs not found (.claude/os/tools/ or templates/tools/) — run `os-inherit sync`. Fail-closed.");
  return import(pathToFileURL(p).href);
}

// ── impl-file selection — MIRRORS verify-fingerprint.mjs (the canonical surface) ─
// Kept byte-identical to verify-fingerprint.mjs's IMPL_BASE / NONIMPL / impl_extra.
// If that surface changes, update both (the OS drift-check guards the manifest pair).
const IMPL_BASE = /^(src|app|lib|api|migrations|db)\/|^(apps|packages|services)\/[^/]+\//;
const NONIMPL = /(^|\/)(tests?|e2e|evals|docs|\.claude|node_modules|dist|build|\.next|out|coverage)\/|\.(test|spec)\.|\.md$/;
function implExtra(root) {
  try { const c = JSON.parse(readFileSync(join(root, ".claude", ".verify-config.json"), "utf8")); return Array.isArray(c.impl_extra) ? c.impl_extra : []; }
  catch { return []; }
}
const isImpl = (f, extra) => IMPL_BASE.test(f) || extra.some((p) => f.startsWith(p));

// ── minimal scalar frontmatter parser (VERIFY needs only scalar keys) ───────────
// Captures `key: value` scalars verbatim (quote-stripped). impl_fingerprint is a
// one-line JSON string left RAW for verifyCoversImpl to JSON.parse (fail-closed).
function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return {};
  const out = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!kv) continue;
    let v = kv[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[kv[1]] = v;
  }
  return out;
}

// ── git: changed impl files for <base>..HEAD ────────────────────────────────────
function git(args, root) {
  try { return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); }
  catch { return ""; }
}
export function changedImplFiles(base, root) {
  const range = base ? [`${base}`, "HEAD"] : ["HEAD"];
  const out = git(["diff", "--name-only", ...range], root);
  const extra = implExtra(root);
  return out.split("\n").map((l) => l.trim()).filter(Boolean)
    .filter((f) => isImpl(f, extra) && !NONIMPL.test(f));
}

// ── list verified VERIFY docs ───────────────────────────────────────────────────
function listVerifies(root) {
  const dir = join(root, "docs", "verify");
  let names = [];
  try { names = readdirSync(dir).filter((n) => /^VERIFY-.*\.md$/.test(n)); }
  catch { return []; }
  const out = [];
  for (const n of names) {
    let fm;
    try { fm = parseFrontmatter(readFileSync(join(dir, n), "utf8")); } catch { continue; }
    out.push({ path: `docs/verify/${n}`, fm });
  }
  return out;
}

// ── the coverage computation (pure-ish: reads disk, no git) ──────────────────────
// A changed impl file is COVERED iff at least one `verify_status: verified` VERIFY's
// recorded impl_fingerprint still matches it (semantic, via verifyCoversImpl). PASS
// iff every changed impl file is covered. Also surfaces the contributing VERIFYs'
// machine_probe commands so the workflow can re-run them on the clean runner.
export async function computeCoverage({ root, changedImpl }) {
  const { verifyCoversImpl } = await loadFingerprint(root);
  const verifies = listVerifies(root);
  const verified = verifies.filter((v) => String(v.fm.verify_status || "").trim().toLowerCase() === "verified");

  const coveredBy = new Map(); // file -> [verify paths]
  const contributors = [];     // { verify, machine_probe, covers[] }
  for (const v of verified) {
    const res = verifyCoversImpl(v.fm, changedImpl, root);
    const covers = changedImpl.filter((f) => !res.uncovered.includes(f));
    if (covers.length) {
      for (const f of covers) {
        if (!coveredBy.has(f)) coveredBy.set(f, []);
        coveredBy.get(f).push(v.path);
      }
      contributors.push({
        verify: v.path,
        machine_probe: typeof v.fm.machine_probe === "string" ? v.fm.machine_probe : null,
        covers,
      });
    }
  }
  const uncovered = changedImpl.filter((f) => !coveredBy.has(f));
  const machine_probes = [...new Set(contributors.map((c) => c.machine_probe).filter(Boolean))];
  return {
    ok: uncovered.length === 0,
    changedImpl,
    uncovered,
    contributors,
    machine_probes,
    verifiedCount: verified.length,
    verifyCount: verifies.length,
  };
}

// ── CLI ─────────────────────────────────────────────────────────────────────────
function flag(argv, name) { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; }

async function runCli(argv) {
  const root = flag(argv, "--root") || process.cwd();
  const base = flag(argv, "--base");
  const asJson = argv.includes("--json");
  const changedImpl = changedImplFiles(base, root);

  if (changedImpl.length === 0) {
    const empty = { ok: true, changedImpl: [], uncovered: [], contributors: [], machine_probes: [], note: "no changed impl files — nothing to cover" };
    if (asJson) console.log(JSON.stringify(empty, null, 2));
    else console.error("verify-coverage: no changed implementation files in this PR — PASS (nothing to cover).");
    process.exit(0);
  }

  let report;
  try { report = await computeCoverage({ root, changedImpl }); }
  catch (e) {
    // fail-closed: any error proving coverage is a FAIL, never a silent pass.
    if (asJson) console.log(JSON.stringify({ ok: false, error: String(e && e.message || e), changedImpl, uncovered: changedImpl }, null, 2));
    else console.error(`::error::verify-coverage FAILED CLOSED: ${e && e.message || e}`);
    process.exit(1);
  }

  if (asJson) { console.log(JSON.stringify(report, null, 2)); process.exit(report.ok ? 0 : 1); }

  console.error(`verify-coverage: ${changedImpl.length} changed impl file(s); ${report.verifiedCount}/${report.verifyCount} VERIFY doc(s) are verify_status: verified.`);
  for (const c of report.contributors) console.error(`  covered by ${c.verify}${c.machine_probe ? ` (probe: ${c.machine_probe})` : " (no machine_probe!)"}: ${c.covers.join(", ")}`);
  if (report.ok) {
    console.error("verify-coverage PASS — every changed impl file is semantically covered by a verified VERIFY.");
    process.exit(0);
  }
  // GitHub annotations for each uncovered file, then a single error.
  for (const f of report.uncovered) console.error(`::error file=${f}::Not covered by any verify_status:verified VERIFY (behaviorally changed, unrecorded, or no fresh VERIFY). A fresh independent VERIFY must record this file's impl_fingerprint.`);
  console.error(`::error::verify-coverage FAIL — ${report.uncovered.length} uncovered impl file(s): ${report.uncovered.join(", ")}`);
  process.exit(1);
}

// ── self-test (deterministic; uses the REAL verify-fingerprint core, no git) ─────
async function runSelfTest() {
  const { fingerprintFiles } = await loadFingerprint(process.cwd());
  const dir = mkdtempSync(join(tmpdir(), "vcov-"));
  const w = (rel, content) => { const p = join(dir, rel); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, content); return p; };
  const results = [];
  const check = (label, pass, detail = "") => { results.push({ label, pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${label}${detail ? "  — " + detail : ""}`); };

  // impl files under an IMPL_BASE dir
  const a = "src/port.mjs";
  const b = "src/host.mjs";
  w(a, "export const port = 8787;\n");
  w(b, "export const host = \"localhost\";\n");
  const fpAll = JSON.stringify(fingerprintFiles([a, b], dir));

  // a VERIFY that is verified and records BOTH files
  w("docs/verify/VERIFY-x.md", `---\nverify_status: verified\nmachine_probe: "node src/probe.mjs --self-test"\nimpl_fingerprint: ${fpAll}\n---\n# VERIFY\n`);

  const r1 = await computeCoverage({ root: dir, changedImpl: [a, b] });
  check("1 verified VERIFY covering both files → ok=true", r1.ok === true && r1.uncovered.length === 0, r1.uncovered.join(","));
  check("1b machine_probe surfaced for the workflow to re-run", r1.machine_probes.includes("node src/probe.mjs --self-test"));

  // behavioral change to one file → that file uncovered
  writeFileSync(join(dir, b), "export const host = \"example.com\";\n");
  const r2 = await computeCoverage({ root: dir, changedImpl: [a, b] });
  check("2 behavioral change to one file → ok=false naming it", r2.ok === false && r2.uncovered.includes(b) && !r2.uncovered.includes(a), r2.uncovered.join(","));

  // restore b, but flip the VERIFY to pending → no verified coverage → all uncovered
  writeFileSync(join(dir, b), "export const host = \"localhost\";\n");
  writeFileSync(join(dir, "docs/verify/VERIFY-x.md"), `---\nverify_status: pending\nimpl_fingerprint: ${fpAll}\n---\n# VERIFY\n`);
  const r3 = await computeCoverage({ root: dir, changedImpl: [a, b] });
  check("3 VERIFY not verify_status:verified → not counted (both uncovered, fail-closed)", r3.ok === false && r3.uncovered.length === 2);

  // a VERIFY with no impl_fingerprint (legacy) → does not cover
  writeFileSync(join(dir, "docs/verify/VERIFY-x.md"), `---\nverify_status: verified\nmachine_probe: "x"\n---\n# legacy\n`);
  const r4 = await computeCoverage({ root: dir, changedImpl: [a] });
  check("4 verified VERIFY missing impl_fingerprint (legacy) → uncovered (fail-closed)", r4.ok === false && r4.uncovered.includes(a));

  // impl-glob mirror: a non-impl path (docs/.md, tests) is excluded by changedImplFiles' filter
  check("5 isImpl: src/x.mjs is impl, tests/x.test.mjs + docs/y.md are not",
    isImpl("src/x.mjs", []) && !NONIMPL.test("src/x.mjs") &&
    NONIMPL.test("tests/x.test.mjs") && NONIMPL.test("docs/y.md"));

  rmSync(dir, { recursive: true, force: true });
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  if (failed.length) { console.error(`SELF-TEST FAILED: ${failed.map((f) => f.label).join("; ")}`); process.exit(1); }
  console.log("SELF-TEST OK — semantic coverage gate is fail-closed (verified-only, fingerprint-matched, probe-surfaced).");
  process.exit(0);
}

// ── entrypoint ───────────────────────────────────────────────────────────────────
const isMain = (() => { try { return pathToFileURL(process.argv[1]).href === import.meta.url; } catch { return false; } })();
if (isMain) {
  const argv = process.argv.slice(2);
  if (argv.includes("--self-test")) runSelfTest();
  else runCli(argv);
}
