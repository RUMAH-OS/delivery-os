---
artifact: FOUNDER ACTIONS — Sprint 1.0 (Identity & Governance Binding)
id: SPRINT-1.0-FOUNDER-ACTIONS
date: 2026-06-28
status: the ordered, founder-only action list. The worker BUILT the artifacts these actions consume; only the founder (`bkasanwiredjo`, admin on all repos) can perform the outward-facing GitHub changes. The PO verifies the captured evidence against the Sprint 1.0 DoD — none of this is "done" until that evidence exists.
---

# Founder actions — the only steps the worker cannot take

> Branch protection, the `production` Environment, the identity decision, and the tag confirmation are
> **outward-facing, hard-to-reverse, founder-gated** (Sprint 1.0 founder checkpoint). Do them in this order — the
> identity decision (Action 1) gates whether the merge floor is real, so it comes first.

## Action 1 — DECIDE the builder/verifier identity model (THE open risk)
**Read:** `IDENTITY-AND-VERIFICATION-MODEL.md` §3. Today the agent and the approver are both `bkasanwiredjo`, which
collapses author≠verifier. Choose:
- **Option A (recommended, cheapest sufficient):** the agent commits/opens PRs under a **distinct GitHub
  identity**; `bkasanwiredjo` stays the CODEOWNERS approver. (One extra account + a token the agent session uses;
  no GitHub App, no bot fleet.)
- **Option B:** founder-only approval, agent stays `bkasanwiredjo` (weaker — un-approvable agent PRs / founder
  becomes the bottleneck immediately).
**DoD evidence:** a written decision (A or B) recorded in the tracker; if A, the distinct builder identity exists
and is named. *Dedicated bot accounts stay DEFERRED until founder-review is provably the bottleneck.*

## Action 2 — INSTALL the CODEOWNERS files (real, enforceable owners)
Place `CODEOWNERS.delivery-os` at delivery-os repo root as `/CODEOWNERS` (replacing the role-token version), and
`CODEOWNERS.template` (tuned per repo) at the root of rumah-admin, property-lead-os,
jarvis-slack-control-surface, and rumah-housing-website. Each routes the catch-all to `@bkasanwiredjo`.
**DoD evidence:** each repo's `/CODEOWNERS` on `main` resolves every path to a real identity (no phantom role
handles).

## Action 3 — APPLY branch protection on every repo's `main`
Run the worker-prepared script as admin (it is DRY-RUN by default):
```bash
cd docs/execution/sprint-1.0
APPLY=1 ./apply-branch-protection.sh        # founder only; PUT is idempotent
```
This sets, per `branch-protection.json`: required PR + non-author CODEOWNERS review + dismiss-stale +
require-last-push-approval + linear history + no direct push + **enforce-admins (no bypass)** + the **per-repo
required-status-check set** (only currently-existing checks active now).
**DoD evidence:** for each repo,
`gh api "repos/<slug>/branches/main/protection" | jq .` output captured — showing `enforce_admins.enabled=true`,
`required_pull_request_reviews.require_code_owner_reviews=true`, `required_linear_history.enabled=true`, and the
expected `required_status_checks.contexts`.

## Action 4 — CONFIRM the engine drift-gate tag and pin it
**Read:** `drift-gate-pin.md`. Confirm **`v5.0`** (latest delivery-os tag) as the Sprint 1.0 engine floor. The
rumah-admin `ci.yml` `ref: v5.0` pin lands as a rumah-admin PR (software-engineer authors it; founder confirms the
tag).
**DoD evidence:** the confirmed tag (`v5.0`) + the merged rumah-admin pin diff (delivery-os checkout carries
`ref: v5.0`).

## Action 5 — CREATE the `production` Environment (rumah-admin)
**Read:** `production-environment.md` §3. Resolve `FOUNDER_ID` then create the `production` Environment on
rumah-admin with `bkasanwiredjo` as the required reviewer + `prevent_self_review=true` + protected-branches-only.
**DoD evidence:** `gh api "repos/RUMAH-OS/rumah-admin/environments/production"` output showing the founder as a
required reviewer.

## Action 6 — PROVE the floor binds (the binding Sprint 1.0 test)
With Action 1's identity model in place, run the **deliberate self-merge attempt**: open a trivial PR and confirm
it **cannot** be merged without a CODEOWNERS approval from an identity ≠ the author, and that an admin **cannot**
bypass it. (Optionally confirm a green required-check run does NOT auto-merge without the approval.)
**DoD evidence:** the blocked-self-merge PR transcript — the *binding* proof the floor is real, not honor-system.

---

## DoD coverage map (what each action satisfies — the PO checks this)
| Sprint 1.0 DoD clause | Satisfied by | Evidence |
|---|---|---|
| every repo's `main` protected (required checks + non-author CODEOWNERS + linear + no-direct-push + no-admin-bypass) | Actions 2 + 3 | per-repo `branch-protection` API capture |
| a `production` Environment with the founder as required reviewer | Action 5 | `environments/production` API capture |
| the drift-gate pinned to a tagged DOS release | Action 4 | confirmed `v5.0` + rumah-admin `ref:` pin diff |
| a deliberate self-merge attempt is blocked | Actions 1 + 6 | blocked-self-merge PR transcript |

## Notes / could-not-determine (worker honest state)
- The worker did **not** run `gh` or apply any setting (founder-gated). The script is DRY-RUN by default.
- **`FOUNDER_ID`** (numeric GitHub user id) is resolved at apply time (Action 5 step 0) — not hardcoded.
- **config-gate is deferred to 1.2** even though rumah-admin already has a `config-gate.yml` — requiring it before
  the I-Config oracle + Vercel read-secrets are provisioned risks blocking all PRs (the exact failure mode the
  ground truth warns against). It is listed `active:false, activates_at:"1.2"` in `branch-protection.json`.
- **`secret-scan` (1.1) · `verify-coverage` (1.x) · `migration-runner` (1.4)** check NAMES are reserved in
  `branch-protection.json` but `active:false` — flip them to `active:true` and re-run the script only once each
  job exists and is green.
