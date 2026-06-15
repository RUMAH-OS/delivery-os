# V6 Completion Backlog — the operating model must be COMPLETE + ENFORCED before PLOS

> Founder mandate (2026-06-15): V6 is NOT landed when capabilities exist. It is landed when the
> **operating model itself is complete, enforced, and self-sustaining** — enforced by PROCESS, not
> operator memory. We do NOT propagate to PLOS until these gaps are closed in Admin and a re-run
> of the V6 Gap Report confirms only minor residue. Propagating a half-finished OS teaches future
> projects the wrong habits — harder to fix later than finishing now.
>
> **The bar for every item below: a FAIL-CLOSED gate/hook exists, is independently verified, and
> demonstrably BLOCKS the bad path.** "Documented" / "recommended" / "remember to" = NOT done.
> Author≠verifier holds on every item (the builder never closes its own item).

## Status legend
`Not Started` · `In Progress` · `Proven` (= enforced by process + independently verified + block-demonstrated)

## Recommended execution order (dependency-driven)
1. **G1 — Slice Delivery Gate** (slice governance + delivery evidence + reporting cadence in ONE mechanism) — foundational; everything else reports *through* it.
2. **G6 — Agent-selection validation** (regression suite + machine-written selection log) — small, removes the proven-vs-demonstrated gap.
3. **G7 — Anti-IDLE enforcement gate** — small.
4. **G5 — Product-quality measurement** — plugs into G1's trio.
5. **G4 — Learning-review enforcement** (+ census/file-lesson loop) — closes the learning promise.
6. **Re-run V6 Gap Report → confirm minor → THEN G8 PLOS propagation.**

---

## G1 — Slice Delivery Gate  (covers: Slice governance · Delivery evidence · Reporting cadence)
- **Status:** **Proven** (2026-06-15) — built, independently verified 12/12, **dogfooded** (closed itself through its own gate). Anti-tamper proven: gate re-runs capability-health + digest-compares (forged digest → BLOCK; live-FAIL-not-trusted → BLOCK); UI-facing N/A fraud → BLOCK (re-derived from diff); fail-closed on eval error/empty-stdin; single logged bypass. `docs/verify/VERIFY-slice-delivery-gate-local.md`. **Follow-up (open):** tooling paths (`scripts/`, `.claude/`) are NONIMPL per the shared isImpl model, so a pure-tooling slice isn't force-gated — decide whether OS-tooling changes should require a slice-record (add to `impl_extra`). Product `src/**` changes ARE gated.
- **(historical) Status:** Not Started
- **Owner:** lead-architect (design) → software-engineer (build) → qa-test (verify)
- **Problem:** slices complete with no unified evidence; PR/merge flow absent (direct commits to `dev`); capability-health/agent-health/experience run only when the operator remembers.
- **Build:** a `slice:close` command + a pre-push hook that REFUSES a push touching impl unless a `docs/slices/SLICE-<name>.md` exists for the slice, schema-valid, containing: slice name · commit hash · PR ref · merge ref · **capability-health result** · **agent-health result** · **founder-experience result (when UI-facing)** · verify-doc ref. The health results must be written BY the command (machine-produced), not hand-typed — this is also how Reporting Cadence stops being memory-dependent (the trio runs at slice close, telemetry available locally).
- **Dependencies:** capability-health ✅, agent-health ✅, experience-gate ✅ (all exist); needs capability-health vendored/runnable at close.
- **Validation criteria:** (a) attempt to push an impl change with no slice-record → BLOCKED; (b) a slice-record missing any required field or with a stale/failed health result → BLOCKED; (c) the health results in the record match an independent re-run (not hand-typed). Independent QA reproduces all three.
- **Completion criteria:** a slice cannot land without a complete, machine-produced delivery-evidence record; proven by the block demonstrations; wired into Admin pre-push (and the cadence triggers in G-cadence below).

