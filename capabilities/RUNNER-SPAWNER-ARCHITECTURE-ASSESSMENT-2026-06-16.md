# Architecture Assessment — "The runner is a planner, not a spawner" (2026-06-16)

> Founder-requested architecture assessment (investigation only, no implementation). Question: is the
> runner-not-spawner model **(A) expected architecture · (B) temporary implementation limitation · (C) a genuine
> V6 proof gap**? Grounded in canon (`G9-DISPATCH-RUNNER-ARCHITECTURE.md`, `AUTONOMOUS-EXECUTION-DEFINITION.md`,
> `V6-LANDED-DEFINITION.md`) + the R1/R2 runtime evidence + a code sweep of `.claude/` and `scripts/`.

## VERDICT (the headline)
The literal statement — *"the runner plans, Claude spawns"* — is **(A) EXPECTED ARCHITECTURE**, founder-ratified
and canon-documented. It is NOT a gap and must NOT be "fixed." Autonomous spawning is explicitly out-of-scope.

**BUT the R1/R2 evidence exposed a DIFFERENT issue that is easy to conflate with it, and that one is (C) a
genuine V6 proof gap:** not all specialist work goes through the runner's *plan + log*. Build steps are
dispatched; **verification, review, cleanup, and retry spawns bypass the runner entirely** (no dispatch-log row,
no coverage credit, unmeasured ownership/skill/knowledge). That makes Pillar-2 criterion #1 ("dispatch is the
standing path; coverage ≥90%; conformance") **unmeetable as currently practiced** — coverage is 0.192. This is
the next Tier-0 issue. The fix is NOT autonomy; it is **routing every substantive specialist work-type (not just
build) through the dispatch planner + enforcing coverage.**

---

## Q1 — What spawns specialists today?
**Claude (the main loop / orchestrator), exclusively, via the harness `Agent` tool.** Confirmed by sweep:
nothing in `.claude/hooks`, `.claude/os/tools`, or `scripts/` spawns a subagent. Every `spawn`/`subagent`
reference is telemetry-*reading* (`build-ownership-probe` reads `*/subagents/*.jsonl`; `slice-close`'s
`spawnSync` runs child npm *scripts*, not agents). `dispatch-route` emits a plan + a verbatim `spawnPrompt`; it
does not and cannot spawn. The harness only permits the main loop to spawn — this is total, not partial.

## Q2 — Responsibilities (who owns what)
- **`dispatch-route` (the per-dispatch "runner"):** the deterministic PLANNER + LEDGER. Selects agent (advisory),
  reconciles to the policy required-owner (policy wins), runs skill-route + knowledge-route (mints proofIds +
  injection markers), emits a `DispatchPlan` + verbatim `spawnPrompt`, writes `dispatch-log.jsonl`. Also
  `--conformance` (planned-vs-actual) and now `routerCorrect`. **Decides + records; never acts.**
- **"runner" (terminology — two distinct things):** (a) `dispatch-route`, the per-dispatch planner, BUILT; (b)
  the **A6 away-mode runner**, DESIGNED-not-built, which would drive a founder-ratified work-list of
  scripts+gates founder-absent. The founder's "runner" today = (a). Even (b) cannot spawn agents (harness
  ceiling) — it runs scripted+gated steps + validations + reporting only.
- **Claude main loop:** the ORCHESTRATOR + the irreducible SPAWNER. Decides what slices exist, invokes
  `dispatch-route`, spawns the planned owner, relays results, sequences work, runs gates, commits. (Today still
  does some build/docs directly — the YELLOW/RED lanes the operating-model-check tracks.)
- **Specialists:** OWN + EXECUTE the work inside a dispatch (build / verify / review), cite skills+knowledge,
  produce artifacts. author≠verifier enforced across them.

## Q3 — If Claude disappeared and only the runner remained
- **Still works:** the DECISION + MEASUREMENT layer as pure computation — `dispatch-route` can emit plans;
  routing/ownership/skill/knowledge selection; the gates + health checks + conformance/coverage/ownership math
  (they are scripts); the telemetry ledgers.
