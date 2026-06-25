# `templates/workflows/` — the OS-foundational CI/CD workflow TEMPLATES

These are **TEMPLATES**, not live workflows. They live under `templates/` (NOT in
delivery-os's own `.github/workflows/`) so the framework does not run them against
itself. They are the canonical, drift-checked source for the consumer-repo CI/CD spine
described in `capabilities/CANONICAL-SDLC.md`.

## The files

| File | Trigger | What it does | Gate |
|---|---|---|---|
| `dev-preview.yml` | `pull_request` → `dev` | Builds + deploys a Vercel **Preview** (no `--prod`, DEV project id) and posts the Founder Review Package as a PR comment. | Fail-closed if DEV Vercel secrets absent. Minimal perms (`contents:read`, `pull-requests:write`). |
| `promote-to-prod.yml` | `pull_request_target: [labeled]` | The C6 human gate: on `founder-approved` from a CODEOWNER, re-asserts the merge floor (CODEOWNER label · dev CI green · VERIFY verified), squash-merges `dev`→`main`, then deploy-watch + smoke + prod-verify + release-notes + cleanup. | Every floor condition fail-closed. Prod deploy is **not** here — it runs via the existing `deploy.yml` on push to `main` (not duplicated). |
| `repo-governance.yml` | schedule + PR | Runs the Repository Governance Auditor (read-only audit + safe-only cleanup + a rolling NEEDS-APPROVAL issue). | Read-only by default; cleanup is `--apply-safe --safe-only`. Never merges. |

## The scaffolder-copy + founder-fill contract

1. **Vendored, not referenced.** `os-inherit sync` (manifest `workflows[]`) copies each
   file **byte-for-byte** into the consumer's **runnable** location
   `.github/workflows/<basename>` — so they execute as real CI in that repo, with the OS
   not mounted. (Tools/skills vendor under `.claude/os/`; workflows must be under
   `.github/workflows/` to run, so the WORKFLOWS class targets there.)

2. **Drift-checked exactly like every other vendored capability.** `os-inherit check`
   hashes the installed copy against canonical and **fails closed** on any divergence.
   The workflow YAML carries **no secret values** — only `${{ secrets.X }}` references —
   so it is genuinely byte-identical to canonical and stays drift-green.

3. **Founder-filled = GitHub secrets, never file edits.** The per-repo configuration
   (DEV Vercel project id, the DEV `DATABASE_URL`, CODEOWNERS, branch protection) is set
   **once** as GitHub repository secrets / repo settings — see
   `templates/runbooks/FOUNDER-RUNBOOK-DEV-PROVISIONING.md`. The vendored file is **never
   hand-edited**; editing it would trip the drift gate. The only intentionally
   repo-tunable value (`APP_DIR` in `dev-preview.yml`, default `apps/web`) is documented
   inline; if a consumer changes it, that is a deliberate, recorded fork of that one
   workflow.

## Manifest wiring

`capabilities/os-foundation.manifest.json` lists these under the `workflows` key:

```json
"workflows": [
  "templates/workflows/dev-preview.yml",
  "templates/workflows/promote-to-prod.yml",
  "templates/workflows/repo-governance.yml"
]
```

`os-inherit.mjs` `plan()` resolves each into `.github/workflows/<basename>`; `sync`
records them in `.claude/os/INHERITED.json` and `check` keeps them byte-current.
