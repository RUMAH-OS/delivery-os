#!/usr/bin/env node
// =============================================================================
// Delivery OS — Founder Review ENV harness (project-agnostic, zero external dep).
// The one-command "start-and-print-the-URLs" local review environment a founder
// can use with ZERO setup. It is the generalised, project-agnostic form of the
// earned rumah-admin `scripts/founder-review.mjs` (the contract-signing harness)
// that the 2026-06-25 founder-review standard ratified.
//
// It is DATA-DRIVEN by a per-project config file: `.delivery-os/founder-review.json`.
// It NEVER hard-codes how a project starts/migrates/seeds — it runs the commands
// the project declares. Where a project has NOT configured local review, it
// FAILS CLOSED with a clear message ("falling back to DEV") and prints NO urls —
// it never fabricates a link the founder cannot actually open.
//
// WHAT IT DOES (when configured):
//   1) run the declared `setup` steps in order (e.g. start a local test DB, migrate),
//   2) run the declared `seed` step (project-owned — it seeds the REAL reviewable
//      artifact, e.g. a valid token, so the founder sees a real thing to review),
//   3) start the declared `servers` and wait for each `healthUrl`,
//   4) PRINT the exact local URLs (frontendBase + each review.urls[].path),
//   5) DEFAULT = start-and-block (Ctrl+C stops servers + runs teardown).
//   --selftest = do everything, print, then tear down and exit 0 (CI-friendly).
//
// SAFETY: before doing anything it asserts none of the forced env values contain
// any `local.safety.databaseUrlMustNotContain` substring (a prod-ref tripwire) —
// so a misconfigured harness can never point at production.
//
// =============================================================================
// CONFIG SHAPE — `.delivery-os/founder-review.json`
// (the SAME file founder-review-package.mjs reads to choose the LOCAL review path)
// -----------------------------------------------------------------------------
// {
//   "app": "Rumah Admin",
//   "review": {
//     "title": "Contract Signing Fix",
//     "urls": [                                   // label + path; base is added at runtime
//       { "label": "A real signing link (the main test)", "path": "/sign/founder-review-valid-2026" },
//       { "label": "A broken/expired link (the error test)", "path": "/sign/this-link-is-not-valid" },
//       { "label": "The staff Admin login (what WRONG looks like)", "path": "/" }
//     ]
//   },
//   "local": {
//     "command": "npm run founder:review",        // how the founder re-runs THIS harness
//     "frontendBase": "http://localhost:5180",    // urls = frontendBase + review.urls[].path
//     "backendBase":  "http://localhost:8787",    // (optional) shown in the banner
//     "env": {                                    // forced for every child process
//       "DATABASE_URL": "postgres://rumah:rumah@localhost:55432/rumah_admin_test",
//       "RUMAH_ENV": "test", "PORT": "8787"
//     },
//     "safety": { "databaseUrlMustNotContain": ["clfocpodfbtgzivnivck"] },   // prod-ref tripwire
//     "setup": [                                  // ordered, blocking; non-zero = abort
//       { "label": "start local test Postgres", "cmd": "npm", "args": ["run","db:test:up"] },
//       { "label": "migrate",                    "cmd": "npm", "args": ["run","db:migrate"] },
//       { "label": "migrate (gated)",            "cmd": "npm", "args": ["run","db:migrate","--","--include-gated"] }
//     ],
//     "seed": { "label": "seed the reviewable artifact", "cmd": "node", "args": ["scripts/founder-review-seed.mjs"] },
//     "servers": [                                // started in parallel; each waited on healthUrl
//       { "name": "backend",  "cmd": "npm", "args": ["run","dev"], "cwd": ".",        "healthUrl": "http://localhost:8787/health" },
//       { "name": "frontend", "cmd": "npm", "args": ["run","dev"], "cwd": "admin-ui", "healthUrl": "http://localhost:5180/" }
//     ],
//     "teardown": [                               // run on Ctrl+C / --selftest exit
//       { "label": "stop test DB", "cmd": "npm", "args": ["run","db:test:down"] }
//     ]
//   }
// }
// -----------------------------------------------------------------------------
// Every step's `cwd` is optional and resolved relative to the project root
// (the dir that holds `.delivery-os/`). `cmd`+`args` are passed to the shell as
// an argv array. NOTHING here is project-specific — all of it is data.
// =============================================================================

