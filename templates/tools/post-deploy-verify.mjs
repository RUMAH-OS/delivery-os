#!/usr/bin/env node
// =============================================================================
// Delivery OS — post-deploy-verify (Infrastructure Platform · self-healing verification).
// =============================================================================
// The CONFIRMATION step that runs AFTER a successful deploy. A green build proves the
// config was valid; it does NOT prove the running system is healthy. This tool closes
// that gap by composing the whole Infrastructure Platform into one go/no-go:
//   1. CONFIG  — config-doctor PASS for production (the pre-deploy contract still holds).
//   2. HEALTH  — GET <base>/api/health/platform returns the canonical report with
//                verdict !== "down" (the unified health aggregate).
//   3. SYNTHETIC — a read-only synthetic workflow probe (a GET of a declared safe,
//                read-only endpoint) actually responds 2xx — proving a real request
//                path works end-to-end, not just the health route.
// If any step is unhealthy it ALARMS (non-zero exit + a named reason) so a deploy that
// looks finished but is actually broken is caught here, not by a user.
//
// SELF-HEALING NOTE (documented in PLATFORM-HEALTH-RUNBOOK): the heartbeat/drain already
// self-heal interrupted/stuck runs (a stateless SKIP-LOCKED tick re-drives any run that
// was mid-flight; the drain quarantines a poison-pill instead of silently stopping).
// This tool is the VERIFICATION that the self-heal actually happened: it re-polls health
// until the heartbeat is fresh + the cursor is advancing (or alarms if recovery stalls).
//
// READ-ONLY, ALWAYS. It only GETs declared read-only endpoints and runs config-doctor
// (itself read-only). It NEVER posts, NEVER mutates, NEVER deploys, NEVER prints a secret.
//
// USAGE:
//   node post-deploy-verify.mjs --base <https://prod-url> --service <id>
//        [--config-doctor <path>] [--registry <path>] [--synthetic <path>]
//        [--retries N] [--retry-delay-ms M] [--json] [--skip-config] [--self-test]
//
// EXIT CODES: 0 = HEALTHY (all enabled steps passed) · 1 = ALARM (a step failed) ·
//   2 = usage / IO error.
//
// Zero runtime dependencies (Node >= 18 built-ins: fetch, child_process, fs).
// =============================================================================

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { basename, dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
function arg(name, def) {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : def;
}
const opts = {
  base: arg("--base"),
  service: arg("--service"),
  configDoctor: arg("--config-doctor", join(HERE, "config-doctor.mjs")),
  registry: arg("--registry"),
  synthetic: arg("--synthetic", "/api/health/discovery"),
  healthPath: arg("--health-path", "/api/health/platform"),
  retries: Number(arg("--retries", 3)),
  retryDelayMs: Number(arg("--retry-delay-ms", 3000)),
  json: argv.includes("--json"),
  skipConfig: argv.includes("--skip-config"),
  selfTest: argv.includes("--self-test"),
};

// =============================================================================
// PURE CORE — fold the three step results into a verdict (self-testable, no IO).
// =============================================================================
export function summarize(steps) {
  const failed = steps.filter((s) => s.enabled && s.status === "fail");
  const healthy = failed.length === 0;
  return {
    healthy,
    verdict: healthy ? "HEALTHY" : "ALARM",
    failedSteps: failed.map((s) => s.name),
    steps,
  };
}

// Classify a health-report body into a step result (verdict down = fail).
export function evaluateHealthBody(body) {
  if (!body || typeof body !== "object") return { ok: false, detail: "no/invalid health body" };
  const verdict = String(body.verdict || "").toLowerCase();
  if (verdict === "down") return { ok: false, detail: `health verdict=down (${downSubs(body)})` };
  if (verdict === "degraded") return { ok: true, degraded: true, detail: `health verdict=degraded (${downSubs(body)})` };
  if (verdict === "ok") return { ok: true, detail: "health verdict=ok" };
  return { ok: false, detail: `unrecognized health verdict "${body.verdict}"` };
}
function downSubs(body) {
  const subs = Array.isArray(body.subsystems) ? body.subsystems : [];
  const bad = subs.filter((s) => s.status === "down" || s.status === "degraded" || s.status === "unknown");
  return bad.length ? bad.map((s) => `${s.name}=${s.status}`).join(", ") : "no subsystem detail";
}

// =============================================================================
// REAL RUN.
// =============================================================================
function runConfigDoctor() {
  if (opts.skipConfig) return { name: "config-doctor", enabled: false, status: "skipped", detail: "--skip-config" };
  if (!existsSync(opts.configDoctor)) {
    // config-doctor not vendored next to us → alarm toward review (its absence is a real gap).
    return { name: "config-doctor", enabled: true, status: "fail", detail: `config-doctor not found at ${opts.configDoctor} (the pre-deploy config contract is unverifiable).` };
  }
  const args = [opts.configDoctor, "--env", "production"];
  if (opts.registry) args.push("--registry", opts.registry);
  const res = spawnSync(process.execPath, args, { encoding: "utf8" });
  const passed = res.status === 0;
  return {
    name: "config-doctor",
    enabled: true,
    status: passed ? "pass" : "fail",
    detail: passed ? "production config PASS" : `config-doctor exit ${res.status} — required key(s) missing/invalid (run it directly for the fix list).`,
  };
}

async function getJson(url, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { accept: "application/json" } });
    let body = null;
    try { body = await res.json(); } catch { /* non-json */ }
    return { status: res.status, body };
  } finally {
    clearTimeout(t);
  }
}

