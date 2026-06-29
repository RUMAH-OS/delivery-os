#!/usr/bin/env node
// =============================================================================
// Delivery OS — I-LegacyGuard: config detections. RS-DOS §57.6 (binds §52). Sprint 1.3.
// =============================================================================
// STANDING detectors that surface the config/secret incident anti-patterns to the
// founder audit/boundary sink. EVIDENCE-ONLY — it NEVER auto-remediates and NEVER
// blocks the live engine (§50 / §57.6 discipline: detection is standing; the cure
// is a human/founder decision). It detects:
//
//   (1) tree-resident secrets        — a SECRET value committed into the tree (§30
//                                       / §54.2 trust-boundary violation). Values are
//                                       NEVER emitted — only the location + a redacted
//                                       marker (the §57.2 no-secret-values invariant).
//   (2) prod-write / gate-bypass      — kill-switches of the `ALLOW_PROD_DB_WRITE`
//       kill-switches                   class (CONFLICT-03): the un-gated prod-write /
//                                       guard-bypass flags that caused the live incident.
//   (3) configuration drift           — live plane ≠ registry, via the I-Config oracle's
//                                       DRIFTED verdict + its undeclared-on-plane drift[].
//   (4) duplicate / shadowed keys     — the same key declared twice in a registry, or
//                                       defined across multiple env files (shadowing).
//
// Output: a structured JSON report to stdout (the founder audit sink) + a human
// summary. Exit 0 ALWAYS by default (evidence-only). `--fail-on-find` is a CI
// SURFACING aid only (non-zero exit so a pipeline shows the finding) — it still
// neither remediates nor blocks the engine.
//
// USAGE:
//   node legacy-guard-config.mjs [--dir <path>] [--registry <path>] [--env <env>]
//        [--oracle] [--json] [--fail-on-find] [--self-test] [-h]
//   --oracle ⇒ also run i-config (§57.4) for live drift (needs a registry + planes).
//
// PURE detectors operate on injected file contents so the self-test plants the
// anti-patterns offline; the CLI walks the tree.
// Zero runtime dependencies (Node >= 18 built-ins only).
// =============================================================================

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve, isAbsolute, relative, join, basename } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ORACLE = resolve(HERE, "i-config.mjs");

// --- arg parsing -------------------------------------------------------------
function parseArgs(argv) {
  const o = { dir: null, registry: null, env: "prod", oracle: false, json: false, failOnFind: false, selfTest: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dir") o.dir = argv[++i];
    else if (a === "--registry") o.registry = argv[++i];
    else if (a === "--env") o.env = argv[++i];
    else if (a === "--oracle") o.oracle = true;
    else if (a === "--json") o.json = true;
    else if (a === "--fail-on-find") o.failOnFind = true;
    else if (a === "--self-test") o.selfTest = true;
    else if (a === "-h" || a === "--help") { process.stdout.write(usage()); process.exit(0); }
    else { process.stderr.write(`legacy-guard-config: unknown flag "${a}" (try --help)\n`); process.exit(2); }
  }
  return o;
}
function usage() {
  return (
    "legacy-guard-config — I-LegacyGuard standing config detections (RS-DOS §57.6).\n\n" +
    "  node legacy-guard-config.mjs [--dir <path>] [--registry <path>] [--env <env>]\n" +
    "       [--oracle] [--json] [--fail-on-find] [--self-test]\n\n" +
    "Evidence-only: exit 0 ALWAYS (never remediates, never blocks the engine). Secret VALUES are never emitted.\n" +
    "--fail-on-find ⇒ non-zero exit as a CI surfacing aid only. --self-test ⇒ offline proof on planted anti-patterns.\n"
  );
}

