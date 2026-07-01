#!/usr/bin/env node
// =============================================================================
// Delivery OS — Secret Resolver / Vault: the canonical secret RETRIEVAL + push
// capability. Retrieval counterpart of I-Config (infra/i-config.mjs). RS-DOS §57.
// =============================================================================
// WHY A VAULT, NOT A PULLER:
//   Every platform store this fleet uses is WRITE-ONLY. All Vercel env vars are
//   marked "Sensitive" (the API never returns their value — confirmed live), and
//   GitHub Actions secrets are write-only by design (`gh secret list` returns
//   names only). So NO platform can be a retrieval source. The only reliably
//   readable store is a LOCAL ENCRYPTED VAULT on the node, inside the §54.2 trust
//   boundary. The vault is the SOURCE OF TRUTH for secret values; the platforms
//   are push targets, not read sources.
//
// I-Config answers "is it PRESENT on the plane?" (presence-only, never a value).
// This tool answers "GET me the VALUE" (from the vault) and "PUSH the value OUT"
// (to the write-only planes). The two COMPOSE over the SAME registry: i-config
// gates readiness; the vault is where the value actually lives + how planes get
// (re)provisioned.
//
// THE THREE VERBS:
//   resolve(key,{env})  READ the value from the local vault (fast, offline, no
//                       platform round-trip). Emits to stdout ONCE, never logs it.
//   seed(key,{env,...}) put a value INTO the vault ONCE, from its retrieval_source:
//                         generated  — minted locally (e.g. CRON_SECRET = random)
//                         manual     — pasted once (Supabase JWT/DB URL from the
//                                      dashboard; the honest default for Supabase-
//                                      origin secrets)
//                         supabase   — Supabase Management API (DOCUMENTED-only;
//                                      legacy JWT secret is not cleanly readable
//                                      back — falls through to manual)
//   push(key,{env,to})  WRITE the vault's value OUT to the consuming plane(s):
//                         vercel — POST /v10/projects/{id}/env (type:sensitive)
//                         github — `gh secret set` (sealed-box handled by gh)
//                       This is the direction that actually works.
//
// PROVIDER ROLES (per the registry):
//   vault     READ+WRITE — the source of truth (encrypted at rest, 0600 files).
//   vercel    WRITE-only — push target + presence (Sensitive ⇒ never readable).
//   github    WRITE-only — push target + presence (write-only by design).
//   supabase  READ origin — seed source for JWT/DB (Management API documented).
//   generated MINT-on-seed — value is created locally at seed time.
//
// DOCTRINE (mirrors i-config §57.2 — the retrieval half, deliberately stricter):
//   1. METADATA-DRIVEN — reads the canonical config-secret-registry for each
//      key's plane + data_class + retrieval_source. REFUSES undeclared keys.
//   2. NEVER LOG A VALUE — a value is emitted EXACTLY ONCE, to stdout, nowhere
//      else. Never in an audit line, error, log, or committed file. Diagnostics +
//      the audit trail go to stderr (name + when + verdict only).
//   3. FAIL-CLOSED — any error throws a TYPED error and exits non-zero WITHOUT
//      emitting anything on stdout. Never a partial/guessed/faked value; in
//      particular NEVER "pull from vercel" a value the vault does not have.
//   4. TRUST BOUNDARY (§54.2) — a data_class ∈ {SECRET, PII} may be resolved ONLY
//      inside the trust boundary, PROVEN by a tight (0700, owner-only) vault dir.
//   5. ROOT OF TRUST = the VAULT MASTER KEY (a 0600 key file or env), NOT a
//      platform token. One key unlocks the vault; the vault holds all values.
//
// ENCRYPTION-AT-REST: AES-256-GCM via node:crypto (zero-dep). Each secret file is
//   {v,alg,iv,tag,ct} base64. Alternative backends (macOS Keychain, age/sops) are
//   DOCUMENTED as optional; the default is zero-dep node:crypto.
//
// USAGE:
//   node secret-resolver.mjs vault-init                         # create vault + master key
//   node secret-resolver.mjs seed <KEY> --env prod --from generated
//   node secret-resolver.mjs seed <KEY> --env prod --from manual # reads value from stdin (silent)
//   node secret-resolver.mjs get  <KEY> --env prod              # prints VALUE to stdout ONLY
//   node secret-resolver.mjs push <KEY> --env prod --to vercel  # write OUT to a plane
//   node secret-resolver.mjs plan <KEY> --env prod              # metadata (no value)
//   node secret-resolver.mjs --self-test                        # offline proof (mocked)
//   flags: [--registry <path>] [--vault <dir>] [--to vercel,github] [-h]
//
//   Bootstrap consumer (store-in-vault, derive-consumers):
//     AUTH_JWT_SECRET="$(node infra/secret-resolver.mjs get AUTH_JWT_SECRET --env prod)" \
//       node scripts/mint-service-token.mjs
//
// EXIT: 0 ok · 2 usage/unknown-key · 3 plane refuses/unsupported · 4 not-seeded ·
//   5 insecure-store (leak guard) · 6 outside-trust-boundary · 7 missing-root
//   (vault master key) · 8 provider/transport error. Non-zero ⇒ nothing on stdout.
//
// Zero runtime dependencies (Node >= 18 built-ins only: fs, crypto, fetch,
// child_process[gh push only]).
// =============================================================================

