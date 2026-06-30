// =============================================================================
// infrastructure/execution-node/bootstrap/supervisor-entry.mjs  —  the SUPERVISOR_ENTRY (the health bridge).
// -----------------------------------------------------------------------------
// THE COMPOSITION ROOT for the `com.deliveryos.supervisor` LaunchDaemon (architecture.config.json layer
// "composition" — the outermost Clean-Architecture `main`). It is allowed to import Core CONTRACTS
// (`isReady`) AND the adapters (`NeoHealthProvider`) because it WIRES them — the daemon body holds neither.
//
// Two jobs (NEO-EXEC-07 §5.2 ; NEO-HBM-v1 Layer D/F):
//   1. Serve /health (liveness, no DB) + /ready (full report, worst-wins fold) on the TAILNET bind ONLY
//      — never 0.0.0.0 (NTS-DOS-v1 §A.2).
//   2. Run the /ready-GATED Healthchecks pusher: POST the keychain-resolved HC_PING_URL ONLY when
//      isReady(report) is true (NEO-HBM ADR-003) — a degraded-but-running node STOPS pinging → the
//      off-node dead-man pages. This converts silent rot into a page.
//
// Secrets (HC_PING_URL) come ONLY from the System keychain — never this file or a dotenv.
// =============================================================================

import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { request as httpsRequest } from "node:https";
import { request as httpRequest } from "node:http";

// Core CONTRACT — the ONE shared readiness predicate (consumed, never re-derived).
import { isReady } from "../../../templates/governance-engine/health-contract.js";
// the Neo health adapter — produces the PlatformHealthReport from real host probes.
import { NeoHealthProvider } from "../adapters/neo/neo-health.js";

// ── the ONE canonical node id + the tailnet-only bind posture. ──
const nodeId = process.env.DOS_NODE_ID ?? "neo-node2";
const runnerUser = process.env.DOS_RUNNER_USER ?? "ci-runner";
const bindAddr = process.env.DOS_HEALTH_BIND ?? "";
const healthPort = Number(process.env.DOS_HEALTH_PORT ?? "8787");
const periodSeconds = Number(process.env.DOS_HC_PERIOD_SECONDS ?? "60");
const hcPingUrlRef = process.env.DOS_HC_PING_URL_REF ?? "HC_PING_URL";

// REFUSE to bind a wildcard / routable address — tailnet interface only (fail-closed).
if (!bindAddr || bindAddr === "0.0.0.0" || bindAddr === "::") {
  // eslint-disable-next-line no-console
  console.error(`[supervisor-entry] FATAL: DOS_HEALTH_BIND must be the tailnet address, not '${bindAddr || "(unset)"}' (never 0.0.0.0).`);
  process.exit(1);
}

const healthProvider = new NeoHealthProvider({ service: nodeId });

// ── secret resolution: System keychain ONLY. ──
function secret(key) {
  try {
    return execFileSync(
      "/usr/bin/security",
      ["find-generic-password", "-a", runnerUser, "-s", key, "-w", "/Library/Keychains/System.keychain"],
      { encoding: "utf8" },
    ).trim();
  } catch {
    return "";
  }
}

// ── the /ready-gated Healthchecks push (no-op if the URL is not yet seeded). ──
function pushCheckIn(url) {
  return new Promise((resolveDone) => {
    let target;
    try {
      target = new URL(url);
    } catch {
      resolveDone(false);
      return;
    }
    const doRequest = target.protocol === "http:" ? httpRequest : httpsRequest;
    const req = doRequest(target, { method: "GET", timeout: 5000 }, (res) => {
      res.resume();
      resolveDone(res.statusCode === 200);
    });
    req.on("error", () => resolveDone(false));
    req.on("timeout", () => {
      req.destroy();
      resolveDone(false);
    });
    req.end();
  });
}

// ── the health server (tailnet-only). /health = liveness; /ready = full report (503 when not ready). ──
const server = createServer((req, res) => {
  const url = req.url ?? "/";
  if (url.startsWith("/health")) {
    healthProvider
      .liveness()
      .then((live) => {
        res.writeHead(live.ok ? 200 : 503, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: Boolean(live.ok), nodeId }));
      })
      .catch(() => {
        res.writeHead(503, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: false, nodeId }));
      });
    return;
  }
  if (url.startsWith("/ready")) {
    healthProvider
      .buildReport()
      .then((report) => {
        const ready = isReady(report);
        res.writeHead(ready ? 200 : 503, { "content-type": "application/json" });
        res.end(JSON.stringify(report));
      })
      .catch((err) => {
        res.writeHead(503, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: false, nodeId, error: String(err?.message ?? err) }));
      });
    return;
  }
  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: "not found" }));
});

server.listen(healthPort, bindAddr, () => {
  // eslint-disable-next-line no-console
  console.error(`[supervisor-entry] health bridge on http://${bindAddr}:${healthPort} (tailnet-only) node=${nodeId}`);
});

// ── the gated pusher loop: POST HC_PING_URL ONLY when /ready is green (NEO-HBM ADR-003). ──
const timer = setInterval(async () => {
  try {
    const report = await healthProvider.buildReport();
    if (!isReady(report)) return; // degraded-but-running ⇒ STOP pinging ⇒ the off-node dead-man pages.
    const url = secret(hcPingUrlRef);
    if (url) await pushCheckIn(url);
  } catch {
    // a throw here means we do NOT ping — fail-closed toward paging, never a false green.
  }
}, Math.max(1, periodSeconds) * 1000);
if (typeof timer.unref === "function") timer.unref();
