#!/usr/bin/env node
// Delivery OS — verify-gate (Governance §12). The ONLY enforcement element that fires
// without the orchestrator choosing to. Cross-platform (Node ESM, no bash dependency).
//
//   node .claude/hooks/verify-gate.mjs <mode>
//   mode = pre-commit | post-write | stop   (dispatched from .claude/settings.json)
//
// It blocks a slice from advancing when IMPLEMENTATION files changed without a fresh,
// passing, INDEPENDENT docs/verify/VERIFY-<slice>.md. It checks that such an artifact
// EXISTS and is well-formed — it cannot prove the verification was truthful (see §12
// "Honest limit"). The committed .githooks/pre-push is the model-independent backstop.
//
// Bypass (loud, logged, deliberate): set DELIVERY_OS_GATE_BYPASS=1 to allow through.
// Use only during bootstrap/debugging — every bypass prints a visible warning.

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { join } from "node:path";

const MODE = process.argv[2] || "stop";
const ROOT = process.cwd();
const STATE = join(ROOT, ".claude", ".verify-state.json");
const VERIFY_DIRS = ["docs/verify", "docs"];

// Implementation surfaces the gate protects. Everything else (tests, docs, evals, config) is exempt.
const IMPL = /^(src|app|lib|api|migrations|db|packages\/[^/]+\/src)\//;
const NONIMPL = /(^|\/)(tests?|e2e|evals|docs|\.claude)\/|\.(md|test|spec)\.|\.md$/;

const readStdin = () => { try { return JSON.parse(readFileSync(0, "utf8")); } catch { return {}; } };
const hasGit = () => { try { execSync("git rev-parse --git-dir", { stdio: "ignore" }); return true; } catch { return false; } };
const mtime = (p) => { try { return statSync(p).mtimeMs; } catch { return 0; } };

function readState() { try { return JSON.parse(readFileSync(STATE, "utf8")); } catch { return { baseline_ts: 0 }; } }
function writeState(s) { try { writeFileSync(STATE, JSON.stringify(s)); } catch { /* non-fatal */ } }

// --- which implementation files changed since the last verification baseline ---
function changedImpl() {
  let files = [];
  if (hasGit()) {
    try {
      const out = execSync("git status --porcelain --untracked-files=all", { encoding: "utf8" });
      files = out.split("\n").map((l) => l.slice(3).trim()).filter(Boolean);
    } catch { /* fall through */ }
  } else {
    const base = readState().baseline_ts || 0;
    files = walk(ROOT).filter((f) => mtime(f) > base).map((f) => f.slice(ROOT.length + 1).replace(/\\/g, "/"));
  }
  return files.filter((f) => IMPL.test(f) && !NONIMPL.test(f));
}

function walk(dir, acc = []) {
  let entries = [];
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return acc; }
  for (const e of entries) {
    if (/^(node_modules|\.git|dist|build|\.claude)$/.test(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, acc); else acc.push(p);
  }
  return acc;
}

// --- find a fresh, passing, independent VERIFY artifact ---
function frontmatter(file) {
  let txt = ""; try { txt = readFileSync(file, "utf8"); } catch { return {}; }
  const m = txt.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const fm = {};
  if (m) for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([a-z_]+):\s*(.+?)\s*$/i);
    if (kv) fm[kv[1].toLowerCase()] = kv[2].replace(/^["']|["']$/g, "");
  }
  return fm;
}

function freshPassArtifact(impl) {
  const newest = Math.max(0, ...impl.map((f) => mtime(join(ROOT, f))));
  for (const d of VERIFY_DIRS) {
    let names = []; try { names = readdirSync(join(ROOT, d)); } catch { continue; }
    for (const n of names) {
      if (!/^VERIFY-.*\.md$/i.test(n)) continue;
      const p = join(ROOT, d, n);
      if (mtime(p) < newest) continue;                       // stale → does not count
      const fm = frontmatter(p);
      const passing = String(fm.verify_status).toLowerCase() === "verified";
      const independent = fm.verifier && fm.author && fm.verifier !== fm.author; // best-effort
      if (passing && independent) return { path: `${d}/${n}`, fm };
    }
  }
  return null;
}

// --- output helpers (Claude Code hook protocol) ---
const emit = (o) => { process.stdout.write(JSON.stringify(o)); process.exit(0); };
const warn = (msg) => { process.stderr.write(`[verify-gate] ${msg}\n`); process.exit(0); };

function blocked(impl) {
  const list = impl.slice(0, 6).join(", ") + (impl.length > 6 ? ` …(+${impl.length - 6})` : "");
  return `BLOCKED by Delivery OS verify-gate (Governance §12).\n` +
    `Implementation files changed (${list}) but no fresh, passing, INDEPENDENT ` +
    `docs/verify/VERIFY-<slice>.md exists (verify_status: verified, author ≠ verifier, newer than the code).\n` +
    `This is "ready for QA" — not "done". Run an INDEPENDENT verifier on the running thing ` +
    `(template: delivery-os/templates/VERIFY.md.template), capture real execution evidence, then proceed.`;
}

// ---- main ----
const input = readStdin();

if (process.env.DELIVERY_OS_GATE_BYPASS === "1") {
  warn("⚠ DELIVERY_OS_GATE_BYPASS=1 — verify-gate skipped. This bypass is logged. Remove before shipping.");
}

try {
  if (MODE === "post-write") {
    // never blocks (the write already happened); refresh baseline + advisory warn
    const impl = changedImpl();
    writeState({ baseline_ts: Date.now() });
    if (impl.length && !freshPassArtifact(impl))
      warn(`implementation changed — a fresh docs/verify/VERIFY-<slice>.md (verify_status: verified) is now required before commit/done.`);
    process.exit(0);
  }

  if (MODE === "pre-commit") {
    const cmd = input?.tool_input?.command || "";
    if (!/\bgit\s+(commit|push)\b/.test(cmd)) process.exit(0); // only guard commit/push
    const impl = changedImpl();
    if (impl.length && !freshPassArtifact(impl))
      emit({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: blocked(impl) } });
    process.exit(0);
  }

  if (MODE === "stop") {
    const impl = changedImpl();
    if (impl.length && !freshPassArtifact(impl)) emit({ decision: "block", reason: blocked(impl) });
    process.exit(0);
  }
} catch (err) {
  // fail-closed on commit/stop (honest failure, Governance §5); fail-open on post-write
  const reason = `verify-gate could not evaluate (${err?.message || err}). Failing closed — verification cannot be confirmed.`;
  if (MODE === "pre-commit") emit({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason } });
  if (MODE === "stop") emit({ decision: "block", reason });
  warn(reason);
}
process.exit(0);
