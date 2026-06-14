# Deploy lane — one-time founder setup (OS v6 #7)

Goal: remove the per-deploy authorization dance (FV-3). Do this **once** per repo. After it,
the `deployment-operator` agent runs in-scope prod deploys + forward-only migrations with **no
per-action prompt**, fully audited. Out-of-scope actions still stop and ask.

There are **two** one-time steps. Both are required — the JSON declares the scope; the allow-rules
are what actually stop the harness auto-mode classifier from prompting on the deploy commands.

---

## Step 1 — Ratify `.deploy-lane.json` (the scope)

Copy the template to the repo root and fill the targets:

```
cp templates/.deploy-lane.json .deploy-lane.json
```

Edit `.deploy-lane.json`:
- set `actions.vercel-deploy-prod.targets` to your Vercel project/alias,
- set `actions.supabase-migrate-forward.targets` to your Supabase project ref,
- set `ratified.by`, `ratified.date`, `ratified.decision_ref` (run the **decision-ratification**
  skill — this is the founder's standing pre-authorization; an empty `ratified.by` = the lane is
  treated as out-of-scope for everything, fail-closed).

Sanity check (no deploy happens):

```
node templates/tools/deploy-lane.mjs --list
node templates/tools/deploy-lane.mjs vercel-deploy-prod --plan
```

---

## Step 2 — Add the auto-mode allow-rules (the real unblock)

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
- This is the **irreducible minimum** — an agent must not self-grant prod-money-deploy permission;
  that one standing authorization is a boundary we keep on purpose. It replaces the per-deploy "yes"
  (∞ actions → 1 one-time action), and every deploy is audited + lane-scoped.
- The `:*` suffix matches the wrapper plus any args. The wrapper enforces `.deploy-lane.json` scope +
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

run with no per-action founder prompt, each appending a record to the lane's `audit_log`. An
**out-of-scope** action (unknown class, undeclared target, or a guard-matched destructive command)
is **refused** with a non-zero exit and requires an explicit human yes. To change scope, re-ratify
`.deploy-lane.json` (Step 1) — the agent never widens its own lane.
