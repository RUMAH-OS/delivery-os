#!/usr/bin/env node
// Machine-probe — check-os-drift accepts declared REAL GitHub identities in CODEOWNERS.
// Independent QA re-executable: exit 0 ⇔ all three acceptance criteria still hold.
//
//   node docs/verify/probes/check-os-drift-real-identities.probe.mjs
//
// Builds RUN-UNIQUE fixture roots under the OS temp dir (never in the repo), runs
// templates/tools/check-os-drift.mjs with cwd=fixture (the lint uses process.cwd()),
// and ASSERTS:
//   C1 declared real identity (@bkasanwiredjo in .claude/codeowners-humans.txt) → exit 0
//   C2 undeclared phantom handle, no agent file                                 → exit 1 + "void author≠verifier binding"
//   C3 handle backed by .claude/agents/<handle>.md                              → exit 0
// The phantom-agent guard must still HOLD (C2) — accepting real identities must not weaken it.

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..", "..");                       // docs/verify/probes → repo root
const DRIFT = join(REPO, "templates", "tools", "check-os-drift.mjs");
const RUN = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;   // run-unique token
const PHANTOM = `nope-phantom-${RUN}`;

const work = mkdtempSync(join(tmpdir(), "drift-ri-"));
const results = [];
const log = (...a) => console.log(...a);

// Build a fixture dir with the given file map ({ relPath: contents }), return its abs path.
function fixture(name, files) {
  const dir = join(work, name);
  for (const [rel, contents] of Object.entries(files)) {
    const p = join(dir, rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, contents);
  }
  mkdirSync(dir, { recursive: true });
  return dir;
}

// Run the lint with cwd = fixture; return { code, out } (out = stdout+stderr verbatim).
function runDrift(dir) {
  const r = spawnSync(process.execPath, [DRIFT], { cwd: dir, encoding: "utf8" });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
}

function assert(label, pass, detail = "") {
  results.push({ label, pass });
  log(`${pass ? "PASS" : "FAIL"}  ${label}${detail ? "\n      " + detail.replace(/\n/g, "\n      ") : ""}`);
}

// ── Criterion 1 — declared real identity in codeowners-humans.txt → exit 0 ──────────────────────────
const c1 = fixture("c1-declared-identity", {
  "CODEOWNERS": "* @bkasanwiredjo\n",
  ".claude/codeowners-humans.txt": "# real GitHub humans/bots (one handle per line)\n@bkasanwiredjo\n",
});
const r1 = runDrift(c1);
log(`\n[C1] node check-os-drift.mjs  (cwd=${c1})  exit=${r1.code}\n${r1.out}`);
assert("C1 declared real identity (@bkasanwiredjo) → exit 0",
  r1.code === 0 && !/void author≠verifier binding/.test(r1.out),
  `exit=${r1.code}`);

// ── Criterion 2 — undeclared phantom handle, no agent file → exit 1 + FAIL message ──────────────────
const c2 = fixture("c2-phantom", {
  "CODEOWNERS": `* @${PHANTOM}\n`,
  // deliberately NO codeowners-humans.txt declaration and NO agents/<handle>.md
});
const r2 = runDrift(c2);
log(`\n[C2] node check-os-drift.mjs  (cwd=${c2})  exit=${r2.code}\n${r2.out}`);
assert(`C2 undeclared phantom (@${PHANTOM}) → exit 1 + "void author≠verifier binding" (guard HOLDS)`,
  r2.code === 1 && new RegExp(`CODEOWNERS binds @${PHANTOM}[\\s\\S]*void author≠verifier binding`).test(r2.out),
  `exit=${r2.code}`);

// ── Criterion 3 — handle backed by .claude/agents/<handle>.md → exit 0 (regression) ─────────────────
const agentHandle = `qa-agent-${RUN}`;
const c3 = fixture("c3-agent-file", {
  "CODEOWNERS": `* @${agentHandle}\n`,
  [`.claude/agents/${agentHandle}.md`]: "# agent role\n",
});
const r3 = runDrift(c3);
log(`\n[C3] node check-os-drift.mjs  (cwd=${c3})  exit=${r3.code}\n${r3.out}`);
assert(`C3 agent-backed handle (@${agentHandle}) → exit 0 (regression: agent path intact)`,
  r3.code === 0 && !/void author≠verifier binding/.test(r3.out),
  `exit=${r3.code}`);

// ── verdict ─────────────────────────────────────────────────────────────────────────────────────────
rmSync(work, { recursive: true, force: true });
const failed = results.filter((r) => !r.pass);
log(`\n${results.length - failed.length}/${results.length} criteria passed.`);
if (failed.length) {
  console.error(`PROBE FAILED: ${failed.map((f) => f.label).join("; ")}`);
  process.exit(1);
}
log("PROBE OK — declared real identities accepted, phantom-agent guard holds.");
process.exit(0);