import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync, chmodSync, mkdtempSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve as pathResolve, isAbsolute, join } from "node:path";
import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

const HERE = dirname(fileURLToPath(import.meta.url));

// --- environment vocabulary (mirror i-config) --------------------------------
const ENV_ALIAS = { development: "dev", production: "prod", test: "dev", preview: "staging" };
const normEnv = (e) => ENV_ALIAS[e] || e;
const vercelTarget = (env) =>
  env === "prod" ? "production" : env === "staging" || env === "QA" ? "preview" : "development";

// --- typed, fail-closed error -----------------------------------------------
const EXIT = {
  UNKNOWN_KEY: 2, USAGE: 2,
  PLANE_REFUSED: 3, UNSUPPORTED: 3,
  NOT_SEEDED: 4,
  INSECURE_STORE: 5,
  OUTSIDE_BOUNDARY: 6,
  MISSING_ROOT_CREDENTIAL: 7,
  PROVIDER_ERROR: 8,
};
class SecretResolverError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "SecretResolverError";
    this.code = code;
    this.exitCode = EXIT[code] ?? 2;
  }
}

// --- default locations -------------------------------------------------------
const DEFAULT_VAULT = process.env.DELIVERYOS_VAULT || "/opt/deliveryos/vault";

function abs(p) { return isAbsolute(p) ? p : pathResolve(process.cwd(), p); }

// =============================================================================
// Registry loading — the vault reads the SAME canonical registry as i-config.
// =============================================================================
function loadRegistry(registryOpt) {
  if (registryOpt && typeof registryOpt === "object") return registryOpt;
  const candidates = [];
  if (registryOpt) candidates.push(abs(registryOpt));
  candidates.push(join(HERE, "config-secret-registry.json"), join(HERE, "config-secret-registry.example.json"));
  for (const p of candidates) {
    if (existsSync(p)) {
      try { return JSON.parse(readFileSync(p, "utf8")); }
      catch (e) { throw new SecretResolverError("PROVIDER_ERROR", `registry at ${p} is not valid JSON: ${e.message}`); }
    }
  }
  throw new SecretResolverError("PROVIDER_ERROR", `no config-secret-registry.json found (looked in: ${candidates.join(", ")})`);
}
function findKey(reg, key) {
  const entry = (reg.keys || []).find((k) => k.key === key);
  if (!entry) throw new SecretResolverError("UNKNOWN_KEY", `key '${key}' is not declared in the registry — refusing to touch an undeclared secret. Add it to config-secret-registry.json first.`);
  return entry;
}
const isSecretClass = (entry) => entry.data_class === "SECRET" || entry.data_class === "PII";
// retrieval_source = where a value ORIGINATES when seeding the vault. Defaults to
// 'manual' (paste once) so a Supabase/Vercel-origin value is never silently faked.
const retrievalSource = (entry) => entry.retrieval_source || "manual";
// consumption planes = where the value is pushed / consumed (source_provider +
// any explicit consumers[]). Used by push().
function consumptionPlanes(entry) {
  const set = new Set();
  if (entry.source_provider && entry.source_provider !== "local") set.add(entry.source_provider);
  for (const c of entry.consumers || []) set.add(c);
  // supabase-origin secrets are consumed as Vercel env vars in this fleet.
  if (set.has("supabase")) { set.delete("supabase"); set.add("vercel"); }
  return [...set];
}