## G2 — Reporting Cadence (standing procedure)  [merged into G1's mechanism + these trigger points]
- **Status:** In Progress (milestone:report exists, operator-run)
- **Owner:** software-engineer → qa-test
- **Trigger points to enforce:** after every slice (G1 close hook) · after every milestone · before propagation · before declaring a capability complete · before declaring a project V6-ready.
- **Crux:** agent-health needs the runtime telemetry dir (not in CI) → cadence runs at the **pre-push/slice-close** layer (telemetry local), with capability-health + experience-gate ALSO in CI (push-level). 
- **Validation:** closing a slice auto-emits the trio into the record with zero operator action; a milestone close runs milestone:report; skipping is structurally impossible.
- **Completion:** no report in the operating loop depends on operator memory.

## G3 — Capability Health / Agent Health / Founder Experience (keep enforced)
- **Status:** Proven (as tools) — gap is *cadence* (G2)
- **Owner:** the OS (built); software-engineer wires cadence
- **Validation/Completion:** these already self-test + catch regressions; "operational + enforced" = they RUN at the G2 trigger points and block. Folds into G1/G2.

## G4 — Learning-Review Enforcement (the system actually learns)
- **Status:** **Proven (2026-06-15)** — `learning:check` now structural (validateRetroStructure: requires what-worked / what-failed / which-capability-failed-to-catch / Lessons→Candidates with ≥1 `- X → Y`) — a hollow retro can't clear it. `slice:close --milestone` fail-closes without a valid retro (Trigger B; block-demo'd, exit 8). **The lesson→capability loop OPERATES** (was INERT): at the G4 milestone close it filed **14 retro lessons → signals** (file-lesson, idempotent) + ran census-detector (idempotent `--append`) end-to-end. The overdue `docs/RETROSPECTIVE-2026-06-15.md` (6 sections, C1–C7) greens the gate by evidence. Independent QA 5/5 + no-loophole finding (`docs/verify/VERIFY-learning-enforcement-local.md`). **Honest boundary:** Layer-A enforcement wiring = Auto-Exec **A5 PRESENT + OPERATING**; NOT A3 autonomous (gated G9).
- **(historical) Status:** In Progress (learning:check gate in CI, fail-closed, currently RED; no retro produced; census/file-lesson INERT)
- **Owner:** documentation (retrospective) + the OS (census-detector/file-lesson wiring) → qa-test
- **Build:** (a) tie the gate to MILESTONE close (not only commit-count) and require the retrospective as a verified output; (b) wire `census-detector` into a hook/CI so ≥3× patterns auto-append capability candidates to the ledger; (c) wire `file-lesson` so a lesson converts to an upstream candidate.
- **Dependencies:** census-detector + file-lesson exist (verified, INERT) — need wiring; the overdue retro must be RUN once to green the gate.
- **Validation:** (a) close a milestone with no retro → BLOCKED; (b) plant a 3× pattern → a candidate row appears automatically; (c) the loop is demonstrated end-to-end (lesson → candidate → ledger).
- **Completion:** milestone completion cannot silently bypass retrospective learning; the lesson→capability loop operates without memory.

