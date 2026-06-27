#!/usr/bin/env node
// =============================================================================
// Delivery OS — review-trigger (the CAPABILITY/ARCHITECTURE-CLASS review gate).
// Zero-dep, Node ESM. This is the FAIL-CLOSED enforcement half of ADR-003's L2
// trigger: where `learning-trigger.mjs` only NAMES the level (SHADOW — classify +
// log), this module turns an L2 classification into a HARD REQUIREMENT — the push
// of a capability / architecture / integration / significant-production change must
// CARRY its reviews. It mirrors the §14 review-artifact detector inside verify-gate
// (the OS-FEEDBACK block): a mechanical trigger that creates the opportunity to
// review; the reviews' CONTENT stays human judgment.
// =============================================================================
// THE RECORDED MISS THIS CLOSES (founder complaint, 2026-06-25): the Admin→PLOS
// invoice-delivery rework — a NEW immutable-package contract, a cross-system seam,
// prod migrations to the financial SoR — shipped and NEITHER a Founder Review NOR a
// Learning Review fired, because the only ENFORCED trigger was count-based (N-merges)
// + release-tag. The change was architecturally major but mechanically invisible.
// `learning-trigger` now classifies it L2 (class-C + integration markers); THIS module
// makes that L2 BIND: the three reviews must exist in the push, or the push is blocked.
//
// THE THREE REVIEWS (the founder's named set). On an L2 change the push must carry:
//   1. Foundation Review — are the foundations still internally consistent + valid?
//      (templates/FOUNDATION-REVIEW.md.template)
//   2. Founder Review    — the zero-tech, founder-verifiable review package.
//      (templates/FOUNDER-REVIEW.md.template — or a founder-review-package REVIEW-*.md)
//   3. Learning Review   — experience → routed capability (the §14 triage / retro).
//      (templates/LEARNING-REVIEW.md.template — or an OS-FEEDBACK-*.md / RETROSPECTIVE-*.md)
// Each must be FRESH (changed in THIS push — "each change asks its own questions",
// the OS-FEEDBACK "tag-named" rule generalized) and well-formed (frontmatter + a
// non-empty verdict/answer). Existence + structure is mechanizable; whether a review
// is TRUTHFUL (not rubber-stamped) is the same honest limit §12 states — flagged, not
// claimed (see HONEST LIMIT below).
//
// POSTURE (`.claude/.verify-config.json → review_trigger`): "enforce" (default — the
// founder's live request) | "shadow" (classify + print would-block, never block —
// the ADR-003 SHADOW posture) | "off". The SHADOW→ENFORCE flip IS a founder governance
// decision; this module makes the posture an explicit, single-switch config.
//
// FAIL-CLOSED, fail-TOWARD-review: any throw / unreadable tree / unloadable classifier
// → treat as L2-and-unsatisfied (block under enforce). The safe error is to ask for a
// review that turns out empty, never to skip one that was owed.
//
//   node review-trigger.mjs gate  --tip <sha> [--files-stdin | --files a,b,c]
//   node review-trigger.mjs check [--changed | --base REF]   # local advisory (never blocks)
//   node review-trigger.mjs --self-test
// =============================================================================

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

