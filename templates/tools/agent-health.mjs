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
//   node agent-health.mjs --agents <dir> --telemetry <d1> --telemetry <d2> ...   (UNION; repeatable)
//   node agent-health.mjs --agents <dir> --telemetry-glob '<...>/*/subagents'    (UNION; glob-expanded)
//   node agent-health.mjs --self-test
//
// TELEMETRY WINDOW = the UNION of all resolved subagents dirs. The corpus is split across
// MULTIPLE per-session dirs (~/.claude/projects/<project>/<session>/subagents); reading ONE
// (e.g. most-recent) makes the rest of the window invisible and false-flags used agents as
// idle. --telemetry is repeatable and/or --telemetry-glob expands to every matching dir;
// records are deduped by file path so an overlapping dir is never double-counted.
// =============================================================================

import { readFileSync, existsSync, readdirSync, statSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";
import { homedir, tmpdir } from "node:os";

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
// collect ALL values for a repeatable flag (e.g. --telemetry a --telemetry b)
const optAll = (k) => { const out = []; for (let i = 0; i < argv.length; i++) if (argv[i] === k && argv[i + 1]) out.push(argv[i + 1]); return out; };
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

// read the telemetry corpus from the UNION of multiple subagents dirs. Records are
// deduped by absolute .meta.json path, so overlapping/duplicate dirs never double-count.
// This is THE window: usage from every session dir is visible at once.
export function readTelemetryUnion(telemetryDirs, { material = true } = {}) {
  const out = [];
  const seen = new Set();
  for (const dir of (telemetryDirs || [])) {
    if (!dir || !existsSync(dir)) continue;
    let files;
    try { files = readdirSync(dir); } catch { continue; }
    for (const f of files) {
      if (!/\.meta\.json$/.test(f)) continue;
      const p = resolve(dir, f);
      if (seen.has(p)) continue;
      seen.add(p);
      try {
        const t = parseAgentType(readFileSync(p, "utf8"));
        if (!t) continue;
        let verdict = null;
        if (material) { const jsonl = join(dir, f.replace(/\.meta\.json$/, ".jsonl")); verdict = classifyVerdict(finalAssistantText(jsonl)); }
        out.push({ agentType: t, at: statSync(p).mtimeMs, verdict });
      } catch {}
    }
  }
  return out;
}

// expand a glob whose ONLY wildcard segment(s) are single '*' path components
// (e.g. '<base>/*/subagents'). Resolves '~' to homedir. Returns existing dirs only.
// Deliberately tiny: enough for the project sessions glob, no '**' / charclass support.
export function expandTelemetryGlob(glob) {
  if (!glob) return [];
  let g = String(glob).replace(/\\/g, "/");
  if (g === "~" || g.startsWith("~/")) g = homedir().replace(/\\/g, "/") + g.slice(1);
  const parts = g.split("/");
  // seed roots: handle absolute (POSIX '/...' or Windows 'C:/...') and relative
  let roots = [parts[0] === "" ? "/" : parts[0]];
  for (let i = 1; i < parts.length; i++) {
    const seg = parts[i];
    if (seg === "") continue;
    const next = [];
    for (const r of roots) {
      if (seg === "*") {
        try { for (const e of readdirSync(r)) { const c = join(r, e); try { if (statSync(c).isDirectory()) next.push(c); } catch {} } } catch {}
      } else {
        const c = (r === "/" ? "/" + seg : join(r, seg));
        if (existsSync(c)) next.push(c);
      }
    }
    roots = next;
  }
  // keep only directories, dedup
  const out = [];
  const seen = new Set();
  for (const r of roots) { try { if (statSync(r).isDirectory() && !seen.has(r)) { seen.add(r); out.push(r); } } catch {} }
  return out;
}

// resolve the full set of telemetry dirs (the UNION window) from CLI inputs.
// explicitDirs: every --telemetry value (repeatable). globPattern: --telemetry-glob.
// Default glob = the project sessions glob, so a bare invocation already unions all sessions.
// Returns { dirs, basis } — basis is an honest description of how the window was assembled.
export function resolveTelemetryDirs(explicitDirs, globPattern) {
  const dirs = [];
  const seen = new Set();
  const add = (d) => { const r = resolve(d); if (!seen.has(r)) { seen.add(r); dirs.push(r); } };
  const ex = (explicitDirs || []).filter(Boolean);
  for (const d of ex) add(d);
  let basisGlob = null;
  // glob applies when explicitly given OR when no --telemetry dirs were supplied (default window)
  if (globPattern) { basisGlob = globPattern; for (const d of expandTelemetryGlob(globPattern)) add(d); }
  else if (!ex.length) {
    const def = join(homedir(), ".claude", "projects", "c--Users-brian-RUMAH-rumah-admin", "*", "subagents");
    basisGlob = def; for (const d of expandTelemetryGlob(def)) add(d);
  }
  const present = dirs.filter((d) => existsSync(d));
  let basis;
  if (ex.length && basisGlob) basis = `union of ${present.length} dir(s): ${ex.length} explicit --telemetry + glob ${basisGlob}`;
  else if (ex.length) basis = `union of ${present.length} explicit --telemetry dir(s)`;
  else basis = `union of ${present.length} dir(s) from glob ${basisGlob}`;
  return { dirs: present, basis };
}

function installedAgents(agentsDir) {
  const set = new Set();
  if (agentsDir && existsSync(agentsDir)) {
    for (const f of readdirSync(agentsDir)) if (/\.md$/.test(f)) set.add(f.replace(/\.md$/, ""));
  }
  return set;
}

// parallel = spawn-moments (rounded to the second) that launched >1 agent.
// HONEST CAVEAT: mtime UNDERCOUNTS — agents dispatched in one message can land in
// adjacent seconds. The authoritative signal is the router's logged parallelBatch
// (see batchParallel) when a selection log is present.
function parallelRate(records) {
  const bySec = {};
  for (const r of records) { const s = Math.floor(r.at / 1000); bySec[s] = (bySec[s] || 0) + 1; }
  const moments = Object.values(bySec);
  const parallelMoments = moments.filter((n) => n > 1).length;
  return { moments: moments.length, parallelMoments };
}

// AUTHORITATIVE parallel signal: a batch (≥1 selection sharing a parallelBatch id) with
// >1 routed agent was dispatched in parallel. pure: counts batches + parallel ones.
export function batchParallel(selections) {
  const byBatch = {};
  for (const s of selections) { const b = s && s.parallelBatch; if (!b) continue; (byBatch[b] = byBatch[b] || []).push(s.chosen); }
  const batches = Object.values(byBatch);
  return { batches: batches.length, parallelBatches: batches.filter((a) => a.length > 1).length };
}

// THE MILESTONE REPORT — answers the founder's 7 agent-orchestration questions from evidence.
function measure() {
  const agentsDir = opt("--agents", join(DOS, ".claude", "agents"));
  const telemetryDirsArg = optAll("--telemetry");
  const telemetryGlob = opt("--telemetry-glob", null);
  const routerPath = opt("--router", join(DOS, "templates", "tools", "agent-route.mjs"));
  const selectionsPath = opt("--selections", null); // agent-route's selection log (the "why", #3)
  const wantMaterial = !argv.includes("--no-material");

  // THE WINDOW = union of all resolved subagents dirs (every --telemetry + --telemetry-glob,
  // default = project sessions glob). UNMEASURED only if the union is empty.
  const { dirs: telemetryDirs, basis: telemetryBasis } = resolveTelemetryDirs(telemetryDirsArg, telemetryGlob);
  const installed = installedAgents(agentsDir);
  const records = readTelemetryUnion(telemetryDirs, { material: wantMaterial });
  const counts = {}, decisive = {}, byVerdict = {};
  for (const r of records) {
    counts[r.agentType] = (counts[r.agentType] || 0) + 1;
    if (r.verdict) { byVerdict[r.verdict] = (byVerdict[r.verdict] || 0) + 1; if (isMaterial(r.verdict)) decisive[r.agentType] = (decisive[r.agentType] || 0) + 1; }
  }

  // HONESTY: no telemetry dir given ≠ "every agent is idle". Without evidence, usage is
  // UNMEASURED, not zero — reporting IDLE here would narrate, not measure (the exact failure
  // this whole system exists to prevent).
  const measuredUsage = telemetryDirs.length > 0;

  // union of installed + actually-invoked (an invoked built-in with no .md still shows)
  const names = [...new Set([...installed, ...Object.keys(counts)])].sort();
  const total = records.length;
  const rows = names.map((n) => {
    const invocations = counts[n] || 0;
    const status = !measuredUsage ? "UNMEAS" : classifyAgent(n, { installed: installed.has(n), invocations });
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

  console.error(`═══ agent-orchestration health · ${measuredUsage ? `${total} invocations measured` : "usage NOT MEASURED (no --telemetry)"} ═══`);
  if (measuredUsage) console.error(`  telemetry window: ${telemetryBasis}`);
  if (!measuredUsage) console.error(`  (pass --telemetry <subagents dir> to measure usage/material-effect; roster below is INSTALLED-only)`);
  // Q1 available · Q2 selected · Q4 how often · Q7 never chosen — the roster
  console.error(`Q1/Q2/Q4/Q7 — roster (available · selected · how often · never chosen):`);
  for (const r of rows) {
    const decCol = wantMaterial ? `  decisive ${r.dec}/${r.invocations} (${r.decRate}%)` : `  decisive n/a (--no-material)`;
    const ev = r.status === "USED" ? `${String(r.invocations).padStart(3)}× (${String(r.share).padStart(2)}%)${decCol}`
      : r.status === "IDLE" ? `  0×  — INSTALLED BUT NEVER CHOSEN (Q7)`
      : r.status === "UNMEAS" ? `  installed (usage not measured)`
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
  // Q5 — parallel where appropriate. Authoritative = router-logged batches; mtime is a
  // lower-bound fallback (it undercounts same-message batches landing in adjacent seconds).
  const bp = batchParallel(selections);
  console.error(`Q5 — parallel:`);
  if (selections.length) console.error(`  authoritative (router batches): ${bp.parallelBatches}/${bp.batches} batches dispatched >1 agent in parallel`);
  console.error(`  mtime lower-bound: ${par.parallelMoments}/${par.moments} spawn-seconds had >1 agent (undercounts; see caveat)`);
  // Q6 — material effect (only meaningful when usage is measured)
  if (wantMaterial && measuredUsage) {
    console.error(`Q6 — material effect: ${decisiveTotal}/${total} invocations DECISIVE (${materialRate}%) · ` +
      `breakdown ${Object.entries(byVerdict).map(([k, v]) => `${k}:${v}`).join(" ")}`);
  } else if (wantMaterial) {
    console.error(`Q6 — material effect: NOT MEASURED (no --telemetry)`);
  }
  console.error(`--- system signals ---`);
  console.error(`  selection: ${selectionDeterministic ? "DETERMINISTIC (agent-route present + self-consistency-gated)" : "MODEL-DRIVEN (no agent-router)"}`);
  console.error(`  measured:  ${measuredUsage ? "YES (roster + telemetry + transcripts + selection log)" : "PARTIAL — roster + selection log only (no --telemetry → usage/material unmeasured)"}`);
  const anyParallel = bp.parallelBatches > 0 || par.parallelMoments > 0;
  const usageStr = measuredUsage ? `${used.length} used · ${idle.length} idle(never-chosen)` : `usage NOT MEASURED (pass --telemetry)`;
  console.error(`SUMMARY: ${usageStr} · selection=${selectionDeterministic ? "deterministic" : "model-driven"} · parallel=${anyParallel ? `yes (${bp.parallelBatches} router batch(es))` : "NEVER"} · material=${wantMaterial ? (measuredUsage ? `${materialRate}% decisive` : "not measured") : "not measured (--no-material)"}`);
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
  // batchParallel: batch "A" with 2 agents = parallel; batch "B" with 1 = serial
  const bp = batchParallel([{ parallelBatch: "A", chosen: "x" }, { parallelBatch: "A", chosen: "y" }, { parallelBatch: "B", chosen: "z" }]);
  const bpOk = bp.batches === 2 && bp.parallelBatches === 1;
  if (!bpOk) fail++;
  console.error(`  ${bpOk ? "PASS" : "FAIL"}  batch-parallel (got ${bp.parallelBatches}/${bp.batches}, want 1/2)`);
  // multi-dir UNION: 2 temp subagents dirs; counts must SUM across both, deduped by path.
  // dirA: qa-test×2, software-engineer×1 ; dirB: qa-test×1, lead-architect×1.
  // Expect union total=5, qa-test=3, software-engineer=1, lead-architect=1.
  let unionOk = false, unionMsg = "";
  try {
    const tmp = mkdtempSync(join(tmpdir(), "agent-health-union-"));
    const dirA = join(tmp, "sessA", "subagents");
    const dirB = join(tmp, "sessB", "subagents");
    mkdirSync(dirA, { recursive: true }); mkdirSync(dirB, { recursive: true });
    const meta = (t) => `{"agentType":"${t}","description":"x","toolUseId":"u"}`;
    writeFileSync(join(dirA, "a1.meta.json"), meta("qa-test"));
    writeFileSync(join(dirA, "a2.meta.json"), meta("qa-test"));
    writeFileSync(join(dirA, "a3.meta.json"), meta("software-engineer"));
    writeFileSync(join(dirB, "b1.meta.json"), meta("qa-test"));
    writeFileSync(join(dirB, "b2.meta.json"), meta("lead-architect"));
    // pass dirA TWICE to also prove dedup-by-path doesn't double-count
    const recs = readTelemetryUnion([dirA, dirB, dirA], { material: false });
    const c = {}; for (const r of recs) c[r.agentType] = (c[r.agentType] || 0) + 1;
    unionOk = recs.length === 5 && c["qa-test"] === 3 && c["software-engineer"] === 1 && c["lead-architect"] === 1;
    unionMsg = `total ${recs.length}, qa-test ${c["qa-test"]}, software-engineer ${c["software-engineer"]}, lead-architect ${c["lead-architect"]}`;
    rmSync(tmp, { recursive: true, force: true });
  } catch (e) { unionMsg = `threw ${e && e.message}`; }
  if (!unionOk) fail++;
  console.error(`  ${unionOk ? "PASS" : "FAIL"}  telemetry UNION across 2 dirs sums + dedups (got ${unionMsg}; want total 5, qa-test 3, software-engineer 1, lead-architect 1)`);

  // expandTelemetryGlob: build base/<sess>/subagents under temp, glob base/*/subagents → 2 dirs
  let globOk = false, globMsg = "";
  try {
    const tmp = mkdtempSync(join(tmpdir(), "agent-health-glob-"));
    const base = join(tmp, "projects", "proj");
    mkdirSync(join(base, "s1", "subagents"), { recursive: true });
    mkdirSync(join(base, "s2", "subagents"), { recursive: true });
    mkdirSync(join(base, "notasession"), { recursive: true }); // no subagents → excluded
    const hits = expandTelemetryGlob(join(base, "*", "subagents"));
    globOk = hits.length === 2;
    globMsg = `${hits.length} dir(s)`;
    rmSync(tmp, { recursive: true, force: true });
  } catch (e) { globMsg = `threw ${e && e.message}`; }
  if (!globOk) fail++;
  console.error(`  ${globOk ? "PASS" : "FAIL"}  expandTelemetryGlob('base/*/subagents') (got ${globMsg}, want 2 dir(s))`);

  if (fail) { console.error(`FAIL: agent-health MISCLASSIFIED ${fail} known case(s).`); process.exit(1); }
  console.error(`PASS: agent-health classifies all known states correctly — it measures reality.`);
  process.exit(0);
}

// import-safe: only auto-run when invoked as the entry point, not on `import { classifyVerdict }`
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) { if (argv.includes("--self-test")) selfTest(); else measure(); }
