---
name: founder-action-package
version: 1.0.1
stability: experimental
description: >
  Detect that a /goal has reached a genuine founder BOUNDARY (a non-automatable next action), gather
  re-checkable evidence, generate the Founder Action Package (FAP) at docs/goals/FAP-<goal_id>.md, and
  TERMINATE the goal — boundary = STOP = SUCCESS. The FAP is machine-readable frontmatter (re-checked by
  the goal-stop Stop-hook) over a zero-technical-knowledge body in the FOUNDER-RUNBOOK voice. A boundary
  is proven, never asserted: the evidence must be a permanent/authorization denial (boundary-classify),
  not a transient error a retry could clear, and `no_tool` is never sufficient alone (H4).
decision_class: production-readiness
inputs:  [the active .claude/.goal-state.json, the failed/denied action + its verbatim error or denial, boundary-classify output, the work done since start_ref (git log/PR), the relevant VERIFY artifact, for approval/merge boundaries the founder-review-package output]
outputs: [a docs/goals/FAP-<goal_id>.md package that the goal-stop hook validates + clears on, the terminated goal, and an honest refusal whenever the boundary is actually a transient error (retry) or an unverifiable no_tool-alone claim]
earned_from: "CANDIDATE — the infinite-idle incident: a /goal phrased as 'merged to main' looped its Stop-hook forever because merge-to-main is a human gate never autonomously satisfiable. The fix redefines a goal as the AUTONOMOUS FRONTIER and makes reaching a founder boundary the SUCCESSFUL terminal — but only when the boundary is real and re-checkable. This skill is the emit side: it classifies the boundary, gathers the evidence the hook re-checks, writes the FAP, and stops. Promotes to verified after an independent QA run drives a real boundary (a denied merge / an absent credential) through classify->FAP->goal-stop-clears."
mechanical_spine: "templates/tools/boundary-classify.mjs (the permanent-vs-transient classifier) + templates/tools/goal-stop.mjs (the Stop-hook that VALIDATES + clears on the FAP) + templates/FOUNDER-ACTION-PACKAGE.md.template (the envelope). This skill is their human-readable half; it never fakes a boundary — the hook re-checks the evidence."
# --- v6 frontmatter fields (capability-routable; per skill-frontmatter.mjs #6) ---
kind: execution
capabilities: [classify-boundary, generate-fap, terminate-goal]
triggers:
  - "hit a founder boundary"
  - "emit founder action package"
  - "terminate the goal"
  - "what do you need from me"
hooks:
  pre: []
  post: []
---
# Founder Action Package (v1.0 — v6 execution skill)

## Overview
A `/goal` is the **maximum autonomous execution segment** toward a business objective — bounded above by
the **first non-automatable next action**. The moment the next *required* step can only be done by a
human, the autonomous phase has ended **SUCCESSFULLY**: the goal emits a **Founder Action Package (FAP)**
and terminates immediately — it never waits, polls, idles, or stays running awaiting input. This skill is
the single procedure for that emit-and-terminate. Its spine is `templates/tools/boundary-classify.mjs`
(is this really a boundary?) + the `templates/FOUNDER-ACTION-PACKAGE.md.template` (the envelope) +
`templates/tools/goal-stop.mjs` (the Stop-hook that re-checks the FAP and clears the goal). **Every path
here is repo-root-relative** — resolved from the delivery-os root (`$CLAUDE_PROJECT_DIR`, the cwd of every
hook/tool invocation), NEVER from this skill's own directory.

Three load-bearing rules (the reason this is a capability, not a prompt):
- **A boundary is PROVEN, never asserted (H3).** Run `boundary-classify` on the failed action. Only a
  `terminal: boundary` (permanent / authorization-class denial — credential absent, gate refused,
  classifier denied) or a `terminal: failure` (a retriable class whose retry budget is exhausted) warrants
  a FAP. A `transient` (rate-limit / 5xx / timeout / network / flaky) is **retried within caps — never a
  boundary.** Faking a boundary to escape work is the abuse vector the Stop-hook + §11 spot-check exist to
  catch.
- **Evidence must be re-checkable, and `no_tool` is never enough alone (H4).** The FAP's
  `boundary_evidence_kind` must be a hard kind the hook can re-verify: `tool_denial` (the verbatim
  refusal), `credential_absent` (a presence probe), `gate_state` (a merge/deploy/label API result), or
  `cap_tripped`. `no_tool` is a soft, unbounded negative: it clears the goal ONLY co-occurring with a hard
  kind, else it hard-blocks pending founder confirmation.
- **Terminate clean — never idle.** Write the FAP, let the goal-stop hook validate it (the FAP existing +
  well-formed with recognized evidence is the self-certification), and stop. The NEXT autonomous segment is
  a brand-new `/goal resume FAP-<id>` after the founder acts.

## When to use (and NOT)
- **Use when:** a running `/goal` hits a denied merge/deploy, an absent credential, a manual-test/visual
  judgment, an external login, a legal/business/payment decision, or any §3-taxonomy founder action
  ("hit a founder boundary" / "emit founder action package" / "what do you need from me"); OR the H1 cap
  tripped (a forced `disposition: failure` FAP with `boundary_evidence_kind: cap_tripped`).
