---
name: verify-gate
version: 1.3.0
stability: stable
description: >
  Operationalizes author≠verifier (Governance §12). Use to produce or check a slice's independent
  verification artifact, and to understand the verify-gate. The verify-gate is now TWO things (board
  2026-06-25, `DECISIONS.md` D9): (a) a non-blocking LOCAL ADVISORY + auto-verifier — a fast nudge that
  never blocks a commit/turn; and (b) the BINDING server-side gate — a required CI `verify-coverage`
  status check + GitHub branch protection + CODEOWNERS review at the PR/merge, where author≠verifier is a
  PLATFORM invariant and the `machine_probe` re-runs on neutral hardware. A slice is not "verified" until
  an independent VERIFY-<slice>.md exists that the binding gate accepts. A VERIFY's freshness is SEMANTIC
  (founder directive 2026-06-25): it records a normalized `impl_fingerprint` and stays valid until the
  verified impl's runtime behavior changes — non-functional churn (docs, formatting, rebases, merge
  commits) never invalidates it; a real behavior change does, and still demands a fresh independent VERIFY.
decision_class: verification
inputs:  [the changed implementation files, docs/verify/ state, templates/VERIFY.md.template, templates/tools/verify-fingerprint.mjs]
outputs: [docs/verify/VERIFY-<slice>.md (via the verification skill), or a diagnosis of the gate block]
earned_from: "The OS's own origin incident: author≠verifier was documented but not operationalized — a generated, unexecuted scaffold was presented as progress with no independent verifier (case-studies/2026-06-10-author-verifier-not-operationalized.md). Continuous field record since: zero violations across ~36 VERIFY artifacts in two consumers, incl. one FAIL→fix→re-verify and the S37 rejection."
mechanical_spine: "the BINDING gate is server-side (board 2026-06-25, D9): the required CI verify-coverage check (.github/workflows/verify-coverage.yml) + GitHub branch protection (setup-branch-protection.mjs) + CODEOWNERS at the PR/merge — author≠verifier is a platform invariant (GitHub bars self-approval), the machine_probe re-runs on neutral hardware, and coverage is checked via the shared normalized impl-fingerprint (templates/tools/verify-fingerprint.mjs), not by timestamp. The local .claude/settings.json hook is DEMOTED to a non-blocking advisory + auto-verifier (PostToolUse warn + auto-verify nudge; no PreToolUse deny, no Stop block) — this skill is the human-readable half of both."
---

# verify-gate — make verification a system behavior, not a memory exercise

This skill exists because Delivery OS once **documented** author≠verifier but did not **operationalize** it: a generated, unexecuted scaffold was presented as progress with no independent verifier (`case-studies/2026-06-10-author-verifier-not-operationalized.md`). The fix is mechanical (Governance §12).

## The two layers (board 2026-06-25, `DECISIONS.md` D9 — enforcement moved server-side)
1. **The BINDING gate (server-side, un-bypassable, model-independent).** At the PR/merge — the irreversible act:
   - **Required CI `verify-coverage` status check** (`.github/workflows/verify-coverage.yml`) — re-runs the slice's `machine_probe` on neutral hardware (exit 0 required) and confirms a fresh independent `docs/verify/VERIFY-<slice>.md` **semantically covers** the changed impl (the normalized `impl_fingerprint`, near-zero-false-positive).
   - **GitHub branch protection** (`setup-branch-protection.mjs`) — makes **author≠verifier a platform invariant**: GitHub itself bars self-approval and merge-on-red.
   - **CODEOWNERS review** — binds a second principal at the merge; this is the model-independent layer the §12 Honest Limit named.
   - It re-runs the artifact's `machine_probe`, and the same VERIFY carries test-tree write-scoping (`test_pins_amended_by`) + the §14 review-artifact/N-merges signals.
2. **The local ADVISORY hook (fast nudge — NEVER blocks).** `.claude/settings.json` runs `.claude/hooks/verify-gate.mjs` as `PostToolUse:Write|Edit` baseline + advisory warn + an **auto-verify** nudge that offers to produce a missing VERIFY. It has **no `PreToolUse` deny and no `Stop` block** — it cannot halt a commit, a turn, or a goal; it only surfaces a coverage gap early. (It gated a *reversible* commit, carried 4+ bypass paths, and could not prove independence — so the binding decision moved to the server.)
3. **The artifact (what both layers check for).** A `VERIFY-<slice>.md` from `templates/VERIFY.md.template`, authored by a verifier **≠** the code's author.

