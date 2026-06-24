// Delivery OS — agents:check gate (S1 ROUTE). Zero-dep.
//
// FAILS (exit 1) when any SPAWNABLE agent (.claude/agents/<name>.md) is missing the v6 routing contract:
//   name (== filename stem) · kind: "agent" · capabilities[] (non-empty) · triggers[] (non-empty)
// Without that contract the deterministic agent-router (agent-route.mjs) cannot match the agent — it becomes
// invisible to routing and the founder falls back to recalling it by hand. This gate force-feeds the contract
// the router has always assumed but nothing ever checked (the §12 drift that left the roster at zero coverage).
//
// Pairs with: agent-frontmatter.mjs (the contract + validator) and agent-route.mjs (the consumer).
// Usage:  node agents-check.mjs [--agents <dir>]   (default <root>/.claude/agents)
//         node agents-check.mjs --self-test        (asserts the gate catches a planted bad agent)
import { readdirSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readAgentFrontmatter, validateAgentFrontmatter } from "./agent-frontmatter.mjs";

// ROOT = the repo root (this file lives at <root>/.claude/tools or <root>/templates/tools — walk up to the repo).
function findRoot(start) {
  let d = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(d, ".claude", "agents")) || existsSync(join(d, "CLAUDE.md"))) return d;
    const up = dirname(d);
    if (up === d) break;
    d = up;
  }
  return start;
}

function agentFilesIn(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md") && f.toLowerCase() !== "readme.md")
    .map((f) => join(dir, f));
}

export function checkAgents(agentsDir) {
  const files = agentFilesIn(agentsDir);
  const results = files.map((path) => {
    let fm;
    try { fm = readAgentFrontmatter(path); } catch (e) { return { path, ok: false, violations: [`unreadable: ${e.message}`] }; }
    const { ok, violations } = validateAgentFrontmatter(fm, path);
    return { path, ok, violations };
  });
  return { count: results.length, results, fails: results.filter((r) => !r.ok) };
}

// ── self-test: the gate must REJECT an agent missing the contract (fail-closed proof). ──
function selfTest() {
  const bad = validateAgentFrontmatter({ name: "x", description: "d", tools: "Read" }, "x.md");
  const good = validateAgentFrontmatter({ name: "x", kind: "agent", capabilities: ["a"], triggers: ["t"] }, "x.md");
  const ok = bad.ok === false && bad.violations.length >= 2 && good.ok === true;
  console.log(ok ? "agents:check self-test OK (rejects missing kind/capabilities/triggers; accepts a complete one)"
                 : "agents:check self-test FAILED");
  process.exit(ok ? 0 : 1);
}

// ── CLI ──
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  if (process.argv.includes("--self-test")) selfTest();
  const di = process.argv.indexOf("--agents");
  const root = findRoot(dirname(fileURLToPath(import.meta.url)));
  const agentsDir = di !== -1 ? process.argv[di + 1] : join(root, ".claude", "agents");
  const { count, fails } = checkAgents(agentsDir);
  if (fails.length === 0) {
    console.log(`agents:check OK — ${count} agents carry the v6 routing contract (name/kind/capabilities/triggers).`);
    process.exit(0);
  }
  console.error(`agents:check FAIL — ${fails.length}/${count} agent(s) missing the routing contract:`);
  for (const f of fails) {
    console.error(`  ${f.path.replace(/\\/g, "/").split("/").slice(-1)[0]}:`);
    for (const v of f.violations) console.error(`    - ${v}`);
  }
  console.error(`agents:check: ${fails.length} agent(s) are INVISIBLE to deterministic routing — build blocked.`);
  process.exit(1);
}
