#!/usr/bin/env node
// Delivery OS — validate-skills (v4). FAIL-CLOSED skill-format lint, ported from the agent-skills
// reference's validate-skills.js conventions (adopt verdict, #84 §7) and adapted to the ratified
// hybrid dialect (#85 C3 / B31). Earned: three frontmatter dialects existed inside ONE repo (C6) —
// format drift happens even without a fork; only a CI lint keeps one dialect one dialect.
//
//   node validate-skills.mjs [skills-dir]      // default: .claude/skills, else skills/
//
// ERRORS (exit 1): missing SKILL.md · missing/malformed frontmatter · name≠dirname ·
//   missing description / >1024 chars · numbered process steps inside the description
//   (description discipline B32: the description is the only retrieval surface) ·
//   missing version/stability/earned_from/mechanical_spine (the hybrid's required fields) ·
//   must-fire trigger language with no named hook in mechanical_spine (B33 authoring rule) ·
//   missing required body sections (Process · Red flags · Verification).
// WARNINGS: dead cross-skill references · missing Changelog.
//
// EXEMPTIONS LIVE HERE, IN THE VALIDATOR — never in skill frontmatter (the reference's
// ownership-as-mechanism rule: a contributor cannot bypass the lint by editing their own file).
// Every entry carries a documented reason.

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const argDir = process.argv[2];
const ROOT = process.cwd();
const SKILLS_DIR = argDir
  ? resolve(ROOT, argDir)
  : existsSync(join(ROOT, ".claude", "skills")) ? join(ROOT, ".claude", "skills") : join(ROOT, "skills");

const MAX_DESCRIPTION = 1024;

// Body sections of the ratified hybrid (aliases accepted: legacy base-format headings count).
const REQUIRED_SECTIONS = [
  ["## Process", "## Procedure", "## When invoked, do this", "## The two halves"],
  ["## Red flags", "## Red Flags", "## Honest failure", "## Honest limit"],
  ["## Verification", "## Success criteria", "## Verification of this skill's own output"],
];

// Validator-owned exemptions — documented reasons, never frontmatter-declared.
const EXEMPT = {
  // pre-v4 stock skills grandfathered on specific fields (full back-fit tracked for v4.x):
  "discovery-interview":  { fields: ["earned_from", "mechanical_spine"], reason: "pre-v4 stock skill; provenance lives in its Changelog; back-fit scheduled" },
  "migration-assessment": { fields: ["earned_from", "mechanical_spine"], reason: "pre-v4 stock skill; provenance lives in its Changelog; back-fit scheduled" },
  "ecosystem-alignment-review": { fields: ["earned_from", "mechanical_spine"], reason: "pre-v4 stock skill; v4 amends its trigger (rides the sibling probe); back-fit scheduled" },
};

const isDirSkipped = (name) => name.startsWith("_") || name.startsWith("."); // _archive etc.

function parseFrontmatter(content) {
  const m = content.match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n/);
  if (!m) return null;
  const fm = {};
  const lines = m[1].split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const idx = lines[i].indexOf(":");
    if (idx === -1 || /^\s/.test(lines[i])) continue;
    const key = lines[i].slice(0, idx).trim();
    let val = lines[i].slice(idx + 1).trim();
    if (val === ">" || val === "|" || val === ">-" || val === "|-") {
      const buf = [];
      while (i + 1 < lines.length && (/^\s+\S/.test(lines[i + 1]) || lines[i + 1].trim() === "")) {
        const nxt = lines[i + 1];
        if (nxt.trim() === "" && !(i + 2 < lines.length && /^\s+\S/.test(lines[i + 2]))) break;
        buf.push(lines[++i].trim());
      }
      val = buf.filter((s) => !s.startsWith("#")).join(" ");
    }
    if (key) fm[key] = val.replace(/^['"]|['"]$/g, "");
  }
  return fm;
}

