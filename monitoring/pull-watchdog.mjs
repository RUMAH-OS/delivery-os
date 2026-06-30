// =============================================================================
// monitoring/pull-watchdog.mjs  —  the OFF-NEO PULL watchdog (the independent backup failure domain).
// =============================================================================
// THE SECOND, INDEPENDENT off-Neo dead-man (NEO-HBM-v1 Layer F / §4.2 / ADR-001). It runs on a DIFFERENT
// machine than Neo (windows-node1 — the failure domain referenced by config-templates/watchdog/
// windows-pull-task.xml.template). On a schedule it PULLS Neo's tailnet `/ready` (MagicDNS host from config);
// on N consecutive misses it ALERTS the founder through an injectable notifier seam. It is the partner of the
// on-Neo PUSH check-in (bootstrap/supervisor-entry.mjs → Healthchecks.io): two off-Neo domains that share
// nothing but the founder's phone, so a single fault — Neo dead OR Healthchecks.io down — still pages.
//
// POSITION (the Repository & Dependency Principle): this is an ADAPTER (architecture.config.json `monitoring`
// layer). It depends on NOTHING outward: zero npm deps, Node built-ins only, no infra SDK. It consumes the Core
// Health-Emission CONTRACT by SHAPE only — it keys on the HTTP status the supervisor already computed via the
// contract's `isReady` (200 = ready, anything else = miss), so it NEVER re-derives "is it healthy" (one source
// of truth). The PlatformHealthReport body, when present, is surfaced verbatim for the alert detail.
//
// HARD INVARIANTS (the point of the sprint):
//   • FAILURE-DOMAIN INDEPENDENCE — installed on windows-node1, NOT on Neo (it cannot watch the box it rides).
//   • READ-ONLY — it GETs `/ready`; it never restarts Neo, never promotes, never writes Neo state. A dumb timer
//     that pages a human (NEO-HBM §4.3).
//   • NO SECRET LITERAL — the notifier (Slack/email) reads any credential from the host credential store at the
//     edge; nothing is baked here. The default notifier is console-only (inert until a real channel is wired).
//   • INJECTABLE fetch + clock + store — the self-test runs with NO real network, NO real loop, NO real disk.
//
// SCHEDULING: the Windows Scheduled Task (windows-pull-task.xml.template) drives the cadence — it invokes this
// script ONCE per fire (`node pull-watchdog.mjs`). The consecutive-miss streak therefore lives in a tiny durable
// store between runs (default: a JSON file; the self-test injects an in-memory store). There is NO internal
// always-on loop — the OS scheduler owns the clock, the same discipline as the on-Neo daemon owning its tick.
//
// USAGE:
//   node monitoring/pull-watchdog.mjs              # one poll (what the Scheduled Task invokes)
//   node monitoring/pull-watchdog.mjs --self-test  # offline proof (miss fires / healthy silent), no net/loop
// =============================================================================

import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * @typedef {import("../templates/governance-engine/health-contract.js").PlatformHealthReport} PlatformHealthReport
 * The Core contract type — referenced for the shape only (this is a runtime-pure .mjs; the editor/type-checker
 * resolves it, the runtime never imports a Core file).
 */

/**
 * The result of one probe of Neo's `/ready`.
 * @typedef {Object} PollResult
 * @property {boolean} ok          true iff the node answered HTTP 200 (its own isReady → ready). Else a MISS.
 * @property {number=} status      the HTTP status, when a response arrived (503 = a down/degraded node).
 * @property {string=} error       a transport-level reason (unreachable / timeout), when no response arrived.
 * @property {PlatformHealthReport=} report  the parsed report body, when present (surfaced in the alert detail).
 */

/**
 * The notifier seam — the off-Neo alert channel. INJECTED, exactly like the governance-engine ports. The default
 * is console-only (honest + inert until a real channel is wired); a founder injects a Slack/email/SMS notifier
 * whose credential comes from the host store, NEVER a literal here.
 * @typedef {Object} Notifier
 * @property {(event: AlertEvent) => (void|Promise<void>)} alert    fired when the miss threshold is crossed (P1).
 * @property {(event: AlertEvent) => (void|Promise<void>)} [recover] fired once when Neo answers ready again.
 */

