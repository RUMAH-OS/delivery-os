#!/usr/bin/env node
// =============================================================================
// Delivery OS — census-detector (v6 capability #10). Zero-dep. Fail-closed.
// =============================================================================
// "Extraction over accumulation" made mechanical: a lesson that RECURS must become a
// CAPABILITY, not another prose note. This scans the append-only signals corpus
// (capabilities/signals.jsonl — learning-review + the gates append a {pattern, source}
// line whenever a lesson is observed) and, for any pattern seen across >= THRESHOLD
// DISTINCT sources that is NOT yet triaged (no capability addresses it), reports it as
// a CANDIDATE and EXITS NON-ZERO. So an un-triaged >=3x recurrence cannot quietly
// persist — the loop forces it into the ONE canonical ledger
// (capabilities/CAPABILITY-LEDGER.md). No second ledger, no second mechanism.
//
//   node census-detector.mjs [--signals <path>] [--threshold 3] [--append <ledger>]
//
// A signal line (JSONL): { "pattern": "<short lesson-class>", "source": "<where seen>",
//   "capability": "<ledger row / how it was addressed>"? }  // capability present => triaged
// =============================================================================

import { readFileSync, existsSync, appendFileSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const HERE = dirname(fileURLToPath(import.meta.url));
const SIGNALS = opt("--signals", join(HERE, "..", "..", "capabilities", "signals.jsonl"));
const THRESHOLD = Math.max(2, parseInt(opt("--threshold", "3"), 10) || 3);
const APPEND = argv.includes("--append") ? opt("--append", join(HERE, "..", "..", "capabilities", "CAPABILITY-LEDGER.md")) : null;

const norm = (s) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");

function loadSignals(path) {
  if (!existsSync(path)) { console.error(`census-detector: no signals file at ${path} (nothing to census yet).`); return []; }
  const out = [];
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("//") || t.startsWith("#")) continue;
    try { out.push(JSON.parse(t)); } catch { console.error(`census-detector: skipping unparseable signal line: ${t.slice(0, 80)}`); }
  }
  return out;
}

function census(signals) {
  const byPattern = new Map();
  for (const s of signals) {
    if (!s || !s.pattern) continue;
    const key = norm(s.pattern);
    const e = byPattern.get(key) || { pattern: s.pattern, sources: new Set(), projects: new Set(), triaged: false, capability: null };
    if (s.source) e.sources.add(norm(s.source));
    if (s.project) e.projects.add(norm(s.project));
    if (s.capability) { e.triaged = true; e.capability = s.capability; }
    byPattern.set(key, e);
  }
  const candidates = [], watch = [], triaged = [];
  for (const e of byPattern.values()) {
    const n = e.sources.size, p = e.projects.size;
    // CROSS-PROJECT recurrence (>=2 projects) is a promote-to-OS signal even below the raw
    // count threshold: a lesson hitting two projects is generalizable (Admin learns from PLOS).
    const crossProject = p >= 2;
    if (e.triaged) triaged.push({ ...e, n, p });
    else if (n >= THRESHOLD || crossProject) candidates.push({ ...e, n, p, crossProject });
    else if (n >= 2) watch.push({ ...e, n, p });
  }
  candidates.sort((a, b) => (b.p - a.p) || (b.n - a.n));
  return { candidates, watch, triaged };
}

// =============================================================================
// IDEMPOTENT append — re-runs MUST be no-ops.
// =============================================================================
// Before appending, READ the target ledger and collect the norm(pattern) of every row
// already auto-appended (keyed by the same norm() used for census aggregation). We skip any
// candidate whose normalized pattern already appears. So running census --append 100× appends
// each distinct pattern exactly once. The existing marker comment is kept; rows are keyed by
// norm(pattern), recovered from the row text via a stable "(census) <pattern> |" shape.
export function existingCandidateKeys(ledgerText) {
  const keys = new Set();
  for (const line of String(ledgerText || "").split(/\r?\n/)) {
    // match an auto-appended row: "| (census) <pattern> | recurred ..."
    const m = line.match(/^\|\s*\(census\)\s*(.+?)\s*\|\s*recurred\b/);
    if (m) keys.add(norm(m[1]));
  }
  return keys;
}

// Build the row text for a candidate (kept stable for existingCandidateKeys to recover).
export function candidateRow(c, threshold) {
  return `| (census) ${c.pattern} | recurred ${c.n}× across distinct sources | (triage) | **AUTO** | census-detector: un-triaged >=${threshold}× recurrence — convert to a capability |`;
}

