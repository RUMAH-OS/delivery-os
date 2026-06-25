#!/usr/bin/env node
// =============================================================================
// Delivery OS — setup-branch-protection (board 2026-06-25). The one-time, per-repo
// ADMIN action that makes the server-side verify gate BINDING: it sets the GitHub
// branch-protection ruleset on dev/main so a PR cannot merge until `verify-coverage`
// is green AND a CODEOWNER has reviewed (the platform half of author≠verifier).
//
// THIS IS NOT AUTO-RUN. The founder / os-inherit runs it ONCE per repo with an admin
// token (`gh auth login` as a repo admin, or GH_TOKEN with admin:repo). Default is
// DRY — it PRINTS the payload + the exact `gh api` command and changes nothing. Pass
// `--apply` to actually PUT the protection. It is orthogonal to the C6 human-merge
// label gate (promote-to-prod.yml) — it STRENGTHENS the verification floor, never
// replaces the founder-approval gate.
//
// USAGE
//   node setup-branch-protection.mjs --repo owner/name --branch main        # DRY (default)
//   node setup-branch-protection.mjs --repo owner/name --branch dev --apply # one-time admin action
//   node setup-branch-protection.mjs --self-test
//
// Zero external deps; `--apply` shells out to the GitHub CLI (`gh`).
// =============================================================================

import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

// The required check the server-side gate publishes (verify-coverage.yml `name:`/job).
const REQUIRED_CHECK = "verify-coverage";

// ── the branch-protection payload (GitHub PUT .../branches/<b>/protection) ────────
// All four top-level keys are REQUIRED by the API (nullable ones sent as null).
//   required_status_checks.strict:true     — branch must be up to date before merge.
//   contexts:[verify-coverage]             — the server-side gate is a REQUIRED check.
//   require_code_owner_reviews:true        — the platform half of author≠verifier:
//                                            a CODEOWNER (a different human) must approve.
//   dismiss_stale_reviews:true             — a new push re-opens review (no stale rubber-stamp).
//   enforce_admins:true                    — admins are NOT exempt (no self-bypass).
//   allow_force_pushes:false / required_linear_history:true — history is auditable.
export function buildPayload() {
  return {
    required_status_checks: { strict: true, contexts: [REQUIRED_CHECK] },
    enforce_admins: true,
    required_pull_request_reviews: {
      require_code_owner_reviews: true,
      required_approving_review_count: 1,
      dismiss_stale_reviews: true,
    },
    restrictions: null,
    allow_force_pushes: false,
    required_linear_history: true,
  };
}

// The `gh api` invocation (argv array; payload piped on stdin via `--input -`).
export function ghArgs(repo, branch) {
  return [
    "api",
    "--method", "PUT",
    "-H", "Accept: application/vnd.github+json",
    `repos/${repo}/branches/${branch}/protection`,
    "--input", "-",
  ];
}

function printDry(repo, branch, payload) {
  const json = JSON.stringify(payload, null, 2);
  console.log(`# DRY RUN — nothing changed. One-time per-repo ADMIN action (needs an admin token).`);
  console.log(`# Repo: ${repo}   Branch: ${branch}   Required check: ${REQUIRED_CHECK}`);
  console.log(`#`);
  console.log(`# Payload:`);
  console.log(json);
  console.log(`#`);
  console.log(`# Command (run as a repo admin):`);
  console.log(`echo '${json.replace(/'/g, "'\\''")}' | gh ${ghArgs(repo, branch).join(" ")}`);
  console.log(`#`);
  console.log(`# Re-run with --apply to set protection. Repeat per branch (main AND dev).`);
}

function apply(repo, branch, payload) {
  const json = JSON.stringify(payload);
  try {
    const out = execFileSync("gh", ghArgs(repo, branch), { input: json, encoding: "utf8", stdio: ["pipe", "pipe", "inherit"] });
    console.log(`Applied branch protection to ${repo}@${branch} (required check: ${REQUIRED_CHECK}, require_code_owner_reviews:true).`);
    if (out && out.trim()) console.log(out.trim());
    process.exit(0);
  } catch (e) {
    console.error(`::error::Failed to apply branch protection to ${repo}@${branch}: ${e && e.message || e}`);
    console.error("Needs an ADMIN token (gh auth as a repo admin, or GH_TOKEN with admin rights). Fail-closed — nothing changed.");
    process.exit(1);
  }
}

// ── CLI ─────────────────────────────────────────────────────────────────────────
function flag(argv, name) { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; }

function runCli(argv) {
  const repo = flag(argv, "--repo");
  const branch = flag(argv, "--branch");
  if (!repo || !branch) {
    console.error("usage: setup-branch-protection.mjs --repo owner/name --branch <main|dev> [--apply]");
    console.error("       (DRY by default — prints the payload + gh command; --apply sets protection.)");
    process.exit(2);
  }
  const payload = buildPayload();
  if (argv.includes("--apply")) apply(repo, branch, payload);
  else printDry(repo, branch, payload);
}

// ── self-test (pure; proves the payload shape) ───────────────────────────────────
function runSelfTest() {
  const results = [];
  const check = (label, pass, detail = "") => { results.push({ label, pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${label}${detail ? "  — " + detail : ""}`); };
  const p = buildPayload();

  check("1 verify-coverage is a REQUIRED status check (strict)", p.required_status_checks.strict === true && p.required_status_checks.contexts.includes("verify-coverage"));
  check("2 require_code_owner_reviews:true (platform half of author≠verifier)", p.required_pull_request_reviews.require_code_owner_reviews === true);
  check("3 required_approving_review_count:1", p.required_pull_request_reviews.required_approving_review_count === 1);
  check("4 dismiss_stale_reviews:true (a new push re-opens review)", p.required_pull_request_reviews.dismiss_stale_reviews === true);
  check("5 enforce_admins:true (no admin self-bypass)", p.enforce_admins === true);
  check("6 allow_force_pushes:false", p.allow_force_pushes === false);
  check("7 required_linear_history:true", p.required_linear_history === true);
  check("8 all four API-required top-level keys present (restrictions sent as null)",
    "required_status_checks" in p && "enforce_admins" in p && "required_pull_request_reviews" in p && "restrictions" in p && p.restrictions === null);
  check("9 ghArgs is a PUT to the branch protection endpoint", JSON.stringify(ghArgs("o/r", "main")) === JSON.stringify(["api", "--method", "PUT", "-H", "Accept: application/vnd.github+json", "repos/o/r/branches/main/protection", "--input", "-"]));
  check("10 payload is valid JSON round-trips", JSON.stringify(JSON.parse(JSON.stringify(p))) === JSON.stringify(p));

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  if (failed.length) { console.error(`SELF-TEST FAILED: ${failed.map((f) => f.label).join("; ")}`); process.exit(1); }
  console.log("SELF-TEST OK — branch-protection payload makes verify-coverage required + require_code_owner_reviews enforced.");
  process.exit(0);
}

// ── entrypoint ───────────────────────────────────────────────────────────────────
const isMain = (() => { try { return pathToFileURL(process.argv[1]).href === import.meta.url; } catch { return false; } })();
if (isMain) {
  const argv = process.argv.slice(2);
  if (argv.includes("--self-test")) runSelfTest();
  else runCli(argv);
}
