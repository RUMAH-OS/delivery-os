#!/usr/bin/env node
// =============================================================================
// Delivery OS — file-lesson (the UPSTREAM hop of the capability lifecycle). Zero-dep.
// =============================================================================
// The canonical loop: Project → Lesson → Capability Candidate → delivery-os → OS
// Release → Inherited by ALL projects. This tool is the "Project → delivery-os" hop:
// any project files a lesson it learned into the ONE canonical signals corpus
// (capabilities/signals.jsonl), TAGGED with the source project. From there
// census-detector aggregates ACROSS projects, the ledger queues the candidate, it's
// built+verified in delivery-os, and os-inherit propagates it back DOWN to every
// project. So a failure learned in PLOS becomes a capability Admin inherits — and
// vice versa — without rediscovery.
//
//   node file-lesson.mjs --project plos --pattern "<lesson class>" --source "<where seen>" \
//        [--capability "<ledger ref if already addressed>"]
//
// Appends one line: { pattern, project, source:"<project>:<where>", capability?, date }.
// The `project` tag is what makes cross-project recurrence detectable (Admin learns from PLOS).
// =============================================================================

import { appendFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const argv = process.argv.slice(2);
const opt = (k) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] ? argv[i + 1] : null; };
const HERE = dirname(fileURLToPath(import.meta.url));
const SIGNALS = opt("--signals") || join(HERE, "..", "..", "capabilities", "signals.jsonl");

const project = opt("--project");
const pattern = opt("--pattern");
const where = opt("--source") || "unspecified";
const capability = opt("--capability");

if (!project || !pattern) {
  console.error('file-lesson: usage: node file-lesson.mjs --project <name> --pattern "<lesson class>" --source "<where>" [--capability "<ref>"]');
  console.error("  files a lesson from a project into the canonical capability-lifecycle (census → ledger → build → os-inherit → all projects).");
  process.exit(2);
}
if (!existsSync(SIGNALS)) { console.error(`file-lesson: canonical signals corpus not found at ${SIGNALS} (is --signals / the delivery-os checkout correct?)`); process.exit(2); }

const entry = {
  pattern: pattern.trim(),
  project: project.trim().toLowerCase(),
  source: `${project.trim().toLowerCase()}:${where.trim()}`,
  ...(capability ? { capability: capability.trim() } : {}),
  date: new Date().toISOString().slice(0, 10),
};
appendFileSync(SIGNALS, JSON.stringify(entry) + "\n");
console.error(`file-lesson: recorded into the canonical lifecycle —`);
console.error(`  project=${entry.project} · pattern="${entry.pattern}"${capability ? ` · capability=${capability}` : " · (un-triaged: census will flag it for promotion)"}`);
console.error(`  next: census-detector aggregates (cross-project) → ledger candidate → build+verify in delivery-os → os-inherit → every project inherits.`);