/**
 * @typedef {Object} AlertEvent
 * @property {"down"|"recovered"} kind
 * @property {string} node                 the MagicDNS target probed.
 * @property {number} consecutiveMisses
 * @property {number} threshold
 * @property {string} at                   ISO-8601 from the injected clock.
 * @property {string} detail               human one-liner (the last transport error / report verdict).
 */

/**
 * @typedef {Object} WatchdogState
 * @property {number} consecutiveMisses
 * @property {boolean} alerted            de-dupe latch — a sustained outage pages ONCE, not every poll.
 * @property {string=} lastOkAt
 * @property {string=} lastMissAt
 */

const DEFAULT_THRESHOLD = 3; // K consecutive misses before a page (conservative — fewer pages, per NEO-HBM §9.1).
const DEFAULT_TIMEOUT_MS = 5000;

/** A fresh, never-fired state (the streak baseline). @returns {WatchdogState} */
export function freshState() {
  return { consecutiveMisses: 0, alerted: false };
}

/**
 * THE PURE CORE — fold one poll into the next state + an action. No I/O, no clock, no host. This is the whole
 * decision logic, isolated so the self-test proves it exhaustively offline.
 * @param {WatchdogState} prev
 * @param {PollResult} poll
 * @param {number} threshold
 * @param {string} nowIso
 * @returns {{ state: WatchdogState, action: "none"|"alert"|"recover" }}
 */
export function decidePoll(prev, poll, threshold, nowIso) {
  if (poll.ok) {
    // a HIT resets the streak. If we were in an alerted outage, emit a single recovery, else stay silent.
    const recovered = prev.alerted === true;
    return {
      state: { consecutiveMisses: 0, alerted: false, lastOkAt: nowIso, lastMissAt: prev.lastMissAt },
      action: recovered ? "recover" : "none",
    };
  }
  // a MISS advances the streak.
  const consecutiveMisses = prev.consecutiveMisses + 1;
  const crossed = consecutiveMisses >= threshold && prev.alerted !== true;
  return {
    state: {
      consecutiveMisses,
      alerted: prev.alerted === true || crossed, // latch on first crossing; stays latched through the outage.
      lastOkAt: prev.lastOkAt,
      lastMissAt: nowIso,
    },
    action: crossed ? "alert" : "none",
  };
}

/** Build the MagicDNS readiness URL from config (no secret; a tailnet host:port path). */
export function readyUrl({ neoHost, healthPort, scheme = "http", path = "/ready" }) {
  return `${scheme}://${neoHost}:${healthPort}${path}`;
}

/**
 * The DEFAULT real fetch: a read-only GET of Neo's `/ready` over the tailnet with a hard timeout. Returns a
 * normalized PollResult (never throws). Injected away in the self-test.
 * @param {string} url
 * @param {number} timeoutMs
 * @returns {Promise<PollResult>}
 */
export function defaultFetchReady(url, timeoutMs = DEFAULT_TIMEOUT_MS) {
  return new Promise((resolveDone) => {
    let target;
    try {
      target = new URL(url);
    } catch {
      resolveDone({ ok: false, error: `invalid url: ${url}` });
      return;
    }
    const doRequest = target.protocol === "https:" ? httpsRequest : httpRequest;
    const req = doRequest(target, { method: "GET", timeout: timeoutMs }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (c) => {
        if (body.length < 64 * 1024) body += c; // bound the read — a watchdog never trusts a peer to be small.
      });
      res.on("end", () => {
        const status = res.statusCode ?? 0;
        /** @type {PollResult} */
        const result = { ok: status === 200, status };
        try {
          if (body) result.report = JSON.parse(body);
        } catch {
          /* a non-JSON body still counts via the status code — the report is best-effort detail only. */
        }
        resolveDone(result);
      });
    });
    req.on("error", (e) => resolveDone({ ok: false, error: `unreachable: ${e?.message ?? e}` }));
    req.on("timeout", () => {
      req.destroy();
      resolveDone({ ok: false, error: `timeout after ${timeoutMs}ms` });
    });
    req.end();
  });
}

