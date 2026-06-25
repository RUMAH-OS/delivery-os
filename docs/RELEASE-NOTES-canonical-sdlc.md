# Release Notes — Canonical Delivery OS SDLC (2026-06-25)

Merged to `main` via PR #5 (`ae355be`) + PR #8 (`5cbc464`). Founder-approved.

The canonical Delivery OS SDLC is now established as the inheritable default — 25 tools, 7 skills, 3 workflow templates in `capabilities/os-foundation.manifest.json`. Every repo gets the full lifecycle via `os-inherit`.

## Features
- **sdlc:** Canonical SDLC foundation — `CANONICAL-SDLC.md` · Phase-0 manifest inheritance · V6 routing-default (ownership-gate rows + OPERATING-LOOP rule) · auto-push hook (`5f5d065`)
- **sdlc:** repo-governance-auditor — the Repository-Governance lifecycle, squash-merge-aware (PR-state==MERGED detection) (`dc0c76e`)
- **sdlc:** founder-review-package generator — the Founder Review lifecycle (engineer-seeded test guide, never hallucinated; `--post` gated) (`1ea0acb`)
- **sdlc:** release-notes + smoke tools — Release + Smoke/Prod-Verify lifecycles (effects gated; fail-closed) (`a980965`)
- **sdlc:** DEV-first wiring — preview/promote workflow templates + os-inherit `workflows` vendor class + DEV-provisioning runbook (`85547e6`)
- **ci:** CI & Release Orchestrator — monitor/diagnose(F1–F5)/safe-fix/human-gated-merge/deploy-watch + read-only auto-trigger; CI benchmark 7m14s→~2m54s (`fc64f60`, `bb46baa`)

## Verification (author≠verifier)
All slices independently verified — `docs/verify/VERIFY-{ci-release-orchestrator,canonical-sdlc,repo-governance-auditor,founder-review-package,release-notes,smoke,dev-first-wiring}.md` all `verified`. Post-merge smoke: all 5 tool self-tests PASS on main.

## Governance decisions frozen
C6 human-gated merge/deploy/rollback · G9 engine-never-self-spawns · author≠verifier · the `founder-approved` label by a CODEOWNER = the C6 greenlight (never machine-inferred auto-merge) · DEV-first branching · engine-autonomous execution deferred to G2 (heartbeat) + S4 (agent-runner).

## Intentionally open / next
- Engine-autonomous execution (the loop as one durable self-driving run) — deferred until G2 + S4 land; the GH-Actions pipeline runs engine-shaped so it folds in with zero retrofit.
- DEV-environment provisioning (per repo) — founder-gated credentials; runbook at `templates/runbooks/FOUNDER-RUNBOOK-DEV-PROVISIONING.md`.
- Propagation to PLOS/Admin via `os-inherit sync` — runs in the consumer repos.
