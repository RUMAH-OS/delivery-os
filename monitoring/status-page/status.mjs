// =============================================================================
// monitoring/status-page/status.mjs  —  the read-only status-surface DATA SHAPER (off-Neo, no secret).
// =============================================================================
// The tiny, pure shaper behind the founder's one-screen status surface (NEO-HBM-v1 §8 — "the founder looks at
// ONE place"). It takes (a) Neo's `/ready` PlatformHealthReport (the Core Health-Emission CONTRACT shape) and
// (b) the off-Neo dead-man's last-check-in (Healthchecks status), and folds them into a glanceable view model:
// overall verdict + per-subsystem up/degraded/down + last-heartbeat age + the watchdog's own health.
//
// POSITION: an ADAPTER (architecture.config.json `monitoring` layer). PURE: no I/O, no secret, no Core import at
// runtime — it CONSUMES the report by SHAPE (it reads `report.verdict`/`subsystems` the node already computed; it
// NEVER re-derives readiness — one source of truth). Browser-AND-Node safe (no node built-ins) so `index.html`
// imports it client-side and the self-test imports it under Node. The NO-Prometheus, founder-glance intent of
// doc 03 §5: a single render over data that already exists.
//
// SECRETS: none. The page is hosted off-Neo on a static host and fetches a same-origin `status.json` snapshot
// written by an off-Neo collector that holds the tailnet/Supabase reach — the credential lives at the collector
// edge, NEVER in this module or the page (documented in MONITORING.md).
// =============================================================================

/**
 * @typedef {import("../../templates/governance-engine/health-contract.js").PlatformHealthReport} PlatformHealthReport
 * @typedef {import("../../templates/governance-engine/health-contract.js").SubsystemStatus} SubsystemStatus
 */

/** The thresholds for the last-report-age light (NEO-HBM §8: green <30s · amber <2m · red >2m). */
export const AGE_GREEN_MS = 30_000;
export const AGE_AMBER_MS = 120_000;

/** Map a freshness age to a glance bucket. */
export function ageBucket(ageMs) {
  if (ageMs == null || Number.isNaN(ageMs)) return "unknown";
  if (ageMs < AGE_GREEN_MS) return "green";
  if (ageMs < AGE_AMBER_MS) return "amber";
  return "red";
}

/** The traffic-light colour for a subsystem/verdict status (CSS class suffix; no styling decisions leak in). */
export function statusClass(status) {
  switch (status) {
    case "ok":
      return "ok";
    case "degraded":
      return "degraded";
    case "down":
      return "down";
    default:
      return "unknown";
  }
}

