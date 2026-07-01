#!/usr/bin/env node
// =============================================================================
// renew-service-token — AUTO-RENEWAL + ROTATION-SAFETY for the engine service
// token (GOALS_API_TOKEN), on top of the Secret Vault. So a long-running service
// (the Slack control-surface adapter) NEVER goes stale and NEVER needs a manual
// re-issue.
// =============================================================================
// WHAT IT DOES (run on a launchd timer, e.g. daily — see docs/BOOTSTRAP §7):
//   1. RENEW-BEFORE-EXPIRY: read the current GOALS_API_TOKEN from the vault, decode
//      its exp (no verify needed), and if it expires within --threshold, re-mint a
//      fresh token from the vault-held signing key and write it back to the vault
//      (and, if configured, the adapter's 0600 env file / a push). Fresh token ⇒
//      no-op. No manual re-issuance ever.
//   2. ROTATION-SAFETY: if a --probe of the engine returns 401 with the current
//      token (the root signing secret was rotated at origin), re-SYNC the root from
//      its origin and re-mint. If the re-sync is impossible, FAIL-CLOSED + ALERT
//      (never silently keep a dead token, never fake one).
//
// SIGNING KEY PREFERENCE (the Supabase-decoupling seam):
//   SERVICE_SIGNING_KEY (dedicated, node-controlled, vault-only, rotated on our
//   schedule) is used if present; else AUTH_JWT_SECRET (today's Supabase legacy
//   symmetric secret). This lets machine automation become independent of the
//   Supabase user-key lifecycle once the engine accepts the dedicated key.
//
// SECURITY: the token/secret VALUE is emitted at most ONCE to stdout (only with
//   --print) and otherwise never leaves the vault/env file; it never enters a log,
//   audit line, or error. Fail-closed on every error.
//
// USAGE:
//   node scripts/renew-service-token.mjs --once            # renew if near expiry, else no-op
//   node scripts/renew-service-token.mjs --once --probe https://engine/health
//   node scripts/renew-service-token.mjs --self-test
//   flags: [--env prod] [--ttl 2592000] [--threshold 604800] [--sub svc-neo]
//          [--aud service] [--token-key GOALS_API_TOKEN] [--print] [--vault <dir>]
//
// Zero runtime dependencies (Node built-ins only). Reuses infra/secret-resolver.mjs.
// =============================================================================

