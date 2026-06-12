---
name: verification
version: 2.0.0
stability: stable
description: >
  Run an independent, adversarial slice verification — the executable counterpart of the verify-gate.
  A distinct verifier invocation builds its OWN fixtures, exercises the slice's REAL surface, mutates
  adversarially, rehearses the pre-registered reversal where one exists, and writes the VERIFY doc with
  verbatim evidence and a machine_probe. Invoke whenever implementation files changed and the gate demands
  a fresh VERIFY-<slice>.md, or via /verify-slice.
decision_class: verification
inputs:  [the changed files + their claimed behavior, acceptance criteria per criterion-on-its-own-surface, templates/VERIFY.md.template, an isolated worktree + a guarded *_test DB]
outputs: [docs/verify/VERIFY-<slice>.md (verify_status set honestly; machine_probe declared; FAIL history kept)]
earned_from: "UNION of two consumers' independently-built verification stacks (convergent twins, 2026-06): stack P ~16+ artifacts incl. the S37 rejection (verifier probe caught silent data loss the author's 57 green tests missed); stack A 6 verifications incl. one FAIL->fix->re-verify that stopped a broken production root route. Technique tags: [P]/[A]/[R(eference, adapted)]. Case studies: delivery-os/case-studies/2026-06-incident-ledger.md"
mechanical_spine: "/verify-slice command; verify-gate hook demands the artifact and re-executes its machine_probe; merge gate blocks non-green merges"
---
# Verification (v2.0 — the merged union; no technique discarded)

## Overview
Verification earns trust by what it can REJECT. This skill is the union of two convergent verification
stacks built independently from different incidents — taking either alone would have silently discarded
half the QA doctrine. Every technique carries its source tag and pays rent via a named incident.

## When to use (and NOT)
- Use when: any slice with implementation changes reaches "ready for QA"; mandatory for data/money/surface slices.
- **NOT** for: deciding *whether* review is needed (that is the verify-gate hook — it fires without consent);
  debugging a failure you found (route to `debugging-and-error-recovery`); panel-class decisions (→ `principle-11-review`).

## Process
1. **Dispatch a genuinely distinct verifier** [A] — a separate invocation that did not author the code.
   Author evidence is NEVER verifier evidence; name the author's reports explicitly as excluded.
2. **Isolate the environment** [P]: dedicated worktree; DB runs through the `assertTestDatabase`-guarded
   `*_test` database (cited in every artifact of stack P; a live store was once destroyed by a test run).
   **Machine-guard preamble** [P]: prove the resource is YOURS — check the listening PID [A: a stale server
   once nearly poisoned a CORS verdict]; assert the DB name; **run-unique tokens** in every fixture and
   assertion [P: the same shared-resource race recurred three times until tokens made collisions impossible].
3. **Verifier authors its own fixtures** [A] from types/contracts — synthetic data, never the author's
   fixtures, never real personal data. For DB slices: disposable `postgres:16` container + migrate-from-zero
   (this doubles as the applies-clean gate). **Prove the baseline first** [A]: stash → run → pop, so
   pre-existing failures are filed separately, never silently absorbed.
4. **Happy path on the REAL surface** [P+A]: HTTP to the running app / import the real module / fresh-DB
   migration — never raw SQL standing in for an API criterion, never reading code instead of running it.
   For UI claims, capture **render-level evidence** [P] (the served page/DOM, not the component source).
5. **Adversarial mutations** [P+A] — one corruption per run (dup key, money mismatch, dangling FK, missing
   asset, wrong magic bytes, sabotaged late-transaction value, planted invariant violation). Each must
   produce the SPECIFIC refusal AND flip the overall verdict. **Mutation-probe discipline** [P, ~10 uses]:
   plant the violation → exactly the named scan goes red → restore and prove restoration **sha256-identical**.
   A guard that doesn't trip under sabotage is unverified.
