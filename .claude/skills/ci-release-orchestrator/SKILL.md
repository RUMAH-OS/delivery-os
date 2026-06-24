---
name: ci-release-orchestrator
version: 1.0.0
stability: experimental
description: >
  Monitor CI, diagnose failures, gate merge/deploy on green. The single procedure for watching a
  branch/PR through CI, turning a red build into a named root cause + owner-ward fix, holding merge
  until the gate floor is green, watching the deploy land, and surfacing the merge/release go/no-go
  to the founder. It RECOMMENDS and OBSERVES; it never merges, deploys, or concludes alone.
decision_class: production-readiness
inputs:  [the PR/branch + its CI run (gh), docs/verify/VERIFY-<slice>.md state, docs/gates.md, the deploy lane (.deploy-lane.json) if present, the rollback plan]
outputs: [a CI verdict (green / red+root-cause+owner / flaky-retry), a merge-readiness call gated on the verify floor, a deploy-watch result, and any go/no-go decision routed to principle-11-review]
earned_from: "CANDIDATE — the recurring founder reality of polling `gh run watch` by hand, learning of a red build late, diagnosing the same CI failure classes ad hoc, and deciding merge-when-green from memory with no record that the verify floor or release-readiness gate was actually closed. Field-earned in the 2026-06-24/25 dunning-release run (5 failure classes: stale conformance pins, next-build OOM, Vercel node-24, merge conflict, experience-gate). Promotes to verified after an independent QA run on a real CI failure→fix→merge→deploy cycle."
mechanical_spine: "templates/tools/ci-release-orchestrator.mjs — the zero-dep CI watch/diagnose/safe-fix helper (gh/git). This skill is its human-readable half; the effectful steps (merge, deploy) are NEVER part of the invocable command-seam — they are founder decision points executed through the human merge gate / deployment-operator's ratified lane."
# --- v6 frontmatter fields (capability-routable; per skill-frontmatter.mjs #6) ---
kind: execution
capabilities: [monitor-ci, diagnose-ci-failure, gate-merge-on-green, watch-deploy, surface-release-go-no-go]
triggers:
  - "monitor CI"
  - "the build failed"
  - "merge when green"
  - "watch the deploy"
  - "diagnose the CI failure"
  - "release readiness"
  - "is this PR ready to merge"
  - "did the deploy land"
hooks:
  pre: []
  post: []
---
# CI & Release Orchestrator (v1.0 — v6 execution skill)

## Overview
Watching CI, diagnosing a red build, and deciding merge-when-green were a private, by-hand loop:
poll `gh`, read failing logs, guess the class of failure, and merge from memory with no record that
the verify floor (§12) or the readiness gate was closed. This skill is the single procedure for that
loop. It is **read-and-recommend**: it OBSERVES CI, NAMES the root cause, applies only **safe infra
fixes**, and SURFACES the go/no-go — the effectful steps (merge, deploy, rollback) are founder
decision points, never auto-executed (the human-gate rule, MANIFEST-STANDARD §3.1.1). It does not
adjudicate readiness; for a consequential release it POINTS at `principle-11-review` /
`production-readiness-review`. Its executable spine is `templates/tools/ci-release-orchestrator.mjs`.

