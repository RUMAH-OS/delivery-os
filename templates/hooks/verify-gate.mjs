#!/usr/bin/env node
// Delivery OS — verify-gate (Governance §12). The ONLY enforcement element that fires
// without the orchestrator choosing to. Cross-platform (Node ESM, no bash dependency).
//
//   node .claude/hooks/verify-gate.mjs <mode>
//   mode = pre-commit | post-write | stop   (dispatched from .claude/settings.json)
//
// It blocks a slice from advancing when IMPLEMENTATION files changed without a fresh,
// passing, INDEPENDENT docs/verify/VERIFY-<slice>.md. It checks that such an artifact
// EXISTS and is well-formed — it cannot prove the verification was truthful (see §12
// "Honest limit"). The committed .githooks/pre-push is the model-independent backstop.
//
// v4 additions (Governance §12/§14):
//  - WRITE-SCOPING: impl changes arriving TOGETHER with tests/e2e/evals changes require the
//    VERIFY artifact to carry a QA-signed `test_pins_amended_by:` (incident 8: the old NONIMPL
//    regex exempted exactly where the author/QA boundary lives).
//  - PROBE RE-EXECUTION: if the artifact declares `machine_probe:`, the gate re-runs it and the
//    artifact only counts while the probe exits 0.
//  - §14 CONTINUOUS-DELIVERY TRIGGERS (pre-push): review-artifact detector + N-merges backstop,
//    HARD-BLOCK (founder ruling F7) — the release-tag trigger alone never fired in the field.
//
// Bypass (loud, logged, deliberate): set DELIVERY_OS_GATE_BYPASS=1 to allow through.
// Use only during bootstrap/debugging — every bypass prints a visible warning.

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { join } from "node:path";

const MODE = process.argv[2] || "stop";
const ROOT = process.cwd();
const STATE = join(ROOT, ".claude", ".verify-state.json");
const CONFIG = join(ROOT, ".claude", ".verify-config.json");
const VERIFY_DIRS = ["docs/verify", "docs"];

// Implementation surfaces the gate protects. Everything else (tests, docs, evals, build output) is exempt.
// MONOREPO-AWARE by default: root-level src/app/lib/api/migrations/db AND the whole apps/<name>/ and
// packages/<name>/ trees (Next.js / Turborepo / pnpm-workspace layouts — e.g. apps/web/lib, apps/worker/src).
// Errs toward over-protection (a config change in a package needs a VERIFY) because fail-closed beats
// silent under-protection. A consumer whose implementation lives elsewhere (e.g. THIS framework, under
// scripts/ + templates/) extends the surface via .claude/.verify-config.json { "impl_extra": [...] }.
const IMPL_BASE = /^(src|app|lib|api|migrations|db)\/|^(apps|packages|services)\/[^/]+\//;
const NONIMPL = /(^|\/)(tests?|e2e|evals|docs|\.claude|node_modules|dist|build|\.next|out|coverage)\/|\.(test|spec)\.|\.md$/;
function loadImplExtra() {
  try { const c = JSON.parse(readFileSync(CONFIG, "utf8")); return Array.isArray(c.impl_extra) ? c.impl_extra : []; }
  catch { return []; }
}
const IMPL_EXTRA = loadImplExtra();
const isImpl = (f) => IMPL_BASE.test(f) || IMPL_EXTRA.some((p) => f.startsWith(p));

const RAWIN = (() => { try { return readFileSync(0, "utf8"); } catch { return ""; } })();
const readStdin = () => { try { return JSON.parse(RAWIN); } catch { return {}; } };
const hasGit = () => { try { execSync("git rev-parse --git-dir", { stdio: "ignore" }); return true; } catch { return false; } };
const mtime = (p) => { try { return statSync(p).mtimeMs; } catch { return 0; } };

function readState() { try { return JSON.parse(readFileSync(STATE, "utf8")); } catch { return { baseline_ts: 0 }; } }
function writeState(s) { try { writeFileSync(STATE, JSON.stringify(s)); } catch { /* non-fatal */ } }