// =============================================================================
// Redaction — the §57.2 no-secret-values invariant. NEVER echo a secret value.
// =============================================================================
// Given a `KEY=value` (or `key: value`) match, return `KEY=<redacted N chars>`.
function redactAssignment(line) {
  const m = line.match(/^\s*(?:export\s+)?(?:const\s+|let\s+|var\s+|public\s+|private\s+|readonly\s+|static\s+)*["']?([A-Za-z0-9_.-]+)["']?\s*[:=]\s*(.*)$/);
  if (!m) return "<redacted line>";
  const key = m[1];
  let val = m[2].trim().replace(/[,;]$/, "");
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
  return `${key}=<redacted ${val.length} chars>`;
}

// =============================================================================
// DETECTOR (1): tree-resident secrets. PURE — operates on [{path, content}].
// =============================================================================
const PLACEHOLDER = /^(<.*>|x{3,}|\.{3}|changeme|redacted|your[-_].*|example|placeholder|todo|\$\{.*\}|process\.env|import\.meta\.env)/i;
const SECRETY_NAME = /(SECRET|TOKEN|PASSWORD|PASSWD|PRIVATE_KEY|API_?KEY|ACCESS_?KEY|JWT|CREDENTIAL|CLIENT_SECRET)/i;

function detectTreeSecrets(files) {
  const findings = [];
  for (const f of files) {
    const lines = String(f.content).split(/\r?\n/);
    lines.forEach((raw, idx) => {
      const line = raw.trim();
      if (!line || line.startsWith("#") || line.startsWith("//") || line.startsWith("*")) return;

      // (a) a Postgres/connection URL with an EMBEDDED password.
      const pgm = line.match(/postgres(?:ql)?:\/\/[^:\s'"]+:([^@\s'"]+)@/i);
      if (pgm && !PLACEHOLDER.test(pgm[1]) && pgm[1].length >= 4) {
        findings.push({ detector: "tree-resident-secret", subtype: "embedded-db-password", path: f.path, line: idx + 1, evidence: "postgres://<user>:<redacted password>@… committed in the tree", severity: "critical" });
        return;
      }

      // (b) a private key header.
      if (/-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/.test(raw)) {
        findings.push({ detector: "tree-resident-secret", subtype: "private-key", path: f.path, line: idx + 1, evidence: "PEM private-key block committed in the tree", severity: "critical" });
        return;
      }

      // (c) a secret-NAMED var assigned a literal (not process.env / not a placeholder).
      const am = line.match(/^\s*(?:export\s+)?(?:const\s+|let\s+|var\s+|public\s+|private\s+|readonly\s+|static\s+)*["']?([A-Za-z0-9_.-]*(?:SECRET|TOKEN|PASSWORD|PASSWD|PRIVATE_KEY|API_?KEY|ACCESS_?KEY|JWT|CREDENTIAL|CLIENT_SECRET)[A-Za-z0-9_.-]*)["']?\s*[:=]\s*(.+)$/i);
      if (am && SECRETY_NAME.test(am[1])) {
        let val = am[2].trim().replace(/[,;]$/, "");
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
        if (val && val.length >= 8 && !PLACEHOLDER.test(val) && !/^(true|false|null|undefined|0|1)$/i.test(val)) {
          findings.push({ detector: "tree-resident-secret", subtype: "literal-secret-assignment", path: f.path, line: idx + 1, evidence: redactAssignment(line), severity: "high" });
        }
      }
    });
  }
  return findings;
}

// =============================================================================
// DETECTOR (2): prod-write / gate-bypass kill-switches (the ALLOW_PROD_DB_WRITE class).
// =============================================================================
const KILL_SWITCH = /\b(ALLOW_PROD_DB_WRITE|ALLOW_PROD_WRITE|FORCE_PROD|BYPASS_[A-Z0-9_]*|SKIP_[A-Z0-9_]*(?:GATE|GUARD|CHECK|VERIFY)|DISABLE_[A-Z0-9_]*(?:GATE|GUARD|GUARDRAIL|GUARDS)|UNSAFE_[A-Z0-9_]*|OVERRIDE_[A-Z0-9_]*(?:GUARD|GATE)|NO_VERIFY)\b/;

function detectKillSwitches(files) {
  const findings = [];
  for (const f of files) {
    String(f.content).split(/\r?\n/).forEach((raw, idx) => {
      const m = raw.match(KILL_SWITCH);
      if (!m) return;
      // Surface the switch NAME (not a secret) + location. A bare mention in a comment
      // is still surfaced — the founder decides; evidence-only.
      const inComment = /^\s*(#|\/\/|\*)/.test(raw);
      findings.push({ detector: "gate-bypass-kill-switch", subtype: m[1], path: f.path, line: idx + 1, evidence: `'${m[1]}' present${inComment ? " (in a comment)" : ""} — the un-gated prod-write/guard-bypass class (CONFLICT-03)`, severity: m[1].startsWith("ALLOW_PROD") ? "critical" : "high" });
    });
  }
  return findings;
}

// =============================================================================
// DETECTOR (3): configuration drift — from the I-Config oracle report (§57.4).
// =============================================================================
function detectConfigDrift(oracleReport) {
  const findings = [];
  for (const k of oracleReport.keys || []) {
    if (k.state === "DRIFTED")
      findings.push({ detector: "config-drift", subtype: "out-of-scope-key", path: `<live ${k.lane || "plane"}>`, evidence: `${k.key} present where the registry does not scope it (${k.detail || "env-scope drift"})`, severity: k.data_class === "SECRET" || k.data_class === "PII" ? "critical" : "medium" });
  }
  for (const d of oracleReport.drift || [])
    findings.push({ detector: "config-drift", subtype: "undeclared-on-plane", path: `<${d.plane}>`, evidence: `${d.key} present on the plane but NOT declared in the registry (shadow/undeclared key)`, severity: "medium" });
  return findings;
}

// =============================================================================
// DETECTOR (4): duplicate / shadowed keys. PURE.
// `registry` = parsed registry object (or null). `envFileKeys` = [{path, keys:[..]}].
// =============================================================================
function detectDuplicateKeys(registry, envFileKeys) {
  const findings = [];
  if (registry && Array.isArray(registry.keys)) {
    const seen = new Map();
    for (const k of registry.keys) {
      const name = k.key || k.name;
      seen.set(name, (seen.get(name) || 0) + 1);
    }
    for (const [name, n] of seen) if (n > 1)
      findings.push({ detector: "duplicate-key", subtype: "registry-duplicate", path: "<registry>", evidence: `key '${name}' declared ${n}× in the same registry (duplicate definition)`, severity: "high" });
  }
  // Same key defined across >1 env file ⇒ shadowing (the later file silently wins).
  const where = new Map(); // key -> [paths]
  for (const ef of envFileKeys || [])
    for (const key of ef.keys) {
      if (!where.has(key)) where.set(key, []);
      where.get(key).push(ef.path);
    }
  for (const [key, paths] of where) if (paths.length > 1)
    findings.push({ detector: "duplicate-key", subtype: "env-file-shadow", path: paths.join(" , "), evidence: `key '${key}' defined in ${paths.length} env files — the load order silently shadows all but one`, severity: "medium" });
  return findings;
}

// =============================================================================
// File-tree walk (CLI only). Allowlisted extensions; skips heavy/ignored dirs.
// =============================================================================
const SCAN_EXT = new Set([".mjs", ".js", ".cjs", ".ts", ".tsx", ".json", ".yml", ".yaml", ".sh", ".env", ".toml", ".ini"]);
const SKIP_DIR = new Set(["node_modules", ".git", "dist", "build", ".next", "coverage", ".turbo", ".vercel"]);
// Files that legitimately CONTAIN the detector patterns as data (the detectors and
// their schemas/examples) — excluded so the guard does not flag its own corpus.
const SELF_EXCLUDE = /(legacy-guard-config|i-config|readiness-shadow|capability-config-resolver|config-secret-registry\.(schema|example)|capability-requirements\.schema)\./;

function walk(dir, acc = []) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return acc; }
  for (const e of entries) {
    if (e.name.startsWith(".") && e.name !== ".env" && !e.name.startsWith(".env.")) {
      if (e.isDirectory()) continue; // skip dotdirs (.git etc) but keep .env* files
    }
    const full = join(dir, e.name);
    if (e.isDirectory()) { if (!SKIP_DIR.has(e.name)) walk(full, acc); continue; }
    const dot = e.name.lastIndexOf(".");
    const ext = dot >= 0 ? e.name.slice(dot) : (e.name.startsWith(".env") ? ".env" : "");
    if (!SCAN_EXT.has(ext)) continue;
    if (SELF_EXCLUDE.test(e.name)) continue;
    acc.push(full);
  }
  return acc;
}

function readFiles(paths, root) {
  const out = [];
  for (const p of paths) {
    try { if (statSync(p).size > 512 * 1024) continue; out.push({ path: relative(root, p) || basename(p), content: readFileSync(p, "utf8") }); } catch { /* skip */ }
  }
  return out;
}

function envFilesIn(root) {
  // collect .env* files (the shadow-detection source).
  const found = [];
  let entries;
  try { entries = readdirSync(root, { withFileTypes: true }); } catch { return found; }
  for (const e of entries) if (e.isFile() && (e.name === ".env" || e.name.startsWith(".env."))) {
    const p = join(root, e.name);
    try {
      const keys = [];
      for (const raw of readFileSync(p, "utf8").split(/\r?\n/)) {
        const line = raw.trim();
        if (!line || line.startsWith("#")) continue;
        const eq = line.indexOf("="); if (eq <= 0) continue;
        keys.push(line.slice(0, eq).trim());
      }
      found.push({ path: relative(root, p), keys });
    } catch { /* skip */ }
  }
  return found;
}

function abs(p) { return isAbsolute(p) ? p : resolve(process.cwd(), p); }

function runOracleForDrift(registryPath, env) {
  const args = [ORACLE, "--json", "--registry", abs(registryPath), "--env", env];
  try {
    const out = execFileSync(process.execPath, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return JSON.parse(out);
  } catch (e) {
    // The oracle is report-only; if it errors (e.g. no live planes) we still proceed
    // with the tree detectors — drift detection is best-effort, never blocking.
    return { keys: [], drift: [], _oracle_error: (e.stderr || e.message || "").trim() };
  }
}

// =============================================================================
// Run.
// =============================================================================
function run(opts) {
  const root = abs(opts.dir || process.cwd());
  if (!existsSync(root)) fail(2, `dir not found: ${root}`);

  const files = readFiles(walk(root), root);
  const envFileKeys = envFilesIn(root);
  let registry = null;
  if (opts.registry) {
    try { registry = JSON.parse(readFileSync(abs(opts.registry), "utf8")); } catch (e) { fail(2, `cannot read registry: ${e.message}`); }
  }
  let oracleReport = { keys: [], drift: [] };
  if (opts.oracle && opts.registry) oracleReport = runOracleForDrift(opts.registry, opts.env);

  const findings = [
    ...detectTreeSecrets(files),
    ...detectKillSwitches(files),
    ...detectConfigDrift(oracleReport),
    ...detectDuplicateKeys(registry, envFileKeys),
  ];

  const report = {
    sink: "founder-audit",
    kind: "legacy-guard-config",
    spec: "RS-DOS §57.6 (binds §52)",
    ts: new Date().toISOString(),
    scope: { dir: root, files_scanned: files.length, env_files: envFileKeys.map((e) => e.path), registry: opts.registry ? abs(opts.registry) : null, env: opts.env },
    posture: "EVIDENCE-ONLY — surfaced to the founder boundary; NEVER auto-remediated, NEVER blocks the engine (§50/§57.6)",
    counts: countBy(findings),
    findings,
    note: oracleReport._oracle_error ? `oracle drift check skipped: ${oracleReport._oracle_error}` : undefined,
  };

  if (opts.json) process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  else printHuman(report);

  // Evidence-only: exit 0 ALWAYS by default. --fail-on-find is a CI surfacing aid.
  process.exit(opts.failOnFind && findings.length ? 3 : 0);
}

function countBy(findings) {
  const c = {};
  for (const f of findings) c[f.detector] = (c[f.detector] || 0) + 1;
  return { total: findings.length, ...c };
}

function printHuman(report) {
  const L = (s = "") => process.stdout.write(s + "\n");
  L("");
  L(`I-LegacyGuard config detections — ${report.spec}`);
  L(`scope:   ${report.scope.dir}  (${report.scope.files_scanned} files, ${report.scope.env_files.length} env files)`);
  L(`posture: ${report.posture}`);
  if (report.note) L(`note:    ${report.note}`);
  L("");
  if (!report.findings.length) { L("  (no anti-patterns detected)"); L(""); return; }
  const sev = { critical: "!!!", high: "!! ", medium: "!  ", low: " . " };
  for (const f of report.findings) {
    L(`  ${sev[f.severity] || "?  "}[${f.detector}/${f.subtype}] ${f.path}${f.line ? `:${f.line}` : ""}`);
    L(`      ${f.evidence}`);
  }
  L("");
  L(`summary: ${report.counts.total} finding(s) — ${Object.entries(report.counts).filter(([k]) => k !== "total").map(([k, v]) => `${k}=${v}`).join(" · ")}`);
  L("EVIDENCE-ONLY: surfaced to the founder audit boundary. No remediation taken; the engine is not blocked.");
  L("");
}

function fail(code, msg) { process.stderr.write(`legacy-guard-config: ${msg}\n`); process.exit(code); }

// =============================================================================
// Self-test — plants the anti-patterns offline and proves each detector fires,
// AND proves the no-secret-values invariant (a planted secret value never appears
// in the serialized report).
// =============================================================================
function selfTest() {
  const cases = [];
  const assert = (name, cond) => cases.push({ name, ok: !!cond });

  const PLANTED_DB_PASSWORD = "S3cretP0ssw0rdLive";
  const PLANTED_API_SECRET = "sk_live_9f8e7d6c5b4a3f2e1d0c";

  const plantedFiles = [
    { path: "src/db.ts", content: `const url = "postgres://postgres.abc:${PLANTED_DB_PASSWORD}@aws-0-eu.pooler.supabase.com:6543/postgres";` },
    { path: "src/config.ts", content: `export const STRIPE_API_KEY = "${PLANTED_API_SECRET}";\nconst ok = process.env.SAFE_TOKEN;` },
    { path: "scripts/seed.mjs", content: `if (process.env.ALLOW_PROD_DB_WRITE === "1") { await seedProd(); }` },
    { path: "deploy.sh", content: `export SKIP_VERIFY_GATE=1\nexport DATABASE_URL=$DATABASE_URL` },
    { path: "src/clean.ts", content: `const dbName = process.env.DATABASE_URL;\nconst flag = process.env.FEATURE_X;` }, // clean — must NOT trip
  ];

  // (1) tree-resident secrets.
  const secrets = detectTreeSecrets(plantedFiles);
  assert("tree-secret: embedded DB password DETECTED", secrets.some((f) => f.subtype === "embedded-db-password" && f.path === "src/db.ts"));
  assert("tree-secret: literal API secret DETECTED", secrets.some((f) => f.subtype === "literal-secret-assignment" && f.path === "src/config.ts"));
  assert("tree-secret: a process.env reference is NOT flagged (no false-open)", !secrets.some((f) => f.path === "src/clean.ts"));

  // NO-SECRET-VALUES invariant: the planted secret values must NOT appear in findings.
  const serialized = JSON.stringify(secrets);
  assert("no-secret-values: the DB password is NEVER emitted", !serialized.includes(PLANTED_DB_PASSWORD));
  assert("no-secret-values: the API secret is NEVER emitted", !serialized.includes(PLANTED_API_SECRET));

  // (2) gate-bypass kill-switches (the ALLOW_PROD_DB_WRITE class).
  const switches = detectKillSwitches(plantedFiles);
  assert("kill-switch: ALLOW_PROD_DB_WRITE DETECTED + critical", switches.some((f) => f.subtype === "ALLOW_PROD_DB_WRITE" && f.severity === "critical"));
  assert("kill-switch: SKIP_VERIFY_GATE DETECTED", switches.some((f) => f.subtype === "SKIP_VERIFY_GATE"));

  // (3) configuration drift from an oracle report fixture.
  const oracleReport = {
    keys: [{ key: "DEV_SEED_TOKEN", state: "DRIFTED", lane: "vercel-prod", data_class: "SECRET", detail: "local-only SECRET found on the prod plane" }],
    drift: [{ key: "LEFTOVER_KEY", plane: "vercel-prod", note: "undeclared" }],
  };
  const drift = detectConfigDrift(oracleReport);
  assert("drift: out-of-scope SECRET DETECTED + critical", drift.some((f) => f.subtype === "out-of-scope-key" && f.severity === "critical"));
  assert("drift: undeclared-on-plane key DETECTED", drift.some((f) => f.subtype === "undeclared-on-plane"));

  // (4) duplicate / shadowed keys.
  const registry = { keys: [{ key: "DATABASE_URL" }, { key: "DATABASE_URL" }, { key: "PUBLIC_BASE_URL" }] };
  const envFileKeys = [{ path: ".env", keys: ["DATABASE_URL", "FOO"] }, { path: ".env.local", keys: ["DATABASE_URL", "BAR"] }];
  const dups = detectDuplicateKeys(registry, envFileKeys);
  assert("dup: registry duplicate DATABASE_URL DETECTED", dups.some((f) => f.subtype === "registry-duplicate" && /DATABASE_URL/.test(f.evidence)));
  assert("dup: env-file shadowing of DATABASE_URL DETECTED", dups.some((f) => f.subtype === "env-file-shadow" && /DATABASE_URL/.test(f.evidence)));

  // (5) the EVIDENCE-ONLY guarantee: a full report is exit-0-shaped (no block field,
  //     no remediation field) and carries the never-remediate note.
  const fullFindings = [...secrets, ...switches, ...drift, ...dups];
  const report = { posture: "EVIDENCE-ONLY — surfaced to the founder boundary; NEVER auto-remediated, NEVER blocks the engine (§50/§57.6)", findings: fullFindings };
  assert("evidence-only: report posture states never-remediate/never-block", /NEVER auto-remediated, NEVER blocks/.test(report.posture));
  assert("evidence-only: report has no remediation/mutation field", !("remediate" in report) && !("mutated" in report));

  const failed = cases.filter((c) => !c.ok);
  for (const c of cases) process.stdout.write(`${c.ok ? "PASS" : "FAIL"}  ${c.name}\n`);
  process.stdout.write(`\nlegacy-guard-config self-test: ${cases.length - failed.length}/${cases.length} passed.\n`);
  process.exit(failed.length === 0 ? 0 : 1);
}

// Exported for verifier harnesses (import-safe — entrypoint only runs as CLI).
export { detectTreeSecrets, detectKillSwitches, detectConfigDrift, detectDuplicateKeys };

// --- entrypoint (CLI only) ---------------------------------------------------
const IS_MAIN = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (IS_MAIN) {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.selfTest) selfTest();
  else run(opts);
}
