# Auto-Exec Confidence — explicit criteria (defined 2026-06-15, BEFORE building)

> Founder requirement: define NOW what evidence moves **agent-level autonomous execution** from
> Partial → **Operationally Proven**, so we validate against a fixed target instead of redefining it
> to fit the result. The goal is not that v6 EXISTS or that auto-exec was DESIGNED — it is that
> **a real event drives agents to complete real work end-to-end without a human in the per-instance
> loop, with runtime traces, under preserved safety.**

## Two distinct layers (do not conflate)
- **Layer A — autonomous ENFORCEMENT.** CI + pre-push gates run on every push, no human per-run, and change outcomes (block/accept). **Already Operationally Proven** (the gate blocked the evidence-less push + the bypass; accepted only evidenced pushes). This is NOT what these criteria are about.
- **Layer B — autonomous AGENT TASK EXECUTION.** A real event autonomously drives `Event → Agent Selection → Reasoning → Action Selection → Execution → Outcome Capture → Learning` to completion, the agent dispatched by an automated runner (NOT the main-loop orchestrator / a human). **This is the target below. Currently Partial** (today the orchestrator spawns every agent).

## Definition of "Operationally Proven" (Layer B)
Agent-level autonomous execution is Operationally Proven when ALL of the following hold, repeatedly, with independently-verified runtime traces.

### A. Required capabilities (must EXIST + be WIRED, each independently verified)
1. **Autonomous trigger** — a cron / CI / event-hook fires the chain with NO human action, and emits a trace (scheduler log / CI run id / hook event). A human clicking "run" does NOT qualify.
2. **Event→router binding** — the trigger feeds the task to the deterministic `agent-route`; the selection (chosen + confidence margin + `why`) is logged by the runner, not hand-written.
3. **Automated dispatch runner** — a headless runner that SPAWNS the selected agent (the piece that does not exist today; the orchestrator currently does this). Its spawns are attributable to the runner, not a human session.
4. **Outcome capture** — the agent's result is captured automatically (telemetry record + an outcome artifact) with no human step.
5. **Learning wiring (depends on G4)** — the outcome feeds `census-detector`/`file-lesson` so a recurring signal auto-becomes a capability candidate, no human step.
6. **Safety envelope (fail-closed, preserved under autonomy)** — author≠verifier still holds (an autonomous build is still independently verified before it lands); every produced change still passes the gates (verify/slice/quality/seam); **destructive + outward-facing actions remain human-gated**; the autonomy is **bounded** (explicitly activated, time-boxed, auto-expiring, fully logged, session-state never persisted to memory — the Founder-Away-Mode envelope).

### B. Required execution paths (each proven end-to-end, no human in the per-instance loop)
- **P1 — read/review loop:** autonomous trigger → router selects a reviewer agent → agent runs a real review against real artifacts → findings captured → a recurring finding auto-logs a candidate/lesson. Trace at every hop.
- **P2 — write/action loop (gated):** event → agent produces a real change → the change passes the fail-closed gates autonomously → a **verified** change is produced; the ONLY human touch is the outward/merge boundary (or fully auto for an explicitly-allowlisted low-risk class). A bad change must be BLOCKED by the gates autonomously, not shipped.

### C. Required runtime evidence (quantitative + falsifiable)
- **≥ 10 end-to-end autonomous cycles** completed over **≥ 5 days** (not one demo burst), each with the full trace set: trigger log · logged selection · runner-attributable agent transcript · outcome record · (P1) learning entry where applicable.
- **Success rate ≥ 90%**; every failure **fail-closed** (no unsafe/unbounded/destructive execution); **0 safety-gate bypasses**.
- **Human-approval-required = NO** for the explicitly-scoped autonomous action classes (and the scope is named — which classes are auto vs still human-gated).
- **Independent verification (author≠verifier)** that the traces are genuinely autonomous: spawns originate from the automated runner (identity/context/timestamps OUTSIDE a human session), not the main-loop orchestrator. A reviewer must be able to refute "a human triggered this."

### D. Status ladder (how we grade it)
- **Not Proven** — no autonomous trigger→agent→outcome path has run.
- **Partially Proven (today)** — the path is built and ran in a demo/once, OR only Layer A (enforcement) is autonomous. Agent dispatch still has a human/orchestrator in the loop.
- **Operationally Proven** — A + B + C all satisfied and independently verified. Anything short of the §C thresholds is Partial, by definition.

## Honesty guards (what does NOT count)
- Main-loop/orchestrator spawning agents (today's stand-in + native spawns) — that is **orchestrator-driven**, not autonomous.
- A human gesture (button, slash-command, "go") triggering the run.
- Designed-but-never-run, or a single hand-held demo.
- Telemetry from human-session subagents (the 304 invocations this cycle are USAGE evidence, not AUTONOMY evidence).

## Relationship to the roadmap
- This is a **future capability (provisional "G9 — Autonomous Agent Execution")**, GATED behind: G4 (learning wiring — criterion A5) + the Founder-Away-Mode envelope (criterion A6) + the automated dispatch runner (A3).
- Until §C is met with verified traces, every report says **Auto-Exec Confidence: Partially Proven** for Layer B and states the precise gap. We do not soften the word "Operationally" to fit.
