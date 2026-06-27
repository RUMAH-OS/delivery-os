#!/usr/bin/env node
// =============================================================================
// Delivery OS — learning-trigger (the 3-level Learning-Review CLASSIFIER).
// Zero-dep, Node ESM. PURE classifier — it NEVER acts (no review is run, no
// artifact written, no push touched). It only NAMES the depth of learning a
// change earns so the loop can route it. Shaped exactly like change-classify.mjs
// (classify-only · --self-test · --files/--changed/--base · fail-safe), and it
// COMPOSES change-classify (imports `classify`) — it does NOT re-implement the
// risk-class / founder_verifiable logic.
// =============================================================================
// The board-ratified 3-level trigger policy (Governance §14 made graduated):
//   L2 — FULL learning review. The richest-lesson events (an incident, a decision/
//        ADR/§11 panel, a NEW capability, a founder-review EPIC, a roadmap milestone
//        / release cut, a census candidate, or the N-merges BACKSTOP).
//   L1 — LIGHTWEIGHT checkpoint. A founder-verifiable or VISIBLE (class B) slice, a
//        defect/regression filed this slice, or a census pattern moved to "watch".
//   L0 — CAPTURE only (the anti-ceremony default). L0 = continuous capture EXISTS
//        already (signals.jsonl); the trigger adds nothing ceremonial on top.
//
// THE LOAD-BEARING INVARIANT — fail TOWARD review. L0 is earned only by being
// PROVABLY quiet: zero L2 markers, zero L1 markers, a clean change-classify. The
// instant ANYTHING is novel / unparseable / throws, the level floors at L2 — the
// safe error for a learning gate is to ask for a review that turns out empty, never
// to skip a review that was owed ("No framework lessons discovered." is a valid L2/L1
// outcome; silently not reviewing is the recorded failure §14 closes).
//
//   import { level, LEVELS } from "./learning-trigger.mjs"
//   level({ changedFiles, diffBody?, commitSubjects?, censusExit?, censusWatch?,
//           commitsSinceFeedback?, backstopN?, defectFiled?, panelRan?,
//           milestoneReport?, epicScale?, range?, _classify? })
//     -> { level: "L2"|"L1"|"L0", reasons: string[], range, learning_expected }
//
//   node learning-trigger.mjs [--files a,b,c | --changed | --base REF]
//        [--explain] [--json] [--self-test]
// =============================================================================

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { classify as defaultClassify, loadConfig } from "./change-classify.mjs";

export const LEVELS = { FULL: "L2", LIGHT: "L1", CAPTURE: "L0" };
export const DEFAULT_BACKSTOP = 30;
// Epic-scale thresholds for the founder-review-EPIC L2 marker (a big founder-facing slice).
export const EPIC_FILES = 8;
export const EPIC_LOC = 200;