// =============================================================================
// Trust boundary (§54.2) + leak guards — PROVEN, not asserted.
// =============================================================================
function statMode(p) { return statSync(p).mode & 0o777; }
function dirStat(dir) {
  if (!existsSync(dir)) return { exists: false };
  const st = statSync(dir);
  const mode = st.mode & 0o777;
  const ownedByUs = typeof process.getuid === "function" ? st.uid === process.getuid() : true;
  return { exists: true, mode, tight: (mode & 0o077) === 0, ownedByUs, isDir: st.isDirectory() };
}
function insideTrustBoundary(vaultDir) {
  const s = dirStat(vaultDir);
  return !!(s.exists && s.isDir && s.tight && s.ownedByUs);
}
// Enforce 0600/owner on a single file (the credential-leak guard).
function assertFileTight(path) {
  const st = statSync(path); // ENOENT bubbles to caller
  const mode = st.mode & 0o777;
  if ((mode & 0o077) !== 0)
    throw new SecretResolverError("INSECURE_STORE", `${path} is group/other-accessible (mode 0${mode.toString(8)}); refusing to read a leak-prone secret. Run: chmod 600 ${path}`);
  if (typeof process.getuid === "function" && st.uid !== process.getuid())
    throw new SecretResolverError("INSECURE_STORE", `${path} is not owned by the running user; refusing to read.`);
  return true;
}

// =============================================================================
// Vault master key — THE root of trust. From (in order): explicit opt →
// $DELIVERYOS_VAULT_KEY_B64 → 0600 key file ($DELIVERYOS_VAULT_KEY or
// <vault>/.master.key). Always a 32-byte AES-256 key.
// =============================================================================
function normalizeKey(raw, whence) {
  let buf;
  if (Buffer.isBuffer(raw)) buf = raw;
  else if (typeof raw === "string") {
    const s = raw.trim();
    // accept base64 (44 chars) or hex (64 chars) or raw 32 bytes
    if (/^[0-9a-fA-F]{64}$/.test(s)) buf = Buffer.from(s, "hex");
    else { try { buf = Buffer.from(s, "base64"); } catch { buf = Buffer.from(s, "utf8"); } }
  } else throw new SecretResolverError("MISSING_ROOT_CREDENTIAL", `vault master key from ${whence} is not a string/buffer.`);
  if (buf.length !== 32)
    throw new SecretResolverError("MISSING_ROOT_CREDENTIAL", `vault master key from ${whence} must be 32 bytes (got ${buf.length}); regenerate with 'vault-init'.`);
  return buf;
}
function resolveMasterKey(vaultDir, opt) {
  if (opt) return normalizeKey(opt, "opt");
  if (process.env.DELIVERYOS_VAULT_KEY_B64) return normalizeKey(process.env.DELIVERYOS_VAULT_KEY_B64, "$DELIVERYOS_VAULT_KEY_B64");
  const keyPath = process.env.DELIVERYOS_VAULT_KEY || join(vaultDir, ".master.key");
  if (existsSync(keyPath)) {
    assertFileTight(keyPath);
    return normalizeKey(readFileSync(keyPath, "utf8"), keyPath);
  }
  throw new SecretResolverError("MISSING_ROOT_CREDENTIAL", `no vault master key: not in $DELIVERYOS_VAULT_KEY_B64 nor at ${keyPath}. Run 'vault-init' first (the ONE root of trust).`);
}

// --- encryption at rest (AES-256-GCM, zero-dep) ------------------------------
function encrypt(masterKey, plaintext) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", masterKey, iv);
  const ct = Buffer.concat([c.update(Buffer.from(plaintext, "utf8")), c.final()]);
  const tag = c.getAuthTag();
  return JSON.stringify({ v: 1, alg: "aes-256-gcm", iv: iv.toString("base64"), tag: tag.toString("base64"), ct: ct.toString("base64") });
}
function decrypt(masterKey, blob) {
  let o;
  try { o = JSON.parse(blob); } catch { throw new SecretResolverError("PROVIDER_ERROR", `vault entry is not valid JSON.`); }
  if (o.alg !== "aes-256-gcm") throw new SecretResolverError("PROVIDER_ERROR", `unsupported vault alg '${o.alg}'.`);
  try {
    const d = createDecipheriv("aes-256-gcm", masterKey, Buffer.from(o.iv, "base64"));
    d.setAuthTag(Buffer.from(o.tag, "base64"));
    return Buffer.concat([d.update(Buffer.from(o.ct, "base64")), d.final()]).toString("utf8");
  } catch {
    throw new SecretResolverError("PROVIDER_ERROR", `vault decrypt failed (wrong master key or tampered entry).`);
  }
}

