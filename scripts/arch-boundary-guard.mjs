#!/usr/bin/env node
// =============================================================================
// Delivery OS — ARCHITECTURAL-BOUNDARY guard (the repo-wide dependency-direction + infra-SDK gate).
// =============================================================================
// Generalizes templates/governance-engine/residency-guard.mjs (one folder, three forbidden patterns) into
// a CONFIG-DRIVEN, repo-wide architectural-boundary linter. The boundary is DATA (architecture.config.json);
// this script carries NO hard-coded folder names. It enforces the Repository Principle:
//
//   Dependencies flow strictly INWARD: adapter -> contract -> core, never outward.
//
// Two violation classes, one gate:
//   [direction]  a file in layer L imports (relative) a file in a layer L.mayImport forbids.
//   [infra-sdk]  a file in a denyInfraSdk layer imports a denylisted infrastructure SDK (bare specifier),
//                or matches a denylisted inline infra-call pattern (e.g. execFileSync of a relative tool).
//
// Pure detector `detectBoundaryViolations(files, config)` (no disk I/O) so the self-test plants offenders
// in memory. Fail-CLOSED: exit 0 = CLEAN, exit 1 = VIOLATION (a pre-push/CI hook blocks the regression),
// exit 2 = config/usage error. `--self-test` proves each detector fires on planted offenders + clean controls
// stay silent — so the gate's own correctness is itself gated.
//
// Zero runtime dependencies (Node >= 18 built-ins only).
//
// USAGE:  node scripts/arch-boundary-guard.mjs [--root <path>] [--config <path>] [--json] [--self-test]
// =============================================================================

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, relative, resolve, isAbsolute } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..");
const SCAN_EXT = new Set([".ts", ".tsx", ".mts", ".cts", ".js", ".mjs", ".cjs"]);

// ── path helpers (everything is POSIX-normalized so the gate behaves identically on Windows) ──────────────
const toPosix = (p) => p.replace(/\\/g, "/");
function normalizeJoin(fromFile, spec) {
  // resolve a relative specifier against the importing file's dir, collapsing . and .. — POSIX, no disk.
  const baseParts = toPosix(fromFile).split("/").slice(0, -1);
  const specParts = toPosix(spec).split("/");
  for (const part of specParts) {
    if (part === "" || part === ".") continue;
    if (part === "..") baseParts.pop();
    else baseParts.push(part);
  }
  return baseParts.join("/");
}
// strip a trailing TS/JS source extension so an ESM `.js` specifier classifies against a `.ts` source entry.
const SRC_EXT_RE = /\.(d\.ts|tsx?|jsx?|[cm][jt]s)$/;
const stripExt = (p) => toPosix(p).replace(SRC_EXT_RE, "");
// a config entry (folder prefix OR exact file) matches a path iff equal, a directory-prefix of it, or an
// extension-insensitive exact-file match (so the contract entry `ports.ts` matches a resolved `ports.js`).
function entryMatches(entry, path) {
  const e = toPosix(entry).replace(/\/+$/, "");
  const p = toPosix(path);
  if (p === e || p.startsWith(e + "/")) return true;
  if (SRC_EXT_RE.test(e) && stripExt(p) === stripExt(e)) return true;
  return false;
}

// ── classification: a file -> layer name (or null = unclassified, not gated). PURE (path-only). ──────────
// Longest matching folder/file prefix wins; a layer's own `exclude` disclaims its sub-paths (re-pinning them
// to whichever OTHER layer claims them, else unclassified).
export function classify(path, config) {
  const p = toPosix(path);
  let best = null;
  let bestLen = -1;
  for (const [name, layer] of Object.entries(config.layers)) {
    if ((layer.exclude || []).some((ex) => entryMatches(ex, p))) continue; // this layer disclaims it
    for (const folder of layer.folders) {
      if (entryMatches(folder, p)) {
        const len = toPosix(folder).replace(/\/+$/, "").length;
        if (len > bestLen) {
          best = name;
          bestLen = len;
        }
      }
    }
  }
  return best;
}