- **Stops working:** EVERYTHING that ACTS. No agent is spawned → no build/verify/review executes. Nothing
  *invokes* `dispatch-route` or the gates (Claude is the invoker). No sequencing, no relay, no commits. The
  plan is emitted but never executed. **The runner alone is a planner that produces unexecuted plans.**
- This is exactly the canon's honest noun test (`AUTONOMOUS-EXECUTION-DEFINITION.md`): *"An OS is defined by what
  it does when you are not looking. With D/F/H/J unbuilt, it does nothing — Claude initiates every action."* So
  "Claude disappears" today = the system decides and records but cannot do. Even the designed A6 autonomy would
  only run **scripted+gated** steps unattended, never specialist *agents*.

## Q4 — What does V6 actually require?
Per `V6-LANDED-DEFINITION.md` + `AUTONOMOUS-EXECUTION-DEFINITION.md`, V6 requires **only**:
- ✅ **autonomous planning** (A: auto-select + auto-route) — AUTOMATION, built.
- ✅ **measured ownership** (contribution-weighted, not declared) — R1.
- ✅ **policy enforcement** (fail-closed gates) — in progress (R1/R2 measure; enforcement wiring queued).
- ✅ auto-injection (B/C: skills + knowledge, firewalled from adoption).

V6 does **NOT** require:
- ❌ **autonomous spawning** (I — agents spawn agents): OUT **permanently** (harness-blocked + founder-ruled-out).
- ❌ **autonomous dispatch execution** (D/H) and ❌ **autonomous verification** (F/J): POST-V6, the separate
  "AI Operating System" claim earned by the Founder Absence Test. Explicitly **NOT V6 blockers.**

**Therefore the runner-not-spawner model is ALIGNED with what V6 requires.** V6 = automation (Claude pulls the
trigger); autonomy is the later, separate claim.