/** Human "Nm Ns ago" / "—" for an age in ms. */
export function humanAge(ageMs) {
  if (ageMs == null || Number.isNaN(ageMs) || ageMs < 0) return "—";
  const s = Math.floor(ageMs / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s ago`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m ago`;
}

/**
 * THE SHAPER — fold the raw inputs into the view model the page renders. PURE.
 *
 * @param {Object} input
 * @param {PlatformHealthReport|null} [input.neoReport]   Neo's `/ready` body. Absent/null ⇒ the node is DOWN
 *        (unreachable) — the surface earns its keep precisely here: it still renders, showing neo DOWN.
 * @param {{ status?: string, lastPingAt?: string|null }} [input.healthchecks]  the off-Neo dead-man's state
 *        (the push domain): "up"|"down"|"grace"|... + the last successful check-in ISO. Off-Neo, so it survives
 *        Neo being a crater.
 * @param {string|null} [input.collectedAt]  when the off-Neo collector took this snapshot (ISO).
 * @param {() => Date} [input.now]
 * @returns {StatusView}
 */
export function shapeStatus(input = {}) {
  const now = (input.now ?? (() => new Date()))();
  const report = input.neoReport ?? null;

  // ── per-subsystem rows (verbatim from the report the node already computed) ──
  const subsystems = report && Array.isArray(report.subsystems)
    ? report.subsystems.map((s) => ({
        name: s.name,
        status: s.status,
        statusClass: statusClass(s.status),
        critical: Boolean(s.critical),
        detail: s.detail ?? "",
        actionable: s.actionable ?? "",
      }))
    : [];

  // ── node freshness (the last-report age light) ──
  const checkedAtMs = report && report.checkedAt ? Date.parse(report.checkedAt) : NaN;
  const reportAgeMs = Number.isNaN(checkedAtMs) ? null : now.getTime() - checkedAtMs;

  // ── overall verdict: the node's own verdict when reachable; DOWN when the report is absent (unreachable). ──
  const reachable = report != null;
  /** @type {"ok"|"degraded"|"down"} */
  const overall = !reachable ? "down" : report.verdict;

  // ── the watchdog/dead-man row (off-Neo) ──
  const hc = input.healthchecks ?? {};
  const lastPingMs = hc.lastPingAt ? Date.parse(hc.lastPingAt) : NaN;
  const deadmanAgeMs = Number.isNaN(lastPingMs) ? null : now.getTime() - lastPingMs;

  /** @type {StatusView} */
  return {
    generatedAt: now.toISOString(),
    collectedAt: input.collectedAt ?? null,
    node: {
      service: report?.service ?? "neo-node2",
      reachable,
      verdict: overall,
      verdictClass: statusClass(overall),
      reportAgeMs,
      reportAge: humanAge(reportAgeMs),
      reportAgeBucket: ageBucket(reportAgeMs),
    },
    subsystems,
    summary: report?.summary ?? null,
    watchdog: {
      // the dead-man's own health — so the founder sees the WATCHDOG is alive, not just the workload (§8).
      status: hc.status ?? "unknown",
      statusClass: statusClass(hc.status === "up" ? "ok" : hc.status === "down" ? "down" : hc.status === "grace" ? "degraded" : "unknown"),
      lastPingAt: hc.lastPingAt ?? null,
      lastPingAge: humanAge(deadmanAgeMs),
      lastPingAgeBucket: ageBucket(deadmanAgeMs),
    },
    // the one-word headline.
    headline: overall,
  };
}

/**
 * @typedef {Object} StatusView
 * @property {string} generatedAt
 * @property {string|null} collectedAt
 * @property {{service:string, reachable:boolean, verdict:string, verdictClass:string, reportAgeMs:number|null, reportAge:string, reportAgeBucket:string}} node
 * @property {Array<{name:string,status:string,statusClass:string,critical:boolean,detail:string,actionable:string}>} subsystems
 * @property {{total:number,ok:number,degraded:number,down:number,unknown:number}|null} summary
 * @property {{status:string,statusClass:string,lastPingAt:string|null,lastPingAge:string,lastPingAgeBucket:string}} watchdog
 * @property {string} headline
 */

// ── the offline self-test (Node-only; the browser never enters this branch). Parses a sample report. ─────────
function isNodeMain() {
  return typeof process !== "undefined" && Array.isArray(process.argv) && process.argv.includes("--self-test");
}

async function selfTest() {
  const { readFileSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const { dirname, join } = await import("node:path");
  const here = dirname(fileURLToPath(import.meta.url));

  let failures = 0;
  const check = (name, cond, detail = "") => {
    if (cond) console.log(`  PASS  ${name}${detail ? "  — " + detail : ""}`);
    else {
      console.error(`  FAIL  ${name}${detail ? "  — " + detail : ""}`);
      failures += 1;
    }
  };
  const now = () => new Date("2026-06-30T12:00:30.000Z");

  console.log("status shaper self-test — parses a sample PlatformHealthReport, folds the view model\n");

  // [1] parse the on-disk sample PlatformHealthReport (the contract shape) and shape it.
  console.log("[1] a healthy sample report → ok headline, fresh light");
  {
    const sample = JSON.parse(readFileSync(join(here, "status.sample.json"), "utf8"));
    const view = shapeStatus({ neoReport: sample.neoReport, healthchecks: sample.healthchecks, collectedAt: sample.collectedAt, now });
    check("overall headline mirrors the node verdict (not re-derived)", view.headline === sample.neoReport.verdict);
    check("every subsystem row is carried through", view.subsystems.length === sample.neoReport.subsystems.length);
    check("a subsystem row carries name + status + class", view.subsystems[0].name && view.subsystems[0].statusClass === statusClass(view.subsystems[0].status));
    check("the node report-age is computed from checkedAt + the injected clock", view.node.reportAgeMs === 30_000);
    check("30s age → amber bucket (≥30s, <2m)", view.node.reportAgeBucket === "amber");
    check("the watchdog/dead-man row is present (off-Neo health)", typeof view.watchdog.status === "string");
  }

  // [2] node unreachable (no report) → DOWN, but the surface STILL renders (it earns its keep here).
  console.log("\n[2] node unreachable → DOWN headline, surface still renders");
  {
    const view = shapeStatus({ neoReport: null, healthchecks: { status: "down", lastPingAt: "2026-06-30T11:50:00.000Z" }, now });
    check("unreachable node ⇒ overall down", view.headline === "down" && view.node.verdict === "down");
    check("node marked not reachable", view.node.reachable === false);
    check("subsystems empty but shape intact (no throw)", Array.isArray(view.subsystems));
    check("watchdog status surfaced even with Neo down (off-Neo survives)", view.watchdog.status === "down");
  }

  // [3] a degraded report still serves (verdict surfaced verbatim).
  console.log("\n[3] a degraded report serves; verdict surfaced verbatim");
  {
    const degraded = {
      service: "neo-node2",
      verdict: "degraded",
      ok: false,
      checkedAt: "2026-06-30T12:00:00.000Z",
      subsystems: [
        { name: "node-liveness", status: "ok", critical: true },
        { name: "disk", status: "degraded", critical: false, detail: "disk 88%" },
      ],
      summary: { total: 2, ok: 1, degraded: 1, down: 0, unknown: 0 },
    };
    const view = shapeStatus({ neoReport: degraded, now });
    check("degraded verdict surfaced (not coerced)", view.headline === "degraded");
    check("the degraded subsystem detail is carried", view.subsystems[1].detail === "disk 88%");
  }

  // [4] age buckets at the exact boundaries.
  console.log("\n[4] age buckets");
  {
    check("0s → green", ageBucket(0) === "green");
    check("29.999s → green", ageBucket(29_999) === "green");
    check("30s → amber", ageBucket(30_000) === "amber");
    check("119.999s → amber", ageBucket(119_999) === "amber");
    check("120s → red", ageBucket(120_000) === "red");
    check("null → unknown", ageBucket(null) === "unknown");
  }

  console.log("");
  if (failures === 0) {
    console.log("status shaper self-test: ALL PROOFS HOLD (exit 0)");
    process.exit(0);
  } else {
    console.error(`status shaper self-test: ${failures} FAILURE(S) (exit 1)`);
    process.exit(1);
  }
}

if (isNodeMain()) selfTest();
