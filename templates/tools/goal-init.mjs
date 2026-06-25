#!/usr/bin/env node
// =============================================================================
// Delivery OS — goal-init (the /goal Execution Contract, §5 condition-phrasing +
// H1 cap). Zero-dep, Node ESM. Writes `.claude/.goal-state.json`.
// =============================================================================
// A `/goal` is the MAXIMUM AUTONOMOUS execution segment toward an objective —
// bounded below by the start gesture, bounded above by the first non-automatable
// action (a founder BOUNDARY = STOP = SUCCESS). The stored condition is
// STRUCTURED, never free prose, and is FORBIDDEN from naming a human-gated
// terminal as its clear condition: `clears_on` is ALWAYS the same two structural
// terminals, so "produced a valid FAP at a genuine boundary" SATISFIES the goal.
//
//   { goal_id, objective, clears_on:["objective_complete","valid_fap_at_boundary"],
//     started_at, start_ref:<git sha>, cap:{maxTurns,maxWallClockMs,maxCostHint} }
//
// H1 — the cap is the mandated kill-switch: tripping it FORCES a `failure` FAP
// (`boundary_evidence_kind: cap_tripped`), the only thing that converts
// retry-forever into a surfaced blocked-failure. Unbounded in SHAPE, bounded by
// the cap.
//
//   node goal-init.mjs "<objective>" [--id <slug>] [--max-turns N]
//        [--max-wall-clock-ms N] [--max-cost-hint <str>] [--resume FAP-<id>]
//   node goal-init.mjs --self-test
// =============================================================================

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Defaults — generous (unbounded-in-shape) but FINITE (H1 kill-switch).
export const DEFAULT_CAP = {
  maxTurns: 250,            // stop-attempts/turn proxy ceiling
  maxWallClockMs: 6 * 60 * 60 * 1000, // 6h
  maxCostHint: null,        // advisory string the orchestrator may set
};

// The clear condition is INVARIANT and structural — never project prose, never a
// human-gated terminal. This is the heart of the infinite-idle fix (§5).
export const CLEARS_ON = ["objective_complete", "valid_fap_at_boundary"];

export function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "goal";
}

// Build the goal-state object (pure — testable without touching disk or git).
export function buildState({ objective, id, startRef, now, cap, resumeOf, priorFap }) {
  if (!objective || !String(objective).trim()) throw new Error("an objective is required");
  return {
    goal_id: id || slugify(objective),
    objective: String(objective).trim(),
    clears_on: [...CLEARS_ON],
    started_at: now,                       // epoch ms — the freshness baseline for a FAP
    started_at_iso: new Date(now).toISOString(),
    start_ref: startRef || null,           // git sha at start (the progress-floor / rollback ref)
    cap: { ...DEFAULT_CAP, ...(cap || {}) },
    turns: 0,                              // incremented by goal-stop on each stop-attempt
    status: "active",
    resume_of: resumeOf || null,           // the FAP this goal resumes (H7 chain)
    prior_fap: priorFap || null,           // {boundary_class, boundary_evidence} for H7 de-dup
  };
}