// --- which implementation files changed since the last verification baseline ---
function changedFiles() {
  let files = [];
  if (hasGit()) {
    try {
      const out = execSync("git status --porcelain --untracked-files=all", { encoding: "utf8" });
      files = out.split("\n").map((l) => l.slice(3).trim()).filter(Boolean);
    } catch { /* fall through */ }
  } else {
    const base = readState().baseline_ts || 0;
    files = walk(ROOT).filter((f) => mtime(f) > base).map((f) => f.slice(ROOT.length + 1).replace(/\\/g, "/"));
  }
  return files;
}
function changedImpl() { return changedFiles().filter((f) => isImpl(f) && !NONIMPL.test(f)); }
// v4 write-scoping (B2): the QA-owned trees the boundary lives in.
const TESTTREE = /(^|\/)(tests?|e2e|evals)\//;
function changedTests() { return changedFiles().filter((f) => TESTTREE.test(f)); }

function walk(dir, acc = []) {
  let entries = [];
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return acc; }
  for (const e of entries) {
    if (/^(node_modules|\.git|dist|build|\.claude)$/.test(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, acc); else acc.push(p);
  }
  return acc;
}

// --- find a fresh, passing, independent VERIFY artifact ---
function fmText(txt) {
  const m = (txt || "").match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const fm = {};
  if (m) for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([a-z_]+):\s*(.+?)\s*$/i);
    if (kv) fm[kv[1].toLowerCase()] = kv[2].replace(/^["']|["']$/g, "");
  }
  return fm;
}
function frontmatter(file) {
  let txt = ""; try { txt = readFileSync(file, "utf8"); } catch { return {}; }
  const m = txt.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const fm = {};
  if (m) for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([a-z_]+):\s*(.+?)\s*$/i);
    if (kv) fm[kv[1].toLowerCase()] = kv[2].replace(/^["']|["']$/g, "");
  }
  return fm;
}

// v4 (B3): if the artifact declares a machine-readable probe, the gate RE-EXECUTES it — the
// artifact only counts while the probe still exits 0. `machine_probe: none — <reason>` is honest opt-out.
function probeHolds(fm, path) {
  const probe = (fm.machine_probe || "").trim();
  if (!probe || /^none\b/i.test(probe)) return true;
  try { execSync(probe, { stdio: "ignore", timeout: 120000 }); return true; }
  catch {
    process.stderr.write(`[verify-gate] machine_probe of ${path} FAILED on re-execution ("${probe}") — the artifact no longer counts.\n`);
    return false;
  }
}

function freshPassArtifact(impl, tests = []) {
  const newest = Math.max(0, ...impl.map((f) => mtime(join(ROOT, f))));
  for (const d of VERIFY_DIRS) {
    let names = []; try { names = readdirSync(join(ROOT, d)); } catch { continue; }
    for (const n of names) {
      if (!/^VERIFY-.*\.md$/i.test(n)) continue;
      const p = join(ROOT, d, n);
      if (mtime(p) < newest) continue;                       // stale → does not count
      const fm = frontmatter(p);
      const passing = String(fm.verify_status).toLowerCase() === "verified";
      const independent = fm.verifier && fm.author && fm.verifier !== fm.author; // best-effort
      // v4 write-scoping (B2): impl + test-tree changes together need the QA-signed acknowledgment.
      if (tests.length && !fm.test_pins_amended_by) {
        if (passing && independent) process.stderr.write(`[verify-gate] ${d}/${n} ignored: tests/ changed alongside implementation but the artifact carries no test_pins_amended_by (QA-signed) line — authors may not quietly amend QA pins (Governance §12 write-scoping).\n`);
        continue;
      }
      if (passing && independent && probeHolds(fm, `${d}/${n}`)) return { path: `${d}/${n}`, fm };
    }
  }
  return null;
}

// --- output helpers (Claude Code hook protocol) ---
const emit = (o) => { process.stdout.write(JSON.stringify(o)); process.exit(0); };
const warn = (msg) => { process.stderr.write(`[verify-gate] ${msg}\n`); process.exit(0); };

function releaseBlocked(tag) {
  return `BLOCKED by Delivery OS — OS Feedback Loop (Governance §14).\n` +
    `Release "${tag}" cannot complete without an OS-feedback triage: docs/feedback/OS-FEEDBACK-${tag}.md.\n` +
    `Answer three questions (template: delivery-os/templates/OS-FEEDBACK.md.template):\n` +
    `  1. Were any framework-level lessons discovered this cycle?\n` +
    `  2. Are there any OS Candidates?\n` +
    `  3. Route each lesson → project knowledge / ecosystem architecture / Delivery OS.\n` +
    `"No framework lessons discovered." is a VALID answer — but the review itself must exist.`;
}

