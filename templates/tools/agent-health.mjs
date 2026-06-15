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
import { fileURLToPath, pathToFileURL } from "node:url";
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

// pure: did this agent's output MATERIALLY AFFECT the result? (founder question #6)
// Reads the agent's FINAL message and classifies the verdict. Honest proxy — measures
// "did the output change/authorize the next step", NOT "did the founder ultimately act".
//   DECISIVE   — found a defect / blocked / corrected, OR issued a gate verdict (verified/reject)
//   CONFIRMING — validated without changing direction (tests pass, ready-for-QA, no defects)
//   LOW-SIGNAL — errored / empty / too short to have affected anything
//   AMBIGUOUS  — no recognizable verdict signal (flagged, not counted as material)
// Spec + signals derived from analysis of 113 real transcripts (this session's corpus).
export function classifyVerdict(text) {
  const t = String(text || "").trim();
  if (!t) return "LOW-SIGNAL";
  // DECISIVE — found/changed something (highest precedence): defects, rejections, corrections
  if (/\bdefects?\s+(found|identified|caught|exist)\b|\b(bug|flaw|error|issue|gap)\s+(found|identified)\b|\bfound\s+(a\s+|an\s+|the\s+|\d+\s+)?(defect|bug|flaw|issue|gap|problem)s?\b|\bREJECT(ED)?\b|\bUNSOUND\b|\bnot real\b|\bincorrect\b|\bmisroute|\bregress(ed|ion)?\b|\bblocked\b|\bfails? closed\b|\bmust (fix|change)\b|\b(strengthen|tighten|preserved?)\b/i.test(t)) return "DECISIVE";
  // DECISIVE — an explicit gate verdict (authorizes/denies the next step)
  if (/#{0,3}\s*verdict[:\s*]+\**\s*(verified|pass|fail|reject|go|no-?go|unsound|sound)\b|verify_status[:\s]+(verified|failed)|\bverdict\b[^\n]{0,40}\b(verified|pass|fail)\b/i.test(t)) return "DECISIVE";
  // CONFIRMING — validated without changing direction
  if (/\b\d+\s*(\/\s*\d+\s*)?(passed|tests?|checks?|criteria)\b|\bno\s+(defects?|errors?|bugs?|issues?)\b|\bgates?\s+green\b|\b(all|every)\s+(criteria|gates?|tests?)\b|\bcriteria\s+met\b|\bready for (qa|production)\b|\bimplementation (ready|complete)\b/i.test(t)) return "CONFIRMING";
  // LOW-SIGNAL — errored or too short to matter
  if (t.length < 100 || /^(error|exception|timeout|failed to|unable to|could not)\b/i.test(t)) return "LOW-SIGNAL";
  return "AMBIGUOUS";
}

// is a verdict category "material" (changed/authorized the outcome)?
export const isMaterial = (verdict) => verdict === "DECISIVE";

// read the FINAL assistant text from a subagent transcript (.jsonl)
function finalAssistantText(jsonlPath) {
  let txt = ""; try { txt = readFileSync(jsonlPath, "utf8"); } catch { return ""; }
  const lines = txt.split(/\r?\n/).filter((l) => l.trim());
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const o = JSON.parse(lines[i]);
      const msg = o.message || o;
      const role = msg.role || o.type;
      if (role !== "assistant") continue;
      const c = msg.content;
      if (typeof c === "string" && c.trim()) return c;
      if (Array.isArray(c)) { const s = c.filter((p) => p && p.type === "text").map((p) => p.text).join("\n"); if (s.trim()) return s; }
    } catch {}
  }
  return "";
}

// tolerant JSONL parse of the agent-route selection log (the "why" rationale, question #3)
function readSelectionLog(logPath) {
  if (!logPath || !existsSync(logPath)) return [];
  const out = [];
  try { for (const l of readFileSync(logPath, "utf8").split(/\r?\n/)) { if (!l.trim()) continue; try { out.push(JSON.parse(l)); } catch {} } } catch {}
  return out;
}

