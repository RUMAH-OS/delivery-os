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

The harness classifier — not the JSON — is what prompts today. Add these exact Bash allow-rules to
`.claude/settings.json` so the in-scope deploy commands run without a per-action "yes". Copy-paste,
merging into any existing `permissions.allow` array:

```json
{
  "permissions": {
    "allow": [
      "Bash(vercel deploy --prod:*)",
      "Bash(npm run db:migrate:*)",
      "Bash(node templates/tools/deploy-lane.mjs:*)"
    ]
  }
}
```

Notes:
- The `:*` suffix matches the command plus any trailing args (e.g. `--scope <team>`).
- The third rule lets the operator call the audited **wrapper** without a prompt — preferred: the
  wrapper enforces the lane and writes the audit log. The first two cover the underlying commands
  the wrapper (and the playbook) invoke.
- **Do NOT** add a wildcard `Bash(vercel:*)` or `Bash(npm:*)` — that would auto-approve out-of-scope
  ops. Keep the rules narrow; the lane + the wrapper's guard denylist are the second line of defense.

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
