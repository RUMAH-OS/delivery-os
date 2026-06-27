#!/usr/bin/env node
// =============================================================================
// Delivery OS — platform-health (Infrastructure Runtime-Health & Diagnostics layer).
// =============================================================================
// The SECOND half of the Infrastructure Platform. config-doctor (the first half,
// `config-doctor.mjs`) answers "is the configuration that the deploy needs declared,
// present and valid?" BEFORE the build. THIS layer answers the runtime questions
// AFTER the deploy is live:
//   • is every subsystem actually reachable RIGHT NOW? (unified health)
//   • when something is stuck/failing, what is the ACTIONABLE cause? (diagnostics)
//
// It is the reusable CONTRACT + ENGINE that each app vendors into `infra/` and wires
// to its own probes. It owns three reusable, app-NEUTRAL things:
//   1. CANONICAL_SHAPE + buildReport()/computeVerdict()/normalizeStatus() — the ONE
//      JSON shape every app's `/api/health/platform` emits, so the platform can poll
//      all of them identically. (The shape is also pinned as platform-health.schema.json.)
//   2. classifyFailure() — the runtime-diagnostics TAXONOMY: turn a raw symptom (an
//      error string / pg code / a stuck cursor / a stale heartbeat) into ONE named,
//      ACTIONABLE cause instead of a silent stop. This is the engine behind every
//      app's diagnostics endpoint — it directly serves "remove every silent failure".
//   3. A CLI (`diagnose`, `validate`, `--self-test`) so ops/CI can run the same engine
//      without an app process.
//
// READ-ONLY, ALWAYS. It NEVER writes, NEVER calls a mutating probe (a health check
// must observe, never advance state — e.g. it reads heartbeat liveness, it does not
// drive a tick), NEVER prints a secret value. Config-class causes DELEGATE to
// config-doctor rather than re-reading env (one source of truth per concern).
//
// USAGE:
//   node platform-health.mjs diagnose [--json] (symptom JSON on stdin | --symptom '<json>')
//   node platform-health.mjs validate (report JSON on stdin | --report '<json>')   # canonical-shape check
//   node platform-health.mjs --self-test
//
// EXIT CODES: diagnose → 0 always (it reports; it is not itself a gate).
//             validate → 0 valid · 1 invalid · 2 usage/IO error.
//             --self-test → 0 all pass · 1 a case failed.
//
// Zero runtime dependencies (Node >= 18 built-ins only).
// =============================================================================

// =============================================================================
// 1. THE CANONICAL HEALTH SHAPE — the cross-app contract.
// =============================================================================
// Per-subsystem status vocabulary. Ordered worst→best for the worst-wins fold.
export const STATUS = Object.freeze({
  DOWN: "down", // a probe failed / timed out / a CRITICAL subsystem is unreachable
  DEGRADED: "degraded", // working but impaired (a non-critical probe down, lag over a soft threshold)
  UNKNOWN: "unknown", // could not be determined (plane unreadable) — NEVER silently "ok"
  OK: "ok", // healthy
});
const STATUS_RANK = { down: 0, degraded: 1, unknown: 2, ok: 3 };

// The verdict an app emits + the platform polls on. ok = serve, degraded = serve+alarm,
// down = fail-closed (the app's health route should answer 503).
export const VERDICT = Object.freeze({ OK: "ok", DEGRADED: "degraded", DOWN: "down" });

// A documented example of the ONE shape every `/api/health/platform` returns.
export const CANONICAL_SHAPE = Object.freeze({
  service: "<service-id>",
  verdict: "ok | degraded | down",
  ok: "boolean (verdict === 'ok')",
  checkedAt: "<ISO-8601>",
  subsystems: [
    {
      name: "<subsystem id, e.g. database>",
      status: "ok | degraded | down | unknown",
      critical: "boolean — does a failure here take the whole platform down?",
      detail: "<one-line human reason>",
      latencyMs: "<number, optional>",
      actionable: "<the next action when not ok, optional>",
    },
  ],
  summary: { total: 0, ok: 0, degraded: 0, down: 0, unknown: 0 },
});