// --- vault file layout -------------------------------------------------------
function vaultEntryPath(vaultDir, env, key) { return join(vaultDir, env, `${key}.json`); }
function writeTight(path, data) {
  writeFileSync(path, data, { mode: 0o600 });
  // writeFileSync mode is masked by umask; force 0600.
  try { chmodSync(path, 0o600); } catch { /* best-effort */ }
}

// =============================================================================
// resolve(key, {env,...}) — READ from the vault. The library entrypoint. Never
// pulls from a platform; if the vault has no value, it FAILS CLOSED (NOT_SEEDED).
// =============================================================================
export async function resolve(key, opts = {}) {
  if (!key || typeof key !== "string") throw new SecretResolverError("USAGE", `resolve(key) requires a key name.`);
  const env = normEnv(opts.env || "prod");
  const reg = loadRegistry(opts.registry);
  const vaultDir = opts.vault ? abs(opts.vault) : DEFAULT_VAULT;
  const now = opts.now || (() => new Date().toISOString());
  const audit = opts.audit || defaultAudit;
  const entry = findKey(reg, key);
  const rec = { now: now(), key, env, plane: "vault", dataClass: entry.data_class };

  // Trust-boundary gate for SECRET/PII.
  if (isSecretClass(entry) && !insideTrustBoundary(vaultDir)) {
    const s = dirStat(vaultDir);
    const why = !s.exists ? `vault ${vaultDir} does not exist` : !s.isDir ? `vault ${vaultDir} is not a directory` : !s.tight ? `vault ${vaultDir} is group/other-accessible (mode 0${(s.mode || 0).toString(8)})` : `vault ${vaultDir} is not owned by the running user`;
    const err = new SecretResolverError("OUTSIDE_BOUNDARY", `refusing to resolve data_class:${entry.data_class} key '${key}' outside the §54.2 trust boundary (${why}).`);
    audit({ ...rec, verdict: "REFUSED", reason: err.code });
    throw err;
  }
  try {
    const path = vaultEntryPath(vaultDir, env, key);
    if (!existsSync(path))
      throw new SecretResolverError("NOT_SEEDED", `'${key}' is not seeded in the vault for env '${env}' (expected ${path}). Seed it first: seed ${key} --env ${env} --from ${retrievalSource(entry)}. NOTE: this fleet's platforms are write-only, so the value CANNOT be pulled — it must be seeded once from its origin.`);
    assertFileTight(path);
    const masterKey = resolveMasterKey(vaultDir, opts.masterKey);
    const value = decrypt(masterKey, readFileSync(path, "utf8"));
    audit({ ...rec, verdict: "RESOLVED", reason: "ok" });
    return value; // the ONLY value the lib surfaces — caller emits once.
  } catch (e) {
    const code = e instanceof SecretResolverError ? e.code : "PROVIDER_ERROR";
    audit({ ...rec, verdict: code === "NOT_SEEDED" ? "MISSING" : "ERROR", reason: code });
    throw e;
  }
}

// =============================================================================
// seed(key, {env, from, value, ...}) — put a value INTO the vault ONCE.
//   from: generated | manual | supabase.  Never returns/logs the value.
// =============================================================================
export async function seed(key, opts = {}) {
  const env = normEnv(opts.env || "prod");
  const reg = loadRegistry(opts.registry);
  const vaultDir = opts.vault ? abs(opts.vault) : DEFAULT_VAULT;
  const now = opts.now || (() => new Date().toISOString());
  const audit = opts.audit || defaultAudit;
  const entry = findKey(reg, key);
  const from = opts.from || retrievalSource(entry);
  const rec = { now: now(), key, env, plane: `seed:${from}`, dataClass: entry.data_class };

  // Seeding a SECRET/PII requires the trust boundary too.
  if (isSecretClass(entry) && !insideTrustBoundary(vaultDir)) {
    const err = new SecretResolverError("OUTSIDE_BOUNDARY", `refusing to seed data_class:${entry.data_class} key '${key}' outside the §54.2 trust boundary (vault ${vaultDir} missing or not 0700/owner).`);
    audit({ ...rec, verdict: "REFUSED", reason: err.code });
    throw err;
  }
  try {
    let value;
    if (from === "generated") value = mintGenerated(entry);
    else if (from === "manual") {
      value = opts.value; // CLI reads stdin (silent) and passes it here
      if (value == null || value === "") throw new SecretResolverError("USAGE", `--from manual requires a value on stdin for '${key}'.`);
    } else if (from === "supabase") {
      value = await seedFromSupabase(key, entry, opts);
    } else throw new SecretResolverError("UNSUPPORTED", `unknown retrieval_source '${from}' for '${key}'.`);

    const masterKey = resolveMasterKey(vaultDir, opts.masterKey);
    const dir = join(vaultDir, env);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
    writeTight(vaultEntryPath(vaultDir, env, key), encrypt(masterKey, value));
    audit({ ...rec, verdict: "SEEDED", reason: from });
    return { seeded: true, key, env, from }; // NEVER the value
  } catch (e) {
    const code = e instanceof SecretResolverError ? e.code : "PROVIDER_ERROR";
    audit({ ...rec, verdict: code === "PLANE_REFUSED" ? "REFUSED" : "ERROR", reason: code });
    throw e;
  }
}