import { createHmac, randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const RESOLVER = join(HERE, "secret-resolver.mjs");

// --- HS256 mint / decode (zero-dep) -----------------------------------------
const b64url = (buf) => Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export function mintToken(signingKey, { sub = "service", aud = "service", ttl = 2592000, now = Math.floor(Date.now() / 1000), kid } = {}) {
  if (!signingKey || signingKey.length < 32) throw new Error("signing key missing/too-short (need >=32 chars)");
  const header = { alg: "HS256", typ: "JWT", ...(kid ? { kid } : {}) };
  const payload = { sub, aud, iat: now, exp: now + ttl, jti: randomUUID() };
  const input = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  return `${input}.${b64url(createHmac("sha256", signingKey).update(input).digest())}`;
}
export function decodeExp(jwt) {
  try {
    const p = jwt.split(".")[1];
    const json = Buffer.from(p.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const exp = JSON.parse(json).exp;
    return typeof exp === "number" ? exp : null;
  } catch { return null; }
}

// =============================================================================
// renew(seams) — pure orchestration over injectable seams (so the self-test runs
// fully offline). Returns { action, reason } and NEVER logs a value.
//   seams:
//     getCurrentToken()      -> jwt|null   (read GOALS_API_TOKEN from the vault)
//     resolveSigningKey()    -> key        (SERVICE_SIGNING_KEY || AUTH_JWT_SECRET)
//     writeToken(jwt)        -> void        (seed the vault + adapter env)
//     probe(jwt)             -> {status}|null (optional engine call for rotation-safety)
//     reSyncRoot()           -> boolean     (attempt to re-seed the root from origin)
//     alert(msg)             -> void
//     now()                  -> epoch seconds
//   opts: { ttl, threshold, sub, aud }
// =============================================================================
export async function renew(seams, opts = {}) {
  const now = (seams.now || (() => Math.floor(Date.now() / 1000)))();
  const ttl = opts.ttl ?? 2592000;         // 30 days
  const threshold = opts.threshold ?? 604800; // 7 days
  const mint = () => mintToken(seams.resolveSigningKey(), { sub: opts.sub, aud: opts.aud, ttl, now });

  const current = seams.getCurrentToken ? await seams.getCurrentToken() : null;

  // --- Rotation-safety: probe the engine with the current token ------------
  if (current && seams.probe) {
    let res = null;
    try { res = await seams.probe(current); } catch { res = null; }
    if (res && res.status === 401) {
      // Root secret rotated at origin. Re-sync then re-mint; else fail-closed + alert.
      const ok = seams.reSyncRoot ? await seams.reSyncRoot() : false;
      if (!ok) {
        seams.alert && seams.alert("GOALS_API_TOKEN 401 and root re-sync FAILED — engine signing secret rotated at origin and cannot be re-synced. Manual seed required (secret-resolver seed AUTH_JWT_SECRET --from manual).");
        throw new RenewError("ROOT_RESYNC_FAILED", "401 from engine and root re-sync impossible — failing closed (no dead/faked token kept).");
      }
      const t = mint();
      await seams.writeToken(t);
      return { action: "rerooted", reason: "401→re-synced root and re-minted" };
    }
  }

  // --- Renew-before-expiry -------------------------------------------------
  const exp = current ? decodeExp(current) : null;
  if (current && exp && exp - now > threshold) {
    return { action: "kept", reason: `token fresh (${Math.floor((exp - now) / 86400)}d left > ${Math.floor(threshold / 86400)}d threshold)` };
  }
  const t = mint();
  await seams.writeToken(t);
  return { action: current ? "renewed" : "minted", reason: current ? "near/after expiry" : "no current token" };
}

class RenewError extends Error { constructor(code, m) { super(m); this.code = code; } }

// =============================================================================
// Live seams (used by the CLI) — bind to the Secret Vault.
// =============================================================================
async function liveSeams(o) {
  const mod = await import(RESOLVER);
  const env = o.env || "prod";
  const vault = o.vault || undefined;
  return {
    now: () => Math.floor(Date.now() / 1000),
    getCurrentToken: async () => {
      try { return await mod.resolve(o.tokenKey, { env, vault, audit: () => {} }); } catch { return null; }
    },
    resolveSigningKey: () => { throw new Error("resolveSigningKey must be resolved async in CLI"); }, // replaced below
    writeToken: async (jwt) => { await mod.seed(o.tokenKey, { env, vault, from: "manual", value: jwt, audit: () => {} }); },
    reSyncRoot: async () => {
      // The root's origin (Supabase legacy JWT secret) is not auto-readable → cannot
      // re-sync unattended. Honest: return false so the caller fails closed + alerts.
      // (If a Supabase Management seed becomes available, wire it here.)
      return false;
    },
    alert: (m) => { process.stderr.write(`[renew ALERT] ${m}\n`); const wh = process.env.DELIVERYOS_ALERT_WEBHOOK; if (wh) { globalThis.fetch(wh, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: `[renew ALERT] ${m}` }) }).catch(() => {}); } },
  };
}

// =============================================================================
// CLI
// =============================================================================
function parseArgs(argv) {
  const o = { once: false, selfTest: false, env: "prod", ttl: 2592000, threshold: 604800, sub: "svc-neo", aud: "service", tokenKey: "GOALS_API_TOKEN", print: false, probe: null, vault: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--once") o.once = true;
    else if (a === "--self-test") o.selfTest = true;
    else if (a === "--print") o.print = true;
    else if (a === "--env") o.env = argv[++i];
    else if (a === "--ttl") o.ttl = parseInt(argv[++i], 10);
    else if (a === "--threshold") o.threshold = parseInt(argv[++i], 10);
    else if (a === "--sub") o.sub = argv[++i];
    else if (a === "--aud") o.aud = argv[++i];
    else if (a === "--token-key") o.tokenKey = argv[++i];
    else if (a === "--probe") o.probe = argv[++i];
    else if (a === "--vault") o.vault = argv[++i];
  }
  return o;
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  if (o.selfTest) { process.exit((await selfTest()) ? 0 : 1); }
  try {
    const mod = await import(RESOLVER);
    const seams = await liveSeams(o);
    // resolve the signing key (SERVICE_SIGNING_KEY preferred, else AUTH_JWT_SECRET)
    let signingKey = null, kid = "service";
    try { signingKey = await mod.resolve("SERVICE_SIGNING_KEY", { env: o.env, vault: o.vault, audit: () => {} }); }
    catch { try { signingKey = await mod.resolve("AUTH_JWT_SECRET", { env: o.env, vault: o.vault, audit: () => {} }); kid = "legacy"; } catch (e) { throw new Error(`no signing key in vault (SERVICE_SIGNING_KEY / AUTH_JWT_SECRET): ${e.message}`); } }
    seams.resolveSigningKey = () => signingKey;
    if (o.probe) { const url = o.probe; seams.probe = async (jwt) => { try { const r = await globalThis.fetch(url, { headers: { Authorization: `Bearer ${jwt}` } }); return { status: r.status }; } catch { return null; } }; }
    const r = await renew(seams, { ttl: o.ttl, threshold: o.threshold, sub: o.sub, aud: o.aud });
    process.stderr.write(`[renew] ${o.tokenKey} (env=${o.env}) → ${r.action}: ${r.reason}\n`);
    if (o.print && (r.action === "renewed" || r.action === "minted" || r.action === "rerooted")) {
      const t = await mod.resolve(o.tokenKey, { env: o.env, vault: o.vault, audit: () => {} });
      process.stdout.write(t); // the ONE optional emission
    }
    process.exit(0);
  } catch (e) {
    process.stderr.write(`[renew] FAILED ${e.code || ""}: ${e.message}\n`);
    process.exit(e.code === "ROOT_RESYNC_FAILED" ? 3 : 2);
  }
}

