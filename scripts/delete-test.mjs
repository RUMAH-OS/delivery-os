#!/usr/bin/env node
// =============================================================================
// Delivery OS — the standing DELETE TEST (the corrected, inward twin of the consumer-independence proof).
// =============================================================================
// Deletes an ADAPTER subsystem in a throwaway `git worktree` and asserts the REAL Core still builds and the
// REAL Core self-tests still pass with the adapter gone. The boundary held BY CONSTRUCTION iff both stay green.
//
// CHALLENGE FIX (WAVE1-CHALLENGE Attack 3c): the prior design's oracle ran `finance:proof` against
// examples/finance-os-demo/vendor/governance-engine — a vendored, adapter-FREE copy that is GREEN no matter
// what is deleted from templates/. That oracle was decoupled from the subject under test. This oracle instead:
//   (a) `tsc --noEmit` over the REAL templates/governance-engine (config.deleteTest.coreTsconfig), AND
//   (b) runs the REAL templates/governance-engine self-tests (config.deleteTest.coreSelfTests) via tsx,
// BOTH against the post-deletion worktree. They import the real organs, so a Core organ that illegitimately
// imported the deleted adapter WOULD fail them. `--prove-oracle` demonstrates exactly that (plants a
// Core->adapter import, deletes the adapter, asserts the test goes RED — proving the oracle has teeth).
//
// Materialization: a THROWAWAY COPY of the live working tree's layer roots (NOT `git worktree add HEAD` —
// templates/governance-engine is currently UNTRACKED, so a worktree at HEAD would not contain the Core under
// test). The copy is isolated (the live tree is never mutated) and faithful (it exercises exactly what is on
// disk now, committed or not). Once the Core is committed a worktree would work identically; the mechanism is
// swappable behind materializeCopy().
//
// Toolchain: the copy has no node_modules; tsc/tsx/@types are run from config.deleteTest.toolchainNodeModules
// in the MAIN checkout, pointed at the copy's sources.
//
// USAGE:
//   node scripts/delete-test.mjs                 # run every armed subsystem (absent ones SKIP-WARN)
//   node scripts/delete-test.mjs --subsystem governance-postgres-adapter
//   node scripts/delete-test.mjs --prove-oracle  # prove the oracle FAILS on a planted Core->adapter import
//
// exit 0 = all assertions held (or oracle correctly failed) · 1 = a Core build/self-test broke · 2 = setup error.
// =============================================================================

