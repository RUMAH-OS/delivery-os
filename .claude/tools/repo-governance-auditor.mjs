#!/usr/bin/env node
// =============================================================================
// Delivery OS — Repository Governance Auditor (zero-dep, Node ESM). Audits a
// repo's BRANCH + PR health and keeps it release-ready, with an ENCODED
// governance->action knowledge base (G1–G10). Reuses the CI orchestrator's
// merge FLOOR + HUMAN-only merge gate — it NEVER reimplements (or performs) a merge.
// =============================================================================
// "The auditor should know the governance CLASS and its sanctioned action. Founder
//  recall of 'is this branch already merged / is this PR superseded / are we over the
//  PR budget again' should not be required — but the auditor never CLOSES real work,
//  never MERGES, and never mutates an irreversible surface on its own."
//
// This is the executable core of a repo-hygiene loop: a deterministic classifier
// (branches + PRs -> findings) over a data-driven GOVERNANCE_RULES knowledge base.
// It classifies each branch/PR, then acts ONLY within its sanctioned autonomy band:
//   SAFE            — apply (only with --apply-safe; never in --dry-run) — G1 delete a
//                     PROVABLY-merged branch (high confidence) + G2 close a superseded PR
//   NEEDS-APPROVAL  — print the plan + evidence and STOP (human decides)
//   NEVER-AUTO      — escalate; no automated action is ever attempted
// The MERGE transition is HUMAN-gated by IMPORT: `decideMerge` is reused as-is from the
// CI orchestrator; this tool only ever PRINTS `node merge-pr.mjs <n>`. It auto-merges
// NOTHING. Earned the hard way: a repo that squash-merges shows ~195 remote branches but
// `git branch --merged` finds only a handful — so "merged" must be detected from PR STATE
// first, then ancestry, then cherry-equivalence, and only a HIGH-confidence merged branch
// is ever safe to delete.
//
//   import { GOVERNANCE_RULES, isMergedBranch, classifyBranch, classifyPR, bandSplit, scoreboard } from "./repo-governance-auditor.mjs"
//   node repo-governance-auditor.mjs [--repo OWNER/REPO] [--apply-safe] [--safe-only] [--json] [--dry-run] [--self-test]
//
// DEFAULT (no flags) = READ-ONLY: classify + score + PROPOSE actions + report.
//   Never mutates without --apply-safe. Never merges. Never closes non-superseded work.
// Robust to `gh` not installed / not authenticated (fail-closed, clear message, non-zero).
// =============================================================================

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Reuse the CI orchestrator's merge FLOOR + the HUMAN-only merge gate. DO NOT
// reimplement merge: `decideMerge` is the single source of merge-readiness truth,
// and it is human-only by construction (it returns "await-human", never auto-merges).
import { REQUIRED_CHECKS, decideMerge } from "./ci-release-orchestrator.mjs";

// --- governance budget + staleness thresholds --------------------------------
export const PR_TARGET = 3;       // the healthy steady-state open-PR count
export const PR_SOFT_LIMIT = 5;   // > this many active PRs => a breach (G8)
export const STALE_DAYS = 14;     // an open PR untouched this long is stale (G6)
export const LONGLIVED_DAYS = 30; // an open PR older than this with no owner label (G10)

const CHERRY_MAX = 80;            // bound the per-branch `git cherry` fallback calls