## When invoked, do this
- **To verify a slice:** run the `verification` skill as an **independent lens** (a distinct invocation from whoever authored the code). Execute the slice's *real surface* (HTTP to the running app / import `src/` / apply migration on a fresh DB — never raw SQL standing in for an API criterion, never reading code instead of running it). Capture **real command output + exit codes**. Fill every section of the template, including `machine_probe`. Set `verify_status: verified` **only** if every acceptance criterion PASSes on its own surface, every load-bearing claim is Confirmed/Evidence-backed, all required gates are closed, and independence was real. Otherwise cap at `executed` and file bugs author-ward.
- **To diagnose a block:** a *merge* is blocked by the **CI `verify-coverage` required check** (not the local hook, which only warns) because changed implementation files lack a passing/independent VERIFY artifact that **still covers them** (or its machine_probe now fails on the runner, or tests/ changed without a QA-signed `test_pins_amended_by`, or a §14 trigger fired). Produce the missing artifact and re-run the check — the server-side gate has no `--no-verify` and no bypass env var. (The legacy local `DELIVERY_OS_GATE_BYPASS=1` only ever silenced the advisory hook; it cannot affect the binding CI gate.)

## Semantic freshness (impl-fingerprint, not timestamp — founder directive 2026-06-25)
A VERIFY is no longer invalidated just because the impl's file mtime is newer. Fill `impl_fingerprint:` by running `node <tools>/verify-fingerprint.mjs compute --changed` — it records the **normalized** fingerprint of the impl files this VERIFY covers. The gate revalidates by **behavior**: a real behavior change makes the current fingerprint diverge → the VERIFY is stale → re-verify; non-functional edits (docs, governance, skills, capabilities, templates, registry, comments, formatting, rebases, merge commits, generated files, metadata) keep the fingerprint → the VERIFY stays valid. **Same safety floor:** a behavior change still demands a fresh INDEPENDENT VERIFY. The check is **fail-closed** (missing field on a comparison, parse error, or any uncovered impl file ⇒ does not count). A legacy VERIFY without the field falls back to the old mtime staleness check. Shared helper: `templates/tools/verify-fingerprint.mjs` (also consumed by `deployment-auth.mjs`'s verify signal).

## Status ladder (derived, never self-asserted)
`planned` (spec) → `generated` (code exists, unrun) → `executed` (ran, evidence captured) → `verified` (independent lens confirmed acceptance on the real surface). The author may claim up to `executed`; only the verifier may claim `verified`; only a human merge **via the merge gate** makes it "done".

## Honest limit (now RESOLVED for git+CI repos — board 2026-06-25)
A *local* hook proves an artifact **exists**, is well-formed, and that one declared probe still passes; it cannot prove the verification was *truthful* or independent in a single-agent runtime. That limit is exactly **why the binding gate moved server-side**: for any repo with git + CI, **CODEOWNERS-on-a-real-PR-with-a-second-reviewer + branch protection + the required `verify-coverage` check** *are* the model-independent layers the limit named — the platform enforces author≠verifier and re-runs the probe on neutral hardware. The residual limit survives only in the **no-VCS fallback** (a single principal, no PR to bind), where a *separate verifier run* is the strongest available form — which is why git stays mandatory (§12).

## Success criteria (runtime-verifiable)
- A blocked commit/turn is resolved by producing a real `VERIFY-<slice>.md`, not by editing a status field.
- The artifact's `author` ≠ `verifier`, its `machine_probe` re-executes green, and its execution evidence shows real commands/exit codes against the slice's actual surface.

## Changelog
- 1.3.0 — 2026-06-25 board decision (`DECISIONS.md` D9, `docs/adr/ADR-002`): the BINDING verification gate moves **server-side** — required CI `verify-coverage` check + GitHub branch protection + CODEOWNERS at the PR/merge (model-independent, un-bypassable, machine_probe re-run on neutral hardware). The **local hook is demoted to a non-blocking advisory + auto-verifier** (no PreToolUse deny, no Stop block) — it gated a reversible commit and could not prove independence (§12 Honest Limit, now resolved for git+CI repos). **C6 human-merge gate unchanged** — this strengthens the floor, it does not authorize auto-merge. 4-lens governance board, unanimous; founder-approved.
- 1.2.0 — 2026-06-25 founder directive (`DECISIONS.md` D8): a VERIFY is invalidated **SEMANTICALLY, not by timestamp**. Added the `impl_fingerprint` field + the shared `templates/tools/verify-fingerprint.mjs` helper; non-functional churn no longer invalidates, a behavior change still demands a fresh independent VERIFY (same safety floor); legacy VERIFYs without the field fall back to mtime.
- 1.1.0 — v4: frontmatter brought to the one hybrid dialect (ruling C6 — copies of this file carried a third, thinner dialect than both the base and the earned formats); v4 hook behaviors documented (probe re-execution, write-scoping, §14 detectors); merge-via-gate wording.
- 1.0.0 — original (the honest-limit writeup, kept verbatim).
