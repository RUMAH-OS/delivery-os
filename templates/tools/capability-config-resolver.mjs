#!/usr/bin/env node
// =============================================================================
// Delivery OS — Capability Config Resolver. RS-DOS §57.3. Sprint 1.3.
// =============================================================================
// Turns the DECLARED capability requirement (`requires_config` / `requires_secret`
// on a `*.capability.json`, §57.3) into the queryable Runtime fact §57.3 names:
//
//     resolve(capabilityIds | descriptor files, env) -> config_req[]
//
// where config_req is the merged, de-duplicated set of {key, kind, data_class,
// env_scope, rule, from[]} a WorkPackage built from those capabilities requires.
// This is the input the readiness-shadow binding (readiness-shadow.mjs) feeds to
// the I-Config oracle (i-config.mjs, §57.4). It is also a standing HONESTY check:
//   - a requires_secret entry MUST be PII/SECRET; a requires_config entry MUST NOT
//     be (the split must stay truthful);
//   - a requirement whose key is absent from the service registry is a REGISTRY GAP
//     (surfaced, not silently dropped — the capability needs a key nobody declares);
//   - a requirement whose stated `rule` disagrees with the registry's authoritative
//     validation_rule is a DRIFT signal (surfaced).
//
// PURE CORE, thin CLI: `mergeRequirements()` / `resolveConfigReq()` take plain
// objects so the self-test drives the full path offline. The CLI reads files.
//
// SHADOW posture (Sprint 1.3): this RESOLVES and REPORTS. It never blocks dispatch
// or deploy — the gate binding does that, and it too is report-only this sprint.
//
// USAGE:
//   node capability-config-resolver.mjs --caps <id|file>[,<id|file>...] [--env <env>]
//        [--registry <path>] [--caps-dir <path>] [--json] [--self-test] [-h]
//
// EXIT: 0 always (report-only). --self-test: 0 = all pass, 1 = a self-test failed.
// Zero runtime dependencies (Node >= 18 built-ins only).
// =============================================================================

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve, isAbsolute, basename } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const SECRET_CLASSES = new Set(["PII", "SECRET"]);
const CONFIG_CLASSES = new Set(["PUBLIC", "INTERNAL", "CONFIDENTIAL"]);

// --- arg parsing -------------------------------------------------------------
function parseArgs(argv) {
  const o = { caps: [], env: null, registry: null, capsDir: null, json: false, selfTest: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--caps") o.caps = String(argv[++i] || "").split(",").map((s) => s.trim()).filter(Boolean);
    else if (a === "--env") o.env = argv[++i];
    else if (a === "--registry") o.registry = argv[++i];
    else if (a === "--caps-dir") o.capsDir = argv[++i];
    else if (a === "--json") o.json = true;
    else if (a === "--self-test") o.selfTest = true;
    else if (a === "-h" || a === "--help") { process.stdout.write(usage()); process.exit(0); }
    else { process.stderr.write(`capability-config-resolver: unknown flag "${a}" (try --help)\n`); process.exit(2); }
  }
  return o;
}
function usage() {
  return (
    "capability-config-resolver — capability requires_config/requires_secret -> config_req[] (RS-DOS §57.3).\n\n" +
    "  node capability-config-resolver.mjs --caps <id|file>[,...] [--env <env>] [--registry <path>]\n" +
    "       [--caps-dir <path>] [--json] [--self-test]\n\n" +
    "Resolves the declared per-capability requirements into a merged, env-scoped required-key set.\n" +
    "Report-only (exit 0). --self-test ⇒ offline proof of the merge + honesty checks.\n"
  );
}

// =============================================================================
// PURE CORE.
// =============================================================================