// =============================================================================
// KNOWLEDGE BASE — the governance->action classes. Data, not code: each is a
// repo-hygiene condition, its sanctioned action, and the AUTONOMY BAND that
// governs whether the auditor may act unattended.
//   band: "SAFE"           — auto-actable with --apply-safe (G1 delete, G2 close, G10 advisory)
//         "NEEDS-APPROVAL" — print the plan + evidence and STOP
//         "NEVER-AUTO"     — escalate; never auto-acted
// IMPORTANT: appliers exist ONLY for G1 (branch delete) + G2 (superseded close).
// Everything else is printed. No rule has action "merge" — merge is human-only (import).
// =============================================================================
export const GOVERNANCE_RULES = [
  {
    id: "G1",
    name: "merged-branch-not-deleted",
    kind: "branch",
    band: "SAFE",
    action: "delete-branch",
    detail:
      "A remote branch is PROVABLY merged (HIGH confidence: its PR is MERGED, or it is an ancestor of origin/main) but was never deleted. Safe to delete: nothing unmerged is lost.",
    autoCmd: "git push origin --delete <branch>",
  },
  {
    id: "G2",
    name: "superseded-pr",
    kind: "pr",
    band: "SAFE",
    action: "close-pr",
    detail:
      "A NEWER open PR's changed-file set is a superset of this PR's, AND this PR is not itself green+greenlit. The newer PR supersedes it; safe to close WITH a pointer comment (reopenable).",
    autoCmd: 'gh pr close <n> --comment "superseded by #Y ..."',
  },
  {
    id: "G3",
    name: "cherry-merged-branch",
    kind: "branch",
    band: "NEEDS-APPROVAL",
    action: "propose-delete",
    detail:
      "A branch is MEDIUM-confidence merged: `git cherry origin/main` reports every commit already equivalent upstream, but no MERGED PR / ancestry proof exists (squash-merge). Plausibly merged — but a human confirms before delete.",
  },
  {
    id: "G4",
    name: "consolidation-candidate",
    kind: "repo",
    band: "NEEDS-APPROVAL",
    action: "propose-consolidation",
    detail:
      "Two or more OPEN PRs are batchable (share a label or a top-level path). Consolidating them reduces the queue — but batching is a human call.",
  },
  {
    id: "G5",
    name: "merge-ready",
    kind: "pr",
    band: "NEEDS-APPROVAL",
    action: "surface-merge-command",
    detail:
      "A PR is GREEN on the required floor (decideMerge == await-human) AND greenlit. It is ready — but MERGE IS HUMAN-ONLY: the auditor prints `node merge-pr.mjs <n>` and stops.",
  },
  {
    id: "G6",
    name: "stale-open-pr",
    kind: "pr",
    band: "NEEDS-APPROVAL",
    action: "surface-stale",
    detail:
      `An open PR has been untouched for more than ${STALE_DAYS} days. Surface for a rebase/close decision (never auto-closed: it may be live work).`,
  },
  {
    id: "G7",
    name: "orphaned-stack",
    kind: "pr",
    band: "NEEDS-APPROVAL",
    action: "surface-orphan",
    detail:
      "A stacked PR (base != main) whose parent PR is merged/closed/absent. Its base is gone; re-target to main — a human re-targets to avoid a wrong diff.",
  },
  {
    id: "G8",
    name: "pr-limit-breach",
    kind: "repo",
    band: "NEEDS-APPROVAL",
    action: "surface-limit-plan",
    detail:
      `Active open PRs exceed the soft limit (${PR_SOFT_LIMIT}; target ${PR_TARGET}). Surface a drain plan (merge-ready first, then superseded/stale) — never auto-close to hit a number.`,
  },
  {
    id: "G9",
    name: "main-not-deployable",
    kind: "repo",
    band: "NEVER-AUTO",
    action: "escalate",
    detail:
      "The latest main CI is red (or the last deploy failed). main is not release-ready. NEVER auto-acted — escalate: nothing else matters until main is green.",
  },
  {
    id: "G10",
    name: "undeclared-owner-or-exit",
    kind: "pr",
    band: "SAFE",
    action: "advisory-comment",
    detail:
      `A long-lived open PR (> ${LONGLIVED_DAYS} days) carries no owner/exit label. Advisory only: a comment asking for an owner + exit criteria. (No applier — printed, not auto-posted.)`,
  },
];

const RULE_BY_ID = new Map(GOVERNANCE_RULES.map((r) => [r.id, r]));

function mkFinding(id, extra = {}) {
  const r = RULE_BY_ID.get(id);
  if (!r) throw new Error(`unknown governance rule ${id}`);
  return { rule: id, name: r.name, kind: r.kind, band: r.band, action: r.action, ...extra };
}

// decideAction(finding) -> { action, band }. Pure lookup; the band already encodes
// the autonomy (SAFE branches/PRs are deletable/closable, the rest are surfaced).
export function decideAction(finding) {
  const r = RULE_BY_ID.get(finding.rule);
  if (!r) throw new Error(`unknown governance rule ${finding.rule}`);
  return { action: r.action, band: r.band };
}

// The autonomy bands, by rule id. Used by the apply loop and asserted by --self-test.
export function bandSplit() {
  const out = { SAFE: [], "NEEDS-APPROVAL": [], "NEVER-AUTO": [] };
  for (const r of GOVERNANCE_RULES) (out[r.band] || (out[r.band] = [])).push(r.id);
  return out;
}

// =============================================================================
// THE LOAD-BEARING RULE — squash-merge-aware merged detection.
// Strongest signal first; a repo that squash-merges loses the branch->main commit
// link, so `git branch --merged` is NOT authoritative. Order:
//   1. the branch's PR is MERGED            -> { via:"pr-state", confidence:"high" }
//   2. ancestry: in `git branch -r --merged origin/main` -> { via:"git-merged", confidence:"high" }
//   3. cherry: `git cherry origin/main origin/<b>` all "-" (equivalent upstream)
//                                            -> { via:"cherry", confidence:"medium" }
//   4. otherwise                            -> { merged:false }
// ONLY high-confidence merged => SAFE delete (G1). medium => NEEDS-APPROVAL (G3).
//
// gitFns = { mergedBranches(): string[]  (names from `git branch -r --merged origin/main`),
//            cherry(branch): string      (raw `git cherry origin/main origin/<branch>` output) }
// prIndex = Map<headRefName, { number, state }>  (the MERGED-PR squash index)
// =============================================================================
export function isMergedBranch(branch, prIndex, gitFns) {
  const pr = prIndex && prIndex.get(branch);
  if (pr && String(pr.state).toUpperCase() === "MERGED") {
    return { merged: true, via: "pr-state", confidence: "high", pr: pr.number };
  }
  const merged = (gitFns && gitFns.mergedBranches && gitFns.mergedBranches()) || [];
  if (merged.includes(branch)) {
    return { merged: true, via: "git-merged", confidence: "high" };
  }
  const cherryOut = gitFns && gitFns.cherry ? gitFns.cherry(branch) : "";
  if (cherryOut && cherryOut.trim().length) {
    const lines = cherryOut.split("\n").map((l) => l.trim()).filter(Boolean);
    // every commit "-" => already equivalent upstream (fully cherry-merged). A single
    // "+" (a commit NOT upstream) disqualifies: the branch still carries unmerged work.
    if (lines.length && lines.every((l) => l.startsWith("-"))) {
      return { merged: true, via: "cherry", confidence: "medium" };
    }
  }
  return { merged: false, via: null, confidence: null };
}