// ── specifier extraction (comments stripped first, exactly like scan-zero-admin-imports). ────────────────
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");
}
const IMPORT_FROM_RE = /(?:import|export)\s[^;]*?from\s*["']([^"']+)["']/g; // import/export ... from "x"
const SIDE_EFFECT_RE = /import\s*["']([^"']+)["']/g; //  import "x"
const REQUIRE_RE = /require\s*\(\s*["']([^"']+)["']\s*\)/g; //  require("x")
const DYNAMIC_RE = /import\s*\(\s*["']([^"']+)["']\s*\)/g; //  import("x")  (string literal only)
function extractSpecifiers(content) {
  const src = stripComments(String(content));
  const out = [];
  for (const re of [IMPORT_FROM_RE, SIDE_EFFECT_RE, REQUIRE_RE, DYNAMIC_RE]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(src))) out.push(m[1]);
  }
  return [...new Set(out)];
}
// line number of the first occurrence of a specifier (best-effort, for a precise finding).
function lineOf(content, spec) {
  const lines = String(content).split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t.startsWith("//") || t.startsWith("*")) continue;
    if (lines[i].includes(`"${spec}"`) || lines[i].includes(`'${spec}'`)) return { line: i + 1, evidence: t.slice(0, 160) };
  }
  return { line: 0, evidence: "" };
}