// One descriptor -> its declared requirements as a flat list with `kind`.
// `descriptor` is the parsed *.capability.json object. Returns { id, reqs[], issues[] }.
function requirementsOf(descriptor, srcLabel) {
  const id = descriptor.id || srcLabel || "<unknown>";
  const reqs = [];
  const issues = [];
  const take = (arr, kind, expectSecret) => {
    for (const e of arr || []) {
      if (!e || typeof e !== "object") { issues.push({ id, kind, issue: "malformed requirement entry (not an object)" }); continue; }
      if (!e.key) { issues.push({ id, kind, issue: "requirement missing 'key'" }); continue; }
      const isSecretClass = SECRET_CLASSES.has(e.data_class);
      const isConfigClass = CONFIG_CLASSES.has(e.data_class);
      // Honesty: the split must be truthful (§57.3 / §54.1).
      if (expectSecret && !isSecretClass)
        issues.push({ id, key: e.key, kind, issue: `listed under requires_secret but data_class='${e.data_class}' is not PII/SECRET` });
      if (!expectSecret && !isConfigClass)
        issues.push({ id, key: e.key, kind, issue: `listed under requires_config but data_class='${e.data_class}' is PII/SECRET — move to requires_secret` });
      if (!Array.isArray(e.env_scope) || e.env_scope.length === 0)
        issues.push({ id, key: e.key, kind, issue: "requirement missing/empty 'env_scope'" });
      if (!e.rule) issues.push({ id, key: e.key, kind, issue: "requirement missing 'rule'" });
      reqs.push({
        key: e.key,
        kind, // "config" | "secret"
        data_class: e.data_class,
        env_scope: Array.isArray(e.env_scope) ? e.env_scope : [],
        rule: e.rule || null,
        reason: e.reason || null,
        from: id,
      });
    }
  };
  take(descriptor.requires_config, "config", false);
  take(descriptor.requires_secret, "secret", true);
  return { id, reqs, issues };
}

// Merge many descriptors' requirements -> a de-duplicated config_req set keyed by `key`.
// Same key required by >1 capability ⇒ ONE entry whose env_scope is the UNION and whose
// from[] lists every requiring capability (so a refusal can name them). A data_class /
// rule disagreement between two capabilities for the same key is surfaced as a conflict.
function mergeRequirements(descriptors /* [{descriptor, src}] */) {
  const byKey = new Map();
  const issues = [];
  const ids = [];
  for (const { descriptor, src } of descriptors) {
    const { id, reqs, issues: dIssues } = requirementsOf(descriptor, src);
    ids.push(id);
    issues.push(...dIssues);
    for (const r of reqs) {
      const cur = byKey.get(r.key);
      if (!cur) {
        byKey.set(r.key, { key: r.key, kind: r.kind, data_class: r.data_class, env_scope: [...r.env_scope], rule: r.rule, from: [r.from], reasons: r.reason ? [r.reason] : [] });
      } else {
        if (cur.data_class !== r.data_class)
          issues.push({ key: r.key, issue: `data_class conflict across capabilities: '${cur.data_class}' (${cur.from.join(",")}) vs '${r.data_class}' (${r.from})` });
        if (cur.rule !== r.rule)
          issues.push({ key: r.key, issue: `rule conflict across capabilities: '${cur.rule}' vs '${r.rule}' (${r.from})` });
        cur.env_scope = [...new Set([...cur.env_scope, ...r.env_scope])];
        if (!cur.from.includes(r.from)) cur.from.push(r.from);
        if (r.reason) cur.reasons.push(r.reason);
        // a secret kind wins (more constrained) if either says secret
        if (r.kind === "secret") cur.kind = "secret";
      }
    }
  }
  return { ids, config_req: [...byKey.values()], issues };
}

// Filter the merged set to those that APPLY to a target env, and (if a registry is
// supplied) cross-check each against the authoritative registry entry.
// `registryKeys` = Map<key, registryEntry> (or null to skip the cross-check).
function resolveConfigReq(merged, env, registryKeys) {
  const applies = [];
  const issues = [...merged.issues];
  for (const r of merged.config_req) {
    const inScope = !env || r.env_scope.includes(env);
    const row = { ...r, applies_to_env: inScope, registry: "unchecked" };
    if (registryKeys) {
      const reg = registryKeys.get(r.key);
      if (!reg) {
        row.registry = "GAP";
        issues.push({ key: r.key, issue: `capability requires '${r.key}' but it is NOT declared in the service registry (registry gap — nobody owns this key)` });
      } else {
        row.registry = "declared";
        if (reg.validation_rule && r.rule && reg.validation_rule !== r.rule)
          issues.push({ key: r.key, issue: `rule drift: capability states '${r.rule}' but registry authoritative validation_rule is '${reg.validation_rule}'` });
        if (reg.data_class && r.data_class && reg.data_class !== r.data_class)
          issues.push({ key: r.key, issue: `data_class drift: capability states '${r.data_class}' but registry says '${reg.data_class}'` });
      }
    }
    if (inScope) applies.push(row);
  }
  return { env: env || null, required_keys: applies.map((a) => a.key), config_req: applies, all: merged.config_req, issues };
}

