#!/usr/bin/env node
// =============================================================================
// Secret Resolver / Vault — independent proof (MOCKED providers only).
// Zero deps. Run: node infra/secret-resolver.test.mjs
//
// The vault is the SOURCE OF TRUTH (every platform is write-only). Providers are
// mocked: seed from generated/manual/(mocked)supabase; resolve reads the local
// encrypted vault; push writes to mocked vercel/github SINKS. NO real secret is
// touched; the only "secrets" are obvious sentinels ("FAKE-SECRET-VALUE-*").
//
// Proves the load-bearing guarantees:
//   1. seed(manual) → resolve returns the value; the value NEVER appears in any
//      stderr/audit output (never-log). Encrypted-at-rest on disk (ciphertext ≠ value).
//   2. seed(generated) → resolve returns a locally-minted value (>= min length).
//   3. a Sensitive-Vercel key is PUSH-ONLY: resolve reads from the VAULT (never a
//      "pull from vercel"); push writes the value to mocked vercel + github sinks;
//      the value is written but never logged.
//   4. an un-seeded key → NOT_SEEDED fail-closed (no fabricated/pulled value).
//   5. unknown key → UNKNOWN_KEY; missing master key → MISSING_ROOT_CREDENTIAL.
//   6. data_class gate: a SECRET resolves only inside the §54.2 trust boundary.
//   7. leak guard: a non-0600 vault entry / master key → INSECURE_STORE.
//   8. supabase origin: honest refusal by default; a mocked supabase seed hook works.
//   9. CLI: seed→get emits the value to stdout ONLY; stderr carries the audit line,
//      never the value.
// =============================================================================