## G5 — Product-Quality Measurement (technical success ≠ product success)
- **Status:** **Proven (2026-06-15)** — `quality:check` (`scripts/product-quality-check.mjs`): deterministic static per-surface rubric — loading-state · empty≠loading · error [MUST]; primary-action · status-not-color-only · shared-ui [SHOULD] — fail-closed below MUST, with file-evidence. Runs in CI (static, no DB) AND the slice-gate (re-runs live = anti-tamper) for UI-facing slices; slice:close records `product_quality`. **Before/after proof:** PASSes the fixed invoices page, FAILs a reconstructed pre-fix fixture (empty-flash + color-only) — catches the exact 2 regressions we lived. **Enforcement in action:** on first run it caught 3 surfaces (Tenants/Inventory/Owners/Dashboard, Contracts, Signings) with NO loading state → frontend-engineer ported the loading pattern → now 4/4 PASS. Independent QA 7/7 (`docs/verify/VERIFY-product-quality-gate-local.md`). **2 slice-close robustness bugs the dogfood surfaced + fixed:** UI-facing detection read the working tree not the --commits diff; npm checks spawned with shell:false (Windows) gave false FAILs. **Honest boundary:** static = structural quality (states/a11y/discoverability/consistency); taste/delight stays the founder-experience/ux-reviewer agents (depth on demand). G5 = the enforced measurable floor.
- **(historical) Status:** Not Started (designed only)
- **Owner:** product-designer + ux-reviewer (rubric) → software-engineer (scorer) → qa-test
- **Build:** a per-surface product-quality rubric scored with file:line evidence — UX craft · UI consistency · navigation · action discoverability · workflow clarity · cognitive load · empty/error/loading states · first-time UX — aggregated into a Product-Quality score in milestone:report, fail-closed below threshold. Judged by the product agents (auto-selected via agent-route).
- **Dependencies:** product agents ✅ (proven on real work); G1 trio to host the score.
- **Validation:** a surface with a KNOWN defect (e.g. the empty-flash class we fixed, or a color-only status) scores below threshold and FAILS; a clean surface passes; the score is evidence-backed not subjective.
- **Completion:** "passes technically but weak as product" is a measurable, regression-catchable, fail-closed signal.

