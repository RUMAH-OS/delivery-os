#!/usr/bin/env node
// =============================================================================
// Delivery OS — I-Config: the canonical Config & Secret READINESS oracle.
// Runtime Specification §57.4 (RS-DOS-v1). Sprint 1.2 (closes CONFLICT-05).
// =============================================================================
// ONE readiness oracle over ONE canonical registry. Given (scope=service, env),
// it returns, per declared key, exactly one verdict:
//
//     PRESENT | MISSING | INVALID | DRIFTED        (+ OPTIONAL-ABSENT, non-blocking)
//
// evaluated over the live provider PLANES (Vercel / GitHub / Supabase-on-Vercel /
// local). This SUPERSEDES the two legacy validators (admin's manual config-doctor
// loader and PLOS's Zod env schema) and the two divergent config-registry.json
// shapes — it reads EITHER the canonical schema (schema_version:"config-secret-
// registry/v1") OR a legacy registry (auto-normalized) during the dual-read window.
//
// THE TWO INVARIANTS (§57.2):
//   1. METADATA ONLY — the registry records metadata, never a value.
//   2. NO SECRET VALUES — the oracle NEVER prints/logs/returns a secret value.
//      • Remote planes (vercel/github): PRESENCE only — the value is never fetched
//        (a Vercel "sensitive" var returns "" by design; `gh secret list` returns
//        names only).
//      • Local plane (inside the §54.2 trust boundary): a value MAY be read to
//        apply the validation_rule (e.g. min-length / URL shape), held only
//        transiently, and is NEVER emitted. For data_class ∈ {SECRET,PII} only the
//        rule VERDICT (ok / too-short / invalid) is surfaced — never any fragment.
//
// VERDICTS:
//   PRESENT  — required-or-scoped key is set on its authoritative plane and (where
//              the plane exposes a readable value) passes its validation_rule.
//   MISSING  — a REQUIRED key (required_per_env[env]===true) is not set / blank.
//   INVALID  — present but fails its validation_rule (readable plane only).
//   DRIFTED  — live plane ≠ registry: the key is present on a plane for an env that
//              the registry's env_scope does NOT include (config present where the
//              registry does not scope it — e.g. a local-only SECRET found in prod).
//              [Undeclared keys present on the plane but absent from the registry are
//               surfaced in report.drift[] as registry-vs-plane drift.]
//              [Value-level drift (live value ≠ a registry-pinned fingerprint) is
//               DESIGNED but DEFERRED — it needs live planes + fingerprint pinning;
//               see §57.6 / the adoption plan. Not asserted here to avoid false-open.]
//   OPTIONAL-ABSENT — an OPTIONAL key, absent. NON-BLOCKING; not one of the §57.4
//              blocking four (kept distinct so honesty is preserved: optional ≠ ready).
//
// ENFORCEMENT POSTURE (§57.5 is Sprint 1.3, NOT here):
//   DEFAULT = REPORT-ONLY. Exit 0 regardless of verdicts (the oracle reports; the
//   gates decide). Pass --enforce to make it fail-closed-CAPABLE: exit 1 if any
//   required key is MISSING/INVALID (and, with --enforce-drift, DRIFTED). The gate
//   wiring (C9 / D7 / C13) that consumes this is Sprint 1.3.
//
// USAGE:
//   node i-config.mjs [--service <id>] [--env local|dev|QA|staging|prod]
//                     [--registry <path>] [--project-dir <path>]
//                     [--json] [--include-local] [--enforce] [--enforce-drift]
//                     [--self-test] [-h]
//   (legacy env aliases accepted: development→dev, production→prod)
//
// EXIT CODES (report-only default): 0 always. With --enforce: 0 = ready ·
//   1 = a required key MISSING/INVALID (or DRIFTED with --enforce-drift) · 2 = error.
//
// Zero runtime dependencies (Node >= 18 built-ins only: fs, fetch).
// =============================================================================

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, isAbsolute } from "node:path";
import { execSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));

// Canonical environment vocabulary (§57.2/§57.4) + legacy aliases.
const ENV_ALIAS = { development: "dev", production: "prod", test: "dev", preview: "staging" };
function normEnv(e) {
  return ENV_ALIAS[e] || e;
}
const CANON_ENVS = ["local", "dev", "QA", "staging", "prod"];

// --- arg parsing -------------------------------------------------------------
const argv = process.argv.slice(2);
const opts = {
  service: null,
  env: "prod",
  registry: null,
  projectDir: null,
  json: false,
  includeLocal: false,
  enforce: false,
  enforceDrift: false,
  selfTest: false,
};
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--service") opts.service = argv[++i];
  else if (a === "--env") opts.env = normEnv(argv[++i]);
  else if (a === "--registry") opts.registry = argv[++i];
  else if (a === "--project-dir") opts.projectDir = argv[++i];
  else if (a === "--json") opts.json = true;
  else if (a === "--include-local") opts.includeLocal = true;
  else if (a === "--enforce") opts.enforce = true;
  else if (a === "--enforce-drift") { opts.enforce = true; opts.enforceDrift = true; }
  else if (a === "--self-test") opts.selfTest = true;
  else if (a === "-h" || a === "--help") {
    process.stdout.write(usage());
    process.exit(0);
  } else fail(2, `unknown flag "${a}" (try --help)`);
}

