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

import { appendFileSync, existsSync, readFileSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const argv = process.argv.slice(2);
const opt = (k) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] ? argv[i + 1] : null; };
const HERE = dirname(fileURLToPath(import.meta.url));

const norm = (s) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");

// PURE + EXPORTED: sanitize one free-text field before it is stored.
// The corpus is JSONL (one JSON object per line) so `→` and `|` are SAFE inside a JSON string
// (JSON.stringify escapes nothing dangerous for them) — the historical corruption came from a
// field that carried RAW markdown (`**bold**`) and from values split on a `|`/`→` delimiter by a
// caller that built the line by hand. We therefore (a) strip markdown bold markers `**`, (b)
// collapse whitespace, and (c) leave `→`/`|` intact (JSON.stringify round-trips them). The whole
// record is always serialized with JSON.stringify (NEVER manual delimiter concatenation), so a
// value containing `→ | **` round-trips: JSON.parse(JSON.stringify(x)) === sanitize(x).
export function sanitizeField(s) {
  return String(s == null ? "" : s)
    .replace(/\*\*/g, "")        // strip markdown bold fences (the corruption marker)
    .replace(/\s+/g, " ")        // collapse internal/edge whitespace
    .trim();
}

// PURE + EXPORTED: build the canonical signal entry from inputs (all fields sanitized).
export function buildEntry({ project, pattern, where, capability }) {
  const cap = sanitizeField(capability);
  return {
    pattern: sanitizeField(pattern),
    project: sanitizeField(project).toLowerCase(),
    source: `${sanitizeField(project).toLowerCase()}:${sanitizeField(where) || "unspecified"}`,
    ...(cap ? { capability: cap } : {}),
    date: new Date().toISOString().slice(0, 10),
  };
}

// Does a {pattern, source} pair already exist in the corpus? (norm()-keyed, idempotency key)
export function signalExists(corpusText, entry) {
  for (const line of String(corpusText || "").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("//") || t.startsWith("#")) continue;
    let o; try { o = JSON.parse(t); } catch { continue; }
    if (norm(o.pattern) === norm(entry.pattern) && norm(o.source) === norm(entry.source)) return true;
  }
  return false;
}

// IDEMPOTENT file: append the signal only if its {pattern, source} pair is not already present.
// Returns { appended: bool, entry }.
export function fileLesson(signalsPath, { project, pattern, where, capability }) {
  const entry = buildEntry({ project, pattern, where, capability });
  const corpus = existsSync(signalsPath) ? readFileSync(signalsPath, "utf8") : "";
  if (signalExists(corpus, entry)) return { appended: false, entry };
  appendFileSync(signalsPath, JSON.stringify(entry) + "\n");
  return { appended: true, entry };
}

function run() {
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

  const { appended, entry } = fileLesson(SIGNALS, { project, pattern, where, capability });
  if (!appended) {
    console.error(`file-lesson: idempotent no-op — {pattern, source} already in the corpus —`);
    console.error(`  project=${entry.project} · pattern="${entry.pattern}" · source="${entry.source}" (already recorded; not duplicated).`);
    return;
  }
  console.error(`file-lesson: recorded into the canonical lifecycle —`);
  console.error(`  project=${entry.project} · pattern="${entry.pattern}"${capability ? ` · capability=${capability}` : " · (un-triaged: census will flag it for promotion)"}`);
  console.error(`  next: census-detector aggregates (cross-project) → ledger candidate → build+verify in delivery-os → os-inherit → every project inherits.`);
}