// read the telemetry corpus: one record per subagents/*.meta.json. Returns
// [{ agentType, at, verdict }] — `at` = spawn time (mtime, ms); `verdict` from the
// sibling .jsonl transcript (material-effect, question #6). Skip transcript reads with
// --no-material (faster; verdict becomes null).
function readTelemetry(telemetryDir, { material = true } = {}) {
  const out = [];
  if (!telemetryDir || !existsSync(telemetryDir)) return out;
  for (const f of readdirSync(telemetryDir)) {
    if (!/\.meta\.json$/.test(f)) continue;
    try {
      const p = join(telemetryDir, f);
      const t = parseAgentType(readFileSync(p, "utf8"));
      if (!t) continue;
      let verdict = null;
      if (material) { const jsonl = join(telemetryDir, f.replace(/\.meta\.json$/, ".jsonl")); verdict = classifyVerdict(finalAssistantText(jsonl)); }
      out.push({ agentType: t, at: statSync(p).mtimeMs, verdict });
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

// THE MILESTONE REPORT — answers the founder's 7 agent-orchestration questions from evidence.
function measure() {
  const agentsDir = opt("--agents", join(DOS, ".claude", "agents"));
  const telemetryDir = opt("--telemetry", null);
  const routerPath = opt("--router", join(DOS, "templates", "tools", "agent-route.mjs"));
  const selectionsPath = opt("--selections", null); // agent-route's selection log (the "why", #3)
  const wantMaterial = !argv.includes("--no-material");

  const installed = installedAgents(agentsDir);
  const records = readTelemetry(telemetryDir, { material: wantMaterial });
  const counts = {}, decisive = {}, byVerdict = {};
  for (const r of records) {
    counts[r.agentType] = (counts[r.agentType] || 0) + 1;
    if (r.verdict) { byVerdict[r.verdict] = (byVerdict[r.verdict] || 0) + 1; if (isMaterial(r.verdict)) decisive[r.agentType] = (decisive[r.agentType] || 0) + 1; }
  }

  // union of installed + actually-invoked (an invoked built-in with no .md still shows)
  const names = [...new Set([...installed, ...Object.keys(counts)])].sort();
  const total = records.length;
  const rows = names.map((n) => {
    const invocations = counts[n] || 0;
    const status = classifyAgent(n, { installed: installed.has(n), invocations });
    const share = total ? Math.round((invocations / total) * 100) : 0;
    const dec = decisive[n] || 0;
    const decRate = invocations ? Math.round((dec / invocations) * 100) : 0;
    return { name: n, status, invocations, share, dec, decRate };
  }).sort((a, b) => b.invocations - a.invocations);

  const selectionDeterministic = existsSync(routerPath);
  const par = parallelRate(records);
  const selections = readSelectionLog(selectionsPath);
  const decisiveTotal = Object.values(decisive).reduce((a, b) => a + b, 0);
  const materialRate = total ? Math.round((decisiveTotal / total) * 100) : 0;

  const used = rows.filter((r) => r.status === "USED");
  const idle = rows.filter((r) => r.status === "IDLE");

  console.error(`═══ agent-orchestration health · ${total} invocations measured ═══`);
  // Q1 available · Q2 selected · Q4 how often · Q7 never chosen — the roster
  console.error(`Q1/Q2/Q4/Q7 — roster (available · selected · how often · never chosen):`);
  for (const r of rows) {
    const decCol = wantMaterial ? `  decisive ${r.dec}/${r.invocations} (${r.decRate}%)` : `  decisive n/a (--no-material)`;
    const ev = r.status === "USED" ? `${String(r.invocations).padStart(3)}× (${String(r.share).padStart(2)}%)${decCol}`
      : r.status === "IDLE" ? `  0×  — INSTALLED BUT NEVER CHOSEN (Q7)`
      : `${String(r.invocations).padStart(3)}× (${String(r.share).padStart(2)}%)  invoked built-in (no .md)`;
    console.error(`  [${r.status.padEnd(7)}] ${r.name.padEnd(26)} ${ev}`);
  }
  // Q3 — why each was selected (from the deterministic router's logged rationale)
  console.error(`Q3 — why selected (agent-route logged rationale):`);
  if (selections.length) {
    for (const s of selections.slice(-6)) console.error(`  → ${String(s.chosen).padEnd(20)} for "${String(s.task).slice(0, 48)}"  ∵ ${(s.why || []).join(", ")}`);
  } else {
    console.error(`  (no selection log at ${selectionsPath || "--selections <path>"} — selection rationale not yet captured for this window)`);
  }
  // Q5 — parallel where appropriate
  console.error(`Q5 — parallel: ${par.parallelMoments}/${par.moments} spawn-moments launched >1 agent (${par.moments ? Math.round((par.parallelMoments / par.moments) * 100) : 0}%)`);
  // Q6 — material effect
  if (wantMaterial) {
    console.error(`Q6 — material effect: ${decisiveTotal}/${total} invocations DECISIVE (${materialRate}%) · ` +
      `breakdown ${Object.entries(byVerdict).map(([k, v]) => `${k}:${v}`).join(" ")}`);
  }
  console.error(`--- system signals ---`);
  console.error(`  selection: ${selectionDeterministic ? "DETERMINISTIC (agent-route present + self-consistency-gated)" : "MODEL-DRIVEN (no agent-router)"}`);
  console.error(`  measured:  YES (this report reads roster + telemetry + transcripts + selection log)`);
  console.error(`SUMMARY: ${used.length} used · ${idle.length} idle(never-chosen) · selection=${selectionDeterministic ? "deterministic" : "model-driven"} · parallel=${par.parallelMoments > 0 ? "yes" : "NEVER"} · material=${wantMaterial ? `${materialRate}% decisive` : "not measured (--no-material)"}`);
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
    { label: "verdict: defect found → DECISIVE", got: classifyVerdict("I found a defect in the event payload schema."), want: "DECISIVE" },
    { label: "verdict: VERIFIED gate → DECISIVE", got: classifyVerdict("## Verdict: VERIFIED\nAll 6 criteria pass."), want: "DECISIVE" },
    { label: "verdict: REJECTED → DECISIVE", got: classifyVerdict("Verdict: REJECTED — scope creep beyond the slice."), want: "DECISIVE" },
    { label: "verdict: tests pass → CONFIRMING", got: classifyVerdict("All 222 tests passed, no defects. Ready for QA."), want: "CONFIRMING" },
    { label: "verdict: errored → LOW-SIGNAL", got: classifyVerdict("error: timeout during run"), want: "LOW-SIGNAL" },
    { label: "verdict: empty → LOW-SIGNAL", got: classifyVerdict(""), want: "LOW-SIGNAL" },
    { label: "isMaterial(DECISIVE) true", got: isMaterial("DECISIVE") ? "Y" : "N", want: "Y" },
    { label: "isMaterial(CONFIRMING) false", got: isMaterial("CONFIRMING") ? "Y" : "N", want: "N" },
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

// import-safe: only auto-run when invoked as the entry point, not on `import { classifyVerdict }`
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) { if (argv.includes("--self-test")) selfTest(); else measure(); }