## When to use (and NOT)
- **Use when:** a PR/branch is in CI and the founder wants it watched ("monitor CI"), a build went red
  ("the build failed" / "diagnose the CI failure"), a PR should land the moment it is green ("merge when
  green" / "is this PR ready to merge"), a deploy is in flight ("watch the deploy" / "did the deploy
  land"), or a release-readiness call is due ("release readiness").
- **NOT** a replacement for: the **human merge gate** (§12 — only a human merge through the gate makes a
  slice "done"); the **verify-gate** (this skill READS the VERIFY artifact, it does not author it);
  **deployment-operator** (the effectful deploy/migration lane — this skill watches the run that lane
  produces); or the **§11 panel** (a consequential go/no-go is routed there, never decided here). NOT
  for designing CI config — that is an engineering slice.

## The orchestration playbook (the procedure)
1. **Locate the run.** Resolve the PR/branch + its CI run (`gh pr view`, `gh pr checks`, `gh run view
   --json status,conclusion,jobs`). Report state honestly: `queued` / `in_progress` / `success` /
   `failure` — never narrate a guess as a result.
2. **Watch to terminal.** Follow the run to a terminal state. Do not declare an outcome while jobs are
   still `in_progress`.
3. **On red — diagnose to a named root cause + owner.** Pull the failing job's log (`gh run view
   <id> --log-failed`), match it to a known **failure class** (the tool's F1–F5 KB):
   - **F1 stale-conformance-migration-pins** — a conformance test pins an old migration count; re-pin
     to the on-disk count. **NEEDS-APPROVAL** (moving a guard value silences regressions — enumerate
     every added migration as legitimate first).
   - **F2 next-build-OOM** — `next build` heap-OOM in CI; add `NODE_OPTIONS=--max-old-space-size`. **SAFE-TO-AUTO**.
   - **F3 vercel-invalid-node-24x** — `engines.node` resolves to 24.x; pin `22.x` (SAFE) and, on
     recurrence, the **Vercel project `nodeVersion` via API** (**NEEDS-APPROVAL** — external prod config).
   - **F4 release-pr-merge-conflict** — merge `main` in, `.gitignore` union (SAFE), conformance re-pin (NEEDS-APPROVAL).
   - **F5 experience-gate-red** — a founder-facing surface failed its gate; **NEVER-AUTO → escalate**.
   A **verify-gate block is not a CI bug** — it means an implementation change lacks a fresh passing
   independent `VERIFY-<slice>.md`; route to `verify-gate`, never bypass. Distinguish a flake from a
   genuine failure; a retry is a labelled decision, bounded (2 per class / 5 total CI / 2 deploy).
4. **On green — check the merge floor, then surface, do not merge.** Confirm the floor is closed (the
   slice's `VERIFY-<slice>.md` is `verified` + its probe re-runs green; the required checks are green;
   `docs/gates.md` pre-reads satisfied). Then SURFACE "ready to merge — green + floor closed" as a
   **founder decision point**. The merge is a human action through the merge gate (CODEOWNERS, §3) —
   this skill does not press merge.
5. **Watch the deploy.** After a human merge triggers deploy, follow the deploy run to terminal +
   confirm post-deploy health. On a failed deploy, surface the rollback plan; the rollback is human-gated.
6. **Route the release go/no-go.** For a release/promotion/cutover (a §11 class), do NOT conclude here —
   hand the decision to `production-readiness-review` / `principle-11-review` and relay the verdict.

## Decision points it surfaces to the founder (never auto-acts)
- **Merge-when-green:** "green + verify floor closed → ready" vs "green but floor open → blocked."
- **Flake vs real failure:** "intermittent infra → retry once (logged)" vs "deterministic → owner-ward fix."
- **NEEDS-APPROVAL fix:** a conformance re-pin or an external-prod-config change → proposed patch + evidence, founder ratifies.
- **Deploy go / hold** and **release go/no-go** (routed to the §11 readiness panel — this skill relays, it does not vote).

## How it composes (those skills/gates are NOT modified here)
- **verify-gate (§12):** the source of merge-readiness truth — READ, never authored or bypassed.
- **principle-11-review / production-readiness-review (§11):** the release go/no-go decision class — triggered + relayed.
- **deployment-operator + .deploy-lane.json:** the effectful deploy/migration executor — watched, not driven.

## Red flags
- This skill pressing merge or triggering a deploy itself (effectful steps are human-gated by construction).
- A "green" call while jobs are still `in_progress`, or while the verify floor is open.
- A verify-gate block reported as a "CI failure to retry" (it is a missing independent verification).
- A NEEDS-APPROVAL fix (conformance re-pin / external prod config) applied without a founder yes.
- A release go/no-go concluded here instead of routed to the §11 panel; a flake retried silently.

## Success criteria (runtime-verifiable)
- Every CI verdict cites real `gh` run state (status + conclusion + failing job), not a narrated guess.
- A red build yields one named root cause + owner-ward fix (or a labelled flake-retry decision).
- A merge-readiness call is gated on a real `verified` VERIFY artifact whose probe re-runs green.
- No merge/deploy is executed by this skill; each effectful step is a surfaced, human-gated decision.

## Changelog
- 1.0.0 — new (experimental); read-and-recommend CI/release orchestration extracted from the by-hand
  `gh`-watch + merge-when-green loop (2026-06-24/25). Spine: `templates/tools/ci-release-orchestrator.mjs`.
  Composes with verify-gate (merge floor), principle-11-review / production-readiness-review (release
  go/no-go), and deployment-operator (the effectful lane).
