#!/usr/bin/env node
// =============================================================================
// Delivery OS — CI & Release Orchestrator (zero-dep, Node ESM). Drives a PR
// through CI -> merge-gate -> deploy with an ENCODED failure->fix knowledge base.
// =============================================================================
// "The orchestrator should know the failure CLASS and its sanctioned fix. Founder
//  recall of 'what does THIS red mean again' should not be required — but the
//  orchestrator never AUTHORS a merge or an irreversible prod change on its own."
//
// This is the executable core extracted from a live release session: a deterministic
// state machine (monitor -> diagnose -> fix -> verify -> merge-gate -> deploy ->
// report) over a data-driven FAILURE_CLASSES knowledge base. It classifies a red
// signal, then acts ONLY within its sanctioned autonomy band:
//   SAFE-TO-AUTO   — apply + commit + push (only with --apply-safe; never in --dry-run)
//   NEEDS-APPROVAL — print a proposed patch + evidence and STOP (human decides)
//   NEVER-AUTO     — escalate; no automated fix is ever attempted
// The MERGE transition is HUMAN-gated by design: the loop stops at a green merge-gate
// and PRINTS the merge command. It auto-merges ONLY when the human passes --merge, and
// even then it cannot override a red/missing required check (fail-closed). Earned the
// hard way elsewhere: an orchestrator that parsed piped output once merged on red.
//
//   import { FAILURE_CLASSES, classifyFailure, decideMerge, safeToAutoSplit } from "./ci-release-orchestrator.mjs"
//   node ci-release-orchestrator.mjs <pr-number> [--repo OWNER/REPO] [--apply-safe] [--merge] [--watch-deploy] [--json] [--dry-run] [--self-test]
//
// DEFAULT (no flags) = DRY-RUN-ish: monitor + diagnose + PROPOSE fixes + report.
//   Never mutates without --apply-safe. Never merges without --merge.
// Robust to `gh` not installed / not authenticated (fail-closed, clear message, non-zero).
// =============================================================================

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// --- the three required checks the release contract gates on -----------------
export const REQUIRED_CHECKS = ["verify", "experience-review", "founder-experience-scorecard"];

// --- retry bounds (anti-thrash; a stuck loop must STOP, not spin) ------------
export const MAX_PER_CLASS = 2;     // 2 fix attempts per failure class
export const MAX_CI_CYCLES = 5;     // 5 total monitor->fix->verify cycles
export const MAX_DEPLOY_CYCLES = 2;  // 2 deploy watch/retry cycles
const POLL_MAX = 60;                 // bounded polls while checks are pending
const POLL_INTERVAL_MS = 20000;      // 20s between polls (matches merge-pr gate)