import { readFileSync, writeFileSync, existsSync, rmSync, mkdirSync, cpSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const toPosix = (p) => p.replace(/\\/g, "/");

function stripJsonComments(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");
}
function loadConfig() {
  const cfg = JSON.parse(readFileSync(join(ROOT, "architecture.config.json"), "utf8"));
  if (!cfg.deleteTest) fail("architecture.config.json has no deleteTest section");
  return cfg;
}
function fail(msg) {
  process.stderr.write(`delete-test: ${msg}\n`);
  process.exit(2);
}
function log(s = "") {
  process.stdout.write(s + "\n");
}

// resolve the toolchain binaries from the MAIN checkout (the worktree has none).
function toolchain(cfg) {
  const nm = resolve(ROOT, cfg.deleteTest.toolchainNodeModules);
  const tsc = join(nm, "typescript", "bin", "tsc");
  const tsx = join(nm, "tsx", "dist", "cli.mjs");
  const typeRoots = join(nm, "@types");
  if (!existsSync(tsc)) fail(`tsc not found in toolchain: ${tsc} (run npm install in ${cfg.deleteTest.toolchainNodeModules})`);
  if (!existsSync(tsx)) fail(`tsx not found in toolchain: ${tsx}`);
  return { tsc, tsx, typeRoots };
}

// the top-level layer roots a subsystem run must materialize: the Core under test (from the tsconfig include
// + the self-test paths) plus the subsystem's own remove paths. Reduced to top-level (<=2-segment) roots and
// filtered to those that exist on disk now.
function copyRootsFor(sub, baseTsconfig, cfg) {
  const roots = new Set();
  const add = (p) => {
    const seg = toPosix(p).replace(/\/\*.*$/, "").split("/").filter(Boolean);
    if (seg.length) roots.add(seg.slice(0, 2).join("/"));
  };
  for (const inc of baseTsconfig.include || []) add(inc);
  for (const st of cfg.deleteTest.coreSelfTests) add(st);
  for (const r of sub.remove) add(r);
  return [...roots].filter((r) => existsSync(join(ROOT, r)));
}

// materialize a THROWAWAY COPY of the given working-tree roots into .delete-test/<id>/.
function materializeCopy(id, roots) {
  const wt = join(ROOT, ".delete-test", id);
  rmSync(wt, { recursive: true, force: true });
  mkdirSync(wt, { recursive: true });
  for (const r of roots) {
    const src = join(ROOT, r);
    const dest = join(wt, r);
    mkdirSync(dirname(dest), { recursive: true });
    cpSync(src, dest, { recursive: true, filter: (s) => !/[\\/]node_modules[\\/]?/.test(s) });
  }
  return wt;
}
function removeCopy(wt) {
  rmSync(wt, { recursive: true, force: true });
  // prune the .delete-test parent if it is now empty (leave no droppings).
  try {
    const parent = join(ROOT, ".delete-test");
    if (existsSync(parent) && readdirSync(parent).length === 0) rmSync(parent, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

function loadBaseTsconfig(cfg) {
  return JSON.parse(stripJsonComments(readFileSync(join(ROOT, cfg.deleteTest.coreTsconfig), "utf8")));
}

// run `tsc --noEmit` over the REAL Core in the copy (a derived config overrides typeRoots to the main @types).
function assertCoreBuilds(wt, tool, cfg) {
  const base = loadBaseTsconfig(cfg);
  base.compilerOptions = base.compilerOptions || {};
  base.compilerOptions.typeRoots = [toPosix(tool.typeRoots)];
  const derived = join(wt, "tsconfig.delete-test.json");
  writeFileSync(derived, JSON.stringify(base, null, 2));
  try {
    execFileSync("node", [tool.tsc, "--noEmit", "-p", "tsconfig.delete-test.json"], {
      cwd: wt,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { ok: true, detail: "tsc --noEmit -p tsconfig.core.json -> 0 errors" };
  } catch (e) {
    return { ok: false, detail: (e.stdout || "") + (e.stderr || "") || String(e) };
  }
}

// run the REAL Core self-tests in the worktree via tsx (NOT a vendored copy).
function assertSelfTests(wt, tool, cfg) {
  const results = [];
  for (const rel of cfg.deleteTest.coreSelfTests) {
    const scriptAbs = join(wt, rel);
    if (!existsSync(scriptAbs)) {
      results.push({ rel, ok: false, detail: "self-test script missing in worktree" });
      continue;
    }
    try {
      execFileSync("node", [tool.tsx, toPosix(scriptAbs)], {
        cwd: dirname(scriptAbs),
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
      results.push({ rel, ok: true });
    } catch (e) {
      results.push({ rel, ok: false, detail: ((e.stdout || "") + (e.stderr || "")).slice(-400) || String(e) });
    }
  }
  return results;
}

function removePaths(wt, paths) {
  const removed = [];
  for (const p of paths) {
    const abs = join(wt, p);
    if (existsSync(abs)) {
      rmSync(abs, { recursive: true, force: true });
      removed.push(p);
    }
  }
  return removed;
}

function liveHasAny(paths) {
  return paths.some((p) => existsSync(join(ROOT, p)));
}

// run one subsystem's delete test. returns { status: 'PASS'|'FAIL'|'SKIP', lines: [] }.
function runSubsystem(sub, tool, cfg, baseTsconfig) {
  const lines = [];
  if (!liveHasAny(sub.remove)) {
    return { status: "SKIP", lines: [`  SKIP  [${sub.id}] none of [${sub.remove.join(", ")}] exist on disk — armed, awaiting the build.`] };
  }
  const wt = materializeCopy(sub.id, copyRootsFor(sub, baseTsconfig, cfg));
  try {
    const removed = removePaths(wt, sub.remove);
    lines.push(`  removed in worktree: ${removed.join(", ")}`);
    const build = assertCoreBuilds(wt, tool, cfg);
    lines.push(`  ${build.ok ? "PASS" : "FAIL"}  (a) Core builds — ${build.ok ? build.detail : "tsc errors:\n" + indent(build.detail)}`);
    const selfTests = assertSelfTests(wt, tool, cfg);
    for (const r of selfTests) lines.push(`  ${r.ok ? "PASS" : "FAIL"}  (b) self-test ${r.rel}${r.ok ? "" : " — " + indent(r.detail)}`);
    const ok = build.ok && selfTests.every((r) => r.ok);
    return { status: ok ? "PASS" : "FAIL", lines };
  } finally {
    removeCopy(wt);
  }
}

function indent(s) {
  return String(s).split(/\r?\n/).map((l) => "        " + l).join("\n");
}

// --prove-oracle: plant a Core->adapter import, delete the adapter, assert the test goes RED (teeth proof).
function proveOracle(tool, cfg, baseTsconfig) {
  const probe = cfg.deleteTest.oracleProbe;
  if (!probe) fail("config.deleteTest.oracleProbe is not declared");
  const adapterSub = cfg.deleteTest.subsystems.find((s) => s.remove.some((r) => /adapters/.test(r)));
  if (!adapterSub) fail("no adapter subsystem with an adapters/ remove path to prove against");

  log("delete-test --prove-oracle — proving the corrected oracle has teeth (challenge Attack 3c fix)");
  log(`  planting an illegitimate Core->adapter import into ${probe.injectImportInto}:`);
  log(`    ${probe.injectImport}`);
  const wt = materializeCopy("prove-oracle", copyRootsFor(adapterSub, baseTsconfig, cfg));
  try {
    const organAbs = join(wt, probe.injectImportInto);
    if (!existsSync(organAbs)) fail(`organ to inject not found in worktree: ${probe.injectImportInto}`);
    const orig = readFileSync(organAbs, "utf8");
    writeFileSync(organAbs, probe.injectImport + "\n" + orig);
    const removed = removePaths(wt, adapterSub.remove);
    log(`  deleted the adapter the Core now illegitimately imports: ${removed.join(", ")}`);

    const build = assertCoreBuilds(wt, tool, cfg);
    const selfTests = assertSelfTests(wt, tool, cfg);
    const buildFailed = !build.ok;
    const anySelfTestFailed = selfTests.some((r) => !r.ok);

    log("");
    log(`  Core builds (expect FAIL):     ${buildFailed ? "FAILED as required (tsc cannot resolve the deleted adapter)" : "PASSED — ORACLE BLIND"}`);
    log(`  Core self-tests (expect FAIL): ${anySelfTestFailed ? "FAILED as required (organ ERR_MODULE_NOT_FOUND on the deleted adapter)" : "PASSED — ORACLE BLIND"}`);

    const oracleHasTeeth = buildFailed && anySelfTestFailed;
    log("");
    if (oracleHasTeeth) {
      log("  ORACLE VALID — the Delete Test genuinely depends on the not-deleted Core. A Core->adapter leak");
      log("  is caught both at compile time and at runtime against the REAL tree (NOT a vendored copy).");
      log("  (This is the WAVE1-CHALLENGE refutation, fixed.)");
    } else {
      log("  ORACLE BLIND — a planted Core->adapter leak did NOT turn the test red. The oracle is decoupled");
      log("  from the subject under test (the exact challenge defect). This must not ship.");
    }
    return oracleHasTeeth ? 0 : 1;
  } finally {
    removeCopy(wt);
  }
}

// ── main ──
const argv = process.argv.slice(2);
const cfg = loadConfig();
const tool = toolchain(cfg);
const baseTsconfig = loadBaseTsconfig(cfg);

if (argv.includes("--prove-oracle")) {
  process.exit(proveOracle(tool, cfg, baseTsconfig));
}

const only = argv.includes("--subsystem") ? argv[argv.indexOf("--subsystem") + 1] : null;
const subs = cfg.deleteTest.subsystems.filter((s) => !only || s.id === only);
if (!subs.length) fail(`no subsystem matched ${only || "(all)"}`);

log("\ndelete-test — the standing Delete Test (delete an adapter; assert the REAL Core still builds + self-tests pass)\n");
let anyFail = false;
let ranAny = false;
for (const sub of subs) {
  log(`[${sub.id}]`);
  const r = runSubsystem(sub, tool, cfg, baseTsconfig);
  for (const l of r.lines) log(l);
  if (r.status === "FAIL") anyFail = true;
  if (r.status !== "SKIP") ranAny = true;
  log(`  => ${r.status}\n`);
}

if (!ranAny) {
  log("delete-test: no subsystem folders present yet — all armed/skipped. (exit 0)");
  process.exit(0);
}
log(anyFail ? "delete-test: VIOLATION — a Core build/self-test broke with an adapter deleted (exit 1)" : "delete-test: CLEAN — the boundary held by construction for every present subsystem (exit 0)");
process.exit(anyFail ? 1 : 0);