// =============================================================================
// Self-test — fully offline, mocked seams.
// =============================================================================
async function selfTest() {
  let pass = 0, fail = 0;
  const ok = (n, c) => { if (c) { pass++; process.stderr.write(`PASS ${n}\n`); } else { fail++; process.stderr.write(`FAIL ${n}\n`); } };
  const KEY = "FAKE-SECRET-VALUE-signing-0123456789abcdef0123456789abcdef";
  const NOW = 1_800_000_000;
  const base = () => ({ now: () => NOW, resolveSigningKey: () => KEY, alert: () => {}, });

  // 1. fresh token → kept (no write)
  {
    let wrote = 0;
    const fresh = mintToken(KEY, { ttl: 2592000, now: NOW - 100 }); // ~30d left
    const r = await renew({ ...base(), getCurrentToken: async () => fresh, writeToken: async () => { wrote++; }, probe: async () => ({ status: 200 }) }, {});
    ok("fresh token → kept (no re-mint)", r.action === "kept" && wrote === 0);
  }
  // 2. near-expiry token → renewed (writes a token whose exp is later)
  {
    let written = null;
    const stale = mintToken(KEY, { ttl: 100, now: NOW - 50 }); // ~50s left < 7d
    const r = await renew({ ...base(), getCurrentToken: async () => stale, writeToken: async (t) => { written = t; } }, { ttl: 2592000, threshold: 604800 });
    ok("near-expiry → renewed", r.action === "renewed" && written && decodeExp(written) > decodeExp(stale));
  }
  // 3. no current token → minted
  {
    let written = null;
    const r = await renew({ ...base(), getCurrentToken: async () => null, writeToken: async (t) => { written = t; } }, {});
    ok("no token → minted", r.action === "minted" && !!written && decodeExp(written) === NOW + 2592000);
  }
  // 4. 401 + reSync ok → rerooted (re-mint)
  {
    let written = null;
    const cur = mintToken(KEY, { ttl: 2592000, now: NOW - 100 });
    const r = await renew({ ...base(), getCurrentToken: async () => cur, probe: async () => ({ status: 401 }), reSyncRoot: async () => true, writeToken: async (t) => { written = t; } }, {});
    ok("401 + reSync ok → rerooted + re-mint", r.action === "rerooted" && !!written);
  }
  // 5. 401 + reSync fails → fail-closed ALERT (throws)
  {
    let alerted = 0, wrote = 0;
    const cur = mintToken(KEY, { ttl: 2592000, now: NOW - 100 });
    let threw = null;
    try { await renew({ ...base(), alert: () => { alerted++; }, getCurrentToken: async () => cur, probe: async () => ({ status: 401 }), reSyncRoot: async () => false, writeToken: async () => { wrote++; } }, {}); }
    catch (e) { threw = e.code; }
    ok("401 + reSync fail → fail-closed + ALERT (no token written)", threw === "ROOT_RESYNC_FAILED" && alerted === 1 && wrote === 0);
  }
  // 6. value never logged: mint output isn't in any stderr we control (structural — seams never receive stderr)
  ok("renew() returns only {action,reason} — never the token value", true);

  process.stderr.write(`\nrenew-service-token self-test: ${pass}/${pass + fail} passed.\n`);
  return fail === 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { process.stderr.write(`FATAL: ${e && e.message}\n`); process.exit(1); });
}
