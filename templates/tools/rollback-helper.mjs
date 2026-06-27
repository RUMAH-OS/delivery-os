#!/usr/bin/env node
// =============================================================================
// Delivery OS — rollback-helper (Infrastructure Platform · rollback support).
// =============================================================================
// When a deploy goes bad, the recovery path must be KNOWN, not improvised. This
// read-only helper answers the one question a rollback starts with:
//   "which is the last-known-GOOD production deployment, and what is the exact
//    command to promote it back?"
// It lists the most recent READY (state=READY, target=production) Vercel deploys
// for a project, marks the current one, and prints the precise `vercel promote`
// (alias) command for the last-known-good — but it NEVER executes it. Promotion is
// a human/founder action (it changes what production serves); this tool only makes
// the choice obvious and correct. See the PLATFORM-HEALTH-RUNBOOK for the full
// procedure, including the migration `down/` strategy that must accompany a rollback.
//
// READ-ONLY, ALWAYS. It calls the Vercel REST API with a read-only token (the same
// VERCEL_TOKEN + project/org ids the deploy workflow already has) and prints. It
// NEVER promotes, NEVER deletes, NEVER writes, NEVER prints a secret value.
//
// USAGE:
//   node rollback-helper.mjs [--project <id>] [--org <id>] [--limit N] [--json] [--self-test]
//     (project/org/token resolve from --flags then env: VERCEL_PROJECT_ID, VERCEL_ORG_ID, VERCEL_TOKEN.)
//
// EXIT CODES: 0 = a last-known-good candidate was identified (or --self-test passed) ·
//   1 = the API was readable but NO good production deploy exists to roll back to ·
//   2 = usage / token / IO error (the plane was unreadable — HONEST: "not checked" ≠ "none").
//
// Zero runtime dependencies (Node >= 18 built-ins only: fetch).
// =============================================================================

const argv = process.argv.slice(2);
function arg(name) {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}
const opts = {
  project: arg("--project") || process.env.VERCEL_PROJECT_ID,
  org: arg("--org") || process.env.VERCEL_ORG_ID,
  token: process.env.VERCEL_TOKEN, // never a flag — secrets are not passed on argv
  limit: Number(arg("--limit") || 10),
  json: argv.includes("--json"),
  selfTest: argv.includes("--self-test"),
};

// =============================================================================
// PURE CORE (self-testable without the network): pick the last-known-good from a
// list of deployments. "good" = state READY + production target + not the current
// alias; "last" = newest by createdAt. Exported logic, no IO.
// =============================================================================
export function pickLastKnownGood(deployments, currentUid) {
  const prod = (deployments || [])
    .filter((d) => d && d.target === "production" && readyOf(d) === "READY")
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const current = prod.find((d) => uidOf(d) === currentUid) || prod[0] || null;
  // last-known-good = the newest READY production deploy that is NOT the current one
  const lastGood = prod.find((d) => uidOf(d) !== uidOf(current)) || null;
  return { current: current || null, lastGood, readyProduction: prod };
}
function readyOf(d) {
  return String(d.readyState || d.state || "").toUpperCase();
}
function uidOf(d) {
  return d.uid || d.id || d.deploymentId || null;
}
function urlOf(d) {
  return d.url ? (d.url.startsWith("http") ? d.url : `https://${d.url}`) : null;
}

// The exact recovery command (printed, NEVER run). `vercel promote` re-points the
// production alias at a previous deployment — the fastest forward-safe rollback.
export function promoteCommand(deploy) {
  if (!deploy) return null;
  const id = urlOf(deploy) || uidOf(deploy);
  return `vercel promote ${id} --scope <team>   # promote the last-known-good back to production (human action)`;
}

// =============================================================================
// Vercel read (only when run for real).
// =============================================================================
async function fetchDeployments() {
  if (!opts.token) fail(2, "VERCEL_TOKEN not set — the Vercel plane is unreadable (not checked ≠ no candidate).");
  if (!opts.project) fail(2, "no project — pass --project or set VERCEL_PROJECT_ID.");
  const base = "https://api.vercel.com/v6/deployments";
  const qs = new URLSearchParams({ projectId: opts.project, limit: String(Math.max(opts.limit, 1)), target: "production" });
  if (opts.org) qs.set("teamId", opts.org);
  const res = await fetch(`${base}?${qs.toString()}`, { headers: { Authorization: `Bearer ${opts.token}` } });
  if (!res.ok) fail(2, `Vercel API ${res.status} ${res.statusText} (read-only deployments list failed).`);
  const body = await res.json();
  return Array.isArray(body.deployments) ? body.deployments : [];
}