function blocked(impl) {
  const list = impl.slice(0, 6).join(", ") + (impl.length > 6 ? ` …(+${impl.length - 6})` : "");
  return `BLOCKED by Delivery OS verify-gate (Governance §12).\n` +
    `Implementation files changed (${list}) but no fresh, passing, INDEPENDENT ` +
    `docs/verify/VERIFY-<slice>.md exists (verify_status: verified, author ≠ verifier, newer than the code).\n` +
    `This is "ready for QA" — not "done". Run an INDEPENDENT verifier on the running thing ` +
    `(template: delivery-os/templates/VERIFY.md.template), capture real execution evidence, then proceed.`;
}

// ---- main ----
const input = readStdin();

if (process.env.DELIVERY_OS_GATE_BYPASS === "1") {
  warn("⚠ DELIVERY_OS_GATE_BYPASS=1 — verify-gate skipped. This bypass is logged. Remove before shipping.");
}

try {
  if (MODE === "post-write") {
    // never blocks (the write already happened); refresh baseline + advisory warn
    const impl = changedImpl();
    writeState({ baseline_ts: Date.now() });
    if (impl.length && !freshPassArtifact(impl))
      warn(`implementation changed — a fresh docs/verify/VERIFY-<slice>.md (verify_status: verified) is now required before commit/done.`);
    process.exit(0);
  }

  if (MODE === "pre-commit") {
    const cmd = input?.tool_input?.command || "";
    if (!/\bgit\s+(commit|push)\b/.test(cmd)) process.exit(0); // only guard commit/push
    const impl = changedImpl();
    if (impl.length && !freshPassArtifact(impl, changedTests()))
      emit({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: blocked(impl) } });
    process.exit(0);
  }

  if (MODE === "stop") {
    const impl = changedImpl();
    if (impl.length && !freshPassArtifact(impl, changedTests())) emit({ decision: "block", reason: blocked(impl) });
    process.exit(0);
  }

  if (MODE === "pre-push") {
    // git feeds ref lines on stdin: "<localRef> <localSha> <remoteRef> <remoteSha>".
    // The model-independent backstop: inspect the COMMITTED push RANGE (not the working tree),
    // so a change committed via bare git and pushed with a clean tree is still caught.
    const Z = /^0+$/;
    const sh = (cmd) => { try { return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); } catch { return ""; } };
    const changed = new Set(); const tags = []; let tip = "HEAD";
    for (const line of RAWIN.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)) {
      const [localRef, localSha, , remoteSha] = line.split(/\s+/);
      if (!localSha || Z.test(localSha)) continue;            // ref deletion
      tip = localSha;
      const tagm = (localRef || "").match(/^refs\/tags\/(.+)$/);
      if (tagm) tags.push({ name: tagm[1], sha: localSha });   // a tag = a release (OS Feedback Loop trigger)
      let files = "";
      if (remoteSha && !Z.test(remoteSha)) files = sh(`git diff --name-only ${remoteSha} ${localSha}`);
      else {                                                   // new ref: commits not already on a remote
        const commits = sh(`git rev-list ${localSha} --not --remotes`).split("\n").map((s) => s.trim()).filter(Boolean);
        for (const c of commits) files += sh(`git show --name-only --pretty=format: ${c}`) + "\n";
      }
      files.split("\n").map((s) => s.trim()).filter(Boolean).forEach((f) => changed.add(f));
    }
    // RELEASE TRIGGER (OS Feedback Loop, Governance §14): a release (a pushed tag) cannot complete
    // without an OS-feedback triage existing in the tagged tree — the mechanism creates the
    // opportunity to learn; the triage's content is human judgment ("no framework lessons" is valid).
    for (const t of tags) {
      // require THIS release's own triage (tag-named) — a stale OS-FEEDBACK from a prior release
      // must not satisfy a new one ("each release asks its own question").
      const named = sh(`git cat-file -t ${t.sha}:docs/feedback/OS-FEEDBACK-${t.name}.md`).trim() === "blob";
      if (!named) { process.stderr.write(releaseBlocked(t.name) + "\n"); process.exit(1); }
    }
    const all = [...changed];

    // §14 v4 — REVIEW-ARTIFACT DETECTOR (HARD-BLOCK, F7). Release tags never fired in the field;
    // continuous projects mint their release-class moments as review artifacts instead. A push that
    // adds/changes one must also carry an OS-feedback triage. ("No framework lessons" remains valid.)
    const isReviewClass = (f) => {
      if (/(^|\/)(\.claude|templates|node_modules)\//.test(f)) return false;  // installed copies/templates are not events
      const base = f.split("/").pop() || "";
      return /(^|\/)docs\/reviews\//i.test(f)
        || /^CHANGELOG-v\d/i.test(base) || base === "VERSION"
        || (/\.md$/i.test(base) && /(RETROSPECTIVE|POSTMORTEM|ARCHITECTURE-REVIEW|LEARNING-REVIEW|PRODUCTION-READINESS)/i.test(base));
    };
    const reviewArtifacts = all.filter(isReviewClass);
    const carriesTriage = all.some((f) => /(^|\/)docs\/feedback\/OS-FEEDBACK-.+\.md$/i.test(f));
    if (reviewArtifacts.length && !carriesTriage) {
      process.stderr.write(
        `BLOCKED by Delivery OS — OS Feedback Loop (Governance §14, review-artifact detector, fail-closed per F7).\n` +
        `This push carries review-class artifact(s): ${reviewArtifacts.slice(0, 4).join(", ")}${reviewArtifacts.length > 4 ? " …" : ""}\n` +
        `but no docs/feedback/OS-FEEDBACK-<event>.md. A review that files no triage is the recorded failure mode\n` +
        `this detector closes. Template: delivery-os/templates/OS-FEEDBACK.md.template — "No framework lessons\n` +
        `discovered." is a VALID answer, but the triage must exist in the same push.\n`);
      process.exit(1);
    }

    const impl = all.filter((f) => isImpl(f) && !NONIMPL.test(f));
    if (!impl.length) process.exit(0);

    // §14 v4 — N-MERGES BACKSTOP (HARD-BLOCK, F7): too many commits since the last triage means the
    // learning loop has silently stopped firing; the next implementation push re-opens it.
    let cfgPush = {}; try { cfgPush = JSON.parse(readFileSync(CONFIG, "utf8")); } catch {}
    const N = Number.isFinite(+cfgPush.feedback_backstop_commits) ? +cfgPush.feedback_backstop_commits : 30;
    if (N > 0 && !carriesTriage) {
      const lastFb = sh(`git log -1 --format=%H ${tip} -- docs/feedback`).trim();
      const range = lastFb ? `${lastFb}..${tip}` : tip;
      const count = parseInt(sh(`git rev-list --count ${range}`).trim() || "0", 10);
      if (count > N) {
        process.stderr.write(
          `BLOCKED by Delivery OS — OS Feedback Loop (Governance §14, N-merges backstop, fail-closed per F7).\n` +
          `${count} commits since the last docs/feedback/ triage (backstop: ${N}; configure via\n` +
          `.claude/.verify-config.json {"feedback_backstop_commits": N}). File an OS-feedback triage in this\n` +
          `push — "No framework lessons discovered." is a valid answer, but the triage must exist.\n`);
        process.exit(1);
      }
    }
    // a verified, independent VERIFY artifact must be part of the pushed tree (read at the tip commit)
    const verifyPaths = all.filter((f) => /VERIFY-.*\.md$/i.test(f));
    let ok = false;
    for (const vp of verifyPaths) {
      const fm = fmText(sh(`git show ${tip}:${vp}`));
      if (String(fm.verify_status).toLowerCase() === "verified" && fm.author && fm.verifier && fm.author !== fm.verifier) { ok = true; break; }
    }
    if (!ok) { process.stderr.write(blocked(impl) + "\n"); process.exit(1); }
    process.exit(0);
  }
} catch (err) {
  // fail-closed on commit/stop (honest failure, Governance §5); fail-open on post-write
  const reason = `verify-gate could not evaluate (${err?.message || err}). Failing closed — verification cannot be confirmed.`;
  if (MODE === "pre-commit") emit({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason } });
  if (MODE === "stop") emit({ decision: "block", reason });
  warn(reason);
}
process.exit(0);