function usage() {
  return (
    "i-config — the canonical Config & Secret readiness oracle (RS-DOS §57.4).\n\n" +
    "  node i-config.mjs [--service <id>] [--env local|dev|QA|staging|prod]\n" +
    "                    [--registry <path>] [--project-dir <path>]\n" +
    "                    [--json] [--include-local] [--enforce] [--enforce-drift] [--self-test]\n\n" +
    "Per key → PRESENT | MISSING | INVALID | DRIFTED. DEFAULT report-only (exit 0).\n" +
    "--enforce ⇒ exit 1 on a required MISSING/INVALID (gate wiring is Sprint 1.3). --self-test ⇒ offline proof.\n"
  );
}

function fail(code, msg) {
  process.stderr.write(`i-config: ${msg}\n`);
  process.exit(code);
}

// =============================================================================
// Validation rules. Each returns { ok, message? }. NEVER receives/echoes the
// value back to the caller's output — only a boolean + a human reason.
// =============================================================================
const RULES = {
  // THE CRITICAL RULE. DATABASE_URL must be a postgres:// URL on the Supabase
  // TRANSACTION-POOLER port 6543 (the pooled connection) — the build requirement
  // AND the cure for the connection-exhaustion 503.
  "postgres-pooler-6543": (v) => {
    const m = parsePg(v);
    if (!m.ok) return { ok: false, message: m.message };
    if (m.port !== 6543)
      return {
        ok: false,
        message: `must use the Supabase TRANSACTION-POOLER port 6543 (got :${m.port ?? "none"}). A direct :5432 connection exhausts the pool under serverless fan-out and 503s.`,
      };
    if (!/pooler\./i.test(m.host))
      return {
        ok: false,
        message: `port is 6543 but host "${m.host}" is not a Supabase pooler host (expected *.pooler.supabase.com).`,
      };
    return { ok: true };
  },
  "postgres-url": (v) => {
    const m = parsePg(v);
    return m.ok ? { ok: true } : { ok: false, message: m.message };
  },
  url: (v) => {
    try {
      const u = new URL(v);
      if (!/^https?:$/.test(u.protocol)) return { ok: false, message: "must be an http(s) URL." };
      return { ok: true };
    } catch {
      return { ok: false, message: "is not a valid URL." };
    }
  },
  "non-empty": (v) => (v && v.trim() !== "" ? { ok: true } : { ok: false, message: "must not be empty." }),
  // A boolean feature flag — any present value is structurally valid (truthiness
  // is the app's concern). Declared so an unset flag is reported, not guessed.
  flag: () => ({ ok: true }),
  // Numeric rules (the Zod coerce.number() equivalents, so a migrated PLOS key
  // keeps its shape check). NEVER echoes the value.
  number: (v) => (Number.isFinite(Number(v)) ? { ok: true } : { ok: false, message: "must be a number." }),
  "int-nonneg": (v) => {
    const n = Number(v);
    return Number.isInteger(n) && n >= 0 ? { ok: true } : { ok: false, message: "must be a non-negative integer." };
  },
};

// secret-min:N and enum:a|b|c are parameterized rules resolved here. Returns
// { ok } | { ok:false, message } | { missing:true }. The value is read for length/
// shape ONLY and is never returned in the result.
function validate(rule, value) {
  if (value === undefined || value === null || String(value).trim() === "")
    return { ok: false, missing: true };
  if (rule.startsWith("secret-min:")) {
    const n = Number(rule.slice("secret-min:".length));
    return String(value).length >= n
      ? { ok: true }
      : { ok: false, message: `must be at least ${n} characters (too short to be a valid secret).` };
  }
  if (rule.startsWith("enum:")) {
    const allowed = rule.slice("enum:".length).split("|");
    return allowed.includes(String(value))
      ? { ok: true }
      : { ok: false, message: `must be one of: ${allowed.join(", ")}.` };
  }
  const fn = RULES[rule];
  if (!fn) return { ok: false, message: `unknown validation rule "${rule}" in registry.` };
  return fn(String(value));
}

function parsePg(v) {
  let u;
  try {
    u = new URL(v);
  } catch {
    return { ok: false, message: "is not a valid connection URL." };
  }
  if (!/^postgres(ql)?:$/.test(u.protocol))
    return { ok: false, message: `must be a postgres:// URL (got "${u.protocol}//").` };
  const port = u.port ? Number(u.port) : null;
  return { ok: true, host: u.hostname, port };
}