/** The console notifier — the inert default (honest: no channel wired yet). Never carries a secret. */
export function consoleNotifier() {
  return {
    /** @param {AlertEvent} e */
    alert(e) {
      // P1 — print to stderr so the Scheduled Task log captures it; a real channel replaces this seam.
      console.error(
        `[pull-watchdog] P1 ALERT — ${e.node} unreachable/down: ${e.consecutiveMisses} consecutive misses ` +
          `(threshold ${e.threshold}) at ${e.at}. ${e.detail}`,
      );
    },
    /** @param {AlertEvent} e */
    recover(e) {
      console.error(`[pull-watchdog] RECOVERED — ${e.node} answered ready again at ${e.at}.`);
    },
  };
}

/** A JSON-file streak store (durable across Scheduled-Task invocations). Injected away in the self-test. */
export function fileStore(path) {
  return {
    load() {
      try {
        return JSON.parse(readFileSync(path, "utf8"));
      } catch {
        return freshState();
      }
    },
    /** @param {WatchdogState} state */
    save(state) {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, JSON.stringify(state, null, 2));
    },
  };
}

/**
 * Run ONE poll: load streak → fetch `/ready` (+ any injected supplementary probes) → decide → persist → notify.
 * No loop. The OS scheduler invokes this once per cadence. Fully injectable for the offline self-test.
 *
 * @param {Object} opts
 * @param {() => Promise<PollResult>} opts.fetchReady   the readiness probe (default: the real tailnet GET).
 * @param {Notifier} opts.notifier
 * @param {{ load: () => WatchdogState, save: (s: WatchdogState) => void }} opts.store
 * @param {() => Date} [opts.now]
 * @param {number} [opts.threshold]
 * @param {string} [opts.node]            the MagicDNS target (for the alert payload).
 * @param {Array<() => Promise<PollResult>>} [opts.probes]  optional supplementary probes (e.g. a direct bus
 *        probe per the template's "AND a direct Supabase probe"); ANY non-ok probe makes the poll a MISS. The
 *        seam is open; the founder injects a probe whose credential comes from the host store, never a literal.
 * @returns {Promise<{ poll: PollResult, action: "none"|"alert"|"recover", state: WatchdogState }>}
 */
export async function pollOnce(opts) {
  const now = opts.now ?? (() => new Date());
  const threshold = opts.threshold ?? DEFAULT_THRESHOLD;
  const node = opts.node ?? "neo";
  const nowIso = now().toISOString();

  // primary readiness pull + any supplementary probes; the worst (first non-ok) decides the poll.
  let poll = await opts.fetchReady();
  if (poll.ok && Array.isArray(opts.probes)) {
    for (const probe of opts.probes) {
      const extra = await probe();
      if (!extra.ok) {
        poll = extra;
        break;
      }
    }
  }

  const prev = opts.store.load() ?? freshState();
  const { state, action } = decidePoll(prev, poll, threshold, nowIso);
  opts.store.save(state);

  if (action !== "none") {
    /** @type {AlertEvent} */
    const event = {
      kind: action === "alert" ? "down" : "recovered",
      node,
      consecutiveMisses: state.consecutiveMisses,
      threshold,
      at: nowIso,
      detail: describe(poll),
    };
    if (action === "alert") await opts.notifier.alert(event);
    else if (action === "recover" && typeof opts.notifier.recover === "function") await opts.notifier.recover(event);
  }
  return { poll, action, state };
}

/** A human one-liner for the alert detail — the transport reason, or the report verdict when a body came back. */
function describe(poll) {
  if (poll.ok) return "node answered ready (HTTP 200).";
  if (poll.error) return poll.error;
  const verdict = poll.report && typeof poll.report === "object" ? poll.report.verdict : undefined;
  return `HTTP ${poll.status ?? "?"}${verdict ? ` (report verdict: ${verdict})` : ""}`;
}

// ── config resolution (env-driven; NO secret — host + port + cadence + state path only) ──────────────────────
function configFromEnv() {
  const neoHost = process.env.DOS_NEO_MAGICDNS ?? "neo";
  const healthPort = Number(process.env.DOS_HEALTH_PORT ?? "8787");
  const threshold = Number(process.env.DOS_WATCHDOG_THRESHOLD ?? String(DEFAULT_THRESHOLD));
  const timeoutMs = Number(process.env.DOS_WATCHDOG_TIMEOUT_MS ?? String(DEFAULT_TIMEOUT_MS));
  const statePath = process.env.DOS_WATCHDOG_STATE ?? "./.watchdog/neo-pull-watchdog.state.json";
  const scheme = process.env.DOS_HEALTH_SCHEME ?? "http";
  return { neoHost, healthPort, threshold, timeoutMs, statePath, scheme };
}

