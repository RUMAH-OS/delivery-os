---
name: repo-governance
version: 1.0.0
stability: experimental
description: >
  Audit a repo's branch + PR health and keep it release-ready. The single procedure for answering
  "is this branch already merged (even under squash)", "is this PR superseded", "which PRs are
  merge-ready", "are we over the PR budget", "is main release-ready" — with a data-driven G1–G10
  governance knowledge base. It applies ONLY safe cleanup (delete a provably-merged branch, close a
  superseded PR) and SURFACES everything else. It never merges, never closes non-superseded work.
decision_class: production-readiness
inputs:  [the repo's open + merged PRs (gh), its remote branches + ancestry/cherry state (git), per-PR required-check buckets, the latest main CI run]
outputs: [a per-branch/per-PR finding classified to a G-rule + autonomy band, a repo health scoreboard (active PRs vs target/soft-limit, merged-undeleted vs cherry-merged branches, merge-ready/superseded/stale/orphaned, main deployability), and a SAFE-only cleanup applied behind --apply-safe]
earned_from: "CANDIDATE — the recurring founder reality of a repo that squash-merges accumulating ~195 remote branches while `git branch --merged` sees only 11, of PRs piling past any sane budget with no record of which are merge-ready vs superseded vs stale, and of deciding 'is this safe to delete/close' from memory. The load-bearing fix: detect 'merged' from PR STATE first (squash-aware), then ancestry, then cherry-equivalence — and only delete a HIGH-confidence merged branch. Promotes to verified after an independent QA run + a live read-only audit against a real squash-merging repo (PLOS)."
mechanical_spine: "templates/tools/repo-governance-auditor.mjs — the zero-dep branch/PR governance auditor (gh/git). Reuses the CI orchestrator's merge floor + HUMAN-only merge gate (imports decideMerge — it never reimplements or performs a merge). The effectful steps it can take are SAFE-only (G1 branch delete + G2 superseded close, guarded, behind --apply-safe); merge/consolidation/re-target/escalation are surfaced decision points."
# --- v6 frontmatter fields (capability-routable; per skill-frontmatter.mjs #6) ---
kind: execution
capabilities: [audit-branch-health, audit-pr-health, decide-merge-readiness, detect-superseded-work, map-pr-dependency-graph, assess-release-readiness, auto-cleanup-safe]
triggers:
  - "audit the repo"
  - "too many open PRs"
  - "clean up branches"
  - "which PRs are merge-ready"
  - "is this PR superseded"
  - "is main release-ready"
hooks:
  pre: []
  post: []
---
# Repository Governance Auditor (v1.0 — v6 execution skill)

## Overview
A repo's branch + PR hygiene was a private, by-hand loop: scroll `gh pr list`, eyeball which branches
are "probably merged", guess whether a PR is superseded, and decide safe-to-delete/close from memory.
On a repo that **squash-merges**, the by-hand heuristic (`git branch --merged`) is actively wrong — it
sees a handful of the real merged branches because squash erases the branch→main commit link, so
hundreds of genuinely-merged branches look unmerged. This skill is the single procedure for that loop.
It is **read-and-recommend**: it CLASSIFIES every branch/PR to a governance rule (G1–G10), SCORES the
repo, applies only **safe cleanup**, and SURFACES the rest — merge, consolidation, re-target, and
release escalation are decision points, never auto-executed. Its spine is
`templates/tools/repo-governance-auditor.mjs`, which **imports the CI orchestrator's `decideMerge`** so
the merge floor + the human-only merge gate are reused verbatim, never reinvented.

## When to use (and NOT)
- **Use when:** the repo needs a health pass ("audit the repo"), the PR queue is over budget ("too many
  open PRs"), the branch list has grown unbounded ("clean up branches"), the founder wants to know what
  is landable ("which PRs are merge-ready"), a PR may be redundant ("is this PR superseded"), or a
  release call is due ("is main release-ready").
- **NOT** a replacement for: the **human merge gate** (§12 — only a human merge through the gate lands a
  PR; this skill prints `node merge-pr.mjs <n>`, it never presses merge); the **CI orchestrator**
  (per-PR CI watch/diagnose/safe-fix — this skill is repo-wide hygiene, not a single PR's CI loop); the
  **§11 panel** (a consequential release go/no-go is routed there, not decided here). NOT a branch/PR
  bulk-deleter — its only effectful actions are SAFE-only and guarded.

## The squash-merge-aware merged rule (the load-bearing logic)
"Is this branch merged?" is answered by the STRONGEST available signal, in order:
1. **PR state == MERGED** → `{via:"pr-state", confidence:"high"}` — the authoritative signal on a
   squash-merging repo (the branch's own PR is recorded MERGED even though no commit links to main).
2. **Ancestry** — the branch is in `git branch -r --merged origin/main` → `confidence:"high"`.
3. **Cherry-equivalence** — `git cherry origin/main origin/<b>` reports every commit already equivalent
   upstream (all `-`, no `+`) → `{via:"cherry", confidence:"medium"}`.
4. Otherwise → **not merged** (a single `+` commit means real unmerged work).

Only a **HIGH-confidence** merged branch is SAFE to delete (**G1**). A MEDIUM (cherry-only) branch is
**G3 — NEEDS-APPROVAL** (a human confirms before delete). This is the rule that prevents both leaving
hundreds of merged branches uncleaned AND deleting a branch that only *looks* merged.

## The governance knowledge base (G1–G10, by autonomy band)
- **SAFE (auto-actable behind `--apply-safe`):**
  - **G1 merged-branch-not-deleted** — HIGH-confidence merged → `git push origin --delete <b>`.
  - **G2 superseded-pr** — a NEWER open PR's changed-files ⊇ this PR's AND this PR isn't green+greenlit
    → `gh pr close <n> --comment "superseded by #Y …"` (reopenable; a pointer, never silent).
  - **G10 undeclared-owner/exit** — a long-lived (>30d) PR with no owner label → advisory comment
    (printed only; no auto-post).
- **NEEDS-APPROVAL (print the plan + evidence, STOP):**
  - **G3 cherry-merged-branch** — MEDIUM-confidence merged; confirm before delete.
  - **G4 consolidation-candidate** — ≥2 batchable open PRs (shared label/path).
  - **G5 merge-ready** — `decideMerge` == await-human AND greenlit → prints `node merge-pr.mjs <n>`
    (MERGE IS HUMAN-ONLY; it surfaces the command, never runs it).
  - **G6 stale-open-pr** — untouched > 14 days.
  - **G7 orphaned-stack** — base ≠ main and the parent PR is merged/closed/absent → re-target.
  - **G8 pr-limit-breach** — active PRs > soft-limit 5 (target 3) → a drain plan, never an auto-close to a number.
- **NEVER-AUTO (escalate):**
  - **G9 main-not-deployable** — latest main CI red / last deploy failed → nothing else matters until main is green.

## How it composes (those skills/gates are NOT modified here)
- **ci-release-orchestrator (`decideMerge`):** the merge floor + human-only gate — imported and reused, never reimplemented.
- **merge-pr.mjs:** the mechanical human merge gate — the command G5 prints; pressing it is a human act.
- **principle-11-review / production-readiness-review (§11):** the release go/no-go — routed, never decided here.

## Red flags
- This skill merging a PR, or closing a PR that is not provably superseded (or closing green+greenlit work).
- Deleting a branch that is only MEDIUM-confidence (cherry-only) merged, or a protected branch.
- Treating `git branch --merged` as authoritative on a squash-merging repo (it is not — PR state is).
- Auto-closing PRs just to hit the PR budget number (G8 surfaces a plan; it does not enforce a count).
- A main-not-deployable (G9) signal silently swallowed instead of escalated.

## Success criteria (runtime-verifiable)
- `--self-test` passes: G1–G10 fixtures classify correctly, the band split holds, the squash-merge
  regression guard holds (MERGED-PR branch absent from `git --merged` → G1-SAFE high), a green-but-not
  -greenlit PR never reaches G5, and the imported merge gate stays human-only.
- A live `--json` audit cites real `gh`/`git` state; the scoreboard shows the true active-PR count vs
  budget and the real merged-but-undeleted branch count.
- No mutation occurs without `--apply-safe`; only G1 (branch delete) + G2 (superseded close) ever auto-apply.

## Changelog
- 1.0.0 — new (experimental); read-and-recommend repo branch/PR governance over a G1–G10 knowledge base
  with squash-merge-aware merged detection. Spine: `templates/tools/repo-governance-auditor.mjs`.
  Reuses the CI orchestrator's `decideMerge` (merge floor + human-only gate); composes with merge-pr.mjs
  and the §11 readiness panel.