import { spawn, spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";

const IS_WIN = process.platform === "win32";
const SELFTEST = process.argv.includes("--selftest") || process.env.FOUNDER_REVIEW_SELFTEST === "1";
const CONFIG_REL = ".delivery-os/founder-review.json";

function log(msg) { console.log("[founder:review] " + msg); }

// ---- locate project root: nearest ancestor holding .delivery-os/ -------------
function findRoot(startCwd) {
  let dir = resolve(startCwd || process.cwd());
  for (;;) {
    if (existsSync(join(dir, CONFIG_REL))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

// ---- load + validate config; FAIL CLOSED (never fabricate) -------------------
function loadConfig(root) {
  const p = join(root, CONFIG_REL);
  let cfg;
  try { cfg = JSON.parse(readFileSync(p, "utf8")); }
  catch (e) { return { error: `${CONFIG_REL} is present but not valid JSON: ${e.message}` }; }
  const local = cfg.local || {};
  const urls = (cfg.review && Array.isArray(cfg.review.urls)) ? cfg.review.urls : [];
  if (!local.frontendBase) return { error: `${CONFIG_REL} has no \`local.frontendBase\` — cannot build local urls.` };
  if (!urls.length) return { error: `${CONFIG_REL} has no \`review.urls\` — there is nothing real for the founder to open.` };
  if (!Array.isArray(local.servers) || !local.servers.length) return { error: `${CONFIG_REL} has no \`local.servers\` — nothing to start.` };
  return { cfg, local, urls };
}

// ---- safety tripwire: no forced env value may look like production -----------
function assertSafeEnv(local) {
  const forbidden = (local.safety && Array.isArray(local.safety.databaseUrlMustNotContain))
    ? local.safety.databaseUrlMustNotContain : [];
  const env = local.env || {};
  for (const [k, v] of Object.entries(env)) {
    for (const bad of forbidden) {
      if (bad && String(v).includes(bad)) {
        throw new Error(`refusing to run: forced env ${k} contains the forbidden prod marker "${bad}" — check .delivery-os/founder-review.json`);
      }
    }
  }
}

const children = [];

function runStep(step, root, env) {
  const label = step.label || `${step.cmd} ${(step.args || []).join(" ")}`;
  const cwd = step.cwd ? resolve(root, step.cwd) : root;
  log("> " + step.cmd + " " + (step.args || []).join(" ") + "   (" + label + ")");
  const r = spawnSync(step.cmd, step.args || [], { cwd, env, stdio: "inherit", shell: true });
  if (r.status !== 0) throw new Error(`step failed (${label}): exit ${r.status}`);
}

function startServer(server, root, env) {
  const cwd = server.cwd ? resolve(root, server.cwd) : root;
  const name = server.name || "server";
  const proc = spawn(server.cmd, server.args || [], { cwd, env, shell: true, stdio: ["ignore", "pipe", "pipe"] });
  const tag = (chunk) => process.stdout.write("[" + name + "] " + chunk);
  proc.stdout.on("data", tag);
  proc.stderr.on("data", tag);
  proc.on("exit", (code) => log(name + " exited (code " + code + ")"));
  children.push({ name, proc });
  return proc;
}

async function waitFor(label, url, opts) {
  const timeoutMs = (opts && opts.timeoutMs) || 90000;
  const intervalMs = (opts && opts.intervalMs) || 1000;
  const start = Date.now();
  for (;;) {
    try { const r = await fetch(url); if (r.ok) return; } catch { /* not ready */ }
    if (Date.now() - start > timeoutMs) throw new Error(`timed out waiting for ${label} (${url})`);
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

function printUrls(local, urls) {
  const base = String(local.frontendBase).replace(/\/+$/, "");
  const line = "============================================================================";
  const lines = ["", line, "  FOUNDER REVIEW — local review environment is LIVE", line, "",
    "  Open these in your browser (Chrome / Edge / Firefox):", ""];
  urls.forEach((u, i) => lines.push("  " + (i + 1) + ". " + (u.label || "Open this link") + ":\n     " + base + (u.path || "")));
  lines.push("", "  Backend: " + (local.backendBase || "(n/a)") + "    Frontend: " + base,
    "----------------------------------------------------------------------------",
    "  Leave this window open while you review. Press Ctrl+C to stop.", line, "");
  console.log(lines.join("\n"));
}

let cleaning = false;
function cleanup(root, local, env) {
  if (cleaning) return;
  cleaning = true;
  log("cleaning up ...");
  for (const entry of children) {
    try {
      if (IS_WIN && entry.proc.pid) spawnSync("taskkill", ["/pid", String(entry.proc.pid), "/T", "/F"], { stdio: "ignore" });
      else entry.proc.kill("SIGTERM");
      log("stopped " + entry.name);
    } catch (e) { log("could not stop " + entry.name + ": " + e.message); }
  }
  for (const step of (local.teardown || [])) {
    try { runStep(step, root, env); } catch (e) { log("teardown step failed: " + e.message); }
  }
}

async function main() {
  const root = findRoot(process.cwd());
  if (!root) {
    console.error("[founder:review] FAIL-CLOSED: this project has no " + CONFIG_REL +
      " — it needs one to enable local review. Falling back to DEV (no local URLs printed; none are fabricated).");
    process.exit(3);
  }
  const loaded = loadConfig(root);
  if (loaded.error) {
    console.error("[founder:review] FAIL-CLOSED: " + loaded.error +
      "\n  Local review is disabled until the config is fixed. Falling back to DEV (no fabricated URLs).");
    process.exit(3);
  }
  const { local, urls } = loaded;
  assertSafeEnv(local);

  const env = { ...process.env, ...(local.env || {}) };

  for (const step of (local.setup || [])) runStep(step, root, env);
  if (local.seed) runStep(local.seed, root, env);

  for (const server of local.servers) {
    log("starting " + (server.name || "server") + " ...");
    startServer(server, root, env);
  }
  for (const server of local.servers) {
    if (server.healthUrl) { await waitFor((server.name || "server") + " health", server.healthUrl); log((server.name || "server") + " is up."); }
  }

  printUrls(local, urls);

  if (SELFTEST) {
    log("--selftest: tearing everything down.");
    cleanup(root, local, env);
    process.exit(0);
  }
  process.on("SIGINT", () => { cleanup(root, local, env); process.exit(0); });
  process.on("SIGTERM", () => { cleanup(root, local, env); process.exit(0); });
  log("servers are running. Press Ctrl+C to stop (this also runs teardown).");
  await new Promise(() => {});
}

main().catch((e) => {
  console.error("[founder:review] FAILED: " + e.message);
  const root = findRoot(process.cwd());
  if (root) { const loaded = loadConfig(root); if (!loaded.error) cleanup(root, loaded.local, { ...process.env, ...(loaded.local.env || {}) }); }
  process.exit(1);
});