// =============================================================================
// Registry loading + normalization to the canonical entry shape.
// =============================================================================
function loadRegistry() {
  let path = opts.registry;
  if (!path) {
    const dir = opts.projectDir ? abs(opts.projectDir) : process.cwd();
    const candidates = [
      resolve(dir, "infra/config-secret-registry.json"),
      resolve(dir, "config-secret-registry.json"),
      resolve(dir, "infra/config-registry.json"),
      resolve(dir, "config-registry.json"),
    ];
    path = candidates.find((c) => existsSync(c));
    if (!path)
      fail(2, `no registry found (looked at:\n  ${candidates.join("\n  ")}\n) — pass --registry <path>.`);
  } else {
    path = abs(path);
    if (!existsSync(path)) fail(2, `registry not found: ${path}`);
  }
  let reg;
  try {
    reg = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    fail(2, `cannot parse registry ${path}: ${e.message}`);
  }
  const canonical = normalizeRegistry(reg, path);
  return { reg: canonical, path, isLegacy: reg.schema_version !== "config-secret-registry/v1" };
}

// Map a LEGACY registry (admin/PLOS JSON shape) → canonical in-memory. Lossless
// for everything the oracle needs; the data_class is INFERRED conservatively and
// flagged so the migration (adoption plan) can confirm it.
const LEGACY_OWNER_TO_PROVIDER = { "vercel-env": "vercel", supabase: "supabase", "github-secret": "github" };
function inferDataClass(legacyKey) {
  const rule = legacyKey.rule || "";
  if (rule.startsWith("secret-min:")) return "SECRET"; // a length-gated secret
  if (legacyKey.owner === "github-secret") return "SECRET"; // CI tokens/credentials
  if (/token|secret|key|password|jwt/i.test(legacyKey.name || "")) return "SECRET";
  return "INTERNAL"; // urls/flags/non-empty operational config
}
function normalizeRegistry(reg, path) {
  if (reg.schema_version === "config-secret-registry/v1") {
    structuralCheckCanonical(reg, path);
    return reg;
  }
  // Legacy shape → canonical.
  if (!Array.isArray(reg.keys)) fail(2, `registry ${path} is malformed: missing 'keys'.`);
  const envs = (reg.environments || ["development", "production"]).map(normEnv);
  const keys = reg.keys.map((k) => {
    const required = {};
    const scope = [];
    const reqSrc = typeof k.required === "object" && k.required ? k.required : {};
    for (const [e, v] of Object.entries(reqSrc)) {
      const ne = normEnv(e);
      required[ne] = !!v;
      scope.push(ne);
    }
    // booleans (required for all) → all declared envs.
    if (typeof k.required === "boolean") for (const e of envs) { required[e] = k.required; scope.push(e); }
    const env_scope = [...new Set(scope.length ? scope : envs)];
    return {
      key: k.name,
      owner: "platform",
      source_provider: LEGACY_OWNER_TO_PROVIDER[k.owner] || "vercel",
      data_class: inferDataClass(k),
      data_class_inferred: true,
      env_scope,
      validation_rule: k.rule,
      required_per_env: required,
      purpose: k.purpose,
      example: k.example,
      fix: k.fix,
    };
  });
  return {
    schema_version: "config-secret-registry/v1",
    service: reg.service,
    description: reg.description,
    environments: envs,
    planes: reg.platforms || reg.planes || {},
    keys,
    _normalizedFromLegacy: true,
  };
}

function structuralCheckCanonical(reg, path) {
  const errs = [];
  if (!reg.service) errs.push("missing 'service'");
  if (!Array.isArray(reg.environments) || reg.environments.length === 0)
    errs.push("missing/empty 'environments'");
  if (!Array.isArray(reg.keys) || reg.keys.length === 0) errs.push("missing/empty 'keys'");
  const DC = ["PUBLIC", "INTERNAL", "CONFIDENTIAL", "PII", "SECRET"];
  const SP = ["vercel", "github", "supabase", "local"];
  for (const [i, k] of (reg.keys || []).entries()) {
    const at = `keys[${i}]${k && k.key ? ` (${k.key})` : ""}`;
    if (!k.key) errs.push(`${at}: missing 'key'`);
    if (!k.owner) errs.push(`${at}: missing 'owner'`);
    if (!SP.includes(k.source_provider)) errs.push(`${at}: 'source_provider' must be ${SP.join(" | ")}`);
    if (!DC.includes(k.data_class)) errs.push(`${at}: 'data_class' must be ${DC.join(" | ")}`);
    if (!Array.isArray(k.env_scope) || k.env_scope.length === 0) errs.push(`${at}: missing/empty 'env_scope'`);
    if (!k.validation_rule) errs.push(`${at}: missing 'validation_rule'`);
    if (!k.required_per_env || typeof k.required_per_env !== "object")
      errs.push(`${at}: missing 'required_per_env'`);
    // a key required for an env it is not scoped to is a registry error.
    for (const [e, v] of Object.entries(k.required_per_env || {}))
      if (v === true && Array.isArray(k.env_scope) && !k.env_scope.includes(e))
        errs.push(`${at}: required in '${e}' but '${e}' is not in env_scope`);
  }
  if (errs.length) fail(2, `registry ${path} is malformed (canonical):\n  - ${errs.join("\n  - ")}`);
}

