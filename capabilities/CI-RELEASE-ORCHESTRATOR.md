# CI & Release Orchestrator — the canonical self-running Delivery OS release pipeline

> **Status (2026-06-25):** capability `candidate` — built + independently verified; auto-trigger live in PLOS.
> Extracted clean-room from a real session (2026-06-24/25) in which CI monitoring, failure diagnosis,
> safe fixes, merge orchestration, and deploy-watching were done **by hand** through a red dunning release.
> This doc is how that becomes a reusable, mostly-self-running pipeline — with the irreducible human gates
> (merge-to-main, rollback) kept human by construction (Governance C6, G9).

## 1. What it is — three layers, one capability
| Layer | Artifact | Role |
|---|---|---|
| **Mechanical spine** | `templates/tools/ci-release-orchestrator.mjs` (zero-dep, gh/git) | monitor CI → diagnose (F1–F5 KB) → apply **safe** infra fixes / **propose** the rest → **human-gated merge** → watch deploy → report. `--self-test`, `--json`, `--apply-safe`, `--merge`, `--dry-run`. |
| **Human-judgment wrapper** | `skills/ci-release-orchestrator/SKILL.md` (v6 execution skill) | the founder-facing read-and-recommend procedure; surfaces merge/release go/no-go; composes with verify-gate (§12) + principle-11-review (§11) + deployment-operator. |
| **Auto-execution** | `property-lead-os/.github/workflows/orchestrator.yml` (read-only) | fires on `workflow_run`(CI completed) / `pull_request` / `workflow_dispatch`; classifies the just-finished run and writes a scoreboard to the run summary. No mutation — merge/deploy stay human gates. |
| **Registry** | `capabilities/ci-release-orchestrator.capability.json` + the CAPABILITY-LEDGER candidate row | discoverable capability; `ownerSystem: delivery-os`, `sideEffect: read`. |

## 2. The failure knowledge base (F1–F5) — diagnosis → fix → autonomy band
Each class carries a machine-detectable **signal** (mandatory discriminator: log-regex / `mergeable` / check-name; corroborating: failing step/workflow), a **diagnosis**, an **automatic fix**, and an **autonomy band**:

| # | Class | Signal | Fix | Band |
|---|---|---|---|---|
| **F1** | stale conformance migration-count pins | `expected N to be 28|29` in a conformance test | re-pin to the on-disk count/maxNum | **NEEDS-APPROVAL** (moving a guard value silences regressions — enumerate every added migration first) |
| **F2** | `next build` JS-heap OOM in CI | `heap out of memory` in the build step | `NODE_OPTIONS=--max-old-space-size` on the build step | **SAFE-TO-AUTO** |
| **F3** | Vercel "invalid Node.js Version 24.x" | `invalid Node.js Version: 24` in deploy | pin `engines.node:"22.x"` (safe); on recurrence, the Vercel **project** `nodeVersion` via API | partial **SAFE-TO-AUTO** / real **NEEDS-APPROVAL** (external prod config) |
| **F4** | release-PR merge conflict | `gh mergeable == CONFLICTING` | merge main in; `.gitignore` union (safe) + conformance re-pin (approval) | **SPLIT** |
| **F5** | experience-gate red | failing `experience-review`/`founder-experience-scorecard` | — | **NEVER-AUTO → escalate** (product defect) |

Guiding rule (preserves author≠verifier): infra knobs with bounded blast radius = auto; anything that **moves a guard value, mutates external prod config, or merges** = a human ratifies.

