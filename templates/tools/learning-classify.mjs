#!/usr/bin/env node
// =============================================================================
// Delivery OS — learning-classify (the Learning -> ASSET router). Zero-dep, Node
// ESM. PURE classifier — it NEVER acts (no asset is written, no skill bumped, no
// doc edited). It only NAMES which Delivery OS asset an APPROVED learning belongs
// in, so the write-back step lands it in the ONE right home — "a promoted lesson
// goes to the RIGHT place — not assumed a skill" (Governance §14:114) — and so a
// lesson is never silently dropped.
// =============================================================================
// Grounded in the canonical Write-back table (core/OPERATING-LOOP.md:40-50) and the
// §14 routing rule. The 10-way Delivery OS asset taxonomy (+ two safe sinks):
//
//   Capability   a lesson that RECURS across projects -> a capability ledger row
//   Skill        a REUSABLE technique that got better  -> bump a Skill
//   Workflow     an orchestration/pipeline lesson      -> a workflow template
//   SDLC         the operating loop / DoD itself        -> core/OPERATING-LOOP.md
//   Governance   "when humans are in the loop" / policy -> core/GOVERNANCE.md
//   Prompt       an agent instruction / wording lesson  -> a prompt (library)
//   Wiki         durable domain/UX/context knowledge    -> docs/ (the context layer)
//   Template     a scaffold / boilerplate / stub        -> templates/
//   Verification a trigger / gate / probe / proof        -> a verify tool / DoD probe
//   Roadmap      sequencing / milestone / future-work    -> ROADMAP.md
//   ---- the two SAFE SINKS (never a silent drop) ----
//   governance-review  AMBIGUOUS -> a human §14/§11 triage decides (the fail-safe)
//   none               an explicit close/wait (the §14 close-DEFAULT) — but only on
//                      an EXPLICIT close signal, never as a silent default.
//
// THE LOAD-BEARING INVARIANT — never silently drop a learning. A learning routes to
// a concrete asset only when its signals CLEARLY win; the instant the routing is
// ambiguous (nothing matched, or a tie between assets) it falls to `governance-review`
// — a human triage — not to `none`. `none` is reserved for an EXPLICIT close signal.
//
//   import { classifyLearning, ASSETS } from "./learning-classify.mjs"
//   classifyLearning({ title, description, evidence?, kind? })
//     -> { asset, target_path_hint, rationale, confidence }   // confidence: high|medium|low
//
//   node learning-classify.mjs --file <learnings.json|jsonl> [--json] [--self-test]
//   node learning-classify.mjs --title "..." --description "..." [--kind skill]
// =============================================================================

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// =============================================================================
// THE ASSET TABLE — data, not code. Each asset: a target_path_hint (where it lands)
// + weighted keyword signals (a stem matched, boundary-prefix, over the learning text).
// `kind` (an explicit author hint) is a STRONG signal when it names an asset.
// =============================================================================
export const ASSETS = {
  Capability: {
    hint: "capabilities/CAPABILITY-LEDGER.md",
    why: "recurs across projects — extraction over accumulation (a capability, not another prose note)",
    strong: ["recurs", "recurring", "across projects", "second consumer", "second project", "extraction", "every project", "portfolio", "cross-project", "capability"],
    weak: ["pattern", "repeated", "again", "generalizable"],
  },
  Skill: {
    hint: "skills/<name>/SKILL.md  (bump version + ## Changelog)",
    why: "a reusable TECHNIQUE that got better — bump-or-declare-no-learning (OPERATING-LOOP:47)",
    strong: ["reusable technique", "technique", "procedure", "skill", "how-to", "playbook", "method got better", "interview"],
    weak: ["reusable", "repeatable", "steps", "better way"],
  },
  Workflow: {
    hint: ".github/workflows/  or  templates/workflows/",
    why: "an orchestration/pipeline lesson — a workflow template (the sequence of steps)",
    strong: ["workflow", "orchestration", "pipeline", "ci step", "ci job", "preview/promote", "preview", "promote", "deploy lane", "dispatch"],
    weak: ["sequence", "steps order", "stage", "lane"],
  },
  SDLC: {
    hint: "core/OPERATING-LOOP.md  /  core/DEFINITION-OF-DONE.md",
    why: "the operating loop / definition-of-done itself — the SDLC spine",
    strong: ["operating loop", "definition of done", "sdlc", "lifecycle", "the loop", "write-back step", "phase gate", "loop step", "dod"],
    weak: ["phase", "cadence", "milestone gate", "standing beat"],
  },
  Governance: {
    hint: "core/GOVERNANCE.md",
    why: "policy — when humans are in the loop / a consequential-decision rule (§11/§13/§14)",
    strong: ["when humans are in the loop", "human in the loop", "consequential", "governance", "policy", "principle 11", "panel", "human gate", "irreversible", "author≠verifier", "author != verifier"],
    weak: ["rule", "review required", "human eyes", "approval"],
  },
  Prompt: {
    hint: "agents/<role>.md  or  templates/prompts/ (the prompt library)",
    why: "an agent instruction / wording lesson — a prompt (library) change",
    strong: ["prompt", "instruction", "system prompt", "agent prompt", "wording", "phrasing", "the agent should say", "spawnprompt", "spawn prompt"],
    weak: ["told the model", "rephrase", "ask the agent"],
  },
  Wiki: {
    hint: "docs/ (the context layer; the wiki is retired -> docs/archive/)",
    why: "durable domain / UX / context knowledge — the reference/context layer",
    strong: ["domain knowledge", "context layer", "reference doc", "wiki", "screen", "ux", "user journey", "glossary", "background"],
    weak: ["explainer", "onboarding", "how the domain works"],
  },
  Template: {
    hint: "templates/",
    why: "a scaffold / boilerplate / stub a future project should be born with",
    strong: ["template", "scaffold", "boilerplate", "starter", "stub", "born-correct", "seed file", "new-project"],
    weak: ["default file", "copy at scaffold", "skeleton"],
  },
  Verification: {
    hint: "templates/tools/verify-*.mjs  /  core/DEFINITION-OF-DONE.md (a probe)",
    why: "a trigger / gate / probe / proof — a verification mechanism (mechanism over prose)",
    strong: ["verify", "verification", "gate", "trigger", "probe", "machine_probe", "machine probe", "proof", "self-test", "fail-closed", "fail closed", "lint", "scan", "check"],
    weak: ["test", "assert", "guard", "fingerprint"],
  },
  Roadmap: {
    hint: "ROADMAP.md  /  docs/roadmap",
    why: "sequencing / milestone / future-work — the roadmap, not a built change yet",
    strong: ["roadmap", "future work", "backlog", "sequencing", "next slice", "prioritize", "later", "defer", "milestone plan"],
    weak: ["someday", "eventually", "follow-up", "next quarter"],
  },
};
export const ASSET_NAMES = Object.keys(ASSETS);