function isRequired(key, env) {
  return key.required_per_env && key.required_per_env[env] === true;
}
function isScoped(key, env) {
  return Array.isArray(key.env_scope) && key.env_scope.includes(env);
}
function isSecret(key) {
  return key.data_class === "SECRET" || key.data_class === "PII";
}
function abs(p) {
  return isAbsolute(p) ? p : resolve(process.cwd(), p);
}

// =============================================================================
// State sources (the live provider planes). Presence-only on remote planes.
// =============================================================================

// Vercel: list a project's env var KEYS for a target (read-only). Presence (and
// blank-ness) only — a value is NEVER decrypted/returned.
async function fetchVercelKeys(reg, env) {
  const v = (reg.planes && reg.planes.vercel) || {};
  const token = process.env[v.tokenEnv || "VERCEL_TOKEN"];
  const orgId = process.env[v.orgIdEnv || "VERCEL_ORG_ID"];
  const projectId = process.env[v.projectIdEnv || "VERCEL_PROJECT_ID"];
  if (!token || !projectId)
    return { available: false, reason: "VERCEL_TOKEN / VERCEL_PROJECT_ID not set" };
  // env → Vercel target. prod→production; staging/QA→preview; dev/local→development.
  const target = env === "prod" ? "production" : env === "staging" || env === "QA" ? "preview" : "development";
  const teamQ = orgId ? `?teamId=${encodeURIComponent(orgId)}` : "";
  const url = `https://api.vercel.com/v9/projects/${encodeURIComponent(projectId)}/env${teamQ}`;
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return { available: false, reason: `Vercel API HTTP ${res.status}` };
    const body = await res.json();
    const present = new Map(); // key -> { blank, sensitive }
    for (const e of body.envs || []) {
      if (Array.isArray(e.target) ? e.target.includes(target) : e.target === target)
        present.set(e.key, classifyVercelEnv(e));
    }
    return { available: true, present };
  } catch (e) {
    return { available: false, reason: `Vercel API error: ${e.message}` };
  }
}

// Classify ONE Vercel env-var list entry → { blank, sensitive }. Pure (no I/O).
// A type:"sensitive" var's value is NEVER returned by the API (always ""), so it is
// PRESENT-but-unreadable, NOT blank. Only a non-sensitive var with an explicitly
// empty value is genuinely blank. (Fixes the sensitive-as-blank false-negative.)
function classifyVercelEnv(e) {
  const sensitive = e.type === "sensitive";
  const blank = !sensitive && typeof e.value === "string" && e.value.trim() === "";
  return { blank, sensitive };
}

// GitHub Actions secrets: presence-only via `gh secret list` (names, never values).
function fetchGithubSecrets(reg) {
  const repo = reg.planes && reg.planes.github && reg.planes.github.repo;
  try {
    const args = repo ? `-R ${repo}` : "";
    const out = execSync(`gh secret list ${args} --json name -q ".[].name"`, {
      stdio: ["ignore", "pipe", "ignore"],
    }).toString();
    return { available: true, present: new Set(out.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)) };
  } catch {
    return { available: false, reason: "gh CLI unavailable or not authenticated" };
  }
}

// Local .env (+ process.env) — the trusted-domain plane (local/dev), or prod with
// --include-local. Values are read here ONLY to apply validation_rule; never emitted.
function loadLocalEnv(env) {
  const dir = opts.projectDir ? abs(opts.projectDir) : process.cwd();
  const files = env === "prod" ? [".env"] : [".env.development", ".env.local", ".env.test", ".env"];
  const merged = {};
  for (const f of files) {
    const p = resolve(dir, f);
    if (!existsSync(p)) continue;
    for (const [k, val] of Object.entries(parseEnvFile(p))) if (merged[k] === undefined) merged[k] = val;
  }
  for (const [k, val] of Object.entries(process.env)) if (val !== undefined) merged[k] = val;
  return merged;
}

function parseEnvFile(path) {
  const out = {};
  for (const raw of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    if (!key) continue;
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
      val = val.slice(1, -1);
    out[key] = val;
  }
  return out;
}

// =============================================================================
// THE ORACLE — readiness(scope, env). Pure given resolved planes (so the
// self-test exercises the full verdict path offline with injected planes).
// =============================================================================

