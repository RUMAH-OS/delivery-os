# The Canonical Delivery OS SDLC — the mandatory default lifecycle every repo inherits

> **Board-level architecture (2026-06-25).** The single canonical software development lifecycle for Delivery OS,
> Admin, PLOS, Rumah, and every future repository. Designed by a 4-lens panel (architecture · PR-lifecycle+governance ·
> founder-review+DEV-first · V6-agent-integration). **~85% reuse** of primitives already built (this session + the
> framework); the new surface is small and named below. Optimized for the end-state, not the migration path.
> If this disagrees with a canonical source under `core/` or `capabilities/`, the canonical source wins — fix this file.

## 1. The canonical flow
```
GOAL → Parallel Implementation → Local Verify → Commit → Push → PR to DEV → Automated CI →
Auto Deploy DEV → Founder Review → Founder Greenlight → Auto Merge MAIN → Production Deploy →
Smoke Tests → Production Verify → Release Notes → Branch/PR Cleanup → Learning Capture
```
Three actors, by construction (never blurred):
- **Main loop (Claude)** — plans + spawns specialists (the only spawner — G9; the engine never self-spawns).
- **GitHub Actions** — the bounded runner that executes effectful CI/deploy and posts callbacks (G9-compliant).
- **The founder** — owns every irreversible decision (greenlight · merge · prod · rollback) via C6 human-response gates.

## 2. The lifecycle → capability/skill map (reuse vs new)
⭐ = built THIS session; **REUSE** = compose existing; **NEW** = genuinely new (small).

| Stage | Capability/Skill | Status | Piece |
|---|---|---|---|
| Goal Execution | engine run + dispatch plan | REUSE | `workflow-engine/goals-route.ts`, `capability-selector.ts`, `dispatch-route.mjs` |
| Parallel Implementation | route the specialist (not general-purpose) | REUSE+**NEW-thin** | `dispatch-route.mjs`+`agent-route.mjs` (S1) + the routing-default rule (§5) |
| Local Verify / Commit | author≠verifier gate | REUSE | `.claude/hooks/verify-gate.mjs`, `skills/verify-gate` |
| Push / Branch | auto-push, no local accumulation | ⭐REUSE | `templates/githooks/post-commit` (ff-only, feature-only, never main) |
| PR to DEV | open PR base=`dev` | **NEW-thin** | `open-pr` default `--base dev` |
| CI | monitor→diagnose(F1–F5)→safe-fix→merge-gate | ⭐REUSE | `ci-release-orchestrator` (tool+skill+capability) |
| Auto Deploy DEV | preview/dev deploy | **NEW** + founder-gated | `dev-first-deploy` (Vercel preview-per-PR + `dev` alias) |
| Founder Review | review package on the live DEV deploy — **founder-verifiable changes only** (§2a) | **NEW** | `change-classify.mjs` (`founder_verifiable`) gates `founder-review-package` generator |
| Scorecard | experience scorecard required check | REUSE | `experience-gate.mjs`, `founder-experience-scorecard` |
| Greenlight → Merge | `founder-approved` label = C6 gate; then merge | REUSE | `approvals-route.ts` (C6) + `merge-pr.mjs` (no override) |
| Auto Deploy DEV/Preview | auto-authorized on verification + CI green (no founder action) | REUSE | `deployment-auth.mjs` (state-auth) + `deploy-lane.mjs` |
| Production Deploy | **SDLC-state authorized** (verify + required approvals + Founder-Review-done-if-founder-verifiable + merge-to-main + CI green + lane scope), checked by `deployment-auth.mjs`; audited, forward-only lane | REUSE | `deployment-auth.mjs` + `deploy-lane.mjs` + `.deploy-lane.json` (now POLICY + optional FREEZE) + `deployment-operator` |
| Smoke / Prod Verify | post-deploy probe + deploy-watch | REUSE+**NEW-thin** | orchestrator `--watch-deploy` + `smoke.mjs` |
| Release Notes | gh+git log → CHANGELOG | **NEW-thin** | `release-notes.mjs` |
| Branch/PR Cleanup | delete merged branch; sweep stale | ⭐REUSE+**NEW** | `merge-pr.mjs` + `repo-governance-auditor.mjs` |
| Repository Governance | audit branch/PR health, no accumulation | **NEW** | `repo-governance-auditor.mjs` (G1–G10) |
| Verification | verification is a system behavior | REUSE | `verify-gate` + `qa-test` agent |
| Learning Capture | persist lessons + agent outcomes | REUSE+**NEW-thin** | `file-lesson.mjs`, `agent-health.mjs`, `learning-review` (+ S2 persist) |