// =============================================================================
// CLASSIFIERS — deterministic, pure (all live IO is injected via ctx). Fail-closed:
// an unrecognized branch/PR yields no finding (we never invent an action).
// =============================================================================
const daysSince = (iso, now) => {
  if (!iso) return 0;
  return (now.getTime() - new Date(iso).getTime()) / 86400000;
};

const filesSet = (pr) =>
  new Set([].concat(pr.files || []).map((f) => (typeof f === "string" ? f : f.path)).filter(Boolean));

const labelNames = (pr) => [].concat(pr.labels || []).map((l) => (typeof l === "string" ? l : l.name)).filter(Boolean);

const GREENLIT_LABELS = new Set(["greenlit", "ready-to-merge", "ready", "approved-to-merge"]);

function isGreen(pr, ctx) {
  // GREEN on the required floor == decideMerge can offer the human the merge command.
  // (decideMerge with merge:false returns "await-human" only when every REQUIRED_CHECK is pass.)
  return decideMerge({ checks: ctx.checksOf(pr.number) || [], merge: false }).action === "await-human";
}

function isGreenlit(pr) {
  return labelNames(pr).some((n) => GREENLIT_LABELS.has(String(n).toLowerCase()));
}

// the NEWER open PR whose changed-file set is a (non-empty) superset of this PR's.
function supersededBy(pr, ctx) {
  const mine = filesSet(pr);
  if (mine.size === 0) return null;
  for (const other of ctx.openPRs) {
    if (other.number === pr.number) continue;
    if (daysSince(pr.createdAt, new Date(other.createdAt)) <= 0) continue; // other must be NEWER
    const theirs = filesSet(other);
    if (theirs.size === 0) continue;
    let superset = true;
    for (const f of mine) if (!theirs.has(f)) { superset = false; break; }
    if (superset) return other;
  }
  return null;
}

// classifyBranch(branch, ctx) -> a single finding or null.
//   ctx: { protectedSet:Set, openHeads:Set, mergedIndex:Map, gitFns }
export function classifyBranch(branch, ctx) {
  if (ctx.protectedSet && ctx.protectedSet.has(branch)) return null;
  if (ctx.openHeads && ctx.openHeads.has(branch)) return null; // owned by an OPEN PR -> handled in classifyPR
  const m = isMergedBranch(branch, ctx.mergedIndex, ctx.gitFns);
  if (m.merged && m.confidence === "high") {
    return mkFinding("G1", { branch, via: m.via, confidence: "high", pr: m.pr || null });
  }
  if (m.merged && m.confidence === "medium") {
    return mkFinding("G3", { branch, via: m.via, confidence: "medium" });
  }
  return null;
}

// classifyPR(pr, ctx) -> an array of findings (a PR can hit several).
//   ctx: { openPRs:[], openHeads:Set, checksOf(n)->checks[], defaultBranch, now:Date }
export function classifyPR(pr, ctx) {
  const out = [];
  const green = isGreen(pr, ctx);
  const greenlit = isGreenlit(pr);
  const now = ctx.now || new Date();

  // G2 superseded — but NEVER if this PR is itself green+greenlit (don't close ready work).
  const sup = supersededBy(pr, ctx);
  if (sup && !(green && greenlit)) {
    out.push(mkFinding("G2", { pr: pr.number, supersededBy: sup.number, head: pr.headRefName }));
  }

  // G5 merge-ready — green floor AND greenlit. MERGE IS HUMAN-ONLY: print the command.
  if (green && greenlit) {
    out.push(mkFinding("G5", { pr: pr.number, head: pr.headRefName, command: `node merge-pr.mjs ${pr.number}` }));
  }

  // G6 stale — untouched > STALE_DAYS.
  const staleDays = daysSince(pr.updatedAt, now);
  if (staleDays > STALE_DAYS) {
    out.push(mkFinding("G6", { pr: pr.number, head: pr.headRefName, staleDays: Math.round(staleDays) }));
  }

  // G7 orphaned-stack — base != default AND the parent (open PR on that base) is gone.
  const base = pr.baseRefName;
  const def = ctx.defaultBranch || "main";
  if (base && base !== def) {
    const parentOpen = ctx.openHeads && ctx.openHeads.has(base);
    if (!parentOpen) out.push(mkFinding("G7", { pr: pr.number, head: pr.headRefName, base }));
  }

  // G10 undeclared-owner/exit — long-lived + no labels (advisory; printed, never auto-posted).
  const ageDays = daysSince(pr.createdAt, now);
  if (ageDays > LONGLIVED_DAYS && labelNames(pr).length === 0) {
    out.push(mkFinding("G10", { pr: pr.number, head: pr.headRefName, ageDays: Math.round(ageDays) }));
  }

  return out;
}

// repo-level: groups of >=2 batchable open PRs (shared label or shared top-level path).
export function consolidatable(openPRs) {
  const byKey = new Map();
  for (const pr of openPRs) {
    const label = labelNames(pr)[0];
    let key;
    if (label) key = `label:${String(label).toLowerCase()}`;
    else {
      const first = [...filesSet(pr)][0];
      key = first ? `path:${String(first).split("/")[0]}` : null;
    }
    if (!key) continue;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(pr.number);
  }
  return [...byKey.entries()].filter(([, nums]) => nums.length >= 2).map(([key, prs]) => ({ key, prs }));
}