// Compute the per-key verdict. `planes` = { vercel, github, local } resolved state.
function evaluateKey(key, env, planes) {
  const required = isRequired(key, env);
  const scoped = isScoped(key, env);

  // ---- Remote planes: PRESENCE only (never read a value) -------------------
  const pickRemote = () => {
    if (key.source_provider === "github") return { kind: "github", lane: "github-secret" };
    // vercel + supabase both resolve on the Vercel env plane.
    return { kind: "vercel", lane: env === "prod" ? "vercel-prod" : `vercel-${env}` };
  };

  // DRIFT (env-scope): present on the plane for an env NOT in env_scope ⇒ DRIFTED.
  const driftIfPresentOutOfScope = (presentOnPlane, lane) => {
    if (presentOnPlane && !scoped)
      return {
        state: "DRIFTED",
        lane,
        detail: `present on the ${lane} plane but the registry does not scope '${key.key}' to '${env}' (env_scope=[${key.env_scope.join(",")}]). ${isSecret(key) ? "A " + key.data_class + " escaped its declared scope — §54.2 trust-boundary drift." : "Config present where the registry does not declare it."}`,
      };
    return null;
  };

  if (key.source_provider === "github") {
    if (planes.github.available) {
      const present = planes.github.present.has(key.key);
      const drift = driftIfPresentOutOfScope(present, "github-secret");
      if (drift) return drift;
      if (present)
        return { state: "PRESENT", lane: "github-secret", detail: "set in GitHub Actions secrets (presence verified; value not inspected)." };
      return absentOrUnscoped(key, env, "github-secret");
    }
    // gh CLI unavailable: the deploy workflow injects these into process.env — a real,
    // direct presence check (not a guess). Never reads the value beyond non-blank.
    const envVal = process.env[key.key];
    if (envVal !== undefined && String(envVal).trim() !== "") {
      const drift = driftIfPresentOutOfScope(true, "github-secret(env)");
      if (drift) return drift;
      return { state: "PRESENT", lane: "github-secret(env)", detail: "present in the workflow environment (injected from GitHub Actions secrets; value not inspected)." };
    }
    if (planes.local) return evalFromLocal(key, env, planes.local, "local(.env)");
    return absentOrUnscoped(key, env, "github-secret(unverified)");
  }

  // vercel / supabase → the Vercel env plane for this target.
  if (planes.vercel.available) {
    const lane = env === "prod" ? "vercel-prod" : `vercel-${env}`;
    const hit = planes.vercel.present.get(key.key);
    const drift = driftIfPresentOutOfScope(!!hit && !hit.blank, lane);
    if (drift) return drift;
    if (hit && !hit.blank)
      return {
        state: "PRESENT",
        lane,
        detail: hit.sensitive
          ? "set in Vercel as a SENSITIVE variable (presence verified; value is unreadable via the API by design)."
          : "set in Vercel (presence verified; encrypted value not inspected).",
      };
    if (hit && hit.blank)
      return { state: "MISSING", lane, detail: "present in Vercel but BLANK (empty value) — same as unset for the build." };
    if (planes.local && planes.local[key.key]) return evalFromLocal(key, env, planes.local, `${lane}(local advisory)`);
    return absentOrUnscoped(key, env, lane);
  }
  // Vercel plane unreadable. --include-local validates the local value as a proxy.
  if (planes.local) return evalFromLocal(key, env, planes.local, `vercel-${env}(local, Vercel unverified)`);
  return absentOrUnscoped(key, env, `vercel-${env}(unverified)`);
}

// Local plane: a value MAY be read to apply validation_rule (trust boundary), but is
// NEVER emitted — only the verdict (and, for SECRET/PII, never the rule's value).
function evalFromLocal(key, env, local, lane) {
  const value = local[key.key];
  // env-scope drift on the local plane too.
  if (value !== undefined && String(value).trim() !== "" && !isScoped(key, env))
    return {
      state: "DRIFTED",
      lane,
      detail: `present on the ${lane} plane but '${env}' is not in env_scope=[${key.env_scope.join(",")}].`,
    };
  const v = validate(key.validation_rule, value);
  if (v.missing) return absentOrUnscoped(key, env, lane);
  if (!v.ok) return { state: "INVALID", lane, detail: `value ${v.message}` };
  return { state: "PRESENT", lane, detail: "present and passes the validation rule." };
}

// Absent on the authoritative plane → MISSING (required) | OPTIONAL-ABSENT (optional).
// A key not scoped to this env at all is OPTIONAL-ABSENT (it does not apply here).
function absentOrUnscoped(key, env, lane) {
  if (isRequired(key, env)) return { state: "MISSING", lane, detail: "required for this env but not set." };
  if (!isScoped(key, env))
    return { state: "OPTIONAL-ABSENT", lane, detail: `not scoped to '${env}' (env_scope=[${key.env_scope.join(",")}]) — does not apply here.` };
  return { state: "OPTIONAL-ABSENT", lane, detail: "optional and not set (inert until configured)." };
}