// ── the real one-poll entrypoint (what the Scheduled Task fires) ──────────────────────────────────────────────
async function runOnce() {
  const cfg = configFromEnv();
  const url = readyUrl({ neoHost: cfg.neoHost, healthPort: cfg.healthPort, scheme: cfg.scheme });
  const result = await pollOnce({
    fetchReady: () => defaultFetchReady(url, cfg.timeoutMs),
    notifier: consoleNotifier(),
    store: fileStore(cfg.statePath),
    threshold: cfg.threshold,
    node: cfg.neoHost,
  });
  // exit 0 always — the Scheduled Task cares about the alert side effect, not this code. A non-zero would only
  // pollute the task history; honest state is in the store + the notifier.
  console.error(
    `[pull-watchdog] polled ${url} → ${result.poll.ok ? "READY" : "MISS"} ` +
      `(streak ${result.state.consecutiveMisses}/${cfg.threshold}, action=${result.action}).`,
  );
}

// ── the offline self-test: miss fires / healthy silent — injected clock + store, NO real net/loop/disk ─────────
async function selfTest() {
  let failures = 0;
  const check = (name, cond, detail = "") => {
    if (cond) console.log(`  PASS  ${name}${detail ? "  — " + detail : ""}`);
    else {
      console.error(`  FAIL  ${name}${detail ? "  — " + detail : ""}`);
      failures += 1;
    }
  };
  // an in-memory store + a recording notifier + a frozen clock — zero real network, loop, or disk.
  const memStore = (init) => {
    let s = init ?? freshState();
    return { load: () => s, save: (next) => void (s = next), peek: () => s };
  };
  const recorder = () => {
    const alerts = [];
    const recovers = [];
    return { alert: (e) => void alerts.push(e), recover: (e) => void recovers.push(e), alerts, recovers };
  };
  const clock = () => new Date("2026-06-30T12:00:00.000Z");
  const miss = async () => ({ ok: false, error: "unreachable: ECONNREFUSED" });
  const hit = async () => ({ ok: true, status: 200, report: { verdict: "ok" } });

  console.log("pull-watchdog self-test — miss fires / healthy silent (injected fetch + clock + store, no net/loop)\n");

  // [1] healthy → silent: a ready node never pages.
  console.log("[1] a READY node is silent (no page)");
  {
    const store = memStore();
    const note = recorder();
    for (let i = 0; i < 5; i++) await pollOnce({ fetchReady: hit, notifier: note, store, now: clock, threshold: 3, node: "neo" });
    check("no alert on a healthy node across 5 polls", note.alerts.length === 0);
    check("streak stays at 0 while ready", store.peek().consecutiveMisses === 0);
  }

  // [2] miss threshold fires the notifier EXACTLY once on the Nth consecutive miss, then de-dupes.
  console.log("\n[2] N consecutive misses fire the notifier once (then de-dupe through the outage)");
  {
    const store = memStore();
    const note = recorder();
    const r1 = await pollOnce({ fetchReady: miss, notifier: note, store, now: clock, threshold: 3, node: "neo" });
    check("miss 1 — no page yet (below threshold)", note.alerts.length === 0 && r1.action === "none");
    const r2 = await pollOnce({ fetchReady: miss, notifier: note, store, now: clock, threshold: 3, node: "neo" });
    check("miss 2 — no page yet (below threshold)", note.alerts.length === 0 && r2.action === "none");
    const r3 = await pollOnce({ fetchReady: miss, notifier: note, store, now: clock, threshold: 3, node: "neo" });
    check("miss 3 — PAGE fires (threshold crossed)", note.alerts.length === 1 && r3.action === "alert");
    check("the alert carries the consecutive-miss count + threshold", note.alerts[0].consecutiveMisses === 3 && note.alerts[0].threshold === 3);
    check("the alert timestamp is the injected clock", note.alerts[0].at === "2026-06-30T12:00:00.000Z");
    check("the alert detail is the honest transport reason", /ECONNREFUSED/.test(note.alerts[0].detail));
    await pollOnce({ fetchReady: miss, notifier: note, store, now: clock, threshold: 3, node: "neo" });
    await pollOnce({ fetchReady: miss, notifier: note, store, now: clock, threshold: 3, node: "neo" });
    check("a sustained outage de-dupes — still ONE page, not one-per-poll", note.alerts.length === 1);
  }

  // [3] recovery emits a single recover, and the latch re-arms for the next outage.
  console.log("\n[3] recovery pages once, then re-arms");
  {
    const store = memStore();
    const note = recorder();
    for (let i = 0; i < 3; i++) await pollOnce({ fetchReady: miss, notifier: note, store, now: clock, threshold: 3, node: "neo" });
    check("outage paged once", note.alerts.length === 1);
    const rec = await pollOnce({ fetchReady: hit, notifier: note, store, now: clock, threshold: 3, node: "neo" });
    check("a return to ready emits ONE recovery", note.recovers.length === 1 && rec.action === "recover");
    check("the latch cleared (alerted=false) so a NEW outage can page again", store.peek().alerted === false);
    for (let i = 0; i < 3; i++) await pollOnce({ fetchReady: miss, notifier: note, store, now: clock, threshold: 3, node: "neo" });
    check("a second outage pages again (re-armed)", note.alerts.length === 2);
  }

  // [4] a 503/down body (not just unreachable) is a MISS, and the report verdict is surfaced.
  console.log("\n[4] a 503 down body is a miss; the report verdict is surfaced");
  {
    const store = memStore();
    const note = recorder();
    const down = async () => ({ ok: false, status: 503, report: { verdict: "down", service: "neo-node2" } });
    for (let i = 0; i < 3; i++) await pollOnce({ fetchReady: down, notifier: note, store, now: clock, threshold: 3, node: "neo" });
    check("a 503/down node pages (degraded-but-running caught, not just powered-off)", note.alerts.length === 1);
    check("the page detail surfaces the report verdict", /verdict: down/.test(note.alerts[0].detail));
  }

  // [5] a supplementary probe failure (e.g. the direct bus probe) makes an otherwise-ready poll a MISS.
  console.log("\n[5] a supplementary probe failure flips a ready poll to a miss");
  {
    const store = memStore();
    const note = recorder();
    const busDown = async () => ({ ok: false, error: "bus probe: connection refused" });
    for (let i = 0; i < 3; i++)
      await pollOnce({ fetchReady: hit, probes: [busDown], notifier: note, store, now: clock, threshold: 3, node: "neo" });
    check("readiness ok BUT a failing supplementary probe still pages", note.alerts.length === 1);
    check("the page detail is the supplementary-probe reason", /bus probe/.test(note.alerts[0].detail));
  }

  // [6] the pure decider is correct in isolation (the whole decision logic, exhaustively).
  console.log("\n[6] decidePoll() pure-fold invariants");
  {
    const t = "2026-06-30T12:00:00.000Z";
    check("ok resets streak to 0", decidePoll({ consecutiveMisses: 5, alerted: false }, { ok: true }, 3, t).state.consecutiveMisses === 0);
    check("ok while alerted → recover", decidePoll({ consecutiveMisses: 5, alerted: true }, { ok: true }, 3, t).action === "recover");
    check("miss below threshold → none", decidePoll({ consecutiveMisses: 1, alerted: false }, { ok: false }, 3, t).action === "none");
    check("miss crossing threshold → alert", decidePoll({ consecutiveMisses: 2, alerted: false }, { ok: false }, 3, t).action === "alert");
    check("miss while already alerted → none (de-dupe)", decidePoll({ consecutiveMisses: 9, alerted: true }, { ok: false }, 3, t).action === "none");
  }

  console.log("");
  if (failures === 0) {
    console.log("pull-watchdog self-test: ALL PROOFS HOLD (exit 0)");
    process.exit(0);
  } else {
    console.error(`pull-watchdog self-test: ${failures} FAILURE(S) (exit 1)`);
    process.exit(1);
  }
}

const IS_MAIN = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (IS_MAIN) {
  if (process.argv.includes("--self-test")) selfTest();
  else runOnce().catch((e) => {
    console.error("[pull-watchdog] crashed:", e);
    process.exit(0); // never poison the Scheduled-Task history; the store + notifier hold honest state.
  });
}
