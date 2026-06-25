#!/usr/bin/env node
// =============================================================================
// Delivery OS — Smoke / Production-Verify probe (zero-dep, Node ESM). The
// SMOKE LIFECYCLE: after a deploy lands, GET a battery of health paths against
// the deployed URL and gate CI on the verdict.
// =============================================================================
// "A green deploy is not a working deploy. After the release cuts, something
//  must actually hit the running surface and confirm it answers — and a network
//  error must FAIL the gate, never silently pass."
//
// Composes UNDER the ci-release-orchestrator skill (the post-deploy verify
// step). It is READ-ONLY: it issues GETs and classifies them; it mutates
// nothing. Fail-closed by construction — a connection error, timeout, wrong
// status, or missing body substring is a FAIL, and ANY failing check fails the
// overall verdict (exit non-zero) so CI gates on it.
//
//   import { DEFAULT_BATTERY, loadBattery, classifyResult, overallVerdict } from "./smoke.mjs"
//   node smoke.mjs --url <base> [--config <file>] [--timeout <ms>] [--json] [--dry-run] [--self-test]
//
// DEFAULT battery (no --config): GET `/` expect 200; GET `/api/health` expect
//   200 IF PRESENT (a 404 is SKIP, not FAIL; any other mismatch IS a FAIL).
// --config <file>  JSON array of { path, expectStatus?, bodyIncludes?, optional? }.
// --dry-run        print the resolved battery + target URLs; issue NO requests.
// Exit 0 only when the overall verdict is PASS (no FAILs).
// =============================================================================

import { readFileSync } from "node:fs";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { fileURLToPath } from "node:url";

const DEFAULT_TIMEOUT_MS = 10000;

// The default smoke battery: root must be 200; the health route is 200 IF
// PRESENT (optional -> a 404 is SKIP, not a FAIL).
export const DEFAULT_BATTERY = [
  { path: "/", expectStatus: 200 },
  { path: "/api/health", expectStatus: 200, optional: true },
];

// =============================================================================
// PURE CORE — battery loading, per-check classification, verdict. No network;
// unit-tested by --self-test with an injected HTTP spy.
// =============================================================================

// Parse + validate a --config battery (JSON array). Fail-closed: a malformed
// config THROWS (we never silently fall back to a weaker battery).
export function loadBattery(configText) {
  let parsed;
  try { parsed = JSON.parse(configText); }
  catch (e) { throw new Error(`invalid smoke config JSON: ${e.message}`); }
  const checks = Array.isArray(parsed) ? parsed : parsed.checks;
  if (!Array.isArray(checks) || !checks.length) throw new Error("smoke config must be a non-empty array of checks (or { checks: [...] })");
  return checks.map((c, i) => {
    if (!c || typeof c.path !== "string" || !c.path.startsWith("/")) throw new Error(`check[${i}]: 'path' must be a string starting with '/'`);
    return {
      path: c.path,
      expectStatus: c.expectStatus != null ? Number(c.expectStatus) : 200,
      bodyIncludes: c.bodyIncludes != null ? String(c.bodyIncludes) : null,
      optional: !!c.optional,
    };
  });
}

// Classify one probe result against its check. `result` = { status, body } on a
// completed request, or { error } when the request failed (network/timeout).
// Returns { verdict: "PASS"|"FAIL"|"SKIP", reason }.
//  - network/timeout error            -> FAIL (fail-closed) [optional: still FAIL — host-level error]
//  - optional check + 404             -> SKIP ("200 if present")
//  - status !== expectStatus          -> FAIL
//  - bodyIncludes set but not in body -> FAIL
//  - otherwise                        -> PASS
export function classifyResult(check, result) {
  if (result && result.error) {
    return { verdict: "FAIL", reason: `network error: ${result.error}` };
  }
  const status = result ? result.status : undefined;
  if (check.optional && status === 404) {
    return { verdict: "SKIP", reason: "optional route not present (404)" };
  }
  if (status !== check.expectStatus) {
    return { verdict: "FAIL", reason: `expected status ${check.expectStatus}, got ${status}` };
  }
  if (check.bodyIncludes != null) {
    const body = String(result.body || "");
    if (!body.includes(check.bodyIncludes)) {
      return { verdict: "FAIL", reason: `body did not contain "${check.bodyIncludes}"` };
    }
  }
  return { verdict: "PASS", reason: `status ${status} as expected${check.bodyIncludes != null ? ` + body matched "${check.bodyIncludes}"` : ""}` };
}