// =============================================================================
// THE REQUIRED REVIEW FAMILIES (data, not code). Each review may be satisfied by
// ANY artifact in its family (reuse-first: an existing founder-review-package
// REVIEW-*.md or an OS-FEEDBACK triage counts — we do not force a parallel format).
// `valid(fm)` is the anti-rubber-stamp floor: frontmatter present + a dated review +
// a non-empty verdict/answer/reviewer field.
// =============================================================================
const nonEmpty = (v) => typeof v === "string" && v.trim() && !/^<.*>$/.test(v.trim());
export const REVIEWS = {
  foundation: {
    label: "Foundation Review",
    template: "templates/FOUNDATION-REVIEW.md.template",
    globs: ["**/FOUNDATION-REVIEW*.md"],
    valid: (fm) => nonEmpty(fm.date) && (nonEmpty(fm.verdict) || nonEmpty(fm.status)),
    why: "are the foundations the change builds on still internally consistent + valid? (blind lenses: reviewer-critic + lead-architect)",
  },
  founder: {
    label: "Founder Review",
    template: "templates/FOUNDER-REVIEW.md.template",
    globs: ["**/FOUNDER-REVIEW*.md", "docs/review/REVIEW-*.md"],
    valid: (fm) => nonEmpty(fm.date) && (nonEmpty(fm.reviewer) || nonEmpty(fm.review_path) || nonEmpty(fm.pass_fail) || nonEmpty(fm.verdict)),
    why: "the zero-technical-knowledge package the founder can act on alone (REAL urls · ✅/❌ checklist · impl detail hidden)",
  },
  learning: {
    label: "Learning Review",
    template: "templates/LEARNING-REVIEW.md.template",
    globs: ["**/LEARNING-REVIEW*.md", "docs/feedback/OS-FEEDBACK-*.md", "docs/RETROSPECTIVE-*.md", "**/FOUNDER-LEARNING*.md"],
    valid: (fm) => nonEmpty(fm.date) && (nonEmpty(fm.event) || nonEmpty(fm.triaged_by) || nonEmpty(fm.verdict) || nonEmpty(fm.milestone)),
    why: "experience → routed CAPABILITY (the §14 triage / retro — 'No framework lessons.' is a valid answer, but the review must exist)",
  },
};

// =============================================================================
// glob matching (gitignore-ish; pure) — the same primitive learning-trigger uses.
// =============================================================================
function globToRegex(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") { i++; if (glob[i + 1] === "/") { i++; re += "(?:.*/)?"; } else re += ".*"; }
      else re += "[^/]*";
    } else if (c === "?") re += "[^/]";
    else if (/[.+^${}()|[\]\\]/.test(c)) re += "\\" + c;
    else re += c;
  }
  return new RegExp("^" + re + "$", "i");
}
function matchGlob(path, glob) {
  const p = String(path == null ? "" : path).replace(/\\/g, "/").replace(/^\.\//, "");
  const g = String(glob || "");
  const target = g.includes("/") ? p : p.split("/").pop();
  return globToRegex(g).test(target);
}
const matchAny = (path, globs) => (globs || []).some((g) => matchGlob(path, g));

// --- frontmatter parse (matches verify-gate's fmText) ---
export function fmText(txt) {
  const m = (txt || "").match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const fm = {};
  if (m) for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([a-z_]+):\s*(.+?)\s*$/i);
    if (kv) fm[kv[1].toLowerCase()] = kv[2].replace(/^["']|["']$/g, "");
  }
  return fm;
}

// =============================================================================
// POSTURE config
// =============================================================================
export function posture(cwd = process.cwd()) {
  try {
    const cfg = JSON.parse(readFileSync(join(cwd, ".claude", ".verify-config.json"), "utf8"));
    const p = String(cfg.review_trigger || "").toLowerCase();
    if (p === "shadow" || p === "off" || p === "enforce") return p;
  } catch { /* fall through */ }
  return "enforce"; // the founder's live default; flip to "shadow"/"off" in .verify-config.json
}

// =============================================================================
// THE CLASSIFIER — REUSE learning-trigger.level() (defensive import from the
// candidate install locations, mirroring verify-gate's verify-fingerprint loader).
// If it cannot be loaded, fall back to a MINIMAL embedded mirror that fails TOWARD
// review (so the gate still binds when the canonical classifier is not installed).
// =============================================================================
async function loadLevel(cwd) {
  for (const cand of [
    join(HERE, "learning-trigger.mjs"),                          // sibling (this install)
    join(cwd, ".claude", "tools", "learning-trigger.mjs"),
    join(cwd, ".claude", "os", "tools", "learning-trigger.mjs"),
    join(cwd, "templates", "tools", "learning-trigger.mjs"),     // framework dogfood
  ]) {
    if (!existsSync(cand)) continue;
    try {
      const mod = await import(pathToFileURL(cand).href);
      if (typeof mod.level === "function") return { level: mod.level, source: cand };
    } catch { /* try next */ }
  }
  return { level: embeddedLevelFallback, source: "embedded-fallback (learning-trigger not loadable — fail toward review)" };
}
// Minimal mirror: the architecture/capability/integration/decision path markers + class-C heuristic.
// Intentionally over-eager (false-L2 is the safe error); only used when the canonical classifier is absent.
function embeddedLevelFallback(input = {}) {
  const paths = (input.changedFiles || []).map((f) => (typeof f === "string" ? f : f && f.path)).filter(Boolean);
  const archRe = /(^|\/)(migrations|contracts|seam|billing|payment|invoic|pricing|auth|rls)(\/|-|\.|$)|(^|\/)(skills\/[^/]+\/SKILL\.md|agents\/|adr\/ADR-|DECISIONS\.md|CHANGELOG-v|VERSION$|incidents\/)|(^|\/)(core|proposals)\/|(^|\/)(verify-gate|change-classify|learning-trigger|review-trigger|census-detector)\.mjs$/i;
  const hit = paths.find((p) => archRe.test(String(p).replace(/\\/g, "/")));
  return hit
    ? { level: "L2", reasons: [`embedded-fallback: architecture/capability/integration path (${hit})`], learning_expected: true }
    : { level: "L0", reasons: ["embedded-fallback: no architecture/capability marker matched"], learning_expected: false };
}

// =============================================================================
// TREE READERS — the gate reads the PUSHED tree (git show <tip>:<path>); the local
// `check` reads the working tree. Both expose the same {list, read} shape.
// =============================================================================
function git(args, cwd) {
  try { return execFileSync("git", args, { encoding: "utf8", cwd, stdio: ["ignore", "pipe", "ignore"] }); }
  catch { return ""; }
}
function treeReaderAtCommit(tip, cwd) {
  const list = git(["ls-tree", "-r", "--name-only", tip], cwd).split("\n").map((s) => s.trim()).filter(Boolean);
  return { list, read: (p) => git(["show", `${tip}:${p}`], cwd) };
}
function workingTreeReader(cwd) {
  const list = [];
  (function walk(dir) {
    let entries = [];
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (/^(node_modules|\.git|dist|build)$/.test(e.name)) continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else list.push(p.slice(cwd.length + 1).replace(/\\/g, "/"));
    }
  })(cwd);
  return { list, read: (p) => { try { return readFileSync(join(cwd, p), "utf8"); } catch { return ""; } } };
}

