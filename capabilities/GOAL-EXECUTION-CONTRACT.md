# The Canonical Delivery OS /goal Execution Contract

> **Foundational capability (2026-06-25).** Every current and future repository inherits this. It redefines
> what a `/goal` IS so a Claude Code session never idles waiting for a human. SDLC is unchanged — this
> terminates cleanly at the human gates the SDLC already declares. Status: `candidate` → independent §11
> review before it lands (this is a consequential change to the autonomous-execution envelope).
> If this disagrees with a canonical source under `core/`, the canonical source wins — fix this file.

## 1. The core model — a goal is the autonomous frontier, not the objective
A `/goal` is the **maximum autonomous execution segment toward a business objective — not the objective itself.**
It is bounded below by the start gesture and bounded above by the **first non-automatable next action.** Inside
those bounds it has **no limits**: minutes or hours, unlimited parallel specialist spawns (G9 — the main loop
spawns, never the engine), unlimited autonomous build · verify · merge-to-dev · diagnose · learn · continue.

The objective may itself contain human-gated end-states ("ship feature X to prod"). The goal does **not** own the
whole objective — it owns the **autonomous frontier** of it. The objective is reached across a **chain of `/goal`
segments**, each separated by exactly one founder action. This is the operational form of Governance §2 ("work the
loop continuously; do not pause"), §15 ("credentials are a stop condition, never improvised around"), and the SDLC's
AUTONOMOUS / HUMAN-GATED / ASPIRATIONAL tiering: **run the AUTONOMOUS tier to its own edge, then stop there.**

## 2. The boundary = STOP = SUCCESS  (the prime directive)
**The moment the next *required* action can only be done by a human, the autonomous phase has ended SUCCESSFULLY.**
The goal emits a **Founder Action Package (FAP)** and **terminates immediately** — never waits, never polls, never
idles, never remains running awaiting input, never requires interrupting Claude Code.

Three terminal states — **all terminate, none idle:**

| Terminal | Meaning | FAP `disposition` |
|---|---|---|
| `objective-complete` | the objective was fully automatable and is done | `complete` |
| `boundary-success` | the autonomous frontier is exhausted; the next step is a genuine founder action | `boundary` |
| `blocked-failure` | a genuine technical blocker the agent cannot clear within its autonomy | `failure` |

`boundary-success` is **not "unfinished."** It is the correct, successful completion of one autonomous segment. The
next segment is a **brand-new `/goal`** resumed after the founder acts. *Reaching a founder boundary is the goal
succeeding at its actual job: do everything a machine can, then hand off cleanly.* This is the exact fix for the
infinite-idle incident — a goal phrased as "merged to main" looped its Stop-hook forever because merge-to-main is a
C6 human gate (never autonomously satisfiable). Under this contract it reaches `boundary-success` at the merge gate,
emits a FAP, and exits.

## 3. The founder-boundary taxonomy + detection
A boundary is a **non-automatable next step**. The classes map 1:1 onto the founder-burden taxonomy
(`founder-burden-gate.mjs`) and the SDLC HUMAN-GATED tier — so detecting a boundary also feeds the burden metric.

| Boundary class | founder-burden category | How the agent DETECTS it (the evidence) |
|---|---|---|
| `approval` (greenlight, PR review) | `per_action_authorization` | C6 gate unfired: `founder-approved` label absent (gh API); `merge-pr.mjs` fail-closed |
| `merge-to-main` | `per_action_authorization` | the merge gate / permission classifier refuses; only a CODEOWNER label clears it |
| `credentials` / secrets | `env_token_migration_action` | a credential-**presence** probe reports the key ABSENT (presence, never value) |
| `deploy-auth` | `per_action_authorization` | `deploy-lane.mjs` fail-closed on an unratified lane; classifier denies `--prod` |
| `manual-testing` | `live_validation_defect_found` | acceptance needs human visual/UX/physical judgment with no automatable test path |
| `external-login` / account setup | `manual_setup_step` | provider console/OAuth with no headless path |
| `legal` / business-decision | (business) | the decision has no deterministic rule |
| `payment` | `per_action_authorization` | no unguarded "charge" tool exists |
| `physical` | `manual_setup_step` | no tool can perform the physical act |
| `cross-repo-coordination` | `cross_repo_coordination` | a sibling repo's gate must fire first |
| `other` | `other` | must cite explicit evidence — flagged for review |

**Detection signals (the four enforcement layers, incl. the permission classifier — Governance §15):**
1. **Tool denial** — the auto-mode permission classifier refuses (deploy, token mint, prod write, merge-to-main). Capture the verbatim denial + tool + timestamp.
2. **Missing credential** — a presence probe returns absent.
3. **Fail-closed gate state** — `merge-pr.mjs` / `deploy-lane.mjs` / a missing `founder-approved` label.
4. **No-tool** — the action has no automatable path at all (weakest signal; anti-abuse §6).

**Boundary vs transient failure (critical):** a boundary requires the action was *attempted (or proven to have no
tool)* and the result is a **denial or structural absence** — not an error a retry could clear. Network / rate-limit /
flaky-test / fixable-bug are **transient → retry within caps**, never boundaries. Only when a *retriable* class
exhausts its retry budget does it become `blocked-failure` (terminal `failure`, not `boundary`).

## 4. The Founder Action Package (FAP)
Emitted **at** the boundary, **before** terminating, at `docs/goals/FAP-<goal_id>.md` — machine-readable frontmatter
(re-checked by the Stop-hook, the §12 VERIFY pattern) + a zero-technical-knowledge body in the FOUNDER-RUNBOOK voice.
Template: `templates/FOUNDER-ACTION-PACKAGE.md.template`.

```markdown
---
goal_id: <slug>
disposition: boundary                # complete | boundary | failure
boundary_class: merge-to-main        # §3 taxonomy (required iff boundary)
boundary_evidence_kind: gate_state   # tool_denial | credential_absent | gate_state | no_tool
boundary_evidence: "merge-pr.mjs exit 1: required check green but no founder-approved label (gh api labels=[])"
founder_burden_category: per_action_authorization
autonomous_work_done: true
verify_clean: true
resume_goal: "/goal resume FAP-<slug>"
---
# Founder Action Package — <goal_id>
## 1. Status (one screen)            — where we are, one plain line
## 2. What I completed                — bullets, each linked to a commit/PR/VERIFY
## 3. What remains                    — the rest of the objective, after this action
## 4. WHY I stopped (the boundary)    — "the next step is X; only you can do it because …" + cite the evidence
## 5. Exactly what to do (zero-tech)  — numbered: open <link> · click <label> · expect <result>
## 6. Rollback (if relevant)          — exact undo + the restoreable ref
## 7. Resume the next autonomous phase — the EXACT one line: /goal resume FAP-<slug>
```
Reuse, not new content: a `merge`/`approval` FAP **embeds the `founder-review-package` output** as its §5; a
`credentials`/provisioning FAP reuses the `FOUNDER-RUNBOOK-DEV-PROVISIONING` voice. The FAP is the envelope.

## 5. Terminate = success, reconciled with the Stop-hook
A new Stop-hook **`goal-stop.mjs`** is wired as a **second Stop entry** (Claude Code runs all Stop hooks; the turn
ends only when *all* allow it — so verify-gate AND goal-stop both pass, which is correct: you cannot FAP-out with
dangling unverified impl). Logic:
```
read .claude/.goal-state.json
no active goal            -> exit 0 (allow stop)         # non-goal turns unaffected
objective_complete()      -> exit 0                       # clears: complete
fresh_valid_FAP(goal_id)  -> exit 0                       # clears: boundary/failure
else                      -> {decision:"block", reason:"Goal <id> not complete. Continue autonomous work.
       If — and ONLY if — the next required step is a genuine founder action you cannot automate,
       emit docs/goals/FAP-<id>.md (boundary_class + boundary_evidence) and stop."}
```
`fresh_valid_FAP` = exists, newer than goal-start, `disposition∈{complete,boundary,failure}`, and (iff `boundary`)
a taxonomy `boundary_class` + non-empty `boundary_evidence` of a recognized kind + present `resume_goal` + `verify_clean:true`.

**Condition-phrasing convention (the heart of the fix):** a goal's stored condition is **structured, never free prose**,
and is **forbidden from naming a human-gated terminal as its clear condition.** `goal-init.mjs` writes
`{goal_id, objective, clears_on:["objective_complete","valid_fap_at_boundary"], started_at, start_ref}`. So **"produced a
valid FAP at a genuine boundary" structurally SATISFIES the condition** — the hook clears, the turn ends, the process
exits. A goal can never again be phrased as "merge to main"; it is phrased as "advance to the autonomous frontier of
merging to main," whose reachable terminal is `objective_complete OR FAP`. Self-certification = the FAP passing the
hook's validation (the §12 pattern: the hook proves the FAP exists + is well-formed with recognized evidence; it
cannot prove the boundary judgment was *truthful* inside one agent — the honest limit, §7).