// Append only the candidates not already present. Returns the list actually appended.
export function appendCandidates(ledgerPath, candidates, threshold) {
  if (!existsSync(ledgerPath)) return [];
  const existing = existingCandidateKeys(readFileSync(ledgerPath, "utf8"));
  const fresh = candidates.filter((c) => !existing.has(norm(c.pattern)));
  if (!fresh.length) return [];
  const stamp = fresh.map((c) => candidateRow(c, threshold)).join("\n");
  appendFileSync(ledgerPath, `\n<!-- census-detector auto-appended candidates -->\n${stamp}\n`);
  return fresh;
}

function run() {
  const signals = loadSignals(SIGNALS);
  const { candidates, watch, triaged } = census(signals);

  console.error(`census-detector · ${signals.length} signal(s) · threshold ${THRESHOLD}× distinct sources · triaged ${triaged.length} · watch ${watch.length}`);
  for (const w of watch) console.error(`  watch (${w.n}×): ${w.pattern}`);

  if (candidates.length === 0) {
    console.error(`PASS: no un-triaged pattern has recurred >=${THRESHOLD}× — every recurring lesson is a capability (or below threshold).`);
    process.exit(0);
  }

  console.error(`FAIL: ${candidates.length} un-triaged recurring pattern(s) MUST become a capability (extraction over accumulation):`);
  for (const c of candidates) console.error(`  CANDIDATE (${c.n}× · ${c.p} project${c.p === 1 ? "" : "s"})${c.crossProject ? " [CROSS-PROJECT → promote to delivery-os]" : ""}: ${c.pattern}`);
  if (APPEND && existsSync(APPEND)) {
    const appended = appendCandidates(APPEND, candidates, THRESHOLD);
    if (appended.length) console.error(`  -> appended ${appended.length} NEW candidate(s) to ${APPEND} (the ONE canonical ledger); ${candidates.length - appended.length} already present (idempotent skip).`);
    else console.error(`  -> no new candidates to append — all ${candidates.length} already present in ${APPEND} (idempotent no-op).`);
  }
  process.exit(1);
}

// =============================================================================
// --self-test (proves idempotency; no external corpus needed)
// =============================================================================
function selfTest() {
  const rf = readFileSync;
  let fail = 0;
  const ok = (label, cond) => { if (!cond) fail++; console.error(`  ${cond ? "PASS" : "FAIL"}  ${label}`); };
  console.error("census-detector --self-test:");

  // census aggregation: 3 distinct sources, un-triaged → candidate
  const sigs = [
    { pattern: "Push exits clean with no upstream", source: "a" },
    { pattern: "push exits clean with no upstream", source: "b" }, // norm-equal pattern, distinct source
    { pattern: "push exits clean   with no upstream", source: "c" },
  ];
  const { candidates } = census(sigs);
  ok("3 distinct sources of a norm-equal pattern → 1 candidate", candidates.length === 1);
  ok("candidate counts 3 distinct sources", candidates[0] && candidates[0].n === 3);

  // idempotent append: append twice → exactly one row.
  const dir = mkdtempSync(join(tmpdir(), "census-st-"));
  const ledger = join(dir, "LEDGER.md");
  writeFileSync(ledger, "# Ledger\n| existing | row | here | x | y |\n");

  const a1 = appendCandidates(ledger, candidates, THRESHOLD);
  const a2 = appendCandidates(ledger, candidates, THRESHOLD);
  const rows = rf(ledger, "utf8").split(/\r?\n/).filter((l) => /^\|\s*\(census\)/.test(l));
  ok("first append writes 1 candidate row", a1.length === 1);
  ok("second append writes 0 (idempotent)", a2.length === 0);
  ok("ledger contains exactly 1 census row after 2 appends", rows.length === 1);

  // 100× re-run → still exactly one row.
  for (let i = 0; i < 100; i++) appendCandidates(ledger, candidates, THRESHOLD);
  const rows100 = rf(ledger, "utf8").split(/\r?\n/).filter((l) => /^\|\s*\(census\)/.test(l));
  ok("100 re-runs → still exactly 1 census row", rows100.length === 1);

  if (fail) { console.error(`FAIL: ${fail} census-detector self-test assertion(s) failed.`); process.exit(1); }
  console.error("PASS: census-detector self-test green (aggregation + idempotent append).");
  process.exit(0);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  if (argv.includes("--self-test")) selfTest();
  else run();
}
