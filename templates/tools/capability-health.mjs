#!/usr/bin/env node
// =============================================================================
// Delivery OS — capability-health (v6 capability governance). Zero-dep. Fail-closed.
// =============================================================================
// The maturity matrix taught us a system can REPORT success while the behavior isn't
// happening. So this measures REALITY, not the ledger's self-report: for each
// OS-foundational capability it asks "is it actually WIRED to run in this project?" —
// ALIVE (inherited + invoked by a CI step / hook) vs INERT (present but nothing runs
// it) vs MISSING (not inherited) — and flags DRIFT where the ledger CLAIMS a stage the
// evidence contradicts. Exit non-zero on inert/drift (fail-closed governance).
//
// VALIDATE-THE-VALIDATOR (founder requirement): a health check that can't be trusted is
// just another lying green light. So `--self-test` re-proves capability-health's OWN
// accuracy against KNOWN synthetic states (a known-wired must read ALIVE; a known-inert
// must read INERT; a planted drift must read DRIFT) and fails if it MISCLASSIFIES. Run
// it periodically — that is the recurring check that the measurement system still
// measures reality. capability-health also measures ITSELF (no self-exemption).
//
//   node capability-health.mjs --project <path> [--manifest <p>] [--ledger <p>]
//   node capability-health.mjs --self-test          # validate-the-validator
// =============================================================================