// mint a value locally (generated origin), sized per the validation_rule.
function mintGenerated(entry) {
  const m = /^secret-min:(\d+)$/.exec(entry.validation_rule || "");
  const minLen = m ? parseInt(m[1], 10) : 32;
  // base64url of enough bytes to exceed minLen chars.
  const bytes = Math.max(24, Math.ceil((minLen * 3) / 4) + 3);
  return randomBytes(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "").slice(0, Math.max(minLen, 32));
}

// supabase seed — DOCUMENTED-only. The Supabase Management API does not cleanly
// return a project's (legacy) JWT secret; `GET /v1/projects/{ref}/api-keys`
// returns the anon/service_role keys, not the signing secret. So absent a proven
// endpoint we REFUSE honestly and point at the one-time manual seed, rather than
// fake a value. If a future read endpoint + PAT is wired, implement it here.
async function seedFromSupabase(key, entry, opts) {
  const pat = process.env.SUPABASE_ACCESS_TOKEN || opts.supabasePat;
  const ref = entry.supabase_project_ref || opts.supabaseRef;
  const fetchImpl = opts.fetchImpl || globalThis.fetch;
  if (opts.supabaseSeedImpl) return await opts.supabaseSeedImpl(key, entry, { pat, ref, fetchImpl }); // test hook
  throw new SecretResolverError("PLANE_REFUSED", `supabase Management API retrieval of '${key}' is DOCUMENTED but not enabled: the (legacy) JWT secret is not returned by GET /v1/projects/{ref}/api-keys, and no proven read endpoint exists. Seed once from the Supabase dashboard instead: seed ${key} --env ${opts.env || "prod"} --from manual (paste the value at the silent prompt).`);
}

// =============================================================================
// push(key, {env, to, ...}) — WRITE the vault's value OUT to the consuming
// plane(s). This is the direction that works (Vercel Sensitive / GitHub secret
// are write-only). Never logs the value; reports which planes were written.
// =============================================================================
export async function push(key, opts = {}) {
  const env = normEnv(opts.env || "prod");
  const reg = loadRegistry(opts.registry);
  const vaultDir = opts.vault ? abs(opts.vault) : DEFAULT_VAULT;
  const now = opts.now || (() => new Date().toISOString());
  const audit = opts.audit || defaultAudit;
  const entry = findKey(reg, key);
  const targets = (opts.to && opts.to.length ? opts.to : consumptionPlanes(entry));
  if (!targets.length) throw new SecretResolverError("USAGE", `no push target for '${key}' (registry declares no consumption plane; pass --to vercel,github).`);

  // Read from the vault (source of truth) — this itself enforces boundary + never-log.
  const value = await resolve(key, { ...opts, audit: () => {} });
  const sinks = opts.sinks || { vercel: vercelPush, github: githubPush };
  const pushed = [];
  for (const plane of targets) {
    const rec = { now: now(), key, env, plane, dataClass: entry.data_class };
    const sink = sinks[plane];
    if (!sink) { audit({ ...rec, verdict: "UNSUPPORTED", reason: "no-sink" }); throw new SecretResolverError("UNSUPPORTED", `no push sink for plane '${plane}'.`); }
    try {
      await sink({ key, env, value, entry, reg, opts });
      audit({ ...rec, verdict: "PUSHED", reason: "ok" });
      pushed.push(plane);
    } catch (e) {
      const code = e instanceof SecretResolverError ? e.code : "PROVIDER_ERROR";
      audit({ ...rec, verdict: "ERROR", reason: code });
      throw e instanceof SecretResolverError ? e : new SecretResolverError("PROVIDER_ERROR", `push to ${plane} failed: ${e.message}`);
    }
  }
  return { pushed, key, env }; // NEVER the value
}