## G6 — Agent-Selection Validation (prove routing is automatic, not Claude-forced)
- **Status:** **Proven (correctness) (2026-06-15)** — hardening landed (G3 commit `7ae1d44`, slice-record + independent QA 7/7 `docs/verify/VERIFY-agent-selection-correctness-local.md`): 11 collision-pair cases prove the ownership boundaries disambiguate (rival margins 3–17.5); negative routing (gibberish→no route) + ownership-ambiguity surfaced; new-agent guard (adding an agent without a fixture FAILs); provenance/explainability (every winner's tokens trace to its OWN frontmatter). Collision-bite + guard-bite + provenance-bite all mutation-proven. Evidence artifact `rumah-admin/docs/agent-routing-evidence.md`. **1 honest residual FINDING (surfaced, not hidden):** "review the invoicing experience" clears the margin only because security-compliance inflates it — a real experience-class ambiguity; follow-up = tighten security-compliance's `invoicing` token or add an experience-reviewer qualifier. Per delivery-mindset (sufficient correctness proven) this does not block.
- **(superseded) Status:** Partially Proven — HONESTY CORRECTION (2026-06-15): the suite proves **reachability + uncertainty-detection**, NOT yet **selection correctness**. qa-reviewer meta-QA (its own first real use) found: every fixture phrasing borrows the winner's trigger verbatim (≈ proves "a trigger substring scores"), so the **collision pairs the whole roster rests on are UNTESTED** (ux-reviewer vs founder-experience-reviewer · qa-test vs qa-reviewer · frontend-architect vs frontend-engineer · workflow-reviewer vs customer-journey-reviewer · lead-architect vs product-designer · reviewer-critic vs qa-reviewer); no misroute/negative case; no new-agent-must-have-a-fixture guard; and `route:provenance` is a distribution report, not a per-task cross-check (needs a join key). **Correctness-hardening REQUIRED before G6 = Proven:** add contested-middle phrasings with a `notSecond`/min-margin-over-rival assertion, a negative (no-route) case, the coverage guard, and either a provenance join-key or downgrade that claim.
- **(what IS proven):** `route:suite` (27 cases, NO Claude in loop, in CI after agents:check); regression-catch (neutralize a trigger → exit 1); confidence margin load-bearing (FLOOR/MIN_MARGIN); ambiguity set proves uncertainty-detection; `agent-route --log` records margin+confident; seed misroute (governance-design→lead-architect) fixed + locked (margin 25). Independent QA 6/6 on THOSE properties (`docs/verify/VERIFY-agent-selection-validation-local.md`).
- **(historical) Status:** In Progress (deterministic scoring proven; selection log partly hand-written; no regression suite)
- **Owner:** qa-reviewer (suite design) → software-engineer (build) → qa-test
- **Build:** (a) a task→expected-agent **regression suite** (~30 real backlog phrasings → expected specialist) run in CI with NO Claude in the loop, asserting `routeTask()` picks correctly; (b) make the spawn path write the selection log via `agent-route --log` (machine-produced, not hand-appended); (c) agent-health cross-checks logged selection == the meta.json agentType actually spawned.
- **Dependencies:** agent-route ✅, agents:check ✅.
- **Validation:** break a trigger → the suite FAILS; every logged selection is machine-produced and matches the executed spawn.
- **Completion:** "the correct agents are selected automatically without Claude forcing the choice" is PROVEN by an independent CI suite + provenance cross-check, not demonstrated by hand.

## G7 — Anti-IDLE Enforcement
- **Status:** **Proven** (2026-06-15) — `agents:idle-check` (sibling gate; keeps agent-health "reports-never-fails"): past-grace idle (commits-since-first-add > N=10 AND 0 telemetry invocations) → fail-closed, use-or-retire (both exits named). UNMEASURED → fail-closed (never silent-passes; single logged `--allow-unmeasured`). Wired into slice-close. Independent QA 6/6 (`docs/verify/VERIFY-anti-idle-enforcement-local.md`): grace-0 flags exactly the right agents; UNMEASURED-never-silent; retire-path clean. **Telemetry-union bug found+fixed** (window now unions all session dirs — was false-flagging used agents). **Idle gap now ZERO**: the last 2 idle agents (integration-architect, qa-reviewer) were used on real work → agent-health 19 used / 0 idle. Pushed WITHOUT bypass (gate accepted because evidence exists).
- **(historical) Status:** Not Started (rule is prose)
- **Owner:** the OS (agent-health extension) → qa-test
- **Build:** agent-health (or agents:check) flags any agent IDLE beyond N commits/sessions since introduction, fail-closed — forcing use-or-retire. A retired agent must be removed from the roster.
- **Dependencies:** agent-health telemetry ✅.
- **Validation:** introduce an agent, leave it unused past the window → the gate FLAGS/FAILS; using or retiring it clears the flag.
- **Completion:** agent inventory cannot silently become documentation bloat.

## G8 — PLOS Propagation  (GATED — last)
- **Status:** Not Started (0% inherited; agent os-sync never run; parallel PLOS session active)
- **Owner:** integration-architect + lead-architect → qa-test
- **Precondition (hard gate):** G1–G7 Proven AND a re-run V6 Gap Report shows only minor residue.
- **NEW hard precondition — seam single-sourcing (integration-architect, 2026-06-15):** PLOS does NOT import the executable seam contract at all — it validates the drain with a private divergent Zod (payload opaque, no per-type/content-encoding/PII checks). This is **false-accept AND false-reject**. Admin's side IS single-sourced+hash-checked (vendored sha256 `412ca938…`, `os-inherit check`), but PLOS is 0% inherited. **Before ANY other G8 step:** (1) `os-inherit sync` the contract into PLOS (both INHERITED.json show the identical hash → cross-repo hash-equality is then transitive via `os-inherit check` in both CIs — reuse, no new tool); (2) **repoint PLOS's drain to call `validateSeamBatch` from the vendored contract** (the load-bearing fix — vendoring bytes nobody imports closes nothing); (3) PLOS CI seam:check fail-closed; (4) CODEOWNERS-bind the PLOS copy. Propagating with the seam dual-sourced bakes in the divergence behind green CI — worse than not propagating. Negative test: a known-bad event (HTML in notice.body / PII in recipient) must FAIL bad_contract in PLOS where today it silently accepts.
- **Build:** run os-inherit (tools/skills/contracts) + os-sync (agents) into PLOS; repoint imports; wire PLOS CI with the same gates + the G1 slice gate; prove capability/agent/reporting/founder-experience/product-quality all operate IN PLOS; converge with the parallel PLOS session (single canonical path).
- **Validation:** PLOS CI runs the inherited gates green; agent-route operates in PLOS; milestone:report runs in PLOS; the Built→…→Measured chain is proven in a SECOND project.
- **Completion:** a second project operates the COMPLETE, enforced operating model — V6 landed.

---

## The single success test for "V6 landed"
A fresh project runs the inheritance, and from that moment **cannot** complete a slice without delivery evidence, **cannot** skip the health/experience/product-quality reports, **cannot** bypass the retrospective loop, **cannot** accumulate idle agents, and its agent selection is provably automatic — all enforced by process, none by memory. Until every G-item is `Proven` in Admin and re-confirmed by the Gap Report, we do not propagate.

---

## Completion Report Contract (STANDING — every completion/milestone report MUST include this)
> Restored 2026-06-15 after it was dropped (operator-memory lapse — the exact failure v6 exists to
> kill). A report section that depends on memory is no better than an ungated capability. So the
> **V6 Usage Evidence** section is GENERATED, not remembered: its inputs come from `milestone:report`
> (= `capability-health` + `agent-health` union) + the slice selection log + the cycle's shipped
> founder-facing changes. No completion report is complete without it.

**Required section — "V6 Usage Evidence" — 6 points, from evidence:**
1. **Agents that participated** — agent-health roster USED this window (count + share).
2. **Agents that exercised ownership** — the selection log: which agent was routed to its owned domain, with the `why` rationale (provenance — every decision traceable, per G6).
3. **Used vs idle** — agent-health USED/IDLE (anti-IDLE: idle past grace is fail-closed).
4. **Capability propagation** — capability-health (ALIVE/INERT) + os-inherit status (what is vendored byte-current; what has/has-not propagated to other projects).
5. **Founder-experience impact** — the real founder-facing changes shipped this cycle + experience-gate/product-quality results.
6. **Operating vs merely present** — the hard evidence the structure RAN (gate blocked/accepted real pushes; agents drove real findings/fixes; self-correction events), with an explicit verdict.

**Generator:** `npm run milestone:report` (operator runs it at slice/milestone close; it produces 1+3+4+5). Points 2 + 6 are composed from the selection log + the cycle's commits. Honesty rules: report stand-in vs native agent usage distinctly; report the material-effect proxy's limits (a build/map scores CONFIRMING, not low value).

## Autonomy Evidence (STANDING — mandatory in every slice-completion report, alongside V6 Usage Evidence)
> Added 2026-06-15. The goal is not that v6 EXISTS — it's that v6 OPERATES; not that agents are PRESENT —
> that they PERFORM work; not that auto-exec was DESIGNED — that it actually COMPLETED real work.
> Report honestly: distinguish AUTONOMOUS (runtime-triggered, no human per-run) from ORCHESTRATOR-DRIVEN.

**Per completed slice report:**
1. Actions recommended · 2. Actions founder-approved · 3. Actions automatically executed · 4. Actions completed successfully · 5. Actions failed · 6. Outcomes captured · 7. Lessons generated.

**Execution chain — mark each stage Proven / Partial / Not Proven:**
`Event → Agent Selection → Reasoning → Action Selection → Execution → Outcome Capture → Learning`

**### Auto-Exec Confidence**
- Status: Not Proven / Partially Proven / Operationally Proven.
- Evidence: # autonomous executions · # successful · # failed · human approval required (yes/no) · runtime traces supporting the claim.

**Honesty rule:** in THIS harness the main loop (orchestrator) spawns agents — so the agent-orchestration layer is NOT autonomous; only the CI/pre-push gates execute without a human per-run. Do not claim "Operationally Proven" autonomy for agent work while a human/orchestrator is in the dispatch chain. The learning stage is Not Proven until G4 lands.

## Capability Adoption Evidence (STANDING — mandatory in every completion report; TOP-PRIORITY principle 2026-06-15)
> Founder principle: "exists" is NOT success — "USED" is success. A capability is complete only when
> Built → Triggerable → Automatically exercised → Measured → Proven useful → Able to influence behavior.
> Optimize the OS for capability ADOPTION + operational usage, not accumulation. The question is no
> longer "Did we build it?" — it is "Is the OS actively using it?"

**For EVERY capability / subsystem / agent / workflow / learning + autonomy + enforcement mechanism, report:**
- **Status:** Built · Proven · **Active** (triggered + exercised) · **Dormant** (built + functional but NOT triggered/exercised) · Retired.
- **Usage:** trigger (how + who/what triggers it) · frequency · last execution · # executions · # success · # failure · outcome generated.
- **Impact:** what changed because of it? · would the system behave differently if it were removed?

**DORMANT is a first-class, explicitly-reported status.** A built-but-untriggered capability MUST be
listed as DORMANT (not hidden under "built"). Core: a capability never triggered delivers no value; never
exercised cannot be trusted; one that doesn't change behavior is not yet part of the OS.

**Generator/inputs (not memory):** capability-health (ALIVE=Active wired-to-run / INERT=Dormant) +
agent-health (USED=Active / IDLE=Dormant) + the slice-records + the selection log + CI/hook wiring. The
Status column is evidence-derived (ALIVE/USED → Active; INERT/IDLE → Dormant), never hand-set.
Applies to: G4 learning · Auto-Exec · Founder-Away-Mode · capability propagation · PLOS integrations ·
all future agents + roadmap work.

## G10 — Knowledge & Skill System (knowledge must become EXECUTABLE; founder principle 2026-06-15)
> A lesson never used hasn't changed behavior; a wiki never referenced isn't intelligence; a skill never
> triggered can't be trusted. Optimize for knowledge ADOPTION, not accumulation. Question: "Did the
> system USE what it learned?"
- **Status:** Not Started (design next). Builds on G4 (lesson capture) + reuses skill-route (#8 = injection retriever) + skill-frontmatter (#6 = skill contract) + the agent-health telemetry pattern.
- **Target flow:** Incident → Lesson → Wiki Entry → Skill Extraction → Trigger Registration → Agent Usage → Outcome → Score → Retain/Improve/Retire.
- **Required:** (1) every verified lesson → Wiki knowledge (Context·Symptoms·Root Cause·Detection·Resolution·Verification·Related Capabilities·Related Skills) + ≥1 candidate Skill (Purpose·Triggers·Applicability·Execution Guidance·Expected Outcome·Confidence). (2) **skill-health** telemetry per skill: trigger/use/success/failure/false-positive/last-exec/last-outcome/confidence + **Trust Score** (trigger freq · successful usage · failure prevention · outcome quality · FP rate · recency). (3) **DORMANT SKILL** class (exists but not exercised in the expected window) — reported. (4) **Skill injection**: task context → skill-route retrieves highest-confidence relevant skills → injected into the agent. (5) **Skill Usage Evidence** mandatory report section (per skill: triggered/used/success/fail/prevented-incident/confidence/trust; + Top/Dormant/Most-Valuable/Least-Trusted).
- **Completion (a lesson is complete only when):** converted to wiki + ≥1 skill · triggered in real work · used by agents · measured · proven to influence behavior. (DORMANT skill ≠ complete.)
- **Honest harness boundary (state in every report):** skill-route can SELECT relevant skills deterministically (retrieval), but INJECTION into a spawned agent is orchestrator-assembled (like agent dispatch) — not autonomous. True auto-injection shares the A3 dispatch-runner dependency (G9).
