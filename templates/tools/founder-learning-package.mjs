#!/usr/bin/env node
// =============================================================================
// Delivery OS — Founder Learning Package generator (zero-dep, Node ESM).
// Turns a set of APPROVED, classified learnings (the output of learning-classify,
// + the learning-trigger reasons that earned the review) into the EXACT zero-
// technical-knowledge digest a founder can accept/reject alone:
//   what we learned (plain language) · the recommended asset change for each ·
//   its expected business impact · an explicit ✅ accept / ❌ reject line per
//   learning. Implementation detail (which file, which tool, the diff) is kept
//   to a single muted "lands in" pointer — the founder decides WHETHER, an
//   engineer decides HOW.
// =============================================================================
// FAIL-CLOSED, like founder-review-package.mjs: the package NEVER fabricates a
// learning or an impact. The learning text and the expected impact are engineer/
// triage-SEEDED knowledge — a learning with no title is dropped with a counted
// note (never invented); a missing impact renders an explicit "impact not stated"
// (never a plausible-sounding made-up benefit); and with ZERO real learnings the
// digest shows a fail-closed "nothing to report" notice with NO fabricated rows.
//
//   import { buildLearningPackage } from "./founder-learning-package.mjs"
//   buildLearningPackage({ learnings, triggerReasons?, level?, title? })
//     -> { markdown, accepted, dropped, warnings }
//
//   node founder-learning-package.mjs --file <classified.json> [--trigger <reasons.json>]
//        [--level L2|L1] [--title "..."] [--json] [--self-test]
// =============================================================================

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Plain-language label for each asset class (the founder never sees "asset taxonomy").
const ASSET_LABEL = {
  Capability: "a reusable capability (so every project gets it automatically)",
  Skill: "an upgraded skill (a procedure the team reuses)",
  Workflow: "an automated workflow step",
  SDLC: "our standard way of working (the build checklist)",
  Governance: "a guardrail (when a human must be involved)",
  Prompt: "how we instruct the AI agents",
  Wiki: "our reference notes",
  Template: "a starter file new projects are born with",
  Verification: "an automatic safety check",
  Roadmap: "a future-work note on the roadmap",
  "governance-review": "a flagged item for you to help us route",
  none: "no change (we looked, nothing to adopt)",
};

const labelFor = (asset) => ASSET_LABEL[asset] || `a change to ${asset}`;

// A learning is REAL (renderable) only if it carries its own seeded text. No title
// AND no description => it cannot be honestly described => it is DROPPED (counted),
// never invented into existence.
export function isRealLearning(l) {
  return !!(l && (String(l.title || "").trim() || String(l.description || "").trim()));
}

// The expected-impact line — seeded-or-honest. NEVER invented: with no `impact`
// (or `expected_impact`) field, render an explicit "not stated" prompt, not a guess.
function impactLine(l) {
  const seeded = (l && (l.impact || l.expected_impact));
  const t = seeded == null ? "" : String(seeded).trim();
  if (t) return t;
  return "_Expected impact not stated — an engineer must seed it before this is adopted. (Fail-closed: no benefit is invented.)_";
}

function learningTitle(l) {
  return String((l && l.title) || "").trim() || String((l && l.description) || "").trim().split(/\r?\n/)[0];
}

function learningBody(l) {
  const title = learningTitle(l);
  const desc = String((l && l.description) || "").trim();
  // if title was derived FROM the description, don't repeat it.
  return (desc && desc !== title) ? desc : "";
}