function gitSha() {
  try { return execSync("git rev-parse HEAD", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() || null; }
  catch { return null; }
}

// When resuming, carry forward the prior FAP's boundary signature so goal-stop
// can detect a resume-loop (H7: the founder's fix did not take).
function loadPriorFap(root, resumeOf) {
  if (!resumeOf) return null;
  const name = /\.md$/i.test(resumeOf) ? resumeOf : `${resumeOf}.md`;
  const p = join(root, "docs", "goals", name);
  try {
    const txt = readFileSync(p, "utf8");
    const m = txt.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    const fm = {};
    if (m) for (const line of m[1].split(/\r?\n/)) {
      const kv = line.match(/^([a-z_]+):\s*(.+?)\s*$/i);
      if (kv) fm[kv[1].toLowerCase()] = kv[2].replace(/^["']|["']$/g, "");
    }
    if (fm.boundary_class || fm.boundary_evidence)
      return { boundary_class: fm.boundary_class || null, boundary_evidence: fm.boundary_evidence || null };
  } catch { /* no prior FAP readable — not fatal */ }
  return null;
}

// =============================================================================
// SELF-TEST (pure — no disk write, no git).
// =============================================================================
function selfTest() {
  const fails = [];
  const ok = (cond, msg) => { if (!cond) fails.push(msg); };

  const s = buildState({ objective: "Ship the invoicing feature to prod", startRef: "abc123", now: 1000 });
  ok(s.goal_id === "ship-the-invoicing-feature-to-prod", "slug derived from objective");
  ok(JSON.stringify(s.clears_on) === JSON.stringify(CLEARS_ON), "clears_on is the invariant structural pair");
  ok(!s.clears_on.some((c) => /merge|prod|deploy|main/.test(c)), "clears_on NEVER names a human-gated terminal (the §5 fix)");
  ok(s.started_at === 1000 && s.start_ref === "abc123", "started_at + start_ref recorded");
  ok(s.cap.maxTurns === DEFAULT_CAP.maxTurns && s.cap.maxWallClockMs === DEFAULT_CAP.maxWallClockMs, "H1 cap defaults applied");
  ok(s.status === "active" && s.turns === 0, "fresh goal is active with zero turns");

  const s2 = buildState({ objective: "x", id: "custom-id", now: 5, cap: { maxTurns: 3 } });
  ok(s2.goal_id === "custom-id", "--id overrides the slug");
  ok(s2.cap.maxTurns === 3 && s2.cap.maxWallClockMs === DEFAULT_CAP.maxWallClockMs, "partial cap override merges with defaults");

  const s3 = buildState({ objective: "resume work", now: 9, resumeOf: "FAP-prior", priorFap: { boundary_class: "credentials", boundary_evidence: "KEY absent" } });
  ok(s3.resume_of === "FAP-prior" && s3.prior_fap.boundary_class === "credentials", "resume carries the prior FAP signature (H7)");

  let threw = false; try { buildState({ objective: "", now: 1 }); } catch { threw = true; }
  ok(threw, "an empty objective throws (fail-closed)");

  ok(slugify("Hello, World!! 123") === "hello-world-123", "slugify normalizes");

  if (fails.length) {
    console.error("goal-init --self-test FAIL:");
    for (const f of fails) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.error(
    "goal-init --self-test PASS — clears_on is ALWAYS the invariant structural pair " +
    "[objective_complete, valid_fap_at_boundary] and never names a human-gated terminal (the §5 infinite-idle fix); " +
    "--id overrides the slug; the H1 cap defaults apply and partial overrides merge; a resume carries the prior FAP " +
    "signature for H7 de-dup; an empty objective fails closed."
  );
  process.exit(0);
}

// --- CLI ---------------------------------------------------------------------
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const argv = process.argv.slice(2);
  if (argv.includes("--self-test")) selfTest();
  else {
    const flag = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
    const positional = argv.filter((a, i) => !a.startsWith("--") && !(i > 0 && argv[i - 1].startsWith("--") && argv[i - 1] !== "--self-test"));
    const objective = positional[0];
    if (!objective) {
      console.error('USAGE: node goal-init.mjs "<objective>" [--id <slug>] [--max-turns N] [--max-wall-clock-ms N] [--max-cost-hint <s>] [--resume FAP-<id>]');
      process.exit(2);
    }
    const ROOT = process.cwd();
    const cap = {};
    if (flag("--max-turns")) cap.maxTurns = Number(flag("--max-turns"));
    if (flag("--max-wall-clock-ms")) cap.maxWallClockMs = Number(flag("--max-wall-clock-ms"));
    if (flag("--max-cost-hint")) cap.maxCostHint = flag("--max-cost-hint");
    const resumeOf = flag("--resume") || null;

    let state;
    try {
      state = buildState({
        objective,
        id: flag("--id"),
        startRef: gitSha(),
        now: Date.now(),
        cap,
        resumeOf,
        priorFap: loadPriorFap(ROOT, resumeOf),
      });
    } catch (e) { console.error(`goal-init: ${e.message}`); process.exit(2); }

    const out = join(ROOT, ".claude", ".goal-state.json");
    try {
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, JSON.stringify(state, null, 2) + "\n", "utf8");
    } catch (e) { console.error(`goal-init: could not write ${out} (${e.message})`); process.exit(1); }

    process.stdout.write(
      `goal-init: started goal "${state.goal_id}" at ${out}\n` +
      `  objective : ${state.objective}\n` +
      `  start_ref : ${state.start_ref || "(no git)"}\n` +
      `  clears_on : ${state.clears_on.join(" OR ")}  (a valid FAP at a genuine boundary SATISFIES this — §5)\n` +
      `  cap       : ${state.cap.maxTurns} turns / ${state.cap.maxWallClockMs}ms wall-clock${state.cap.maxCostHint ? ` / cost~${state.cap.maxCostHint}` : ""}  (H1 kill-switch)\n` +
      (state.resume_of ? `  resume_of : ${state.resume_of}\n` : "") +
      `Run autonomously to the frontier; at a genuine founder boundary emit docs/goals/FAP-${state.goal_id}.md and stop.\n`
    );
    process.exit(0);
  }
}