// =============================================================================
// File I/O (CLI only — the pure core above never reads disk).
// =============================================================================
function abs(p) { return isAbsolute(p) ? p : resolve(process.cwd(), p); }

function loadDescriptor(idOrFile, capsDir) {
  // A path to a *.capability.json, or a bare id resolved within capsDir.
  let path = null;
  if (idOrFile.endsWith(".json") || idOrFile.includes("/") || idOrFile.includes("\\")) {
    path = abs(idOrFile);
  } else {
    const dir = capsDir ? abs(capsDir) : resolve(HERE, "../../capabilities");
    const cand = resolve(dir, `${idOrFile}.capability.json`);
    if (existsSync(cand)) path = cand;
    else {
      // scan the dir for a descriptor whose id matches.
      if (existsSync(dir))
        for (const f of readdirSync(dir).filter((f) => f.endsWith(".capability.json"))) {
          try { const d = JSON.parse(readFileSync(resolve(dir, f), "utf8")); if (d.id === idOrFile) { path = resolve(dir, f); break; } } catch { /* skip */ }
        }
    }
  }
  if (!path || !existsSync(path)) { process.stderr.write(`capability-config-resolver: cannot find capability '${idOrFile}' (looked for a file or an id in the caps dir)\n`); process.exit(2); }
  let descriptor;
  try { descriptor = JSON.parse(readFileSync(path, "utf8")); } catch (e) { process.stderr.write(`capability-config-resolver: cannot parse ${path}: ${e.message}\n`); process.exit(2); }
  return { descriptor, src: basename(path) };
}

function loadRegistryKeys(registryPath) {
  if (!registryPath) return null;
  const p = abs(registryPath);
  if (!existsSync(p)) { process.stderr.write(`capability-config-resolver: registry not found: ${p}\n`); process.exit(2); }
  const reg = JSON.parse(readFileSync(p, "utf8"));
  const map = new Map();
  for (const k of reg.keys || []) map.set(k.key || k.name, { validation_rule: k.validation_rule || k.rule, data_class: k.data_class });
  return map;
}

// =============================================================================
// Run.
// =============================================================================
function run(opts) {
  if (!opts.caps.length) { process.stderr.write("capability-config-resolver: pass --caps <id|file>[,...] (or --self-test)\n"); process.exit(2); }
  const descriptors = opts.caps.map((c) => loadDescriptor(c, opts.capsDir));
  const registryKeys = loadRegistryKeys(opts.registry);
  const merged = mergeRequirements(descriptors);
  const resolved = resolveConfigReq(merged, opts.env, registryKeys);
  const out = {
    resolver: "capability-config-resolver (RS-DOS §57.3)",
    capabilities: merged.ids,
    env: resolved.env,
    registry: opts.registry ? abs(opts.registry) : null,
    required_keys: resolved.required_keys,
    config_req: resolved.config_req,
    issues: resolved.issues,
  };
  if (opts.json) process.stdout.write(JSON.stringify(out, null, 2) + "\n");
  else printHuman(out);
  process.exit(0); // report-only — never blocks.
}

function printHuman(out) {
  const L = (s = "") => process.stdout.write(s + "\n");
  L("");
  L(`capability config requirements — [${out.capabilities.join(", ")}]${out.env ? ` · env=${out.env}` : ""}`);
  L(`registry: ${out.registry || "(not cross-checked — pass --registry)"}`);
  L("");
  if (!out.config_req.length) L("  (no config/secret requirements declared for this env)");
  for (const r of out.config_req) {
    L(`  ${r.kind === "secret" ? "[secret]" : "[config]"} ${r.key}  (${r.data_class}, rule=${r.rule}, registry=${r.registry}, from=${r.from.join("+")})`);
    for (const why of r.reasons || []) L(`      why: ${why}`);
  }
  L("");
  L(`required keys for ${out.env || "all envs"}: ${out.required_keys.join(", ") || "(none)"}`);
  if (out.issues.length) {
    L("");
    L("ISSUES (surfaced, report-only):");
    for (const i of out.issues) L(`  !! ${i.key ? i.key + ": " : ""}${i.issue}`);
  }
  L("");
}