6. **Failure-path honesty** [A]: refusals must happen BEFORE side effects (prove validate-first by running
   with credentials unset); transactional claims proven by counting rows AFTER a failed run (expect zero).
7. **Live probes** (if deployed) [A]: read-only; verify BOTH sides — 200 with scope / 401 without / 403 wrong
   scope; CORS allow AND deny; dev backdoors 404.
8. **Rehearse the pre-registered reversal** [P]: if the slice declared one (slice template field), execute it
   mechanically — R1 apply, R2 restore — and prove the restore byte-identical. The reversal that was never
   rehearsed is a hope, not a rollback.
9. **Fix-surface forensics on re-verification** [P]: after a FAIL→fix cycle, audit mtimes/diff to prove
   exactly the claimed files changed — a "one-line fix" that touched five files is a new review, and a
   **kept repro is a rejection** [P]: if the original failing repro still reproduces, the verdict stays FAIL
   regardless of new green tests.
10. **Write the VERIFY doc** from the template: verbatim commands + exit codes + decisive output; criteria
    each PASS/FAIL on their own surface; classified assumptions (author-evidence marked as such); honest gate
    ledger; declare a **machine_probe** the gate can re-execute. `verified` only if everything passes —
    otherwise `executed` + bugs filed author-ward (the verifier never fixes).
11. **On FAIL: keep the history** [A]: author fixes, verifier re-verifies, and the FAIL run stays in the doc
    as a dated section. Pass **ARTIFACT + CONTRACT, never the CLAIM** [R]: what travels to the next stage is
    the verification artifact and the acceptance contract, not a prose summary of them.

## Common rationalizations
| Rationalization | Reality (the receipt) |
|---|---|
| "The author's tests pass" | S37: 57 green author tests missed silent data loss on the capped-fallback lane; the verifier's constructed probe found it. Whose tests, which surface? |
| "CI will catch it at merge time" | A PR once merged on RED CI because a pipe swallowed the status — which is why the merge gate machine-reads the checks API and this skill never defers to "later". |
| "The sibling repo isn't ready, so this can't be exercised end-to-end" | Incident 5: days were planned behind a gate that was already open. Audit the peer's disk (cross-system-reality-audit); never accept a relayed claim. |
| "It's just scaffolding" | The verify-gate's own origin story: a *data store + migrations* slice was mis-self-classified as mere scaffolding and presented as progress, unexecuted. |

## Red flags
- "The tests pass" as the only evidence (whose tests? which surface?) [A].
- Verifier reusing the author's fixtures or temp data [A].
- Evidence from a port/process not verified to be yours — check the PID [A: the stale-server near-miss].
- Shared-resource assertions without run-unique tokens [P: third recurrence of the same race].
- **Doubt theater** [R]: hedging language ("should work", "I believe") standing where a command + exit code belongs.
- A re-verification that doesn't re-run the original failing repro [P: kept-repro rule].
- A green check nobody cross-derived [A: "green checks you didn't cross-derive are belief, not knowledge"].

## Verification (of this skill's own output)
- The VERIFY doc has command+output rows for every PASS; **prose is not evidence** [A].
- Its `machine_probe` re-executes green standalone; its FAIL-history section is present (even if "none").
- `author` ≠ `verifier`, and the independence basis is recorded.

## Changelog
- 2.0.0 — the v4 union: stack P (mutation-probe+sha256 restore, machine-guard, run-unique tokens, fix-surface
  forensics, kept-repro rejection, reversal rehearsal, render evidence) ∪ stack A (verifier fixtures,
  disposable-DB applies-clean, refusals-before-side-effects, transactional row-count proof, stash-run-pop
  baseline, stale-PID check, allow+deny probes, FAIL-history) ∪ adapted reference rows (Prove-It,
  doubt-theater, ARTIFACT+CONTRACT-not-CLAIM). Supersedes both source skills; neither repo re-forks (anti-third-fork rule).