// ── infra-SDK denylist matching. Bare specifier -> package name (exact), or full specifier (glob). ───────
function packageName(spec) {
  if (spec.startsWith("@")) return spec.split("/").slice(0, 2).join("/"); // @scope/name
  return spec.split("/")[0];
}
function globToRe(glob) {
  return new RegExp("^" + glob.split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*") + "$");
}
function matchesDenylist(spec, denylist) {
  const pkg = packageName(spec);
  for (const entry of denylist) {
    if (entry.includes("*")) {
      if (globToRe(entry).test(spec) || globToRe(entry).test(pkg)) return entry;
    } else if (pkg === entry) {
      return entry;
    }
  }
  return null;
}

// ── THE PURE DETECTOR — operates on [{path, content}], so the self-test plants offenders offline. ────────
export function detectBoundaryViolations(files, config) {
  const findings = [];
  const denylist = config.infraSdkDenylist || [];
  const callDeny = (config.infraCallDenylist || []).map((r) => ({ ...r, re: new RegExp(r.re) }));

  for (const f of files) {
    const fromLayer = classify(f.path, config);
    if (!fromLayer) continue; // unclassified source (docs, scripts/, .claude tools) — not gated.
    const layer = config.layers[fromLayer];
    const mayImport = new Set(layer.mayImport || []);
    const content = f.content;

    for (const spec of extractSpecifiers(content)) {
      if (spec.startsWith("node:")) continue; // node builtin — always allowed
      const isRelative = spec.startsWith("./") || spec.startsWith("../") || spec === "." || spec === "..";
      if (isRelative) {
        // DIRECTION: resolve to a target path, classify, check the edge against mayImport.
        const targetPath = normalizeJoin(f.path, spec);
        const toLayer = classify(targetPath, config);
        if (!toLayer) continue; // target is unclassified (a tool/doc) — out of the boundary's scope.
        if (!mayImport.has(toLayer)) {
          const { line, evidence } = lineOf(content, spec);
          findings.push({
            kind: "direction",
            path: f.path,
            line,
            fromLayer,
            toLayer,
            rule: `${fromLayer}.mayImport = [${layer.mayImport.join(", ")}]; got edge ${fromLayer} -> ${toLayer}`,
            why:
              toLayer === "core"
                ? `${fromLayer.toUpperCase()} must reach CORE only through a CONTRACT (a port) — not a Core internal.`
                : `${fromLayer.toUpperCase()} must import nothing outward — this imports a ${toLayer.toUpperCase()} file.`,
            fix: "Depend on a CONTRACT (a port in ports.ts) and let the adapter implement it; restore core <- contracts <- adapter.",
            evidence,
          });
        }
      } else {
        // INFRA-SDK: a bare package specifier in a denyInfraSdk layer must not be a denylisted infra SDK.
        if (!layer.denyInfraSdk) continue; // adapters: SDKs legally live here.
        const hit = matchesDenylist(spec, denylist);
        if (hit) {
          const { line, evidence } = lineOf(content, spec);
          findings.push({
            kind: "infra-sdk",
            path: f.path,
            line,
            fromLayer,
            rule: `${fromLayer}.denyInfraSdk = true; matched denylist entry "${hit}"`,
            why: `${fromLayer.toUpperCase()} is infrastructure-agnostic — it may not import an infra SDK ("${spec}").`,
            fix: "Move the SDK use behind a port adapter; the Core/Contract takes the port, the adapter takes the SDK.",
            evidence,
          });
        }
      }
    }

    // INFRA-CALL: inline plane-wiring patterns (execFileSync of a relative tool) in a denyInfraSdk layer.
    if (layer.denyInfraSdk && callDeny.length) {
      const src = stripComments(content);
      src.split(/\r?\n/).forEach((raw, idx) => {
        for (const rule of callDeny) {
          if (rule.re.test(raw)) {
            findings.push({
              kind: "infra-sdk",
              path: f.path,
              line: idx + 1,
              fromLayer,
              rule: `${fromLayer}.denyInfraSdk = true; inline pattern "${rule.id}"`,
              why: rule.why,
              fix: "Move the plane call behind an adapter that implements a port; Core/Contracts take the port.",
              evidence: raw.trim().slice(0, 160),
            });
          }
        }
      });
    }
  }
  return findings;
}

// ── filesystem walk (config-driven global excludes). ─────────────────────────────────────────────────────
function isGloballyExcluded(relPath, name, config) {
  const p = toPosix(relPath);
  for (const ex of config.exclude || []) {
    const e = toPosix(ex);
    if (e.endsWith("/**")) {
      const base = e.slice(0, -3);
      if (p === base || p.startsWith(base + "/")) return true;
    } else if (e === name || p === e || p.startsWith(e + "/")) {
      return true;
    }
  }
  return false;
}
function walk(absDir, root, config, acc = []) {
  let entries;
  try {
    entries = readdirSync(absDir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of entries) {
    const full = join(absDir, e.name);
    const rel = toPosix(relative(root, full));
    if (isGloballyExcluded(rel, e.name, config)) continue;
    if (e.isDirectory()) {
      if (!e.name.startsWith(".") || e.name === ".claude" || e.name === ".githooks") {
        // skip hidden dirs except the ones that could legally hold gated source (none today, but explicit).
        if (!e.name.startsWith(".")) walk(full, root, config, acc);
      }
      continue;
    }
    const dot = e.name.lastIndexOf(".");
    const ext = dot >= 0 ? e.name.slice(dot) : "";
    if (SCAN_EXT.has(ext)) acc.push(rel);
  }
  return acc;
}

// ── config load + fail-closed schema validation (zero-dep, focused on the load-bearing shape). ───────────
function loadJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}
export function validateConfig(config, schema) {
  const errs = [];
  const req = (obj, keys, where) => keys.forEach((k) => obj[k] === undefined && errs.push(`${where}: missing required "${k}"`));
  if (typeof config !== "object" || !config) return ["config is not an object"];
  req(config, schema.required, "root");
  if (typeof config.version !== "number") errs.push("version must be a number");
  if (typeof config.layers !== "object" || !config.layers || !Object.keys(config.layers).length)
    errs.push("layers must be a non-empty object");
  const layerNames = new Set(Object.keys(config.layers || {}));
  for (const [name, layer] of Object.entries(config.layers || {})) {
    req(layer, ["folders", "mayImport", "denyInfraSdk"], `layers.${name}`);
    if (!Array.isArray(layer.folders) || !layer.folders.length) errs.push(`layers.${name}.folders must be non-empty`);
    if (!Array.isArray(layer.mayImport)) errs.push(`layers.${name}.mayImport must be an array`);
    else for (const m of layer.mayImport) if (!layerNames.has(m)) errs.push(`layers.${name}.mayImport references unknown layer "${m}"`);
    if (typeof layer.denyInfraSdk !== "boolean") errs.push(`layers.${name}.denyInfraSdk must be a boolean`);
  }
  if (!Array.isArray(config.exclude)) errs.push("exclude must be an array");
  if (!Array.isArray(config.infraSdkDenylist)) errs.push("infraSdkDenylist must be an array");
  for (const r of config.infraCallDenylist || []) {
    try {
      new RegExp(r.re);
    } catch {
      errs.push(`infraCallDenylist "${r.id}": invalid regex`);
    }
  }
  if (typeof config.deleteTest !== "object") errs.push("deleteTest must be an object");
  return errs;
}

// ── runner ────────────────────────────────────────────────────────────────────────────────────────────
function abs(p) {
  return isAbsolute(p) ? p : resolve(process.cwd(), p);
}
function run(opts) {
  const root = abs(opts.root || REPO_ROOT);
  const configPath = abs(opts.config || join(root, "architecture.config.json"));
  const schemaPath = abs(opts.schema || join(root, "architecture.schema.json"));
  if (!existsSync(configPath)) {
    process.stderr.write(`arch-boundary-guard: config not found: ${configPath}\n`);
    process.exit(2);
  }
  let config, schema;
  try {
    config = loadJson(configPath);
  } catch (e) {
    process.stderr.write(`arch-boundary-guard: config is not valid JSON (${e.message}) — fail-closed.\n`);
    process.exit(2);
  }
  try {
    schema = loadJson(schemaPath);
  } catch {
    schema = { required: ["version", "layers", "exclude", "infraSdkDenylist", "deleteTest"] };
  }
  const cfgErrs = validateConfig(config, schema);
  if (cfgErrs.length) {
    process.stderr.write(`arch-boundary-guard: INVALID config (fail-closed) —\n${cfgErrs.map((e) => "  - " + e).join("\n")}\n`);
    process.exit(2);
  }

  const relFiles = walk(root, root, config);
  const files = [];
  for (const rel of relFiles) {
    try {
      const full = join(root, rel);
      if (statSync(full).size > 1024 * 1024) continue;
      files.push({ path: rel, content: readFileSync(full, "utf8") });
    } catch {
      /* skip */
    }
  }
  const findings = detectBoundaryViolations(files, config);

  const counts = {};
  for (const f of files) {
    const l = classify(f.path, config) || "unclassified";
    counts[l] = (counts[l] || 0) + 1;
  }
  const report = {
    kind: "arch-boundary-guard",
    invariant: "dependencies flow inward: adapter -> contract -> core",
    scope: { root, files: files.length, byLayer: counts },
    findings,
    verdict: findings.length === 0 ? "CLEAN" : "VIOLATION",
  };

  if (opts.json) {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  } else {
    process.stdout.write(`\narch-boundary-guard — dependency-direction + infra-SDK over the layer map\n`);
    const byLayer = Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(", ");
    process.stdout.write(`scope: ${root}  (${files.length} files: ${byLayer})\n\n`);
    if (!findings.length) {
      process.stdout.write("  CLEAN — no boundary violations.\n\n");
    } else {
      for (const f of findings) {
        process.stdout.write(`  !!! [${f.kind}] ${f.path}:${f.line}\n      ${f.why}\n      rule: ${f.rule}\n`);
        if (f.evidence) process.stdout.write(`      offending: ${f.evidence}\n`);
        process.stdout.write(`      fix: ${f.fix}\n\n`);
      }
      process.stdout.write(`  VIOLATION — ${findings.length} boundary offender(s). Dependencies must flow inward: adapter -> contract -> core.\n\n`);
    }
  }
  process.exit(findings.length === 0 ? 0 : 1);
}

// ── self-test: plant offenders + clean controls against a synthetic config; assert each detector fires. ───
function selfTest() {
  const cfg = {
    version: 1,
    layers: {
      core: {
        folders: ["templates/governance-engine"],
        exclude: ["templates/governance-engine/ports.ts", "templates/governance-engine/metric-probe.ts", "templates/governance-engine/adapters"],
        mayImport: ["core", "contracts"],
        denyInfraSdk: true,
      },
      contracts: {
        folders: ["templates/governance-engine/ports.ts", "templates/governance-engine/metric-probe.ts"],
        mayImport: ["core", "contracts"],
        denyInfraSdk: true,
      },
      adapters: {
        folders: ["templates/governance-engine/adapters"],
        mayImport: ["contracts", "adapters"],
        denyInfraSdk: false,
      },
    },
    exclude: ["node_modules", "examples/**"],
    infraSdkDenylist: ["postgres", "pg", "dockerode", "@slack/*", "*runner*"],
    infraCallDenylist: [{ id: "execfile-relative-tool", re: "\\b(?:execFileSync|execSync|spawnSync|exec)\\s*\\([^)]*?[\"'][.]{1,2}/", why: "shelling a relative tool is plane wiring" }],
  };

  const planted = [
    // (1) direction: a CORE organ reaching into an ADAPTER file.
    { path: "templates/governance-engine/core-bad.ts", content: `import { x } from "./adapters/postgres/plane.js";` },
    // (2) infra-sdk: a CORE organ importing a denylisted SDK.
    { path: "templates/governance-engine/core-bad2.ts", content: `import Docker from "dockerode";` },
    // (3) direction: an ADAPTER reaching a CORE INTERNAL instead of a contract.
    { path: "templates/governance-engine/adapters/postgres/bad.ts", content: `import { tick } from "../../reconciler.js";` },
    // (4) infra-call: a CORE organ shelling a relative-path tool.
    { path: "templates/governance-engine/core-bad3.ts", content: `const out = execFileSync(process.execPath, ["../infra/i-config.mjs"]);` },
    // clean controls (must NOT trip):
    { path: "templates/governance-engine/core-good.ts", content: `import type { GoalState } from "./state-machine.js";` }, // core->core
    { path: "templates/governance-engine/core-good2.ts", content: `import { assertReadOnlyTarget } from "./metric-probe.js";` }, // core->contracts (the real edge)
    { path: "templates/governance-engine/adapters/postgres/good.ts", content: `import type { Port } from "../../ports.js";\nimport pg from "postgres";` }, // adapter->contract + SDK
    { path: "templates/governance-engine/comment.ts", content: `// historically this imported "dockerode" and ./adapters/x.js — comment only` }, // comment: no trip
    { path: "scripts/some-tool.mjs", content: `import Docker from "dockerode";` }, // unclassified: not gated
    { path: "templates/governance-engine/core-good3.ts", content: `import { z } from "zod";\nimport { drizzle } from "drizzle-orm/pg-core";` }, // non-denylisted bare pkgs (pg-core != pg)
  ];

  const findings = detectBoundaryViolations(planted, cfg);
  const has = (kind, path, extra = () => true) => findings.some((x) => x.kind === kind && x.path === path && extra(x));
  const cases = [];
  const assert = (name, cond) => cases.push({ name, ok: !!cond });

  assert("[direction] core -> adapters caught", has("direction", "templates/governance-engine/core-bad.ts", (x) => x.toLayer === "adapters"));
  assert("[infra-sdk] dockerode in Core caught", has("infra-sdk", "templates/governance-engine/core-bad2.ts"));
  assert("[direction] adapter -> core internal caught", has("direction", "templates/governance-engine/adapters/postgres/bad.ts", (x) => x.toLayer === "core"));
  assert("[infra-sdk] execFileSync of relative tool caught", has("infra-sdk", "templates/governance-engine/core-bad3.ts"));
  assert("clean: core -> core (state-machine) NOT flagged", !findings.some((x) => x.path === "templates/governance-engine/core-good.ts"));
  assert("clean: core -> contracts (metric-probe) NOT flagged", !findings.some((x) => x.path === "templates/governance-engine/core-good2.ts"));
  assert("clean: adapter -> contract + postgres SDK NOT flagged", !findings.some((x) => x.path === "templates/governance-engine/adapters/postgres/good.ts"));
  assert("clean: comment mention NOT flagged", !findings.some((x) => x.path === "templates/governance-engine/comment.ts"));
  assert("clean: unclassified file (scripts/) NOT gated", !findings.some((x) => x.path === "scripts/some-tool.mjs"));
  assert("clean: non-denylisted bare pkgs (zod, drizzle-orm/pg-core) NOT flagged", !findings.some((x) => x.path === "templates/governance-engine/core-good3.ts"));

  const failed = cases.filter((c) => !c.ok);
  for (const c of cases) process.stdout.write(`${c.ok ? "PASS" : "FAIL"}  ${c.name}\n`);
  process.stdout.write(`\narch-boundary-guard self-test: ${cases.length - failed.length}/${cases.length} passed.\n`);
  if (failed.length) {
    process.stdout.write("\nfindings dump:\n" + JSON.stringify(findings, null, 2) + "\n");
  }
  process.exit(failed.length === 0 ? 0 : 1);
}

const IS_MAIN = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (IS_MAIN) {
  const argv = process.argv.slice(2);
  const opts = { root: null, config: null, schema: null, json: false, selfTest: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--root") opts.root = argv[++i];
    else if (a === "--config") opts.config = argv[++i];
    else if (a === "--schema") opts.schema = argv[++i];
    else if (a === "--json") opts.json = true;
    else if (a === "--self-test") opts.selfTest = true;
    else if (a === "-h" || a === "--help") {
      process.stdout.write("arch-boundary-guard — config-driven architectural-boundary linter\n  node scripts/arch-boundary-guard.mjs [--root <path>] [--config <path>] [--json] [--self-test]\n");
      process.exit(0);
    }
  }
  if (opts.selfTest) selfTest();
  else run(opts);
}