// The overall verdict: FAIL if ANY check FAILed; SKIPs don't fail the run; PASS
// only when at least one check ran and none failed.
export function overallVerdict(results) {
  const counts = { PASS: 0, FAIL: 0, SKIP: 0 };
  for (const r of results || []) counts[r.verdict] = (counts[r.verdict] || 0) + 1;
  const verdict = counts.FAIL > 0 ? "FAIL" : (counts.PASS > 0 ? "PASS" : "FAIL");
  return { verdict, counts };
}

// Join a base URL + a check path without doubling slashes.
export function joinUrl(base, path) {
  return String(base).replace(/\/+$/, "") + path;
}

// =============================================================================
// HTTP runtime (live path). Zero-dep node:http/node:https GET. Returns a probe
// function compatible with the injected spy used by --self-test.
// =============================================================================
function makeProbe(timeoutMs) {
  return function get(urlString) {
    return new Promise((resolve) => {
      let url;
      try { url = new URL(urlString); } catch (e) { resolve({ error: `bad URL: ${e.message}` }); return; }
      const request = url.protocol === "https:" ? httpsRequest : httpRequest;
      const req = request(url, { method: "GET", timeout: timeoutMs || DEFAULT_TIMEOUT_MS }, (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (c) => { if (body.length < 65536) body += c; });
        res.on("end", () => resolve({ status: res.statusCode, body }));
      });
      req.on("timeout", () => { req.destroy(); resolve({ error: `timeout after ${timeoutMs || DEFAULT_TIMEOUT_MS}ms` }); });
      req.on("error", (e) => resolve({ error: e.message }));
      req.end();
    });
  };
}

// =============================================================================
// ORCHESTRATION — probe each check, classify, compute the verdict. Read-only.
// `opts.probe` may be injected (the self-test spy); otherwise a live probe.
// =============================================================================
export async function runSmoke(opts) {
  const battery = opts.checks || DEFAULT_BATTERY;
  const report = { url: opts.url || null, verdict: "FAIL", counts: { PASS: 0, FAIL: 0, SKIP: 0 }, checks: [], messages: [], result: "ok" };

  // fail-closed preflight: a base URL is required to probe anything.
  if (!opts.url) {
    report.result = "error";
    report.messages.push("no --url given — nothing to probe. Fail-closed.");
    return report;
  }

  if (opts.dryRun) {
    report.result = "dry-run";
    for (const c of battery) report.checks.push({ path: c.path, target: joinUrl(opts.url, c.path), expectStatus: c.expectStatus ?? 200, bodyIncludes: c.bodyIncludes || null, optional: !!c.optional, verdict: "(dry-run)" });
    report.messages.push(`[dry-run] would probe ${battery.length} path(s) on ${opts.url} — issued NO requests.`);
    return report;
  }

  const probe = opts.probe || makeProbe(opts.timeoutMs);
  for (const c of battery) {
    const check = { path: c.path, expectStatus: c.expectStatus ?? 200, bodyIncludes: c.bodyIncludes ?? null, optional: !!c.optional };
    const target = joinUrl(opts.url, c.path);
    let result;
    try { result = await probe(target); }
    catch (e) { result = { error: e && e.message ? e.message : String(e) }; } // any thrown IO -> FAIL, never a pass
    const verdict = classifyResult(check, result);
    report.checks.push({ path: c.path, target, expectStatus: check.expectStatus, optional: check.optional, status: result && result.status != null ? result.status : null, verdict: verdict.verdict, reason: verdict.reason });
  }

  const overall = overallVerdict(report.checks);
  report.verdict = overall.verdict;
  report.counts = overall.counts;
  return report;
}

