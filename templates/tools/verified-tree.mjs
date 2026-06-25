#!/usr/bin/env node
// =============================================================================
// Delivery OS — verified-tree (CI-dedup tree-hash marker). Zero-dep, Node ESM.
// git via execFileSync (no shell). READ-ONLY by default — it NEVER pushes a branch
// and only ever touches the refs/delivery-os/verified/* namespace, and even that
// ONLY behind an explicit --push.
// =============================================================================
// THE PROBLEM: a squash-merge changes the commit SHA, so "have we already verified
// this exact content?" cannot key on a commit. It MUST key on the TREE hash
// (`git rev-parse HEAD^{tree}`), which is squash-INVARIANT: identical content ->
// identical tree, regardless of how many commits or how it was merged. CI can then
// skip a re-verify when the tree is already marked verified.
//
// THE MARKER: a ref `refs/delivery-os/verified/<tree>` whose NAME is the tree hash
// (the value/commit is incidental). check() recomputes the tree and asks only
// "does that ref exist?" — fail-CLOSED: a miss, an invalid hash, or ANY error is a
// MISS (exit 1), so a broken lookup re-verifies rather than skipping verification.
//
//   import { verifiedRef, isVerified, decideMark, REF_PREFIX } from "./verified-tree.mjs"
//   node verified-tree.mjs mark  [--push]     # default: PRINT the ref + command, push NOTHING
//   node verified-tree.mjs check [ref|tree]   # exit 0 = hit (already verified), exit 1 = miss
//   node verified-tree.mjs --self-test
// =============================================================================

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const REF_PREFIX = "refs/delivery-os/verified/";

// verifiedRef(tree) -> the marker ref NAME (keyed on the tree, never a commit sha).
// Throws on a non-hash input so a garbage value can never become a real ref.
export function verifiedRef(tree) {
  const t = String(tree || "").trim();
  if (!/^[0-9a-f]{7,64}$/i.test(t)) throw new Error(`invalid tree hash: ${JSON.stringify(tree)}`);
  return REF_PREFIX + t.toLowerCase();
}

// isVerified(tree, refExists) -> boolean. `refExists(ref)` answers existence (live
// or injected). FAIL-CLOSED: an invalid tree or ANY thrown error returns false (a
// MISS) — we never report "already verified" on a lookup we could not complete.
export function isVerified(tree, refExists) {
  try {
    const ref = verifiedRef(tree);
    return !!refExists(ref);
  } catch {
    return false;
  }
}

// decideMark(tree, { push }) -> the intended action. PURE — performs no IO. Default
// is "print" (dry): the ref + the exact command are surfaced, NOTHING is pushed.
// The push target is ALWAYS the verified namespace, NEVER a branch.
export function decideMark(tree, { push = false } = {}) {
  const ref = verifiedRef(tree); // throws on a bad tree -> mark cannot target garbage
  if (!ref.startsWith(REF_PREFIX)) throw new Error("refusing: mark target is outside the verified namespace");
  return {
    tree: verifiedRef(tree).slice(REF_PREFIX.length),
    ref,
    action: push ? "push" : "print",
    command: ["git", "push", "origin", `HEAD:${ref}`], // pushes the verified ref ONLY; never a branch
  };
}

// --- live IO (read-only except an explicit --push of the verified ref) --------
function makeIO(cwd) {
  const git = (args) => execFileSync("git", args, { encoding: "utf8", cwd, stdio: ["ignore", "pipe", "pipe"] });
  return {
    tree() { return git(["rev-parse", "HEAD^{tree}"]).trim(); },
    // existence: local first (refs/), then the remote (CI-shared). Any failure -> false.
    refExists(ref) {
      try { execFileSync("git", ["show-ref", "--verify", "--quiet", ref], { cwd, stdio: "ignore" }); return true; }
      catch { /* not local — try the remote */ }
      try { return git(["ls-remote", "origin", ref]).trim().length > 0; }
      catch { return false; }
    },
    pushVerified(ref) {
      if (!ref.startsWith(REF_PREFIX)) throw new Error("refusing to push outside the verified namespace");
      return git(["push", "origin", `HEAD:${ref}`]);
    },
  };
}