**§2a — when Founder Review fires (the trigger, stated explicitly).** Founder Review is required **ONLY** when the change is **founder-verifiable** (classifier `founder_verifiable=true`): something the founder can CLICK, SEE, or VALIDATE — UI/UX, customer-facing copy/emails, public surfaces, user-facing workflows, business behavior. **Non-founder-verifiable changes** (backend, infra, CI, refactors, dependency updates, internal scripts, docs, non-customer-facing migrations) **skip it and auto-continue** after automated verification (author≠verifier / QA / CI), with **no founder interruption**. Every required Founder Review **auto-generates the zero-tech Founder Review Package** — business summary · exact URLs · the simplest path (local-or-DEV) chosen for the founder · click-by-click · expected results · pass/fail checklist · rollback only if relevant — with **all implementation details hidden** (GitHub/Vercel/tokens/env/`VITE_API_URL`/APIs/config/code), surfaced only when a one-time founder action requires it. `founder_verifiable` is **orthogonal to Class C**: a Class C consequential/irreversible action (§ governance) stays human-gated whether or not it is founder-verifiable.

**Net new build:** `repo-governance-auditor.mjs` · `founder-review-package.mjs` · `dev-first-deploy` (+ workflow templates, founder-gated env) · `release-notes.mjs` · `branch-sweep`/smoke · ~4 ownership-policy rows · 3 thin composition-skills + the canonical workflow definition. Everything else is reuse.

## 3. The DEV-first branching model (the structural change vs today)
**Today:** `feature → PR → CI → merge-pr → main → prod`. No `dev`, no DEV env; the founder reviews *at the merge gate against main*. **Target:**
```
feature/<slice> ──PR──▶ dev ──(founder-approved label = C6)──▶ main
     │                   │                                       │
  auto-push       auto-deploy DEV (Vercel preview/alias)   prod (deploy.yml, unchanged)
  (post-commit)   + Founder Review Package posted          + smoke + prod-verify
```
- **DEV = Vercel preview-per-PR + a stable `dev` alias + a dedicated DEV Supabase project** (DEV testing never touches prod rows). Two wirings ship: **Shape A** git-linked (Admin's model — Vercel auto-builds previews, no deploy Action needed; *recommended default*); **Shape B** CLI-prebuilt (PLOS's model — a deploy Action without `--prod`).
- **DEV-first surfaces foot-guns cheaply:** Admin's project is `nodeVersion:"24.x"` (the orchestrator's F3 bug) — pin DEV to `22.x` at provisioning so it fails in DEV, not prod.
- **No local commits / stale branches / accumulated PRs** enforced by: `post-commit` auto-push (no stranded commits — the 2026-06-23 incident fix) · `merge-pr.mjs` deletes the merged branch · `repo-governance-auditor.mjs` (the 3/5 PR limit, squash-merge-aware branch sweep, superseded auto-close).

## 4. The engine binding + the honest seam
The whole lifecycle is **one engine workflow definition** (`delivery-lifecycle`, an ordered `DefinitionStep` list per `definitions.ts`): each stage a step with `effect` (emit-only/idempotent/irreversible → drives the C6 gate), a handler, `maxAttempts`, and at the gates a `verifierId`/`awaitSource:"human-response"`/`gateSeq`. The verified loop binds at CI (act→`engine.verify` T1 "required-checks-green"→`stopCondition: verdict-equals pass`→bounded `retryBackToSeq`→cap-trip `gateSeq`→human gate) — the orchestrator's F1–F5 KB is that loop's diagnosis layer.

| Tier | What | Why |
|---|---|---|
| **AUTONOMOUS (built)** | monitor · diagnose known classes · the verify-loop on the deterministic checks-green rule · deploy-watch · report · merge/deploy *mechanics* (fail-closed) | deterministic rules, no calibration needed |
| **HUMAN-GATED (built)** | founder greenlight (C6 approval) · merge-to-main · Class C / irreversible-business-act (send money/publish/delete) · NEEDS-APPROVAL fixes · rollback | irreversible → C6 |
| **STATE-AUTHORIZED (built)** | prod deploy authorization — `deployment-auth.mjs` checks SDLC state vs a founder-set-once policy (verify + approvals + Founder-Review-done + merge + CI + lane scope); DEV/Preview auto-authorize on verify + CI; fail-closed (never deploy past an unfinished governance step). Replaces "lane ratified once". Founder sets the policy + holds a FREEZE kill-switch, not a per-deploy signature (`DECISIONS.md` D7) | state-gated, not person-gated |
| **ASPIRATIONAL (NOT built — forbidden to fake)** | the engine autonomously running the whole lifecycle with self-spawned agents + lights-out auto-merge | violates G9 (engine never self-spawns) + C6 (irreversible needs a human). Gated on G2 heartbeat (pg_cron) + S4 agent-runner |

**Today: GitHub Actions is the trigger + runner + heartbeat, and Claude's main loop is the spawner.** Build the lifecycle *engine-shaped* now (the GH pipeline *models* the `delivery-lifecycle` definition) so it folds into the durable engine with zero retrofit when G2/S4 land. The **`founder-approved` label is the C6 human gate** — a verified-human decision (a CODEOWNER), *not* the forbidden parsed-green auto-merge; the Action only executes the merge the human authorized, fail-closed on red CI / unverified VERIFY / non-CODEOWNER label.

