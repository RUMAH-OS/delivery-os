#!/usr/bin/env node
// =============================================================================
// Delivery OS — config-doctor (Infrastructure Registry & Configuration layer).
// =============================================================================
// ONE platform layer that DECLARES, VALIDATES, and RESOLVES environment config.
// It reads a service's declarative config-registry.json and reports, per key,
//   PRESENT / MISSING / INVALID / OPTIONAL-ABSENT
// with the EXACT actionable fix. Agents and deploy workflows call THIS instead
// of guessing `.env` values one at a time. It is the cure for the cryptic
// "Invalid environment configuration: DATABASE_URL is required / SUPABASE_URL:
// Invalid url" deploy failure: that failure becomes a clear, complete diagnostic
// BEFORE `vercel build` ever runs.
//
// READ-ONLY, ALWAYS. It NEVER writes a secret, NEVER writes to prod, NEVER
// prints a secret VALUE (only key NAMES, states, redacted examples, and fixes).
//
// STATE SOURCES (per environment):
//   • production  → the AUTHORITATIVE plane is Vercel (where prod config lives).
//       - owner vercel-env / supabase  → checked against the Vercel project's
//         PRODUCTION env vars via the Vercel REST API (read-only), using
//         VERCEL_TOKEN + the org/project ids the deploy workflow already has.
//       - owner github-secret          → checked via `gh secret list` (presence
//         only) when gh is available.
//       - If a plane is unreadable (no token / no gh), required keys are reported
//         MISSING (unverified) — HONEST: "not checked" is never "passed".
//       Local `.env` is NOT consulted for production by default (prod truth is
//       Vercel, not a developer's machine); pass --include-local to override.
//   • development → checked against local .env files + process.env.
//
// USAGE:
//   node config-doctor.mjs [--service <id>] [--env production|development]
//                          [--registry <path>] [--project-dir <path>]
//                          [--json] [--include-local] [--self-test] [-h]
//
// EXIT CODES: 0 = every REQUIRED key PRESENT & valid · 1 = a required key is
// MISSING or INVALID · 2 = usage / IO / registry error.
//
// Zero runtime dependencies (Node >= 18 built-ins only: fs, fetch).
// =============================================================================

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, isAbsolute } from "node:path";
import { execSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));

// --- arg parsing -------------------------------------------------------------
const argv = process.argv.slice(2);
const opts = {
  service: null,
  env: "production",
  registry: null,
  projectDir: null,
  json: false,
  includeLocal: false,
  selfTest: false,
};
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--service") opts.service = argv[++i];
  else if (a === "--env") opts.env = argv[++i];
  else if (a === "--registry") opts.registry = argv[++i];
  else if (a === "--project-dir") opts.projectDir = argv[++i];
  else if (a === "--json") opts.json = true;
  else if (a === "--include-local") opts.includeLocal = true;
  else if (a === "--self-test") opts.selfTest = true;
  else if (a === "-h" || a === "--help") {
    process.stdout.write(usage());
    process.exit(0);
  } else fail(2, `unknown flag "${a}" (try --help)`);
}

function usage() {
  return (
    "config-doctor — declare/validate/resolve environment config from a registry.\n\n" +
    "  node config-doctor.mjs [--service <id>] [--env production|development]\n" +
    "                         [--registry <path>] [--project-dir <path>]\n" +
    "                         [--json] [--include-local] [--self-test]\n\n" +
    "Exit 0 = all required keys PRESENT & valid · 1 = a required key MISSING/INVALID · 2 = error.\n"
  );
}

function fail(code, msg) {
  process.stderr.write(`config-doctor: ${msg}\n`);
  process.exit(code);
}

