#!/usr/bin/env node
// =============================================================================
// Delivery OS — verify-independence-ci (SERVER-SIDE author≠verifier, board 2026-06-25).
// Proves Governance §3/§12 independence from GIT IDENTITY — not from frontmatter
// strings a single author can type for both roles. On a PR it asserts that the set
// of committers of the IMPL files is DISJOINT from the set of committers of the
// VERIFY docs over <base>..HEAD. Fail-closed: a single shared identity, an empty
// verifier set, or any error → FAIL (and points at the platform CODEOWNER path).
//
// THE STRONGEST PROOF IS THE PLATFORM, NOT THIS SCRIPT.
//   GitHub branch-protection `require_code_owner_reviews` over `/docs/verify/` bars
//   the impl author from self-approving the VERIFY: a different human MUST review it.
//   This in-CI check is the COMPLEMENT — it catches a same-identity author+verifier
//   inside the PR's own commit history before merge. setup-branch-protection.mjs
//   installs the platform half; this script is the runtime half. Use BOTH.
//
// USAGE
//   node verify-independence-ci.mjs --base <ref> [--pr N] [--author LOGIN] [--root DIR] [--json]
//   node verify-independence-ci.mjs --self-test
//
// Zero external deps — node builtins only.
// =============================================================================

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

// ── impl-file selection — MIRRORS verify-fingerprint.mjs (the canonical surface) ─
const IMPL_BASE = /^(src|app|lib|api|migrations|db)\/|^(apps|packages|services)\/[^/]+\//;
const NONIMPL = /(^|\/)(tests?|e2e|evals|docs|\.claude|node_modules|dist|build|\.next|out|coverage)\/|\.(test|spec)\.|\.md$/;
function implExtra(root) {
  try { const c = JSON.parse(readFileSync(join(root, ".claude", ".verify-config.json"), "utf8")); return Array.isArray(c.impl_extra) ? c.impl_extra : []; }
  catch { return []; }
}
const isImpl = (f, extra) => IMPL_BASE.test(f) || extra.some((p) => f.startsWith(p));

// ── the pure independence decision (testable without git) ────────────────────────
// authorEmails  = identities that committed IMPL changes in the range.
// verifierEmails = identities that committed VERIFY docs in the range.
// Independent iff: at least one verifier exists AND the sets are DISJOINT. A single
// shared identity (the same human authored impl AND its VERIFY) → fail-closed.
export function assertIndependent({ authorEmails, verifierEmails, implChanged }) {
  const authors = new Set((authorEmails || []).map((e) => String(e).trim().toLowerCase()).filter(Boolean));
  const verifiers = new Set((verifierEmails || []).map((e) => String(e).trim().toLowerCase()).filter(Boolean));

  if (!implChanged || authors.size === 0) {
    // No impl commits attributable in-range → nothing to independently verify here.
    return { ok: true, authors: [...authors], verifiers: [...verifiers], reason: "no impl commits in range — independence not required (coverage gate governs impl)" };
  }
  if (verifiers.size === 0) {
    return { ok: false, authors: [...authors], verifiers: [], reason: "no VERIFY commit in this PR's range — an independent verifier's commit is required (or use the CODEOWNER-review path on /docs/verify/)" };
  }
  const overlap = [...authors].filter((a) => verifiers.has(a));
  if (overlap.length) {
    return {
      ok: false,
      authors: [...authors],
      verifiers: [...verifiers],
      overlap,
      reason: `author≠verifier VIOLATED: identity/identities authored BOTH impl and VERIFY: ${overlap.join(", ")}. Fail-closed. Require the GitHub CODEOWNER-review path (a different human approves /docs/verify/).`,
    };
  }
  return { ok: true, authors: [...authors], verifiers: [...verifiers], reason: "author and verifier identity sets are disjoint (independence proven from git committer identity)" };
}

// ── git plumbing ─────────────────────────────────────────────────────────────────
function git(args, root) {
  try { return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); }
  catch { return ""; }
}
function emails(lines) { return [...new Set(lines.split("\n").map((l) => l.trim()).filter(Boolean))]; }

export function gatherIdentities({ base, root }) {
  const range = base ? `${base}..HEAD` : "HEAD";
  // changed impl files in range
  const changed = git(["diff", "--name-only", base || "HEAD", "HEAD"], root)
    .split("\n").map((l) => l.trim()).filter(Boolean);
  const extra = implExtra(root);
  const implFiles = changed.filter((f) => isImpl(f, extra) && !NONIMPL.test(f));
  // %ae = author email; covers committer identity of the impl commits in-range.
  const authorEmails = implFiles.length
    ? emails(git(["log", "--format=%ae", range, "--", ...implFiles], root))
    : [];
  // committers of the VERIFY docs in-range
  const verifierEmails = emails(git(["log", "--format=%ae", range, "--", "docs/verify/"], root));
  return { implFiles, authorEmails, verifierEmails };
}

