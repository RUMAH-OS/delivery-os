#!/usr/bin/env node
// =============================================================================
// rollback-helper.mjs  —  print the last-known-good `vercel promote` command
// -----------------------------------------------------------------------------
// READ-ONLY. When a BINDING post-deploy verify ALARMs (NEO-EXEC-07 §7.3/§7.4), the
// deploy that just shipped is unhealthy. This helper lists recent PRODUCTION
// deployments via the Vercel REST API and prints the exact:
//
//     vercel promote <url> --token=$VERCEL_TOKEN
//
// for the previous READY production deployment — so the founder can roll prod back
// to a known-good state with NO rebuild. It NEVER executes the promote (promoting
// prod is a deliberate Class-C founder act); it only prints the command.
//
// NO SECRET LITERAL: the token + ids are read ONLY from the environment:
//   VERCEL_TOKEN       (required)  — a deploy/read-scoped token
//   VERCEL_PROJECT_ID  (required)  — the project to roll back
//   VERCEL_ORG_ID      (optional)  — the team id (sent as ?teamId= when present)
//
// Adapter-subsystem tool: it talks to Vercel (a host concern), never to Core.
// =============================================================================

const API = "https://api.vercel.com";

function fail(msg) {
  console.error(`rollback-helper: ${msg}`);
  process.exit(1);
}

function readEnv() {
  const token = process.env.VERCEL_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  const orgId = process.env.VERCEL_ORG_ID || "";
  if (!token) {
    fail(
      "VERCEL_TOKEN is not set. This tool reads the token from the environment only " +
        "(no literal is ever embedded). Export it and re-run:\n" +
        "  export VERCEL_TOKEN=...   # a deploy/read-scoped Vercel token",
    );
  }
  if (!projectId) {
    fail("VERCEL_PROJECT_ID is not set. Export the project id and re-run.");
  }
  return { token, projectId, orgId };
}

async function listProductionDeployments({ token, projectId, orgId }) {
  const params = new URLSearchParams({
    projectId,
    target: "production",
    limit: "20",
  });
  if (orgId) params.set("teamId", orgId);
  const res = await fetch(`${API}/v6/deployments?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    fail(`Vercel API returned HTTP ${res.status}. ${body.slice(0, 300)}`);
  }
  const json = await res.json();
  return Array.isArray(json.deployments) ? json.deployments : [];
}

function pickLastKnownGood(deployments) {
  // Newest-first. [0] is the current (presumed-bad) prod deploy; the rollback
  // target is the most recent READY deployment BEFORE it.
  const ready = deployments.filter((d) => d.state === "READY" || d.readyState === "READY");
  if (ready.length < 2) return ready[1] || null; // need a prior-to-current ready one
  return ready[1];
}

function urlOf(d) {
  // The API returns a bare host in `url`; vercel promote accepts the full https URL.
  const host = d.url || (d.alias && d.alias[0]);
  return host ? (host.startsWith("http") ? host : `https://${host}`) : null;
}

async function main() {
  const env = readEnv();
  const deployments = await listProductionDeployments(env);
  if (deployments.length === 0) {
    fail("No production deployments returned for this project.");
  }
  const target = pickLastKnownGood(deployments);
  if (!target) {
    fail(
      "Could not find a prior READY production deployment to roll back to. " +
        "Inspect manually: `vercel ls --prod` (with the same token).",
    );
  }
  const url = urlOf(target);
  if (!url) fail("The candidate deployment has no resolvable URL.");

  const created = target.createdAt ? new Date(target.createdAt).toISOString() : "unknown";
  console.log("");
  console.log("Last-known-good PRODUCTION deployment (rollback target):");
  console.log(`  url:     ${url}`);
  console.log(`  created: ${created}`);
  console.log(`  state:   ${target.state || target.readyState}`);
  console.log("");
  console.log("To roll production back to it, run (a deliberate Class-C founder act):");
  console.log("");
  console.log(`  vercel promote ${url} --token=$VERCEL_TOKEN`);
  console.log("");
  console.log("This helper does NOT execute the promote — it only prints the command.");
}

main().catch((err) => fail(err && err.message ? err.message : String(err)));
