# Deploy lane — one-time founder setup (OS v6 #7; state-auth refit 2026-06-25)

Goal: remove the per-deploy authorization dance (FV-3) **without** a per-deploy founder signature.
After this one-time setup, the `deployment-operator` agent runs in-scope deploys + forward-only
migrations with **no per-action prompt**, fully audited — and a deploy is **authorized by SDLC
STATE**, not by who runs the agent.

**What changed (founder directive 2026-06-25, `DECISIONS.md` D7).** The lane no longer carries a
per-deploy `ratified.by` founder pre-signature. Authorization is now done by `deployment-auth.mjs`,
which checks SDLC state (verification + required approvals + Founder-Review-done-if-applicable +
merge-to-main + CI green + lane scope). The `.deploy-lane.json` is now **POLICY** (which action
classes / targets / guards are allowed) **+ an optional FREEZE kill-switch** — the founder sets the
policy **once**; they no longer ratify each deploy. Canonical authorization rule:
`capabilities/CANONICAL-SDLC.md` (the Production Deploy row) + Governance §6.

There are **two** one-time steps. Both are required — the JSON declares the **policy** (scope); the
allow-rule is what actually stops the harness auto-mode classifier from prompting on the deploy
commands.

---

## Step 1 — Set `.deploy-lane.json` (the POLICY, not a per-deploy ratification)

Copy the template to the repo root and fill the targets:

```
cp templates/.deploy-lane.json .deploy-lane.json
```

Edit `.deploy-lane.json`:
- set `actions.vercel-deploy-prod.targets` to your Vercel project/alias,
- set `actions.supabase-migrate-forward.targets` to your Supabase project ref,
- set the lane **policy** — which action classes/targets/guards are allowed, and which environment
  each signal authorizes (DEV/Preview vs Production). This is **founder-set once**: it is the
  standing policy `deployment-auth.mjs` enforces, NOT a signature on any single deploy.
- (optional) set the **FREEZE** kill-switch to halt all deploys regardless of state.

> **DEPRECATED / removed:** the old `ratified.by` / `ratified.date` / `ratified.decision_ref`
> per-deploy **pre-authorization** is gone. Authorization is no longer "the founder pre-signed this
> lane"; it is "`deployment-auth.mjs` confirms the SDLC state satisfies the policy." The founder
> sets the policy once + holds FREEZE — they do not ratify each deploy.

Sanity check (no deploy happens):

```
node templates/tools/deploy-lane.mjs --list
node templates/tools/deploy-lane.mjs vercel-deploy-prod --plan
```

---

## Step 2 — Add the auto-mode allow-rule (the real unblock)

The harness classifier — not the JSON — is what prompts today. Add **ONE** Bash allow-rule to
`.claude/settings.json` — the audited wrapper. The agent only ever calls the wrapper; the wrapper
runs `vercel deploy` / `npm run db:migrate` **internally** (child processes, not Bash tool calls), so
the classifier only ever sees the wrapper. One rule = one one-time founder action.

```json
{
  "permissions": {
    "allow": [
      "Bash(node templates/tools/deploy-lane.mjs:*)"
    ]
  }
}
```

Notes:
- This is the **irreducible minimum** — an agent must not self-author the **POLICY** (which signals
  authorize which environment); that is **founder-set once** and is the boundary we keep on purpose.
  But **within that policy the agent deploys automatically** the moment `deployment-auth.mjs`
  confirms the SDLC state is satisfied — no per-deploy "yes" (∞ actions → 1 one-time policy), every
  deploy audited + state-checked + lane-scoped.
- **Authorization is state-gated, never person-gated.** A deploy is refused unless the state is
  satisfied — regardless of who runs the agent. **Fail-closed:** never deploy past an unfinished
  governance step (missing/red verification, unsatisfied approval, absent required Founder Review,
  out-of-scope target → refused, non-zero exit).
- The `:*` suffix matches the wrapper plus any args. The wrapper enforces `.deploy-lane.json` policy +
  the guard denylist and writes the audit log; out-of-scope ops are refused regardless.
- **Do NOT** add `Bash(vercel:*)`/`Bash(npm:*)`/`Bash(vercel deploy --prod:*)` — broad rules
  re-open out-of-scope ops AND let deploys bypass the audited wrapper. The single wrapper rule is
  both the smallest surface and the only audited path.

---

## After setup — the standing behavior

```
node templates/tools/deploy-lane.mjs supabase-migrate-forward
node templates/tools/deploy-lane.mjs vercel-deploy-prod
```

run with no per-action founder prompt **when `deployment-auth.mjs` confirms the SDLC state is
satisfied**, each appending a record to the lane's `audit_log`. A deploy whose **state is not yet
satisfied** (verification incomplete, a required approval/Founder Review missing, not merged to
main, CI not green) is **refused, fail-closed** — the OS does not deploy past an unfinished
governance step. An **out-of-scope** action (unknown class, undeclared target, or a guard-matched
destructive command) is **refused** with a non-zero exit. The **Class C / irreversible-business-act
human gate is unchanged** — state-auth authorizes *deploying the code*, never *sending money /
publishing / deleting* (Governance §6/§11). To change the policy, re-edit `.deploy-lane.json` (Step
1) — the agent never widens its own lane. To halt everything, set FREEZE.
