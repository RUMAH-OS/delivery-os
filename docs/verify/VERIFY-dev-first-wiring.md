---
slice: "dev-first-wiring"
verify_status: verified
author: "implementation-session(coordinated)"
verifier: "independent-qa-subagent"
date: "2026-06-25"
independence_basis: "recorded-distinct-invocation"
machine_probe: "node --check templates/tools/os-inherit.mjs"
---

# VERIFY — Slice dev-first-wiring

## Verdict
**verify_status:** `verified` · All six probes (1-6) pass: os-inherit parses and carries an additive
`workflows` vendor class; dev-preview deploys a PREVIEW only (no real `--prod`); promote-to-prod is gated
on a CODEOWNER-applied `founder-approved` label (the C6 human gate, not auto-merge) and merges via
`merge-pr.mjs` with `feature/*`-only cleanup; the manifest lists exactly 3 workflows; the DEV provisioning
runbook is in plain zero-tech founder voice.

## Independence header  (Governance §3/§12 — proves author ≠ verifier)
- Verifier identity / invocation: `independent-qa-subagent` — distinct subagent invocation, 2026-06-25.
- Author identity (code under test): `implementation-session(coordinated)`.
- [x] I assert: the verifier did **not** author the production code under test.
- [x] Independence was **real** (a true second invocation, not the same context restyled).

## Execution evidence  (Governance §1 — direct runtime output, verbatim)

### 1 — `node --check templates/tools/os-inherit.mjs` → valid
```
CHECK_OK
```
Exit 0. The file parses (no output from `node --check` on success; `CHECK_OK` is the chained echo).

### 2 — `grep -nE "workflows" templates/tools/os-inherit.mjs` → workflows handling branch exists
```
19://   .github/workflows/<basename>     <- OS-foundational CI/CD workflow TEMPLATES (manifest `workflows[]`);
22://                                       (the file is never hand-edited). See templates/workflows/README.md.
80:// Resolve the manifest tools/contracts/skills/workflows into concrete (sourceAbsPath, vendorRelPath) pairs.
92:  // location `.github/workflows/<basename>` (NOT under .claude/os/), so they actually
96:  for (const w of man.workflows || []) {
99:    items.push({ src, rel: join(".github", "workflows", basename(w)) });
```
A dedicated loop over `man.workflows` vendors each entry to `.github/workflows/<basename>` — additive,
separate from tools/contracts/skills, landing OUTSIDE `.claude/os/` (so GitHub picks them up).

### 3 — `grep -nE "prod|--prebuilt|vercel " templates/workflows/dev-preview.yml` → no real `vercel ... --prod`
```
7:#     1. builds + deploys a Vercel **PREVIEW** (NOT production — no `--prod`, and a
9:#        production deploy.yml, and
15:#   DEV testing must NEVER touch production rows. A dedicated DEV Vercel project
17:#   DEV secret, set in the DEV Vercel project's env) keep DEV and prod fully isolated.
21:#   This NEVER deploys to production and never merges anything. Promotion to prod is a
22:#   separate, founder-gated workflow (promote-to-prod.yml) driven by the
49:# No `contents: write` — this workflow never merges, pushes, or deploys to prod.
69:      # NOTE: the DEV project id — NOT the prod VERCEL_PROJECT_ID. This is what keeps
106:      # surfaces in DEV, never in prod (capabilities/CANONICAL-SDLC.md §3).
115:      # Pull PREVIEW project settings + env into APP_DIR/.vercel (NOT production).
118:        run: vercel pull --yes --environment=preview --token=${{ secrets.VERCEL_TOKEN }}
120:      # Build the PREVIEW artifacts locally (prebuilt flow) — NO `--prod`.
123:        run: vercel build --token=${{ secrets.VERCEL_TOKEN }}
127:      # Deploy the prebuilt PREVIEW — NO `--prod`. Capture the deployment URL so the
134:          URL="$(vercel deploy --prebuilt --token=${{ secrets.VERCEL_TOKEN }})"
```
Every `--prod` mention is in a comment. The only executable vercel commands are `vercel pull
--environment=preview`, `vercel build`, and `vercel deploy --prebuilt` (line 134) — `--prebuilt` with
NO `--prod` = a preview deploy.

### 4 — `grep -nE "founder-approved|CODEOWNER|label|merge-pr|feature/" templates/workflows/promote-to-prod.yml` → C6 human gate
```
10:#   This workflow fires on `pull_request_target: [labeled]` and does NOTHING unless the
11:#   label is `founder-approved` AND the person who applied it is a CODEOWNER. That label,
33:name: Promote to Prod (founder-approved → dev to main)
37:    types: [labeled]
54:    # GATE 1 — the label must be exactly `founder-approved`. Any other labeled event
56:    if: github.event.label.name == 'founder-approved'
72:      # Parses .github/CODEOWNERS for @handles and confirms the person who applied the
76:      - name: Gate — labeler is a CODEOWNER
86:          OWNERS="$(grep -oE '@[A-Za-z0-9_./-]+' .github/CODEOWNERS | sed 's/^@//' | sort -u || true)"
89:            echo "::error::Labeler '$ACTOR' is not a CODEOWNER. The founder-approved label is only valid from a CODEOWNER."
145:          TOOL=".claude/os/tools/merge-pr.mjs"
218:            feature/*)
225:              echo "Head '$HEAD_REF' is not a feature/* branch — leaving it intact (dev/main are never deleted)."
```
GATE 1 (`if: github.event.label.name == 'founder-approved'`) + GATE 2 (labeler must parse as a CODEOWNER,
fail-closed) — a verified human signature, not machine-inferred auto-merge. Merge executes via
`.claude/os/tools/merge-pr.mjs`. Branch cleanup is restricted to `feature/*` (line 218); `dev`/`main` are
explicitly never deleted (line 225).

