#!/usr/bin/env node
// =============================================================================
// Delivery OS — agent-health (v6 agent-orchestration governance). Zero-dep. Evidence-only.
// =============================================================================
// capability-health proved that a capability can REPORT done while INERT. The agent system
// had the OPPOSITE blind spot: agents were the most-USED part of the OS (dozens of spawns
// per session) yet entirely UN-MEASURED — no governance saw them at all. This measures the
// agent system from REALITY, the same way capability-health measures tools/skills:
//
//   INSTALLED  — an agent definition exists (.claude/agents/<name>.md)
//   USED       — actually invoked, proven by the runtime telemetry corpus (subagents/*.meta.json:
//                {agentType, description, toolUseId}); reports invocation count + share
//   IDLE       — installed but never invoked in the measured window (the agent equivalent of INERT)
//
// And it answers the founder's orchestration questions from evidence, not assertion:
//   - selection: DETERMINISTIC iff an agent-router tool exists (today: NO → model-driven judgment)
//   - parallel:  the % of spawn-moments that launched >1 agent (founder's "parallel where appropriate")
//   - measured:  this tool existing == agent usage is now measured (it was not before)
//
//   node agent-health.mjs --agents <dir> --telemetry <subagents-dir> [--router <path>]
//   node agent-health.mjs --self-test
// =============================================================================

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const HERE = dirname(fileURLToPath(import.meta.url));
const DOS = join(HERE, "..", "..");

// pure: parse {agentType} from a meta.json blob (the runtime telemetry record)
export function parseAgentType(metaText) {
  const m = (metaText || "").match(/"agentType"\s*:\s*"([^"]+)"/);
  return m ? m[1] : null;
}

// pure: classify one agent given whether it's installed + its invocation count
export function classifyAgent(name, { installed, invocations }) {
  if (!installed) return invocations > 0 ? "USED" : "MISSING"; // a built-in (e.g. Explore) with no .md is still USED if invoked
  return invocations > 0 ? "USED" : "IDLE";
}

// read the telemetry corpus: one record per subagents/*.meta.json. Returns
// [{ agentType, at }] where `at` is the spawn time (file mtime, ms).
function readTelemetry(telemetryDir) {
  const out = [];
  if (!telemetryDir || !existsSync(telemetryDir)) return out;
  for (const f of readdirSync(telemetryDir)) {
    if (!/\.meta\.json$/.test(f)) continue;
    try {
      const p = join(telemetryDir, f);
      const t = parseAgentType(readFileSync(p, "utf8"));
      if (t) out.push({ agentType: t, at: statSync(p).mtimeMs });
    } catch {}
  }
  return out;
}

function installedAgents(agentsDir) {
  const set = new Set();
  if (agentsDir && existsSync(agentsDir)) {
    for (const f of readdirSync(agentsDir)) if (/\.md$/.test(f)) set.add(f.replace(/\.md$/, ""));
  }
  return set;
}

// parallel = spawn-moments (rounded to the second) that launched >1 agent
function parallelRate(records) {
  const bySec = {};
  for (const r of records) { const s = Math.floor(r.at / 1000); bySec[s] = (bySec[s] || 0) + 1; }
  const moments = Object.values(bySec);
  const parallelMoments = moments.filter((n) => n > 1).length;
  return { moments: moments.length, parallelMoments };
}