// =============================================================================
// PACKAGE ASSEMBLY (pure). The founder-facing digest + the accept/reject checklist.
// =============================================================================
export function buildLearningPackage(data) {
  const all = (data && Array.isArray(data.learnings)) ? data.learnings : [];
  const accepted = all.filter(isRealLearning);
  const dropped = all.length - accepted.length;
  const level = (data && data.level) || null;
  const triggerReasons = (data && Array.isArray(data.triggerReasons)) ? data.triggerReasons.filter(Boolean) : [];
  const warnings = [];
  if (dropped > 0) warnings.push(`${dropped} learning(s) had no title/description and were DROPPED (fail-closed — a learning is never fabricated to fill a row).`);

  const lines = [];
  const titleText = (data && data.title) || "What we learned this cycle";
  lines.push(`# Founder Learning Review — ${titleText}`);
  lines.push("");

  // Why you're seeing this (the trigger that earned the review) — honest, not ceremony.
  if (level || triggerReasons.length) {
    lines.push(
      level
        ? `_This review was triggered automatically (${level}). You are seeing it because the system flagged that this cycle was worth pausing on — not as routine paperwork._`
        : "_This review was triggered automatically._"
    );
    if (triggerReasons.length) {
      lines.push("", "**Why this fired:**");
      for (const r of triggerReasons) lines.push(`- ${r}`);
    }
    lines.push("");
  }

  // ---- FAIL-CLOSED: no real learnings -> NO fabricated rows --------------------
  if (accepted.length === 0) {
    lines.push("---", "");
    lines.push("## Nothing to report");
    lines.push("");
    lines.push(
      '**We looked, and there is no concrete learning to adopt right now.** _("No framework lessons discovered." is a ' +
      "valid, honest outcome — Governance §14.) This package fabricates nothing: with no seeded learnings, there are no " +
      'rows, no recommendations, and no checklist to sign._'
    );
    if (dropped > 0) {
      lines.push("");
      lines.push(`_Note: ${dropped} item(s) were submitted without any description and were dropped rather than invented._`);
    }
    lines.push("");
    lines.push("---");
    lines.push("_Generated by founder-learning-package.mjs — regenerate, do not hand-edit._");
    lines.push("");
    return { markdown: lines.join("\n"), accepted: [], dropped, warnings };
  }

  // ---- the learnings (one block each) ----------------------------------------
  lines.push("---", "");
  lines.push(`**${accepted.length} thing(s) we learned.** For each, here is what happened in plain language, what we`);
  lines.push("recommend changing, the expected benefit, and a box for you to accept or reject. Nothing changes until you do.");
  lines.push("");

  accepted.forEach((l, i) => {
    const n = i + 1;
    lines.push("---", "");
    lines.push(`### ${n}. ${learningTitle(l)}`);
    lines.push("");
    const body = learningBody(l);
    if (body) { lines.push(body); lines.push(""); }
    lines.push(`**What we recommend:** turn this into **${labelFor(l.asset)}**.`);
    lines.push("");
    lines.push(`**Expected impact:** ${impactLine(l)}`);
    lines.push("");
  });

  // ---- the explicit accept/reject checklist ----------------------------------
  lines.push("---", "");
  lines.push("## ✅ Accept / ❌ Reject");
  lines.push("");
  lines.push("Tick one box per learning. We act only on the ones you accept:");
  lines.push("");
  accepted.forEach((l, i) => {
    lines.push(`**${i + 1}. ${learningTitle(l)}**`);
    lines.push(`- [ ] ✅ Accept — adopt this change`);
    lines.push(`- [ ] ❌ Reject — do not adopt (tell us why, optional)`);
    lines.push("");
  });

  lines.push("---");
  lines.push(`_Generated by founder-learning-package.mjs from ${accepted.length} seeded learning(s) — regenerate, do not hand-edit. (Which exact file each change lands in is in the engineer's notes, not here.)_`);
  lines.push("");

  return { markdown: lines.join("\n"), accepted, dropped, warnings };
}