// =============================================================================
// SCOREBOARD — the at-a-glance health summary derived from the findings + raw facts.
// =============================================================================
export function scoreboard(facts) {
  const openPRs = facts.openPRs || [];
  const findings = facts.findings || [];
  const branchNames = facts.branches || [];
  const count = (id) => findings.filter((f) => f.rule === id).length;
  const activePRs = openPRs.length;
  return {
    activePRs,
    target: PR_TARGET,
    softLimit: PR_SOFT_LIMIT,
    breach: activePRs > PR_SOFT_LIMIT,
    branches: {
      total: branchNames.length,
      mergedUndeleted: count("G1"),
      cherryMerged: count("G3"),
    },
    mergeReady: count("G5"),
    superseded: count("G2"),
    consolidatable: count("G4"),
    stacks: count("G7"),
    stale: count("G6"),
    mainDeployable: facts.mainDeployable !== false,
    actions: findings.map((f) => ({ rule: f.rule, name: f.name, band: f.band, action: f.action, target: f.branch || f.pr || f.group || null })),
  };
}

// =============================================================================
// ANALYZE — pure: turn the gathered facts into findings + a scoreboard.
//   facts: { openPRs, branchNames, mergedIndex, gitFns, checksOf, mainDeployable, now }
// =============================================================================
export function analyze(facts) {
  const now = facts.now || new Date();
  const openHeads = new Set(facts.openPRs.map((p) => p.headRefName));
  const protectedSet = new Set(["main", "master", "develop", "HEAD", facts.defaultBranch || "main"]);
  const branchCtx = { protectedSet, openHeads, mergedIndex: facts.mergedIndex, gitFns: facts.gitFns };
  const prCtx = {
    openPRs: facts.openPRs,
    openHeads,
    checksOf: facts.checksOf,
    defaultBranch: facts.defaultBranch || "main",
    now,
  };

  const findings = [];
  for (const b of facts.branchNames) {
    const f = classifyBranch(b, branchCtx);
    if (f) findings.push(f);
  }
  for (const pr of facts.openPRs) {
    for (const f of classifyPR(pr, prCtx)) findings.push(f);
  }

  // repo-level findings
  if (facts.openPRs.length > PR_SOFT_LIMIT) {
    findings.push(mkFinding("G8", { activePRs: facts.openPRs.length, softLimit: PR_SOFT_LIMIT, target: PR_TARGET }));
  }
  for (const g of consolidatable(facts.openPRs)) {
    findings.push(mkFinding("G4", { group: g.key, prs: g.prs }));
  }
  if (facts.mainDeployable === false) {
    findings.push(mkFinding("G9", { reason: facts.mainReason || "latest main CI red / last deploy failed" }));
  }

  const board = scoreboard({ openPRs: facts.openPRs, branches: facts.branchNames, findings, mainDeployable: facts.mainDeployable });
  return { findings, board };
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

const repoArgsOf = (opts) => (opts.repo ? ["--repo", opts.repo] : []);

function parseRemoteBranches(text) {
  return String(text || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !l.includes("->")) // skip "origin/HEAD -> origin/main"
    .map((l) => l.replace(/^origin\//, ""));
}

// =============================================================================
// GATHER — the live IO. Read-only by itself; mutation is the caller's apply loop.
// =============================================================================
function gatherFacts(io, opts) {
  const repoArgs = repoArgsOf(opts);

  const openPRs = io.ghJson([
    "pr", "list", "--state", "open", "--limit", "200", ...repoArgs,
    "--json", "number,headRefName,baseRefName,state,mergeable,author,createdAt,updatedAt,files,labels,body",
  ]);

  // the squash index: every MERGED PR's head branch (this is what makes a squash-merged
  // branch detectable when `git branch --merged` cannot see it).
  const mergedPRs = io.ghJson(["pr", "list", "--state", "merged", "--limit", "500", ...repoArgs, "--json", "number,headRefName"]);
  const mergedIndex = new Map();
  for (const p of mergedPRs) {
    const prev = mergedIndex.get(p.headRefName);
    if (!prev || p.number > prev.number) mergedIndex.set(p.headRefName, { number: p.number, state: "MERGED" });
  }

  // remote branches + the (non-authoritative under squash) ancestry list.
  let branchNames = [];
  try { branchNames = parseRemoteBranches(io.git(["branch", "-r"])); } catch { branchNames = []; }
  let mergedSet = new Set();
  try { mergedSet = new Set(parseRemoteBranches(io.git(["branch", "-r", "--merged", "origin/main"]))); } catch { /* tolerated */ }

  let cherryCalls = 0;
  const gitFns = {
    mergedBranches: () => [...mergedSet],
    cherry: (branch) => {
      if (cherryCalls >= CHERRY_MAX) return "";
      cherryCalls++;
      try { return io.git(["cherry", "origin/main", `origin/${branch}`]); } catch { return ""; }
    },
  };

  // per-PR required-check buckets (for the merge floor). Cache one call per PR.
  const checkCache = new Map();
  const checksOf = (n) => {
    if (checkCache.has(n)) return checkCache.get(n);
    let checks = [];
    try { checks = io.ghJson(["pr", "checks", String(n), ...repoArgs, "--json", "name,bucket,state"]); } catch { checks = []; }
    checkCache.set(n, checks);
    return checks;
  };

  // main deployability: latest CI run on main.
  let mainDeployable = true;
  let mainReason = null;
  try {
    const runs = io.ghJson(["run", "list", "--workflow", "ci.yml", "--branch", "main", "--limit", "1", ...repoArgs, "--json", "status,conclusion,url"]);
    if (runs && runs.length) {
      const r = runs[0];
      if (r.conclusion && r.conclusion !== "success" && r.conclusion !== "neutral" && r.conclusion !== "skipped") {
        mainDeployable = false;
        mainReason = `latest main CI conclusion=${r.conclusion}`;
      }
    }
  } catch { /* no ci.yml / no runs -> treat as unknown, do not escalate */ }

  return { openPRs, mergedIndex, branchNames, gitFns, checksOf, mainDeployable, mainReason, now: new Date() };
}

// =============================================================================
// APPLIERS (SAFE only). Guarded: each THROWS rather than guess. Never invoked
// under --dry-run or without --apply-safe. ONLY G1 (branch delete) + G2 (close
// superseded). NEVER merges, NEVER closes non-superseded work.
// =============================================================================
const PROTECTED = new Set(["main", "master", "develop", "HEAD"]);

function applyG1(io, finding, repoArgs) {
  if (finding.rule !== "G1") throw new Error(`applyG1 called for ${finding.rule}`);
  if (finding.confidence !== "high") throw new Error(`refusing to delete '${finding.branch}': only HIGH-confidence merged branches are auto-deletable (got ${finding.confidence})`);
  if (!finding.branch || PROTECTED.has(finding.branch)) throw new Error(`refusing to delete protected/empty branch '${finding.branch}'`);
  // gh's delete acts on the repo's remote; with --repo it targets that remote's API.
  if (repoArgs.length) io.ghText(["api", "-X", "DELETE", `repos/${repoArgs[1]}/git/refs/heads/${finding.branch}`]);
  else io.git(["push", "origin", "--delete", finding.branch]);
  return `deleted branch origin/${finding.branch} (merged via ${finding.via}${finding.pr ? `, PR #${finding.pr}` : ""})`;
}

function applyG2(io, finding, repoArgs) {
  if (finding.rule !== "G2") throw new Error(`applyG2 called for ${finding.rule}`);
  if (!finding.supersededBy) throw new Error(`refusing to close PR #${finding.pr}: no superseding PR recorded`);
  const comment = `superseded by #${finding.supersededBy} (its changed-file set is a superset of this PR's). Closing to keep the PR queue at target — reopen if this is wrong.`;
  io.ghText(["pr", "close", String(finding.pr), ...repoArgs, "--comment", comment]);
  return `closed PR #${finding.pr} (superseded by #${finding.supersededBy})`;
}

// =============================================================================
// AUDIT — the orchestration. Read-only by default; SAFE-only mutation behind flags.
// =============================================================================
export async function audit(opts) {
  const io = opts.io || makeIO(opts.cwd || process.cwd());
  const report = {
    repo: opts.repo || null,
    findings: [],
    board: null,
    applied: [],
    proposed: [],
    escalations: [],
    messages: [],
    result: "pending",
  };

  // fail-closed preflight: gh present + authenticated, else refuse to read/mutate.
  if (!io.ghAvailable()) {
    report.result = "error";
    report.messages.push("gh CLI not found on PATH — cannot audit. Install GitHub CLI (https://cli.github.com) and re-run.");
    return report;
  }
  if (!io.ghAuthed()) {
    report.result = "error";
    report.messages.push("gh is not authenticated — run `gh auth login`. Fail-closed: refusing to read or mutate without an authenticated session.");
    return report;
  }

  let facts;
  try { facts = gatherFacts(io, opts); }
  catch (e) { report.result = "error"; report.messages.push(`gather failed: ${e.message}`); return report; }

  const { findings, board } = analyze(facts);
  report.findings = findings;
  report.board = board;

  // route every finding by its band.
  const repoArgs = repoArgsOf(opts);
  for (const f of findings) {
    if (f.band === "SAFE") {
      const isApplier = f.rule === "G1" || f.rule === "G2";
      if (isApplier && opts.applySafe && !opts.dryRun) {
        try {
          const summary = f.rule === "G1" ? applyG1(io, f, repoArgs) : applyG2(io, f, repoArgs);
          report.applied.push({ rule: f.rule, summary });
          report.messages.push(`APPLIED ${f.rule} (${f.name}) — ${summary}`);
        } catch (e) {
          report.proposed.push(f);
          report.messages.push(`COULD NOT auto-apply ${f.rule} safely (${e.message}) — proposing instead (fail-closed; no blind action).`);
        }
      } else if (isApplier) {
        report.proposed.push(f);
        report.messages.push(`PROPOSE ${f.rule} (SAFE): ${RULE_BY_ID.get(f.rule).autoCmd || f.action} [pass --apply-safe to act]`);
      } else {
        // G10 advisory — SAFE band but NO applier; always printed, never auto-posted.
        report.proposed.push(f);
        report.messages.push(`ADVISORY ${f.rule} (${f.name}): PR #${f.pr} — declare an owner + exit criteria (no auto-comment).`);
      }
    } else if (f.band === "NEEDS-APPROVAL") {
      report.proposed.push(f);
      report.escalations.push({ rule: f.rule, reason: "NEEDS-APPROVAL", detail: RULE_BY_ID.get(f.rule).detail });
      const extra = f.command ? ` -> ${f.command}` : "";
      report.messages.push(`NEEDS-APPROVAL ${f.rule} (${f.name})${f.pr ? ` PR #${f.pr}` : f.branch ? ` branch ${f.branch}` : ""}${extra}`);
    } else {
      // NEVER-AUTO
      report.escalations.push({ rule: f.rule, reason: "NEVER-AUTO", detail: RULE_BY_ID.get(f.rule).detail });
      report.messages.push(`NEVER-AUTO ${f.rule} (${f.name}): ${f.reason || RULE_BY_ID.get(f.rule).detail} — escalate.`);
    }
  }

  report.result = "ok";
  return report;
}

// =============================================================================
// REPORT RENDERING
// =============================================================================
function printReport(report, opts) {
  if (opts.json) { console.log(JSON.stringify(report, null, 2)); return; }
  const b = report.board;
  const out = [];
  out.push(`\nrepo-governance-auditor${report.repo ? ` (${report.repo})` : ""}`);
  if (b) {
    out.push(`PRs    : active ${b.activePRs} (target ${b.target}, soft-limit ${b.softLimit})${b.breach ? "  *** BREACH ***" : ""}`);
    out.push(`branch : ${b.branches.total} remote · ${b.branches.mergedUndeleted} merged-undeleted (G1) · ${b.branches.cherryMerged} cherry-merged (G3)`);
    out.push(`ready  : ${b.mergeReady} merge-ready · ${b.superseded} superseded · ${b.stale} stale · ${b.stacks} orphaned-stacks · ${b.consolidatable} consolidation-groups`);
    out.push(`main   : ${b.mainDeployable ? "deployable" : "NOT deployable (G9)"}`);
  }
  if (report.applied.length) { out.push("applied (SAFE):"); for (const a of report.applied) out.push(`  - ${a.rule}: ${a.summary}`); }
  if (report.proposed.length) {
    out.push("proposed:");
    for (const f of report.proposed) out.push(`  - [${f.band}] ${f.rule} ${f.name}${f.pr ? ` PR #${f.pr}` : f.branch ? ` branch ${f.branch}` : f.group ? ` ${f.group}` : ""}${f.command ? ` -> ${f.command}` : ""}`);
  }
  if (report.escalations.length) { out.push("escalations:"); for (const e of report.escalations) out.push(`  - ${e.rule} ${e.reason}`); }
  if (report.messages.length) { out.push("log:"); for (const m of report.messages) out.push(`  · ${m}`); }
  out.push(`result: ${report.result}`);
  console.log(out.join("\n"));
}

// =============================================================================
// SELF-TEST — pure, no live calls, no mutation. Asserts:
//  (1) every G-rule fixture classifies to its own rule (and clean inputs -> none),
//  (2) the band split holds (SAFE:[G1,G2,G10] APPROVAL:[G3,G4,G5,G6,G7,G8] NEVER:[G9]),
//  (3) THE SQUASH-MERGE REGRESSION GUARD: a branch whose PR state==MERGED but is NOT in
//      `git branch --merged` still classifies G1-SAFE (HIGH confidence) — the exact PLOS fact,
//  (4) a green-but-NOT-greenlit PR never reaches G5 (no auto-merge surface for un-greenlit work),
//  (5) the merge gate stays HUMAN-only: decideMerge never auto-merges, no rule has action "merge".
// =============================================================================
function selfTest() {
  const fails = [];
  const ok = (cond, msg) => { if (!cond) fails.push(msg); };
  const now = new Date("2026-06-25T00:00:00Z");
  const iso = (daysAgo) => new Date(now.getTime() - daysAgo * 86400000).toISOString();
  const greenChecks = REQUIRED_CHECKS.map((n) => ({ name: n, bucket: "pass" }));
  const redChecks = [{ name: REQUIRED_CHECKS[0], bucket: "fail" }, ...REQUIRED_CHECKS.slice(1).map((n) => ({ name: n, bucket: "pass" }))];

  // ---- (3) THE SQUASH-MERGE REGRESSION GUARD ----
  // PR state == MERGED, but `git branch --merged` is EMPTY (squash erased the link).
  // Must still classify G1-SAFE (HIGH confidence) via pr-state.
  const squashIndex = new Map([["feat/squashed", { number: 42, state: "MERGED" }]]);
  const emptyGit = { mergedBranches: () => [], cherry: () => "" };
  const m1 = isMergedBranch("feat/squashed", squashIndex, emptyGit);
  ok(m1.merged && m1.confidence === "high" && m1.via === "pr-state", `squash regression: MERGED-PR branch must be HIGH via pr-state (got ${JSON.stringify(m1)})`);
  const g1 = classifyBranch("feat/squashed", { protectedSet: new Set(["main"]), openHeads: new Set(), mergedIndex: squashIndex, gitFns: emptyGit });
  ok(g1 && g1.rule === "G1" && g1.band === "SAFE" && g1.confidence === "high", `squash regression: squash-merged branch (NOT in git --merged) must classify G1-SAFE high (got ${g1 && g1.rule})`);

  // ancestry HIGH (in git --merged) -> G1 too
  const m2 = isMergedBranch("feat/ancestor", new Map(), { mergedBranches: () => ["feat/ancestor"], cherry: () => "" });
  ok(m2.merged && m2.confidence === "high" && m2.via === "git-merged", "ancestry merged must be HIGH via git-merged");

  // ---- G3 cherry-merged (MEDIUM) -> NEEDS-APPROVAL ----
  const cherryGit = { mergedBranches: () => [], cherry: (b) => (b === "feat/cherry" ? "- aaa1111 squashed commit\n- bbb2222 another\n" : "") };
  const mC = isMergedBranch("feat/cherry", new Map(), cherryGit);
  ok(mC.merged && mC.confidence === "medium" && mC.via === "cherry", `cherry-equivalent must be MEDIUM via cherry (got ${JSON.stringify(mC)})`);
  const g3 = classifyBranch("feat/cherry", { protectedSet: new Set(["main"]), openHeads: new Set(), mergedIndex: new Map(), gitFns: cherryGit });
  ok(g3 && g3.rule === "G3" && g3.band === "NEEDS-APPROVAL", `cherry-merged branch must classify G3-NEEDS-APPROVAL (got ${g3 && g3.rule})`);

  // a branch with an UNMERGED "+" commit is NOT merged (no finding)
  const unmergedGit = { mergedBranches: () => [], cherry: () => "+ ccc3333 not upstream\n- ddd4444 equiv\n" };
  ok(isMergedBranch("feat/live", new Map(), unmergedGit).merged === false, "a branch with a '+' (unmerged) commit must NOT be detected merged");
  ok(classifyBranch("feat/live", { protectedSet: new Set(["main"]), openHeads: new Set(), mergedIndex: new Map(), gitFns: unmergedGit }) === null, "an unmerged branch yields no finding (fail-closed)");

  // protected + open-PR-owned branches yield no branch finding
  ok(classifyBranch("main", { protectedSet: new Set(["main"]), openHeads: new Set(), mergedIndex: squashIndex, gitFns: emptyGit }) === null, "protected branch must never be a delete candidate");
  ok(classifyBranch("feat/squashed", { protectedSet: new Set(["main"]), openHeads: new Set(["feat/squashed"]), mergedIndex: squashIndex, gitFns: emptyGit }) === null, "a branch owned by an OPEN PR is not a branch finding (the PR is the unit)");

  // ---- PR fixtures ----
  const prSmall = { number: 10, headRefName: "feat/a", baseRefName: "main", createdAt: iso(20), updatedAt: iso(1), files: [{ path: "src/x.ts" }], labels: [] };
  const prBig = { number: 11, headRefName: "feat/b", baseRefName: "main", createdAt: iso(2), updatedAt: iso(1), files: [{ path: "src/x.ts" }, { path: "src/y.ts" }], labels: [] };
  const openPRs = [prSmall, prBig];
  const baseCtx = (over) => ({ openPRs, openHeads: new Set(["feat/a", "feat/b"]), defaultBranch: "main", now, checksOf: () => [], ...over });

  // ---- (4) green-but-NOT-greenlit must NEVER reach G5 ----
  const greenNotGreenlit = { number: 20, headRefName: "feat/g", baseRefName: "main", createdAt: iso(1), updatedAt: iso(1), files: [], labels: [] };
  const ctxGreen = baseCtx({ openPRs: [greenNotGreenlit], openHeads: new Set(["feat/g"]), checksOf: () => greenChecks });
  const fG = classifyPR(greenNotGreenlit, ctxGreen);
  ok(!fG.some((f) => f.rule === "G5"), "green-but-NOT-greenlit PR must NEVER reach G5-auto (greenlit required)");

  // greenlit + green -> G5, and it prints the human-only merge command
  const greenAndGreenlit = { ...greenNotGreenlit, labels: [{ name: "greenlit" }] };
  const fG5 = classifyPR(greenAndGreenlit, baseCtx({ openPRs: [greenAndGreenlit], openHeads: new Set(["feat/g"]), checksOf: () => greenChecks }));
  const g5 = fG5.find((f) => f.rule === "G5");
  ok(g5 && g5.band === "NEEDS-APPROVAL" && g5.command === "node merge-pr.mjs 20", `green+greenlit must classify G5 and print 'node merge-pr.mjs 20' (got ${g5 && g5.command})`);

  // ---- G2 superseded (newer PR's files superset; this PR not green+greenlit) ----
  const fSmall = classifyPR(prSmall, baseCtx({ checksOf: () => redChecks }));
  const g2 = fSmall.find((f) => f.rule === "G2");
  ok(g2 && g2.supersededBy === 11, `prSmall must be superseded by #11 (got ${g2 && g2.supersededBy})`);
  // a green+greenlit PR is NEVER closed as superseded
  const supGreenlit = { ...prSmall, labels: [{ name: "greenlit" }] };
  const fSG = classifyPR(supGreenlit, baseCtx({ checksOf: () => greenChecks }));
  ok(!fSG.some((f) => f.rule === "G2"), "a green+greenlit PR must NEVER be closed as superseded (don't close ready work)");

  // ---- G6 stale ----
  const stale = { number: 30, headRefName: "feat/s", baseRefName: "main", createdAt: iso(40), updatedAt: iso(20), files: [], labels: [{ name: "wip" }] };
  ok(classifyPR(stale, baseCtx({ openPRs: [stale], openHeads: new Set(["feat/s"]) })).some((f) => f.rule === "G6"), "an open PR untouched > STALE_DAYS must classify G6");

  // ---- G7 orphaned stack ----
  const orphan = { number: 31, headRefName: "feat/child", baseRefName: "feat/gone-parent", createdAt: iso(1), updatedAt: iso(1), files: [], labels: [{ name: "x" }] };
  ok(classifyPR(orphan, baseCtx({ openPRs: [orphan], openHeads: new Set(["feat/child"]) })).some((f) => f.rule === "G7"), "a stacked PR whose parent is gone must classify G7");
  // a stack whose parent IS open is NOT orphaned
  const liveChild = { ...orphan, number: 32, baseRefName: "feat/live-parent" };
  ok(!classifyPR(liveChild, baseCtx({ openPRs: [liveChild], openHeads: new Set(["feat/child", "feat/live-parent"]) })).some((f) => f.rule === "G7"), "a stack with a LIVE open parent is not orphaned");

  // ---- G10 undeclared owner/exit (long-lived, no labels) ----
  const longlived = { number: 33, headRefName: "feat/old", baseRefName: "main", createdAt: iso(45), updatedAt: iso(2), files: [], labels: [] };
  ok(classifyPR(longlived, baseCtx({ openPRs: [longlived], openHeads: new Set(["feat/old"]) })).some((f) => f.rule === "G10"), "a long-lived PR with no labels must classify G10 advisory");

  // ---- G4 consolidation + G8 breach + G9 main-not-deployable (repo-level via analyze) ----
  const batchA = { number: 50, headRefName: "f50", baseRefName: "main", createdAt: iso(1), updatedAt: iso(1), files: [{ path: "docs/a.md" }], labels: [] };
  const batchB = { number: 51, headRefName: "f51", baseRefName: "main", createdAt: iso(1), updatedAt: iso(1), files: [{ path: "docs/b.md" }], labels: [] };
  ok(consolidatable([batchA, batchB]).length === 1, "two PRs sharing a top-level path must be a consolidation group (G4 source)");
  const many = Array.from({ length: 6 }, (_, i) => ({ number: 60 + i, headRefName: `m${i}`, baseRefName: "main", createdAt: iso(1), updatedAt: iso(1), files: [{ path: `pkg${i}/f.ts` }], labels: [] }));
  const aMany = analyze({ openPRs: many, branchNames: [], mergedIndex: new Map(), gitFns: emptyGit, checksOf: () => [], mainDeployable: false, now });
  ok(aMany.findings.some((f) => f.rule === "G8"), "6 active PRs (> soft-limit 5) must classify G8 pr-limit-breach");
  ok(aMany.findings.some((f) => f.rule === "G9"), "main not deployable must classify G9-NEVER-AUTO");
  ok(aMany.board.breach === true && aMany.board.mainDeployable === false, "scoreboard must reflect the breach + non-deployable main");

  // ---- (2) BAND SPLIT ----
  const split = bandSplit();
  const expect = { SAFE: ["G1", "G2", "G10"], "NEEDS-APPROVAL": ["G3", "G4", "G5", "G6", "G7", "G8"], "NEVER-AUTO": ["G9"] };
  for (const band of Object.keys(expect)) {
    const got = (split[band] || []).slice().sort();
    ok(JSON.stringify(got) === JSON.stringify(expect[band].slice().sort()), `band split ${band}: got [${got}] expected [${expect[band]}]`);
  }

  // ---- (5) MERGE GATE STAYS HUMAN-ONLY ----
  ok(decideMerge({ checks: greenChecks, merge: false }).action === "await-human", "all green + no --merge must AWAIT human (print command, never auto-merge)");
  ok(decideMerge({ checks: greenChecks, merge: false }).action !== "merge", "merge gate must NEVER fire without an explicit human --merge");
  ok(GOVERNANCE_RULES.every((r) => r.action !== "merge"), "NO governance rule may have action 'merge' — merge is human-only (imported decideMerge)");
  ok(RULE_BY_ID.get("G5").band === "NEEDS-APPROVAL" && RULE_BY_ID.get("G5").action === "surface-merge-command", "G5 merge-ready must only SURFACE the command (NEEDS-APPROVAL), never auto-merge");

  if (fails.length) {
    console.error("repo-governance-auditor --self-test FAIL:");
    for (const f of fails) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.error(
    "repo-governance-auditor --self-test PASS — G1–G10 fixtures classify correctly " +
    "(incl. THE SQUASH-MERGE REGRESSION GUARD: a MERGED-PR branch absent from `git --merged` -> G1-SAFE high; " +
    "cherry-equivalent -> G3-MEDIUM/NEEDS-APPROVAL; a '+' unmerged commit -> no finding), " +
    "band split holds (SAFE:[G1,G2,G10] APPROVAL:[G3,G4,G5,G6,G7,G8] NEVER:[G9]), " +
    "green-but-NOT-greenlit never reaches G5, a green+greenlit PR is never closed as superseded, " +
    "and the merge gate is HUMAN-only (no rule action 'merge'; imported decideMerge never auto-merges)."
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

  const opts = {
    repo: flag("--repo"),
    applySafe: has("--apply-safe"),
    safeOnly: has("--safe-only"),
    json: has("--json"),
    dryRun: has("--dry-run"),
    cwd: process.cwd(),
  };

  audit(opts)
    .then((report) => {
      printReport(report, opts);
      process.exit(report.result === "ok" ? 0 : 1);
    })
    .catch((e) => { console.error(`repo-governance-auditor: ${e.message}`); process.exit(1); });
}