function measure() {
  const agentsDir = opt("--agents", join(DOS, ".claude", "agents"));
  const telemetryDir = opt("--telemetry", null);
  const routerPath = opt("--router", join(DOS, "templates", "tools", "agent-route.mjs"));

  const installed = installedAgents(agentsDir);
  const records = readTelemetry(telemetryDir);
  const counts = {};
  for (const r of records) counts[r.agentType] = (counts[r.agentType] || 0) + 1;

  // union of installed + actually-invoked (an invoked built-in with no .md still shows)
  const names = [...new Set([...installed, ...Object.keys(counts)])].sort();
  const total = records.length;
  const rows = names.map((n) => {
    const invocations = counts[n] || 0;
    const status = classifyAgent(n, { installed: installed.has(n), invocations });
    const share = total ? Math.round((invocations / total) * 100) : 0;
    return { name: n, status, invocations, share };
  }).sort((a, b) => b.invocations - a.invocations);

  // --- system-level orchestration signals (evidence, not assertion) ---
  const selectionDeterministic = existsSync(routerPath); // an agent-router would make selection testable/logged
  const par = parallelRate(records);
  const measured = true; // this tool exists → agent usage IS now measured (it was not before)

  console.error(`agent-health · agents=${agentsDir.split(/[\\/]/).slice(-3).join("/")} · telemetry=${telemetryDir ? `${total} invocations` : "NONE"}`);
  for (const r of rows) {
    const ev = r.status === "USED" ? `${r.invocations}× (${r.share}% of spawns)`
      : r.status === "IDLE" ? `installed, 0 invocations in window`
      : `invoked but no .md (built-in)`;
    console.error(`  [${r.status.padEnd(7)}] ${r.name.padEnd(24)} — ${ev}`);
  }
  console.error(`--- orchestration signals (founder's 5 questions) ---`);
  console.error(`  selection: ${selectionDeterministic ? "DETERMINISTIC (agent-route present)" : "MODEL-DRIVEN (no agent-router — judgment, not logged/testable)"}`);
  console.error(`  parallel:  ${par.parallelMoments}/${par.moments} spawn-moments launched >1 agent (${par.moments ? Math.round((par.parallelMoments / par.moments) * 100) : 0}% parallel)`);
  console.error(`  measured:  ${measured ? "YES (agent-health reads the telemetry corpus)" : "NO"}`);

  const idle = rows.filter((r) => r.status === "IDLE");
  // Honest reporting (NOT fail-closed yet): the gaps are real but this is a measurement, not a gate.
  // It becomes fail-closed once the founder approves agent-router + a parallel-where-appropriate policy.
  console.error(`SUMMARY: ${rows.filter(r => r.status === "USED").length} used · ${idle.length} idle · selection=${selectionDeterministic ? "deterministic" : "model-driven"} · parallel=${par.parallelMoments > 0 ? "yes" : "NEVER"}`);
  process.exit(0);
}

function selfTest() {
  const cases = [
    { label: "parse agentType", got: parseAgentType('{"agentType":"qa-test","x":1}'), want: "qa-test" },
    { label: "parse missing → null", got: parseAgentType('{"x":1}'), want: null },
    { label: "installed + invoked → USED", got: classifyAgent("qa-test", { installed: true, invocations: 5 }), want: "USED" },
    { label: "installed + 0 → IDLE", got: classifyAgent("documentation", { installed: true, invocations: 0 }), want: "IDLE" },
    { label: "built-in invoked, no .md → USED", got: classifyAgent("Explore", { installed: false, invocations: 8 }), want: "USED" },
    { label: "not installed + 0 → MISSING", got: classifyAgent("ghost", { installed: false, invocations: 0 }), want: "MISSING" },
  ];
  let fail = 0;
  console.error(`agent-health --self-test (validate-the-validator):`);
  for (const c of cases) { const ok = c.got === c.want; if (!ok) fail++; console.error(`  ${ok ? "PASS" : "FAIL"}  ${c.label} (got ${String(c.got)}, want ${String(c.want)})`); }
  // parallel-rate proof on a known synthetic record set
  const par = parallelRate([{ at: 1000 }, { at: 1200 }, { at: 5000 }]); // two in second 1, one in second 5
  const parOk = par.moments === 2 && par.parallelMoments === 1;
  if (!parOk) fail++;
  console.error(`  ${parOk ? "PASS" : "FAIL"}  parallel-rate (got ${par.parallelMoments}/${par.moments}, want 1/2)`);
  if (fail) { console.error(`FAIL: agent-health MISCLASSIFIED ${fail} known case(s).`); process.exit(1); }
  console.error(`PASS: agent-health classifies all known states correctly — it measures reality.`);
  process.exit(0);
}

if (argv.includes("--self-test")) selfTest();
else measure();