// =============================================================================
// PATH MARKERS — the L2 surfaces. Data, not code. gitignore-ish globs:
// a pattern with no "/" matches the basename in any dir; "**/" = any leading dirs.
// =============================================================================
export const MARKERS = {
  // an incident artifact (a postmortem or an incident folder)
  incident: ["docs/incidents/**", "**/incidents/**", "**/POSTMORTEM-*.md", "**/postmortem-*.md"],
  // a decision: a DECISIONS.md row, an ADR, or a recorded §11 panel
  decision: ["**/DECISIONS.md", "docs/adr/ADR-*.md", "**/adr/ADR-*.md", "**/DECISION-REVIEW*.md", "**/decision-review*.md"],
  // a NEW capability surface (a skill, an agent, or the capability ledger)
  capability: ["skills/*/SKILL.md", "**/skills/*/SKILL.md", "agents/*", "**/agents/*", "**/CAPABILITY-LEDGER.md"],
  // a roadmap milestone / release cut (VERSION or a CHANGELOG-v* file)
  release: ["VERSION", "**/VERSION", "CHANGELOG-v*", "**/CHANGELOG-v*"],
  // a CROSS-SYSTEM INTEGRATION surface — a producer/consumer seam contract, a seam fixture, or a
  // cross-repo contract. The recorded miss (Admin→PLOS invoice-delivery rework: a NEW immutable-package
  // contract across two repos) earned no learning level because it touched none of the markers above —
  // this marker closes that hole directly.
  integration: ["contracts/**", "**/contracts/**", "**/seam/**", "**/seam-*", "**/*.seam.*",
                "**/*-contract.*", "**/*.contract.*", "**/CONSUMER-*.md", "**/consumer-*.md"],
  // a NEW/changed WORKFLOW or LIFECYCLE pack (the os-inherit workflow templates / lifecycle defs).
  // Deliberately NOT `.github/workflows/**` (routine CI plumbing — change-classify class A); a delivery
  // workflow pack is a platform capability, a CI yaml tweak is maintenance.
  workflow: ["templates/workflows/**", "**/workflow-packs/**", "**/lifecycles/**", "**/*.lifecycle.*"],
  // THE FRAMEWORK'S OWN ARCHITECTURE — the SECOND recorded miss (founder, 2026-06-27): "Foundation/
  // Founder/Learning Review are no longer consistently triggered on significant architectural work."
  // Root cause: every marker above is keyed to a CONSUMER-APP surface (billing / migrations / contracts /
  // SKILL / agent / VERSION). The framework's OWN architectural surfaces matched NONE of them, so —
  //   · the governance spine (`core/GOVERNANCE.md`, `core/OPERATING-LOOP.md`, `core/DEFINITION-OF-DONE.md`)
  //     and the design-decision WAL (`proposals/`) classified change-classify class B → only L1, and
  //   · the CONTROL-PLANE tooling itself — the classifiers / triggers / gates / hooks that ENFORCE every
  //     other gate — classified class A when installed under `.claude/` (auto-safe!) → L0.
  // Editing the constitution, rewriting the risk classifier, or changing THIS trigger's own logic — the
  // most architecturally consequential work there is — owed NO review. A change to the control plane can
  // silently disable every gate; it is architecturally significant BY DEFINITION. This marker closes that
  // direction. (App bug-fix/UI/trivial maintenance touch none of these paths → stay class A/B → below L2.)
  controlplane: [
    // the governance spine + the design-decision WAL (repo-anchored, so a consumer app's own src/core/
    // is NOT swept in — only the framework's top-level core/ + proposals/ qualify)
    "core/**", "proposals/**",
    // the control-plane TOOLING itself — the gates, classifiers, triggers, hooks (canonical + installed)
    "**/verify-gate.mjs", "**/change-classify.mjs", "**/learning-trigger.mjs",
    "**/review-trigger.mjs", "**/census-detector.mjs", "**/check-hook-paths.mjs", "**/check-os-drift.mjs",
    "templates/tools/**", "templates/hooks/**", "templates/githooks/**",
    "**/.claude/hooks/**", "**/.claude/tools/**",
  ],
};
// a prod rollback / revert / hotfix marker, scanned over commit subjects + the diff body.
const ROLLBACK_RE = /\b(rollback|roll-back|revert|hotfix|hot-fix)\b/i;
// a defect / regression filed this slice (scanned over commit subjects + changed paths).
const DEFECT_RE = /\b(regression|defect|bugfix)\b/i;
const DEFECT_PATHS = ["**/defects/**", "docs/defects/**", "**/regressions/**"];