// =============================================================================
// KNOWLEDGE BASE — the failure->fix classes. Data, not code: each is a signal a
// CI red emits, its diagnosis, the sanctioned fix, and the AUTONOMY BAND that
// governs whether the orchestrator may apply it unattended.
//
// signal fields (a class matches when ALL declared MANDATORY fields match):
//   logRegex[]   — MANDATORY if present: >=1 regex must hit the failing log
//   mergeable    — MANDATORY if present: gh `mergeable` must equal this
//   checkName    — MANDATORY if present: a failing check name must match this regex
//   failingStep  — corroborating: constrains only when evidence carries a step
//   workflow     — corroborating: constrains only when evidence carries a workflow
//   failingFiles — informational: surfaced in the report; not a discriminator
// =============================================================================
export const FAILURE_CLASSES = [
  {
    id: "F1",
    name: "stale-conformance-migration-pins",
    signal: {
      logRegex: [/expected\s+\d+\s+to\s+(be|equal)\s+(28|29)/i],
      failingFiles: [
        "tests/mi6-conformance.test.ts",
        "tests/s32-conformance.test.ts",
        "tests/s33-conformance.test.ts",
        "tests/s40-conformance.test.ts",
        "tests/contact-intelligence-grounding.test.ts",
      ],
    },
    diagnosis:
      "A conformance test asserts a hard-coded migration count/maxNum (28/29) that no longer matches the real on-disk migration set. The GUARD VALUE is stale — not the schema.",
    fix: {
      type: "re-pin-conformance",
      action:
        "Re-pin the expected migration count/maxNum in the named conformance tests to the real on-disk value (count the migration files / read the true maxNum), then commit.",
    },
    safeToAuto: "NEEDS-APPROVAL", // moving a guard value is a deliberate decision, not housekeeping
    verify: "Re-run the named conformance tests; the `verify` check goes green.",
  },
  {
    id: "F2",
    name: "next-build-oom",
    signal: {
      logRegex: [/FATAL ERROR:.*heap out of memory/i, /JavaScript heap out of memory/i],
      failingStep: "Build (next build)",
    },
    diagnosis: "The Next.js production build (`next build`) exhausts the default V8 heap during CI.",
    fix: {
      type: "set-build-node-options",
      action: "Add `NODE_OPTIONS: --max-old-space-size=6144` to the env of the 'Build (next build)' step in the CI workflow.",
    },
    safeToAuto: "SAFE-TO-AUTO", // bounded, reversible, no external/prod surface
    verify: "Re-run the build step; it completes without an OOM.",
  },
  {
    id: "F3",
    name: "vercel-invalid-node-24x",
    signal: {
      logRegex: [/Found invalid Node\.js Version:\s*24\.x/i],
      workflow: "deploy",
    },
    diagnosis: "Vercel rejects Node 24.x. The repo (and/or the Vercel project) is pinned to an unsupported runtime.",
    // The PARTIAL (repo-side) fix is SAFE-TO-AUTO; the REAL fix mutates external prod
    // config and is NEEDS-APPROVAL. Recurrence rule: if the same signal recurs AFTER the
    // partial fix landed, escalate to the real fix (the repo pin alone did not hold).
    fix: {
      type: "pin-engines-node",
      action: 'Set package.json engines.node from ">=22" to "22.x" (repo-side pin).',
    },
    safeToAuto: "SAFE-TO-AUTO",
    escalation: {
      when: "same-signal-recurs-after-partial-fix",
      fix: {
        type: "vercel-project-node-version",
        action: "PATCH the Vercel project nodeVersion to 22.x via the Vercel API.",
      },
      safeToAuto: "NEEDS-APPROVAL",
      reason: "Mutating external PRODUCTION config (the Vercel project) is never auto-applied.",
    },
    verify: "Re-run the deploy workflow; Vercel accepts the Node version.",
  },
  {
    id: "F4",
    name: "release-pr-merge-conflict",
    signal: {
      mergeable: "CONFLICTING",
    },
    diagnosis: "The release PR has diverged from origin/main and no longer merges cleanly.",
    // Compound fix: the mechanical part is SAFE, the conformance re-pin part NEEDS-APPROVAL.
    // The CLASS is gated at the most-restrictive band so it never fully auto-resolves.
    fix: {
      type: "resolve-merge-conflict",
      steps: [
        { action: "Merge origin/main into the PR branch; resolve .gitignore as the UNION of both sides.", safeToAuto: "SAFE-TO-AUTO" },
        { action: "Re-pin any conformance migration counts the merge disturbed (see F1).", safeToAuto: "NEEDS-APPROVAL" },
      ],
    },
    safeToAuto: "NEEDS-APPROVAL", // the re-pin step needs approval => the class is gated
    verify: "gh reports the PR mergeable == MERGEABLE and conformance is green.",
  },
  {
    id: "F5",
    name: "experience-gate-red",
    signal: {
      checkName: /experience-review|founder-experience-scorecard/i,
    },
    diagnosis: "A human experience gate (experience-review / founder-experience-scorecard) is red. This is a JUDGMENT signal, not a mechanical failure.",
    fix: {
      type: "escalate-to-human",
      action: "Escalate to the founder/reviewer. Do NOT attempt an automated fix — the gate encodes human judgment.",
    },
    safeToAuto: "NEVER-AUTO",
    verify: "A human resolves the experience gate; re-poll only after they signal done.",
  },
];