### 5 — `node -e "...manifest.workflows"` → 3 entries
```
[
  'templates/workflows/dev-preview.yml',
  'templates/workflows/promote-to-prod.yml',
  'templates/workflows/repo-governance.yml'
]
```
Exactly 3 workflow entries in `capabilities/os-foundation.manifest.json`.

### 6 — `head -40 templates/runbooks/FOUNDER-RUNBOOK-DEV-PROVISIONING.md` → zero-tech founder voice
```
# Founder Runbook — Provisioning the DEV environment (zero technical knowledge)

> This is the one-time founder work that code cannot do for you: creating the DEV (testing)
> environment so every future change is reviewed by you, running live, in DEV — never touching real
> data and never near production until you say so. ...
...
## What you are building (in plain language)
A complete, separate copy of your app's plumbing used only for testing:
- a DEV Vercel project — where each change deploys a private preview you can click through;
- a DEV Supabase project — a throwaway database, so DEV testing never touches a real customer row;
- a few DEV secrets in GitHub — the passwords that let the robot build the DEV preview;
- a protected `dev` branch — the staging line all changes flow through before production;
- one safety pin — Node 22.x — so a known foot-gun fails in DEV, never in production.
...
## PART A — Create the DEV Vercel project (Vercel only)
```
Plain-language, step-by-by-step, "one website at a time" founder voice covering DEV Vercel, DEV Supabase,
DEV secrets, the protected `dev` branch, and the Node 22.x pin. No engineering vocabulary required.

## Acceptance criteria  (per-claim PASS/FAIL)
| # | Criterion | Surface exercised | Evidence (→ cmd #) | PASS/FAIL |
|---|-----------|-------------------|--------------------|-----------|
| 1 | os-inherit valid + additive `workflows` vendor class | `node --check` parse + source grep | #1, #2 | PASS |
| 2 | dev-preview deploys PREVIEW only — no real `--prod` | workflow YAML grep | #3 | PASS |
| 3 | promote-to-prod is C6-gated (founder-approved label by CODEOWNER, merge-pr.mjs, feature/* cleanup) | workflow YAML grep | #4 | PASS |
| 4 | manifest `workflows[]` lists exactly 3 entries | manifest JSON parse | #5 | PASS |
| 5 | DEV provisioning runbook is zero-tech founder voice | runbook head | #6 | PASS |

## Surface statement
- The slice's real surface: build-time OS-foundation wiring (os-inherit vendoring + the three CI/CD
  workflow templates + the founder runbook). Driven by: `node --check`/`node -e` execution and targeted
  source greps of the exact files that get vendored.
- [x] No criterion was "verified" via a surface that bypasses the slice.

## Classified open assumptions
| Claim | Classification | Severity |
|-------|----------------|----------|
| os-inherit vendors `workflows[]` to `.github/workflows/` additively | Evidence-backed (#2 loop) | — |
| dev-preview executes only `--prebuilt` (preview), never `--prod` | Confirmed (#3) | — |
| promote-to-prod requires CODEOWNER-applied `founder-approved` label, fail-closed | Confirmed (#4) | — |
| Full os-inherit sync (actual file copy into a target repo) | Unverified here — exercised by the builder in a temp dir | Safe-to-defer |
| Live DEV Vercel/Supabase deploy succeeds end-to-end | Unverified — requires founder provisioning (runbook #6) | Safe-to-defer |

## Gate ledger
| Gate | Status | Evidence |
|------|--------|----------|
| Build/validate green (os-inherit parses) | ✅ | →cmd #1 |
| Manifest workflows[] present (3) | ✅ | →cmd #5 |
| DEV/prod isolation (preview-only deploy) | ✅ | →cmd #3 |
| C6 human gate on promotion (CODEOWNER label) | ✅ | →cmd #4 |
| Live DEV deploy end-to-end | ⬜ | needs founder provisioning |

## Honest limits
- This is **static + grep verification** of build-time wiring; it does not execute the workflows in CI.
- The **full os-inherit sync** (copying tools/contracts/skills/workflows into a real target tree) is
  exercised by the builder in a temp dir, not re-run here.
- A **live DEV deploy** (Vercel preview + Supabase + secrets) requires the one-time founder provisioning
  described in `templates/runbooks/FOUNDER-RUNBOOK-DEV-PROVISIONING.md`; it is out of scope for this probe.

## FAIL history
- none.

## Bug reports
- none.