// --- glob matching (gitignore-ish; pure; local — does NOT fork change-classify's
//     risk logic, only the generic path-matching primitive) ---------------------
function globToRegex(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        i++;
        if (glob[i + 1] === "/") { i++; re += "(?:.*/)?"; }
        else re += ".*";
      } else re += "[^/]*";
    } else if (c === "?") re += "[^/]";
    else if (/[.+^${}()|[\]\\]/.test(c)) re += "\\" + c;
    else re += c;
  }
  return new RegExp("^" + re + "$");
}
function matchGlob(path, glob) {
  const p = String(path == null ? "" : path).replace(/\\/g, "/").replace(/^\.\//, "");
  const g = String(glob || "");
  const target = g.includes("/") ? p : p.split("/").pop();
  return globToRegex(g).test(target);
}
const matchAny = (path, globs) => (globs || []).some((g) => matchGlob(path, g));
const anyPathHits = (paths, globs) => (paths || []).some((p) => matchAny(p, globs));

// Normalize changedFiles to a string[] of paths (accepts the change-classify object form).
function pathsOf(changedFiles) {
  return (changedFiles || [])
    .map((f) => (typeof f === "string" ? f : (f && f.path)))
    .filter(Boolean);
}

// =============================================================================
// THE CLASSIFIER (pure). Wrapped in try/catch: ANY internal throw / unparseable
// input floors the level at L2 (fail-toward-review — never skip an owed review).
// change-classify is COMPOSED here (injected as `_classify`, default the real one)
// to supply class + founder_verifiable; it is not re-implemented.
// =============================================================================
export function level(input = {}) {
  try {
    return classifyLevel(input);
  } catch (e) {
    return {
      level: LEVELS.FULL,
      reasons: [`fail-safe -> L2: trigger could not classify the change (${e && e.message}) — fail toward review (a review owed is never skipped on an error).`],
      range: (input && input.range) || null,
      learning_expected: true,
    };
  }
}

function classifyLevel(input) {
  const changedFiles = input.changedFiles || [];
  const paths = pathsOf(changedFiles);
  const diffBody = input.diffBody || "";
  const commitSubjects = input.commitSubjects || [];
  const subjectsText = commitSubjects.join("\n");
  const backstopN = Number.isFinite(input.backstopN) ? input.backstopN : DEFAULT_BACKSTOP;
  const range = input.range || null;

  // COMPOSE change-classify for the risk class + the founder-verifiable (VALIDATION) gate.
  const classify = input._classify || defaultClassify;
  const cc = classify(changedFiles, diffBody, input.classifyConfig, { configError: !!input.configError });

  const l2 = [];
  const l1 = [];

  // --- L2 markers (ANY one => FULL review) ----------------------------------
  if (anyPathHits(paths, MARKERS.incident))
    l2.push(`incident artifact touched (${paths.filter((p) => matchAny(p, MARKERS.incident)).join(", ")})`);
  if (ROLLBACK_RE.test(subjectsText) || ROLLBACK_RE.test(diffBody))
    l2.push("prod rollback/revert/hotfix marker (commit subject or diff body)");
  if (anyPathHits(paths, MARKERS.decision) || input.panelRan)
    l2.push(input.panelRan && !anyPathHits(paths, MARKERS.decision)
      ? "a §11 decision panel ran this slice"
      : `decision/ADR recorded (${paths.filter((p) => matchAny(p, MARKERS.decision)).join(", ") || "panel"})`);
  if (anyPathHits(paths, MARKERS.capability))
    l2.push(`NEW capability surface (${paths.filter((p) => matchAny(p, MARKERS.capability)).join(", ")})`);

  // CONSEQUENTIAL / ARCHITECTURE / SIGNIFICANT-PRODUCTION (composed from change-classify, never forked).
  // A class-C change — money / identity / contracts / data-shape / migrations / prompts / secrets, OR the
  // control-plane itself — IS architecturally significant by definition and ALWAYS earns a full review.
  // THIS is the marker that closes the recorded miss: a cross-system migration+contract rework classified
  // class C, but — lacking an ADR or new-capability path — earned NO learning level (it fell to L0 and
  // fired nothing). A class-C change is precisely "a significant production change", never a bug-fix/UI/
  // trivial-maintenance one (those are class A/B and do NOT reach here).
  if (paths.length && cc.class === "C")
    l2.push(`CONSEQUENTIAL change — change-classify class C (${cc.reason})`);

  if (anyPathHits(paths, MARKERS.integration))
    l2.push(`cross-system integration / seam contract (${paths.filter((p) => matchAny(p, MARKERS.integration)).join(", ")})`);

  const wfHits = paths.filter((p) => matchAny(p, MARKERS.workflow) &&
    !/(^|\/)\.github\/workflows\//.test(String(p).replace(/\\/g, "/")));
  if (wfHits.length)
    l2.push(`new/changed workflow or lifecycle pack (${wfHits.join(", ")})`);

  // FRAMEWORK ARCHITECTURE / CONTROL-PLANE — the governance spine, the design-decision WAL, or the gate/
  // classifier/trigger/hook tooling itself. Closes the 2026-06-27 regression: significant architectural
  // work ON THE FRAMEWORK fell to L1/L0 and fired no review.
  if (anyPathHits(paths, MARKERS.controlplane))
    l2.push(`framework architecture / control-plane change (${paths.filter((p) => matchAny(p, MARKERS.controlplane)).join(", ")})`);

  const epicScale = !!input.epicScale ||
    paths.length >= EPIC_FILES ||
    (cc.signals && Number.isFinite(cc.signals.loc) && cc.signals.loc >= EPIC_LOC);
  if (cc.founder_verifiable && epicScale)
    l2.push(`founder-review EPIC (founder_verifiable AND epic-scale: ${paths.length} files / ${cc.signals ? cc.signals.loc : "?"} LOC)`);

  if (input.milestoneReport) l2.push("roadmap milestone (milestone-report fired)");
  if (anyPathHits(paths, MARKERS.release))
    l2.push(`roadmap milestone (VERSION/CHANGELOG-v* cut: ${paths.filter((p) => matchAny(p, MARKERS.release)).join(", ")})`);

  if (Number.isFinite(input.censusExit) && input.censusExit !== 0)
    l2.push("census candidate (census-detector exited non-zero — an un-triaged recurring pattern)");

  if (Number.isFinite(input.commitsSinceFeedback) && input.commitsSinceFeedback > backstopN)
    l2.push(`BACKSTOP: ${input.commitsSinceFeedback} commits since the last docs/feedback/ artifact (> ${backstopN})`);

  if (l2.length) {
    return { level: LEVELS.FULL, reasons: l2, range, learning_expected: true };
  }

  // --- L1 markers (ANY one => LIGHTWEIGHT checkpoint) ------------------------
  // The change-classify-DERIVED signals are consulted only when files actually
  // changed — a class/founder_verifiable computed over ZERO files is meaningless
  // (change-classify fail-safes an empty change to class B; that must not spuriously
  // earn L1 when nothing was touched). Injected signals (defect, census) still apply.
  if (paths.length) {
    if (cc.founder_verifiable) l1.push("change-classify: founder_verifiable=true (a founder-facing slice)");
    if (cc.class === "B") l1.push("change-classify: class B (VISIBLE — a human sees the result)");
  }
  if (input.defectFiled || DEFECT_RE.test(subjectsText) || anyPathHits(paths, DEFECT_PATHS))
    l1.push("a defect/regression was filed this slice");
  if (input.censusWatch) l1.push("census moved a pattern to watch (seen 2× — below the candidate threshold)");

  if (l1.length) {
    return { level: LEVELS.LIGHT, reasons: l1, range, learning_expected: true };
  }

  // --- L0 (capture only — the anti-ceremony default) ------------------------
  return {
    level: LEVELS.CAPTURE,
    reasons: [`L0 capture-only: change-classify class ${cc.class}, not founder-facing, no L2/L1 marker — continuous capture (signals.jsonl) is sufficient; no review ceremony owed.`],
    range,
    learning_expected: false,
  };
}

// =============================================================================
// LIVE GATHER (IO) — pulls the injected signals for the CLI. Each is fail-safe:
// an unavailable source contributes nothing (the pure classifier then floors at
// L2 only on a genuine throw, never on a benign "couldn't read git").
// =============================================================================
function git(args, cwd) {
  try { return execFileSync("git", args, { encoding: "utf8", cwd, stdio: ["ignore", "pipe", "ignore"] }); }
  catch { return ""; }
}

function readBackstopN(cwd) {
  try {
    const raw = readFileSync(join(cwd, ".claude", ".verify-config.json"), "utf8");
    const cfg = JSON.parse(raw);
    const n = cfg && cfg.feedback_backstop_commits;
    return Number.isFinite(n) ? n : DEFAULT_BACKSTOP;
  } catch { return DEFAULT_BACKSTOP; }
}

// Commits since the last commit that touched docs/feedback/ (the N-merges backstop counter).
function commitsSinceFeedback(cwd) {
  const last = git(["log", "-1", "--format=%H", "--", "docs/feedback/"], cwd).trim();
  if (!last) {
    const total = git(["rev-list", "--count", "HEAD"], cwd).trim();
    return Number.parseInt(total, 10) || 0;
  }
  const n = git(["rev-list", "--count", `${last}..HEAD`], cwd).trim();
  return Number.parseInt(n, 10) || 0;
}

// Shell the sibling census-detector: exit code (non-zero => candidate) + a "watch (2×" line.
function censusProbe(here) {
  const detector = join(here, "census-detector.mjs");
  try {
    execFileSync(process.execPath, [detector], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { censusExit: 0, censusWatch: false };
  } catch (e) {
    const out = `${(e && e.stderr) || ""}${(e && e.stdout) || ""}`;
    return { censusExit: Number.isInteger(e && e.status) ? e.status : 1, censusWatch: /watch \(2×|watch \(2x/i.test(out) };
  }
}

// =============================================================================
// SELF-TEST (pure; no IO). Proves: incident->L2, founder_verifiable->>=L1, a plain
// refactor->L0, backstop>N->L2, and fail-safe on bad input->L2.
// =============================================================================
function selfTest() {
  const fails = [];
  const ok = (cond, msg) => { if (!cond) fails.push(msg); };
  const log = [];
  const show = (label, r) => log.push(`  [${label}] -> ${r.level}  learning_expected=${r.learning_expected}  "${r.reasons[0]}"`);

  // --- incident artifact -> L2 ---
  const incident = level({ changedFiles: ["docs/incidents/2026-06-merge-on-red.md"] });
  ok(incident.level === "L2", "incident artifact -> L2");
  ok(incident.learning_expected === true, "L2 -> learning_expected=true");
  show("incident->L2", incident);

  // --- a founder_verifiable (small, visible) slice -> >= L1 ---
  const fv = level({ changedFiles: ["src/pages/Dashboard.tsx"], diffBody: "+<div>hi</div>" });
  ok(fv.level === "L1" || fv.level === "L2", "founder_verifiable slice -> >=L1");
  ok(fv.level === "L1", "small founder_verifiable slice -> exactly L1 (not epic -> not L2)");
  show("founder_verifiable->L1", fv);

  // --- a plain (non-founder, class A) refactor -> L0 ---
  const refactor = level({ changedFiles: ["src/lib/util.ts"], diffBody: "+const x = 1;" });
  ok(refactor.level === "L0", "plain src refactor (class A, not founder-facing) -> L0");
  ok(refactor.learning_expected === false, "L0 -> learning_expected=false");
  show("plain-refactor->L0", refactor);

  // --- the BACKSTOP (commits since last feedback > N) -> L2 ---
  const backstop = level({ changedFiles: ["src/lib/util.ts"], commitsSinceFeedback: 31, backstopN: 30 });
  ok(backstop.level === "L2", "backstop > N -> L2");
  ok(backstop.commitsSinceFeedback === undefined && /BACKSTOP/.test(backstop.reasons.join(" ")), "backstop reason is surfaced");
  show("backstop>N->L2", backstop);
  // and exactly N is NOT over the backstop (boundary) -> L0 here.
  ok(level({ changedFiles: ["src/lib/util.ts"], commitsSinceFeedback: 30, backstopN: 30 }).level === "L0",
     "commits == N is NOT over the backstop (strictly greater)");

  // --- fail-safe on bad input -> L2 (fail toward review) ---
  const boom = level({ changedFiles: ["src/x.ts"], _classify: () => { throw new Error("synthetic classify failure"); } });
  ok(boom.level === "L2", "a thrown classify -> L2 (fail-safe)");
  ok(/fail-safe -> L2/.test(boom.reasons[0]), "fail-safe reason is explicit");
  show("fail-safe->L2", boom);
  ok(level(null).level === "L2", "null input -> L2 (fail-safe, no crash)");
  ok(level().level === "L0", "no-arg call -> L0 (empty change, no crash)");
  ok(level({}).level === "L0", "empty change -> L0 (nothing touched, nothing learned)");

  // --- more L2 proofs: ADR, NEW capability, release cut, census candidate ---
  ok(level({ changedFiles: ["docs/adr/ADR-014-merge-gate.md"] }).level === "L2", "ADR -> L2");
  ok(level({ changedFiles: ["DECISIONS.md"] }).level === "L2", "DECISIONS.md -> L2");
  ok(level({ changedFiles: ["src/x.ts"], panelRan: true }).level === "L2", "a §11 panel ran -> L2");
  ok(level({ changedFiles: ["skills/learning-review/SKILL.md"] }).level === "L2", "new SKILL.md -> L2");
  ok(level({ changedFiles: ["agents/software-engineer.md"] }).level === "L2", "new agent -> L2");
  ok(level({ changedFiles: ["CHANGELOG-v4.md"] }).level === "L2", "CHANGELOG-v* cut -> L2");
  ok(level({ changedFiles: ["VERSION"] }).level === "L2", "VERSION cut -> L2");
  ok(level({ changedFiles: ["src/x.ts"], milestoneReport: true }).level === "L2", "milestone-report fired -> L2");
  ok(level({ changedFiles: ["src/x.ts"], censusExit: 1 }).level === "L2", "census candidate (non-zero exit) -> L2");
  ok(level({ changedFiles: ["src/x.ts"], commitSubjects: ["revert: undo the bad deploy"] }).level === "L2", "revert marker -> L2");

  // --- NEW (the founder's gap): CONSEQUENTIAL/ARCHITECTURE/INTEGRATION/WORKFLOW -> L2 ---
  // a migration touching the financial SoR (class C) -> L2 (the recorded miss).
  ok(level({ changedFiles: ["db/migrations/0042_invoice_lifecycle.sql"] }).level === "L2", "migration (financial SoR, class C) -> L2");
  ok(level({ changedFiles: ["src/server/billing/invoice.ts"] }).level === "L2", "billing path (class C) -> L2");
  ok(/CONSEQUENTIAL change/.test(level({ changedFiles: ["db/migrations/0042.sql"] }).reasons.join(" ")), "class-C reason surfaced");
  // a cross-repo SEAM / immutable-package CONTRACT (the Admin→PLOS rework shape) -> L2.
  ok(level({ changedFiles: ["contracts/invoice-delivery-v1.mjs"] }).level === "L2", "cross-repo contract -> L2 (integration)");
  ok(level({ changedFiles: ["packages/seam/consumer-fixtures.json"] }).level === "L2", "seam fixture -> L2 (integration)");
  ok(/integration|CONSEQUENTIAL/.test(level({ changedFiles: ["apps/web/CONSUMER-invoice.md"] }).reasons.join(" ")), "CONSUMER-import contract -> L2");
  // a new workflow / lifecycle PACK -> L2; routine CI yaml is NOT a workflow-pack marker.
  ok(level({ changedFiles: ["templates/workflows/promote.yml"] }).level === "L2", "new workflow pack -> L2");
  ok(level({ changedFiles: [".github/workflows/ci.yml"] }).level === "L0", "routine .github/workflows CI yaml -> L0 (NOT a workflow-pack marker; class A maintenance)");

  // --- REGRESSION GUARD (founder requirement 2026-06-27): the framework's OWN architectural surfaces ---
  // This block is the named guard that the "significant architectural work fires no review" regression
  // cannot silently reappear. Each assertion is a path that MUST classify L2 (pure level — the exact shape
  // the review-trigger gate calls), and the exemption assertions below prove the marker did NOT over-fire.
  ok(level({ changedFiles: ["core/GOVERNANCE.md"] }).level === "L2", "GUARD: core/GOVERNANCE.md (constitution) -> L2");
  ok(level({ changedFiles: ["core/OPERATING-LOOP.md"] }).level === "L2", "GUARD: core/OPERATING-LOOP.md -> L2");
  ok(level({ changedFiles: ["core/DEFINITION-OF-DONE.md"] }).level === "L2", "GUARD: core/DEFINITION-OF-DONE.md -> L2");
  ok(level({ changedFiles: ["proposals/NEW-DESIGN.md"] }).level === "L2", "GUARD: proposals/* (design WAL) -> L2");
  ok(level({ changedFiles: ["templates/tools/change-classify.mjs"] }).level === "L2", "GUARD: the risk classifier itself -> L2");
  ok(level({ changedFiles: ["templates/tools/learning-trigger.mjs"] }).level === "L2", "GUARD: the L2 trigger's own logic -> L2");
  ok(level({ changedFiles: ["templates/tools/review-trigger.mjs"] }).level === "L2", "GUARD: the review-trigger detector -> L2");
  ok(level({ changedFiles: [".claude/tools/learning-trigger.mjs"] }).level === "L2", "GUARD: the INSTALLED gate logic (was class A -> L0!) -> L2");
  ok(level({ changedFiles: [".claude/hooks/verify-gate.mjs"] }).level === "L2", "GUARD: the installed verify-gate hook -> L2");
  ok(/control-plane|CONSEQUENTIAL/.test(level({ changedFiles: ["core/GOVERNANCE.md"] }).reasons.join(" ")), "GUARD: control-plane reason surfaced");
  // and the marker does NOT sweep in a CONSUMER APP's own src/core/ (repo-anchored core/**, not **/core/**):
  ok(level({ changedFiles: ["apps/web/src/core/util.ts"] }).level !== "L2" ||
     /class C|integration|workflow/.test(level({ changedFiles: ["apps/web/src/core/util.ts"] }).reasons.join(" ")),
     "GUARD: a consumer app's own src/core/ is NOT swept into control-plane L2");

  // --- EXEMPTIONS (must NOT reach L2): bug-fix · small UI tweak · trivial maintenance ---
  ok(level({ changedFiles: ["src/lib/parser.ts"], commitSubjects: ["fix: a regression in the parser"] }).level === "L1",
     "isolated bug-fix (regression) -> L1, NOT L2 (no full review owed)");
  ok(level({ changedFiles: ["src/pages/Dashboard.tsx"], diffBody: "+<span>tweak</span>" }).level === "L1",
     "small UI tweak (founder_verifiable, not epic) -> L1, NOT L2");
  ok(level({ changedFiles: ["src/lib/util.ts"], diffBody: "+const x = 1;" }).level === "L0",
     "trivial maintenance (class A refactor) -> L0, NOT L2");
  ok(level({ changedFiles: ["docs/notes.md", "tests/unit/x.test.ts"] }).level === "L0",
     "docs + tests only -> L0, NOT L2");

  // --- a founder-review EPIC (founder_verifiable AND epic-scale) -> L2 ---
  const epicFiles = Array.from({ length: 9 }, (_, i) => `apps/web/components/C${i}.tsx`);
  const epic = level({ changedFiles: epicFiles });
  ok(epic.level === "L2", "founder_verifiable + epic-scale (9 UI files) -> L2");
  ok(/founder-review EPIC/.test(epic.reasons.join(" ")), "epic reason is surfaced");

  // --- L1 proofs: class B (visible non-founder review surface? -> api is class B), defect, census watch ---
  ok(level({ changedFiles: ["src/api/users.ts"] }).level === "L1", "class B (api review surface, not founder-facing) -> L1");
  ok(level({ changedFiles: ["src/x.ts"], defectFiled: true }).level === "L1", "a defect filed -> L1");
  ok(level({ changedFiles: ["src/x.ts"], commitSubjects: ["fix: a regression in the parser"] }).level === "L1", "regression in commit subject -> L1");
  ok(level({ changedFiles: ["src/x.ts"], censusWatch: true }).level === "L1", "census watch (2×) -> L1");

  // --- the ORTHOGONAL/priority proof: an L2 marker WINS over an L1 marker ---
  const both = level({ changedFiles: ["src/api/users.ts", "docs/incidents/x.md"] });
  ok(both.level === "L2", "an L2 marker present alongside an L1 marker -> L2 (the deeper review wins)");

  if (fails.length) {
    console.error("learning-trigger --self-test FAIL:");
    for (const f of fails) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.error("learning-trigger --self-test PASS — 3-level trigger proofs (composing change-classify):");
  for (const l of log) console.error(l);
  console.error(
    "learning-trigger --self-test PASS — L2 (FULL review) fires on ANY rich-lesson marker (incident · decision/ADR/§11 " +
    "panel · NEW capability · founder-review EPIC · roadmap/release cut · census candidate · the N-merges BACKSTOP) and " +
    "WINS over L1; L1 (lightweight) fires on a founder_verifiable or class-B slice, a filed defect, or a census 'watch'; " +
    "L0 (capture-only) is the anti-ceremony default earned ONLY by a provably-quiet change; and ANY thrown/unparseable " +
    "input floors at L2 — fail TOWARD review (a review owed is never skipped on an error). change-classify is COMPOSED " +
    "(imported), never forked."
  );
  process.exit(0);
}

// =============================================================================
// CLI (read-only; classifies the working change, never acts)
// =============================================================================
function sameFile(p) { try { return p && p.startsWith("file:") ? fileURLToPath(p) : p; } catch { return p; } }
if (process.argv[1] && fileURLToPath(import.meta.url) === sameFile(process.argv[1])) {
  const argv = process.argv.slice(2);
  if (argv.includes("--self-test")) selfTest();
  const flag = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
  const asJson = argv.includes("--json");
  const explain = argv.includes("--explain");
  const cwd = process.cwd();
  const here = dirname(fileURLToPath(import.meta.url));

  // gather the change: explicit --files, else the working/branch diff vs --base.
  let changedFiles = [];
  let diffBody = "";
  let commitSubjects = [];
  let range = null;
  const filesFlag = flag("--files");
  if (filesFlag) {
    changedFiles = filesFlag.split(",").map((s) => s.trim()).filter(Boolean);
    range = `--files (${changedFiles.length})`;
  } else {
    const base = flag("--base");
    const changedMode = argv.includes("--changed"); // working tree vs HEAD
    const rangeArg = base ? [`${base}...HEAD`] : [];
    changedFiles = git(["diff", "--name-only", ...rangeArg], cwd).split("\n").map((s) => s.trim()).filter(Boolean);
    diffBody = git(["diff", ...rangeArg], cwd);
    commitSubjects = base
      ? git(["log", `${base}..HEAD`, "--format=%s"], cwd).split("\n").map((s) => s.trim()).filter(Boolean)
      : [];
    range = base ? `${base}...HEAD` : (changedMode ? "working-tree vs HEAD" : "working-tree");
  }

  const { config, configError } = loadConfig(cwd);
  const census = censusProbe(here);
  const result = level({
    changedFiles, diffBody, commitSubjects, range,
    classifyConfig: config, configError,
    backstopN: readBackstopN(cwd),
    commitsSinceFeedback: commitsSinceFeedback(cwd),
    censusExit: census.censusExit,
    censusWatch: census.censusWatch,
  });

  if (asJson) { console.log(JSON.stringify(result, null, 2)); process.exit(0); }

  console.error(`learning-trigger (range: ${result.range})`);
  console.error(`  level: ${result.level}  (learning_expected=${result.learning_expected})`);
  if (explain) for (const r of result.reasons) console.error(`    · ${r}`);
  else console.error(`  why  : ${result.reasons[0]}`);
  console.log(result.level); // stdout = the level (for scripting)
  process.exit(0);
}