// =============================================================================
// SELF-TEST (pure; no IO). Proves: real learnings render rows + impact + the ✅/❌
// checklist; a missing impact is "not stated" (never invented); a title-less item
// is DROPPED; and ZERO real learnings -> a fail-closed "nothing to report" with NO
// fabricated rows / no checklist.
// =============================================================================
function selfTest() {
  const fails = [];
  const ok = (cond, msg) => { if (!cond) fails.push(msg); };

  const rich = buildLearningPackage({
    level: "L2",
    triggerReasons: ["incident artifact touched (docs/incidents/merge-on-red.md)"],
    learnings: [
      { title: "Merge ran on a red CI", description: "A pipe swallowed a red status and the merge proceeded.",
        asset: "Verification", impact: "No release can ever merge on a red check again — removes a whole class of bad deploys." },
      { title: "Friction log is the only reliable intake", asset: "Skill", expected_impact: "Founder complaints become tracked rows, nothing is lost." },
    ],
  });
  const md = rich.markdown;
  ok(/## ✅ Accept \/ ❌ Reject/.test(md), "rich: must render the accept/reject checklist");
  ok(md.includes("Merge ran on a red CI") && md.includes("Friction log is the only reliable intake"), "rich: must render each learning title");
  ok(md.includes("an automatic safety check"), "rich: must render the plain-language asset label for Verification");
  ok(md.includes("removes a whole class of bad deploys"), "rich: must render the SEEDED impact verbatim");
  ok((md.match(/- \[ \] ✅ Accept/g) || []).length === 2, "rich: exactly one ✅ accept box per learning");
  ok((md.match(/- \[ \] ❌ Reject/g) || []).length === 2, "rich: exactly one ❌ reject box per learning");
  ok(rich.accepted.length === 2 && rich.dropped === 0, "rich: 2 accepted, 0 dropped");
  ok(md.includes("incident artifact touched"), "rich: surfaces the trigger reason honestly");

  // missing impact -> explicit 'not stated', NEVER invented.
  const noImpact = buildLearningPackage({ learnings: [{ title: "A learning with no impact stated", asset: "Skill" }] });
  ok(noImpact.markdown.includes("Expected impact not stated"), "no-impact: must render the fail-closed 'not stated' line");
  ok(!/improv|faster|saves|increase|better experience/i.test(
        noImpact.markdown.split("Expected impact")[1].split("##")[0]),
     "no-impact: must NOT invent a plausible benefit");

  // a title-less / description-less item is DROPPED (counted), never invented.
  const withGhost = buildLearningPackage({ learnings: [
    { title: "Real one", asset: "Roadmap", impact: "Deferred work is tracked." },
    { asset: "Skill" }, // no title, no description -> ghost
  ] });
  ok(withGhost.accepted.length === 1 && withGhost.dropped === 1, "ghost: a title-less learning is dropped (1 accepted, 1 dropped)");
  ok(withGhost.warnings.some((w) => /DROPPED/.test(w)), "ghost: a warning records the drop (no silent fabrication)");
  ok(!withGhost.markdown.includes("### 2."), "ghost: the dropped learning produces NO second row");

  // ZERO real learnings -> fail-closed 'nothing to report', NO fabricated rows/checklist.
  const empty = buildLearningPackage({ level: "L1", learnings: [] });
  ok(empty.markdown.includes("Nothing to report"), "empty: must render the fail-closed 'nothing to report' notice");
  ok(!/## ✅ Accept/.test(empty.markdown), "empty: must NOT render an accept/reject checklist");
  ok(!/### 1\./.test(empty.markdown), "empty: must NOT render any numbered learning row");
  ok(empty.accepted.length === 0, "empty: zero accepted");

  // all-ghost (submitted items, none real) -> still fail-closed, drop recorded.
  const allGhost = buildLearningPackage({ learnings: [{ asset: "Skill" }, { asset: "Wiki" }] });
  ok(allGhost.markdown.includes("Nothing to report") && allGhost.dropped === 2, "all-ghost: fail-closed notice + both dropped");
  ok(allGhost.markdown.includes("dropped rather than invented"), "all-ghost: states the items were dropped, not invented");

  if (fails.length) {
    console.error("founder-learning-package --self-test FAIL:");
    for (const f of fails) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.error(
    "founder-learning-package --self-test PASS — a digest is built ONLY from seeded learnings: each real learning renders " +
    "its plain-language story, a plain-language recommended asset change, its SEEDED expected impact, and exactly one " +
    "✅ accept / ❌ reject box; a missing impact renders an explicit 'not stated' (NEVER an invented benefit); a title-less " +
    "item is DROPPED with a counted warning (NEVER fabricated into a row); and ZERO real learnings yield a fail-closed " +
    "'Nothing to report' with NO rows and NO checklist. The package fabricates nothing."
  );
  process.exit(0);
}

// =============================================================================
// CLI (read-only; builds the digest, never posts/writes — printing only)
// =============================================================================
function sameFile(p) { try { return p && p.startsWith("file:") ? fileURLToPath(p) : p; } catch { return p; } }
if (process.argv[1] && fileURLToPath(import.meta.url) === sameFile(process.argv[1])) {
  const argv = process.argv.slice(2);
  if (argv.includes("--self-test")) selfTest();
  const flag = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
  const asJson = argv.includes("--json");

  const file = flag("--file");
  if (!file) {
    console.error("USAGE: node founder-learning-package.mjs --file <classified-learnings.json> [--trigger <reasons.json>] [--level L2|L1] [--title \"...\"] [--json]");
    process.exit(2);
  }
  let learnings = [];
  try {
    const j = JSON.parse(readFileSync(file, "utf8"));
    learnings = Array.isArray(j) ? j : (Array.isArray(j.learnings) ? j.learnings : [j]);
  } catch (e) { console.error(`founder-learning-package: cannot read --file ${file}: ${e.message}`); process.exit(2); }

  let triggerReasons = [];
  const trig = flag("--trigger");
  if (trig) {
    try {
      const t = JSON.parse(readFileSync(trig, "utf8"));
      triggerReasons = Array.isArray(t) ? t : (Array.isArray(t.reasons) ? t.reasons : []);
    } catch (e) { console.error(`founder-learning-package: cannot read --trigger ${trig}: ${e.message}`); }
  }

  const pkg = buildLearningPackage({ learnings, triggerReasons, level: flag("--level"), title: flag("--title") });
  if (asJson) { console.log(JSON.stringify(pkg, null, 2)); process.exit(0); }
  console.log(pkg.markdown);
  console.error(`\nfounder-learning-package · accepted ${pkg.accepted.length} · dropped ${pkg.dropped}`);
  for (const w of pkg.warnings) console.error(`  warning: ${w}`);
  process.exit(0);
}
