---
name: verify-gate
version: 1.2.0
stability: stable
description: >
  Operationalizes author≠verifier (Governance §12). Use to produce or check a slice's independent
  verification artifact, and to understand why the verify-gate hook blocked a commit/turn. The mechanical
  companion to the doctrine: a slice is not "verified" until an independent VERIFY-<slice>.md exists. A
  VERIFY's freshness is SEMANTIC (founder directive 2026-06-25): it records a normalized `impl_fingerprint`
  and stays valid until the verified impl's runtime behavior changes — non-functional churn (docs,
  formatting, rebases, merge commits) never invalidates it; a real behavior change does, and still demands
  a fresh independent VERIFY.
decision_class: verification
inputs:  [the changed implementation files, docs/verify/ state, templates/VERIFY.md.template, templates/tools/verify-fingerprint.mjs]
outputs: [docs/verify/VERIFY-<slice>.md (via the verification skill), or a diagnosis of the gate block]
earned_from: "The OS's own origin incident: author≠verifier was documented but not operationalized — a generated, unexecuted scaffold was presented as progress with no independent verifier (case-studies/2026-06-10-author-verifier-not-operationalized.md). Continuous field record since: zero violations across ~36 VERIFY artifacts in two consumers, incl. one FAIL→fix→re-verify and the S37 rejection."
mechanical_spine: "the verify-gate hook itself (.claude/settings.json PreToolUse/Stop/PostToolUse + committed .githooks/pre-push), which invalidates a VERIFY SEMANTICALLY via the shared normalized impl-fingerprint (templates/tools/verify-fingerprint.mjs), not by timestamp — this skill is the hook's human-readable half"
---

# verify-gate — make verification a system behavior, not a memory exercise

This skill exists because Delivery OS once **documented** author≠verifier but did not **operationalize** it: a generated, unexecuted scaffold was presented as progress with no independent verifier (`case-studies/2026-06-10-author-verifier-not-operationalized.md`). The fix is mechanical (Governance §12).

## The two halves
1. **The hook (fires without you choosing to).** `.claude/settings.json` runs `.claude/hooks/verify-gate.mjs`:
   - `PreToolUse:Bash` → **deny** `git commit`/`git push` when implementation files (`src/ app/ lib/ api/ migrations/ db/`) changed without a fresh passing independent `docs/verify/VERIFY-<slice>.md`.
   - `Stop` → **block turn-end** under the same condition (catches "scaffold presented as progress").
   - `PostToolUse:Write|Edit` → baseline + advisory warn.
   - Committed `.githooks/pre-push` (via `core.hooksPath`) backstops it for any git client.
   - **v4:** the hook also re-executes the artifact's `machine_probe`, polices test-tree write-scoping (`test_pins_amended_by`), and carries the §14 review-artifact detector + N-merges backstop.
2. **The artifact (what the hook checks for).** A `VERIFY-<slice>.md` from `templates/VERIFY.md.template`, authored by a verifier **≠** the code's author.

## When invoked, do this
- **To verify a slice:** run the `verification` skill as an **independent lens** (a distinct invocation from whoever authored the code). Execute the slice's *real surface* (HTTP to the running app / import `src/` / apply migration on a fresh DB — never raw SQL standing in for an API criterion, never reading code instead of running it). Capture **real command output + exit codes**. Fill every section of the template, including `machine_probe`. Set `verify_status: verified` **only** if every acceptance criterion PASSes on its own surface, every load-bearing claim is Confirmed/Evidence-backed, all required gates are closed, and independence was real. Otherwise cap at `executed` and file bugs author-ward.
- **To diagnose a block:** the hook blocked because changed implementation files lack a passing/independent VERIFY artifact that **still covers them** (or its machine_probe now fails, or tests/ changed without a QA-signed `test_pins_amended_by`, or a §14 trigger fired). Produce the missing artifact — do not bypass. (`DELIVERY_OS_GATE_BYPASS=1` exists only for bootstrap/debug and is logged loudly.)

## Semantic freshness (impl-fingerprint, not timestamp — founder directive 2026-06-25)
A VERIFY is no longer invalidated just because the impl's file mtime is newer. Fill `impl_fingerprint:` by running `node <tools>/verify-fingerprint.mjs compute --changed` — it records the **normalized** fingerprint of the impl files this VERIFY covers. The gate revalidates by **behavior**: a real behavior change makes the current fingerprint diverge → the VERIFY is stale → re-verify; non-functional edits (docs, governance, skills, capabilities, templates, registry, comments, formatting, rebases, merge commits, generated files, metadata) keep the fingerprint → the VERIFY stays valid. **Same safety floor:** a behavior change still demands a fresh INDEPENDENT VERIFY. The check is **fail-closed** (missing field on a comparison, parse error, or any uncovered impl file ⇒ does not count). A legacy VERIFY without the field falls back to the old mtime staleness check. Shared helper: `templates/tools/verify-fingerprint.mjs` (also consumed by `deployment-auth.mjs`'s verify signal).

## Status ladder (derived, never self-asserted)
`planned` (spec) → `generated` (code exists, unrun) → `executed` (ran, evidence captured) → `verified` (independent lens confirmed acceptance on the real surface). The author may claim up to `executed`; only the verifier may claim `verified`; only a human merge **via the merge gate** makes it "done".

## Honest limit
The hook proves an artifact **exists**, is well-formed, and that one declared probe still passes; it cannot prove the verification was *truthful* in a single-agent runtime. CODEOWNERS-on-a-real-PR-with-a-second-reviewer and the committed `pre-push` are the model-independent layers — which is why git is mandatory (§12).

## Success criteria (runtime-verifiable)
- A blocked commit/turn is resolved by producing a real `VERIFY-<slice>.md`, not by editing a status field.
- The artifact's `author` ≠ `verifier`, its `machine_probe` re-executes green, and its execution evidence shows real commands/exit codes against the slice's actual surface.

## Changelog
- 1.2.0 — 2026-06-25 founder directive (`DECISIONS.md` D8): a VERIFY is invalidated **SEMANTICALLY, not by timestamp**. Added the `impl_fingerprint` field + the shared `templates/tools/verify-fingerprint.mjs` helper; non-functional churn no longer invalidates, a behavior change still demands a fresh independent VERIFY (same safety floor); legacy VERIFYs without the field fall back to mtime.
- 1.1.0 — v4: frontmatter brought to the one hybrid dialect (ruling C6 — copies of this file carried a third, thinner dialect than both the base and the earned formats); v4 hook behaviors documented (probe re-execution, write-scoping, §14 detectors); merge-via-gate wording.
- 1.0.0 — original (the honest-limit writeup, kept verbatim).