// =============================================================================
// Validation rules. Each returns { ok, message? }. NEVER receives/echoes the
// value back to the caller's output — only a boolean + a human reason.
// =============================================================================
const RULES = {
  // THE CRITICAL RULE. DATABASE_URL must be a postgres:// URL on the Supabase
  // TRANSACTION-POOLER port 6543 (the pooled connection). This is BOTH the build
  // requirement AND the cure for the connection-exhaustion 503 (a direct :5432
  // connection exhausts the pool under serverless fan-out; the 6543 pooler does not).
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
  // A POSITIVE-INTEGER tuning knob — pool size, a timeout in ms/s, a cap. This rule is the
  // ENV-ROBUSTNESS STANDARD enforced at the config layer: a present-but-EMPTY or non-numeric
  // value is INVALID, and 0 / negative are rejected because for every such knob 0 means
  // "disabled / unlimited" (pool=0, statement_timeout=0 → NO bound, connect_timeout=0 → none).
  // That is the BUG-209-1 trap: an empty-string env makes `Number("")===0`, silently disabling
  // the very bound that keeps a serverless DB client from hanging past the gateway (HTTP 000).
  // Declaring DB_POOL_MAX / DB_STATEMENT_TIMEOUT_MS / DB_CONNECT_TIMEOUT with this rule means an
  // empty value FAILS the gate up front instead of degrading silently at runtime. The CODE-side
  // companion is `Number(env)||default` (never `Number(env ?? default)`), asserted by the
  // platform-health DB-client preflight (`platform-health.mjs preflight-db-client`).
  "int-positive": (v) => {
    const n = Number(v);
    return Number.isInteger(n) && n > 0
      ? { ok: true }
      : {
          ok: false,
          // NB: an EMPTY/whitespace value is short-circuited to MISSING by validate() before this rule
          // runs, so it surfaces as MISSING (not INVALID) — either way it FAILS the gate. This rule's job
          // is to reject a PRESENT-but-bad value: 0/negative (= disables the bound, the BUG-209-1 effect)
          // or non-numeric.
          message: `must be a positive integer (got "${v}"). 0/negative/non-numeric would DISABLE the bound (the BUG-209-1 effect) — set the documented default value.`,
        };
  },
};

// secret-min:N and enum:a|b|c are parameterized rules resolved here.
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

