#!/usr/bin/env node
// =============================================================================
// Governance Engine — RESIDENCY INVARIANT guard (the legacy-guard-style detector for the package boundary).
// =============================================================================
// The one-line invariant that keeps the extraction TRUE (PLATFORM-EXTRACTION-BLUEPRINT-2026-06-29 §6):
//
//   > No file under templates/governance-engine/ may import `./db/client.js`, the `postgres` driver, or
//   > `execFileSync` a relative-path tool. Every durable read/write, probe read and config read crosses an
//   > injected port. A push that adds such an import fails the gate.
//
// This is the governance analogue of the C11 engine's already-proven rule (the engine never imports a DB
// client; it takes EngineContext.db). It is fail-CLOSED for the gate: exit 0 = clean, exit 1 = a violation
// (so a pre-push / CI hook blocks a regression). `--self-test` proves each detector fires on planted offenders.
//
// Zero runtime dependencies (Node >= 18 built-ins only).
//
// USAGE:  node residency-guard.mjs [--dir <path>] [--json] [--self-test]
// =============================================================================

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, relative, resolve, isAbsolute, basename } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));

// Forbidden import/usage patterns (each is a residency violation). PURE: matched against file contents.
const FORBIDDEN = [
  {
    id: "db-client-import",
    // any import of a `db/client` module (the admin durable-store coupling).
    re: /(?:import\s+[^;]*?from\s*|require\s*\(\s*)["'][^"']*\bdb\/client(?:\.js|\.ts)?["']/,
    why: "imports a concrete db/client — durable I/O must cross an injected port, not a DB module",
  },
  {
    id: "postgres-driver-import",
    // the `postgres` driver (or `pg`) — the SQL plane must live in the consumer adapter.
    re: /(?:import\s+[^;]*?from\s*|require\s*\(\s*)["'](?:postgres|pg)["']/,
    why: "imports the postgres/pg driver — the SQL plane belongs to the consumer adapter, never the package",
  },
  {
    id: "execfile-relative-tool",
    // execFileSync/execSync/spawnSync shelling a relative-path tool (the i-config / infra coupling).
    re: /\b(?:execFileSync|execSync|spawnSync|exec)\s*\([^)]*?["'][.]{1,2}\//,
    why: "execFileSync/spawn of a relative-path tool — plane wiring belongs to the consumer, not the package",
  },
];

const SCAN_EXT = new Set([".ts", ".tsx", ".mts", ".cts", ".js", ".mjs", ".cjs"]);
// `adapters/` is the SANCTIONED consumer-side exception: it holds the reference Postgres adapter — the consumer
// plane that DOES import the `postgres` driver and issue the raw SQL (the `pg_advisory_xact_lock`, the CAS UPDATEs)
// that the organs only ever reach through an injected port. The residency invariant guards the ENGINE ORGAN
// SURFACE (every other dir here), not the consumer adapter, so `adapters/` is excluded from the scan by design
// (PLATFORM-EXTRACTION-BLUEPRINT-2026-06-29 §6 — the adapter is the consumer's, never the package's). A consumer
// copies/adapts it; it is shipped as a reference, outside the boundary the guard enforces.
const SKIP_DIR = new Set(["node_modules", ".git", "dist", "build", "adapters"]);
// the guard scans its own SOURCE patterns as data — exclude itself so it does not flag its own regexes.
const SELF_EXCLUDE = /residency-guard\.mjs$/;

function walk(dir, acc = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      if (!SKIP_DIR.has(e.name) && !e.name.startsWith(".")) walk(full, acc);
      continue;
    }
    const dot = e.name.lastIndexOf(".");
    const ext = dot >= 0 ? e.name.slice(dot) : "";
    if (!SCAN_EXT.has(ext)) continue;
    if (SELF_EXCLUDE.test(e.name)) continue;
    acc.push(full);
  }
  return acc;
}

// PURE detector — operates on [{path, content}] so the self-test can plant offenders offline.
export function detectResidencyViolations(files) {
  const findings = [];
  for (const f of files) {
    const lines = String(f.content).split(/\r?\n/);
    lines.forEach((raw, idx) => {
      const line = raw.trim();
      if (!line || line.startsWith("//") || line.startsWith("*") || line.startsWith("#")) return; // skip comments
      for (const rule of FORBIDDEN) {
        if (rule.re.test(raw)) {
          findings.push({ rule: rule.id, why: rule.why, path: f.path, line: idx + 1, evidence: line.slice(0, 160) });
        }
      }
    });
  }
  return findings;
}

function abs(p) {
  return isAbsolute(p) ? p : resolve(process.cwd(), p);
}

function run(opts) {
  const root = abs(opts.dir || HERE);
  if (!existsSync(root)) {
    process.stderr.write(`residency-guard: dir not found: ${root}\n`);
    process.exit(2);
  }
  const files = [];
  for (const p of walk(root)) {
    try {
      if (statSync(p).size > 512 * 1024) continue;
      files.push({ path: relative(root, p) || basename(p), content: readFileSync(p, "utf8") });
    } catch {
      /* skip */
    }
  }
  const findings = detectResidencyViolations(files);
  const report = {
    kind: "governance-engine-residency-guard",
    invariant: "no ./db/client.js · no postgres/pg driver · no execFileSync of a relative tool",
    scope: { dir: root, files_scanned: files.length },
    findings,
    verdict: findings.length === 0 ? "CLEAN" : "VIOLATION",
  };
  if (opts.json) process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  else {
    process.stdout.write(`\ngovernance-engine residency guard — ${report.invariant}\n`);
    process.stdout.write(`scope: ${root}  (${files.length} files)\n\n`);
    if (!findings.length) process.stdout.write("  CLEAN — no residency violations.\n\n");
    else {
      for (const f of findings) process.stdout.write(`  !!! [${f.rule}] ${f.path}:${f.line}\n      ${f.why}\n      ${f.evidence}\n`);
      process.stdout.write(`\n  VIOLATION — ${findings.length} residency offender(s). The package must cross an injected port.\n\n`);
    }
  }
  // FAIL-CLOSED for the gate: non-zero exit on any violation (a push/CI hook blocks the regression).
  process.exit(findings.length === 0 ? 0 : 1);
}

function selfTest() {
  const cases = [];
  const assert = (name, cond) => cases.push({ name, ok: !!cond });

  const planted = [
    { path: "organ-bad-1.ts", content: `import { sql } from "./db/client.js";\nconst x = 1;` },
    { path: "organ-bad-2.ts", content: `import postgres from "postgres";` },
    { path: "organ-bad-3.ts", content: `const out = execFileSync(process.execPath, ["../infra/i-config.mjs"]);` },
    { path: "organ-good.ts", content: `import type { GoalContractStorePort } from "./ports.js";\nconst flag = process.env.SAFE;` },
    { path: "comment-only.ts", content: `// this file mentions ./db/client.js in a comment only — must NOT trip` },
  ];
  const f = detectResidencyViolations(planted);
  assert("detects ./db/client.js import", f.some((x) => x.rule === "db-client-import" && x.path === "organ-bad-1.ts"));
  assert("detects postgres driver import", f.some((x) => x.rule === "postgres-driver-import" && x.path === "organ-bad-2.ts"));
  assert("detects execFileSync of a relative tool", f.some((x) => x.rule === "execfile-relative-tool" && x.path === "organ-bad-3.ts"));
  assert("does NOT flag a clean port-only organ", !f.some((x) => x.path === "organ-good.ts"));
  assert("does NOT flag a comment mention", !f.some((x) => x.path === "comment-only.ts"));

  const failed = cases.filter((c) => !c.ok);
  for (const c of cases) process.stdout.write(`${c.ok ? "PASS" : "FAIL"}  ${c.name}\n`);
  process.stdout.write(`\nresidency-guard self-test: ${cases.length - failed.length}/${cases.length} passed.\n`);
  process.exit(failed.length === 0 ? 0 : 1);
}

const IS_MAIN = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (IS_MAIN) {
  const argv = process.argv.slice(2);
  const opts = { dir: null, json: false, selfTest: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dir") opts.dir = argv[++i];
    else if (a === "--json") opts.json = true;
    else if (a === "--self-test") opts.selfTest = true;
    else if (a === "-h" || a === "--help") {
      process.stdout.write("residency-guard — governance-engine residency invariant\n  node residency-guard.mjs [--dir <path>] [--json] [--self-test]\n");
      process.exit(0);
    }
  }
  if (opts.selfTest) selfTest();
  else run(opts);
}
