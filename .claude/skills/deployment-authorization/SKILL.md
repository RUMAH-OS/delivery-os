---
name: deployment-authorization
version: 1.0.0
stability: experimental
description: >
  Decide WHETHER a deploy to a target env may run RIGHT NOW from live SDLC STATE — the trigger is any
  attempt to deploy to dev, preview, or prod (the deployment-operator running the deploy lane). It
  replaces the founder's one-time `ratified.by` signature with a per-invocation state check: given a
  target env (and optionally the PR / base ref), it reads the SDLC signals for that target (verification
  done, approvals present, founder-review-if-applicable) and returns a per-signal verdict — authorized,
  or refused with the exact unfinished governance step. Authorization depends on STATE, never on who runs
  the agent. Load-bearing invariant: never deploy past an unfinished governance step. Read-only and
  idempotent (it judges state, never changes it) and fail-closed (missing/erroring ⇒ refuse).
decision_class: production-readiness
inputs:  [the target env (dev|preview|prod), the PR number (--pr, optional), the base ref (--base, optional), the deploy-lane policy (--lane, optional), and the live SDLC artifacts/signals for that target (verification status e.g. docs/verify/VERIFY-*, PR approvals, founder-review-if-applicable)]
outputs: [a JSON verdict {authorized, target, reason, signals{...}} on stdout with exit 0 iff authorized — each SDLC signal reported with its own pass/fail so a refusal names the exact unfinished governance step the deploy must not pass]
earned_from: "CANDIDATE — founder ratification 2026-06-25: deployment must be authorized by SDLC STATE, not by a founder's one-time signature on the deploy lane. The motivating case is rumah-admin's deploy boundary — a deploy lane that could be 'ratified once' and thereafter ship regardless of whether verification/approval/founder-review had actually finished, conflating WHO authorized with WHETHER the state permits it. This skill makes authorization a function of state: an agent may deploy iff the governance steps are done, and a refusal names the unfinished one. Promotes to verified after an independent QA run drives the live check->verdict path against real SDLC signals for each target env."
mechanical_spine: "templates/tools/deployment-auth.mjs — the zero-dep state-authorization tool (`check --target <dev|preview|prod> [--pr <n>] [--base <ref>] [--lane <path>]` -> JSON {authorized, target, reason, signals{...}}; exit 0 iff authorized). It is called by templates/tools/deploy-lane.mjs BEFORE every action (the deployment-operator's only door): authorized=false ⇒ the lane REFUSES, audits `governance:<step>`, and exits non-zero. Fail-closed: the tool missing, erroring, or emitting unparseable output ⇒ the lane refuses. This skill is its human-readable half — it judges state, it never deploys."
# --- v6 frontmatter fields (capability-routable; per skill-frontmatter.mjs #6) ---
kind: execution
capabilities: [authorize-deployment]
triggers:
  - "deploy to dev"
  - "deploy to preview"
  - "deploy to prod"
  - "is this deploy authorized"
  - "can I deploy"
hooks:
  pre: []
  post: []
---
# Deployment Authorization (v1.0 — v6 execution skill)

## Overview
A deploy is about to run and the only question that matters is **may it run right now?** The old answer
was a founder's one-time signature on the deploy lane (`ratified.by`): ratify once, ship forever. That
conflates **who** authorized with **whether the state permits it** — it cannot tell that this particular
deploy would jump past an unfinished verification, a missing approval, or a skipped founder review. This
skill is the single procedure that decides authorization from **live SDLC STATE**: given a target env
(dev|preview|prod), it reads that target's governance signals and returns a per-signal verdict —
authorized, or refused with the exact unfinished step. Its executable spine is
`templates/tools/deployment-auth.mjs`, called by `templates/tools/deploy-lane.mjs` before every action.

Load-bearing design rules (the reason this is a capability, not a prompt):
- **Authorization is by STATE, not by who runs the agent.** An agent may deploy iff the SDLC state
  authorizes the target env. The same call from a founder, an operator agent, or CI returns the same
  verdict — the decision is the state, never the caller.
- **Never deploy past an unfinished governance step.** A refusal names the exact step (verification not
  done / approval missing / founder review pending) so it can be finished, not overridden.