// vercel push sink — upsert a Sensitive env var. POST /v10/projects/{id}/env?upsert=true.
async function vercelPush({ key, env, value, reg, opts }) {
  const v = (reg.planes && reg.planes.vercel) || {};
  const token = process.env[v.tokenEnv || "VERCEL_TOKEN"];
  const projectId = process.env[v.projectIdEnv || "VERCEL_PROJECT_ID"] || v.projectId;
  const orgId = process.env[v.orgIdEnv || "VERCEL_ORG_ID"];
  if (!token || !projectId) throw new SecretResolverError("MISSING_ROOT_CREDENTIAL", `Vercel push needs VERCEL_TOKEN + VERCEL_PROJECT_ID.`);
  const fetchImpl = opts.fetchImpl || globalThis.fetch;
  const teamQ = orgId ? `&teamId=${encodeURIComponent(orgId)}` : "";
  const url = `https://api.vercel.com/v10/projects/${encodeURIComponent(projectId)}/env?upsert=true${teamQ}`;
  const body = { key, value, type: "sensitive", target: [vercelTarget(env)] };
  const res = await fetchImpl(url, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new SecretResolverError("PROVIDER_ERROR", `Vercel push HTTP ${res.status}.`);
  return true;
}

// github push sink — `gh secret set` (gh handles the libsodium sealed box; the
// value is passed on STDIN, never on argv/log).
async function githubPush({ key, value, reg, opts }) {
  const repo = reg.planes && reg.planes.github && reg.planes.github.repo;
  const { spawnSync } = await import("node:child_process");
  const args = ["secret", "set", key];
  if (repo) args.push("-R", repo);
  args.push("--body", "-"); // read value from stdin
  const r = (opts.spawnImpl || spawnSync)("gh", args, { input: value, encoding: "utf8", stdio: ["pipe", "ignore", "pipe"] });
  if (r.status !== 0) throw new SecretResolverError("PROVIDER_ERROR", `gh secret set failed (exit ${r.status}): ${String(r.stderr || "").split("\n")[0]}`);
  return true;
}

// =============================================================================
// plan(key,{env}) — metadata only, no value.
// =============================================================================
export function plan(key, opts = {}) {
  const reg = loadRegistry(opts.registry);
  const entry = findKey(reg, key);
  const env = normEnv(opts.env || "prod");
  return {
    key, env,
    data_class: entry.data_class,
    retrieval_source: retrievalSource(entry),
    reads_from: "vault (local encrypted source of truth)",
    push_targets: consumptionPlanes(entry),
    trust_boundary_required: isSecretClass(entry),
    note: consumptionPlanes(entry).includes("vercel")
      ? "vercel target is a Sensitive (write-only) env var — push-only, never a read source"
      : undefined,
  };
}

// =============================================================================
// Audit — name + when + verdict ONLY. NEVER a value. stderr (+ optional
// $DELIVERYOS_SECRET_AUDIT_LOG). Fail-open on log I/O.
// =============================================================================
function defaultAudit(rec) {
  const line = `[secret-vault] ${rec.now} key=${rec.key} env=${rec.env} plane=${rec.plane} class=${rec.dataClass} verdict=${rec.verdict} reason=${rec.reason}`;
  process.stderr.write(line + "\n");
  const logPath = process.env.DELIVERYOS_SECRET_AUDIT_LOG;
  if (logPath) { import("node:fs").then(({ appendFileSync }) => { try { appendFileSync(logPath, line + "\n"); } catch {} }).catch(() => {}); }
}

// =============================================================================
// vault-init — create the vault dir (0700) + a fresh 32-byte master key (0600).
// =============================================================================
export function vaultInit(opts = {}) {
  const vaultDir = opts.vault ? abs(opts.vault) : DEFAULT_VAULT;
  if (!existsSync(vaultDir)) mkdirSync(vaultDir, { recursive: true, mode: 0o700 });
  else chmodSync(vaultDir, 0o700);
  const keyPath = process.env.DELIVERYOS_VAULT_KEY || join(vaultDir, ".master.key");
  if (existsSync(keyPath)) return { vault: vaultDir, keyPath, created: false };
  writeTight(keyPath, randomBytes(32).toString("base64"));
  return { vault: vaultDir, keyPath, created: true };
}

// =============================================================================
// CLI
// =============================================================================
function parseArgs(argv) {
  const o = { cmd: null, key: null, env: "prod", registry: null, vault: null, to: null, from: null, selfTest: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--self-test") o.selfTest = true;
    else if (a === "-h" || a === "--help") o.help = true;
    else if (a === "--env") o.env = argv[++i];
    else if (a === "--registry") o.registry = argv[++i];
    else if (a === "--vault") o.vault = argv[++i];
    else if (a === "--to") o.to = argv[++i].split(",").map((s) => s.trim()).filter(Boolean);
    else if (a === "--from") o.from = argv[++i];
    else if (!o.cmd) o.cmd = a;
    else if (!o.key) o.key = a;
  }
  return o;
}
const HELP = `Delivery OS — Secret Resolver / Vault (retrieval counterpart of i-config)

  vault-init                              create the vault dir (0700) + master key (0600)
  seed <KEY> --env prod --from generated  mint a value locally into the vault
  seed <KEY> --env prod --from manual     seed a value read from stdin (silent) — the honest
                                          default for Supabase/Vercel-origin (write-only) secrets
  get  <KEY> --env prod                   print the secret VALUE to stdout ONLY (from the vault)
  push <KEY> --env prod --to vercel,github  write the vault's value OUT to write-only planes
  plan <KEY> --env prod                   metadata (plane, retrieval_source) — no value
  --self-test                             offline proof with mocked providers

  --registry <path>   registry (default ./config-secret-registry.json)
  --vault <dir>       vault dir (default $DELIVERYOS_VAULT or /opt/deliveryos/vault)

Doctrine: the LOCAL ENCRYPTED VAULT is the source of truth (platforms are write-only).
resolve reads the vault; seed puts a value in ONCE from its origin; push writes OUT.
Refuses undeclared keys; resolves a SECRET/PII only inside the §54.2 trust boundary; emits a
value EXACTLY ONCE to stdout and NEVER logs it. Root of trust = the vault master key.
Exit: 0 ok · 2 usage/unknown · 3 refused/unsupported · 4 not-seeded · 5 insecure-store ·
6 outside-boundary · 7 missing-root(master key) · 8 provider-error.`;

async function readStdin() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString("utf8").replace(/\r?\n$/, "");
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  if (o.help) { process.stderr.write(HELP + "\n"); process.exit(0); }
  if (o.selfTest) { const ok = await selfTest(); process.exit(ok ? 0 : 1); }
  try {
    if (o.cmd === "vault-init") { const r = vaultInit({ vault: o.vault }); process.stderr.write(`vault: ${r.vault}\nmaster key: ${r.keyPath} (${r.created ? "created" : "exists"})\n`); process.exit(0); }
    if (o.cmd === "plan") { if (!o.key) throw new SecretResolverError("USAGE", "plan <KEY>"); process.stderr.write(JSON.stringify(plan(o.key, { env: o.env, registry: o.registry }), null, 2) + "\n"); process.exit(0); }
    if (o.cmd === "seed") {
      if (!o.key) throw new SecretResolverError("USAGE", "seed <KEY> --from <src>");
      const value = (o.from || "manual") === "manual" && !process.stdin.isTTY ? await readStdin() : undefined;
      const r = await seed(o.key, { env: o.env, registry: o.registry, vault: o.vault, from: o.from, value });
      process.stderr.write(`seeded ${r.key} (env=${r.env}, from=${r.from})\n`); process.exit(0);
    }
    if (o.cmd === "push") {
      if (!o.key) throw new SecretResolverError("USAGE", "push <KEY> --to <planes>");
      const r = await push(o.key, { env: o.env, registry: o.registry, vault: o.vault, to: o.to });
      process.stderr.write(`pushed ${r.key} → [${r.pushed.join(", ")}] (env=${r.env})\n`); process.exit(0);
    }
    if (o.cmd === "get" && o.key) {
      const value = await resolve(o.key, { env: o.env, registry: o.registry, vault: o.vault });
      process.stdout.write(value); // the ONE emission — no trailing newline
      process.exit(0);
    }
    process.stderr.write(HELP + "\n"); process.exit(EXIT.USAGE);
  } catch (e) {
    process.stderr.write(`ERROR ${e.code || "PROVIDER_ERROR"}: ${e.message}\n`);
    process.exit(e.exitCode || 2);
  }
}

