#!/usr/bin/env node
// =============================================================================
// Delivery OS — deployment-auth (the SAFETY-CRITICAL deployment-authorization
// STATE CHECKER). Zero external deps (node builtins + `gh`/`git` via execFileSync,
// no shell string interpolation). Node ESM.
// =============================================================================
// RATIFIED DESIGN (founder directive 2026-06-25): deployment authorization is
// COMPUTED FROM SDLC STATE, not from a founder pre-signature. Per target:
//   DEV / PREVIEW → authorized when a fresh INDEPENDENT VERIFY is `verified`
//     (author≠verifier, newer than impl) AND CI is green. (DEV/Preview are WHERE
//     the founder reviews — they deploy verified code automatically, BEFORE review.)
//   PRODUCTION   → authorized ONLY when ALL of: verify + ci + merged-to-target
//     + (IF founder_verifiable → a Founder Review artifact exists) + (IF Class C →
//     a `founder-approved` label applied by a CODEOWNER) + within the lane's scope.
//
// THE LOAD-BEARING SAFETY INVARIANT: this tool must NEVER return authorized=true
// when a REQUIRED governance step for that environment is unfinished or unreadable.
// ANY required signal missing, ambiguous, or unreadable ⇒ authorized=false
// (FAIL-CLOSED). Authorization depends on STATE, never on who runs it. A higher
// environment requires strictly MORE than a lower one (contract: REQUIREMENTS).
//
// INTERFACE (exact — parallel agents call this):
//   node deployment-auth.mjs check --target <dev|preview|prod>
//        [--pr <n>] [--base <ref>] [--target-branch <ref>] [--lane <path>]
//        [--action <class>] [--slice <name>] [--sha <commit>] [--explain] [--json]
//   → prints to stdout a JSON object matching contracts/deployment-auth-v1.mjs;
//     exit 0 IFF authorized=true, exit 1 otherwise. --explain pretty-prints the
//     per-signal verdicts to stderr.
//
//   node deployment-auth.mjs --self-test   deterministic fixtures, no live gh/net.
// =============================================================================

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  SIGNAL_NAMES, TARGETS, REQUIREMENTS, CANONICAL_ORDER,
  validate, requirementsAreMonotonic,
} from "../../contracts/deployment-auth-v1.mjs";
import { classify, loadConfig } from "./change-classify.mjs";