// ── CLI ─────────────────────────────────────────────────────────────────────────
function flag(argv, name) { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; }

function runCli(argv) {
  const root = flag(argv, "--root") || process.cwd();
  const base = flag(argv, "--base");
  const pr = flag(argv, "--pr");
  const authorLogin = flag(argv, "--author");
  const asJson = argv.includes("--json");

  let id;
  try { id = gatherIdentities({ base, root }); }
  catch (e) {
    const fail = { ok: false, error: String(e && e.message || e), reason: "fail-closed: could not gather git identities" };
    if (asJson) console.log(JSON.stringify(fail, null, 2)); else console.error(`::error::verify-independence FAILED CLOSED: ${fail.reason} (${fail.error})`);
    process.exit(1);
  }

  const decision = assertIndependent({
    authorEmails: id.authorEmails,
    verifierEmails: id.verifierEmails,
    implChanged: id.implFiles.length > 0,
  });
  const out = { ...decision, pr: pr || null, authorLogin: authorLogin || null, implFiles: id.implFiles };

  if (asJson) { console.log(JSON.stringify(out, null, 2)); process.exit(decision.ok ? 0 : 1); }

  console.error(`verify-independence${pr ? ` (PR #${pr})` : ""}: impl committers [${out.authors.join(", ") || "—"}] vs VERIFY committers [${out.verifiers.join(", ") || "—"}]`);
  if (decision.ok) { console.error(`verify-independence PASS — ${decision.reason}`); process.exit(0); }
  console.error(`::error::verify-independence FAIL — ${decision.reason}`);
  console.error("Remedy: have a DIFFERENT identity author the VERIFY, OR rely on GitHub branch-protection require_code_owner_reviews over /docs/verify/ (a different human must approve — the platform bars self-approval). See setup-branch-protection.mjs.");
  process.exit(1);
}

// ── self-test (pure; proves the decision table) ──────────────────────────────────
function runSelfTest() {
  const results = [];
  const check = (label, pass, detail = "") => { results.push({ label, pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${label}${detail ? "  — " + detail : ""}`); };

  const disjoint = assertIndependent({ authorEmails: ["dev@x.io"], verifierEmails: ["qa@x.io"], implChanged: true });
  check("1 disjoint author/verifier identities → ok=true", disjoint.ok === true, disjoint.reason);

  const same = assertIndependent({ authorEmails: ["dev@x.io"], verifierEmails: ["dev@x.io"], implChanged: true });
  check("2 same single identity authored both → ok=false (fail-closed)", same.ok === false && (same.overlap || []).includes("dev@x.io"), same.reason);

  const partial = assertIndependent({ authorEmails: ["dev@x.io", "qa@x.io"], verifierEmails: ["qa@x.io"], implChanged: true });
  check("3 any overlap (qa authored impl too) → ok=false", partial.ok === false && (partial.overlap || []).includes("qa@x.io"), partial.reason);

  const noVerifier = assertIndependent({ authorEmails: ["dev@x.io"], verifierEmails: [], implChanged: true });
  check("4 impl changed but NO VERIFY commit in range → ok=false (fail-closed)", noVerifier.ok === false, noVerifier.reason);

  const noImpl = assertIndependent({ authorEmails: [], verifierEmails: ["qa@x.io"], implChanged: false });
  check("5 no impl commits in range → ok=true (coverage gate governs impl)", noImpl.ok === true, noImpl.reason);

  const caseFold = assertIndependent({ authorEmails: ["Dev@X.io"], verifierEmails: ["dev@x.io"], implChanged: true });
  check("6 identity match is case-insensitive (Dev@X.io ≡ dev@x.io) → ok=false", caseFold.ok === false, caseFold.reason);

  check("7 impl-glob mirror: src/x.mjs impl; docs/ + tests/ excluded",
    isImpl("src/x.mjs", []) && !NONIMPL.test("src/x.mjs") && NONIMPL.test("docs/verify/VERIFY-x.md") && NONIMPL.test("tests/a.test.mjs"));

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  if (failed.length) { console.error(`SELF-TEST FAILED: ${failed.map((f) => f.label).join("; ")}`); process.exit(1); }
  console.log("SELF-TEST OK — author≠verifier is proven from git identity, fail-closed on a shared/empty identity.");
  process.exit(0);
}

// ── entrypoint ───────────────────────────────────────────────────────────────────
const isMain = (() => { try { return pathToFileURL(process.argv[1]).href === import.meta.url; } catch { return false; } })();
if (isMain) {
  const argv = process.argv.slice(2);
  if (argv.includes("--self-test")) runSelfTest();
  else runCli(argv);
}