// Normalize an app-native status word (e.g. PLOS uses alarm/warn/ok) onto the canon.
export function normalizeStatus(s) {
  const v = String(s == null ? "" : s).toLowerCase().trim();
  if (v === "ok" || v === "pass" || v === "healthy" || v === "up") return STATUS.OK;
  if (v === "warn" || v === "warning" || v === "degraded" || v === "slow") return STATUS.DEGRADED;
  if (v === "alarm" || v === "down" || v === "fail" || v === "error" || v === "unreachable") return STATUS.DOWN;
  if (v === "unknown" || v === "unverified" || v === "skipped" || v === "") return STATUS.UNKNOWN;
  return STATUS.UNKNOWN; // an unrecognized word is UNKNOWN, never assumed ok (fail-closed)
}

// Fold the per-subsystem statuses into ONE verdict. A CRITICAL subsystem that is DOWN
// (or UNKNOWN — we cannot prove it healthy) takes the whole platform DOWN. A non-critical
// failure, or any DEGRADED, is DEGRADED. Otherwise OK. Fail-closed throughout.
export function computeVerdict(subsystems) {
  const subs = Array.isArray(subsystems) ? subsystems : [];
  let verdict = VERDICT.OK;
  for (const s of subs) {
    const status = normalizeStatus(s.status);
    const critical = s.critical !== false; // default critical = true (safe default)
    if (critical && (status === STATUS.DOWN || status === STATUS.UNKNOWN)) return VERDICT.DOWN;
    if (status === STATUS.DOWN || status === STATUS.DEGRADED) verdict = VERDICT.DEGRADED;
    if (status === STATUS.UNKNOWN && verdict === VERDICT.OK) verdict = VERDICT.DEGRADED;
  }
  return verdict;
}

// Assemble the canonical report from a service id + a list of subsystem results.
export function buildReport(service, subsystems, now = new Date()) {
  const subs = (Array.isArray(subsystems) ? subsystems : []).map((s) => ({
    name: String(s.name || "unnamed"),
    status: normalizeStatus(s.status),
    critical: s.critical !== false,
    detail: s.detail == null ? "" : String(s.detail),
    ...(s.latencyMs != null ? { latencyMs: Number(s.latencyMs) } : {}),
    ...(s.actionable ? { actionable: String(s.actionable) } : {}),
  }));
  const verdict = computeVerdict(subs);
  const summary = { total: subs.length, ok: 0, degraded: 0, down: 0, unknown: 0 };
  for (const s of subs) summary[s.status] = (summary[s.status] || 0) + 1;
  return {
    service: String(service || "unknown"),
    verdict,
    ok: verdict === VERDICT.OK,
    checkedAt: (now instanceof Date ? now : new Date()).toISOString(),
    subsystems: subs,
    summary,
  };
}

// The HTTP status an app's health route should answer for a verdict. down → 503 so a
// load balancer / uptime monitor sees the failure; degraded still serves (200) but the
// body carries the alarm; ok → 200.
export function httpStatusForVerdict(verdict) {
  return verdict === VERDICT.DOWN ? 503 : 200;
}

// Run probes (each: { name, critical?, timeoutMs?, run: async () => ({status, detail, latencyMs?, actionable?}) })
// with a per-probe timeout, fail-closed: a throw or a timeout becomes a DOWN subsystem
// carrying the classified, actionable cause — NEVER a silent omission. Returns the
// canonical report. App endpoints call this (or re-implement the same fold natively).
export async function runHealth(service, probes, now = new Date()) {
  const results = await Promise.all(
    (probes || []).map(async (p) => {
      const started = Date.now();
      const timeoutMs = p.timeoutMs || 4000;
      try {
        const r = await withTimeout(Promise.resolve().then(p.run), timeoutMs, p.name);
        return {
          name: p.name,
          critical: p.critical !== false,
          status: r.status,
          detail: r.detail,
          latencyMs: r.latencyMs != null ? r.latencyMs : Date.now() - started,
          actionable: r.actionable,
        };
      } catch (err) {
        const diag = classifyFailure({ subsystem: p.name, error: err });
        return {
          name: p.name,
          critical: p.critical !== false,
          status: STATUS.DOWN,
          detail: `${diag.cause}: ${diag.detail}`,
          latencyMs: Date.now() - started,
          actionable: diag.actionable,
        };
      }
    }),
  );
  return buildReport(service, results, now);
}