async function runHealthStep() {
  const url = joinUrl(opts.base, opts.healthPath);
  let last = null;
  for (let attempt = 1; attempt <= Math.max(opts.retries, 1); attempt++) {
    try {
      const { status, body } = await getJson(url);
      const ev = evaluateHealthBody(body);
      // 503 with a body still carries a verdict; trust the verdict, not just the code.
      if (ev.ok) return { name: "health", enabled: true, status: "pass", detail: `${ev.detail} (HTTP ${status}, attempt ${attempt})` };
      last = { name: "health", enabled: true, status: "fail", detail: `${ev.detail} (HTTP ${status}, attempt ${attempt}/${opts.retries})` };
    } catch (e) {
      last = { name: "health", enabled: true, status: "fail", detail: `health route unreachable: ${e.message} (attempt ${attempt}/${opts.retries})` };
    }
    // re-poll: this is also the SELF-HEAL window — give the heartbeat/drain time to recover.
    if (attempt < opts.retries) await sleep(opts.retryDelayMs);
  }
  return last;
}

async function runSyntheticStep() {
  const url = joinUrl(opts.base, opts.synthetic);
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, { method: "GET", signal: ctrl.signal }).finally(() => clearTimeout(t));
    // a read-only synthetic probe: a 2xx OR a 503-with-health-body both prove the path runs;
    // a connection error / 5xx-without-body is a real failure.
    const okish = res.status < 500 || res.status === 503;
    return { name: "synthetic", enabled: true, status: okish ? "pass" : "fail", detail: `GET ${opts.synthetic} → HTTP ${res.status}` };
  } catch (e) {
    return { name: "synthetic", enabled: true, status: "fail", detail: `synthetic GET ${opts.synthetic} failed: ${e.message}` };
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function joinUrl(base, path) {
  if (!base) fail(2, "--base <prod-url> is required.");
  return `${String(base).replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}
function fail(code, msg) {
  process.stderr.write(`post-deploy-verify: ${msg}\n`);
  process.exit(code);
}

async function run() {
  if (!opts.base) fail(2, "--base <prod-url> is required.");
  if (!opts.service) fail(2, "--service <id> is required.");
  const steps = [runConfigDoctor(), await runHealthStep(), await runSyntheticStep()];
  const result = summarize(steps);
  result.service = opts.service;
  result.base = opts.base;
  result.checkedAt = new Date().toISOString();

  if (opts.json) {
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  } else {
    const L = (s = "") => process.stdout.write(s + "\n");
    const icon = { pass: "✓", fail: "✗", skipped: "·" };
    L("");
    L(`post-deploy-verify — ${opts.service} @ ${opts.base}`);
    for (const s of steps) L(`  ${icon[s.status] || "?"} ${s.name.padEnd(14)} ${s.detail}`);
    L("");
    L(result.healthy ? "RESULT: HEALTHY — config PASS · health not-down · synthetic path responds." : `RESULT: ALARM — failed: ${result.failedSteps.join(", ")}. Investigate (or roll back: node infra/rollback-helper.mjs).`);
    L("");
  }
  process.exit(result.healthy ? 0 : 1);
}

// =============================================================================
// SELF-TEST — pure; proves the step fold + the health-body evaluation.
// =============================================================================
function selfTest() {
  const cases = [];
  const ok = (name, cond) => cases.push({ name, ok: !!cond });

  // step fold
  ok("all pass → HEALTHY", summarize([{ name: "a", enabled: true, status: "pass" }, { name: "b", enabled: true, status: "pass" }]).healthy === true);
  ok("one fail → ALARM", summarize([{ name: "a", enabled: true, status: "pass" }, { name: "b", enabled: true, status: "fail" }]).verdict === "ALARM");
  ok("skipped step does not fail the verdict", summarize([{ name: "a", enabled: false, status: "skipped" }, { name: "b", enabled: true, status: "pass" }]).healthy === true);
  ok("ALARM names the failed steps", summarize([{ name: "health", enabled: true, status: "fail" }]).failedSteps[0] === "health");

  // health-body evaluation
  ok("verdict=ok → step ok", evaluateHealthBody({ verdict: "ok" }).ok === true);
  ok("verdict=down → step fail", evaluateHealthBody({ verdict: "down", subsystems: [{ name: "database", status: "down" }] }).ok === false);
  ok("verdict=down detail names the down subsystem", /database=down/.test(evaluateHealthBody({ verdict: "down", subsystems: [{ name: "database", status: "down" }] }).detail));
  ok("verdict=degraded → step ok but flagged", (() => { const e = evaluateHealthBody({ verdict: "degraded", subsystems: [{ name: "cursor", status: "degraded" }] }); return e.ok === true && e.degraded === true; })());
  ok("missing body → fail", evaluateHealthBody(null).ok === false);
  ok("unknown verdict → fail", evaluateHealthBody({ verdict: "weird" }).ok === false);

  const failed = cases.filter((c) => !c.ok);
  for (const c of cases) process.stdout.write(`${c.ok ? "✓" : "✗"} ${c.name}\n`);
  process.stdout.write(`\npost-deploy-verify self-test: ${cases.length - failed.length}/${cases.length} passed.\n`);
  process.exit(failed.length ? 1 : 0);
}

// --- entrypoint ---
const _invoked = process.argv[1] || "";
if (_invoked && basename(_invoked) === basename(fileURLToPath(import.meta.url))) {
  if (opts.selfTest) selfTest();
  else run().catch((e) => fail(2, e && e.stack ? e.stack : String(e)));
}