// =============================================================================
// REPORT RENDERING
// =============================================================================
function printReport(report, opts) {
  if (opts.json) { console.log(JSON.stringify(report, null, 2)); return; }
  const out = [];
  out.push(`\nsmoke · ${report.url || "(no url)"}`);
  for (const c of report.checks) {
    const mark = c.verdict === "PASS" ? "PASS" : c.verdict === "SKIP" ? "SKIP" : c.verdict === "(dry-run)" ? "PLAN" : "FAIL";
    out.push(`  [${mark}] GET ${c.path} -> ${c.status != null ? c.status : (c.verdict === "(dry-run)" ? c.target : "n/a")}${c.reason ? `  (${c.reason})` : ""}`);
  }
  if (report.result === "dry-run") { out.push("verdict: (dry-run — no requests issued)"); }
  else { out.push(`counts : PASS ${report.counts.PASS}  FAIL ${report.counts.FAIL}  SKIP ${report.counts.SKIP}`); out.push(`verdict: ${report.verdict}`); }
  for (const m of report.messages) out.push(`  · ${m}`);
  console.log(out.join("\n"));
}

// =============================================================================
// SELF-TEST — pure, no real network (HTTP layer is an injected spy). Asserts:
//  (1) a 200 matching the expected status -> PASS
//  (2) a 500 (wrong status) -> FAIL
//  (3) a timeout / network error -> FAIL (fail-closed, never a pass)
//  (4) a wrong body substring -> FAIL; a matching substring -> PASS
//  (5) the overall verdict is FAIL if ANY check fails
//  (6) an optional route's 404 -> SKIP (the "200 if present" rule), and a SKIP
//      alone does not flip a PASS run to FAIL
// =============================================================================
async function selfTest() {
  const fails = [];
  const ok = (cond, msg) => { if (!cond) fails.push(msg); };

  // (1)-(4) unit classification
  ok(classifyResult({ expectStatus: 200 }, { status: 200, body: "ok" }).verdict === "PASS", "200 vs expected 200 -> PASS");
  ok(classifyResult({ expectStatus: 200 }, { status: 500, body: "err" }).verdict === "FAIL", "500 vs expected 200 -> FAIL");
  ok(classifyResult({ expectStatus: 200 }, { error: "timeout after 10000ms" }).verdict === "FAIL", "timeout -> FAIL (fail-closed)");
  ok(classifyResult({ expectStatus: 200 }, { error: "ECONNREFUSED" }).verdict === "FAIL", "connection refused -> FAIL (fail-closed)");
  ok(classifyResult({ expectStatus: 200, bodyIncludes: "healthy" }, { status: 200, body: "all healthy here" }).verdict === "PASS", "matching body substring -> PASS");
  ok(classifyResult({ expectStatus: 200, bodyIncludes: "healthy" }, { status: 200, body: "degraded" }).verdict === "FAIL", "wrong body substring -> FAIL");
  // (6) optional-route 404 -> SKIP; optional with wrong (non-404) status still FAILs
  ok(classifyResult({ expectStatus: 200, optional: true }, { status: 404, body: "" }).verdict === "SKIP", "optional route 404 -> SKIP (200-if-present)");
  ok(classifyResult({ expectStatus: 200, optional: true }, { status: 500, body: "" }).verdict === "FAIL", "optional route 500 -> still FAIL");

  // overallVerdict
  ok(overallVerdict([{ verdict: "PASS" }, { verdict: "PASS" }]).verdict === "PASS", "all PASS -> PASS");
  ok(overallVerdict([{ verdict: "PASS" }, { verdict: "FAIL" }]).verdict === "FAIL", "any FAIL -> overall FAIL");
  ok(overallVerdict([{ verdict: "PASS" }, { verdict: "SKIP" }]).verdict === "PASS", "PASS + SKIP -> PASS (skip does not fail)");
  ok(overallVerdict([{ verdict: "SKIP" }]).verdict === "FAIL", "only SKIP (nothing ran) -> FAIL (fail-closed)");

  // (5) end-to-end runSmoke with an injected HTTP spy (NO real network)
  const spyProbe = (table) => async (urlString) => {
    const path = new URL(urlString).pathname;
    const r = table[path];
    if (r === undefined) return { error: "no spy mapping (treated as network error)" };
    if (r.throw) throw new Error(r.throw); // ensure a THROWN io still becomes FAIL, not a pass
    return r;
  };

  // a fully-healthy deploy: / 200, /api/health 200 -> PASS
  const healthy = await runSmoke({ url: "https://app.example.com", probe: spyProbe({ "/": { status: 200, body: "<html>" }, "/api/health": { status: 200, body: "ok" } }) });
  ok(healthy.verdict === "PASS", "healthy deploy -> overall PASS");
  ok(healthy.checks.find((c) => c.path === "/").verdict === "PASS", "root check PASS on a healthy deploy");

  // a 500 on root -> overall FAIL
  const broken = await runSmoke({ url: "https://app.example.com", probe: spyProbe({ "/": { status: 500, body: "boom" }, "/api/health": { status: 200, body: "ok" } }) });
  ok(broken.verdict === "FAIL", "a 500 on / -> overall FAIL");

  // a network error on root -> overall FAIL (fail-closed)
  const down = await runSmoke({ url: "https://down.example.com", probe: spyProbe({ "/api/health": { status: 200, body: "ok" } }) });
  ok(down.verdict === "FAIL", "network error on / -> overall FAIL (fail-closed)");
  ok(/network error/.test(down.checks.find((c) => c.path === "/").reason), "the FAIL reason names the network error");

  // a THROWN probe (not a resolved error object) must still classify FAIL
  const thrown = await runSmoke({ url: "https://app.example.com", probe: spyProbe({ "/": { throw: "socket hang up" }, "/api/health": { status: 200, body: "ok" } }) });
  ok(thrown.verdict === "FAIL", "a THROWN probe error -> overall FAIL (never a pass)");

  // optional /api/health 404 -> SKIP; root 200 -> overall still PASS
  const noHealth = await runSmoke({ url: "https://app.example.com", probe: spyProbe({ "/": { status: 200, body: "<html>" }, "/api/health": { status: 404, body: "" } }) });
  ok(noHealth.verdict === "PASS", "absent optional /api/health (404) -> overall still PASS");
  ok(noHealth.checks.find((c) => c.path === "/api/health").verdict === "SKIP", "absent optional route classified SKIP");

  // a --config battery with a bodyIncludes that mismatches -> FAIL
  const battery = loadBattery(JSON.stringify([{ path: "/status", expectStatus: 200, bodyIncludes: "READY" }]));
  const cfgFail = await runSmoke({ url: "https://app.example.com", checks: battery, probe: spyProbe({ "/status": { status: 200, body: "STARTING" } }) });
  ok(cfgFail.verdict === "FAIL", "config bodyIncludes mismatch -> FAIL");
  // a malformed config fails closed (throws)
  let threw = false; try { loadBattery("{ not json"); } catch { threw = true; }
  ok(threw, "malformed --config throws (fail-closed, no weak fallback)");

  if (fails.length) {
    console.error("smoke --self-test FAIL:");
    for (const f of fails) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.error(
    "smoke --self-test PASS — a 200-vs-expected match is PASS; a 500 / timeout / connection-error / wrong-body-substring is FAIL " +
    "(fail-closed: a network error and even a THROWN probe are FAIL, never a pass); the overall verdict is FAIL if ANY check fails; " +
    "an optional route's 404 is SKIP (200-if-present) and a lone SKIP does not flip a passing run; malformed --config throws."
  );
  process.exit(0);
}

// =============================================================================
// CLI
// =============================================================================
function sameFile(p) { try { return p && p.startsWith("file:") ? fileURLToPath(p) : p; } catch { return p; } }
if (process.argv[1] && fileURLToPath(import.meta.url) === sameFile(process.argv[1])) {
  const argv = process.argv.slice(2);
  if (argv.includes("--self-test")) { selfTest(); }
  else {
    const flag = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
    const has = (name) => argv.includes(name);
    const url = flag("--url");
    if (!url && !has("--self-test")) {
      console.error("USAGE: node smoke.mjs --url <base> [--config <file>] [--timeout <ms>] [--json] [--dry-run] [--self-test]");
      process.exit(2);
    }
    let checks;
    const cfg = flag("--config");
    if (cfg) {
      try { checks = loadBattery(readFileSync(cfg, "utf8")); }
      catch (e) { console.error(`smoke: ${e.message}`); process.exit(2); }
    }
    const opts = { url, checks, timeoutMs: flag("--timeout") ? Number(flag("--timeout")) : undefined, json: has("--json"), dryRun: has("--dry-run") };
    runSmoke(opts)
      .then((report) => {
        printReport(report, opts);
        if (report.result === "error") process.exit(2);
        if (report.result === "dry-run") process.exit(0);
        process.exit(report.verdict === "PASS" ? 0 : 1); // non-zero on any FAIL so CI gates
      })
      .catch((e) => { console.error(`smoke: ${e.message}`); process.exit(1); });
  }
}
