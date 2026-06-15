// =============================================================================
// Delivery OS — deterministic agent-router (v6 agent-orchestration). Zero-dep.
// =============================================================================
// "The system should know which AGENT to assign. Founder recall should not be required."
// The exact mirror of skill-route (#8): given a task description + the agents' machine-
// parseable frontmatter (capabilities[]/triggers[]), this ranks the agents
// DETERMINISTICALLY (no randomness, no LLM). The top-ranked agent is the one to assign;
// ties break by name (stable). It only RANKS already-defined agents — quality stays gated
// by author≠verifier + §11, never by the router. The selection log records WHY an agent
// was chosen (the rationale) so routing decisions are auditable, not magic.
//
//   import { routeTask, loadAgents } from "./agent-route.mjs"
//   node agent-route.mjs "<task>" [--agents <dir>] [--log <path>] [--batch <id>]
//
// Scoring (deterministic, explainable — identical to skill-route):
//   +10  a trigger PHRASE is a substring of the task (strongest signal)
//   +3   per DISTINCT task token matching a trigger token (deduped across triggers)
//   +1   per DISTINCT task token matching a capability token (deduped, not double-counted)
//   +0.5 per task token found in the agent name
// =============================================================================

import { readdirSync, appendFileSync, readFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readAgentFrontmatter } from "./agent-frontmatter.mjs";

const STOP = new Set(["the", "a", "an", "to", "of", "for", "and", "or", "is", "it", "this", "that", "with", "on", "in", "my", "i", "we", "should", "do", "run", "how", "can", "be", "are", "need"]);
const toks = (s) => String(s || "").toLowerCase().match(/[a-z0-9]+/g)?.filter((t) => t.length > 2 && !STOP.has(t)) ?? [];