// Build the full readiness report (pure given resolved planes).
function buildReport(reg, env, planes, path) {
  const keys = reg.keys.map((key) => {
    const res = evaluateKey(key, env, planes);
    return {
      key: key.key,
      owner: key.owner,
      source_provider: key.source_provider,
      data_class: key.data_class,
      data_class_inferred: key.data_class_inferred || false,
      env_scope: key.env_scope,
      required: isRequired(key, env),
      state: res.state,
      lane: res.lane,
      detail: res.detail,
      fix: key.fix || defaultFix(key),
      example: key.example,
    };
  });

  // Registry-vs-plane DRIFT: keys present on a readable plane but undeclared in the
  // registry (shadow keys). Surfaced separately (not a per-registry-key verdict).
  const declared = new Set(reg.keys.map((k) => k.key));
  const drift = [];
  if (planes.vercel && planes.vercel.available)
    for (const k of planes.vercel.present.keys())
      if (!declared.has(k)) drift.push({ key: k, plane: `vercel-${env}`, note: "present on the Vercel plane but NOT declared in the registry (shadow/undeclared key)." });
  if (planes.github && planes.github.available)
    for (const k of planes.github.present)
      if (!declared.has(k)) drift.push({ key: k, plane: "github-secret", note: "present in GitHub secrets but NOT declared in the registry (shadow/undeclared key)." });

  const blockingMissing = keys.filter((r) => r.required && (r.state === "MISSING" || r.state === "INVALID"));
  const drifted = keys.filter((r) => r.state === "DRIFTED");

  return {
    oracle: "I-Config (RS-DOS §57.4)",
    service: reg.service,
    environment: env,
    registry: path,
    normalized_from_legacy: !!reg._normalizedFromLegacy,
    planes: {
      vercel: planes.vercel.available ? "read" : `unreadable (${planes.vercel.reason})`,
      github: planes.github.available ? "read" : `unreadable (${planes.github.reason})`,
      local: planes.local ? "read" : "not consulted (pass --include-local)",
    },
    posture: opts.enforce ? (opts.enforceDrift ? "enforce (block on MISSING/INVALID/DRIFTED)" : "enforce (block on MISSING/INVALID)") : "report-only (Sprint 1.2 — gates wired in 1.3)",
    summary: {
      total: keys.length,
      required: keys.filter((r) => r.required).length,
      present: keys.filter((r) => r.state === "PRESENT").length,
      missing: keys.filter((r) => r.state === "MISSING").length,
      invalid: keys.filter((r) => r.state === "INVALID").length,
      drifted: drifted.length,
      optional_absent: keys.filter((r) => r.state === "OPTIONAL-ABSENT").length,
      undeclared_on_plane: drift.length,
    },
    ready: blockingMissing.length === 0,
    keys,
    drift,
  };
}

function defaultFix(key) {
  const where =
    key.source_provider === "github"
      ? "GitHub → Settings → Secrets and variables → Actions"
      : key.source_provider === "supabase"
        ? "Supabase dashboard → copy the value → set it as a Vercel env var"
        : key.source_provider === "local"
          ? "your local .env (gitignored — never committed)"
          : "Vercel → Project → Settings → Environment Variables";
  return `Set ${key.key} in ${where}. Example (redacted): ${key.example || "<redacted>"}`;
}

// =============================================================================
// Run.
// =============================================================================
async function run() {
  const { reg, path } = loadRegistry();
  if (opts.service && reg.service !== opts.service)
    fail(2, `registry service is "${reg.service}", not "${opts.service}" — wrong --registry/--project-dir?`);
  if (!CANON_ENVS.includes(opts.env))
    fail(2, `env "${opts.env}" is not a canonical environment (one of: ${CANON_ENVS.join(", ")}).`);
  if (!reg.environments.includes(opts.env))
    fail(2, `environment "${opts.env}" is not declared for ${reg.service} (declared: ${reg.environments.join(", ")}).`);

  const vercel = await fetchVercelKeys(reg, opts.env);
  const github = reg.keys.some((k) => k.source_provider === "github")
    ? fetchGithubSecrets(reg)
    : { available: false, reason: "no github-plane keys" };
  const isLocalEnv = opts.env === "local" || opts.env === "dev";
  const local = isLocalEnv || opts.includeLocal ? loadLocalEnv(opts.env) : null;

  const report = buildReport(reg, opts.env, { vercel, github, local }, path);

  if (opts.json) process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  else printHuman(report);

  // Report-only default: exit 0. --enforce makes it fail-closed-capable (Sprint 1.3
  // wires the actual gates; this flag only proves the capability exists).
  if (!opts.enforce) process.exit(0);
  const block = report.summary.missing + report.summary.invalid + (opts.enforceDrift ? report.summary.drifted : 0);
  process.exit(block > 0 ? 1 : 0);
}