import { readFileSync, existsSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const HERE = dirname(fileURLToPath(import.meta.url));
const DOS = join(HERE, "..", "..");

// Wiring tokens: how each OS-foundational capability is INVOKED when auto-executed
// (in a CI workflow or a hook). Presence of a token in the wiring text == wired-to-run.
const WIRING = {
  "seam-gate": ["seam:check", "seam-gate"],
  "lifecycle-gate": ["lifecycle:check", "lifecycle-gate"],
  "workflow-gate": ["workflow:check", "workflow-gate"],
  "experience-gate": ["experience:review", "experience:check", "experience-gate"],
  "skill-route": ["skill:route", "skill-route", "skills:check"],
  "skill-frontmatter": ["validate-skills", "skill-frontmatter", "skills:check"],
  "census-detector": ["census-detector", "census:check"],
  "os-inherit": ["os:check", "os-inherit"],
  "capability-health": ["capability-health", "health:check"], // self-measurement (no exemption)
  "learning-review": ["learning-review", "learning:review"],
  "file-lesson": ["file-lesson"],
};

// pure: classify one capability given whether it's inherited + the project's wiring text.
export function classify(name, { inherited, wiringText }) {
  const tokens = WIRING[name] || [name];
  const wired = tokens.some((t) => wiringText.includes(t));
  if (!inherited) return wired ? "ALIVE" : "MISSING"; // a non-vendored tool wired in CI is still ALIVE
  return wired ? "ALIVE" : "INERT";
}

// pure: does the ledger's stage claim contradict the measured status? (drift)
export function isDrift(ledgerStageClaim, status) {
  const claimsOperating = /auto-executed|\bused\b/i.test(ledgerStageClaim || "");
  return claimsOperating && (status === "INERT" || status === "MISSING");
}

// AUTO-EXECUTED contexts ONLY: CI workflows + hooks. A package.json script that CI never
// calls is "available", NOT auto-executed — so package.json is deliberately EXCLUDED
// (else every script would falsely read ALIVE). Wired-to-run == invoked by CI or a hook.
// Returns per-file sources so the report can cite WHERE a capability is wired (evidence).
function readWiringSources(projectDir) {
  const sources = [];
  for (const rel of [".github/workflows", ".githooks", ".claude/hooks"]) {
    const d = join(projectDir, rel);
    if (!existsSync(d)) continue;
    for (const f of readdirSync(d)) { try { sources.push({ file: `${rel}/${f}`, text: readFileSync(join(d, f), "utf8") }); } catch {} }
  }
  return sources;
}
const readWiringText = (projectDir) => readWiringSources(projectDir).map((s) => s.text).join("\n");
// the FIRST wiring file containing one of the capability's tokens (the trigger evidence)
function wiredEvidence(name, sources) {
  const tokens = WIRING[name] || [name];
  for (const s of sources) { const hit = tokens.find((t) => s.text.includes(t)); if (hit) return `${s.file} (${hit})`; }
  return null;
}
function inheritedSet(projectDir) {
  const set = new Set();
  const p = join(projectDir, ".claude", "os", "INHERITED.json");
  if (existsSync(p)) {
    try {
      for (const f of JSON.parse(readFileSync(p, "utf8")).files || []) {
        const rel = f.rel.replace(/\\/g, "/");
        const skill = rel.match(/skills\/([^/]+)\//); // a skill dir, not a .mjs basename
        set.add(skill ? skill[1] : rel.split("/").pop().replace(/\.mjs$/, ""));
      }
    } catch {}
  }
  return set;
}
function manifestNames(manifestPath) {
  const m = JSON.parse(readFileSync(manifestPath, "utf8"));
  const names = [...(m.tools || []), ...(m.contracts || [])].map((t) => t.split("/").pop().replace(/\.mjs$/, ""));
  for (const s of m.skills || []) names.push(s);
  return names.filter((n) => n !== "admin-plos-seam-v1"); // the contract isn't "run"
}

function measure() {
  const projectDir = opt("--project", process.cwd());
  const manifestPath = opt("--manifest", join(DOS, "capabilities", "os-foundation.manifest.json"));
  // PROJECT-FACING capabilities only = what the manifest says a project inherits (gates, router,
  // learning-review). OS-side governance tools (os-inherit/census/health/file-lesson) run from the OS
  // against projects — they are NOT project-vendored, so measuring them here would be a category error.
  const names = manifestNames(manifestPath);
  const sources = readWiringSources(projectDir);
  const wiringText = sources.map((s) => s.text).join("\n");
  const inh = inheritedSet(projectDir);
  const proj = projectDir.split(/[\\/]/).pop();
  const rows = names.map((n) => {
    const status = classify(n, { inherited: inh.has(n), wiringText });
    // EVIDENCE per cell: inherited = which project's INHERITED.json consumed it; ALIVE = the file that triggers it.
    const evidence = status === "ALIVE" ? `wired: ${wiredEvidence(n, sources)}`
      : status === "INERT" ? `inherited: ${proj}/.claude/os/INHERITED.json · wired: NONE`
      : `not in ${proj}/.claude/os/INHERITED.json`;
    return { name: n, status, evidence };
  });
  const inert = rows.filter((r) => r.status === "INERT");
  console.error(`capability-health · project=${proj} · ${rows.length} capabilities (evidence-backed)`);
  for (const r of rows) console.error(`  [${r.status.padEnd(7)}] ${r.name.padEnd(18)} — ${r.evidence}`);

  // --- PERMANENT REPORTING: diff vs the last snapshot → what MOVED / what REGRESSED ---
  // Evidence-only: statuses come from classify() (real wiring), never hand-set. The snapshot
  // is the prior committed measurement; --write-snapshot records the new one after a change.
  const RANK = { MISSING: 0, INERT: 1, ALIVE: 2 };
  const snapPath = opt("--snapshot", join(DOS, "capabilities", "health-snapshot.json"));
  let snap = {}; try { snap = JSON.parse(readFileSync(snapPath, "utf8")); } catch {}
  const moved = [], regressed = [];
  for (const r of rows) {
    const prev = (snap[proj] || {})[r.name];
    if (prev === undefined) continue;
    if (RANK[r.status] > RANK[prev]) moved.push(`${r.name}: ${prev} → ${r.status}`);
    else if (RANK[r.status] < RANK[prev]) regressed.push(`${r.name}: ${prev} → ${r.status}`);
  }
  console.error(`MOVED (improved since last snapshot): ${moved.length ? moved.join(" · ") : "none"}`);
  console.error(`REGRESSED (worse since last snapshot): ${regressed.length ? regressed.join(" · ") : "none"}`);
  if (argv.includes("--write-snapshot")) {
    snap[proj] = Object.fromEntries(rows.map((r) => [r.name, r.status]));
    writeFileSync(snapPath, JSON.stringify(snap, null, 2) + "\n");
    console.error(`snapshot updated: ${snapPath}`);
  }

  if (regressed.length) { console.error(`FAIL: ${regressed.length} capability(ies) REGRESSED (was operating, now not).`); process.exit(1); }
  if (inert.length) { console.error(`FAIL: ${inert.length} INERT (inherited/present but nothing runs them): ${inert.map((r) => r.name).join(", ")}`); process.exit(1); }
  console.error(`PASS: every measured capability is wired-to-run (ALIVE) in this project.`);
  process.exit(0);
}

// --- validate-the-validator: prove capability-health classifies KNOWN states correctly ---
function selfTest() {
  const cases = [
    { label: "known-wired → ALIVE", got: classify("seam-gate", { inherited: true, wiringText: "run: npm run seam:check" }), want: "ALIVE" },
    { label: "known-inert → INERT", got: classify("census-detector", { inherited: true, wiringText: "nothing here" }), want: "INERT" },
    { label: "not-inherited → MISSING", got: classify("workflow-gate", { inherited: false, wiringText: "" }), want: "MISSING" },
    { label: "wired-but-not-vendored → ALIVE", got: classify("seam-gate", { inherited: false, wiringText: "seam:check" }), want: "ALIVE" },
    { label: "drift: claims Auto-executed but INERT", got: isDrift("Auto-executed (Admin CI)", "INERT") ? "DRIFT" : "ok", want: "DRIFT" },
    { label: "no-drift: claims Verified + INERT", got: isDrift("Verified — INERT", "INERT") ? "DRIFT" : "ok", want: "ok" },
  ];
  let fail = 0;
  console.error(`capability-health --self-test (validate-the-validator):`);
  for (const c of cases) { const ok = c.got === c.want; if (!ok) fail++; console.error(`  ${ok ? "PASS" : "FAIL"}  ${c.label} (got ${c.got}, want ${c.want})`); }
  if (fail) { console.error(`FAIL: capability-health MISCLASSIFIED ${fail} known state(s) — the measurement system is NOT trustworthy.`); process.exit(1); }
  console.error(`PASS: capability-health classifies all known states correctly — it measures reality.`);
  process.exit(0);
}

if (argv.includes("--self-test")) selfTest();
else measure();