// =============================================================================
// --self-test (proves idempotency; no external corpus needed)
// =============================================================================
function selfTest() {
  let fail = 0;
  const ok = (label, cond) => { if (!cond) fail++; console.error(`  ${cond ? "PASS" : "FAIL"}  ${label}`); };
  console.error("file-lesson --self-test:");

  const dir = mkdtempSync(join(tmpdir(), "file-lesson-st-"));
  const corpus = join(dir, "signals.jsonl");
  writeFileSync(corpus, "// header\n");

  const lesson = { project: "rumah-admin", pattern: "a no-upstream push exits clean", where: "retro:SLICE-x" };
  const r1 = fileLesson(corpus, lesson);
  const r2 = fileLesson(corpus, lesson); // same lesson again
  const lines = readFileSync(corpus, "utf8").split(/\r?\n/).filter((l) => l.trim() && !l.startsWith("//"));
  ok("first file → appended", r1.appended === true);
  ok("second identical file → NOT appended (idempotent)", r2.appended === false);
  ok("corpus has exactly 1 signal line after filing twice", lines.length === 1);

  // a DIFFERENT source for the same pattern IS a distinct signal (census needs distinct sources).
  const r3 = fileLesson(corpus, { ...lesson, where: "retro:SLICE-y" });
  const lines2 = readFileSync(corpus, "utf8").split(/\r?\n/).filter((l) => l.trim() && !l.startsWith("//"));
  ok("same pattern, different source → appended (distinct signal)", r3.appended === true);
  ok("corpus has 2 signal lines (2 distinct sources)", lines2.length === 2);

  // whitespace-normalized pattern is treated as the same → idempotent
  const r4 = fileLesson(corpus, { ...lesson, pattern: "a no-upstream   push exits clean" });
  ok("whitespace-variant of an existing pattern+source → idempotent skip", r4.appended === false);

  // DEFECT REGRESSION: a value containing `→ | **` (arrow + pipe + markdown-bold) must round-trip
  // cleanly through the JSONL serialization — JSON.stringify handles `→`/`|`; sanitize strips `**`.
  // The corpus corruption (signals.jsonl lines ~21-48) was these characters mangling the record.
  const dir2 = mkdtempSync(join(tmpdir(), "file-lesson-rt-"));
  const corpus2 = join(dir2, "signals.jsonl");
  const rawPattern = "**npm checks spawned with `shell:false` on Windows → false FAIL | (no output)**";
  const rawCap = "false FAIL → `runTool` ran `npm.cmd` | fix: shell:true";
  const rt = fileLesson(corpus2, { project: "rumah-admin", pattern: rawPattern, where: "retro:SLICE-x | step→4", capability: rawCap });
  ok("round-trip lesson appended", rt.appended === true);
  // read it straight back: EVERY line must be valid JSON (no manual-delimiter mangling)
  const lines3 = readFileSync(corpus2, "utf8").split(/\r?\n/).filter((l) => l.trim());
  let parsed = null, allJson = true;
  for (const l of lines3) { try { parsed = JSON.parse(l); } catch { allJson = false; } }
  ok("`→ | **` line parses back as valid JSON (round-trips, not mangled)", allJson === true && parsed != null);
  // parse-back === sanitized input (markdown stripped, `→`/`|` preserved verbatim)
  const expectedPattern = sanitizeField(rawPattern); // bold fences gone, arrow+pipe kept
  const expectedCap = sanitizeField(rawCap);
  ok("parsed pattern === sanitize(input) (no `**`, `→`/`|` preserved)", parsed && parsed.pattern === expectedPattern);
  ok("parsed capability === sanitize(input) (no `**`, `→`/`|` preserved)", parsed && parsed.capability === expectedCap);
  ok("sanitized pattern contains no `**` markdown", !/\*\*/.test(parsed.pattern));
  ok("sanitized pattern STILL contains the `→` and `|` (only `**` stripped)", parsed.pattern.includes("→") && parsed.pattern.includes("|"));

  if (fail) { console.error(`FAIL: ${fail} file-lesson self-test assertion(s) failed.`); process.exit(1); }
  console.error("PASS: file-lesson self-test green (idempotent {pattern, source} de-dup).");
  process.exit(0);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  if (argv.includes("--self-test")) selfTest();
  else run();
}