## 6. Anti-abuse — no fake boundaries, unlimited pre-boundary autonomy
All defenses gate the **exit only**, never pre-boundary work:
1. **Evidence-or-no-exit** — a `boundary` FAP without machine-recognized evidence does not clear the hook.
2. **Evidence must be re-checkable** — `tool_denial` (verbatim refusal) / `credential_absent` (probe) / `gate_state`
   (merge/deploy/label API). `no_tool` is the only soft kind → **always flagged to the friction log + spot-checked**
   (a `no_tool` claim on a class the project demonstrably automates is the abuse vector the §11 catch covers).
3. **Progress floor** — `autonomous_work_done` must be true (commits/dispatch-log since `start_ref`) **unless** the
   boundary is an immediate hard wall (`credential_absent`/`tool_denial` on the very first required action).
4. **`verify_clean` coupling** — the verify-gate Stop already blocks exit while impl changed without a fresh
   independent VERIFY, so a goal cannot FAP-out leaving unverified code.

**Autonomous execution is preserved by construction — unbounded in SHAPE, bounded by a kill-switch cap (H1):**
`goal-stop.mjs` never blocks or throttles work *before* a FAP — no limit on parallel agents, merges-to-dev, or
iterations — EXCEPT the H1 turn/wall-clock/cost ceiling, whose trip forces a `failure` FAP (the mandated kill-switch,
without which the ambiguous-failure case loops forever). The boundary is the only thing needing proof; everything
before it, up to the cap, is free.