function printHuman(report) {
  const L = (s = "") => process.stdout.write(s + "\n");
  L("");
  L(`I-Config readiness — ${report.service} [${report.environment}]`);
  L(`registry: ${report.registry}${report.normalized_from_legacy ? "  (normalized from a LEGACY registry)" : ""}`);
  L(`planes:   vercel=${report.planes.vercel} · github=${report.planes.github} · local=${report.planes.local}`);
  L(`posture:  ${report.posture}`);
  L("");
  const icon = { PRESENT: "OK ", MISSING: "XX ", INVALID: "XX ", DRIFTED: ">> ", "OPTIONAL-ABSENT": " . " };
  for (const k of report.keys) {
    const req = k.required ? "required" : "optional";
    const dc = k.data_class + (k.data_class_inferred ? "?" : "");
    L(`${icon[k.state] || "?  "}${k.state.padEnd(16)} ${k.key}  (${req}, ${dc}, ${k.source_provider}, lane=${k.lane})`);
    if (k.state === "MISSING" || k.state === "INVALID" || k.state === "DRIFTED") {
      L(`      ${k.detail}`);
      L(`      FIX: ${k.fix}`);
    }
  }
  if (report.drift.length) {
    L("");
    L("registry-vs-plane DRIFT (undeclared keys present on a live plane):");
    for (const d of report.drift) L(`  >> ${d.key}  [${d.plane}] — ${d.note}`);
  }
  L("");
  const s = report.summary;
  L(`summary: ${s.present} present · ${s.missing} missing · ${s.invalid} invalid · ${s.drifted} drifted · ${s.optional_absent} optional-absent (of ${s.total}; ${s.required} required)`);
  L(report.ready
    ? `RESULT: READY — every required key for ${report.environment} is present and valid.`
    : `RESULT: NOT READY — ${s.missing + s.invalid} required key(s) MISSING/INVALID. (Report-only unless --enforce.)`);
}