## 3. The state machine + verified loop
`monitoring → diagnosing → fixing → verifying → merge_gate(HUMAN) → deploying → reporting → done | escalated`
- **Verified loop:** CI fails → diagnose → fix → re-verify the 3 required checks; bounded (2/class, 5 total CI, 2 deploy); **same-signal recurrence → escalate** (e.g. F3's partial→real promotion — exactly the #190→#191 Node-fix recurrence this session).
- **The one consequential gate:** `merge_gate` is **human-only** — the tool prints the merge command and stops unless `--merge` is passed, and `--merge` can never override a red/missing required check (independently verified, line 411). Merge + rollback are C6/G9 human gates.

## 4. Engine integration — the honest seam (architecture)
Modeled (architecture review) as a Delivery OS **engine workflow definition** (`monitor → diagnose → fix-request → reverify → engine.verify(T1 "required-checks-green", gating-exempt) → merge-gate(human) → deploy-watch → report`), with **GitHub Actions as the G9-compliant bounded runner** (the engine emits the task + blocks; GH Actions executes + posts the callback). Honest tiering:
- **AUTONOMOUS (built):** monitor · diagnose-known-classes (T1 rules) · the verify-loop gating on the deterministic checks-green rule · deploy-watch · report.
- **HUMAN-GATED (built):** merge-to-main + rollback (irreversible → C6, via the approvals route).
- **SCAFFOLD:** the engine `agent-result` path for *unknown* failure classes (the runner is dormant — V6-AGENT-INTEGRATION-ROADMAP S4) + a standing heartbeat (G2, founder-blocked on pg_cron). Today GH Actions is the trigger + runner + heartbeat.
- **ASPIRATIONAL (NOT built — would violate G9+C6):** lights-out auto-merge with no human + no external runner.

## 5. CI optimization — benchmark (a workstream of this capability)
| | `verify` wall-clock |
|---|---|
| **BEFORE** | **~7m14s** (single sequential job; tests ~150s + build ~125s = 63%) |
| **AFTER** (PR #192) | **~2m54s projected (~60% faster)** — split into 3 parallel jobs (`ci-db-test` · `ci-static` · `ci-build`) + a name-preserving `verify` aggregator (branch-protection intact), node_modules + `.next/cache`, and CI-gated skip of the *duplicate* in-build typecheck/lint |
Nothing weakened: all 2577 tests, migrate-check, standalone typecheck/lint, and the build gate still run. The real after-time lands on PR #192's own CI run.

## 6. How it auto-runs (without manual execution)
`orchestrator.yml` (PLOS, PR #193) on `workflow_run: {workflows:[CI], types:[completed]}` → reads the finished run, classifies F1–F5, writes the scoreboard. Read-only permissions; it never merges/deploys (those are human gates). For the *engine* path, a repo event → `POST /workflow` enqueue → on-demand `tick` (GH Actions as the heartbeat until G2 lands).

## 7. Why this is canonical — and the proof it works
This pipeline **dogfoods Delivery OS's own invariants**: every effectful step routes through a human gate (C6), the engine never self-spawns (G9), and **every change is independently verified before it's "done" (§12 author≠verifier).**

The clearest proof came while building this very capability: the orchestrator tool first shipped with a **verified** stamp from two lighter verifiers — but a **third, more rigorous verifier drove the live classification path and caught a real bug** (F2 OOM never classified live; the self-test fixture masked it). It **rejected** the VERIFY; the bug was fixed (corroborating fields made non-disqualifying), independently re-verified on the live path, and **nothing unverified was ever pushed** (the pre-push gate was never crossed). That loop — diagnose → fix → independently re-verify, effectful steps gated — *is* the capability. The gate caught its own author.

## 8. Honest status / next
- Built + verified: the tool, the skill (installed + harness-discoverable), the manifest + ledger, the CI optimization (#192), the read-only auto-trigger (#193).
- Candidate (not yet `verified` in the registry sense): promotes after a real live CI→fix→merge→deploy cycle runs end-to-end through it (the dunning release is the first such case, paused at the human merge gate).
- Follow-ups: scope the global verify-gate PreToolUse hook to the committing repo (a cross-repo false-positive noted this session); vendor the tool into PLOS via os-inherit; land the engine `agent-result` scaffold when the runner/heartbeat (S4/G2) land.