## 7. Inheritance · SDLC integration · honest limit
- **Governance §16** (new): *"Autonomous execution terminates at the founder boundary — the boundary is success."*
  Per §13: the **`goal-stop.mjs` exit-gate is KERNEL MECHANISM** (thin, non-swappable, fires without consent, fails
  closed); the **boundary taxonomy + FAP content are GOVERNANCE POLICY** (swappable, invoked on demand).
- **Inheritance:** add to `os-foundation.manifest.json` — tools `goal-stop.mjs`, `boundary-classify.mjs`, `goal-init.mjs`;
  skill `founder-action-package`; the Stop-hook wiring in `templates/settings.json`; template `FOUNDER-ACTION-PACKAGE.md.template`.
  `scripts/new-project.sh` drops the goal-stop Stop entry so every new repo is born terminate-at-boundary.
- **SDLC integration (zero redesign):** the SDLC's HUMAN-GATED tier (C6 greenlight · merge-to-main · prod-auth ·
  NEEDS-APPROVAL fixes · rollback) **IS** the §3 taxonomy. A goal running `delivery-lifecycle` autonomously executes
  impl→verify→commit→push→PR-to-dev→CI→deploy-DEV→founder-review-package → hits the **C6 boundary** → FAP (embedding
  the review-package) → terminates. The founder approves; the **next** `/goal resume FAP-<id>` runs merge→prod→smoke→
  release-notes→cleanup→learning until `objective_complete` or the next boundary. The FAP sits exactly where C6 already is.
- **Closes the founder-burden loop:** every FAP carries a `founder_burden_category`, so each boundary is one counted
  founder action fed to `founder-burden-gate.mjs`. Success = the count of FAPs the next architecture eliminates.
- **Honest limit (§12 discipline):** `goal-stop.mjs` enforces that a well-formed, recognized-evidence FAP *exists*
  before exit; it cannot prove the boundary *judgment* was truthful inside one runtime. Backstops: the permission
  classifier (layer 4), the fail-closed merge/deploy gates, and the founder reading the FAP. The mechanism makes the
  *infinite-idle* failure impossible and makes faking a boundary *deliberate and logged* — it does not make the
  boundary call automatically honest.

## 8. Hardening — mandatory fixes from the independent §11 review (NOT-READY → ready-with-conditions)
The first design reproduced the very bug it fixes and pressured §12. These fixes are part of the contract, not optional:

- **H1 (was the biggest risk) — a hard cap whose trip is a FORCED terminal.** "Unlimited time, gate only the exit"
  deleted the mandated caps (`AUTONOMOUS-EXECUTION-DEFINITION.md`) and recreated the infinite loop in the
  *ambiguous-failure* direction: a hard wall misread as retriable retries forever — no FAP, no human backstop, silent
  burn. **Fix:** a per-goal **turn / wall-clock / cost ceiling**; tripping it **forces `disposition: failure` with
  `boundary_evidence_kind: cap_tripped`** and emits a FAP. `goal-stop.mjs` MUST read the harness `stop_hook_active`
  flag so it can never drive an unbounded re-entrant continuation. The cap is the *only* thing that converts
  retry-forever into a surfaced blocked-failure. "Unlimited autonomous work" now means **unbounded in shape, bounded
  by a kill-switch cap** — the canon's envelope, not no envelope.