// =============================================================================
// SELF-TEST (pure — no git, no network). Proves the squash-invariant keying, the
// hit/miss, and FAIL-CLOSED (error/invalid -> miss).
// =============================================================================
function selfTest() {
  const fails = [];
  const ok = (cond, msg) => { if (!cond) fails.push(msg); };

  const treeA = "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0";
  const treeB = "0f9e8d7c6b5a4039281706f5e4d3c2b1a0998877";

  // the marker is keyed on the TREE, not a commit sha
  ok(verifiedRef(treeA) === REF_PREFIX + treeA, "ref is keyed on the tree hash");
  ok(!/[0-9a-f]{40}.*commit/i.test(verifiedRef(treeA)), "ref name carries the tree, never a commit");

  // identical tree -> HIT
  const existing = new Set([verifiedRef(treeA)]);
  const refExists = (ref) => existing.has(ref);
  ok(isVerified(treeA, refExists) === true, "identical tree -> HIT (already verified)");

  // mutated tree -> MISS
  ok(isVerified(treeB, refExists) === false, "mutated tree -> MISS (re-verify required)");

  // FAIL-CLOSED: a lookup that throws -> MISS (never a false 'verified')
  const throwing = () => { throw new Error("git not available"); };
  ok(isVerified(treeA, throwing) === false, "lookup error -> MISS (fail-closed)");

  // FAIL-CLOSED: an invalid tree hash -> MISS (and verifiedRef throws on it)
  ok(isVerified("not-a-hash", refExists) === false, "invalid tree -> MISS (fail-closed)");
  let threw = false; try { verifiedRef("zzz"); } catch { threw = true; }
  ok(threw, "verifiedRef refuses a non-hash (no garbage ref)");

  // squash-invariance: the SAME tree from two different commits hits the SAME ref
  ok(verifiedRef(treeA) === verifiedRef(treeA.toUpperCase()), "tree hash is case-normalized (same content -> same ref)");

  // decideMark: DRY by default (print, push nothing); --push targets ONLY the verified ref
  const dry = decideMark(treeA, {});
  ok(dry.action === "print", "default mark is DRY (print, no push)");
  const pushIntent = decideMark(treeA, { push: true });
  ok(pushIntent.action === "push", "--push intends a push");
  ok(pushIntent.ref.startsWith(REF_PREFIX), "the push target is ALWAYS the verified namespace");
  ok(pushIntent.command.join(" ") === `git push origin HEAD:${REF_PREFIX}${treeA}`, "the push command targets HEAD:<verified-ref>, never a branch");
  ok(!/refs\/heads\//.test(pushIntent.command.join(" ")), "the mark command can NEVER target a branch (refs/heads/*)");

  if (fails.length) {
    console.error("verified-tree --self-test FAIL:");
    for (const f of fails) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.error(
    "verified-tree --self-test PASS — the marker is keyed on the squash-INVARIANT tree hash (identical tree -> HIT, " +
    "mutated tree -> MISS); fail-CLOSED throughout (a lookup error or an invalid hash is a MISS, never a false 'verified'); " +
    "and mark is DRY by default (prints the ref + command, pushes nothing), with --push able to target ONLY " +
    "refs/delivery-os/verified/* — structurally never a branch."
  );
  process.exit(0);
}

// --- CLI ---------------------------------------------------------------------
function sameFile(p) { try { return p && p.startsWith("file:") ? fileURLToPath(p) : p; } catch { return p; } }
if (process.argv[1] && fileURLToPath(import.meta.url) === sameFile(process.argv[1])) {
  const argv = process.argv.slice(2);
  if (argv.includes("--self-test")) selfTest();

  const sub = argv[0];
  const push = argv.includes("--push");
  const json = argv.includes("--json");
  const io = makeIO(process.cwd());

  if (sub === "mark") {
    let tree;
    try { tree = io.tree(); } catch (e) { console.error(`verified-tree mark: cannot read tree (${e.message}). Fail-closed — nothing marked.`); process.exit(1); }
    let plan;
    try { plan = decideMark(tree, { push }); } catch (e) { console.error(`verified-tree mark: ${e.message}`); process.exit(1); }
    if (plan.action === "push") {
      try { io.pushVerified(plan.ref); console.error(`verified-tree: PUSHED ${plan.ref}`); }
      catch (e) { console.error(`verified-tree mark --push failed: ${e.message}`); process.exit(1); }
    } else {
      console.error(`verified-tree mark (DRY — nothing pushed). To publish: ${plan.command.join(" ")}`);
    }
    if (json) console.log(JSON.stringify(plan, null, 2)); else console.log(plan.ref);
    process.exit(0);
  }

  if (sub === "check") {
    const arg = argv.find((a, i) => i > 0 && !a.startsWith("--"));
    let ref;
    try {
      if (arg && arg.startsWith("refs/")) ref = arg;
      else if (arg) ref = verifiedRef(arg);
      else ref = verifiedRef(io.tree());
    } catch (e) { console.error(`verified-tree check: ${e.message} -> MISS (fail-closed).`); process.exit(1); }
    const hit = io.refExists(ref);
    console.error(`verified-tree check ${ref} -> ${hit ? "HIT (already verified)" : "MISS (re-verify required)"}`);
    if (json) console.log(JSON.stringify({ ref, hit }, null, 2));
    process.exit(hit ? 0 : 1);
  }

  console.error("verified-tree: usage: node verified-tree.mjs (mark [--push] | check [ref|tree] | --self-test) [--json]");
  process.exit(2);
}