// =============================================================================
// THE CORE CHECK (pure given a tree reader). Returns, for each required review,
// whether a FRESH (in changedFiles) + WELL-FORMED artifact exists.
//   changedFiles: string[] — the push range / working change (freshness scope)
//   tree: { list, read }
// =============================================================================
export function evaluateReviews(changedFiles, tree) {
  const changed = new Set((changedFiles || []).map((f) => String(f).replace(/\\/g, "/")));
  const out = {};
  for (const key of Object.keys(REVIEWS)) {
    const fam = REVIEWS[key];
    // candidates: in the tree, match a family glob, AND fresh (part of THIS change).
    const candidates = (tree.list || [])
      .map((p) => String(p).replace(/\\/g, "/"))
      .filter((p) => matchAny(p, fam.globs) && changed.has(p));
    let satisfiedBy = null;
    for (const p of candidates) {
      const fm = fmText(tree.read(p));
      if (fam.valid(fm)) { satisfiedBy = p; break; }
    }
    out[key] = { label: fam.label, template: fam.template, why: fam.why, satisfied: !!satisfiedBy, satisfiedBy, candidates };
  }
  return out;
}

function blockMessage(levelResult, reviews) {
  const missing = Object.values(reviews).filter((r) => !r.satisfied);
  const lines = [];
  lines.push(`BLOCKED by Delivery OS — Review-Class Trigger (Governance §14 · ADR-003 L2).`);
  lines.push(`This push is a CAPABILITY / ARCHITECTURE / INTEGRATION / SIGNIFICANT-PRODUCTION change`);
  lines.push(`(${levelResult.reasons[0]}).`);
  lines.push(`Such a change must AUTO-trigger the three reviews — and ${missing.length} ${missing.length === 1 ? "is" : "are"} missing from this push:`);
  for (const r of missing) {
    lines.push(`  ✗ ${r.label} — ${r.why}`);
    lines.push(`      add a FRESH, well-formed artifact (template: delivery-os/${r.template})`);
    lines.push(`      matched families: ${REVIEWS[Object.keys(REVIEWS).find((k) => REVIEWS[k].label === r.label)].globs.join(" · ")}`);
  }
  const have = Object.values(reviews).filter((r) => r.satisfied);
  if (have.length) lines.push(`  ✓ present: ${have.map((r) => `${r.label} (${r.satisfiedBy})`).join(", ")}`);
  lines.push(``);
  lines.push(`Each review must be FRESH (changed in THIS push — each change asks its own questions) and carry`);
  lines.push(`frontmatter with a date + a non-empty verdict/answer. "No framework lessons." is a VALID Learning`);
  lines.push(`Review answer — but the review must exist. This is a bug-fix/UI/maintenance exemption ONLY when the`);
  lines.push(`change is class A/B and non-architectural (then it never reaches this gate).`);
  lines.push(`Bypass (loud, logged): DELIVERY_OS_GATE_BYPASS=1 git push  ·  posture: .claude/.verify-config.json → review_trigger`);
  return lines.join("\n");
}

