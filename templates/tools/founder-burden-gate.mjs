#!/usr/bin/env node
// =============================================================================
// Delivery OS — founder-burden-gate (OS v6 capability #5). Zero-dep, node ESM.
// =============================================================================
// Operationalizes the founder's SUCCESS METRIC — "the founder no longer
// experiences the problem" — as a NUMBER, fail-closed.
//
// Each milestone carries a record (docs/founder-burden/<milestone>.json, shape
// = templates/.founder-burden.json) counting FOUNDER ACTIONS by category:
// terminal commands, env/token/migration actions, per-action authorizations,
// cross-repo coordination, manual setup steps, live-validation defects found.
//
// The gate compares `current.count` against the recorded `baseline.count` and:
//   - prints a readable category-by-category baseline-vs-current delta, and
//   - EXITS NON-ZERO if `current.count >= baseline.count` — i.e. the milestone
//     did NOT reduce founder burden. A milestone that didn't make the founder's
//     job easier CANNOT be called done. Fail-closed on the success metric.
//
// USAGE:
//   node founder-burden-gate.mjs <milestone.json>            grade a record
//   node founder-burden-gate.mjs <out.json> --record <name>  scaffold a new record
//
// EXIT: 0 = burden dropped (current < baseline) / record scaffolded.
//       Non-zero = burden did not drop, or the record is missing/invalid (honest
//       failure — an unmeasurable milestone is not a passing milestone).
//
// The record file is the single source of truth; this gate never edits a count.
// =============================================================================

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, isAbsolute } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));

// The canonical category taxonomy (charter §8 + the friction log). The order
// here is the order reported. A record may omit a category (treated as 0); a
// record may NOT introduce a category not in this list (fail-closed on drift).
const CATEGORIES = [
  "terminal_command",
  "env_token_migration_action",
  "per_action_authorization",
  "cross_repo_coordination",
  "manual_setup_step",
  "live_validation_defect_found",
];

function die(msg, code = 1) {
  process.stderr.write(`founder-burden-gate: ${msg}\n`);
  process.exit(code);
}

// --- args --------------------------------------------------------------------
const argv = process.argv.slice(2);
if (argv.length === 0 || argv[0] === "-h" || argv[0] === "--help") {
  process.stdout.write(
    "Usage:\n" +
      "  node founder-burden-gate.mjs <milestone.json>            grade a record (fail-closed if burden did not drop)\n" +
      "  node founder-burden-gate.mjs <out.json> --record <name>  scaffold a new milestone record\n"
  );
  process.exit(argv.length === 0 ? 2 : 0);
}

const recordIdx = argv.indexOf("--record");
const isRecord = recordIdx !== -1;
const fileArg = argv[0];
const filePath = isAbsolute(fileArg) ? fileArg : resolve(process.cwd(), fileArg);

// --- --record: scaffold a new milestone entry from the template --------------
if (isRecord) {
  const milestone = argv[recordIdx + 1];
  if (!milestone) die("--record needs a milestone name: --record <name>", 2);
  if (existsSync(filePath)) die(`refusing to overwrite existing record: ${filePath}`, 1);

  const templatePath = resolve(HERE, "../.founder-burden.json");
  if (!existsSync(templatePath)) die(`cannot find the schema template at ${templatePath}`, 2);

  let tpl;
  try {
    tpl = JSON.parse(readFileSync(templatePath, "utf8"));
  } catch (e) {
    die(`schema template is not valid JSON (${e.message})`, 2);
  }

  tpl.milestone = milestone;
  tpl.baseline.recorded_from = `<record the v5/current baseline measured for "${milestone}">`;
  tpl.current.measured_from = `<record the re-measure for "${milestone}">`;
  delete tpl._comment;

  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(tpl, null, 2) + "\n", "utf8");
  process.stdout.write(
    `founder-burden-gate: scaffolded record for "${milestone}" at ${filePath}\n` +
      `Fill baseline.count + baseline.breakdown from real evidence (cite each in baseline.notes), then re-measure current after the milestone runs.\n`
  );
  process.exit(0);
}