// =============================================================================
// SIGNAL MATCHER — deterministic classification. Mandatory fields (logRegex /
// mergeable / checkName) must match; corroborating fields (failingStep / workflow)
// only constrain when the evidence actually carries them. Fail-closed: a class
// matches only when at least one MANDATORY signal field hit (never on an empty
// signal), and an unrecognized red returns null (we never guess a fix).
// =============================================================================
export function matchesSignal(signal, ev = {}) {
  let mandatoryMatched = false;

  if (signal.logRegex && signal.logRegex.length) {
    const log = String(ev.log || "");
    if (!signal.logRegex.some((re) => re.test(log))) return false;
    mandatoryMatched = true;
  }

  if (signal.mergeable) {
    if (String(ev.mergeable || "").toUpperCase() !== signal.mergeable.toUpperCase()) return false;
    mandatoryMatched = true;
  }

  if (signal.checkName) {
    const names = [].concat(ev.checkName || []).concat(ev.failingChecks || []).map(String);
    if (!names.some((n) => signal.checkName.test(n))) return false;
    mandatoryMatched = true;
  }

  // corroborating: constrains ONLY when evidence supplies the field
  if (signal.failingStep && ev.failingStep) {
    if (!String(ev.failingStep).toLowerCase().includes(signal.failingStep.toLowerCase())) return false;
  }
  if (signal.workflow && ev.workflow) {
    if (!String(ev.workflow).toLowerCase().includes(signal.workflow.toLowerCase())) return false;
  }

  return mandatoryMatched;
}

// Returns the first FAILURE_CLASS whose signal matches, or null (fail-closed).
export function classifyFailure(ev) {
  for (const fc of FAILURE_CLASSES) if (matchesSignal(fc.signal, ev)) return fc;
  return null;
}

// The autonomy bands, by class id. Used by the fixer and asserted by --self-test.
export function safeToAutoSplit() {
  const out = { "SAFE-TO-AUTO": [], "NEEDS-APPROVAL": [], "NEVER-AUTO": [] };
  for (const fc of FAILURE_CLASSES) (out[fc.safeToAuto] || (out[fc.safeToAuto] = [])).push(fc.id);
  return out;
}

// =============================================================================
// MERGE GATE — HUMAN-ONLY by design. Returns the decision; it never merges itself.
//   action: "blocked"     — required checks not all green (merge is impossible)
//           "await-human" — all green but no --merge: print the merge command, STOP
//           "merge"       — all green AND --merge passed: the human authorized it
// --merge can NEVER override a red or missing required check (fail-closed).
// =============================================================================
export function decideMerge({ checks, merge }) {
  const byName = new Map((checks || []).map((c) => [c.name, c]));
  const missing = REQUIRED_CHECKS.filter((n) => !byName.has(n));
  const notPass = REQUIRED_CHECKS.filter((n) => byName.has(n) && byName.get(n).bucket !== "pass");
  const allGreen = missing.length === 0 && notPass.length === 0;
  if (!allGreen) return { action: "blocked", allGreen, missing, notPass, reason: "required checks not all green" };
  if (!merge) return { action: "await-human", allGreen, missing, notPass };
  return { action: "merge", allGreen, missing, notPass };
}

// =============================================================================
// gh / git runtime (live path). All shelled via execFileSync (no shell=true).
// =============================================================================
function makeIO(cwd) {
  const ghRaw = (args) => execFileSync("gh", args, { encoding: "utf8", cwd, stdio: ["ignore", "pipe", "pipe"] });
  return {
    cwd,
    ghAvailable() { try { execFileSync("gh", ["--version"], { stdio: "ignore" }); return true; } catch { return false; } },
    ghAuthed() { try { execFileSync("gh", ["auth", "status"], { stdio: "ignore" }); return true; } catch { return false; } },
    ghJson(args) { return JSON.parse(ghRaw(args)); },
    ghText(args) { return ghRaw(args); },
    git(args) { return execFileSync("git", args, { encoding: "utf8", cwd, stdio: ["ignore", "pipe", "pipe"] }); },
  };
}

const sleep = (ms) => new Promise((r) => globalThis.setTimeout(r, ms));
const repoArgsOf = (opts) => (opts.repo ? ["--repo", opts.repo] : []);
const extractRunId = (check) => (String(check.link || "").match(/\/runs\/(\d+)/) || [])[1];
const summarizeEv = (ev) =>
  [ev.checkName && `check=${ev.checkName}`, ev.mergeable && `mergeable=${ev.mergeable}`, ev.failingStep && `step=${ev.failingStep}`, ev.workflow && `wf=${ev.workflow}`, ev.log && `log~${String(ev.log).split("\n").find((l) => l.trim()) || ""}`.slice(0, 80)]
    .filter(Boolean).join(" ");