import { resolve as vaultResolve, seed, push, plan, vaultInit } from "./secret-resolver.mjs";
import { mkdtempSync, writeFileSync, readFileSync, chmodSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const results = [];
const check = (name, cond, extra = "") => { if (cond) { pass++; results.push(`PASS ${name}`); } else { fail++; results.push(`FAIL ${name}${extra ? " — " + extra : ""}`); } };

// --- fixtures ----------------------------------------------------------------
const FAKE_JWT = "FAKE-SECRET-VALUE-jwt-0123456789abcdef0123456789abcdef";
const FAKE_URL = "https://fake.example.test/base";

const REG = {
  schema_version: "config-secret-registry/v1", service: "vault-test", environments: ["prod"],
  planes: { vercel: { tokenEnv: "VERCEL_TOKEN", projectIdEnv: "VERCEL_PROJECT_ID", projectId: "prj_test" }, github: { repo: "RUMAH-OS/vault-test" } },
  keys: [
    { key: "AUTH_JWT_SECRET", owner: "platform", source_provider: "vercel", data_class: "SECRET", env_scope: ["prod"], validation_rule: "secret-min:32", required_per_env: { prod: true }, retrieval_source: "manual", sensitive: true, consumers: ["github"] },
    { key: "CRON_SECRET", owner: "platform", source_provider: "vercel", data_class: "SECRET", env_scope: ["prod"], validation_rule: "secret-min:16", required_per_env: { prod: true }, retrieval_source: "generated", sensitive: true },
    { key: "PROD_BASE_URL", owner: "platform", source_provider: "github", data_class: "INTERNAL", env_scope: ["prod"], validation_rule: "url", required_per_env: { prod: false }, retrieval_source: "manual" },
    { key: "DATABASE_URL", owner: "platform", source_provider: "vercel", data_class: "SECRET", env_scope: ["prod"], validation_rule: "postgres-pooler-6543", required_per_env: { prod: true }, retrieval_source: "supabase", sensitive: true },
  ],
};

const tightVault = () => { const d = mkdtempSync(join(tmpdir(), "sv-")); chmodSync(d, 0o700); return d; };
function makeAudit() { const recs = [], text = []; return { audit: (r) => { recs.push(r); text.push(JSON.stringify(r)); }, recs, text: () => text.join("\n") }; }

async function run() {
  const vault = tightVault();
  const masterKey = randomBytes(32);

  // 1. seed(manual) → resolve; never-log; encrypted at rest
  {
    const a = makeAudit();
    await seed("AUTH_JWT_SECRET", { env: "prod", registry: REG, vault, masterKey, from: "manual", value: FAKE_JWT, audit: a.audit });
    const v = await vaultResolve("AUTH_JWT_SECRET", { env: "prod", registry: REG, vault, masterKey, audit: a.audit });
    check("1a seed(manual) → resolve returns the value", v === FAKE_JWT);
    check("1b value NEVER in any audit record", !a.text().includes(FAKE_JWT));
    const onDisk = readFileSync(join(vault, "prod", "AUTH_JWT_SECRET.json"), "utf8");
    check("1c encrypted at rest (ciphertext ≠ value)", !onDisk.includes(FAKE_JWT) && /aes-256-gcm/.test(onDisk));
    check("1d audit records key name + verdict", a.recs.some((r) => r.key === "AUTH_JWT_SECRET" && r.verdict === "SEEDED") && a.recs.some((r) => r.verdict === "RESOLVED"));
  }

  // 2. seed(generated) → resolve returns a minted value >= min length
  {
    await seed("CRON_SECRET", { env: "prod", registry: REG, vault, masterKey, from: "generated", audit: () => {} });
    const g = await vaultResolve("CRON_SECRET", { env: "prod", registry: REG, vault, masterKey, audit: () => {} });
    check("2 seed(generated) → resolve returns minted value (>=16)", typeof g === "string" && g.length >= 16);
  }

  // 3. Sensitive-Vercel key is PUSH-ONLY: resolve reads the VAULT; push → mocked sinks
  {
    const a = makeAudit();
    const sink = { vercel: [], github: [] };
    const sinks = {
      vercel: async ({ key, value, env }) => { sink.vercel.push({ key, value, env }); },
      github: async ({ key, value }) => { sink.github.push({ key, value }); },
    };
    const r = await push("AUTH_JWT_SECRET", { env: "prod", registry: REG, vault, masterKey, sinks, audit: a.audit });
    check("3a push resolves from VAULT then writes to both consuming planes", r.pushed.includes("vercel") && r.pushed.includes("github"));
    check("3b vercel sink got the value (write-only plane, push direction)", sink.vercel.length === 1 && sink.vercel[0].value === FAKE_JWT);
    check("3c github sink got the value", sink.github.length === 1 && sink.github[0].value === FAKE_JWT);
    check("3d push audit NEVER logs the value", !a.text().includes(FAKE_JWT));
    check("3e plan() marks vercel target write-only / push-only", /push-only|write-only/.test(plan("AUTH_JWT_SECRET", { env: "prod", registry: REG }).note || ""));
  }

  // 4. un-seeded key → NOT_SEEDED (no fabricated / pulled value)
  {
    let code = null;
    try { await vaultResolve("PROD_BASE_URL", { env: "prod", registry: REG, vault, masterKey, audit: () => {} }); }
    catch (e) { code = e.code; }
    check("4 un-seeded key → NOT_SEEDED (never a fake pull from a write-only plane)", code === "NOT_SEEDED", `code=${code}`);
  }

  // 5. unknown key + missing master key
  {
    let c1 = null; try { await vaultResolve("NOPE", { env: "prod", registry: REG, vault, masterKey, audit: () => {} }); } catch (e) { c1 = e.code; }
    check("5a unknown key → UNKNOWN_KEY", c1 === "UNKNOWN_KEY", `code=${c1}`);
    // missing master key: fresh vault, no key file, no env, no opt
    const v2 = tightVault();
    // seed with an explicit key so an entry exists, then resolve WITHOUT the key
    await seed("AUTH_JWT_SECRET", { env: "prod", registry: REG, vault: v2, masterKey, from: "manual", value: FAKE_JWT, audit: () => {} });
    const savedB64 = process.env.DELIVERYOS_VAULT_KEY_B64; delete process.env.DELIVERYOS_VAULT_KEY_B64;
    let c2 = null; try { await vaultResolve("AUTH_JWT_SECRET", { env: "prod", registry: REG, vault: v2, audit: () => {} }); } catch (e) { c2 = e.code; }
    check("5b missing master key → MISSING_ROOT_CREDENTIAL", c2 === "MISSING_ROOT_CREDENTIAL", `code=${c2}`);
    if (savedB64 !== undefined) process.env.DELIVERYOS_VAULT_KEY_B64 = savedB64;
    rmSync(v2, { recursive: true, force: true });
  }

  // 6. data_class gate — SECRET refused outside the trust boundary (loose vault)
  {
    const loose = mkdtempSync(join(tmpdir(), "sv-loose-")); chmodSync(loose, 0o755);
    let code = null;
    try { await vaultResolve("AUTH_JWT_SECRET", { env: "prod", registry: REG, vault: loose, masterKey, audit: () => {} }); }
    catch (e) { code = e.code; }
    check("6 SECRET outside trust boundary → OUTSIDE_BOUNDARY", code === "OUTSIDE_BOUNDARY", `code=${code}`);
    rmSync(loose, { recursive: true, force: true });
  }

  // 7. leak guard — a non-0600 vault entry file → INSECURE_STORE
  {
    const entry = join(vault, "prod", "AUTH_JWT_SECRET.json");
    chmodSync(entry, 0o644);
    let code = null;
    try { await vaultResolve("AUTH_JWT_SECRET", { env: "prod", registry: REG, vault, masterKey, audit: () => {} }); }
    catch (e) { code = e.code; }
    check("7 non-0600 vault entry → INSECURE_STORE", code === "INSECURE_STORE", `code=${code}`);
    chmodSync(entry, 0o600);
  }

  // 8. supabase origin — honest refusal by default; mocked seed hook works
  {
    let code = null;
    try { await seed("DATABASE_URL", { env: "prod", registry: REG, vault, masterKey, from: "supabase", audit: () => {} }); }
    catch (e) { code = e.code; }
    check("8a supabase seed (no proven endpoint) → PLANE_REFUSED (honest, not faked)", code === "PLANE_REFUSED", `code=${code}`);
    // with a mocked supabase origin hook, the seed succeeds and resolve returns it
    const FAKE_DB = "FAKE-SECRET-VALUE-postgres://u:pw@h:6543/db";
    await seed("DATABASE_URL", { env: "prod", registry: REG, vault, masterKey, from: "supabase", supabaseSeedImpl: async () => FAKE_DB, audit: () => {} });
    const dbv = await vaultResolve("DATABASE_URL", { env: "prod", registry: REG, vault, masterKey, audit: () => {} });
    check("8b mocked supabase origin seeds the vault; resolve returns it", dbv === FAKE_DB);
  }

  // 9. CLI end-to-end: vault-init → seed(generated) → get emits value to stdout ONLY
  {
    const cliVault = mkdtempSync(join(tmpdir(), "sv-cli-"));
    const mkB64 = randomBytes(32).toString("base64");
    const cliReg = join(cliVault, "reg.json"); writeFileSync(cliReg, JSON.stringify(REG));
    const envx = { ...process.env, DELIVERYOS_VAULT_KEY_B64: mkB64 };
    // vault-init creates the dir 0700 (master key comes from env B64 here)
    run1(["vault-init", "--vault", cliVault], envx);
    const seedRes = run1(["seed", "CRON_SECRET", "--env", "prod", "--from", "generated", "--registry", cliReg, "--vault", cliVault], envx);
    check("9a CLI seed exit 0", seedRes.status === 0, `status=${seedRes.status} ${seedRes.stderr}`);
    const getRes = run1(["get", "CRON_SECRET", "--env", "prod", "--registry", cliReg, "--vault", cliVault], envx);
    check("9b CLI get exit 0", getRes.status === 0, `status=${getRes.status} ${getRes.stderr}`);
    check("9c CLI stdout is a non-empty value with NO extra bytes (no newline)", getRes.stdout.length >= 16 && !/\n/.test(getRes.stdout));
    check("9d CLI value NEVER on stderr", getRes.stdout !== "" && !getRes.stderr.includes(getRes.stdout));
    check("9e CLI stderr carries the audit line (key + verdict)", /key=CRON_SECRET/.test(getRes.stderr) && /verdict=RESOLVED/.test(getRes.stderr));
    // un-seeded key via CLI → non-zero, empty stdout
    const missRes = run1(["get", "PROD_BASE_URL", "--env", "prod", "--registry", cliReg, "--vault", cliVault], envx);
    check("9f CLI un-seeded → empty stdout + exit 4", missRes.stdout === "" && missRes.status === 4, `stdout=${JSON.stringify(missRes.stdout)} status=${missRes.status}`);
    rmSync(cliVault, { recursive: true, force: true });
  }

  rmSync(vault, { recursive: true, force: true });
  process.stderr.write(results.join("\n") + "\n");
  process.stderr.write(`\nSecret Vault proof: ${pass}/${pass + fail} passed.\n`);
  process.exit(fail === 0 ? 0 : 1);
}

function run1(args, env) {
  const r = spawnSync("node", [join(HERE, "secret-resolver.mjs"), ...args], { encoding: "utf8", env });
  return { stdout: r.stdout || "", stderr: r.stderr || "", status: r.status };
}

run().catch((e) => { process.stderr.write(`FATAL ${e && e.stack}\n`); process.exit(1); });