// =============================================================================
// GATE MODE (called by verify-gate pre-push). Fail-closed.
// =============================================================================
async function runGate(argv) {
  const cwd = process.cwd();
  const pos = posture(cwd);
  if (pos === "off") { process.stderr.write(`[review-trigger] posture=off — review-class trigger disabled.\n`); process.exit(0); }

  const flag = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
  const tip = flag("--tip") || "HEAD";
  let changedFiles = [];
  if (argv.includes("--files-stdin")) {
    let raw = ""; try { raw = readFileSync(0, "utf8"); } catch { raw = ""; }
    changedFiles = raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  } else if (flag("--files")) {
    changedFiles = flag("--files").split(",").map((s) => s.trim()).filter(Boolean);
  } else {
    changedFiles = git(["diff", "--name-only", `${tip}^`, tip], cwd).split("\n").map((s) => s.trim()).filter(Boolean);
  }

  try {
    if (!changedFiles.length) process.exit(0);
    const { level } = await loadLevel(cwd);
    const lvl = level({ changedFiles });
    if (lvl.level !== "L2") {
      process.stderr.write(`[review-trigger] ${lvl.level} (no full review owed): ${lvl.reasons[0]}\n`);
      process.exit(0);
    }
    const tree = treeReaderAtCommit(tip, cwd);
    const reviews = evaluateReviews(changedFiles, tree);
    const missing = Object.values(reviews).filter((r) => !r.satisfied);
    if (!missing.length) {
      process.stderr.write(`[review-trigger] L2 satisfied — all three reviews present + fresh in the push.\n`);
      process.exit(0);
    }
    const msg = blockMessage(lvl, reviews);
    if (pos === "shadow") {
      process.stderr.write(`[review-trigger] SHADOW (would block; not blocking — ADR-003 posture):\n${msg}\n`);
      process.exit(0);
    }
    process.stderr.write(msg + "\n");
    process.exit(1);
  } catch (e) {
    // fail-closed: an evaluation failure on an enforced gate is a BLOCK (fail toward review).
    const msg = `[review-trigger] could not evaluate the review-class trigger (${e && e.message}). ` +
      `Failing closed (fail toward review) — a review owed is never skipped on an error.`;
    if (pos === "shadow") { process.stderr.write(`SHADOW: ${msg}\n`); process.exit(0); }
    process.stderr.write(msg + "\n");
    process.exit(1);
  }
}

