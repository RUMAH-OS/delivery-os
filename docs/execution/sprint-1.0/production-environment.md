---
artifact: GitHub `production` Environment spec (Sprint 1.0 — the deploy/migration approval gate)
id: SPRINT-1.0-PROD-ENV
date: 2026-06-28
status: SPEC + apply steps authored by the worker. The founder CREATES the Environment (outward-facing, founder-gated). DRB §4 pre-deploy row + §11 step 0.
---

# `production` Environment — founder approval for migration / Class-C deploys

> A GitHub **Environment** named `production` with the **founder (`bkasanwiredjo`) as a REQUIRED reviewer**. Any
> workflow job that declares `environment: production` **pauses until the founder approves** — this is the
> mechanical gate the **CI migration runner (Sprint 1.4)** and the **D7 state-gated deploy (Sprint 2.1)** hang on,
> so no prod schema write or Class-C deploy happens without a real, distinct founder authorization (DRB §13).

## 1. Where it is created now
| Repo | `production` Environment at 1.0? | Why |
|---|---|---|
| **rumah-admin** | **YES** | the durable financial engine; the CI migration runner (1.4) writes prod schema and the D7 deploy (2.1) authorizes prod promotion — both must be founder-gated. |
| property-lead-os | deferred to its deploy/migration lane (P2.1 / P4) | discovery cutover (4.7) is Class-C; add the Environment when its migration runner / D7 lands. |
| rumah-housing-website | no | near-static, no migrations / no Class-C deploy. |
| jarvis-slack-control-surface | no (deferred to P5.3) | undeployed. |

At Sprint 1.0 the **DoD requires the `production` Environment to exist on rumah-admin** with the founder as
required reviewer; the others are build-on-pull when their deploy lanes arrive.

## 2. The Environment configuration
- **Required reviewer:** `bkasanwiredjo` (the founder) — a real, distinct identity. The deploy/migration job
  cannot proceed until this reviewer approves the pending deployment.
- **Prevent self-review:** ON — the identity that triggered the deployment cannot approve it (reinforces
  author≠verifier at the deploy boundary, mirroring the merge gate).
- **Deployment branch policy:** restrict to **protected branches** only (`main`) — no deploy from an arbitrary
  branch.
- **Wait timer:** 0 (the gate is human approval, not a delay).
- **Secrets:** the prod-write credential / break-glass consumption (Sprint 1.1) is scoped to the
  platform-side runner and lives as an **Environment secret** here so it is reachable ONLY after the founder
  approves the pending job — never by an agent session.

## 3. Apply steps (FOUNDER runs these — admin on rumah-admin required)
Real `gh api` syntax. The reviewer must be passed by **numeric user id**, so resolve it first:

```bash
# 0. Resolve the founder's numeric GitHub user id (the reviewers API takes ids, not logins).
FOUNDER_ID="$(gh api /users/bkasanwiredjo --jq '.id')"
echo "founder id = $FOUNDER_ID"

# 1. Create/update the `production` Environment on rumah-admin with the founder as required reviewer.
gh api --method PUT \
  -H "Accept: application/vnd.github+json" \
  "repos/RUMAH-OS/rumah-admin/environments/production" \
  -f "wait_timer=0" \
  -F "prevent_self_review=true" \
  -F "reviewers[][type]=User" \
  -F "reviewers[][id]=${FOUNDER_ID}" \
  -F "deployment_branch_policy[protected_branches]=true" \
  -F "deployment_branch_policy[custom_branch_policies]=false"

# 2. Verify (capture this as the Sprint 1.0 evidence).
gh api "repos/RUMAH-OS/rumah-admin/environments/production" | jq '{name, protection_rules}'
```

> If `gh api` rejects the mixed `-f`/`-F` form for the nested `reviewers`/`deployment_branch_policy` objects on
> the installed CLI version, pass the body via `--input -` with the same JSON shape:
> `{ "wait_timer":0, "prevent_self_review":true, "reviewers":[{"type":"User","id":<FOUNDER_ID>}],
> "deployment_branch_policy":{"protected_branches":true,"custom_branch_policies":false} }`.

## 4. How the Runtime consumes it (forward reference — do NOT build now)
- **Sprint 1.4 (CI migration runner):** the runner job adds `environment: production`. Applying a forward-only
  migration to prod therefore **pauses for founder approval**, then runs on neutral CI hardware under the
  advisory lock + the single-use break-glass token (1.1) — never a human laptop, never an agent token.
- **Sprint 2.1 (D7 state-gated deploy):** the prod promotion job adds `environment: production`. The promotion is
  gated on the founder reviewer **AND** the D7 `deployment-auth` state + §57 I-Config readiness. Founder approval
  here is the §13 Class-C/migration boundary — not a per-slice stage.
- **prevent_self_review + required reviewer** = the deploy-boundary analogue of the merge gate's non-author
  CODEOWNERS approval: the deployer is never the approver.

## 5. Rollback / reversibility
The Environment is a GitHub setting — deleting it or removing the reviewer is a UI/API revert with **zero
code/schema/prod risk** (Sprint 1.0 rollback row). It is additive: until 1.4/2.1 wire `environment: production`
into a job, it gates nothing yet — it is the standing precondition those sprints attach to.

## 6. Could-not-determine (founder/PO to fill)
- **`FOUNDER_ID`** — the numeric user id is resolved at apply time by step 0; the worker cannot run `gh` and did
  not fetch it. No value is hardcoded.
