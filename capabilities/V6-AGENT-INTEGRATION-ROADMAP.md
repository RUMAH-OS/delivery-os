# V6 Roadmap Item — Native agent integration (capability → trigger → route → agent → verify → learn)

> **Status:** TARGET STATE accepted (founder, 2026-06-24). Architecture: `docs/AGENTS-IN-V6-ARCHITECTURE-2026-06-24.md`.
> **Scope decision (founder):** the catalog fix (agents spawnable) and v6 integration are **separate concerns**.
> Agents stay a **distinct primitive** (NOT forced into `*.capability.json`) but become **routable · verified ·
> learned-from** with the **main loop as the only spawner (G9)**.
> **Directive:** smallest slices, highest-leverage first; optimize for **operational proof + real usage**, not more architecture.

## Current state (one line)
The router/engine/verify/learn machinery is **built but starved**: agent files carry no `capabilities/triggers`
→ `agent-route` is inert; `agents:check` is a phantom (`✅` in the backlog, absent on disk); the engine
`agent-runner` is dormant; agent outcomes are measured (`agent-health`) but never persisted/learned-from.

## The chain, and where each link breaks
| Link | State today | Smallest fix |
|---|---|---|
| **capability** | real (skills/workflows) — agents deliberately separate | — (P7 boundary decision, deferred) |
| **trigger** | live (`enqueue` → workflow; the dunning sweep) | — |
| **route** | **BROKEN** — agents have no `capabilities/triggers`; gate phantom | **S1** |
| **agent** | catalog roles harness-spawned; engine executor-port dormant | **S4** |
| **verify** | `engine.verify` works on executor-port output, not catalog roles | **S4/S5** |
| **learn** | `agent-health` report-only; anti-decay rule unrun | **S2** |

## The slices (smallest → operational; HIGHEST-LEVERAGE FIRST)

### ⭐ S1 — ROUTE: agent frontmatter + `agents:check` gate (ONE paired change) — **the keystone, do first**
**Why first:** it is the single broken link that is *smallest to fix* and *used by every agent task immediately*
(including this session's fan-outs). It flips `agent-route` from inert→functional — the unlock everything else needs.
- Author `kind:"agent"` + `capabilities[]` + `triggers[]` on the 16 canonical agents (from each description + this
  session's lived routing signals).
- Build + wire `agents:check` (runs `validateAgentFrontmatter` over `.claude/agents/*.md`, fail-closed, pre-push/CI)
  **in the same change** (gate-before-roster blocks pushes; roster-before-gate rots — the trap that caused today's state).
- **Operational proof:** `agent-route "<real task>"` deterministically ranks the right specialist + logs *why*;
  `agents:check` passes the roster and fails-closed on a planted bad agent; `capability-health` flips
  `agent-route`/`agent-frontmatter` MISSING→ALIVE. **Effort ~2–3d. Off-prod verifiable. No engine work.**

### S2 — LEARN: persist agent outcomes + run the anti-decay pass — **second (real usage of data that already exists)**
**Why:** `agent-health` already *produces* per-spawn DECISIVE/IDLE telemetry every session and throws it away. Cheapest
real "learn" link — make the existing measurement durable + acted-on.
- Persist `agent-health` classification to a durable artifact (a log/ledger row), not stderr.
- Run the anti-decay pass in `learning-review`: IDLE-N-milestones → retire candidate; missed-defect → strengthen row.
- **Operational proof:** an IDLE agent surfaces in a committed ledger; a real "missed X" produces a strengthen row. **~2–3d.**

### S3 — ROUTE coverage: extend `ownership-policy.json` to `verify`/`review`/`cleanup`
**Why:** today only *build* work dispatches (coverage ~0.19) — even a full roster routes ~50% of slice work.
- Add the missing work-types so verify/review/cleanup route through dispatch.
- **Operational proof:** a verification task dispatches through `agent-route` (logged), not model-driven. **~1–2d.**

### S4 — AGENT+VERIFY (engine bridge, prod): activate the `agent-runner` for ONE real `agent-result` workflow
**Why:** this is the "trigger → agent → verify" native chain. Bigger; depends on the dormant runner. Sequence after S1–S3.
- Make the engine honor `await_source='agent-result'` on real blocks; start a bounded `agent-runner` with a tick loop in a consumer (Admin); add one real `agent-result` workflow definition.
- **Operational proof (off-prod first):** a workflow agent-step completes through the runner + `engine.verify`, verdict recorded. **~3–5d. Respect G9 — the runner/main-loop spawns; the engine emits the task.**

### S5 — bind a catalog role as an engine executor → full chain end-to-end
- Register one catalog role as an engine agent whose executor spawns the role (bounded runner); its output passes `engine.verify`.
- **Operational proof:** trigger → workflow → routed role → verified → recorded, end-to-end (off-prod). **~3d.**

### S6 — (founder/§11) ratify the registry boundary
Agents stay distinct from capabilities, with their own first-class registry that dispatch + health both consult. *Decision, not code.*

## Prioritized sequence (operational-proof order)
**S1 (keystone) → S2 (learn, cheap real usage) → S3 (route coverage) → S4 → S5 → S6.**
S1–S3 are off-prod-verifiable framework slices with immediate real usage (every future fan-out routes + measures
deterministically). S4–S5 are the engine-native chain (bigger, prod-gated). S6 is a founder decision.

## Guardrails (carried from the architecture review)
- **G9:** the engine never self-spawns; the bounded runner / main loop is the only spawner.
- **Pair S1's frontmatter + gate** — never one without the other.
- **Calibrate** any verifier before its verdict may *gate* a catalog-agent outcome (eval-the-evaluator).
- **Distrust the backlog's `✅`** — re-verify each "done" against disk.
- Each slice via **engineer → QA → reviewer** (author≠verifier); framework changes through delivery-os's own gate.

## Not now (explicitly deferred per the founder)
No further investigation. No registry re-modeling. No mass skill-frontmatter backfill beyond what `agents:check`'s
honest application surfaces. Operational proof + real usage (the dunning trigger, the money loop) remain the priority;
this roadmap advances only when an agent-integration slice is the highest-leverage available work.