## Q5 — Every place work bypasses the runner (from the sweep + R1/R2 behavior)
None of these auto-spawn; each is Claude choosing not to route a spawn through `dispatch-route`:
1. **Verification (qa-test)** — spawned directly, NO dispatch-log entry (R1 verify, R1 re-attest, R2 verify).
2. **Cleanup / follow-up build** (R1 dead-code removal) — direct, no dispatch.
3. **Reviewer flows** (reviewer-critic / qa-reviewer post-QA, when used) — direct, no dispatch.
4. **Retries / re-attestation** — direct.
5. **Board / investigation spawns** (this assessment's agents; the "V6 Runtime Reality" board) — direct.
6. **Pre-runner historical slices** (21 of 26) — predate `dispatch-route`; structurally un-routed.
7. **Claude's own actions** — invoking gates, `slice-close`, commits, sequencing, handoff authoring — never
   dispatched (orchestrator role).

## Q6 — Classification of each bypass
| Bypass | Class | Rationale |
|---|---|---|
| Verification (qa-test) | **PROOF BLOCKER** | author≠verifier verification is core work-typed activity; un-dispatched ⇒ coverage <90% structurally + its ownership/skill/knowledge invisible. This is the main one. |
| Reviewer flows (reviewer-critic) | **PROOF BLOCKER** (same class) | same as verification — real specialist work that never enters the ledger. |
| Cleanup / retry spawns | **TECHNICAL DEBT** | real work that should be dispatched; low effort; individually not decisive but adds to the coverage gap. |
| Board / investigation spawns | **INTENTIONAL** | advisory/meta, not slice work — like the proving-vs-organic classifier, defensibly excluded. |
| Pre-runner historical slices | **INTENTIONAL** | predate the capability; honestly reported as gap, not retro-fixable. |
| Claude's gate-running / commits / sequencing | **INTENTIONAL (harness-bound)** | the orchestrator role; never a dispatch by definition. |

## Q7 — Gap report (Current vs Target V6)
| # | Gap | Current | Target V6 | Severity | Risk | Effort | Before R3? |
|---|---|---|---|---|---|---|---|
| G-α | Spawning is Claude-mediated (planner-not-spawner) | Claude spawns; runner plans | **SAME** (autonomy out-of-scope) | **NONE — not a gap** | none | none — do not build | **NO** |
| G-β | **Verify/review/cleanup spawns bypass the runner** | only BUILD dispatched; coverage 0.192; verify/review un-logged + unmeasured | ALL substantive specialist work-types (build+verify+review) dispatched+logged; coverage ≥90%; conformance real | **HIGH** | R3's window shows ~50% coverage (build only) → Pillar-2 #1 unmeetable; ownership/skill/knowledge of verification invisible | LOW–MED (add verify/review work-types to dispatch-route + route those spawns + count them in dispatch-coverage) | **YES** |
| G-γ | `dispatch-route` is manually invoked; a paraphrased prompt severs the marker | Claude must remember to dispatch + keep the marker; no forcing function | coverage gate ENFORCING (post-hoc at close/push, since harness owns spawning) so an un-dispatched spawn is caught | **MEDIUM** | the "reproducible-by-discipline not by-construction" root; R3 measured without enforcement proves little | MED (flip dispatch-coverage + ownership-gate to blocking — already queued Tier-0) | **YES (partially)** — land enforcement so R3 runs under it |

## So: acceptable proof, or the next Tier-0 issue?
**Both, correctly split:**
- The **runner-not-spawner ceiling (G-α)** is acceptable V6 proof — it is the ratified architecture; autonomous
  spawning is a separate, later, out-of-scope claim. Do not treat it as a gap.
- The **incomplete dispatch coverage (G-β + G-γ)** — verification/review/cleanup never entering the runner — IS
  the next Tier-0 issue and **must be closed before R3**, or the proof window cannot satisfy "dispatch is the
  standing path." It is a tooling+discipline fix (route all work-types + enforce coverage), NOT a new capability
  and NOT autonomy.

**Recommended Tier-0 sequence (unchanged spirit, sharpened):** fold G-β into the already-queued enforcement
wiring — extend `dispatch-route` to plan `verify`/`review` work-types, route those spawns through it, count them
in `dispatch-coverage`, then flip coverage + ownership to enforcing. Only then start R3, so the window is
measured against complete, enforced dispatch — not build-only, report-only dispatch.

---

# ADDENDUM — Gap quantified (2026-06-16, from telemetry)

## The structural root cause
`ownership-policy.json` defines **6 work-types, ALL build-class, ALL file-glob-keyed**: `frontend`, `database`,
`seam`, `api`, `knowledge`, `backend`. **There is no `verify` or `review` work-type** — because verification
writes `docs/verify/**.md` (matches NO policy glob → no work-type → `ownership-gate` skips it) and review
(`reviewer-critic`) produces **no files at all** (verdicts only). So verify/review are *structurally
un-dispatchable and un-ownable* under today's taxonomy. This is the mechanical reason for the bypass — not a
discipline lapse.

## Q1 — All specialist work executed (lifetime spawn census, 716 transcripts, all sessions)
| Activity class | Agents (count) | Total |
|---|---|---|
| **Build** | software-engineer 143 · integration-architect 14 · security-compliance 5 · documentation 4 · database-data 3 · knowledge-engineer 3 · frontend-engineer 2 · api-integration 1 | **175** |
| **Verify** | qa-test 199 · qa-tester 5 | **204** |
| **Review** | reviewer-critic 12 · qa-reviewer 5 · ux/workflow/journey/founder-exp/product/frontend-arch reviewers 6 | **~23** |
| **Plan / Investigate** (intentionally not slice-dispatched) | general-purpose 257 · Explore 39 · lead-architect 15 · Plan 3 | **314** |

## Q2 — Work-types that PASS THROUGH dispatch-route (the 15 logged dispatches)
`backend` ×8 · `knowledge` ×4 · `seam` ×2 · `api` ×1 → agents: software-engineer, knowledge-engineer,
integration-architect, api-integration. **100% build-class. Zero verify. Zero review.**

## Q3 — Work-types that BYPASS dispatch-route
**Verify (qa-test, 204 lifetime spawns — the 2nd-most-active agent in the entire system), Review (~23),
cleanup/retry/re-attest** (follow-up build spawns not separately dispatched), and Plan/Investigate (314 —
intentional). The dispatchable-but-not-dispatched bypass = **verify + review + cleanup**.

## Q4 — Current dispatch coverage
- **Slice-level** (`dispatch-coverage`): **6 / 27 = 22.2%** build-bearing slices routed (21-gap is mostly
  pre-runner historical slices; all 6 covered are model-era — the recent trend is good, the history is not
  retro-fixable).
- **Spawn-level, model-era (R1+R2 — ground truth):** **2 / 6 = 33%** of substantive specialist spawns were
  dispatched. R1 = 1/4 (build dispatched; cleanup + 2× verify NOT). R2 = 1/2 (build dispatched; verify NOT).
- **Work-type coverage:** 6 build work-types exist, **0 verify/review** → ~half of every slice's work is
  un-routable by construction.

## Q5 — Coverage IF verify/review/cleanup were routed
- Model-era spawn coverage **33% → 100%** (R1 4/4, R2 2/2).
- Per-slice dispatch accounting becomes COMPLETE (build + verify both logged) instead of build-only.
- The ≥90% Pillar-2 coverage bar becomes *reachable* (today it is mathematically unreachable while every
  slice's mandatory verify step is un-dispatchable).

## Q6 — Impact of the bypass on each dimension
| Dimension | Impact today (build-only dispatch) |
|---|---|
| **Ownership measurement** | Verification has **NO measured owner** — `docs/verify/**` matches no work-type, so `ownership-gate` skips it. ~50% of slice effort is ownership-invisible. |
| **Specialist attribution** | `qa-test` is the **2nd-busiest agent (204 spawns)** yet contributes ~0 to the ownership ledger — its real work (verification) is attributed to no dispatch. The ledger systematically under-credits the verifier. |
| **Knowledge attribution** | KUs cited *during* verify/review (e.g. a verifier citing `ku-fail-closed-gates`) are not tied to a dispatch → knowledge influence in the verify/review half is uncounted. |
| **Dispatch coverage** | **Structurally capped** — cannot reach ≥90% while the mandatory per-slice verify step is un-routable. This is the R3 blocker. |
| **Policy enforcement** | No policy rule covers verify/review → nothing to enforce there. author≠verifier is enforced separately (by `verify-gate`), NOT by the dispatch/ownership spine. Enforcement is build-only. |

## The minimum change (smallest fix for complete dispatch accounting — NO redesign, NO autonomy)
1. **Add 2 work-types to `ownership-policy.json`:** `verify` (glob `docs/verify/**`, keywords verify/independent-
   verification → requiredOwner `qa-test`) and `review` (keyword-driven, no file glob → requiredOwner
   `reviewer-critic`). `dispatch-route` already accepts `--work-type`, so this is a data change + the existing
   planner path.
2. **Discipline (same pattern as build):** run `dispatch-route --work-type verify` before spawning a verifier /
   reviewer, so the dispatch is minted + logged. No new capability — identical to how build is already routed.
3. **`dispatch-coverage`:** add a per-slice check that a closed slice has BOTH a build dispatch AND a verify
   dispatch (complete accounting), not just build.
4. **`ownership-gate`:** `verify` work-type attributes `docs/verify/**` to `qa-test` (measured, char-weight).
   **HONEST LIMIT:** `reviewer-critic` produces no files, so contribution-weight does NOT apply to review — the
   best achievable accounting for review is **dispatched + logged + cited**, NOT a contribution %. State this in
   the metric; do not fake a contribution number for file-less review.

**Effort:** LOW (policy data + coverage counting + dispatch discipline). **No new capability, no change to the
planner-not-spawner model, no autonomous spawning.**

## Materiality for R3 — VERDICT: YES, close G-β before R3
author≠verifier is mandatory on **every** slice, so **every** slice has a verify step. With verify un-
dispatchable, per-slice dispatch accounting is ~50% by construction and the ≥90% coverage criterion is
mathematically unreachable — R3 would fail the "dispatch is the standing path" bar on a structural artifact, not
on real behavior. Therefore the minimum fix above is a **pre-R3 Tier-0 item.**