## 5. V6 — specialist agents as first-class lifecycle citizens
Routing is **built through the spawn** (S1: 16 agents carry `capabilities/triggers`; `agents:check` live; `dispatch-route` reconciles `agent-route` with the G14 owner). The gap is making routing the **default**, via three additive moves (no new mechanism, G9 intact):
1. **One OPERATING-LOOP rule:** before spawning any agent for SDLC work, run `dispatch-route --work-type <wt>` and spawn the `reconciled` owner with the emitted `spawnPrompt`; defaulting to general-purpose for routable work is a routing miss.
2. **Enforce by the existing gate:** wire `dispatch-route --conformance` (already joins the dispatch-log to the spawned `agentType`) into the pre-push/CI gate beside `agents:check` — adherence becomes a measured number, fail-closed.
3. **Close the policy hole:** add `deploy→deployment-operator`, `release→deployment-operator`, `cleanup→software-engineer` (+ optionally `ci→`) to `ownership-gate.mjs` DEFAULT_POLICY (verify/review already present) — ~6 lines; the back half of the SDLC becomes policy-pinned, not advisory. The engine-native `agent-result` chain (S4/S5) is the separate, prod-gated track.

## 6. Inheritance — every repo born-correct
Three propagation spines (all proven, drift-zero across Admin+PLOS): **tools** byte-vendored via `os-inherit` (manifest `tools[]`); **skills** vendored + listed (`skills[]`, §5 rendered from disk); **agents** via `os-sync` base+overlay. The **#1 gap (Phase 0):** `os-foundation.manifest.json` lists the routers+gates but **NOT** the lifecycle spine (`ci-release-orchestrator.mjs`, `merge-pr.mjs`, `deploy-lane.mjs`, the new governance/review tools). Adding them makes the SDLC *inherited* instead of a stranded template — closed with config, no new code. A new **`workflows` manifest class** vendors the `.github/workflows/` templates (scaffolder-copied-then-founder-filled, since they carry per-repo secrets). The only project-specific surface is **`.delivery-os/lifecycle.config.json`** (dev/prod targets, required-check names, deploy-lane classes, smoke endpoint) — the TOOL-vs-DEFINITION-vs-DATA split. `scripts/new-project.sh` runs `os-inherit sync` + `os-sync` + drops the definition + config skeleton → full SDLC on day one.

## 7. Build phases (highest-leverage reuse first; de-risk riskiest-unknown-first)
- **Phase 0 — Inherit what exists (immediate, config-only, highest leverage):** add the lifecycle tools+skills to `os-foundation.manifest.json`; `os-inherit sync` into Admin+PLOS. *Outcome: the built+verified release spine is actually inherited.*
- **Phase 1 — Governance + routing-default (new, off-prod-verifiable):** the `repo-governance-auditor` (cleans the live 195-branch/PR sprawl) + the ownership-policy rows + the OPERATING-LOOP routing rule + `dispatch-route --conformance` gate.
- **Phase 2 — DEV-first branching (structural; founder-gated env):** `dev` branch + protection; PR-to-`dev`; the `vercel-deploy-dev` lane/preview; the founder-review-package generator; the `founder-approved`→promote-to-prod flow. *Founder-gated: DEV Vercel project + DEV Supabase project + DEV secrets.*
- **Phase 3 — Small new tools:** `release-notes.mjs`, `smoke.mjs`, `branch-sweep`.
- **Phase 4 — Engine binding (fold the GH pipeline into the durable run):** author the `delivery-lifecycle` definition; bind greenlight to `approvals-route` C6. *Aspirational until G2+S4.* **Block** any engine-autonomous auto-merge before then.
- **Phase 5 — Close the learning loop:** `learning-review` + `milestone-report` + S2 agent-health persist as the terminal step.

## 8. Founder-gated provisioning (the only irreducible founder work)
Per the runbook discipline (automate everything else): **create the DEV Vercel project (or set main as Production Branch) · create the DEV Supabase project + `DATABASE_URL` · set the DEV GitHub secrets · create+protect `dev` · pin DEV `nodeVersion=22.x`.** One-time, credentials-only; then nothing per-slice. A generated `FOUNDER-RUNBOOK-DEV-PROVISIONING.md` (per repo, zero-tech voice) carries the exact steps. Everything else — preview deploy, review package, CI, diagnose+safe-fix, deploy-watch, smoke, release notes, branch/PR cleanup — is automated.

## 9. Success criteria (the goal's bar)
Professional Git workflow · automatic PR lifecycle (≤3 active, soft 5; superseded auto-closed; reuse-before-create) · DEV-first founder reviews · fast CI (the orchestrator's benchmark: 7m14s→~2m54s) · automatic merges *after founder approval* · no accumulated PRs · no hidden/local work (auto-push) · reusable capabilities+skills registered + inherited · every future slice inherits the workflow automatically · the lifecycle operates autonomously from implementation through production *except* the founder's irreducible approvals/credentials/irreversible decisions.
