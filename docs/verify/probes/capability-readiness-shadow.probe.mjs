#!/usr/bin/env node
// =============================================================================
// QA machine_probe — Sprint 1.3 slice 1 (capability-readiness-shadow).
// Independent re-runnable gate: exits 0 ONLY if every load-bearing property holds.
//   1. the three self-tests pass (resolver 10/10 · shadow 12/12 · legacy-guard 13/13)
//   2. THE safety property — a SHADOW gate on a MISSING required key EXITS 0 for
//      C9, D7 AND C13 (never blocks the live engine)
//   3. no-secret-values — a planted secret sentinel never appears in legacy-guard output
// Authored by the INDEPENDENT verifier (qa-test), not the build session.
// Run: node docs/verify/probes/capability-readiness-shadow.probe.mjs
// =============================================================================
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const T = (p) => join(REPO, "templates/tools", p);
const NODE = process.execPath;
const SENTINEL = "zX9_QASEKRET_4242_unique_value";
let fail = 0;
const ok = (name, cond) => { console.log(`${cond ? "PASS" : "FAIL"}  ${name}`); if (!cond) fail++; };

// run a node cli; return { code, out }
function runCli(args) {
  const r = spawnSync(NODE, args, { encoding: "utf8" });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
}

// (1) self-tests — exit 0 means all internal asserts passed.
for (const [label, file] of [
  ["resolver self-test", "capability-config-resolver.mjs"],
  ["readiness-shadow self-test", "readiness-shadow.mjs"],
  ["legacy-guard self-test", "legacy-guard-config.mjs"],
]) {
  const r = runCli([T(file), "--self-test"]);
  ok(`${label} exits 0 (all asserts pass)`, r.code === 0);
}

// build a throwaway fixture: a registry with a prod-required key + a capability needing it.
const dir = mkdtempSync(join(tmpdir(), "qa-s13-"));
try {
  writeFileSync(join(dir, "registry.json"), JSON.stringify({
    schema_version: "config-secret-registry/v1", service: "qa-probe-svc",
    environments: ["prod"], planes: { vercel: { tokenEnv: "VERCEL_TOKEN" } },
    keys: [{ key: "QA_REQUIRED_URL", owner: "platform", source_provider: "vercel",
      data_class: "INTERNAL", env_scope: ["prod"], validation_rule: "url",
      required_per_env: { prod: true }, purpose: "probe", example: "https://x" }],
  }));
  writeFileSync(join(dir, "qa-cap.capability.json"), JSON.stringify({
    id: "qa-cap",
    requires_config: [{ key: "QA_REQUIRED_URL", data_class: "INTERNAL", env_scope: ["prod"], rule: "url", reason: "probe" }],
  }));

  // (2) THE safety property: MISSING required key (no live planes) → exit 0 on every gate.
  for (const g of ["C9", "D7", "C13"]) {
    const r = runCli([T("readiness-shadow.mjs"), "--gate", g, "--caps",
      join(dir, "qa-cap.capability.json"), "--env", "prod", "--registry", join(dir, "registry.json")]);
    const notReady = /NOT READY/.test(r.out) && /would-block-on/.test(r.out);
    ok(`SHADOW ${g}: NOT READY but EXITS 0 (never blocks)`, r.code === 0 && notReady);
  }

  // (3) no-secret-values: plant a secret tree, assert the sentinel is detected-but-absent.
  mkdirSync(join(dir, "tree", "src"), { recursive: true });
  mkdirSync(join(dir, "tree", "scripts"), { recursive: true });
  writeFileSync(join(dir, "tree/src/db.ts"),
    `const url = "postgres://u:${SENTINEL}@aws-0-eu.pooler.supabase.com:6543/postgres";\n` +
    `export const STRIPE_API_KEY = "sk_live_${SENTINEL}";\n`);
  writeFileSync(join(dir, "tree/scripts/seed.mjs"),
    `if (process.env.ALLOW_PROD_DB_WRITE === "1") { await seedProd(); }\n`);
  const lg = runCli([T("legacy-guard-config.mjs"), "--dir", join(dir, "tree"), "--json"]);
  ok("legacy-guard detects tree secret + ALLOW_PROD_DB_WRITE",
    /tree-resident-secret/.test(lg.out) && /ALLOW_PROD_DB_WRITE/.test(lg.out));
  ok("legacy-guard exits 0 (evidence-only, never blocks)", lg.code === 0);
  ok("NO-SECRET-VALUES: planted sentinel NEVER appears in output", !lg.out.includes(SENTINEL));
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log(`\nmachine_probe: ${fail === 0 ? "PASS — all load-bearing properties hold" : `FAIL — ${fail} check(s) failed`}`);
process.exit(fail === 0 ? 0 : 1);