function withTimeout(promise, ms, label) {
  let t;
  const timeout = new Promise((_, reject) => {
    t = setTimeout(() => reject(new Error(`probe "${label}" timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
}

// =============================================================================
// 2. THE RUNTIME-DIAGNOSTICS TAXONOMY — the cure for the silent stop.
// =============================================================================
// Map a raw symptom to ONE named, ACTIONABLE cause. The named set the founder asked
// for: DB unreachable · config key missing (DELEGATE to config-doctor) · stuck consumer
// cursor · connection-pool exhaustion · external API error — plus a stale-heartbeat
// cause (the reliability keystone's self-heal driver) and a never-silent UNKNOWN
// fallback that still says exactly what was observed.
export const CAUSE = Object.freeze({
  DB_UNREACHABLE: "DB_UNREACHABLE",
  CONFIG_KEY_MISSING: "CONFIG_KEY_MISSING",
  POOL_EXHAUSTION: "POOL_EXHAUSTION",
  STUCK_CONSUMER_CURSOR: "STUCK_CONSUMER_CURSOR",
  HEARTBEAT_STALE: "HEARTBEAT_STALE",
  EXTERNAL_API_ERROR: "EXTERNAL_API_ERROR",
  UNKNOWN: "UNKNOWN",
});

// The config-doctor delegation string — a config-class fault is NOT diagnosed here
// (one source of truth per concern); it points the operator at the config layer.
const CONFIG_DOCTOR_HINT =
  "Run the Infrastructure Config layer doctor for the exact key + fix: " +
  "`node infra/config-doctor.mjs --env production` (config-doctor; delegated — config is its concern, not health's).";

// symptom: { subsystem?, error?, code?, status?, httpStatus?, lagSeconds?, ageSeconds?, context? }
// Returns { cause, detail, actionable }. PURE — no env, no IO.
export function classifyFailure(symptom = {}) {
  const sub = String(symptom.subsystem || "").toLowerCase();
  const err = symptom.error;
  const msg = (err && (err.message || err.toString())) || symptom.message || "";
  const code = String(symptom.code || (err && err.code) || "").toUpperCase();
  const m = String(msg);

  // --- config-class first: it must DELEGATE, never be misread as a DB outage ---
  if (
    /invalid environment|is required|missing (?:env|required)|environment variable|invalid url\b|zod|env\.[a-z_]+ is|configuration is invalid/i.test(m) ||
    /CONFIG|ENV/.test(code)
  ) {
    return {
      cause: CAUSE.CONFIG_KEY_MISSING,
      detail: `a required configuration key is missing or invalid (${oneLine(m) || "env validation failed"}).`,
      actionable: CONFIG_DOCTOR_HINT,
    };
  }

  // --- connection-pool exhaustion (the serverless fan-out 503; distinct from a hard outage) ---
  if (
    /too many clients|remaining connection slots|sorry, too many clients|max(?:imum)? .*connections|connection pool (?:timeout|exhausted)|timeout exceeded when trying to connect|connection terminated due to connection timeout|pool is (?:full|draining)/i.test(m) ||
    code === "53300" || // postgres too_many_connections
    (sub.includes("pool") && /timeout/i.test(m))
  ) {
    return {
      cause: CAUSE.POOL_EXHAUSTION,
      detail: `the connection pool is exhausted/timing out (${oneLine(m) || "no free connection"}).`,
      actionable:
        "Confirm DATABASE_URL is the Supabase TRANSACTION-POOLER (port 6543) — a direct :5432 connection exhausts the pool under serverless fan-out (verify with config-doctor). Then check for a connection leak (unclosed clients) and the pool `max`.",
    };
  }

  // --- DB unreachable (a real outage / network / DNS / refused) ---
  if (
    /ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|ECONNRESET|EHOSTUNREACH|connection refused|getaddrinfo|terminating connection|server closed the connection|could not connect|connection terminated unexpectedly|database (?:is )?unreachable/i.test(m) ||
    ["ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN", "ECONNRESET", "EHOSTUNREACH"].includes(code) ||
    (sub.includes("db") || sub.includes("database")) && /unreachable|refused|timeout|down/i.test(m)
  ) {
    return {
      cause: CAUSE.DB_UNREACHABLE,
      detail: `the database is not reachable from the pooled connection (${oneLine(m) || code || "no response"}).`,
      actionable:
        "Check the Supabase project is up (not paused) and DATABASE_URL host/port resolve; confirm the pooler host with config-doctor. If Supabase is up and config is valid, suspect a network/egress block from the deploy.",
    };
  }

  // --- stuck consumer cursor (the event drain fell behind / wedged) ---
  if (
    (sub.includes("cursor") || sub.includes("consumer") || sub.includes("event") || sub.includes("inbox") || sub.includes("outbox") || sub.includes("drain")) &&
    (numAbove(symptom.lagSeconds, symptom.context && symptom.context.cursorStaleSeconds) || /stuck|behind|wedged|not advancing|poison/i.test(m))
  ) {
    const lag = symptom.lagSeconds != null ? `${Math.round(symptom.lagSeconds)}s behind` : "not advancing";
    return {
      cause: CAUSE.STUCK_CONSUMER_CURSOR,
      detail: `the event consumer cursor is ${lag} (${oneLine(m) || "backlog growing"}).`,
      actionable:
        "Trigger the drain/heartbeat once and re-check the cursor advances; if it does not, inspect the head-of-line event for a poison-pill (the keystone quarantines, never silent-drops). A standing cron heartbeat keeps the cursor live.",
    };
  }

  // --- stale heartbeat (the engine self-heal driver stopped beating) ---
  if (
    (sub.includes("heartbeat") || sub.includes("tick") || sub.includes("liveness") || sub.includes("engine")) &&
    (numAbove(symptom.ageSeconds, symptom.context && symptom.context.heartbeatStaleSeconds) || /stale|stopped|no beat|not beating|frozen/i.test(m))
  ) {
    const age = symptom.ageSeconds != null ? `last beat ${Math.round(symptom.ageSeconds)}s ago` : "no recent beat";
    return {
      cause: CAUSE.HEARTBEAT_STALE,
      detail: `the engine heartbeat is stale (${age}) — durable runs will not advance without it.`,
      actionable:
        "Confirm the scheduled heartbeat (Vercel cron → the tick/heartbeat route) is firing and its secret (CRON_SECRET/TICK_TOKEN) is set (verify with config-doctor). The heartbeat is what self-heals interrupted runs; a stale heartbeat means the self-heal loop is down.",
    };
  }

  // --- external API error (an upstream dependency answered badly) ---
  const http = Number(symptom.httpStatus || symptom.status);
  if (
    (Number.isFinite(http) && http >= 400) ||
    /fetch failed|upstream|gateway|bad gateway|service unavailable|rate limit|429|5\d\d\b|api (?:error|returned)/i.test(m) ||
    sub.includes("api") || sub.includes("upstream") || sub.includes("external")
  ) {
    return {
      cause: CAUSE.EXTERNAL_API_ERROR,
      detail: `an external API returned an error (${Number.isFinite(http) ? `HTTP ${http}` : oneLine(m) || "non-2xx"}).`,
      actionable:
        "Check the upstream provider's status and the credential/quota for it (config-doctor verifies the key is present). Retry with backoff; if it is a 4xx, the request/credential is wrong, not the network.",
    };
  }

  // --- never silent: an unrecognized failure still names what was observed ---
  return {
    cause: CAUSE.UNKNOWN,
    detail: `unrecognized failure — needs investigation. Observed: ${oneLine(m) || code || "(no message)"}${sub ? ` [subsystem=${sub}]` : ""}.`,
    actionable:
      "This was NOT silently dropped — capture the full error + the subsystem and add a rule to the diagnostics taxonomy (platform-health.mjs classifyFailure) so the next occurrence is named.",
  };
}

function oneLine(s) {
  return String(s || "").replace(/\s+/g, " ").trim().slice(0, 200);
}
function numAbove(a, b) {
  const x = Number(a);
  const t = Number(b == null ? 0 : b);
  return Number.isFinite(x) && x > t;
}

// =============================================================================
// 3. CANONICAL-SHAPE VALIDATION (used by `validate` + the per-app shape tests).
// =============================================================================
export function validateReport(report) {
  const errs = [];
  const r = report || {};
  if (typeof r.service !== "string" || !r.service) errs.push("service must be a non-empty string");
  if (![VERDICT.OK, VERDICT.DEGRADED, VERDICT.DOWN].includes(r.verdict)) errs.push(`verdict must be one of ok|degraded|down (got ${r.verdict})`);
  if (typeof r.ok !== "boolean") errs.push("ok must be a boolean");
  if (r.ok !== (r.verdict === VERDICT.OK)) errs.push("ok must equal (verdict === 'ok')");
  if (typeof r.checkedAt !== "string" || Number.isNaN(Date.parse(r.checkedAt))) errs.push("checkedAt must be an ISO-8601 string");
  if (!Array.isArray(r.subsystems)) errs.push("subsystems must be an array");
  else
    r.subsystems.forEach((s, i) => {
      if (typeof s.name !== "string" || !s.name) errs.push(`subsystems[${i}].name must be a non-empty string`);
      if (![STATUS.OK, STATUS.DEGRADED, STATUS.DOWN, STATUS.UNKNOWN].includes(s.status)) errs.push(`subsystems[${i}].status invalid (${s.status})`);
      if (typeof s.critical !== "boolean") errs.push(`subsystems[${i}].critical must be a boolean`);
    });
  // cross-check the fold is internally consistent
  if (Array.isArray(r.subsystems) && computeVerdict(r.subsystems) !== r.verdict)
    errs.push(`verdict (${r.verdict}) does not match the worst-wins fold of subsystems (${computeVerdict(r.subsystems)})`);
  return { valid: errs.length === 0, errors: errs };
}

// =============================================================================
// CLI
// =============================================================================
function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const cmd = process.argv[2];
  if (process.argv.includes("--self-test")) return selfTest();
  if (cmd === "diagnose") return cmdDiagnose();
  if (cmd === "validate") return cmdValidate();
  process.stdout.write(
    "platform-health — runtime health + diagnostics engine (Infrastructure Platform).\n\n" +
      "  node platform-health.mjs diagnose [--symptom '<json>'] [--json]   (or pipe symptom JSON on stdin)\n" +
      "  node platform-health.mjs validate [--report '<json>']             (or pipe report JSON on stdin)\n" +
      "  node platform-health.mjs --self-test\n",
  );
  process.exit(0);
}

async function loadJson(flag) {
  const inline = arg(flag);
  let raw = inline;
  if (raw == null) {
    const { readFileSync } = await import("node:fs");
    try { raw = readFileSync(0, "utf8"); } catch { raw = ""; }
  }
  if (!raw || !raw.trim()) {
    process.stderr.write(`platform-health: no JSON provided (pass ${flag} '<json>' or pipe JSON on stdin).\n`);
    process.exit(2);
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    process.stderr.write(`platform-health: invalid JSON (${e.message}).\n`);
    process.exit(2);
  }
}

async function cmdDiagnose() {
  const symptom = await loadJson("--symptom");
  const result = classifyFailure(symptom);
  if (process.argv.includes("--json")) {
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  } else {
    process.stdout.write(`\ndiagnosis: ${result.cause}\n  ${result.detail}\n  → ${result.actionable}\n\n`);
  }
  process.exit(0);
}

async function cmdValidate() {
  const report = await loadJson("--report");
  const v = validateReport(report);
  if (v.valid) {
    process.stdout.write(`valid — canonical /api/health/platform shape (service=${report.service}, verdict=${report.verdict}).\n`);
    process.exit(0);
  }
  process.stderr.write("INVALID — not the canonical health shape:\n" + v.errors.map((e) => `  ✗ ${e}`).join("\n") + "\n");
  process.exit(1);
}

// =============================================================================
// SELF-TEST — pure; proves the verdict fold + the diagnostics taxonomy.
// =============================================================================
function selfTest() {
  const cases = [];
  const assert = (name, cond) => cases.push({ name, ok: !!cond });

  // --- verdict fold ---
  assert("all-ok → ok", computeVerdict([{ status: "ok", critical: true }, { status: "ok", critical: false }]) === "ok");
  assert("critical down → down", computeVerdict([{ status: "down", critical: true }, { status: "ok" }]) === "down");
  assert("non-critical down → degraded", computeVerdict([{ status: "down", critical: false }, { status: "ok" }]) === "degraded");
  assert("critical unknown → down (cannot prove healthy)", computeVerdict([{ status: "unknown", critical: true }]) === "down");
  assert("any degraded → degraded", computeVerdict([{ status: "degraded", critical: false }, { status: "ok" }]) === "degraded");
  assert("default critical=true (missing flag) down → down", computeVerdict([{ status: "down" }]) === "down");

  // --- normalization (app-native words map onto the canon) ---
  assert("PLOS 'alarm' → down", normalizeStatus("alarm") === "down");
  assert("PLOS 'warn' → degraded", normalizeStatus("warn") === "degraded");
  assert("'error' → down", normalizeStatus("error") === "down");
  assert("unknown word → unknown (never silent-ok)", normalizeStatus("banana") === "unknown");

  // --- buildReport shape ---
  const rep = buildReport("svc-x", [
    { name: "database", status: "ok", critical: true, latencyMs: 5 },
    { name: "cursor", status: "warn", critical: false, detail: "12s behind" },
  ]);
  assert("buildReport verdict folds to degraded", rep.verdict === "degraded" && rep.ok === false);
  assert("buildReport summary counts", rep.summary.ok === 1 && rep.summary.degraded === 1 && rep.summary.total === 2);
  assert("buildReport carries ISO checkedAt", typeof rep.checkedAt === "string" && !Number.isNaN(Date.parse(rep.checkedAt)));
  assert("validateReport accepts its own buildReport output", validateReport(rep).valid === true);
  assert("httpStatusForVerdict: down→503, ok→200", httpStatusForVerdict("down") === 503 && httpStatusForVerdict("ok") === 200);

  // --- validateReport rejects drift ---
  assert("validate rejects a verdict/fold mismatch", validateReport({ ...rep, verdict: "ok", ok: true }).valid === false);
  assert("validate rejects a bad status word", validateReport(buildReportRaw([{ name: "x", status: "frobnicated", critical: true }])).valid === false);

  // --- runHealth: a throwing probe becomes a DOWN subsystem with a classified cause (NEVER silent) ---
  return runHealthSelfTest(cases, assert);
}
// helper used only by the self-test to build an intentionally-invalid report
function buildReportRaw(subs) {
  return { service: "x", verdict: "ok", ok: true, checkedAt: new Date().toISOString(), subsystems: subs.map((s) => ({ detail: "", ...s })), summary: { total: subs.length, ok: 0, degraded: 0, down: 0, unknown: 0 } };
}

async function runHealthSelfTest(cases, assert) {
  const report = await runHealth("svc", [
    { name: "database", critical: true, run: async () => { throw new Error("connect ECONNREFUSED 10.0.0.1:6543"); } },
    { name: "config", critical: true, run: async () => { throw new Error("Invalid environment configuration: DATABASE_URL is required"); } },
    { name: "ok-one", critical: false, run: async () => ({ status: "ok", detail: "fine" }) },
  ]);
  assert("runHealth: throwing critical probe → subsystem down (not omitted)", report.subsystems.find((s) => s.name === "database").status === "down");
  assert("runHealth: db throw classified DB_UNREACHABLE", /DB_UNREACHABLE/.test(report.subsystems.find((s) => s.name === "database").detail));
  assert("runHealth: config throw DELEGATES to config-doctor", /config-doctor/.test(report.subsystems.find((s) => s.name === "config").actionable || ""));
  assert("runHealth: overall verdict down (a critical probe failed)", report.verdict === "down");

  // --- the diagnostics taxonomy (each named cause + the never-silent fallback) ---
  const dx = (s) => classifyFailure(s).cause;
  assert("dx DB_UNREACHABLE (ECONNREFUSED)", dx({ subsystem: "database", error: new Error("connect ECONNREFUSED") }) === "DB_UNREACHABLE");
  assert("dx POOL_EXHAUSTION (too many clients)", dx({ subsystem: "database", error: new Error("sorry, too many clients already") }) === "POOL_EXHAUSTION");
  assert("dx POOL_EXHAUSTION (pg 53300)", dx({ subsystem: "db", code: "53300", error: new Error("FATAL") }) === "POOL_EXHAUSTION");
  assert("dx CONFIG_KEY_MISSING (env required) + delegates", (() => { const r = classifyFailure({ error: new Error("DATABASE_URL is required") }); return r.cause === "CONFIG_KEY_MISSING" && /config-doctor/.test(r.actionable); })());
  assert("dx STUCK_CONSUMER_CURSOR (lag over threshold)", dx({ subsystem: "event-cursor", lagSeconds: 600, context: { cursorStaleSeconds: 300 } }) === "STUCK_CONSUMER_CURSOR");
  assert("dx HEARTBEAT_STALE (age over threshold)", dx({ subsystem: "heartbeat", ageSeconds: 900, context: { heartbeatStaleSeconds: 600 } }) === "HEARTBEAT_STALE");
  assert("dx EXTERNAL_API_ERROR (http 502)", dx({ subsystem: "external-api", httpStatus: 502 }) === "EXTERNAL_API_ERROR");
  assert("dx UNKNOWN (unrecognized) — but NOT silent", (() => { const r = classifyFailure({ error: new Error("???weird???") }); return r.cause === "UNKNOWN" && /weird/.test(r.detail); })());
  assert("dx config beats db ordering (env error not misread as outage)", dx({ subsystem: "database", error: new Error("Invalid environment configuration: SUPABASE_URL Invalid url") }) === "CONFIG_KEY_MISSING");

  const failed = cases.filter((c) => !c.ok);
  for (const c of cases) process.stdout.write(`${c.ok ? "✓" : "✗"} ${c.name}\n`);
  process.stdout.write(`\nplatform-health self-test: ${cases.length - failed.length}/${cases.length} passed.\n`);
  if (failed.length) {
    process.stdout.write("FAIL:\n" + failed.map((c) => `  - ${c.name}`).join("\n") + "\n");
    process.exit(1);
  }
  process.exit(0);
}

// --- entrypoint (only when run as a CLI; importing the pure exports never runs this) ---
import { fileURLToPath } from "node:url";
import { basename } from "node:path";
const _thisFile = fileURLToPath(import.meta.url);
const _invoked = process.argv[1] || "";
if (_invoked && basename(_invoked) === basename(_thisFile)) {
  main().catch((e) => {
    process.stderr.write(`platform-health: ${e && e.stack ? e.stack : e}\n`);
    process.exit(2);
  });
}
