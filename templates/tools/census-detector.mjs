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

import { readFileSync, existsSync, appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
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
    const e = byPattern.get(key) || { pattern: s.pattern, sources: new Set(), triaged: false, capability: null };
    if (s.source) e.sources.add(norm(s.source));
    if (s.capability) { e.triaged = true; e.capability = s.capability; }
    byPattern.set(key, e);
  }
  const candidates = [], watch = [], triaged = [];
  for (const e of byPattern.values()) {
    const n = e.sources.size;
    if (e.triaged) triaged.push({ ...e, n });
    else if (n >= THRESHOLD) candidates.push({ ...e, n });
    else if (n >= 2) watch.push({ ...e, n });
  }
  candidates.sort((a, b) => b.n - a.n);
  return { candidates, watch, triaged };
}

const signals = loadSignals(SIGNALS);
const { candidates, watch, triaged } = census(signals);

console.error(`census-detector · ${signals.length} signal(s) · threshold ${THRESHOLD}× distinct sources · triaged ${triaged.length} · watch ${watch.length}`);
for (const w of watch) console.error(`  watch (${w.n}×): ${w.pattern}`);

if (candidates.length === 0) {
  console.error(`PASS: no un-triaged pattern has recurred >=${THRESHOLD}× — every recurring lesson is a capability (or below threshold).`);
  process.exit(0);
}

console.error(`FAIL: ${candidates.length} un-triaged recurring pattern(s) MUST become a capability (extraction over accumulation):`);
for (const c of candidates) console.error(`  CANDIDATE (${c.n}×): ${c.pattern}`);
if (APPEND && existsSync(APPEND)) {
  const stamp = candidates.map((c) => `| (census) ${c.pattern} | recurred ${c.n}× across distinct sources | (triage) | **AUTO** | census-detector: un-triaged >=${THRESHOLD}× recurrence — convert to a capability |`).join("\n");
  appendFileSync(APPEND, `\n<!-- census-detector auto-appended candidates -->\n${stamp}\n`);
  console.error(`  -> appended ${candidates.length} candidate(s) to ${APPEND} (the ONE canonical ledger).`);
}
process.exit(1);