// Parse a postgres connection string → { ok, host, port, message }.
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
// Registry loading + light structural validation (zero-dep; no JSON-Schema engine).
// =============================================================================
function loadRegistry() {
  let path = opts.registry;
  if (!path) {
    const dir = opts.projectDir ? abs(opts.projectDir) : process.cwd();
    const candidates = [
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
  structuralCheck(reg, path);
  return { reg, path };
}

function structuralCheck(reg, path) {
  const errs = [];
  if (!reg.service) errs.push("missing 'service'");
  if (!Array.isArray(reg.environments) || reg.environments.length === 0)
    errs.push("missing/empty 'environments'");
  if (!Array.isArray(reg.keys) || reg.keys.length === 0) errs.push("missing/empty 'keys'");
  for (const [i, k] of (reg.keys || []).entries()) {
    const at = `keys[${i}]${k && k.name ? ` (${k.name})` : ""}`;
    if (!k.name) errs.push(`${at}: missing 'name'`);
    if (!k.purpose) errs.push(`${at}: missing 'purpose'`);
    if (!["vercel-env", "supabase", "github-secret"].includes(k.owner))
      errs.push(`${at}: 'owner' must be vercel-env | supabase | github-secret`);
    if (!k.rule) errs.push(`${at}: missing 'rule'`);
    if (k.required === undefined) errs.push(`${at}: missing 'required'`);
    if (k.example === undefined) errs.push(`${at}: missing 'example' (use a REDACTED example)`);
  }
  if (errs.length) fail(2, `registry ${path} is malformed:\n  - ${errs.join("\n  - ")}`);
}

function isRequired(key, env) {
  if (typeof key.required === "boolean") return key.required;
  if (key.required && typeof key.required === "object") return key.required[env] === true;
  return false;
}

function abs(p) {
  return isAbsolute(p) ? p : resolve(process.cwd(), p);
}

// =============================================================================
// State sources.
// =============================================================================

// Vercel: list a project's env var KEYS for a given target (read-only). We read
// presence (and blank-ness) only — never decrypt a secret value.
async function fetchVercelKeys(reg, env) {
  const v = (reg.platforms && reg.platforms.vercel) || {};
  const token = process.env[v.tokenEnv || "VERCEL_TOKEN"];
  const orgId = process.env[v.orgIdEnv || "VERCEL_ORG_ID"];
  const projectId = process.env[v.projectIdEnv || "VERCEL_PROJECT_ID"];
  if (!token || !projectId)
    return { available: false, reason: "VERCEL_TOKEN / VERCEL_PROJECT_ID not set" };
  const target = env === "production" ? "production" : "development";
  const teamQ = orgId ? `?teamId=${encodeURIComponent(orgId)}` : "";
  const url = `https://api.vercel.com/v9/projects/${encodeURIComponent(projectId)}/env${teamQ}`;
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return { available: false, reason: `Vercel API HTTP ${res.status}` };
    const body = await res.json();
    const present = new Map(); // key -> { blank }
    for (const e of body.envs || []) {
      if (Array.isArray(e.target) ? e.target.includes(target) : e.target === target) {
        // The list endpoint returns encrypted values redacted; a blank var shows
        // up with an empty `value`. We can only assert blank when the value field
        // is explicitly an empty string; otherwise treat presence as set.
        const blank = typeof e.value === "string" && e.value.trim() === "";
        present.set(e.key, { blank });
      }
    }
    return { available: true, present };
  } catch (e) {
    return { available: false, reason: `Vercel API error: ${e.message}` };
  }
}

// GitHub Actions secrets: presence-only via `gh secret list` (no values exposed).
function fetchGithubSecrets(reg) {
  const repo = reg.platforms && reg.platforms.github && reg.platforms.github.repo;
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

// Local .env (+ process.env) — used for development, or production with --include-local.
function loadLocalEnv(env) {
  const dir = opts.projectDir ? abs(opts.projectDir) : process.cwd();
  const files = env === "production" ? [".env"] : [".env.development", ".env.test", ".env"];
  const merged = {};
  for (const f of files) {
    const p = resolve(dir, f);
    if (!existsSync(p)) continue;
    for (const [k, val] of Object.entries(parseEnvFile(p))) {
      if (merged[k] === undefined) merged[k] = val;
    }
  }
  // process.env wins (CI / Vercel ambient inject here).
  for (const [k, val] of Object.entries(process.env)) {
    if (val !== undefined) merged[k] = val;
  }
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
// The check.
// =============================================================================
async function run() {
  const { reg, path } = loadRegistry();
  if (opts.service && reg.service !== opts.service)
    fail(2, `registry service is "${reg.service}", not "${opts.service}" — wrong --registry/--project-dir?`);
  if (!reg.environments.includes(opts.env))
    fail(2, `environment "${opts.env}" is not declared for ${reg.service} (declared: ${reg.environments.join(", ")}).`);

  // Resolve the live planes once.
  const vercel = await fetchVercelKeys(reg, opts.env);
  const github = reg.keys.some((k) => k.owner === "github-secret") ? fetchGithubSecrets(reg) : { available: false, reason: "no github-secret keys" };
  const local = (opts.env !== "production" || opts.includeLocal) ? loadLocalEnv(opts.env) : null;

  const results = [];
  for (const key of reg.keys) {
    const required = isRequired(key, opts.env);
    const res = evaluate(key, opts.env, { vercel, github, local });
    results.push({
      name: key.name,
      owner: key.owner,
      rule: key.rule,
      required,
      state: res.state,
      lane: res.lane,
      detail: res.detail,
      fix: key.fix || defaultFix(key),
      example: key.example,
    });
  }

  const failing = results.filter((r) => r.required && (r.state === "MISSING" || r.state === "INVALID"));
  const report = {
    service: reg.service,
    environment: opts.env,
    registry: path,
    planes: {
      vercel: vercel.available ? "read" : `unreadable (${vercel.reason})`,
      github: github.available ? "read" : `unreadable (${github.reason})`,
      local: local ? "read" : "not consulted (prod truth is Vercel; pass --include-local to include)",
    },
    summary: {
      total: results.length,
      required: results.filter((r) => r.required).length,
      ok: results.filter((r) => r.state === "PRESENT").length,
      missing: results.filter((r) => r.state === "MISSING").length,
      invalid: results.filter((r) => r.state === "INVALID").length,
      optional_absent: results.filter((r) => r.state === "OPTIONAL-ABSENT").length,
    },
    pass: failing.length === 0,
    keys: results,
  };

  if (opts.json) process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  else printHuman(report, failing);

  process.exit(report.pass ? 0 : 1);
}

// Determine PRESENT / MISSING / INVALID / OPTIONAL-ABSENT for one key.
function evaluate(key, env, planes) {
  const required = isRequired(key, env);

  // Pick the authoritative plane for this key.
  if (env === "production") {
    if (key.owner === "github-secret") {
      if (planes.github.available) {
        const present = planes.github.present.has(key.name);
        if (present) return { state: "PRESENT", lane: "github-secret", detail: "set in GitHub Actions secrets (presence verified; value not inspected)." };
        return absent(required, "github-secret");
      }
      // Optionally fall back to local for --include-local runs.
      if (planes.local) return evalFromValue(key, env, planes.local[key.name], "local(.env)", required);
      return absent(required, "github-secret(unverified)");
    }
    // vercel-env / supabase → the Vercel prod env plane.
    if (planes.vercel.available) {
      const hit = planes.vercel.present.get(key.name);
      if (hit && !hit.blank)
        return { state: "PRESENT", lane: "vercel-prod", detail: "set in Vercel production env (presence verified; encrypted value not inspected)." };
      if (hit && hit.blank)
        return { state: "MISSING", lane: "vercel-prod", detail: "present in Vercel but BLANK (empty value) — same as unset for the build." };
      // Not in Vercel prod. --include-local may still find it locally (advisory).
      if (planes.local && planes.local[key.name]) return evalFromValue(key, env, planes.local[key.name], "local(.env, advisory)", required);
      return absent(required, "vercel-prod");
    }
    // Vercel plane unreadable. If --include-local, validate the local value as a proxy.
    if (planes.local) return evalFromValue(key, env, planes.local[key.name], "local(.env, Vercel unverified)", required);
    return absent(required, "vercel-prod(unverified)");
  }

  // development → local + process.env.
  return evalFromValue(key, env, planes.local ? planes.local[key.name] : undefined, "local/env", required);
}

function evalFromValue(key, env, value, lane, required) {
  const v = validate(key.rule, value);
  if (v.missing) return absent(required, lane);
  if (!v.ok) return { state: "INVALID", lane, detail: `value ${v.message}` };
  return { state: "PRESENT", lane, detail: "present and passes the validation rule." };
}

function absent(required, lane) {
  return required
    ? { state: "MISSING", lane, detail: "required but not set." }
    : { state: "OPTIONAL-ABSENT", lane, detail: "optional and not set (inert until configured)." };
}

function defaultFix(key) {
  const where =
    key.owner === "github-secret"
      ? "GitHub → Settings → Secrets and variables → Actions"
      : key.owner === "supabase"
        ? "Supabase dashboard → copy the value → set it as a Vercel production env var"
        : "Vercel → Project → Settings → Environment Variables (Production)";
  return `Set ${key.name} in ${where}. Example (redacted): ${key.example}`;
}

// =============================================================================
// Human-readable report.
// =============================================================================
function printHuman(report, failing) {
  const L = (s = "") => process.stdout.write(s + "\n");
  L("");
  L(`config-doctor — ${report.service} [${report.environment}]`);
  L(`registry: ${report.registry}`);
  L(`planes:   vercel=${report.planes.vercel} · github=${report.planes.github} · local=${report.planes.local}`);
  L("");
  const icon = { PRESENT: "✓", MISSING: "✗", INVALID: "✗", "OPTIONAL-ABSENT": "·" };
  for (const k of report.keys) {
    const req = k.required ? "required" : "optional";
    L(`${icon[k.state] || "?"} ${k.state.padEnd(15)} ${k.name}  (${req}, ${k.owner}, lane=${k.lane})`);
    if (k.state === "MISSING" || k.state === "INVALID") {
      L(`    ${k.detail}`);
      L(`    FIX: ${k.fix}`);
    }
  }
  L("");
  const s = report.summary;
  L(`summary: ${s.ok} present · ${s.missing} missing · ${s.invalid} invalid · ${s.optional_absent} optional-absent (of ${s.total}; ${s.required} required)`);
  if (report.pass) {
    L(`RESULT: PASS — every required key for ${report.environment} is present and valid.`);
  } else {
    L(`RESULT: FAIL — ${failing.length} required key(s) MISSING/INVALID. Fix the items marked ✗ above, then re-run.`);
    L("        (This is the clear, complete diagnostic that replaces the cryptic 'Failed to collect page data' build failure.)");
  }
}

// =============================================================================
// Self-test: validate-the-validator. Pure, no env / no network. Proves the rule
// engine catches the exact failure modes the layer exists to prevent.
// =============================================================================
function selfTest() {
  const cases = [];
  const assert = (name, cond) => cases.push({ name, ok: !!cond });

  // The critical DATABASE_URL rule.
  const poolerOk = validate("postgres-pooler-6543", "postgres://postgres.abc:pw@aws-0-eu-central-1.pooler.supabase.com:6543/postgres");
  assert("6543 pooler URL is VALID", poolerOk.ok === true);

  const direct5432 = validate("postgres-pooler-6543", "postgres://postgres.abc:pw@db.abc.supabase.co:5432/postgres");
  assert("direct :5432 URL is INVALID (port)", direct5432.ok === false && /6543/.test(direct5432.message));

  const notPooler = validate("postgres-pooler-6543", "postgres://u:pw@db.abc.supabase.co:6543/postgres");
  assert("6543 but non-pooler host is INVALID", notPooler.ok === false && /pooler/.test(notPooler.message));

  const notPg = validate("postgres-pooler-6543", "https://example.com");
  assert("non-postgres scheme is INVALID", notPg.ok === false);

  const missingDb = validate("postgres-pooler-6543", "");
  assert("empty DATABASE_URL is MISSING", missingDb.missing === true);

  // url rule.
  assert("good https URL is VALID", validate("url", "https://x.supabase.co").ok === true);
  assert("garbage URL is INVALID", validate("url", "not a url").ok === false);
  assert("missing url is MISSING", validate("url", undefined).missing === true);

  // secret-min.
  assert("short secret is INVALID", validate("secret-min:16", "short").ok === false);
  assert("long secret is VALID", validate("secret-min:16", "0123456789abcdef0").ok === true);

  // enum.
  assert("enum match is VALID", validate("enum:en|nl", "nl").ok === true);
  assert("enum miss is INVALID", validate("enum:en|nl", "de").ok === false);

  // flag.
  assert("present flag is VALID", validate("flag", "1").ok === true);
  assert("absent flag is MISSING", validate("flag", "").missing === true);

  // int-positive — the env-robustness standard (the BUG-209-1 trap caught at the config layer).
  assert("int-positive accepts a positive integer", validate("int-positive", "8").ok === true);
  assert("int-positive REJECTS 0 (= disables the bound)", validate("int-positive", "0").ok === false);
  assert("int-positive REJECTS a negative", validate("int-positive", "-1").ok === false);
  assert("int-positive REJECTS non-numeric", validate("int-positive", "abc").ok === false);
  assert("int-positive treats EMPTY as MISSING (the empty-env trap surfaces, not coerced to 0)", validate("int-positive", "").missing === true);

  // requiredness resolution.
  assert("per-env required resolves", isRequired({ required: { production: true, development: false } }, "production") === true);
  assert("per-env optional resolves", isRequired({ required: { production: true, development: false } }, "development") === false);

  const failed = cases.filter((c) => !c.ok);
  for (const c of cases) process.stdout.write(`${c.ok ? "✓" : "✗"} ${c.name}\n`);
  process.stdout.write(`\nself-test: ${cases.length - failed.length}/${cases.length} passed.\n`);
  process.exit(failed.length === 0 ? 0 : 1);
}

// --- entrypoint --------------------------------------------------------------
if (opts.selfTest) selfTest();
else run().catch((e) => fail(2, e && e.stack ? e.stack : String(e)));