// --- run report --------------------------------------------------------------
function newReport(opts) {
  return {
    pr: opts.pr, repo: opts.repo || null,
    statesTraversed: [],
    cycles: { ci: 0, deploy: 0, perClass: {} },
    classifications: [], proposedFixes: [], appliedFixes: [], escalations: [],
    mergeGate: null, deploy: null, result: "pending", messages: [],
  };
}
function enter(report, state) {
  if (report.statesTraversed[report.statesTraversed.length - 1] !== state) report.statesTraversed.push(state);
}

// =============================================================================
// FIXERS (SAFE-TO-AUTO only). Each is deterministic and guarded: if it cannot
// confidently make the change it THROWS, and the caller falls back to PROPOSE
// (never a blind edit). Never invoked under --dry-run or without --apply-safe.
// =============================================================================
function applyF3Partial(io) {
  const pkgPath = join(io.cwd, "package.json");
  if (!existsSync(pkgPath)) throw new Error("package.json not found");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  if (!pkg.engines || !pkg.engines.node) throw new Error("package.json has no engines.node to pin");
  if (pkg.engines.node === "22.x") throw new Error('engines.node already "22.x" — refusing to no-op');
  const before = pkg.engines.node;
  pkg.engines.node = "22.x";
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  return `package.json engines.node: "${before}" -> "22.x"`;
}

