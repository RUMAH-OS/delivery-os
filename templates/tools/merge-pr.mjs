#!/usr/bin/env node
// Delivery OS — the MECHANICAL MERGE GATE (v4; promoted from a consumer's production script,
// in use for every merge since its incident).
//
// The only sanctioned way to merge a PR (DoD row 9: "human merge VIA the gate"). It queries the
// GitHub checks API machine-readably and hard-fails on anything but explicit all-green — never
// parses piped/watched output for a gate decision. Earned: a merge once ran on red CI because an
// orchestrator pipe swallowed the failing status; the hotfix landed a PR later. Merge is the only
// transition that mints "done", so it gets a machine, not a habit.
//
// USAGE: node merge-pr.mjs <pr-number> [--no-delete-branch]
// Requires `gh` on PATH and an authenticated session.
// THIS GATE HAS NO OVERRIDE FLAG ON PURPOSE.

import { execFileSync } from "node:child_process";
import { argv, exit } from "node:process";

const pr = argv[2];
if (!pr || !/^\d+$/.test(pr)) { console.error("USAGE: merge-pr.mjs <pr-number> [--no-delete-branch]"); exit(1); }
const wantDelete = !argv.includes("--no-delete-branch");

function gh(args) { return execFileSync("gh", args, { encoding: "utf8" }); }

// 1. Wait for checks to settle (poll the API, never --watch output).
let checks;
for (;;) {
  checks = JSON.parse(gh(["pr", "checks", pr, "--json", "name,bucket"]));
  if (checks.length === 0) { console.error(`REFUSED: PR ${pr} reports zero checks — wait for CI to register, then re-run.`); exit(1); }
  if (checks.every((c) => c.bucket !== "pending")) break;
  await new Promise((r) => globalThis.setTimeout(r, 20000));
}

// 2. Hard gate: every check must be exactly "pass".
const bad = checks.filter((c) => c.bucket !== "pass");
if (bad.length > 0) {
  console.error(`BLOCKED: PR ${pr} is not green. Failing/skipped checks:`);
  for (const c of bad) console.error(`  - ${c.name}: ${c.bucket}`);
  console.error("Fix the cause (or file the flake) first. This gate does not have an override flag on purpose.");
  exit(1);
}

// 3. Merge (squash, per the standing rule). Branch deletion is SEPARATE and NON-FATAL:
//    the known papercut — `gh pr merge --delete-branch` can fail on the deletion AFTER a successful
//    merge, exiting non-zero and making a green merge look failed. The merge is the gate; the
//    branch delete is housekeeping.
console.log(`PR ${pr}: ${checks.length} checks, all pass — merging (squash).`);
console.log(gh(["pr", "merge", pr, "--squash"]));

if (wantDelete) {
  try {
    const head = JSON.parse(gh(["pr", "view", pr, "--json", "headRefName"])).headRefName;
    if (head) {
      execFileSync("git", ["push", "origin", "--delete", head], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      console.log(`branch '${head}' deleted.`);
    }
  } catch (err) {
    console.error(`NOTE: merge succeeded; branch deletion failed (non-fatal): ${err?.message || err}`);
    console.error("Delete the branch manually if you care; do NOT re-run the merge.");
  }
}