- **NOT** for: a **transient error** (retry it — `boundary-classify` returns `transient`); a `no_tool`
  claim on a class the project demonstrably automates (that is the abuse case — do the work); or replacing
  the **VERIFY artifact** (a boundary upstream of verification uses `verify_status: blocked-at-boundary`
  naming the same boundary — H2; it never marks an un-run VERIFY `verified`). It does not MERGE, DEPLOY, or
  perform the founder action — it packages it.

## Procedure
1. **Detect.** The action you must take next failed or was denied. Capture the verbatim error/denial, the
   tool, and the timestamp.
2. **Classify.** `node templates/tools/boundary-classify.mjs --action "<action>" (--denial "<verbatim>" | --error "<verbatim>" | --no-tool) [--retries-exhausted]`.
   - `terminal: transient` → STOP packaging; retry within caps. Not a boundary.
   - `terminal: boundary` → continue (note the `class`, `evidence_kind`, `evidence`, `founder_burden_category`).
   - `terminal: failure` → a genuine technical blocker (retriable budget exhausted, or the H1 cap tripped) → a `disposition: failure` FAP.
   - a `no_tool` result with `fap_warranted:false` → gather a co-occurring hard kind, or hard-block pending the founder (H4).
3. **Gather evidence + the progress floor.** Collect the re-checkable evidence (the probe result / verbatim
   denial / gate API state). Confirm `autonomous_work_done` (commits/dispatch since `start_ref`) — false
   ONLY on an immediate hard wall (a credential/tool denial on the very first required action). Confirm
   `verify_clean` (a `verified` VERIFY, OR a `blocked-at-boundary` VERIFY naming THIS boundary — H2).
4. **Generate the FAP.** Copy `templates/FOUNDER-ACTION-PACKAGE.md.template` to `docs/goals/FAP-<goal_id>.md`;
   fill the frontmatter from the classify output and the body sections 1–7 in the zero-tech FOUNDER-RUNBOOK
   voice. **Reuse, don't re-author:** an `approval`/`merge-to-main` FAP **embeds the `founder-review-package`
   output** as its §5; a `credentials`/provisioning FAP reuses the `FOUNDER-RUNBOOK-DEV-PROVISIONING` voice.
5. **Terminate.** Stop. The `templates/tools/goal-stop.mjs` Stop-hook re-reads the FAP, validates it (fresh · disposition ·
   taxonomy class · hard evidence kind · resume_goal · verify_clean), and CLEARS the goal so the turn ends
   and the process exits. A malformed or evidence-less FAP does NOT clear — fix it, don't force the stop.

## Decision points it surfaces (never auto-acts beyond writing the FAP)
- **Is it really a boundary?** `boundary-classify` decides permanent-vs-transient; a transient is retried, not packaged.
- **Resume de-dup (H7).** On `/goal resume`, if the boundary signature equals the prior FAP's, do NOT silently re-emit — re-check whether the founder's fix landed; escalate (`escalated:true`) only if it genuinely did not.
- **The cap (H1).** A tripped wall-clock/turn/cost cap is a FORCED `failure` FAP (`cap_tripped`), not a retry.

## Red flags
- A `boundary` FAP whose evidence is a transient error (rate-limit / 5xx / timeout) dressed as a denial.
- A `no_tool`-alone FAP with no co-occurring hard kind (H4) — the unverifiable-negative abuse vector.
- A FAP naming a human-gated terminal as if the agent could have done it — or one emitted while another live frontier still has autonomous work (H5).
- Marking a VERIFY `verified` that never ran to escape the verify-gate, instead of an honest `blocked-at-boundary` (H2).
- Idling/polling/awaiting input instead of terminating after the FAP is written.

## Success criteria (runtime-verifiable)
- A real boundary (denied merge / absent credential) → a FAP whose frontmatter the `goal-stop` hook validates and clears on.
- A transient error → NO FAP (boundary-classify returns `transient`; the work is retried).
- A `no_tool`-alone FAP → REJECTED by goal-stop (H4); `no_tool` + a hard kind → accepted.
- A cap-trip → a `disposition: failure`, `boundary_evidence_kind: cap_tripped` FAP (H1).
- A duplicate-boundary resume → escalation, not a silent re-FAP (H7).
- `templates/tools/boundary-classify.mjs --self-test` and `templates/tools/goal-stop.mjs --self-test` pass (exit 0) and `node --check`-clean.

## Changelog
- 1.0.1 — 2026-06-27 hook-path integrity: every spine reference made an explicit repo-root path
  (`templates/tools/…`), removing the skill-relative ambiguity that MODULE_NOT_FOUNDed when a bare
  filename resolved against the skill's own dir. No behavior change; guarded forever by `check-hook-paths.mjs`.
- 1.0.0 — new (experimental); the emit side of the /goal Execution Contract. Spine: `templates/tools/boundary-classify.mjs`
  + `templates/tools/goal-stop.mjs` + `templates/FOUNDER-ACTION-PACKAGE.md.template`. Composes with founder-review-package (embedded
  as the §5 of an approval/merge FAP), the FOUNDER-RUNBOOK-DEV-PROVISIONING voice, the verify-gate (H2
  blocked-at-boundary), and founder-burden-gate (each FAP counts one founder action). Capabilities:
  classify-boundary, generate-fap, terminate-goal.