function applyF2(io) {
  const wfDir = join(io.cwd, ".github", "workflows");
  if (!existsSync(wfDir)) throw new Error(".github/workflows not found");
  for (const f of readdirSync(wfDir).filter((n) => /\.ya?ml$/i.test(n))) {
    const p = join(wfDir, f);
    const src = readFileSync(p, "utf8");
    const lines = src.split("\n");
    const buildIdx = lines.findIndex((l) => /next build/i.test(l) && !/^\s*#/.test(l));
    if (buildIdx < 0) continue;
    if (/NODE_OPTIONS/.test(src)) throw new Error(`NODE_OPTIONS already present in ${f} — refusing to double-apply`);
    // walk up to the nearest `run:` step-property; insert an `env:` sibling at its indent.
    let runIdx = -1;
    for (let i = buildIdx; i >= 0 && i >= buildIdx - 8; i--) { if (/^\s*run:/.test(lines[i])) { runIdx = i; break; } }
    if (runIdx < 0) throw new Error(`found 'next build' in ${f} but no sibling 'run:' to anchor env: on — refusing to guess`);
    const indent = (lines[runIdx].match(/^(\s*)/) || ["", ""])[1];
    lines.splice(runIdx, 0, `${indent}env:`, `${indent}  NODE_OPTIONS: --max-old-space-size=6144`);
    writeFileSync(p, lines.join("\n"));
    return `${f}: added NODE_OPTIONS=--max-old-space-size=6144 to the 'next build' step env`;
  }
  throw new Error('no build step matching "next build" found in .github/workflows — refusing to guess');
}

function gitCommitPush(io, message) {
  io.git(["add", "-A"]);
  io.git(["commit", "-m", message]);
  io.git(["push"]);
  return message;
}

function applySafeFix(fc, effective, io) {
  let summary;
  if (fc.id === "F2") summary = applyF2(io);
  else if (fc.id === "F3" && !effective.escalated) summary = applyF3Partial(io);
  else throw new Error(`no SAFE-TO-AUTO applier for ${fc.id}${effective.escalated ? " (escalated/real fix is NOT auto-appliable)" : ""}`);
  const commit = gitCommitPush(io, `fix(ci): ${fc.id} ${fc.name} — ${summary}`);
  return { summary, commit };
}

// =============================================================================
// STATE MACHINE — monitoring -> diagnosing -> fixing -> verifying ->
//                 merge_gate -> deploying -> reporting
// =============================================================================
async function pollChecks(io, opts) {
  const args = ["pr", "checks", String(opts.pr), ...repoArgsOf(opts), "--json", "name,bucket,workflow,link,state"];
  let checks = io.ghJson(args);
  for (let i = 0; i < POLL_MAX; i++) {
    const relevant = checks.filter((c) => REQUIRED_CHECKS.includes(c.name));
    const settled = relevant.length > 0 && relevant.every((c) => c.bucket !== "pending");
    if (settled || checks.length === 0) break;
    await sleep(POLL_INTERVAL_MS);
    checks = io.ghJson(args);
  }
  return checks;
}

async function deployWatch(io, opts, report) {
  for (let d = 0; d < MAX_DEPLOY_CYCLES; d++) {
    report.cycles.deploy = d + 1;
    enter(report, "deploying");
    let runs;
    try { runs = io.ghJson(["run", "list", "--workflow=deploy.yml", ...repoArgsOf(opts), "--limit", "1", "--json", "databaseId,status,conclusion,url"]); }
    catch (e) { report.deploy = { status: "error", error: e.message }; return; }
    if (!runs || !runs.length) { report.deploy = { status: "no-deploy-run-found" }; return; }
    const run = runs[0];
    try { io.ghText(["run", "watch", String(run.databaseId), ...repoArgsOf(opts), "--exit-status"]); } catch { /* non-success surfaces via the re-view below */ }
    let fresh = run;
    try { fresh = io.ghJson(["run", "view", String(run.databaseId), ...repoArgsOf(opts), "--json", "status,conclusion,url"]); } catch { /* keep prior */ }
    report.deploy = { status: fresh.conclusion || fresh.status, url: fresh.url };
    if (fresh.conclusion === "success") { report.deploy.status = "success"; return; }
    if (!fresh.conclusion) return; // still running and watch returned without a terminal status
    report.messages.push(`deploy cycle ${d + 1}: conclusion=${fresh.conclusion} — ${d + 1 < MAX_DEPLOY_CYCLES ? "retrying" : "no retries left"}.`);
  }
}

export async function orchestrate(opts) {
  const report = newReport(opts);
  const io = opts.io || makeIO(opts.cwd || process.cwd());

  // fail-closed preflight: gh present + authenticated, else refuse to poll/mutate.
  if (!io.ghAvailable()) {
    report.result = "error";
    report.messages.push("gh CLI not found on PATH — cannot drive CI. Install GitHub CLI (https://cli.github.com) and re-run.");
    enter(report, "reporting"); return report;
  }
  if (!io.ghAuthed()) {
    report.result = "error";
    report.messages.push("gh is not authenticated — run `gh auth login`. Fail-closed: refusing to poll or mutate without an authenticated session.");
    enter(report, "reporting"); return report;
  }

  const lastSeenClass = {}; // for same-signal recurrence detection

  while (report.cycles.ci < MAX_CI_CYCLES) {
    report.cycles.ci++;
    enter(report, "monitoring");

    let checks;
    try { checks = await pollChecks(io, opts); }
    catch (e) { report.result = "error"; report.messages.push(`monitoring failed: ${e.message}`); enter(report, "reporting"); return report; }

    if (!checks || checks.length === 0) {
      report.result = "blocked";
      report.messages.push(`PR ${opts.pr} reports zero checks — CI not registered yet. Re-run once checks appear (fail-closed).`);
      enter(report, "reporting"); return report;
    }

    const failing = checks.filter((c) => c.bucket === "fail");
    let prState = null;
    try { prState = io.ghJson(["pr", "view", String(opts.pr), ...repoArgsOf(opts), "--json", "mergeable,state,number,title,headRefName"]); } catch { /* tolerated */ }
    const conflicting = prState && prState.mergeable === "CONFLICTING";

    // ---- all required resolved + no conflict -> MERGE GATE (human-only) ----
    if (failing.length === 0 && !conflicting) {
      enter(report, "merge_gate");
      const decision = decideMerge({ checks, merge: opts.merge });
      report.mergeGate = { ...decision };
      if (decision.action === "blocked") {
        report.result = "blocked";
        report.messages.push(`merge gate: required checks not all green (missing: ${decision.missing.join(",") || "none"}; not-pass: ${decision.notPass.join(",") || "none"}).`);
        enter(report, "reporting"); return report;
      }
      if (decision.action === "await-human") {
        report.result = "awaiting-human";
        const cmd = `node merge-pr.mjs ${opts.pr}`;
        report.mergeGate.command = cmd;
        report.messages.push(`MERGE GATE (human-only): all ${REQUIRED_CHECKS.length} required checks green. Merge is NOT automated. Authorize with the mechanical gate: ${cmd}`);
        enter(report, "reporting"); return report;
      }
      // decision.action === "merge" — explicit --merge AND all green: the human authorized it.
      report.messages.push("--merge passed + all required checks green -> performing the squash merge.");
      try { io.ghText(["pr", "merge", String(opts.pr), ...repoArgsOf(opts), "--squash"]); report.mergeGate.merged = true; report.messages.push(`PR ${opts.pr} merged (squash).`); }
      catch (e) { report.result = "error"; report.messages.push(`merge failed: ${e.message}`); enter(report, "reporting"); return report; }
      if (opts.watchDeploy) await deployWatch(io, opts, report);
      report.result = "ok";
      enter(report, "reporting"); return report;
    }

    // ---- DIAGNOSING: gather evidence per failing surface, classify ----
    enter(report, "diagnosing");
    const evidences = [];
    if (conflicting) evidences.push({ source: "pr-state", mergeable: "CONFLICTING" });
    for (const c of failing) {
      let log = "";
      const runId = extractRunId(c);
      if (runId) { try { log = io.ghText(["run", "view", String(runId), ...repoArgsOf(opts), "--log-failed"]); } catch { /* log optional */ } }
      evidences.push({ source: "check", checkName: c.name, failingChecks: [c.name], log, failingStep: c.name, workflow: c.workflow });
    }

    let blocked = false;
    enter(report, "fixing");
    for (const ev of evidences) {
      const fc = classifyFailure(ev);
      if (!fc) {
        report.classifications.push({ class: null, evidence: summarizeEv(ev) });
        report.escalations.push({ class: null, reason: "unclassified", evidence: summarizeEv(ev) });
        report.messages.push(`UNCLASSIFIED failure (${ev.checkName || ev.source}) — no known FAILURE_CLASS matched. Escalating (fail-closed; never guess a fix).`);
        blocked = true; continue;
      }
      report.classifications.push({ class: fc.id, name: fc.name, diagnosis: fc.diagnosis, evidence: summarizeEv(ev) });

      const recurred = lastSeenClass[fc.id] === true;
      report.cycles.perClass[fc.id] = (report.cycles.perClass[fc.id] || 0) + 1;
      lastSeenClass[fc.id] = true;

      if (report.cycles.perClass[fc.id] > MAX_PER_CLASS) {
        report.escalations.push({ class: fc.id, reason: `exceeded ${MAX_PER_CLASS} fix attempts` });
        report.messages.push(`ESCALATE ${fc.id}: exceeded ${MAX_PER_CLASS} fix attempts — stopping (anti-thrash).`);
        blocked = true; continue;
      }

      // same-signal recurrence -> escalate to the real fix (the partial did not hold).
      let effective = { fix: fc.fix, safeToAuto: fc.safeToAuto, escalated: false };
      if (recurred && fc.escalation && fc.escalation.when === "same-signal-recurs-after-partial-fix") {
        effective = { fix: fc.escalation.fix, safeToAuto: fc.escalation.safeToAuto, escalated: true };
        report.messages.push(`RECURRENCE ${fc.id}: partial fix did not hold -> escalating to the real fix (${fc.escalation.fix.type}, ${fc.escalation.safeToAuto}).`);
      }

      const proposal = { class: fc.id, type: effective.fix.type, action: effective.fix.action, safeToAuto: effective.safeToAuto, escalated: effective.escalated, verify: fc.verify };

      if (effective.safeToAuto === "SAFE-TO-AUTO" && opts.applySafe && !opts.dryRun) {
        try {
          const applied = applySafeFix(fc, effective, io);
          report.appliedFixes.push({ ...proposal, applied: applied.summary, commit: applied.commit });
          report.messages.push(`APPLIED ${fc.id} (${effective.fix.type}) — committed + pushed: ${applied.summary}`);
          // verifying happens on the next monitoring cycle (re-poll)
        } catch (e) {
          report.proposedFixes.push(proposal);
          report.messages.push(`COULD NOT auto-apply ${fc.id} safely (${e.message}) — proposing instead (fail-closed; no blind edit).`);
          blocked = true;
        }
      } else if (effective.safeToAuto === "SAFE-TO-AUTO") {
        report.proposedFixes.push(proposal);
        report.messages.push(`PROPOSE ${fc.id} (SAFE-TO-AUTO): ${effective.fix.action}  [pass --apply-safe to apply]`);
        blocked = true; // default dry-run-ish: never mutate without the flag
      } else if (effective.safeToAuto === "NEEDS-APPROVAL") {
        report.proposedFixes.push(proposal);
        report.escalations.push({ class: fc.id, reason: "NEEDS-APPROVAL", action: effective.fix.action });
        report.messages.push(`NEEDS-APPROVAL ${fc.id}: ${effective.fix.action}\n      evidence: ${summarizeEv(ev)}\n      verify after approval: ${fc.verify}`);
        blocked = true;
      } else { // NEVER-AUTO
        report.escalations.push({ class: fc.id, reason: "NEVER-AUTO", action: effective.fix.action });
        report.messages.push(`NEVER-AUTO ${fc.id}: ${effective.fix.action}`);
        blocked = true;
      }
    }

    if (blocked) {
      report.result = report.escalations.length ? "escalated" : "awaiting-human";
      enter(report, "reporting"); return report;
    }
    enter(report, "verifying"); // applied safe fixes pushed -> loop re-polls
  }

  if (report.result === "pending") {
    report.result = "blocked";
    report.messages.push(`Reached MAX_CI_CYCLES (${MAX_CI_CYCLES}) without green CI — stopping (fail-closed).`);
  }
  enter(report, "reporting");
  return report;
}

// =============================================================================
// REPORT RENDERING
// =============================================================================
function printReport(report, opts) {
  if (opts.json) { console.log(JSON.stringify(report, null, 2)); return; }
  const out = [];
  out.push(`\nci-release-orchestrator · PR ${report.pr}${report.repo ? ` (${report.repo})` : ""}`);
  out.push(`states : ${report.statesTraversed.join(" -> ") || "(none)"}`);
  out.push(`cycles : CI ${report.cycles.ci}/${MAX_CI_CYCLES}  deploy ${report.cycles.deploy}/${MAX_DEPLOY_CYCLES}`);
  if (report.classifications.length) {
    out.push("classifications:");
    for (const c of report.classifications) out.push(`  - ${c.class || "UNCLASSIFIED"}${c.name ? ` ${c.name}` : ""}: ${c.diagnosis || c.evidence}`);
  }
  if (report.appliedFixes.length) {
    out.push("applied fixes:");
    for (const f of report.appliedFixes) out.push(`  - ${f.class} ${f.type}: ${f.applied}`);
  }
  if (report.proposedFixes.length) {
    out.push("proposed fixes:");
    for (const f of report.proposedFixes) out.push(`  - [${f.safeToAuto}${f.escalated ? "/escalated" : ""}] ${f.class} ${f.type}: ${f.action}`);
  }
  if (report.escalations.length) {
    out.push("escalations:");
    for (const e of report.escalations) out.push(`  - ${e.class || ""} ${e.reason}${e.action ? `: ${e.action}` : ""}`.trim());
  }
  if (report.mergeGate) out.push(`merge gate: ${report.mergeGate.action}${report.mergeGate.command ? ` -> ${report.mergeGate.command}` : ""}${report.mergeGate.merged ? " (MERGED)" : ""}`);
  if (report.deploy) out.push(`deploy: ${report.deploy.status || "n/a"}${report.deploy.url ? ` -> ${report.deploy.url}` : ""}`);
  if (report.messages.length) { out.push("log:"); for (const m of report.messages) out.push(`  · ${m}`); }
  out.push(`result: ${report.result}`);
  console.log(out.join("\n"));
}

// =============================================================================
// SELF-TEST — pure, no live calls, no mutation. Asserts:
//  (1) every F1–F5 fixture classifies to its own class (and unrelated red -> none)
//  (2) the safe-to-auto split holds (SAFE:[F2,F3] APPROVAL:[F1,F4] NEVER:[F5])
//  (3) the merge gate is human-only: never "merge" without --merge, and --merge
//      cannot override a red/missing required check.
// =============================================================================
function selfTest() {
  const fails = [];
  const ok = (cond, msg) => { if (!cond) fails.push(msg); };

  // (1) signal fixtures — canned logs/states modeled on the live session
  const fixtures = {
    F1: { log: "AssertionError [ERR_ASSERTION]: expected 29 to be 28", failingChecks: ["verify"], failingStep: "verify" },
    F2: { log: "<--- Last few GCs --->\nFATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory", failingStep: "Build (next build)" },
    F3: { log: "Error: Found invalid Node.js Version: 24.x. Please set \"engines\":{\"node\":...}", workflow: "deploy" },
    F4: { mergeable: "CONFLICTING" },
    F5: { checkName: "founder-experience-scorecard", failingChecks: ["founder-experience-scorecard"] },
  };
  for (const [id, ev] of Object.entries(fixtures)) {
    const fc = classifyFailure(ev);
    ok(fc && fc.id === id, `signal fixture ${id} classified as ${fc ? fc.id : "(none)"} (expected ${id})`);
  }
  ok(classifyFailure({ checkName: "experience-review", failingChecks: ["experience-review"] })?.id === "F5", "experience-review check must classify to F5");
  ok(classifyFailure({ log: "ELIFECYCLE eslint found 3 problems" }) === null, "unrelated red must NOT classify (fail-closed)");

  // (2) safe-to-auto split
  const split = safeToAutoSplit();
  const expect = { "SAFE-TO-AUTO": ["F2", "F3"], "NEEDS-APPROVAL": ["F1", "F4"], "NEVER-AUTO": ["F5"] };
  for (const band of Object.keys(expect)) {
    const got = (split[band] || []).slice().sort();
    ok(JSON.stringify(got) === JSON.stringify(expect[band].slice().sort()), `safe-to-auto split ${band}: got [${got}] expected [${expect[band]}]`);
  }
  const f3 = FAILURE_CLASSES.find((f) => f.id === "F3");
  ok(f3.escalation && f3.escalation.safeToAuto === "NEEDS-APPROVAL", "F3 escalation (real Vercel-API fix) must be NEEDS-APPROVAL (external prod config)");

  // (3) merge gate is human-only
  const allPass = REQUIRED_CHECKS.map((n) => ({ name: n, bucket: "pass" }));
  ok(decideMerge({ checks: allPass, merge: false }).action === "await-human", "all green + no --merge must AWAIT human (print command, never auto-merge)");
  ok(decideMerge({ checks: allPass, merge: false }).action !== "merge", "merge gate must NEVER fire without --merge");
  ok(decideMerge({ checks: allPass, merge: true }).action === "merge", "all green + --merge must enable the human-authorized merge");
  const oneRed = [{ name: "verify", bucket: "fail" }, { name: "experience-review", bucket: "pass" }, { name: "founder-experience-scorecard", bucket: "pass" }];
  ok(decideMerge({ checks: oneRed, merge: true }).action === "blocked", "--merge must NOT override a RED required check");
  ok(decideMerge({ checks: [{ name: "verify", bucket: "pass" }], merge: true }).action === "blocked", "--merge must NOT proceed with MISSING required checks");

  if (fails.length) {
    console.error("ci-release-orchestrator --self-test FAIL:");
    for (const f of fails) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.error(
    `ci-release-orchestrator --self-test PASS — ${Object.keys(fixtures).length} signal fixtures classify correctly (F1–F5 + experience-review->F5 + unrelated->none), ` +
    `safe-to-auto split holds (SAFE:[F2,F3] APPROVAL:[F1,F4] NEVER:[F5], F3-real=NEEDS-APPROVAL), ` +
    `merge gate is human-only (no auto-merge without --merge; --merge cannot override red/missing).`
  );
  process.exit(0);
}

// =============================================================================
// CLI
// =============================================================================
function sameFile(p) { try { return p && p.startsWith("file:") ? fileURLToPath(p) : p; } catch { return p; } }
if (process.argv[1] && fileURLToPath(import.meta.url) === sameFile(process.argv[1])) {
  const argv = process.argv.slice(2);
  if (argv.includes("--self-test")) selfTest();

  const flag = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
  const has = (name) => argv.includes(name);
  const pr = argv.find((a) => /^\d+$/.test(a));
  if (!pr) {
    console.error("USAGE: node ci-release-orchestrator.mjs <pr-number> [--repo OWNER/REPO] [--apply-safe] [--merge] [--watch-deploy] [--json] [--dry-run] [--self-test]");
    process.exit(2);
  }
  const opts = {
    pr,
    repo: flag("--repo"),
    applySafe: has("--apply-safe"),
    merge: has("--merge"),
    watchDeploy: has("--watch-deploy"),
    json: has("--json"),
    dryRun: has("--dry-run"),
    cwd: process.cwd(),
  };

  orchestrate(opts)
    .then((report) => {
      printReport(report, opts);
      const good = report.result === "ok" || report.result === "awaiting-human";
      process.exit(good ? 0 : 1);
    })
    .catch((e) => { console.error(`ci-release-orchestrator: ${e.message}`); process.exit(1); });
}