// =============================================================================
// Self-test / PROBE — the offline proof of the four verdicts (no network/env).
// Drives the FULL evaluateKey() path with INJECTED planes, plus the rule engine
// and the no-secret-values guarantee. Sprint 1.2 acceptance evidence.
// =============================================================================
function selfTest() {
  const cases = [];
  const assert = (name, cond) => cases.push({ name, ok: !!cond });

  // ---- Rule engine (validate-the-validator) --------------------------------
  assert("6543 pooler URL is VALID", validate("postgres-pooler-6543", "postgres://postgres.abc:pw@aws-0-eu-central-1.pooler.supabase.com:6543/postgres").ok === true);
  const direct5432 = validate("postgres-pooler-6543", "postgres://postgres.abc:pw@db.abc.supabase.co:5432/postgres");
  assert("direct :5432 URL is INVALID (port)", direct5432.ok === false && /6543/.test(direct5432.message));
  assert("non-postgres scheme is INVALID", validate("postgres-pooler-6543", "https://example.com").ok === false);
  assert("empty DATABASE_URL is MISSING", validate("postgres-pooler-6543", "").missing === true);
  assert("good https URL is VALID", validate("url", "https://x.supabase.co").ok === true);
  assert("garbage URL is INVALID", validate("url", "not a url").ok === false);
  assert("short secret is INVALID", validate("secret-min:16", "short").ok === false);
  assert("long secret is VALID", validate("secret-min:16", "0123456789abcdef0").ok === true);
  assert("enum match is VALID", validate("enum:en|nl", "nl").ok === true);
  assert("enum miss is INVALID", validate("enum:en|nl", "de").ok === false);
  assert("present flag is VALID", validate("flag", "1").ok === true);
  assert("int-nonneg accepts 0", validate("int-nonneg", "0").ok === true);
  assert("int-nonneg rejects -1", validate("int-nonneg", "-1").ok === false);

  // Vercel sensitive-var classification (the false-negative regression guard).
  assert("sensitive var (value '') is PRESENT, not blank", classifyVercelEnv({ key: "DATABASE_URL", type: "sensitive", value: "" }).blank === false);
  assert("non-sensitive empty value IS blank", classifyVercelEnv({ key: "FOO", type: "encrypted", value: "" }).blank === true);

  // ---- THE FOUR VERDICTS via the full evaluateKey() path (injected planes) --
  // Fixture canonical keys.
  const kReqDb = { key: "DATABASE_URL", owner: "platform", source_provider: "local", data_class: "SECRET", env_scope: ["dev"], validation_rule: "postgres-pooler-6543", required_per_env: { dev: true } };
  const kReqMissing = { key: "TICK_TOKEN", owner: "platform", source_provider: "local", data_class: "SECRET", env_scope: ["dev"], validation_rule: "secret-min:16", required_per_env: { dev: true } };
  const kInvalid = { key: "PUBLIC_BASE_URL", owner: "platform", source_provider: "local", data_class: "INTERNAL", env_scope: ["dev"], validation_rule: "url", required_per_env: { dev: true } };
  const kLocalOnly = { key: "DEV_SEED_TOKEN", owner: "platform", source_provider: "vercel", data_class: "SECRET", env_scope: ["local"], validation_rule: "secret-min:16", required_per_env: { local: true } };

  const SECRET_SENTINEL = "postgres://postgres.abc:supersecretpw@aws-0-eu-central-1.pooler.supabase.com:6543/postgres";

  // (1) PRESENT — required key, valid value on the local plane.
  const vPresent = evaluateKey(kReqDb, "dev", { vercel: { available: false, reason: "n/a" }, github: { available: false }, local: { DATABASE_URL: SECRET_SENTINEL } });
  assert("PRESENT: required+valid local secret → PRESENT", vPresent.state === "PRESENT");

  // (2) MISSING — required key, absent everywhere.
  const vMissing = evaluateKey(kReqMissing, "dev", { vercel: { available: false, reason: "n/a" }, github: { available: false }, local: {} });
  assert("MISSING: required+absent → MISSING", vMissing.state === "MISSING");

  // (3) INVALID — present but fails the validation rule.
  const vInvalid = evaluateKey(kInvalid, "dev", { vercel: { available: false, reason: "n/a" }, github: { available: false }, local: { PUBLIC_BASE_URL: "not a url" } });
  assert("INVALID: present but rule-fails → INVALID", vInvalid.state === "INVALID");

  // (4) DRIFTED — a local-only SECRET found present on the Vercel prod plane.
  const vDrift = evaluateKey(kLocalOnly, "prod", {
    vercel: { available: true, present: new Map([["DEV_SEED_TOKEN", { blank: false, sensitive: true }]]) },
    github: { available: false },
    local: null,
  });
  assert("DRIFTED: out-of-scope SECRET on prod plane → DRIFTED", vDrift.state === "DRIFTED");

  // ---- NO-SECRET-VALUES guarantee -----------------------------------------
  // Build a full report whose local plane holds a sentinel secret, then assert the
  // serialized report NEVER contains the secret value.
  const reg = {
    schema_version: "config-secret-registry/v1",
    service: "selftest",
    environments: ["dev"],
    planes: {},
    keys: [kReqDb],
  };
  const report = buildReport(reg, "dev", { vercel: { available: false, reason: "n/a" }, github: { available: false }, local: { DATABASE_URL: SECRET_SENTINEL } }, "<memory>");
  const serialized = JSON.stringify(report);
  assert("no-secret-values: report never contains the secret value", !serialized.includes("supersecretpw"));
  assert("no-secret-values: report DOES contain the key name", serialized.includes("DATABASE_URL"));

  // ---- requiredness / scope resolution ------------------------------------
  assert("per-env required resolves", isRequired({ required_per_env: { prod: true, dev: false } }, "prod") === true);
  assert("per-env optional resolves", isRequired({ required_per_env: { prod: true, dev: false } }, "dev") === false);
  assert("isSecret(SECRET) true", isSecret({ data_class: "SECRET" }) === true);
  assert("isSecret(PII) true", isSecret({ data_class: "PII" }) === true);
  assert("isSecret(INTERNAL) false", isSecret({ data_class: "INTERNAL" }) === false);

  // ---- legacy → canonical normalization ------------------------------------
  const legacy = {
    service: "legacy-svc",
    environments: ["development", "production"],
    platforms: { vercel: {}, github: { repo: "x/y" } },
    keys: [
      { name: "DATABASE_URL", purpose: "db", owner: "vercel-env", rule: "postgres-pooler-6543", required: { production: true, development: true }, example: "<redacted>" },
      { name: "AUTH_JWT_SECRET", purpose: "jwt", owner: "supabase", rule: "secret-min:32", required: { production: true, development: false }, example: "<redacted>" },
      { name: "VERCEL_TOKEN", purpose: "ci", owner: "github-secret", rule: "non-empty", required: { production: true, development: false }, example: "<redacted>" },
    ],
  };
  const canon = normalizeRegistry(legacy, "<legacy>");
  assert("legacy: name→key", canon.keys[0].key === "DATABASE_URL");
  assert("legacy: production→prod env", canon.environments.includes("prod"));
  assert("legacy: vercel-env→vercel provider", canon.keys[0].source_provider === "vercel");
  assert("legacy: secret-min→SECRET data_class (inferred)", canon.keys[1].data_class === "SECRET" && canon.keys[1].data_class_inferred === true);
  assert("legacy: github-secret→SECRET + github provider", canon.keys[2].data_class === "SECRET" && canon.keys[2].source_provider === "github");
  assert("legacy: required.production→required_per_env.prod", canon.keys[0].required_per_env.prod === true);

  const failed = cases.filter((c) => !c.ok);
  for (const c of cases) process.stdout.write(`${c.ok ? "PASS" : "FAIL"}  ${c.name}\n`);
  process.stdout.write(`\nI-Config self-test: ${cases.length - failed.length}/${cases.length} passed.\n`);
  process.exit(failed.length === 0 ? 0 : 1);
}

// --- entrypoint --------------------------------------------------------------
if (opts.selfTest) selfTest();
else run().catch((e) => fail(2, e && e.stack ? e.stack : String(e)));