function validate(dir, known) {
  const errors = [], warnings = [];
  const path = join(SKILLS_DIR, dir, "SKILL.md");
  if (!existsSync(path)) { errors.push("Missing SKILL.md"); return { errors, warnings }; }
  const content = readFileSync(path, "utf8");
  const fm = parseFrontmatter(content);
  if (!fm) { errors.push("Missing or malformed YAML frontmatter"); return { errors, warnings }; }

  const exempt = EXEMPT[dir]?.fields || [];
  const req = (field, why) => {
    if (!fm[field] && !exempt.includes(field)) errors.push(`Frontmatter missing required field '${field}' (${why})`);
  };

  if (!fm.name) errors.push("Frontmatter missing required field: 'name'");
  else if (fm.name !== dir) errors.push(`Frontmatter name '${fm.name}' != directory '${dir}'`);

  if (!fm.description) errors.push("Frontmatter missing required field: 'description'");
  else {
    if (fm.description.length > MAX_DESCRIPTION)
      errors.push(`Description is ${fm.description.length} chars (> ${MAX_DESCRIPTION} — it is injected into the system prompt)`);
    if (/\b\d\.\s+\w+.*\b\d\.\s+\w+/.test(fm.description) || /(^|\s)(step\s*1\b)/i.test(fm.description))
      errors.push("Description contains numbered process steps — the agent may follow the summary instead of the skill (B32). Name the TRIGGER, not the procedure.");
  }

  req("version", "semver; bump-or-declare-no-learning rides on it");
  req("stability", "experimental|stable|deprecated");
  req("earned_from", "every skill cites the incident/usage that pays its rent — 'lessons are the asset' made machine-visible");
  req("mechanical_spine", "names the hook/script behind each non-discretionary step, or 'none — judgment-gated'");

  // Authoring rule B33: a must-fire trigger needs a named hook — descriptions request, hooks command.
  const mustFire = /\b(MANDATORY|must[- ]fire|ALWAYS run|never optional)\b/i.test(fm.description || "");
  const spine = (fm.mechanical_spine || "").toLowerCase();
  if (mustFire && (!spine || spine.startsWith("none")) && !exempt.includes("mechanical_spine"))
    errors.push("Description declares a MANDATORY/must-fire trigger but mechanical_spine names no hook (B33: prose cannot carry a must-fire link — every recorded missed-fire was a prose trigger).");

  for (const aliases of REQUIRED_SECTIONS) {
    if (!aliases.some((h) => content.includes(h))) errors.push(`Missing required section: ${aliases[0]} (or alias)`);
  }
  if (!content.includes("## Changelog")) warnings.push("No ## Changelog section (versioning has no home)");

  // Dead cross-references (warning) — explicit `name` skill mentions only.
  for (const m of content.matchAll(/`([a-z][a-z0-9-]+[a-z0-9])` skill\b/g)) {
    if (!known.has(m[1])) warnings.push(`Dead cross-reference: \`${m[1]}\` is not an installed skill`);
  }
  return { errors, warnings };
}

if (!existsSync(SKILLS_DIR)) { console.error(`validate-skills: skills dir not found: ${SKILLS_DIR}`); process.exit(1); }
const dirs = readdirSync(SKILLS_DIR).filter((d) => !isDirSkipped(d) && statSync(join(SKILLS_DIR, d)).isDirectory()).sort();
const known = new Set(dirs);
let errs = 0, warns = 0;
for (const d of dirs) {
  const { errors, warnings } = validate(d, known);
  errs += errors.length; warns += warnings.length;
  if (!errors.length && !warnings.length) console.log(`  ok   ${d}${EXEMPT[d] ? ` (exempt: ${EXEMPT[d].fields.join(",")})` : ""}`);
  else {
    console.log(`${errors.length ? "  FAIL " : "  warn "}${d}`);
    for (const e of errors) console.log(`       ERROR: ${e}`);
    for (const w of warnings) console.log(`       WARN:  ${w}`);
  }
}
console.log(`\nvalidate-skills: ${dirs.length} skills — ${errs} error(s), ${warns} warning(s) — ${errs ? "FAILED (fail-closed)" : "PASSED"}`);
process.exit(errs ? 1 : 0);
