---
slice: "prepush-fix — model-independent backstop checks the committed push range"
verify_status: verified
author: "orchestrator-build-session"
verifier: "independent-qa-subagent-prepush"
date: "2026-06-10"
independence_basis: "recorded-distinct-invocation"
---

# VERIFY — pre-push gate inspects the committed push range (bypass closed)

Independent adversarial verification of the fix to `templates/githooks/pre-push` +
the new `pre-push` mode in `templates/hooks/verify-gate.mjs`. The previous gate
inspected the WORKING TREE, so an implementation change committed via bare git and
pushed with a clean tree slipped through. The fix makes the gate inspect the
COMMITTED PUSH RANGE fed by git on stdin (`<localRef> <localSha> <remoteRef> <remoteSha>`).

Verification was run in a freshly created isolated real-git repo (and a clone of it
with a real `origin` remote for the new-branch reachability cases). `node --check`
passed; the framework's own `check-os-drift.mjs` still exits 0.

## Evidence — command + exit code

| # | Scenario | Push range fed on stdin | Expected | Actual | Pass |
|---|----------|-------------------------|----------|--------|------|
| 1 | **THE BYPASS** — impl committed via bare git, working tree clean, push range TIP over BASE | `refs/heads/main TIP refs/heads/main BASE` | exit 1 (block) | exit 1, working tree empty | ✅ |
| 2 | Verified + independent VERIFY (author A, verifier B) in range | `... NEWTIP ... BASE` | exit 0 (allow) | exit 0 | ✅ |
| 3 | author == verifier (verifier changed to A) | `... NEWTIP2 ... BASE` | exit 1 (block) | exit 1 | ✅ |
| 4 (adv) | Old, already-pushed VERIFY present at tip but NOT in the push range; new impl pushed alone | `... SNEAKY_TIP ... PUSHED_BASE` | exit 1 (block) | exit 1 | ✅ |
| 5 (adv) | `verify_status: failed` (not verified) in range with impl | `... T2 ... BASE2` | exit 1 (block) | exit 1 | ✅ |
| 6 (adv) | impl and verify in SEPARATE commits, both inside one push range | `... T3 ... BASE3` | exit 0 (allow) | exit 0 | ✅ |
| 7 (adv) | empty stdin (no ref lines) | `` (empty) | no crash, exit 0 | exit 0 | ✅ |
| 8 (adv) | `impl_extra:["scripts/"]` extends impl surface; scripts/ changed, no verify | `... T4 ... BASE4` | exit 1 (block) | exit 1 | ✅ |
| 9 (adv) | ref DELETION line (localSha all zeros) | `refs/heads/main 000… refs/heads/main TIP` | no crash, exit 0 | exit 0 | ✅ |
| 10 (adv) | docs-only push (only `*.md` changed) | `... DTIP ... BASE` | exit 0 (allow) | exit 0 | ✅ |
| 11 (adv) | NEW BRANCH push (remoteSha all zeros), new impl, no verify (no remote configured) | `refs/heads/feature FTIP refs/heads/feature 000…` | exit 1 (block) | exit 1 | ✅ |
| 12 (adv) | clone WITH origin: new branch whose impl is ALREADY on a remote (`rev-list --not --remotes` empty) | `refs/heads/newbranch NB refs/heads/newbranch 000…` | exit 0 (benign — no new impl) | exit 0 | ✅ |
| 13 (adv) | clone WITH origin: new branch with a genuinely NEW impl commit on top of origin/main, no verify | `refs/heads/newbranch NB2 refs/heads/newbranch 000…` | exit 1 (block) | exit 1 | ✅ |

`node --check templates/hooks/verify-gate.mjs` → OK.
`node .claude/tools/check-os-drift.mjs` (real delivery-os repo) → exit 0 ("router matches disk").

## Adversarial findings

- **The exact bypass is closed.** Test 1 reproduces the original hole precisely:
  impl committed via bare git, working tree clean at push time. The old working-tree
  gate would have seen nothing; the fixed gate diffs `remoteSha..localSha` from stdin
  and blocks (exit 1). Confirmed `git status --porcelain` was empty during the test.
- **Old verifications cannot be re-used.** The gate only honors a VERIFY artifact that
  is itself part of the push range (`all.filter(VERIFY-*.md)`), then reads it at the
  tip commit. An independent VERIFY already on the remote does NOT satisfy a later
  impl-only push (Test 4) — this is the right strictness; each impl push must carry its
  own fresh verification.
- **Status and independence both enforced.** `failed` status (Test 5) and author==verifier
  (Test 3) both block; only `verified` AND author≠verifier allows.
- **New-branch / reachability logic is sound, not a hole.** For a new ref (remoteSha all
  zeros) the gate uses `git rev-list <local> --not --remotes` to find commits not yet on
  any remote. Tests 12/13 (run in a clone with a real `origin`) show it blocks genuinely
  new impl and benignly allows impl that is already on a remote — that impl was already
  gated when it first arrived, so excluding it is correct, not a bypass.
- **No crashes on degenerate input.** Ref deletions (localSha zeros, Test 9) and empty
  stdin (Test 7) exit 0 without error. `sh()` swallows git failures and falls back to
  `tip="HEAD"`, so a malformed `git show` cannot throw.
- **Surface config respected.** `impl_extra` (Test 8) correctly extends the protected
  surface beyond `src/` for this framework's own non-`src/` implementation.

No new defect found. One observation (not a defect): the gate is fail-OPEN inside the
`pre-push` branch only at the boundaries where `sh()` returns "" (git unavailable / bad
ref) — but in those states no impl files are detected either, so nothing dangerous is
admitted; the committed-range happy paths all fail-closed (exit 1) as required.

## Verdict

VERIFIED — the working-tree bypass is genuinely closed. block / allow / block (Tests 1/2/3)
all correct, all 10 adversarial cases behave correctly, hook syntax-checks, and framework
drift-lint stays green. No new defect.