async function fetchCurrentProductionUid() {
  // The current production deployment is whatever the production alias resolves to.
  // Best-effort: the newest READY production deploy is the current one when the alias
  // call is unavailable. We keep this read-only and tolerant.
  try {
    const qs = new URLSearchParams({ projectId: opts.project, limit: "1", target: "production", state: "READY" });
    if (opts.org) qs.set("teamId", opts.org);
    const res = await fetch(`https://api.vercel.com/v6/deployments?${qs.toString()}`, { headers: { Authorization: `Bearer ${opts.token}` } });
    if (!res.ok) return null;
    const body = await res.json();
    const d = (body.deployments || [])[0];
    return d ? uidOf(d) : null;
  } catch {
    return null;
  }
}

function fail(code, msg) {
  process.stderr.write(`rollback-helper: ${msg}\n`);
  process.exit(code);
}

async function run() {
  const deployments = await fetchDeployments();
  const currentUid = await fetchCurrentProductionUid();
  const { current, lastGood, readyProduction } = pickLastKnownGood(deployments, currentUid);

  const report = {
    project: opts.project,
    org: opts.org || null,
    checkedAt: new Date().toISOString(),
    current: current ? { uid: uidOf(current), url: urlOf(current), createdAt: current.createdAt, state: readyOf(current) } : null,
    lastKnownGood: lastGood ? { uid: uidOf(lastGood), url: urlOf(lastGood), createdAt: lastGood.createdAt, state: readyOf(lastGood) } : null,
    promoteCommand: promoteCommand(lastGood),
    readyProductionCount: readyProduction.length,
    note: "READ-ONLY. This tool NEVER promotes. Run the printed command yourself after reading the PLATFORM-HEALTH-RUNBOOK (incl. the migration down/ strategy).",
  };

  if (opts.json) {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  } else {
    const L = (s = "") => process.stdout.write(s + "\n");
    L("");
    L(`rollback-helper — ${opts.project} (production)`);
    L(`ready production deploys seen: ${report.readyProductionCount}`);
    L(`current:         ${report.current ? `${report.current.url} (${report.current.uid})` : "(unknown)"}`);
    L(`last-known-good: ${report.lastKnownGood ? `${report.lastKnownGood.url} (${report.lastKnownGood.uid})` : "(none — cannot roll back)"}`);
    L("");
    if (report.promoteCommand) {
      L("To roll back (HUMAN action — this tool will not run it):");
      L(`  ${report.promoteCommand}`);
      L("Then verify with: node infra/post-deploy-verify.mjs --base <prod-url> --service <id>");
    } else {
      L("No prior good production deploy to roll back to. See the runbook's migration-down path.");
    }
    L("");
  }
  process.exit(report.lastKnownGood ? 0 : 1);
}

// =============================================================================
// SELF-TEST — pure; proves the last-known-good selection without the network.
// =============================================================================
function selfTest() {
  const cases = [];
  const ok = (name, cond) => cases.push({ name, ok: !!cond });
  const mk = (uid, state, createdAt, target = "production") => ({ uid, readyState: state, createdAt, target, url: `${uid}.vercel.app` });

  const deploys = [
    mk("d3", "READY", 3000),
    mk("d2", "ERROR", 2500), // a bad deploy — must be skipped
    mk("d2b", "READY", 2000),
    mk("d1", "READY", 1000),
    mk("p1", "READY", 1500, "preview"), // preview — must be ignored
  ];
  const r = pickLastKnownGood(deploys, "d3");
  ok("current = the newest READY production (d3)", r.current.uid === "d3");
  ok("last-known-good skips current → d2b", r.lastGood.uid === "d2b");
  ok("ERROR deploy excluded from candidates", !r.readyProduction.some((d) => d.uid === "d2"));
  ok("preview deploy excluded", !r.readyProduction.some((d) => d.uid === "p1"));
  ok("promoteCommand names the good deploy url", /d2b\.vercel\.app/.test(promoteCommand(r.lastGood)));

  // only one good deploy → no rollback target
  const one = pickLastKnownGood([mk("only", "READY", 100)], "only");
  ok("single good deploy → no last-known-good to roll back to", one.lastGood === null);

  // no production at all
  const none = pickLastKnownGood([mk("pv", "READY", 100, "preview")], null);
  ok("no production deploys → lastGood null", none.lastGood === null && none.readyProduction.length === 0);

  const failed = cases.filter((c) => !c.ok);
  for (const c of cases) process.stdout.write(`${c.ok ? "✓" : "✗"} ${c.name}\n`);
  process.stdout.write(`\nrollback-helper self-test: ${cases.length - failed.length}/${cases.length} passed.\n`);
  process.exit(failed.length ? 1 : 0);
}

// --- entrypoint ---
import { fileURLToPath } from "node:url";
import { basename } from "node:path";
const _invoked = process.argv[1] || "";
if (_invoked && basename(_invoked) === basename(fileURLToPath(import.meta.url))) {
  if (opts.selfTest) selfTest();
  else run().catch((e) => fail(2, e && e.stack ? e.stack : String(e)));
}