- **Per-signal verdict.** The output is `{authorized, target, reason, signals{...}}` with each SDLC signal
  reported with its own pass/fail — the refusal is explainable, not a bare "no".
- **Read-only + idempotent.** It judges state; it never changes it. Two checks of the same state return
  the same verdict.
- **Fail-closed.** Missing inputs, an erroring tool, or unparseable output ⇒ refuse. Exit 0 iff authorized.

## Process
1. **Resolve the target env** from `--target` (dev|preview|prod). The deploy lane supplies it from the
   action's `target_env`; an unknown/missing value is treated as `prod` (strictest) upstream.
2. **Gather the SDLC signals (read-only)** for that target — verification status (e.g. the VERIFY
   artifact), PR approvals (when `--pr` is given), and founder-review-if-applicable.
3. **Evaluate each signal** to a pass/fail; the deploy is authorized only when every required signal for
   the target env passes.
4. **Emit the verdict** — JSON `{authorized, target, reason, signals{...}}` on stdout; exit 0 iff
   authorized, 1 otherwise. A refusal's `reason` names the unfinished governance step.

## When to use (and NOT)
- **Use when:** a deploy to dev / preview / prod is about to run and the question is "may it run now?"
  (the deployment-operator's deploy-lane wrapper calls it automatically before every action), or someone
  asks "is this deploy authorized?" / "can I deploy?".
- **NOT** a replacement for: the **deploy lane POLICY** (`.deploy-lane.json` declares WHAT may run + the
  guard denylist — this skill decides WHETHER); **independent verification** (it READS verification state,
  it does not author or replace it — author≠verifier, §3/§12); the **founder FREEZE kill-switch** (a hard
  stop that removes authorization regardless of state); or the **smoke battery** (deploy ≠ done). It never
  deploys — it judges state.

## How to run it
- `node templates/tools/deployment-auth.mjs check --target dev` — verdict for a dev deploy.
- `node templates/tools/deployment-auth.mjs check --target prod --pr <n>` — prod verdict with PR approvals/review in scope.
- Flags: `--target dev|preview|prod` (required) · `--pr <n>` · `--base <ref>` · `--lane <path>`.
- Invoked automatically by `templates/tools/deploy-lane.mjs` before each action (the operator's only door).

## Decision points it surfaces (never auto-acts beyond emitting the verdict)
- **May this target env deploy now?** The single yes/no, decided from state.
- **Which governance step is unfinished?** A refusal names it in `reason` + `signals` so it can be finished.
- **Is the state ambiguous / a signal unreadable?** Fail-closed refuse — never an optimistic yes.

## Red flags
- An authorization decided from WHO is running (caller/role) instead of the SDLC state.
- A deploy allowed to pass an unfinished governance step (verification not done / approval missing / founder review pending).
- A bare "refused" with no named step, or a `reason` that does not match the failing signal.
- A missing/erroring/unparseable tool result treated as authorized instead of fail-closed refused.
- The tool mutating any state (it must be read-only + idempotent).

## Success criteria (runtime-verifiable)
- `check --target <env>` emits `{authorized, target, reason, signals{...}}` and exits 0 iff authorized, 1 otherwise.
- Authorization is a function of SDLC STATE alone — identical state yields an identical verdict regardless of caller.
- A refusal names the exact unfinished governance step in `reason` (and the failing signal in `signals`).
- The same state checked twice returns the same verdict (idempotent); the tool changes no state (read-only).
- Missing inputs / tool error / unparseable output ⇒ fail-closed refusal (exit 1), and deploy-lane.mjs refuses on it.
- An unknown/missing target env is treated as `prod` (strictest) before the check.

## Changelog
- 1.0.0 — new (experimental); founder ratification 2026-06-25. Replaces the deploy lane's one-time
  `ratified.by` signature with per-invocation SDLC-state authorization. Earned from the rumah-admin
  deploy boundary (a "ratify-once, ship-forever" lane that could jump an unfinished governance step).
  Spine: `templates/tools/deployment-auth.mjs`, called by `templates/tools/deploy-lane.mjs` before every
  action (fail-closed). Composes with the deploy lane policy (WHAT may run), verify-gate (reads
  verification state), and the founder FREEZE kill-switch. Capability: authorize-deployment.