// EXPLICIT close/wait signals (the §14 close-DEFAULT) — only these route to `none`.
const CLOSE_SIGNALS = [
  "no framework lesson", "no framework lessons", "no os lesson", "close/wait", "close or wait",
  "project-specific only", "one-off", "one off", "not generalizable", "no further action", "wont fix", "won't fix",
];

const FALLBACK = "governance-review";

// --- boundary-prefix stem match over the learning text (pure) ----------------
function stemRe(stem) {
  const esc = String(stem).toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${esc}`, "i");
}
function hits(text, stems) {
  const t = String(text || "");
  return (stems || []).filter((s) => stemRe(s).test(t));
}

function learningText(l) {
  return [l && l.title, l && l.description, l && l.evidence].filter(Boolean).join("\n");
}

// =============================================================================
// THE CLASSIFIER (pure). Score every asset; the clear winner routes; a tie or a
// zero-score floors at `governance-review` (a human triage) — NEVER a silent drop.
// An explicit close signal (and no positive asset signal) -> `none`.
// =============================================================================
export function classifyLearning(learning) {
  if (!learning || (!learning.title && !learning.description)) {
    return {
      asset: FALLBACK,
      target_path_hint: "core/GOVERNANCE.md (§14 triage)",
      rationale: "fail-safe -> governance-review: the learning has no title/description to classify — a human triage decides (never silently dropped).",
      confidence: "low",
    };
  }

  const text = learningText(learning);
  const kind = String((learning.kind || "")).trim().toLowerCase();

  // score each asset: strong=2, weak=1; an explicit `kind` naming the asset = +3.
  const scored = ASSET_NAMES.map((name) => {
    const a = ASSETS[name];
    const sHits = hits(text, a.strong);
    const wHits = hits(text, a.weak);
    let score = sHits.length * 2 + wHits.length;
    const kindMatch = kind && (kind === name.toLowerCase() || name.toLowerCase().startsWith(kind) || kind.startsWith(name.toLowerCase()));
    if (kindMatch) score += 3;
    return { name, score, sHits, wHits, kindMatch };
  }).sort((a, b) => b.score - a.score);

  const closeHits = hits(text, CLOSE_SIGNALS);
  const top = scored[0];
  const runnerUp = scored[1];

  // EXPLICIT close/wait (and nothing positive points at an asset) -> none.
  if (closeHits.length && top.score === 0) {
    return {
      asset: "none",
      target_path_hint: "(no asset — close/wait per §14 close-default)",
      rationale: `explicit close signal (${closeHits.join(", ")}) and no asset signal — "No framework lessons discovered." is a valid triage outcome (§14).`,
      confidence: "high",
    };
  }

  // nothing matched, OR a tie at the top -> governance-review (ambiguous; a human decides).
  if (top.score === 0 || top.score === runnerUp.score) {
    const tie = top.score > 0 ? `${top.name} ties ${runnerUp.name} (both score ${top.score})` : "no asset signal matched";
    return {
      asset: FALLBACK,
      target_path_hint: "core/GOVERNANCE.md (§14 triage)",
      rationale: `ambiguous -> governance-review: ${tie} — a human §14 triage routes it (never silently dropped; never forced into the wrong asset).`,
      confidence: "low",
    };
  }

  // a clear winner.
  const a = ASSETS[top.name];
  const margin = top.score - runnerUp.score;
  const confidence = (top.kindMatch || margin >= 3) ? "high" : (margin >= 2 ? "medium" : "low");
  const signals = [...top.sHits, ...top.wHits];
  return {
    asset: top.name,
    target_path_hint: a.hint,
    rationale: `${a.why}. signal(s): ${signals.join(", ") || "(kind hint)"}${top.kindMatch ? ` + kind="${kind}"` : ""}; score ${top.score} vs next ${runnerUp.name} ${runnerUp.score}.`,
    confidence,
  };
}

// Batch: classify an array of learnings -> array of { ...learning, ...classification }.
export function classifyBatch(learnings) {
  return (learnings || []).map((l) => ({ ...l, ...classifyLearning(l) }));
}

// --- input parsing (a JSON array or JSONL) -----------------------------------
function parseLearnings(raw) {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return [];
  try {
    const j = JSON.parse(trimmed);
    return Array.isArray(j) ? j : [j];
  } catch { /* fall through to JSONL */ }
  const out = [];
  for (const line of trimmed.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("//") || t.startsWith("#")) continue;
    try { out.push(JSON.parse(t)); } catch { /* skip an unparseable line */ }
  }
  return out;
}

// =============================================================================
// SELF-TEST (pure; no IO). >= 10 labeled cases — one per asset class — plus the
// ambiguous -> governance-review fallback and an explicit close -> none.
// =============================================================================
function selfTest() {
  const fails = [];
  const log = [];
  const expect = (learning, wantAsset, label) => {
    const r = classifyLearning(learning);
    const pass = r.asset === wantAsset;
    if (!pass) fails.push(`${label}: expected ${wantAsset}, got ${r.asset} — "${r.rationale}"`);
    log.push(`  [${pass ? "PASS" : "FAIL"}] ${label.padEnd(34)} -> ${r.asset.padEnd(18)} (${r.confidence})`);
  };

  // one labeled case per asset class (10) --------------------------------------
  expect({ title: "Push-clean-no-upstream recurs", description: "This pattern recurs across projects — PLOS and Admin both hit it.", kind: "capability" },
    "Capability", "recurring-across-projects");
  expect({ title: "Friction-triage got sharper", description: "A reusable technique / procedure for the interview that got better." },
    "Skill", "reusable-technique");
  expect({ title: "Preview/promote ordering", description: "The deploy pipeline orchestration: a workflow step must run before promote." },
    "Workflow", "orchestration-pipeline");
  expect({ title: "Write-back step missing", description: "The operating loop / definition of done itself omitted a DoD row." },
    "SDLC", "operating-loop-dod");
  expect({ title: "Premature prod action", description: "Policy: when humans are in the loop a consequential decision needs a panel." },
    "Governance", "humans-in-the-loop");
  expect({ title: "Agent said too much", description: "The agent prompt wording / instruction should be tightened." },
    "Prompt", "agent-instruction");
  expect({ title: "Signing domain explainer", description: "Durable domain knowledge / context about the user journey on this screen (UX)." },
    "Wiki", "domain-context");
  expect({ title: "Every project needs the stub", description: "A scaffold / boilerplate stub a new-project should be born with.", kind: "template" },
    "Template", "scaffold-boilerplate");
  expect({ title: "Merge-on-red slipped", description: "Add a fail-closed gate / probe — a verification trigger that scans the checks." },
    "Verification", "trigger-gate-probe");
  expect({ title: "Defer the SEO pack", description: "Future work / backlog: sequence this for a later slice on the roadmap." },
    "Roadmap", "sequencing-future");

  // the two safe sinks ---------------------------------------------------------
  expect({ title: "Something happened", description: "An entirely generic note with no routable signal whatsoever." },
    "governance-review", "ambiguous->governance-review");
  expect({ title: "Triaged: nothing for the OS", description: "No framework lessons discovered — project-specific only, close/wait." },
    "none", "explicit-close->none");
  expect({}, "governance-review", "empty-learning->governance-review (no silent drop)");

  // never a silent drop: every learning yields a non-empty asset string --------
  const all = [
    { title: "x", description: "trigger gate probe verify" },
    {}, { description: "no framework lessons discovered" }, { title: "totally novel zzz" },
  ];
  for (const r of classifyBatch(all)) {
    if (!r.asset || typeof r.asset !== "string") fails.push("a learning produced an empty asset (silent drop)");
  }

  console.error("learning-classify --self-test:");
  for (const l of log) console.error(l);
  if (fails.length) {
    console.error("learning-classify --self-test FAIL:");
    for (const f of fails) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.error(
    "learning-classify --self-test PASS — all 10 asset classes route to their canonical home (Capability · Skill · " +
    "Workflow · SDLC · Governance · Prompt · Wiki · Template · Verification · Roadmap), grounded in the Write-back table " +
    "(OPERATING-LOOP:40-50) + §14; an AMBIGUOUS learning (no signal, or a tie) falls to `governance-review` — a human " +
    "triage, NEVER a silent drop and NEVER forced into the wrong asset; `none` is reached ONLY on an EXPLICIT close/wait " +
    "signal (the §14 close-default); and an empty learning still yields a routable asset."
  );
  process.exit(0);
}

// =============================================================================
// CLI (read-only; classifies, never acts)
// =============================================================================
function sameFile(p) { try { return p && p.startsWith("file:") ? fileURLToPath(p) : p; } catch { return p; } }
if (process.argv[1] && fileURLToPath(import.meta.url) === sameFile(process.argv[1])) {
  const argv = process.argv.slice(2);
  if (argv.includes("--self-test")) selfTest();
  const flag = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
  const asJson = argv.includes("--json");

  let learnings = [];
  const file = flag("--file");
  if (file) {
    let raw;
    try { raw = readFileSync(file, "utf8"); }
    catch (e) { console.error(`learning-classify: cannot read --file ${file}: ${e.message}`); process.exit(2); }
    learnings = parseLearnings(raw);
  } else if (flag("--title") || flag("--description")) {
    learnings = [{ title: flag("--title"), description: flag("--description"), evidence: flag("--evidence"), kind: flag("--kind") }];
  } else {
    console.error("USAGE: node learning-classify.mjs --file <learnings.json|jsonl> [--json]");
    console.error("   or: node learning-classify.mjs --title \"...\" --description \"...\" [--kind <asset>] [--json]");
    process.exit(2);
  }

  const results = classifyBatch(learnings);
  if (asJson) { console.log(JSON.stringify(results, null, 2)); process.exit(0); }
  console.error(`learning-classify · ${results.length} learning(s):`);
  for (const r of results) {
    console.error(`  · ${r.asset}  [${r.confidence}]  ${r.title || r.description || "(untitled)"}`);
    console.error(`      -> ${r.target_path_hint}`);
    console.error(`      ${r.rationale}`);
  }
  // stdout = the asset list (newline-delimited) for scripting.
  console.log(results.map((r) => r.asset).join("\n"));
  process.exit(0);
}