// =============================================================================
// FRONTMATTER — mirrors verify-gate.mjs `frontmatter`, PLUS the inline-`#`-comment
// strip (the bug just found: `verify_status: verified # note` must read "verified",
// not "verified # note"). Unquoted values have a trailing ` # comment` removed;
// quoted values keep their inner text verbatim.
// =============================================================================
export function parseFrontmatter(txt) {
  const m = (txt || "").match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const fm = {};
  if (!m) return fm;
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([a-z_]+):\s*(.+?)\s*$/i);
    if (!kv) continue;
    let v = kv[2];
    const quoted = /^(["']).*\1$/.test(v);
    if (quoted) {
      v = v.replace(/^["']|["']$/g, "");
    } else {
      v = v.replace(/\s+#.*$/, "").replace(/^["']|["']$/g, "").trim(); // STRIP inline # comment
    }
    fm[kv[1].toLowerCase()] = v;
  }
  return fm;
}

// --- impl-surface detection (mirrors verify-gate; monorepo-aware) ------------
const IMPL_BASE = /^(src|app|lib|api|migrations|db)\/|^(apps|packages|services)\/[^/]+\//;
const NONIMPL = /(^|\/)(tests?|e2e|evals|docs|\.claude|node_modules|dist|build|\.next|out|coverage)\/|\.(test|spec)\.|\.md$/;
function loadImplExtra(io) {
  try { const c = JSON.parse(io.read(".claude/.verify-config.json") || "{}"); return Array.isArray(c.impl_extra) ? c.impl_extra : []; }
  catch { return []; }
}
const isImpl = (f, extra) => (IMPL_BASE.test(f) || (extra || []).some((p) => f.startsWith(p))) && !NONIMPL.test(f);

const VERIFY_DIRS = ["docs/verify", "docs"];
const REVIEW_DIR = "docs/review";

// =============================================================================
// SIGNAL READERS — each returns { passed, reason, evidence }, FAIL-CLOSED on any
// error / ambiguity / unreadability. They read STATE; none of them looks at who
// invoked the tool. ctx = { io, opts, classification }.
// =============================================================================

// 1) verify — a fresh, passing, INDEPENDENT VERIFY artifact, newer than the impl.
export function readVerify(ctx) {
  const { io, opts } = ctx;
  try {
    const extra = loadImplExtra(io);
    const changed = io.changedFiles(opts.base);
    if (changed === null) return { passed: false, reason: "verify: cannot read the changed-file set (git unreadable) — fail-closed." };
    const impl = changed.filter((f) => isImpl(f, extra));
    const newest = impl.reduce((mx, f) => Math.max(mx, io.mtime(f)), 0);

    for (const d of VERIFY_DIRS) {
      let names;
      try { names = io.readdir(d); } catch { names = []; }
      for (const n of names) {
        if (!/^VERIFY-.*\.md$/i.test(n)) continue;
        const rel = `${d}/${n}`;
        if (io.mtime(rel) < newest) continue; // stale relative to the code ⇒ does not count
        const fm = parseFrontmatter(io.read(rel));
        const passing = String(fm.verify_status).toLowerCase() === "verified";
        const independent = !!(fm.author && fm.verifier && fm.author !== fm.verifier);
        if (passing && independent) {
          return {
            passed: true,
            reason: `verify: fresh INDEPENDENT verified artifact ${rel} (author "${fm.author}" ≠ verifier "${fm.verifier}").`,
            evidence: { path: rel, author: fm.author, verifier: fm.verifier, date: fm.date || null, newerThanImplMs: newest },
          };
        }
      }
    }
    return {
      passed: false,
      reason: `verify: no fresh, passing, INDEPENDENT docs/verify/VERIFY-*.md (verify_status: verified, author ≠ verifier, newer than ${impl.length} changed impl file(s)) — fail-closed.`,
      evidence: { changedImpl: impl.length, newestImplMs: newest },
    };
  } catch (e) {
    return { passed: false, reason: `verify: reader error (${e.message}) — fail-closed.` };
  }
}

// 2) ci — every CI check bucket === "pass". Missing PR / gh error ⇒ fail-closed.
export function readCi(ctx) {
  const { io, opts } = ctx;
  try {
    if (!opts.pr) return { passed: false, reason: "ci: no --pr given; cannot read CI checks — fail-closed." };
    let checks;
    try { checks = io.ghPrChecks(opts.pr); }
    catch (e) { return { passed: false, reason: `ci: could not read checks for PR #${opts.pr} (${e.message}) — fail-closed.` }; }
    if (!Array.isArray(checks) || checks.length === 0) {
      return { passed: false, reason: `ci: no CI checks reported for PR #${opts.pr} — cannot confirm green, fail-closed.` };
    }
    const bad = checks.filter((c) => String(c.bucket) !== "pass");
    if (bad.length) {
      return {
        passed: false,
        reason: `ci: ${bad.length}/${checks.length} check(s) not passing: ${bad.slice(0, 6).map((c) => `${c.name}=${c.bucket}`).join(", ")} — fail-closed.`,
        evidence: { total: checks.length, failing: bad.map((c) => ({ name: c.name, bucket: c.bucket })) },
      };
    }
    return { passed: true, reason: `ci: all ${checks.length} check(s) bucket=pass.`, evidence: { total: checks.length } };
  } catch (e) {
    return { passed: false, reason: `ci: reader error (${e.message}) — fail-closed.` };
  }
}

// 3) founder_review — IF founder_verifiable, a docs/review/REVIEW-*.md must exist.
export function readFounderReview(ctx) {
  const { io, opts, classification } = ctx;
  try {
    if (!classification) return { passed: false, reason: "founder_review: classification unavailable — fail-closed." };
    if (!classification.founder_verifiable) {
      return { passed: true, reason: "founder_review: change is not founder_verifiable — no Founder Review required.", evidence: { founder_verifiable: false } };
    }
    let names;
    try { names = io.readdir(REVIEW_DIR); } catch { names = []; }
    const reviews = names.filter((n) => /^REVIEW-.*\.md$/i.test(n));
    let match = null;
    if (opts.pr) match = reviews.find((n) => new RegExp(`^REVIEW-${opts.pr}\\b`, "i").test(n) || new RegExp(`^REVIEW-${opts.pr}-`, "i").test(n));
    if (!match && opts.slice) match = reviews.find((n) => n.toLowerCase().includes(String(opts.slice).toLowerCase()));
    if (match) {
      return { passed: true, reason: `founder_review: founder_verifiable change has a Founder Review artifact ${REVIEW_DIR}/${match}.`, evidence: { path: `${REVIEW_DIR}/${match}` } };
    }
    return {
      passed: false,
      reason: `founder_review: change is founder_verifiable but NO docs/review/REVIEW-*.md exists for ${opts.pr ? `PR #${opts.pr}` : opts.slice ? `slice "${opts.slice}"` : "this slice (no --pr/--slice to identify it)"} — fail-closed.`,
      evidence: { founder_verifiable: true, reviewsFound: reviews.length },
    };
  } catch (e) {
    return { passed: false, reason: `founder_review: reader error (${e.message}) — fail-closed.` };
  }
}

// 4) class_c — IF Class C, a `founder-approved` label applied by a CODEOWNER.
export function readClassC(ctx) {
  const { io, opts, classification } = ctx;
  try {
    if (!classification) return { passed: false, reason: "class_c: classification unavailable — fail-closed." };
    if (classification.class !== "C") {
      return { passed: true, reason: `class_c: change is Class ${classification.class} (not C) — no explicit founder approval required.`, evidence: { class: classification.class } };
    }
    if (!opts.pr) return { passed: false, reason: "class_c: Class C change but no --pr to check the founder-approved label — fail-closed." };
    let labels;
    try { labels = io.ghPrLabels(opts.pr); }
    catch (e) { return { passed: false, reason: `class_c: could not read PR #${opts.pr} labels (${e.message}) — fail-closed.` }; }
    if (!Array.isArray(labels) || !labels.includes("founder-approved")) {
      return { passed: false, reason: "class_c: Class C change lacks the 'founder-approved' label — fail-closed.", evidence: { class: "C", labels: labels || null } };
    }
    let applier;
    try { applier = io.labelApplier(opts.pr, "founder-approved"); }
    catch (e) { return { passed: false, reason: `class_c: could not read who applied 'founder-approved' (${e.message}) — fail-closed.` }; }
    if (!applier) return { passed: false, reason: "class_c: 'founder-approved' present but its applier is unknown/unreadable — fail-closed." };
    let owners;
    try { owners = io.codeowners(); }
    catch (e) { return { passed: false, reason: `class_c: could not read CODEOWNERS (${e.message}) — fail-closed.` }; }
    if (!owners || owners.size === 0) return { passed: false, reason: "class_c: CODEOWNERS empty/unreadable — cannot confirm the approver is an owner, fail-closed." };
    if (!owners.has(String(applier).toLowerCase())) {
      return { passed: false, reason: `class_c: 'founder-approved' applied by @${applier}, who is NOT a CODEOWNER — fail-closed.`, evidence: { applier, ownerCount: owners.size } };
    }
    return { passed: true, reason: `class_c: Class C change approved — 'founder-approved' applied by CODEOWNER @${applier}.`, evidence: { applier } };
  } catch (e) {
    return { passed: false, reason: `class_c: reader error (${e.message}) — fail-closed.` };
  }
}

// 5) merge — the commit must be an ancestor of the target branch (prod only).
export function readMerge(ctx) {
  const { io, opts } = ctx;
  try {
    const sha = opts.sha || io.headSha();
    if (!sha) return { passed: false, reason: "merge: cannot resolve the commit SHA (git unreadable) — fail-closed." };
    const branch = opts.targetBranch || "origin/main";
    const anc = io.isAncestor(sha, branch);
    if (anc === true) return { passed: true, reason: `merge: ${sha.slice(0, 12)} is an ancestor of ${branch} (merged).`, evidence: { sha, branch } };
    if (anc === false) return { passed: false, reason: `merge: ${sha.slice(0, 12)} is NOT merged into ${branch} (not an ancestor) — fail-closed.`, evidence: { sha, branch } };
    return { passed: false, reason: `merge: could not determine ancestry of ${sha.slice(0, 12)} vs ${branch} (git error) — fail-closed.`, evidence: { sha, branch } };
  } catch (e) {
    return { passed: false, reason: `merge: reader error (${e.message}) — fail-closed.` };
  }
}

// 6) lane_scope — the action/target is declared in the deploy lane (POLICY), the
//    lane is not FROZEN (founder kill-switch), and the action does not hit a guard
//    deny-substring. (SCOPE only; the lane wrapper enforces the guard at run time.)
//    NB: the lane model has NO `ratified` gate — the lane file's PRESENCE is the
//    policy; a `freeze.frozen` flag is the only standing-deny.
export function readLaneScope(ctx) {
  const { io, opts } = ctx;
  try {
    const raw = io.readLane(opts.lane);
    if (raw == null) return { passed: false, reason: `lane_scope: no ${opts.lane || ".deploy-lane.json"} found — fail-closed.` };
    let lane;
    try { lane = JSON.parse(raw); }
    catch (e) { return { passed: false, reason: `lane_scope: deploy lane is not valid JSON (${e.message}) — fail-closed.` }; }
    // FREEZE kill-switch: a frozen lane is a standing founder DENY of all deploys.
    if (lane.freeze && lane.freeze.frozen === true) {
      return { passed: false, reason: "lane_scope: deploy frozen by founder (freeze.frozen=true) — fail-closed.", evidence: { frozen: true } };
    }
    const actions = lane.actions || {};
    const declared = Object.keys(actions).filter((k) => k !== "_comment");
    if (!declared.length) return { passed: false, reason: "lane_scope: deploy lane declares no action classes — nothing in scope, fail-closed.", evidence: { declared: [] } };
    const guards = (lane.guards && Array.isArray(lane.guards.deny_substrings)) ? lane.guards.deny_substrings : [];
    if (opts.action) {
      const spec = actions[opts.action];
      if (!spec || opts.action === "_comment") {
        return { passed: false, reason: `lane_scope: action "${opts.action}" is not declared in the lane (known: ${declared.join(", ") || "none"}) — out of scope, fail-closed.`, evidence: { declared } };
      }
      const rendered = [spec.cmd, ...(spec.args || [])].join(" ");
      const hit = guards.find((g) => rendered.toLowerCase().includes(String(g).toLowerCase()));
      if (hit) return { passed: false, reason: `lane_scope: action "${opts.action}" command hits the irreversible/destructive guard "${hit}" — never in any lane, fail-closed.`, evidence: { action: opts.action, guard: hit } };
      return { passed: true, reason: `lane_scope: action "${opts.action}" is declared in the (non-frozen) lane and clear of guards.`, evidence: { action: opts.action } };
    }
    return { passed: true, reason: `lane_scope: deploy lane present and not frozen; ${declared.length} action class(es) declared and in scope.`, evidence: { declared } };
  } catch (e) {
    return { passed: false, reason: `lane_scope: reader error (${e.message}) — fail-closed.` };
  }
}

export const LIVE_READERS = {
  verify: readVerify,
  founder_review: readFounderReview,
  class_c: readClassC,
  merge: readMerge,
  ci: readCi,
  lane_scope: readLaneScope,
};

// =============================================================================
// EVALUATE (pure given readers) — the composition. authorized = EVERY required
// signal passed === true. FAIL-CLOSED: a required signal that is missing, throws,
// or returns a non-true passed becomes passed:false. Non-required signals are
// still evaluated for transparency (so the report shows the full state and the
// "higher env requires strictly more" property is visible) but NEVER gate.
// =============================================================================
export function evaluate(target, ctx, readers = LIVE_READERS) {
  if (!REQUIREMENTS[target]) throw new Error(`unknown target "${target}" (expected ${TARGETS.join("|")})`);
  const required = new Set(REQUIREMENTS[target]);
  const signals = {};

  for (const name of SIGNAL_NAMES) {
    const isReq = required.has(name);
    let r;
    try { r = readers[name] ? readers[name](ctx) : null; }
    catch (e) { r = { passed: false, reason: `${name}: reader threw (${e.message}) — fail-closed.` }; }
    if (r == null) r = { passed: isReq ? false : null, reason: isReq ? `${name}: no reader available — fail-closed.` : `${name}: not evaluated.` };

    // FAIL-CLOSED: a required signal is passed ONLY when the reader returned exactly true.
    const passed = isReq ? (r.passed === true) : (r.passed === true ? true : r.passed === false ? false : null);
    signals[name] = { required: isReq, passed, reason: r.reason || `${name}: (no reason)`, evidence: r.evidence ?? null };
  }

  // First unfinished REQUIRED governance step, in canonical order.
  const reqOrder = CANONICAL_ORDER.filter((n) => required.has(n));
  const firstUnfinished = reqOrder.find((n) => signals[n].passed !== true) || null;
  const authorized = firstUnfinished === null;

  const reason = authorized
    ? `AUTHORIZED for ${target}: all ${reqOrder.length} required governance signal(s) passed (${reqOrder.join(", ")}). Authorization computed from SDLC state.`
    : `REFUSED for ${target}: ${firstUnfinished} — ${signals[firstUnfinished].reason}`;

  return {
    authorized,
    target,
    reason,
    signals,
    checkedAt: new Date().toISOString(),
    evidence: {
      pr: ctx.opts?.pr ?? null,
      sha: ctx.opts?.sha ?? null,
      base: ctx.opts?.base ?? null,
      targetBranch: ctx.opts?.targetBranch ?? null,
      classification: ctx.classification ? { class: ctx.classification.class, founder_verifiable: ctx.classification.founder_verifiable } : null,
      requiredSignals: REQUIREMENTS[target],
    },
  };
}

// =============================================================================
// LIVE IO — all shelled via execFileSync (NO shell, NO string interpolation).
// =============================================================================
function makeIO(cwd) {
  const git = (args) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const gh = (args) => execFileSync("gh", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const io = {
    cwd,
    mtime(rel) { try { return statSync(join(cwd, rel)).mtimeMs; } catch { return 0; } },
    read(rel) { try { return readFileSync(join(cwd, rel), "utf8"); } catch { return null; } },
    readdir(rel) { try { return readdirSync(join(cwd, rel)); } catch { return []; } },
    exists(rel) { return existsSync(join(cwd, rel)); },
    changedFiles(base) {
      try {
        const range = base ? [`${base}...HEAD`] : [];
        return git(["diff", "--name-only", ...range]).split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
      } catch { return null; } // null = unreadable ⇒ verify reader fails closed
    },
    diffBody(base) { try { const range = base ? [`${base}...HEAD`] : []; return git(["diff", ...range]); } catch { return ""; } },
    headSha() { try { return git(["rev-parse", "HEAD"]).trim(); } catch { return null; } },
    isAncestor(sha, ref) {
      try { execFileSync("git", ["merge-base", "--is-ancestor", sha, ref], { cwd, stdio: "ignore" }); return true; }
      catch (e) { return e && e.status === 1 ? false : null; } // exit 1 = definitively not an ancestor; other = unreadable
    },
    ghPrChecks(pr) {
      let out;
      // `gh pr checks` exits non-zero when checks are failing/pending — capture stdout regardless.
      try { out = gh(["pr", "checks", String(pr), "--json", "name,bucket,state"]); }
      catch (e) { out = (e && e.stdout != null) ? String(e.stdout) : ""; }
      if (!out || !out.trim()) throw new Error("gh pr checks returned no JSON");
      return JSON.parse(out);
    },
    ghPrLabels(pr) {
      const out = gh(["pr", "view", String(pr), "--json", "labels"]);
      const j = JSON.parse(out);
      return Array.isArray(j.labels) ? j.labels.map((l) => l.name) : [];
    },
    nameWithOwner() { try { return JSON.parse(gh(["repo", "view", "--json", "nameWithOwner"])).nameWithOwner; } catch { return null; } },
    labelApplier(pr, label) {
      const nwo = io.nameWithOwner();
      if (!nwo) return null;
      const out = gh(["api", `repos/${nwo}/issues/${pr}/timeline`, "--paginate", "-H", "Accept: application/vnd.github+json"]);
      // --paginate may concatenate multiple JSON arrays; normalize to one array.
      const events = parseConcatenatedJsonArrays(out);
      const labeled = events.filter((e) => e && e.event === "labeled" && e.label && e.label.name === label);
      if (!labeled.length) return null;
      const last = labeled[labeled.length - 1];
      return last.actor && last.actor.login ? last.actor.login : null;
    },
    codeowners() {
      const txt = io.read(".github/CODEOWNERS") || io.read("CODEOWNERS") || io.read("docs/CODEOWNERS");
      const set = new Set();
      if (txt) for (const line of txt.split(/\r?\n/)) {
        const t = line.replace(/#.*/, "").trim();
        if (!t) continue;
        for (const m of t.matchAll(/@([A-Za-z0-9/_-]+)/g)) set.add(m[1].toLowerCase());
      }
      return set;
    },
    readLane(lanePath) { return io.read(lanePath || ".deploy-lane.json"); },
  };
  return io;
}

// `gh api --paginate` concatenates page arrays (e.g. `[...][...]`). Split into the
// top-level arrays by tracking bracket depth + string state (delimiter-free, so an
// element containing brackets/spaces is never mis-split), then parse each.
function parseConcatenatedJsonArrays(text) {
  const s = String(text || "").trim();
  if (!s) return [];
  try { const j = JSON.parse(s); return Array.isArray(j) ? j : []; } catch { /* fall through to split */ }
  const out = [];
  let depth = 0, start = -1, inStr = false, esc = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; continue; }
    if (c === "[") { if (depth === 0) start = i; depth++; }
    else if (c === "]") {
      depth--;
      if (depth === 0 && start >= 0) {
        try { const j = JSON.parse(s.slice(start, i + 1)); if (Array.isArray(j)) out.push(...j); } catch { /* skip a bad chunk */ }
        start = -1;
      }
    }
  }
  return out;
}

// =============================================================================
// LIVE DRIVER — compute the classification once, then evaluate.
// =============================================================================
function computeClassification(io, opts) {
  try {
    const changed = io.changedFiles(opts.base);
    if (changed === null) return null; // unreadable ⇒ founder_review/class_c fail closed
    const diff = io.diffBody(opts.base);
    const { config, configError } = loadConfig(io.cwd);
    return classify(changed, diff, config, { configError });
  } catch { return null; }
}

export function runCheck(opts) {
  const io = opts.io || makeIO(opts.cwd || process.cwd());
  const classification = ("classification" in opts) ? opts.classification : computeClassification(io, opts);
  const ctx = { io, opts, classification };
  return evaluate(opts.target, ctx, opts.readers || LIVE_READERS);
}

// =============================================================================
// EXPLAIN RENDERING (stderr)
// =============================================================================
function explain(result) {
  const lines = [];
  lines.push(`deployment-auth · target=${result.target} · ${result.authorized ? "AUTHORIZED" : "REFUSED"}`);
  for (const name of SIGNAL_NAMES) {
    const s = result.signals[name];
    const mark = s.passed === true ? "PASS" : s.passed === false ? "FAIL" : "n/a ";
    const req = s.required ? "REQUIRED" : "optional";
    lines.push(`  [${mark}] ${name.padEnd(15)} (${req}) — ${s.reason}`);
  }
  lines.push(`  → ${result.reason}`);
  process.stderr.write(lines.join("\n") + "\n");
}

// =============================================================================
// SELF-TEST — deterministic, NO live gh/git/network. Proves the LOAD-BEARING
// rule: NO required-but-missing governance step ever yields authorized=true.
//   (a) all-green prod inputs              -> authorized
//   (b) each individually-missing required -> REFUSED, naming the right step
//   (c) dev authorized on verify+CI alone, even when not merged / not reviewed
//   (d) unreadable / missing inputs        -> fail-closed REFUSE
// It runs the REAL readers against an in-memory fake IO (proving the actual
// frontmatter `#`-strip, lane, CODEOWNERS and ancestry logic) AND the compose
// layer against injected reader results.
// =============================================================================
function fakeIO(state) {
  const s = state || {};
  const io = {
    cwd: "/fake",
    mtime: (rel) => (s.mtimes && rel in s.mtimes) ? s.mtimes[rel] : 0,
    read: (rel) => (s.files && rel in s.files) ? s.files[rel] : null,
    readdir: (rel) => (s.dirs && s.dirs[rel]) ? s.dirs[rel] : [],
    exists: (rel) => !!(s.files && rel in s.files),
    changedFiles: () => (s.changedFiles === undefined ? [] : s.changedFiles),
    diffBody: () => s.diffBody || "",
    headSha: () => (s.headSha === undefined ? "deadbeefcafe0000" : s.headSha),
    isAncestor: () => s.isAncestor, // true | false | null
    ghPrChecks: () => { if (s.ciThrow) throw new Error("gh offline"); return s.checks; },
    ghPrLabels: () => { if (s.labelsThrow) throw new Error("gh offline"); return s.labels || []; },
    nameWithOwner: () => "o/r",
    labelApplier: () => (s.applier === undefined ? null : s.applier),
    codeowners: () => new Set((s.owners || []).map((x) => x.toLowerCase())),
    readLane: () => (s.lane === undefined ? null : s.lane),
  };
  return io;
}

const VERIFIED_FM = [
  "---",
  "slice: \"demo\"",
  "verify_status: verified # independently graded",   // inline-# comment (the bug)
  "author: \"impl-session\"",
  "verifier: \"independent-qa\"",
  "date: 2026-06-25",
  "---",
  "# VERIFY demo",
].join("\n");

// The lane model is POLICY: its PRESENCE authorizes scope; `freeze.frozen` is the
// only standing-deny. No `ratified` gate (removed — reconciled with the new template).
const NONFROZEN_LANE = JSON.stringify({
  version: 1,
  freeze: { frozen: false },
  actions: { "vercel-deploy-prod": { cmd: "vercel", args: ["deploy", "--prod"], targets: ["proj"] } },
  guards: { deny_substrings: ["db:reset", "--rollback", "drop "] },
});
const FROZEN_LANE = JSON.stringify({
  version: 1,
  freeze: { frozen: true },
  actions: { "vercel-deploy-prod": { cmd: "vercel", args: ["deploy", "--prod"], targets: ["proj"] } },
});

// A fake-IO world where EVERY required prod signal is GREEN.
function greenProdState(over = {}) {
  return {
    changedFiles: ["src/app/feature.ts"],
    mtimes: { "src/app/feature.ts": 1000, "docs/verify/VERIFY-demo.md": 2000 },
    dirs: { "docs/verify": ["VERIFY-demo.md"], "docs/review": ["REVIEW-42-demo.md"], "docs": [] },
    files: { "docs/verify/VERIFY-demo.md": VERIFIED_FM, "docs/review/REVIEW-42-demo.md": "# Founder Review" },
    checks: [{ name: "build", bucket: "pass" }, { name: "test", bucket: "pass" }],
    isAncestor: true,
    labels: ["founder-approved"],
    applier: "the-founder",
    owners: ["the-founder", "software-engineer"],
    lane: NONFROZEN_LANE,
    ...over,
  };
}

function selfTest() {
  const fails = [];
  const ok = (cond, msg) => { if (!cond) fails.push(msg); };
  const log = [];

  // contract sanity: the requirement matrix is monotonic (prod ⊇ preview ⊇ dev).
  const mono = requirementsAreMonotonic();
  ok(mono.ok, `requirement matrix must be monotonic: ${mono.errors.join("; ")}`);
  ok(REQUIREMENTS.prod.length > REQUIREMENTS.dev.length, "prod must require strictly MORE than dev");

  // classification stubs (no real classifier run in self-test).
  const CLASS_B_FV = { class: "B", founder_verifiable: true };   // founder-verifiable, not C
  const CLASS_C = { class: "C", founder_verifiable: false };     // class C, not founder-verifiable
  const CLASS_A = { class: "A", founder_verifiable: false };     // nothing extra required

  const run = (target, state, classification, opts = {}) =>
    evaluate(target, { io: fakeIO(state), opts: { pr: 42, base: "origin/main", ...opts }, classification }, LIVE_READERS);

  // (a) ALL-GREEN PROD INPUTS -> AUTHORIZED (real readers, fake IO).
  const aGreen = run("prod", greenProdState(), CLASS_B_FV);
  ok(aGreen.authorized === true, "(a) all-green prod inputs must AUTHORIZE");
  ok(validate(aGreen).ok, `(a) result must satisfy the contract: ${validate(aGreen).errors.join("; ")}`);
  log.push(`  (a) all-green prod                          -> authorized=${aGreen.authorized}`);

  // prove the inline-# strip actually worked: verify passed via "verified # comment".
  ok(aGreen.signals.verify.passed === true, "(a) verify must pass — proves the inline-# frontmatter strip");

  // (b) EACH INDIVIDUALLY-MISSING REQUIRED SIGNAL -> REFUSED with the right reason.
  const noVerify = run("prod", greenProdState({ files: { "docs/review/REVIEW-42-demo.md": "x", "docs/verify/VERIFY-demo.md": VERIFIED_FM.replace("verify_status: verified # independently graded", "verify_status: pending") } }), CLASS_B_FV);
  ok(noVerify.authorized === false && !noVerify.signals.verify.passed, "(b) no verified VERIFY -> REFUSED");
  ok(noVerify.reason.includes("verify"), "(b) deny reason must name verify (first unfinished)");
  log.push(`  (b) prod, VERIFY not verified               -> authorized=${noVerify.authorized} (${noVerify.signals.verify.passed})`);

  // verify present but NOT independent (author === verifier) -> still refused.
  const notIndependent = run("prod", greenProdState({ files: { "docs/review/REVIEW-42-demo.md": "x", "docs/verify/VERIFY-demo.md": VERIFIED_FM.replace('verifier: "independent-qa"', 'verifier: "impl-session"') } }), CLASS_B_FV);
  ok(notIndependent.authorized === false, "(b) author===verifier (not independent) -> REFUSED");

  // stale verify (older than the impl) -> refused.
  const staleVerify = run("prod", greenProdState({ mtimes: { "src/app/feature.ts": 5000, "docs/verify/VERIFY-demo.md": 1000 } }), CLASS_B_FV);
  ok(staleVerify.authorized === false, "(b) VERIFY older than impl (stale) -> REFUSED");

  const ciRed = run("prod", greenProdState({ checks: [{ name: "build", bucket: "pass" }, { name: "test", bucket: "fail" }] }), CLASS_B_FV);
  ok(ciRed.authorized === false && !ciRed.signals.ci.passed, "(b) CI red -> REFUSED");
  ok(ciRed.reason.includes("ci"), "(b) deny reason must name ci");
  log.push(`  (b) prod, CI one check failing              -> authorized=${ciRed.authorized}`);

  const ciPending = run("prod", greenProdState({ checks: [{ name: "build", bucket: "pending" }] }), CLASS_B_FV);
  ok(ciPending.authorized === false, "(b) CI pending -> REFUSED (no pending allowed)");

  const ciEmpty = run("prod", greenProdState({ checks: [] }), CLASS_B_FV);
  ok(ciEmpty.authorized === false, "(b) CI no checks reported -> REFUSED (can't confirm green)");

  const notMerged = run("prod", greenProdState({ isAncestor: false }), CLASS_B_FV);
  ok(notMerged.authorized === false && !notMerged.signals.merge.passed, "(b) not merged to target -> REFUSED");
  ok(notMerged.reason.includes("merge"), "(b) deny reason must name merge");
  log.push(`  (b) prod, commit not ancestor of main       -> authorized=${notMerged.authorized}`);

  const fvNoReview = run("prod", greenProdState({ dirs: { "docs/verify": ["VERIFY-demo.md"], "docs/review": [], "docs": [] }, files: { "docs/verify/VERIFY-demo.md": VERIFIED_FM } }), CLASS_B_FV);
  ok(fvNoReview.authorized === false && !fvNoReview.signals.founder_review.passed, "(b) founder_verifiable but NO REVIEW -> REFUSED");
  ok(fvNoReview.reason.includes("founder_review"), "(b) deny reason must name founder_review");
  log.push(`  (b) prod, founder_verifiable + no REVIEW     -> authorized=${fvNoReview.authorized}`);

  const classCNoApproval = run("prod", greenProdState({ labels: [] }), CLASS_C);
  ok(classCNoApproval.authorized === false && !classCNoApproval.signals.class_c.passed, "(b) Class C but no founder-approved label -> REFUSED");
  ok(classCNoApproval.reason.includes("class_c"), "(b) deny reason must name class_c");
  log.push(`  (b) prod, Class C + no founder-approved      -> authorized=${classCNoApproval.authorized}`);

  // Class C, label present but applied by a NON-codeowner -> refused.
  const classCBadApprover = run("prod", greenProdState({ applier: "random-bot", owners: ["the-founder"] }), CLASS_C);
  ok(classCBadApprover.authorized === false, "(b) Class C label applied by non-CODEOWNER -> REFUSED");
  log.push(`  (b) prod, Class C approved by non-CODEOWNER  -> authorized=${classCBadApprover.authorized}`);

  // Class C, label applied by a CODEOWNER -> the class_c signal passes (whole thing green).
  const classCOk = run("prod", greenProdState({ applier: "the-founder", owners: ["the-founder"] }), CLASS_C);
  ok(classCOk.authorized === true && classCOk.signals.class_c.passed === true, "Class C approved by a CODEOWNER -> class_c passes");

  // empty lane (no declared actions) -> nothing in scope -> REFUSED.
  const emptyLane = run("prod", greenProdState({ lane: JSON.stringify({ actions: {} }) }), CLASS_B_FV);
  ok(emptyLane.authorized === false && !emptyLane.signals.lane_scope.passed, "(b) empty lane (no actions) -> REFUSED");
  ok(emptyLane.reason.includes("lane_scope"), "(b) deny reason must name lane_scope");
  log.push(`  (b) prod, deploy lane has no actions        -> authorized=${emptyLane.authorized}`);

  // FROZEN lane (founder kill-switch) -> REFUSED with the "deploy frozen" reason.
  const frozen = run("prod", greenProdState({ lane: FROZEN_LANE }), CLASS_B_FV);
  ok(frozen.authorized === false && !frozen.signals.lane_scope.passed, "(b) freeze.frozen=true -> REFUSED");
  ok(/deploy frozen by founder/i.test(frozen.signals.lane_scope.reason), "(b) frozen lane reason must say 'deploy frozen by founder'");
  log.push(`  (b) prod, deploy lane FROZEN (kill-switch)  -> authorized=${frozen.authorized}`);

  // POSITIVE: a present, NON-frozen lane with the action declared -> lane_scope passes
  // (the NEW model: presence + not-frozen is the policy; NO `ratified` gate required).
  const laneScopeOk = run("prod", greenProdState(), CLASS_B_FV, { action: "vercel-deploy-prod" });
  ok(laneScopeOk.authorized === true && laneScopeOk.signals.lane_scope.passed === true, "present non-frozen lane + declared action -> lane_scope passes (no ratified gate)");
  log.push(`  (+) prod, non-frozen lane + declared action -> authorized=${laneScopeOk.authorized} (lane_scope=${laneScopeOk.signals.lane_scope.passed})`);

  // action explicitly out of scope -> refused.
  const actionOOS = run("prod", greenProdState(), CLASS_B_FV, { action: "delete-everything" });
  ok(actionOOS.authorized === false, "(b) undeclared --action -> REFUSED (out of lane scope)");

  // action that hits a guard deny-substring -> refused.
  const guardLane = JSON.stringify({ freeze: { frozen: false }, actions: { danger: { cmd: "npm", args: ["run", "db:reset"] } }, guards: { deny_substrings: ["db:reset"] } });
  const actionGuard = run("prod", greenProdState({ lane: guardLane }), CLASS_B_FV, { action: "danger" });
  ok(actionGuard.authorized === false, "(b) --action hitting a guard substring -> REFUSED");

  // (c) DEV authorized on verify+CI ALONE, even though not merged / not reviewed / class C unapproved.
  const devHostile = greenProdState({ isAncestor: false, dirs: { "docs/verify": ["VERIFY-demo.md"], "docs/review": [], "docs": [] }, files: { "docs/verify/VERIFY-demo.md": VERIFIED_FM }, labels: [], lane: undefined });
  const devOk = run("dev", devHostile, CLASS_C); // class C, no review, not merged, no lane — but DEV ignores those
  ok(devOk.authorized === true, "(c) DEV authorizes on verify+CI alone (merge/review/class_c/lane NOT required)");
  ok(devOk.signals.merge.required === false && devOk.signals.merge.passed === false, "(c) DEV reports merge as not-required AND failing (transparency)");
  ok(devOk.signals.founder_review.required === false, "(c) DEV does not require founder_review");
  ok(devOk.signals.lane_scope.required === false, "(c) DEV does not require lane_scope");
  ok(validate(devOk).ok, `(c) dev result must satisfy the contract: ${validate(devOk).errors.join("; ")}`);
  log.push(`  (c) DEV, verify+CI green, all else failing   -> authorized=${devOk.authorized} (merge required=${devOk.signals.merge.required})`);

  // preview behaves like dev (same requirement set).
  const previewOk = run("preview", devHostile, CLASS_C);
  ok(previewOk.authorized === true, "(c) PREVIEW authorizes on verify+CI alone, like dev");

  // BUT dev still REFUSES when verify or CI is missing (it requires strictly those two).
  const devNoCi = run("dev", greenProdState({ ciThrow: true }), CLASS_A);
  ok(devNoCi.authorized === false, "(c) DEV still REFUSES when CI is unreadable (verify+CI ARE required)");
  const devNoVerify = run("dev", greenProdState({ dirs: { "docs/verify": [], "docs/review": [], "docs": [] }, files: {} }), CLASS_A);
  ok(devNoVerify.authorized === false, "(c) DEV still REFUSES when no VERIFY exists");

  // (d) UNREADABLE / MISSING INPUTS -> FAIL-CLOSED REFUSE.
  const ciUnreadable = run("prod", greenProdState({ ciThrow: true }), CLASS_B_FV);
  ok(ciUnreadable.authorized === false && !ciUnreadable.signals.ci.passed, "(d) gh CI unreadable -> REFUSED (fail-closed)");
  const gitUnreadable = run("prod", greenProdState({ changedFiles: null }), CLASS_B_FV); // changedFiles null = git unreadable
  ok(gitUnreadable.authorized === false, "(d) git changed-files unreadable -> verify fail-closed -> REFUSED");
  const ancestryUnknown = run("prod", greenProdState({ isAncestor: null }), CLASS_B_FV); // git merge-base errored
  ok(ancestryUnknown.authorized === false, "(d) ancestry indeterminate (git error) -> merge fail-closed -> REFUSED");
  const noClassification = run("prod", greenProdState(), null); // classification couldn't be computed
  ok(noClassification.authorized === false, "(d) classification unavailable -> founder_review/class_c fail-closed -> REFUSED");
  const laneMissing = run("prod", greenProdState({ lane: undefined }), CLASS_B_FV);
  ok(laneMissing.authorized === false, "(d) missing deploy lane -> lane_scope fail-closed -> REFUSED");
  const laneUnparseable = run("prod", greenProdState({ lane: "{ not json" }), CLASS_B_FV);
  ok(laneUnparseable.authorized === false && !laneUnparseable.signals.lane_scope.passed, "(d) unparseable deploy lane -> lane_scope fail-closed -> REFUSED");
  // a reader that throws must be caught -> fail-closed (inject a throwing reader at compose level)
  const throwReaders = { ...LIVE_READERS, verify: () => { throw new Error("boom"); } };
  const verifyThrew = evaluate("prod", { io: fakeIO(greenProdState()), opts: { pr: 42 }, classification: CLASS_B_FV }, throwReaders);
  ok(verifyThrew.authorized === false && verifyThrew.signals.verify.passed === false, "(d) a reader that THROWS -> signal fail-closed -> REFUSED");
  log.push(`  (d) any unreadable required input            -> authorized=false (fail-closed, proven 6 ways)`);

  // THE LOAD-BEARING ASSERTION: across EVERY refused case above, no required
  // signal that is unfinished ever coexists with authorized=true. validate()
  // would have caught it; assert it directly too.
  const refusedResults = [noVerify, notIndependent, staleVerify, ciRed, ciPending, ciEmpty, notMerged, fvNoReview, classCNoApproval, classCBadApprover, emptyLane, frozen, actionOOS, actionGuard, ciUnreadable, gitUnreadable, ancestryUnknown, noClassification, laneMissing, laneUnparseable, verifyThrew];
  for (const r of refusedResults) {
    ok(r.authorized === false, `refused-case must be authorized=false`);
    ok(validate(r).ok, `refused-case must satisfy the contract: ${validate(r).errors.join("; ")}`);
    const reqUnfinished = REQUIREMENTS[r.target].some((n) => r.signals[n].passed !== true);
    ok(reqUnfinished, "refused-case must have at least one required signal unfinished");
  }
  // and: NO authorized result has any required signal unfinished.
  for (const r of [aGreen, classCOk, devOk, previewOk, laneScopeOk]) {
    const reqUnfinished = REQUIREMENTS[r.target].filter((n) => r.signals[n].passed !== true);
    ok(reqUnfinished.length === 0, `authorized result MUST have zero unfinished required signals (had: ${reqUnfinished.join(", ")})`);
  }

  if (fails.length) {
    console.error("deployment-auth --self-test FAIL:");
    for (const f of fails) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.error("deployment-auth --self-test PASS — fail-closed deployment authorization (computed from SDLC state):");
  for (const l of log) console.error(l);
  console.error(
    "deployment-auth --self-test PASS — authorization is the EXACT conjunction of the target's REQUIRED governance " +
    "signals (dev/preview = {verify, ci}; prod = {verify, ci, merge, founder_review, class_c, lane_scope}); a higher " +
    "environment requires strictly MORE (prod ⊇ preview ⊇ dev). NO required-but-missing/unreadable/ambiguous step ever " +
    "yields authorized=true: a non-verified or non-independent or stale VERIFY, a red/pending/empty CI, an unmerged " +
    "commit, a founder_verifiable change with no REVIEW, a Class-C change with no founder-approved-by-CODEOWNER label, " +
    "a frozen/empty/out-of-scope/guard-hitting lane, OR any unreadable input (git/gh down, classification absent, a " +
    "throwing reader) all REFUSE (fail-closed). DEV deploys verified code on verify+CI alone, even when not merged or " +
    "reviewed. The inline-`#` frontmatter-comment strip is exercised (verified # comment reads `verified`)."
  );
  process.exit(0);
}

// =============================================================================
// CLI
// =============================================================================
function sameFile(p) { try { return p && p.startsWith("file:") ? fileURLToPath(p) : p; } catch { return p; } }
if (process.argv[1] && fileURLToPath(import.meta.url) === sameFile(process.argv[1])) {
  const argv = process.argv.slice(2);
  if (argv.includes("--self-test")) { selfTest(); }
  else {
    const flag = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
    const has = (name) => argv.includes(name);
    const sub = argv[0];
    if (sub !== "check") {
      console.error("USAGE: node deployment-auth.mjs check --target <dev|preview|prod> [--pr <n>] [--base <ref>] [--target-branch <ref>] [--lane <path>] [--action <class>] [--slice <name>] [--sha <commit>] [--explain] [--json]");
      console.error("       node deployment-auth.mjs --self-test");
      process.exit(2);
    }
    const target = flag("--target");
    if (!TARGETS.includes(target)) {
      console.error(`deployment-auth: --target must be one of ${TARGETS.join("|")} (got "${target || ""}"). Fail-closed.`);
      process.exit(2);
    }
    const opts = {
      target,
      pr: flag("--pr") ? Number(flag("--pr")) : null,
      base: flag("--base") || "origin/main",
      targetBranch: flag("--target-branch") || "origin/main",
      lane: flag("--lane") || null,
      action: flag("--action") || null,
      slice: flag("--slice") || null,
      sha: flag("--sha") || null,
      cwd: process.cwd(),
    };

    let result;
    try {
      result = runCheck(opts);
    } catch (e) {
      // ANY uncaught failure is fail-closed: emit a REFUSED result, never authorize.
      result = {
        authorized: false, target, reason: `REFUSED for ${target}: deployment-auth could not evaluate (${e.message}) — fail-closed.`,
        signals: Object.fromEntries(SIGNAL_NAMES.map((n) => [n, { required: REQUIREMENTS[target].includes(n), passed: REQUIREMENTS[target].includes(n) ? false : null, reason: `${n}: not evaluated (top-level failure) — fail-closed.`, evidence: null }])),
        checkedAt: new Date().toISOString(), evidence: { error: e.message },
      };
    }

    // self-check: the emitted result MUST satisfy its own contract (including the
    // safety invariant). If it does not, that is itself a refuse-worthy bug.
    const v = validate(result);
    if (!v.ok) {
      const safe = { authorized: false, target, reason: `REFUSED for ${target}: result failed its own contract (${v.errors.join("; ")}) — fail-closed.`, signals: result.signals, checkedAt: result.checkedAt, evidence: result.evidence };
      process.stdout.write(JSON.stringify(safe, null, has("--json") ? 2 : 0) + "\n");
      if (has("--explain")) explain(safe);
      process.exit(1);
    }

    if (has("--explain")) explain(result);
    process.stdout.write(JSON.stringify(result, null, has("--json") ? 2 : 0) + "\n");
    process.exit(result.authorized ? 0 : 1);
  }
}