export function loadAgents(agentsDir) {
  return readdirSync(agentsDir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".md"))
    .map((e) => {
      const name = e.name.replace(/\.md$/i, "");
      try {
        const fm = readAgentFrontmatter(join(agentsDir, e.name));
        return { name, capabilities: fm.capabilities ?? [], triggers: fm.triggers ?? [], description: fm.description ?? "" };
      } catch { return { name, capabilities: [], triggers: [], description: "" }; }
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function scoreAgent(taskLower, taskTokens, agent) {
  let score = 0;
  const reasons = [];
  const taskSet = new Set(taskTokens);
  // 1. whole-phrase trigger match — the strongest signal (a real phrasing of the task).
  for (const trig of agent.triggers || []) {
    const tl = String(trig).toLowerCase();
    if (tl.length > 3 && taskLower.includes(tl)) { score += 10; reasons.push(`trigger~"${trig}"`); }
  }
  // 2. DISTINCT task-tokens that appear in ANY trigger token, deduped across triggers
  //    (a generic word repeated across N triggers counts ONCE — scattered repetition of
  //    one common token must NOT beat a genuine phrase match: the dedup property).
  const trigTokens = new Set();
  for (const trig of agent.triggers || []) for (const t of toks(trig)) trigTokens.add(t);
  const trigHits = [...taskSet].filter((t) => trigTokens.has(t));
  if (trigHits.length) { score += 3 * trigHits.length; reasons.push(`trig:${trigHits.join("/")}`); }
  // 3. DISTINCT task-tokens in ANY capability, deduped, not already counted via triggers.
  const capTokens = new Set();
  for (const cap of agent.capabilities || []) for (const t of toks(cap)) capTokens.add(t);
  const capHits = [...taskSet].filter((t) => capTokens.has(t) && !trigTokens.has(t));
  if (capHits.length) { score += capHits.length; reasons.push(`cap:${capHits.join("/")}`); }
  // 4. name tokens (weak tiebreak).
  for (const t of toks(agent.name)) if (taskSet.has(t)) score += 0.5;
  return { score, reasons };
}

// Deterministic ranking. Returns [{name, score, why}] sorted desc, ties by name.
// `why` = the matched tokens/phrases that earned the score (the selection RATIONALE).
export function routeTask(task, agents) {
  const taskLower = String(task || "").toLowerCase();
  const taskTokens = toks(task);
  return agents
    .map((a) => { const { score, reasons } = scoreAgent(taskLower, taskTokens, a); return { name: a.name, score, why: reasons }; })
    .filter((r) => r.score > 0)
    .sort((a, b) => (b.score - a.score) || a.name.localeCompare(b.name));
}

// --- selection log (JSONL) — auditable routing decisions ---
// Record shape: {task, chosen, score, why, candidates:[{name,score}], parallelBatch}
// No timestamp is invented here (Date.now() is unavailable in OS tools); the caller may
// include one in `record` if it has it, else it is omitted.
export function appendSelection(logPath, record) {
  try { mkdirSync(dirname(logPath), { recursive: true }); } catch {}
  appendFileSync(logPath, JSON.stringify(record) + "\n");
}

export function readSelections(logPath) {
  let text;
  try { text = readFileSync(logPath, "utf8"); } catch { return []; }
  const out = [];
  for (const line of text.split(/\r?\n/)) {
    const s = line.trim();
    if (!s) continue;
    try { out.push(JSON.parse(s)); } catch { /* tolerant of blank/partial lines */ }
  }
  return out;
}

// --- self-test: assert routing + the dedup property hold against a synthetic set ---
function selfTest() {
  const fail = (m) => { console.error(`agent-route --self-test FAIL: ${m}`); process.exit(1); };
  const agents = [
    { name: "verifier", capabilities: ["independent verification", "regression"], triggers: ["independently verify this slice", "qa pass"] },
    { name: "builder", capabilities: ["implement vertical slice", "migration"], triggers: ["implement this slice", "build the feature"] },
    // a noise agent that repeats a generic token ("slice") many times — must NOT win on a
    // task that genuinely belongs to another agent purely via repetition.
    { name: "noise", capabilities: ["slice slice slice", "slice things"], triggers: ["slice a", "slice b", "slice c", "slice d"] },
  ];
  // 1. expected top agent for known tasks
  let top = routeTask("independently verify this slice", agents)[0];
  if (!top || top.name !== "verifier") fail(`expected "verifier" top, got ${top ? top.name : "(none)"}`);
  top = routeTask("implement this slice", agents)[0];
  if (!top || top.name !== "builder") fail(`expected "builder" top, got ${top ? top.name : "(none)"}`);
  // 2. dedup property: "noise" repeats "slice" across 4 triggers + 2 caps, but on a verify
  //    task the genuine phrase match for "verifier" must dominate the scattered repetition.
  const ranked = routeTask("independently verify this slice", agents);
  const noiseRank = ranked.find((r) => r.name === "noise");
  const verifierRank = ranked.find((r) => r.name === "verifier");
  if (noiseRank && verifierRank && noiseRank.score >= verifierRank.score) {
    fail(`dedup violated: "noise" (${noiseRank.score}) >= "verifier" (${verifierRank.score}) via repeated generic token`);
  }
  // 3. the `why` rationale is populated for the winner.
  if (!verifierRank.why || verifierRank.why.length === 0) fail(`winner has empty "why" rationale`);
  console.error("agent-route --self-test PASS (routing + per-token dedup + why rationale)");
  process.exit(0);
}

// --- CLI ---
function sameFile(p) { try { return p && p.startsWith("file:") ? fileURLToPath(p) : p; } catch { return p; } }
if (process.argv[1] && fileURLToPath(import.meta.url) === sameFile(process.argv[1])) {
  const argv = process.argv.slice(2);
  if (argv.includes("--self-test")) selfTest();
  const flag = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
  const positional = argv.filter((a, i) => !a.startsWith("--") && !(i > 0 && argv[i - 1].startsWith("--")));
  const task = positional[0];
  const dir = flag("--agents") || join(process.cwd(), ".claude", "agents");
  const logPath = flag("--log");
  const batch = flag("--batch");
  if (!task) { console.error('agent-route: usage: node agent-route.mjs "<task>" [--agents <dir>] [--log <path>] [--batch <id>]'); process.exit(2); }
  const ranked = routeTask(task, loadAgents(dir));
  if (!ranked.length) { console.error(`agent-route: no agent matched "${task}" — no deterministic route.`); process.exit(1); }
  console.error(`agent-route · ${ranked.length} match(es) for: "${task}"`);
  for (const r of ranked.slice(0, 3)) console.error(`  ${r.score.toFixed(1).padStart(5)}  ${r.name}  (${r.why.slice(0, 4).join(", ")})`);
  if (logPath) {
    appendSelection(logPath, {
      task,
      chosen: ranked[0].name,
      score: ranked[0].score,
      why: ranked[0].why,
      candidates: ranked.map((r) => ({ name: r.name, score: r.score })),
      parallelBatch: batch,
    });
    console.error(`agent-route · logged selection → ${logPath}${batch ? ` (batch ${batch})` : ""}`);
  }
  console.log(ranked[0].name); // stdout = the route (for scripting)
  process.exit(0);
}
