# `ci-cd/` — the CI/CD + deploy wiring assets (GitHub plane ↔ Neo compute)

> **What this is.** The **prepared assets** that move a consumer repo's CI/deploy compute from
> GitHub-hosted runners onto the **Neo ephemeral self-hosted runner**, while GitHub stays the
> event + gate plane (PRs, required-check status API, branch protection, CODEOWNERS, secrets).
> They are **templates + snippets + docs** the founder applies at install time **with the runner
> online** — this folder **changes no live workflow and installs nothing**. It implements the
> NEO-EXEC-07 §7 + NEO-ARCH-01 §B design as applyable assets.

This is an **Adapter-subsystem asset** under `infrastructure/execution-node/`. It is **not Core**
and not vendored into a consumer; the `runs-on` value and the deploy CLI are CI/host detail that
the Runtime never names (NEO-EXEC-07 §2.3 — a `verify`-kind job is placed by the *selector*, never
by a hard-coded `runs-on`). Core stays unaware of "Neo", Vercel, or GitHub-runner.

## The five deliverables (this sprint, P3.4)

| # | Asset | File(s) | Status |
|---|---|---|---|
| 1 | The `runs-on` flip pattern (the one-line + repo-variable kill-switch) | `runs-on/RUNS-ON-FLIP.md` · `runs-on/runs-on-flip.snippet.yml` | template |
| 2 | The deploy job template (token-attributed Vercel + pooler migrate + **binding** post-deploy verify) | `deploy/DEPLOY-JOB.md` · `deploy/deploy-job.snippet.yml` · `deploy/reusable-deploy.yml` | template |
| 3 | The runner-as-CI-compute handshake doc (GitHub plane / Neo compute; physical author≠verifier) | `docs/HANDSHAKE.md` | doc |
| 4 | The rollback playbook + helper (flip `vars.CI_RUNNER` back; per-check revert; `vercel promote`) | `docs/ROLLBACK.md` · `rollback-helper.mjs` | doc + tool |
| 5 | The founder apply procedure (which workflows, the repo-variable, the secrets, the order) | `apply-cicd.md` | procedure |

## The two invariants these assets hold

1. **GitHub-hosted is always the rollback floor.** `vars.CI_RUNNER` defaults to `ubuntu-latest`
   when unset/empty. Clearing the variable in the GitHub UI reroutes the entire fleet back to
   GitHub-hosted **in seconds, with no commit, with no dependency on Neo** (so a dead Neo cannot
   disable its own escape hatch — NEO-ARCH-01 §B.4 / ADR-004).
2. **No secret literal anywhere.** Every token flows via `secrets.VERCEL_TOKEN` / env. The org/project
   ids flow via `secrets.VERCEL_ORG_ID` / `secrets.VERCEL_PROJECT_ID` (matching PLOS `deploy.yml`).
   gitleaks must stay green across these files.

## Label consistency with P3.2 `register-runner.sh`

`register-runner.sh` registers the runner with `DOS_RUNNER_LABELS="neo,macos,self-hosted"`
(`node-config.env.example`). A `runs-on: [self-hosted, neo]` therefore matches that runner by the
intersection of its labels. The `neo` label is the single source of truth shared between the runner
registration (P3.2) and these `runs-on` snippets (P3.4) — change one, change both.

## What is deferred to install-time (NOT done here)

- The **actual application** of snippets 1–2 to `rumah-admin` / `property-lead-os` live workflows.
- The **creation of the `CI_RUNNER` repo variable** in each repo's GitHub UI.
- The **M3 binding-check flip** and **M5 deploy move** — both are founder ★ checkpoints (they touch
  the merge/release floor) and require the runner online + an M1 byte-identical parity proof first.

**Status: DESIGN / ASSETS — installs nothing, edits no live workflow, no push.** The independent
VERIFY is static here (YAML well-formed · no secret literal · label-consistent with P3.2); the
founder validates on a real apply with the runner online.
