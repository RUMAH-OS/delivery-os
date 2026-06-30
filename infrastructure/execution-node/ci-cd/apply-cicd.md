# `apply-cicd.md` — applying the CI/CD assets to a consumer repo (install-time)

> The step-by-step the **founder** follows, **with the Neo runner online**, to apply the assets in
> this folder (1–4) to a consumer repo (`rumah-admin`, `property-lead-os`). This is the procedure;
> it is **not run by shipping these assets**. Nothing here is automated — the binding-check flip (M3)
> and the deploy move (M5) are founder ★ checkpoints because they touch the merge/release floor.

## Hard preconditions (all must hold before step 1)

- [ ] **The Neo runner is online** — `register-runner.sh` (P3.2) has run; the runner shows `online`
      in **Settings → Actions → Runners** with labels `neo, macos, self-hosted`.
- [ ] **The off-Neo watchdog is up** (NEO-HBM M0) — a Neo death must page, not silence.
- [ ] **colima `postgres:16` is warm** on Neo (CI jobs need it; `verify-health.sh` confirms).
- [ ] **GitHub secrets already exist** in the target repo (these are unchanged from hosted CI):
      `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, and (for the deploy migrate)
      `SUPABASE_DB_URL` (the **session pooler `:5432`** connstring). For the engine-ownership job:
      `DELIVERY_OS_REPO`, `DELIVERY_OS_TOKEN`. **No secret is created by these assets** — they only
      reference existing GitHub secrets.

## Step 0 — create the `CI_RUNNER` repo variable (the kill-switch), left EMPTY

In the target repo: **Settings → Secrets and variables → Actions → Variables → New repository
variable**. Name it `CI_RUNNER`. **Leave the value empty** (or do not create it yet).

- Empty ⇒ every `runs-on` expression resolves to `ubuntu-latest` — so applying the snippets in steps
  1–2 changes **nothing about where jobs run** until you deliberately flip the variable. This lets you
  land the workflow edits on `main` safely, decoupled from the actual cutover.

## Step 1 — apply the `runs-on` flip to the CI workflow (no behavior change yet)

Edit the target repo's CI workflow (`.github/workflows/ci.yml`). For each job to move, change only the
`runs-on:` line per `runs-on/RUNS-ON-FLIP.md`:

```diff
-    runs-on: ubuntu-latest
+    runs-on: "${{ vars.CI_RUNNER == '' && 'ubuntu-latest' || fromJSON(vars.CI_RUNNER) }}"
```

- **rumah-admin** `ci.yml` jobs: `build-and-migrate`, `engine-ownership`.
- **property-lead-os** `ci.yml` jobs: apply to its check jobs equivalently.
- Commit, open a PR, merge. With `CI_RUNNER` empty, CI still runs on `ubuntu-latest` — this PR is a
  **no-op cutover-prep**, verifiable as such.

## Step 2 — apply the deploy job (PLOS first; admin only if it deploys via Vercel)

For a repo that deploys to Vercel (PLOS):

1. Confirm the per-repo prerequisites exist (DEPLOY-JOB.md table): `infra/config-doctor.mjs`,
   `infra/post-deploy-verify.mjs`, the `SUPABASE_DB_URL` secret.
2. Either drop `deploy/deploy-job.snippet.yml`'s `deploy:` job into the existing `deploy.yml`, **or**
   install `deploy/reusable-deploy.yml` and reduce `deploy.yml` to the caller (see its footer).
3. **Fix the soft spot:** ensure the post-deploy verify step has **no `continue-on-error`** — it is
   binding now (the whole point).
4. Add the `runs-on` expression to the deploy job so it routes via `CI_RUNNER` too.

> **rumah-admin:** confirm its actual prod-deploy mechanism before applying — it does not use the
> PLOS `deploy.yml` shape. If it has no Vercel deploy workflow, **skip step 2 for admin**; the CI
> move (step 1) is independent of the deploy move.

## Step 3 — parity-prove on Neo (M1) BEFORE flipping anything binding

Add a **non-binding clone** of one CI check pinned to `runs-on: [self-hosted, neo]` (a temporary job
with a non-required name). Push a PR and confirm the Neo run yields a **byte-identical verdict** to
the GitHub-hosted run on the same commit. Only a green parity proof authorizes step 4.

## Step 4 — ★ FOUNDER GATE (M3): flip binding checks, ONE AT A TIME

With parity proven and the runner online:

1. Set `CI_RUNNER` = `["self-hosted","neo"]` in the GitHub UI. Future runs now route to Neo.
2. Move binding checks **one at a time** (per-check, not all at once) — watch each go green on Neo
   before promoting the next. Branch protection + CODEOWNERS + the `verify-coverage` status stay on
   GitHub (the gate is GitHub's; only the compute is Neo's).
3. Confirm the `machine_probe` log records `node: neo-node2` (the physical author≠verifier proof).
4. **Rollback at any sign of trouble:** clear `CI_RUNNER` → instant fall-back to `ubuntu-latest`
   (`docs/ROLLBACK.md`, Tier 1). Per-check flake → Tier 2.

## Step 5 — ★ FOUNDER GATE (M5): move deploy + stand up staging

Cut the deploy job over to Neo and stand up the permanent staging rung (NEO-ARCH-01 §B.3.4) so the
binding post-deploy verify is safe to enforce. The deploy authorization and merge-to-main remain
founder acts (Class-C); the co-equal-token / deploy-approval gate (NEO-ARCH-00 §6.5) must be in place
before any standing self-serve prod deploy.

## The order, summarized

```
preconditions → step 0 (var, empty) → step 1 (CI runs-on, no-op cutover-prep)
   → step 2 (deploy job + binding verify) → step 3 (M1 parity-prove)
   → step 4 ★ M3 (flip binding checks one at a time) → step 5 ★ M5 (deploy move + staging)
```

## Deferred to install-time (NOT done by shipping these assets)

- The **actual edits** to `rumah-admin` / `property-lead-os` live workflow files.
- The **`CI_RUNNER` variable creation** and the **M3 binding flip** (the cutover that reroutes real
  required checks) — a founder ★ act, gated on the runner online + a green M1 parity proof.
- The **M5 deploy move + staging stand-up** — a founder ★ act on the release floor.