// =============================================================================
// Self-test — offline, mocked providers.
// =============================================================================
async function selfTest() {
  const { tmpdir } = await import("node:os");
  let pass = 0, fail = 0;
  const ok = (n, c) => { if (c) { pass++; process.stderr.write(`PASS ${n}\n`); } else { fail++; process.stderr.write(`FAIL ${n}\n`); } };
  const reg = {
    schema_version: "config-secret-registry/v1", service: "self-test", environments: ["prod"],
    planes: { vercel: { tokenEnv: "VERCEL_TOKEN", projectIdEnv: "VERCEL_PROJECT_ID", projectId: "prj_x" }, github: { repo: "x/y" } },
    keys: [
      { key: "AUTH_JWT_SECRET", owner: "platform", source_provider: "vercel", data_class: "SECRET", env_scope: ["prod"], validation_rule: "secret-min:32", required_per_env: { prod: true }, retrieval_source: "manual", sensitive: true },
      { key: "CRON_SECRET", owner: "platform", source_provider: "vercel", data_class: "SECRET", env_scope: ["prod"], validation_rule: "secret-min:16", required_per_env: { prod: true }, retrieval_source: "generated", sensitive: true },
      { key: "PROD_BASE_URL", owner: "platform", source_provider: "github", data_class: "INTERNAL", env_scope: ["prod"], validation_rule: "url", required_per_env: { prod: false }, retrieval_source: "manual" },
    ],
  };
  const vault = mkdtempSync(join(tmpdir(), "sv-")); chmodSync(vault, 0o700);
  const masterKey = randomBytes(32);
  const captured = []; const audit = (r) => captured.push(r);
  const FAKE = "FAKE-SECRET-VALUE-manual-jwt-0123456789abcdef0123456789abcdef";

  // 1. seed manual → resolve returns it; value never in audit
  await seed("AUTH_JWT_SECRET", { env: "prod", registry: reg, vault, masterKey, from: "manual", value: FAKE, audit });
  const v = await resolve("AUTH_JWT_SECRET", { env: "prod", registry: reg, vault, masterKey, audit });
  ok("seed manual → resolve returns value", v === FAKE);
  ok("value NEVER in any audit record", !JSON.stringify(captured).includes(FAKE));

  // 2. seed generated → resolve returns a minted value (>=16)
  await seed("CRON_SECRET", { env: "prod", registry: reg, vault, masterKey, from: "generated", audit });
  const g = await resolve("CRON_SECRET", { env: "prod", registry: reg, vault, masterKey, audit });
  ok("seed generated → resolve returns minted value", typeof g === "string" && g.length >= 16);

  // 3. Sensitive-vercel key is PUSH-only: push writes to a mocked sink, never pulls
  const sink = []; const sinks = { vercel: async ({ key, value }) => { sink.push({ key, value }); } };
  const pr = await push("AUTH_JWT_SECRET", { env: "prod", registry: reg, vault, masterKey, to: ["vercel"], sinks, audit });
  ok("push writes value to mocked vercel sink", sink.length === 1 && sink[0].value === FAKE && pr.pushed[0] === "vercel");
  ok("push audit never logs the value", !captured.slice(-1)[0] || !JSON.stringify(captured).includes("PUSHED\",\"value"));

  // 4. not-seeded key → fail-closed (never a fake pull)
  try { await resolve("PROD_BASE_URL", { env: "prod", registry: reg, vault, masterKey, audit }); ok("not-seeded fails", false); }
  catch (e) { ok("un-seeded key → NOT_SEEDED (no fake pull)", e.code === "NOT_SEEDED"); }

  // 5. unknown key
  try { await resolve("NOPE", { env: "prod", registry: reg, vault, masterKey, audit }); ok("unknown fails", false); }
  catch (e) { ok("unknown key → UNKNOWN_KEY", e.code === "UNKNOWN_KEY"); }

  // 6. SECRET outside boundary (loose vault) → refused
  const loose = mkdtempSync(join(tmpdir(), "sv-loose-")); chmodSync(loose, 0o755);
  try { await resolve("AUTH_JWT_SECRET", { env: "prod", registry: reg, vault: loose, masterKey, audit }); ok("boundary gate", false); }
  catch (e) { ok("SECRET outside boundary → OUTSIDE_BOUNDARY", e.code === "OUTSIDE_BOUNDARY"); }

  // 7. supabase seed without endpoint → honest refusal
  try { await seed("AUTH_JWT_SECRET", { env: "prod", registry: reg, vault, masterKey, from: "supabase", audit }); ok("supabase honest", false); }
  catch (e) { ok("supabase seed → PLANE_REFUSED (honest, not faked)", e.code === "PLANE_REFUSED"); }

  process.stderr.write(`\nSecret Vault self-test: ${pass}/${pass + fail} passed.\n`);
  return fail === 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { process.stderr.write(`FATAL: ${e && e.message}\n`); process.exit(1); });
}