// --- grade: read the record --------------------------------------------------
if (!existsSync(filePath)) die(`record not found: ${filePath} (scaffold with --record <name>)`, 1);

let rec;
try {
  rec = JSON.parse(readFileSync(filePath, "utf8"));
} catch (e) {
  die(`record is not valid JSON (${e.message}) — an unmeasurable milestone does not pass`, 1);
}

if (!rec || typeof rec !== "object") die("record is not an object", 1);
const milestone = rec.milestone || "(unnamed milestone)";
const baseline = rec.baseline || {};
const current = rec.current || {};

// Reconcile each side's breakdown against the canonical taxonomy. A category not
// in the taxonomy is a fail (drift); a missing category counts as 0.
function reconcile(side, label) {
  const bd = side.breakdown || {};
  const unknown = Object.keys(bd).filter((k) => !CATEGORIES.includes(k));
  if (unknown.length) die(`${label}.breakdown has unknown categor${unknown.length > 1 ? "ies" : "y"}: ${unknown.join(", ")} — not in the ratified taxonomy (fail-closed on drift)`, 1);
  const counts = {};
  let sum = 0;
  for (const c of CATEGORIES) {
    const n = Number(bd[c] || 0);
    if (!Number.isFinite(n) || n < 0) die(`${label}.breakdown.${c} is not a non-negative number`, 1);
    counts[c] = n;
    sum += n;
  }
  // The stated count is authoritative if present, but it must equal the breakdown
  // sum — an inconsistent record is not trustworthy evidence.
  const stated = side.count;
  if (stated !== undefined && stated !== null) {
    if (Number(stated) !== sum) die(`${label}.count (${stated}) != sum of ${label}.breakdown (${sum}) — fix the record so the number is honest`, 1);
  }
  return { counts, total: sum };
}

const b = reconcile(baseline, "baseline");
const c = reconcile(current, "current");

// --- report: category-by-category delta --------------------------------------
const pad = (s, n) => String(s).padEnd(n);
const W = 30;
const out = [];
out.push(`founder-burden-gate · milestone: ${milestone}`);
out.push(`  baseline from: ${baseline.recorded_from || "(unspecified)"}`);
out.push(`  current  from: ${current.measured_from || "(unspecified)"}`);
out.push("");
out.push(`  ${pad("category", W)} ${pad("baseline", 9)} ${pad("current", 9)} delta`);
out.push(`  ${"-".repeat(W)} ${"-".repeat(9)} ${"-".repeat(9)} -----`);
for (const cat of CATEGORIES) {
  const bv = b.counts[cat];
  const cv = c.counts[cat];
  const d = cv - bv;
  const sign = d > 0 ? `+${d}` : `${d}`;
  out.push(`  ${pad(cat, W)} ${pad(bv, 9)} ${pad(cv, 9)} ${sign}`);
}
out.push(`  ${"-".repeat(W)} ${"-".repeat(9)} ${"-".repeat(9)} -----`);
const total = c.total - b.total;
out.push(`  ${pad("TOTAL founder actions", W)} ${pad(b.total, 9)} ${pad(c.total, 9)} ${total > 0 ? "+" + total : total}`);
process.stdout.write(out.join("\n") + "\n\n");

// --- the gate: fail-closed on the success metric -----------------------------
if (c.total >= b.total) {
  process.stderr.write(
    `FAIL: founder burden did NOT drop for "${milestone}" — current ${c.total} >= baseline ${b.total}.\n` +
      `The success metric is "the founder no longer experiences the problem". A milestone that did not reduce founder actions cannot be called done. Fail-closed.\n`
  );
  process.exit(1);
}

process.stdout.write(
  `PASS: founder burden dropped for "${milestone}" — current ${c.total} < baseline ${b.total} (-${b.total - c.total} founder action(s)). v6 is working on the success metric for this milestone.\n`
);
process.exit(0);