// =============================================================================
// CHECK MODE (local advisory — NEVER blocks; for the orchestrator / stop hook).
// =============================================================================
async function runCheck(argv) {
  const cwd = process.cwd();
  const flag = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
  const base = flag("--base");
  const range = base ? [`${base}...HEAD`] : [];
  const changedFiles = git(["diff", "--name-only", ...range], cwd).split("\n").map((s) => s.trim()).filter(Boolean);
  const { level, source } = await loadLevel(cwd);
  const lvl = level({ changedFiles });
  process.stderr.write(`[review-trigger] check (classifier: ${source})\n  level: ${lvl.level} — ${lvl.reasons[0]}\n`);
  if (lvl.level === "L2") {
    const reviews = evaluateReviews(changedFiles, workingTreeReader(cwd));
    for (const r of Object.values(reviews))
      process.stderr.write(`  ${r.satisfied ? "✓" : "✗"} ${r.label}${r.satisfied ? ` (${r.satisfiedBy})` : ` — needed (template ${r.template})`}\n`);
    process.stderr.write(`  ADVISORY ONLY — the binding check is the pre-push gate (posture=${posture(cwd)}).\n`);
  }
  process.exit(0); // advisory never blocks
}

// =============================================================================
// SELF-TEST (pure; no IO except a synthetic in-memory tree).
// =============================================================================
function selfTest() {
  const fails = [];
  const ok = (c, m) => { if (!c) fails.push(m); };

  // a fake tree: a set of {path: content}
  const mk = (files) => ({ list: Object.keys(files), read: (p) => files[p] || "" });
  const FOUND = "---\nreview: foundation\ndate: 2026-06-26\nverdict: STABLE\n---\n# Foundation Review\n";
  const FOUNDER = "---\nreview: founder\ndate: 2026-06-26\nreviewer: founder\npass_fail: PASS\n---\n# Founder Review\n";
  const LEARN = "---\nevent: architecture-review\ndate: 2026-06-26\ntriaged_by: lead\n---\n# Learning Review\n";

  // ALL THREE present + fresh -> all satisfied.
  {
    const changed = ["src/server/billing/x.ts", "docs/review/FOUNDATION-REVIEW-x.md", "docs/review/FOUNDER-REVIEW-x.md", "docs/feedback/OS-FEEDBACK-x.md"];
    const tree = mk({
      "docs/review/FOUNDATION-REVIEW-x.md": FOUND,
      "docs/review/FOUNDER-REVIEW-x.md": FOUNDER,
      "docs/feedback/OS-FEEDBACK-x.md": LEARN,
    });
    const r = evaluateReviews(changed, tree);
    ok(r.foundation.satisfied, "foundation satisfied by a fresh FOUNDATION-REVIEW");
    ok(r.founder.satisfied, "founder satisfied by a fresh FOUNDER-REVIEW");
    ok(r.learning.satisfied, "learning satisfied by a fresh OS-FEEDBACK");
  }

  // reuse-first: a founder-review-package REVIEW-*.md satisfies Founder; a RETROSPECTIVE satisfies Learning.
  {
    const changed = ["docs/review/REVIEW-42-slice.md", "docs/RETROSPECTIVE-2026-06-26.md", "capabilities/FOUNDATION-REVIEW-y.md"];
    const tree = mk({
      "docs/review/REVIEW-42-slice.md": FOUNDER,
      "docs/RETROSPECTIVE-2026-06-26.md": LEARN,
      "capabilities/FOUNDATION-REVIEW-y.md": FOUND,
    });
    const r = evaluateReviews(changed, tree);
    ok(r.founder.satisfied, "Founder satisfied by an existing REVIEW-*.md (reuse-first)");
    ok(r.learning.satisfied, "Learning satisfied by a RETROSPECTIVE-*.md (reuse-first)");
    ok(r.foundation.satisfied, "Foundation satisfied by capabilities/FOUNDATION-REVIEW-*.md");
  }

  // STALE artifact (present in tree but NOT in the changeset) does NOT satisfy.
  {
    const changed = ["src/server/billing/x.ts"]; // the reviews are old, not in this push
    const tree = mk({ "docs/review/FOUNDATION-REVIEW-old.md": FOUND, "docs/review/FOUNDER-REVIEW-old.md": FOUNDER, "docs/feedback/OS-FEEDBACK-old.md": LEARN });
    const r = evaluateReviews(changed, tree);
    ok(!r.foundation.satisfied && !r.founder.satisfied && !r.learning.satisfied, "stale (not-in-push) reviews do NOT satisfy — each change asks its own questions");
  }

  // RUBBER-STAMP floor: an empty/placeholder artifact (no real frontmatter) does NOT satisfy.
  {
    const changed = ["src/x.ts", "docs/review/FOUNDER-REVIEW-z.md"];
    const tree = mk({ "docs/review/FOUNDER-REVIEW-z.md": "# Founder Review\n(no frontmatter)\n" });
    const r = evaluateReviews(changed, tree);
    ok(!r.founder.satisfied, "an artifact with no valid frontmatter does NOT satisfy (anti-empty-shell floor)");
  }
  // placeholder template values ("<...>") do not satisfy.
  {
    const tree = mk({ "docs/review/FOUNDER-REVIEW-t.md": "---\ndate: <YYYY-MM-DD>\nreviewer: <who>\n---\n" });
    const r = evaluateReviews(["docs/review/FOUNDER-REVIEW-t.md"], tree);
    ok(!r.founder.satisfied, "unfilled template placeholders (<...>) do NOT satisfy");
  }

  // the embedded fallback classifier fires L2 on the recorded miss shape.
  ok(embeddedLevelFallback({ changedFiles: ["contracts/invoice-delivery-v1.mjs"] }).level === "L2", "embedded fallback: contract -> L2");
  ok(embeddedLevelFallback({ changedFiles: ["db/migrations/0042.sql"] }).level === "L2", "embedded fallback: migration -> L2");
  ok(embeddedLevelFallback({ changedFiles: ["src/lib/util.ts"] }).level === "L0", "embedded fallback: plain refactor -> L0");
  // REGRESSION GUARD (2026-06-27): the framework's own architecture fails TOWARD review in the fallback too.
  ok(embeddedLevelFallback({ changedFiles: ["core/GOVERNANCE.md"] }).level === "L2", "embedded fallback: core/ governance -> L2");
  ok(embeddedLevelFallback({ changedFiles: ["proposals/X.md"] }).level === "L2", "embedded fallback: proposals/ WAL -> L2");
  ok(embeddedLevelFallback({ changedFiles: [".claude/tools/learning-trigger.mjs"] }).level === "L2", "embedded fallback: control-plane tool -> L2");

  if (fails.length) {
    console.error("review-trigger --self-test FAIL:");
    for (const f of fails) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.error(
    "review-trigger --self-test PASS — on an L2 (capability/architecture/integration/significant-production) change the push must\n" +
    "carry all THREE reviews (Foundation · Founder · Learning), each FRESH-in-the-push + well-formed; existing REVIEW-*.md / \n" +
    "OS-FEEDBACK / RETROSPECTIVE artifacts satisfy (reuse-first); stale or empty-shell or unfilled-template artifacts do NOT \n" +
    "(anti-rubber-stamp floor); and the embedded fallback fails TOWARD review when the canonical classifier is absent.");
  process.exit(0);
}

// =============================================================================
// CLI
// =============================================================================
function sameFile(p) { try { return p && p.startsWith("file:") ? fileURLToPath(p) : p; } catch { return p; } }
if (process.argv[1] && fileURLToPath(import.meta.url) === sameFile(process.argv[1])) {
  const argv = process.argv.slice(2);
  if (argv.includes("--self-test")) selfTest();
  else if (argv[0] === "gate") await runGate(argv.slice(1));
  else if (argv[0] === "check") await runCheck(argv.slice(1));
  else { console.error("usage: review-trigger.mjs gate --tip <sha> [--files-stdin|--files a,b,c] | check [--base REF] | --self-test"); process.exit(2); }
}