// =============================================================================
// Self-test — offline proof of merge + honesty checks (no disk/network).
// =============================================================================
function selfTest() {
  const cases = [];
  const assert = (name, cond) => cases.push({ name, ok: !!cond });

  const capA = {
    id: "deployer",
    requires_config: [{ key: "PUBLIC_BASE_URL", data_class: "INTERNAL", env_scope: ["staging", "prod"], rule: "url" }],
    requires_secret: [{ key: "VERCEL_TOKEN", data_class: "SECRET", env_scope: ["prod"], rule: "non-empty" }],
  };
  const capB = {
    id: "ci-watch",
    requires_secret: [
      { key: "VERCEL_TOKEN", data_class: "SECRET", env_scope: ["prod"], rule: "non-empty" },
      { key: "DATABASE_URL", data_class: "SECRET", env_scope: ["prod"], rule: "postgres-pooler-6543" },
    ],
  };
  const merged = mergeRequirements([{ descriptor: capA, src: "a" }, { descriptor: capB, src: "b" }]);

  assert("merge de-dups VERCEL_TOKEN to one entry", merged.config_req.filter((r) => r.key === "VERCEL_TOKEN").length === 1);
  assert("merged set has 3 distinct keys", merged.config_req.length === 3);
  const vt = merged.config_req.find((r) => r.key === "VERCEL_TOKEN");
  assert("shared key records both requiring capabilities in from[]", vt.from.includes("deployer") && vt.from.includes("ci-watch"));
  assert("clean merge has no honesty issues", merged.issues.length === 0);

  // env scoping: prod vs dev.
  const reg = new Map([
    ["PUBLIC_BASE_URL", { validation_rule: "url", data_class: "INTERNAL" }],
    ["VERCEL_TOKEN", { validation_rule: "non-empty", data_class: "SECRET" }],
    ["DATABASE_URL", { validation_rule: "postgres-pooler-6543", data_class: "SECRET" }],
  ]);
  const prod = resolveConfigReq(merged, "prod", reg);
  assert("prod resolves all 3 required keys", prod.required_keys.length === 3 && prod.required_keys.includes("DATABASE_URL"));
  assert("prod cross-check is clean (no registry gap)", prod.issues.length === 0);
  const dev = resolveConfigReq(merged, "dev", reg);
  assert("dev applies to ZERO keys (none scoped to dev)", dev.required_keys.length === 0);

  // honesty: a secret mis-listed under requires_config.
  const liar = { id: "liar", requires_config: [{ key: "API_KEY", data_class: "SECRET", env_scope: ["prod"], rule: "non-empty" }] };
  const lm = mergeRequirements([{ descriptor: liar, src: "l" }]);
  assert("a SECRET under requires_config is flagged as an honesty issue", lm.issues.some((i) => /move to requires_secret/.test(i.issue)));

  // registry gap: a required key nobody declares.
  const ghost = { id: "ghost", requires_secret: [{ key: "UNDECLARED_SECRET", data_class: "SECRET", env_scope: ["prod"], rule: "non-empty" }] };
  const gm = mergeRequirements([{ descriptor: ghost, src: "g" }]);
  const gr = resolveConfigReq(gm, "prod", reg);
  assert("an undeclared required key is flagged as a registry GAP", gr.config_req.some((r) => r.registry === "GAP") && gr.issues.some((i) => /registry gap/.test(i.issue)));

  // rule drift: capability rule disagrees with registry.
  const drifter = { id: "drifter", requires_secret: [{ key: "DATABASE_URL", data_class: "SECRET", env_scope: ["prod"], rule: "postgres-url" }] };
  const dm = mergeRequirements([{ descriptor: drifter, src: "d" }]);
  const dr = resolveConfigReq(dm, "prod", reg);
  assert("a capability rule that disagrees with the registry is flagged as drift", dr.issues.some((i) => /rule drift/.test(i.issue)));

  const failed = cases.filter((c) => !c.ok);
  for (const c of cases) process.stdout.write(`${c.ok ? "PASS" : "FAIL"}  ${c.name}\n`);
  process.stdout.write(`\ncapability-config-resolver self-test: ${cases.length - failed.length}/${cases.length} passed.\n`);
  process.exit(failed.length === 0 ? 0 : 1);
}

// Exported for the readiness-shadow binding + verifier harnesses (import-safe:
// the entrypoint below only runs when executed directly, not when imported).
export { requirementsOf, mergeRequirements, resolveConfigReq };

// --- entrypoint (CLI only) ---------------------------------------------------
const IS_MAIN = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (IS_MAIN) {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.selfTest) selfTest();
  else run(opts);
}