- **H2 — break the verification deadlock (was a fake-VERIFY pressure on §12).** A boundary *upstream* of verification
  ("provision DEV", "need the API key to integration-test" — the common first slice of every new repo per SDLC §8)
  leaves impl that genuinely cannot be verified. As first designed, **both** Stop hooks block (verify-gate: no
  `verified` artifact; goal-stop: `verify_clean` false) and the only escape is marking a VERIFY `verified` that never
  ran. **Fix:** (a) a VERIFY may carry `verify_status: blocked-at-boundary` naming the SAME boundary as the FAP
  (honest, NOT a false pass); `verify_clean` is satisfied by `verified` OR `blocked-at-boundary`. (b) **verify-gate
  STOP-mode becomes FAP-aware** — it does not block a turn carrying a valid boundary-FAP whose blocked VERIFY names
  the same boundary. **This supersedes the earlier "zero change to verify-gate" claim — the two Stop hooks SHARE the
  boundary-blocked-verify notion.** (c) `pre-commit`/`pre-push` modes keep blocking unconditionally, so the unverified
  impl **stays on the branch and cannot ship** — terminating the *turn* is correct; shipping unverified impl is not.
- **H3 — permanent vs transient axis in the evidence taxonomy.** `tool_denial` must be **permanent / authorization-class
  only**, re-checked against the permission classifier's denial ledger — NOT the FAP's own prose. A rate-limit / 5xx /
  timeout is `transient` → retry within caps, never a boundary. Add `terminal ∈ {boundary, transient, failure}` to
  `boundary-classify.mjs`'s output; only `boundary`/`failure` emit a FAP.
- **H4 — `no_tool` is never sufficient alone.** It is an unbounded negative the hook cannot verify (judgment posing as
  mechanism — violates §13). A `no_tool` FAP must **co-occur with a hard re-checkable kind** (`credential_absent` /
  `gate_state` / ledger-backed `tool_denial`), or it **hard-blocks pending founder confirmation** (does not clear the
  goal alone).
- **H5 — boundary = EVERY live frontier blocked/complete, not ANY.** With parallel agents the frontier is a SET. The
  exit predicate is "**all** live frontiers are at a boundary or complete" — a goal may not FAP-out on one blocked
  branch while another branch still has autonomous work (that abandons real work behind a real-looking boundary).
- **H6 — anti-abuse for `objective_complete`.** It is the stronger, more dangerous claim (no FAP, no human). When impl
  was touched, `complete` requires the slices' `verify_status: verified` (the §12 derived-status rule); a no-impl
  (research) goal must cite its produced artifact. `complete` is never a bare self-assertion.
- **H7 (resume de-dup) — resume-loop detection.** On `/goal resume`, if the new FAP's `boundary_class` + `boundary_evidence`
  equal the prior FAP's (the founder's fix did not take), do NOT silently re-FAP — escalate differently ("you resumed
  but `<KEY>` is still absent — did the fix land?").
- **H8 — `/goal` is a MAIN-LOOP execution segment (G9).** "Unlimited parallel agents" is G9-clean only because Claude's
  main loop is the spawner (the harness ceiling), never an out-of-loop background runner. The contract states this
  explicitly; a `/goal` is not the ASPIRATIONAL engine-autonomous runner (that needs G2+S4).

**Revised honest limit:** the boundary direction *under-claims* (quit early → a rejectable FAP the founder sees) — the
same safe posture as §12. The retry-forever direction is made safe by **H1's cap** (forced FAP on cap-trip), not by
judgment. `goal-stop.mjs` proves a FAP *exists + is well-formed with re-checkable evidence*; it does not prove the
boundary call is *honest* — H1/H2/H3/H4 reduce the unprovable surface to the founder reading the FAP at low volume.

## 9. Build order (de-risk riskiest-unknown-first)
1. `goal-stop.mjs` + `.goal-state.json` + the condition convention + **H1 cap + stop_hook_active** (kills BOTH
   infinite-loop directions; prove clear-on-FAP AND cap-trip first).
2. **H2 verify-gate STOP-mode FAP-awareness** + the `blocked-at-boundary` VERIFY status (unblocks the first-slice deadlock).
3. The FAP template + `founder-action-package` skill (the emit side; H6 complete-evidence, H7 resume de-dup).
4. `boundary-classify.mjs` with the **H3 permanent/transient axis** + **H4 no_tool-never-alone** + **H5 all-frontiers**.
5. Manifest + scaffolder wiring (make it inherited; **H8** state main-loop-only).
6. SDLC binding (the C6 gate emits a FAP; reuse `founder-review-package`).
