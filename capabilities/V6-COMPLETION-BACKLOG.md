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
- **Status:** Not Started
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
- **Status:** In Progress (learning:check gate in CI, fail-closed, currently RED; no retro produced; census/file-lesson INERT)
- **Owner:** documentation (retrospective) + the OS (census-detector/file-lesson wiring) → qa-test
- **Build:** (a) tie the gate to MILESTONE close (not only commit-count) and require the retrospective as a verified output; (b) wire `census-detector` into a hook/CI so ≥3× patterns auto-append capability candidates to the ledger; (c) wire `file-lesson` so a lesson converts to an upstream candidate.
- **Dependencies:** census-detector + file-lesson exist (verified, INERT) — need wiring; the overdue retro must be RUN once to green the gate.
- **Validation:** (a) close a milestone with no retro → BLOCKED; (b) plant a 3× pattern → a candidate row appears automatically; (c) the loop is demonstrated end-to-end (lesson → candidate → ledger).
- **Completion:** milestone completion cannot silently bypass retrospective learning; the lesson→capability loop operates without memory.

## G5 — Product-Quality Measurement (technical success ≠ product success)
- **Status:** Not Started (designed only)
- **Owner:** product-designer + ux-reviewer (rubric) → software-engineer (scorer) → qa-test
- **Build:** a per-surface product-quality rubric scored with file:line evidence — UX craft · UI consistency · navigation · action discoverability · workflow clarity · cognitive load · empty/error/loading states · first-time UX — aggregated into a Product-Quality score in milestone:report, fail-closed below threshold. Judged by the product agents (auto-selected via agent-route).
- **Dependencies:** product agents ✅ (proven on real work); G1 trio to host the score.
- **Validation:** a surface with a KNOWN defect (e.g. the empty-flash class we fixed, or a color-only status) scores below threshold and FAILS; a clean surface passes; the score is evidence-backed not subjective.
- **Completion:** "passes technically but weak as product" is a measurable, regression-catchable, fail-closed signal.

## G6 — Agent-Selection Validation (prove routing is automatic, not Claude-forced)
- **Status:** In Progress (deterministic scoring proven; selection log partly hand-written; no regression suite)
- **Owner:** qa-reviewer (suite design) → software-engineer (build) → qa-test
- **Build:** (a) a task→expected-agent **regression suite** (~30 real backlog phrasings → expected specialist) run in CI with NO Claude in the loop, asserting `routeTask()` picks correctly; (b) make the spawn path write the selection log via `agent-route --log` (machine-produced, not hand-appended); (c) agent-health cross-checks logged selection == the meta.json agentType actually spawned.
- **Dependencies:** agent-route ✅, agents:check ✅.
- **Validation:** break a trigger → the suite FAILS; every logged selection is machine-produced and matches the executed spawn.
- **Completion:** "the correct agents are selected automatically without Claude forcing the choice" is PROVEN by an independent CI suite + provenance cross-check, not demonstrated by hand.

## G7 — Anti-IDLE Enforcement
- **Status:** Not Started (rule is prose)
- **Owner:** the OS (agent-health extension) → qa-test
- **Build:** agent-health (or agents:check) flags any agent IDLE beyond N commits/sessions since introduction, fail-closed — forcing use-or-retire. A retired agent must be removed from the roster.
- **Dependencies:** agent-health telemetry ✅.
- **Validation:** introduce an agent, leave it unused past the window → the gate FLAGS/FAILS; using or retiring it clears the flag.
- **Completion:** agent inventory cannot silently become documentation bloat.

## G8 — PLOS Propagation  (GATED — last)
- **Status:** Not Started (0% inherited; agent os-sync never run; parallel PLOS session active)
- **Owner:** integration-architect + lead-architect → qa-test
- **Precondition (hard gate):** G1–G7 Proven AND a re-run V6 Gap Report shows only minor residue.
- **Build:** run os-inherit (tools/skills/contracts) + os-sync (agents) into PLOS; repoint imports; wire PLOS CI with the same gates + the G1 slice gate; prove capability/agent/reporting/founder-experience/product-quality all operate IN PLOS; converge with the parallel PLOS session (single canonical path).
- **Validation:** PLOS CI runs the inherited gates green; agent-route operates in PLOS; milestone:report runs in PLOS; the Built→…→Measured chain is proven in a SECOND project.
- **Completion:** a second project operates the COMPLETE, enforced operating model — V6 landed.

---

## The single success test for "V6 landed"
A fresh project runs the inheritance, and from that moment **cannot** complete a slice without delivery evidence, **cannot** skip the health/experience/product-quality reports, **cannot** bypass the retrospective loop, **cannot** accumulate idle agents, and its agent selection is provably automatic — all enforced by process, none by memory. Until every G-item is `Proven` in Admin and re-confirmed by the Gap Report, we do not propagate.
