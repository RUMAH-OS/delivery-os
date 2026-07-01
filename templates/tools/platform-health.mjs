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
  QUERY_TIMEOUT: "QUERY_TIMEOUT",
  STUCK_CONSUMER_CURSOR: "STUCK_CONSUMER_CURSOR",
  HEARTBEAT_STALE: "HEARTBEAT_STALE",
  EXTERNAL_API_ERROR: "EXTERNAL_API_ERROR",
  UNKNOWN: "UNKNOWN",
});

// THE CONNECT-vs-POOL-ACQUIRE DISTINCTION (the incident the blind-board RCA caught, 2026-06-27).
// A PLOS prod hang to HTTP 000 was first lensed as a connection-ESTABLISHMENT failure (the #208
// connect_timeout fix) but was actually unbounded POOL-ACQUIRE / QUERY-RUNTIME queuing (the #209
// statement_timeout fix). The two have OPPOSITE remedies, so the taxonomy MUST tell them apart:
//   • DB_UNREACHABLE   = the TCP/TLS connection cannot be ESTABLISHED (ECONNREFUSED/ENOTFOUND/…)
//                        → the DB/host/network is the problem; connect_timeout is the relevant bound.
//   • POOL_EXHAUSTION  = a connection cannot be ACQUIRED from the pool (all `max` busy, acquire queue
//                        grows) → the DB is reachable; pool size / fan-out / a leak is the problem.
//   • QUERY_TIMEOUT    = a connection WAS acquired and a query RAN too long (statement_timeout fired,
//                        pg 57014) → the DB is reachable; the query/index/fan-out is the problem.
// Connect establishment is ~17ms in prod; a 30s+ hang is NEVER establishment. classifyFailure orders
// QUERY_TIMEOUT and POOL_EXHAUSTION BEFORE DB_UNREACHABLE so an acquire/runtime hang is never misread
// as an outage.

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

  // --- query-runtime timeout (statement_timeout FIRED — the bound WORKING, NOT a hang/outage) ---
  // pg 57014 (query_canceled). This is the #209 statement_timeout doing its job: a query that ran
  // past the budget is CANCELLED into a fast throw instead of hanging the request past the gateway.
  // It is a POOL-ACQUIRE/QUERY-RUNTIME symptom (the DB is reachable, a query was too slow), NOT a
  // connection failure — so it MUST be classified before DB_UNREACHABLE.
  if (
    code === "57014" ||
    /statement timeout|canceling statement due to statement timeout|query[_ ]cancell?ed|statement_timeout/i.test(m)
  ) {
    return {
      cause: CAUSE.QUERY_TIMEOUT,
      detail: `a query exceeded statement_timeout and was cancelled (${oneLine(m) || "pg 57014 query_canceled"}). The DB is REACHABLE — this is the bound working (fast throw, not a hang), not an outage.`,
      actionable:
        "This is NOT a connection failure — do not chase the network/pooler. Find the slow query (a missing index, an oversized page fan-out, a lock wait); reduce the work or raise DB_STATEMENT_TIMEOUT_MS DELIBERATELY (never to 0/empty — that disables the bound; see config-doctor int-positive / the DB-client preflight). A recurring statement_timeout means the request path's degraded fallback IS firing — the app stays reachable, but the underlying query needs fixing.",
    };
  }

  // --- connection-pool exhaustion / ACQUIRE timeout (the serverless fan-out hang; NOT a hard outage) ---
  // A connection cannot be ACQUIRED from the pool: all `max` are busy and the acquire queue grows
  // (or the session pooler's client cap is hit). The DB is reachable; the fix is pool size / fan-out /
  // a leak, NOT the network. Ordered before DB_UNREACHABLE so an acquire-queue hang is never misread
  // as an establishment outage (the connect-vs-pool-acquire distinction).
  if (
    /too many clients|remaining connection slots|sorry, too many clients|max(?:imum)? .*connections|connection pool (?:timeout|exhausted)|timeout exceeded when trying to connect|connection terminated due to connection timeout|pool is (?:full|draining)|timed out (?:acquiring|fetching) a connection|could not acquire|no (?:available|free) connection|acquire(?:ment)? timeout|EMAXCONNSESSION/i.test(m) ||
    code === "53300" || // postgres too_many_connections
    (sub.includes("pool") && /timeout|acquire|wait|queue/i.test(m))
  ) {
    return {
      cause: CAUSE.POOL_EXHAUSTION,
      detail: `a connection could not be ACQUIRED from the pool — all connections busy / acquire queue growing (${oneLine(m) || "no free connection"}). Typically pool-acquire pressure (the DB reachable, the pool starved), though a connect-timeout phrasing can also come from a paused/unreachable DB — confirm reachability first.`,
      actionable:
        "FIRST confirm the DB is actually up (a paused/unreachable Supabase project can surface a similar connect-timeout message — if it is down, this is really DB_UNREACHABLE). Once the DB is confirmed reachable: confirm DATABASE_URL is the Supabase TRANSACTION-POOLER (port 6543) — a direct :5432 connection caps the pool under serverless fan-out (verify with config-doctor); bound the work each held connection does with a statement_timeout (so connections always cycle back — the load-bearing fix postgres.js's missing pool-acquire timeout otherwise leaves unbounded); right-size `max`; reduce per-request fan-out; and check for a connection leak (unclosed clients).",
    };
  }

  // --- DB unreachable (a real outage: TCP/TLS connection cannot be ESTABLISHED — network/DNS/refused) ---
  if (
    /ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|ECONNRESET|EHOSTUNREACH|connection refused|getaddrinfo|terminating connection|server closed the connection|could not connect|connection terminated unexpectedly|database (?:is )?unreachable/i.test(m) ||
    ["ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN", "ECONNRESET", "EHOSTUNREACH"].includes(code) ||
    (sub.includes("db") || sub.includes("database")) && /unreachable|refused|timeout|down/i.test(m)
  ) {
    return {
      cause: CAUSE.DB_UNREACHABLE,
      detail: `the database connection could not be ESTABLISHED (${oneLine(m) || code || "no response"}) — a TCP/TLS/DNS-level failure, distinct from a pool-acquire or query-runtime hang.`,
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
// 2b. THE PROD-DB-CLIENT PREFLIGHT — assert a serverless DB client is hang-safe.
// =============================================================================
// A deploy/runtime PREFLIGHT (static, source-level): the THREE properties a prod
// serverless DB client MUST declare so it cannot hang a request past the gateway to
// HTTP 000. This is the STANDARD distilled from the 2026-06-27 PLOS incident, where a
// client with only a connect bound (no statement_timeout, no bounded pool, and a
// `Number(env ?? d)` env read) hung on unbounded pool-acquire queuing:
//   1. statement_timeout — a per-connection server-side query bound. The ONLY available
//      ceiling on pool-acquire/query-runtime hangs (postgres.js has no pool-acquire timeout);
//      it forces every held connection to cycle back within the budget → a fast degraded
//      throw instead of a gateway-busting hang.
//   2. a BOUNDED pool (`max`) — an explicit, finite connection ceiling.
//   3. ENV-ROBUSTNESS — numeric knobs read as `Number(env)||default`, NEVER
//      `Number(env ?? default)`: an empty-string env makes `Number("")===0`, silently
//      disabling the timeout/pool (BUG-209-1). The `??` form is FLAGGED as a finding.
// PURE: operates on the client SOURCE string. No file IO, no env. Returns
// { ok, findings:[{severity, code, message}] }; ok === no BLOCKER finding.
export function assertDbClientHardening(source, { file = "<db-client>" } = {}) {
  const raw = String(source == null ? "" : source);
  // Scan DECOMMENTED code only: a client that DOCUMENTS the anti-pattern in a JSDoc/comment
  // (e.g. numEnv's own doc quoting `Number(env ?? d)` as the trap it closes) must not false-positive.
  // Strip block comments, then line comments — but never the `//` inside a `://` URL scheme.
  const src = raw.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
  const findings = [];
  const add = (severity, code, message) => findings.push({ severity, code, message });

  // 3 — the empty-env trap: any `Number( process.env... ?? ... )` is the disable-on-empty bug.
  // Match a Number(...) call whose argument reads process.env and uses `??` before the close paren.
  const nullishEnv = /Number\(\s*(?:process\.)?env[^)]*\?\?[^)]*\)/i.test(src);
  if (nullishEnv)
    add(
      "blocker",
      "env-nullish-coalesce",
      "a numeric env knob is read as `Number(env ?? default)` — an empty-string env coerces to 0 and DISABLES the bound (BUG-209-1). Use `Number(env) || default` (or a numEnv() helper).",
    );

  // 1 — statement_timeout must be declared.
  const hasStatementTimeout = /statement_timeout/i.test(src);
  if (!hasStatementTimeout)
    add(
      "blocker",
      "no-statement-timeout",
      "no statement_timeout declared. Without it a pool-acquire/query hang has NO ceiling (postgres.js has no pool-acquire timeout) → the request hangs past the gateway to HTTP 000. Declare a per-connection statement_timeout under the platform default (< the gateway ceiling).",
    );
  // 1a — postgres.js foot-gun: statement_timeout MUST live inside the `connection:{}` block (it is sent
  // as a startup parameter). At the top level postgres.js silently IGNORES it — declared but dead.
  // Advisory (not a blocker): we cannot prove the driver from a string, but flag the likely-dead case.
  if (hasStatementTimeout && /postgres\s*\(/.test(src) && !/connection\s*:\s*\{[^}]*statement_timeout/is.test(src))
    add(
      "should",
      "statement-timeout-not-in-connection",
      "statement_timeout is present but not inside a `connection: { … }` block. In postgres.js it is a connection startup parameter — placed elsewhere it is silently IGNORED (declared but dead). Confirm it is applied (read it back with `SHOW statement_timeout` at boot).",
    );
  // 1b — value sanity: a LITERAL default >= the gateway ceiling still hangs past it. We can only read a
  // literal fallback (Number(env)||<N> / ?? <N>); env-supplied values are checked at the config layer (int-positive).
  const litMs = src.match(/statement_timeout[^;\n]*?(?:\|\||\?\?)\s*(\d{3,})/);
  if (litMs && Number(litMs[1]) >= 25000)
    add(
      "should",
      "statement-timeout-too-high",
      `the statement_timeout default (${litMs[1]}ms) is >= the typical ~25s serverless gateway ceiling — a query can still run past the gateway and hang to HTTP 000. Set it comfortably UNDER the platform's request budget.`,
    );

  // 2 — a bounded pool must be declared. Accept postgres.js `max:`, a pool_size/pool_max knob, or a
  // URL-style `connection_limit` (Prisma). `max:` is matched only when it plausibly configures a client
  // (postgres()/Pool()/createClient nearby) to reduce false-positives from unrelated `max:` config.
  const hasBoundedPool =
    /\bconnection_limit\b/i.test(src) ||
    /\bpool_?(?:size|max)\b/i.test(src) ||
    (/\bmax\s*:/.test(src) && /\b(?:postgres|Pool|createPool|createClient|drizzle)\s*\(/.test(src));
  if (!hasBoundedPool)
    add(
      "blocker",
      "no-bounded-pool",
      "no bounded pool size declared (postgres.js `max:` / a pool_size knob / Prisma `connection_limit`). An unbounded/implicit pool either exhausts the session-pooler cap or hides the fan-out-vs-pool mismatch. Declare an explicit bound.",
    );

  // advisory: a connect bound is good practice (fail-fast on a cold/starved connect) but is NOT
  // the load-bearing bound — its absence is a nudge, not a blocker (statement_timeout is the floor).
  if (!/connect_timeout/i.test(src))
    add("nice", "no-connect-timeout", "no connect_timeout declared — add one to fail fast on a cold/starved connection (advisory; statement_timeout is the load-bearing bound).");

  const ok = !findings.some((f) => f.severity === "blocker");
  return { ok, file, findings };
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
  if (cmd === "preflight-db-client") return cmdPreflightDbClient();
  process.stdout.write(
    "platform-health — runtime health + diagnostics engine (Infrastructure Platform).\n\n" +
      "  node platform-health.mjs diagnose [--symptom '<json>'] [--json]   (or pipe symptom JSON on stdin)\n" +
      "  node platform-health.mjs validate [--report '<json>']             (or pipe report JSON on stdin)\n" +
      "  node platform-health.mjs preflight-db-client --file <path> [--json]  (assert a prod DB client is hang-safe)\n" +
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

// preflight-db-client: read a DB-client source file and assert it is hang-safe.
// EXIT 0 = no blocker · 1 = a blocker finding · 2 = usage/IO error.
async function cmdPreflightDbClient() {
  const file = arg("--file");
  if (!file) {
    process.stderr.write("platform-health: preflight-db-client needs --file <path-to-db-client>.\n");
    process.exit(2);
  }
  let source;
  try {
    const { readFileSync } = await import("node:fs");
    source = readFileSync(file, "utf8");
  } catch (e) {
    process.stderr.write(`platform-health: cannot read ${file} (${e.message}).\n`);
    process.exit(2);
  }
  const res = assertDbClientHardening(source, { file });
  if (process.argv.includes("--json")) {
    process.stdout.write(JSON.stringify(res, null, 2) + "\n");
  } else {
    process.stdout.write(`\nDB-client preflight — ${file}\n`);
    if (!res.findings.length) process.stdout.write("  ✓ statement_timeout · bounded pool · env-robustness — all present.\n");
    for (const f of res.findings) {
      const icon = f.severity === "blocker" ? "✗" : f.severity === "nice" ? "·" : "!";
      process.stdout.write(`  ${icon} [${f.severity}] ${f.code}: ${f.message}\n`);
    }
    process.stdout.write(
      res.ok
        ? "\nRESULT: PASS — the prod DB client declares the hang-safe standard.\n"
        : "\nRESULT: FAIL — a BLOCKER property is missing; this client can hang a request past the gateway (HTTP 000). Fix the ✗ items.\n",
    );
  }
  process.exit(res.ok ? 0 : 1);
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

  // --- THE CONNECT-vs-POOL-ACQUIRE DISTINCTION (the blind-board correction, 2026-06-27) ---
  assert("dx QUERY_TIMEOUT (statement_timeout fired, pg 57014)", dx({ subsystem: "database", code: "57014", error: new Error("canceling statement due to statement timeout") }) === "QUERY_TIMEOUT");
  assert("dx QUERY_TIMEOUT (message only)", dx({ subsystem: "db", error: new Error("ERROR: canceling statement due to statement timeout") }) === "QUERY_TIMEOUT");
  assert("dx QUERY_TIMEOUT is NOT misread as an outage", dx({ subsystem: "database", error: new Error("statement timeout") }) !== "DB_UNREACHABLE");
  assert("dx POOL_EXHAUSTION (acquire-queue wait, not establishment)", dx({ subsystem: "db-pool", error: new Error("Timed out acquiring a connection from the pool") }) === "POOL_EXHAUSTION");
  assert("dx POOL_EXHAUSTION (EMAXCONNSESSION session cap)", dx({ subsystem: "database", error: new Error("EMAXCONNSESSION: max clients reached") }) === "POOL_EXHAUSTION");
  assert("dx DB_UNREACHABLE is ESTABLISHMENT-only (refused → still an outage)", dx({ subsystem: "database", error: new Error("ECONNREFUSED") }) === "DB_UNREACHABLE");
  assert("dx ordering: a statement-timeout on the db subsystem is QUERY_TIMEOUT, not DB_UNREACHABLE", dx({ subsystem: "database", error: new Error("canceling statement due to statement timeout") }) === "QUERY_TIMEOUT");

  // --- the prod-DB-client PREFLIGHT (the hang-safe standard) ---
  const goodClient = `postgres(url, { max: Number(process.env.DB_POOL_MAX) || 8, connect_timeout: Number(process.env.DB_CONNECT_TIMEOUT) || 10, connection: { statement_timeout: Number(process.env.DB_STMT) || 8000 } })`;
  assert("preflight PASS: a client with statement_timeout + bounded pool + Number||default", assertDbClientHardening(goodClient).ok === true);
  const noStmt = `postgres(url, { max: Number(process.env.DB_POOL_MAX) || 8, connect_timeout: 10 })`;
  assert("preflight FAIL: missing statement_timeout is a BLOCKER", (() => { const r = assertDbClientHardening(noStmt); return r.ok === false && r.findings.some((f) => f.code === "no-statement-timeout"); })());
  const nullishClient = `postgres(url, { max: Number(process.env.DB_POOL_MAX ?? 8), connection: { statement_timeout: Number(process.env.DB_STMT ?? 8000) } })`;
  assert("preflight FAIL: `Number(env ?? d)` empty-env trap is a BLOCKER", (() => { const r = assertDbClientHardening(nullishClient); return r.ok === false && r.findings.some((f) => f.code === "env-nullish-coalesce"); })());
  const noPool = `postgres(url, { connection: { statement_timeout: Number(process.env.DB_STMT) || 8000 } })`;
  assert("preflight FAIL: no bounded pool (`max`) is a BLOCKER", (() => { const r = assertDbClientHardening(noPool); return r.ok === false && r.findings.some((f) => f.code === "no-bounded-pool"); })());
  // regression: a client that only MENTIONS the anti-pattern in a comment (numEnv's doc) must PASS.
  const documentedClient = `// avoid Number(process.env.X ?? d) — empty-env coerces to 0\n${goodClient}`;
  assert("preflight: the anti-pattern quoted in a COMMENT does not false-positive", assertDbClientHardening(documentedClient).ok === true);
  // a Prisma-style URL pool bound (connection_limit) counts as a bounded pool (driver-agnostic).
  const prismaish = `new PrismaClient({ datasources: { db: { url: "postgres://h/db?connection_limit=5&statement_timeout=8000" } } })`;
  assert("preflight: connection_limit counts as a bounded pool", (() => { const r = assertDbClientHardening(prismaish); return !r.findings.some((f) => f.code === "no-bounded-pool"); })());
  // value sanity: a literal statement_timeout default at/over the ~25s gateway still hangs → SHOULD.
  const tooHigh = `postgres(url, { max: Number(process.env.M) || 8, connection: { statement_timeout: Number(process.env.T) || 30000 } })`;
  assert("preflight: statement_timeout default >= 25s is flagged (still hangs past the gateway)", (() => { const r = assertDbClientHardening(tooHigh); return r.findings.some((f) => f.code === "statement-timeout-too-high"); })());
  // postgres.js wrong-nesting: statement_timeout at the top level is silently ignored → SHOULD.
  const wrongNest = `postgres(url, { max: 8, statement_timeout: 8000 })`;
  assert("preflight: postgres.js statement_timeout outside connection{} is flagged (declared-but-dead)", (() => { const r = assertDbClientHardening(wrongNest); return r.findings.some((f) => f.code === "statement-timeout-not-in-connection"); })());
  assert("preflight: missing connect_timeout is only a NICE nudge (not a blocker)", (() => { const c = `postgres(url, { max: Number(process.env.M) || 8, connection: { statement_timeout: Number(process.env.T) || 8000 } })`; const r = assertDbClientHardening(c); return r.ok === true && r.findings.some((f) => f.code === "no-connect-timeout" && f.severity === "nice"); })());

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
