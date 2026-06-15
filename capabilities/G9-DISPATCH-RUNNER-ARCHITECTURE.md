# G9 — Dispatch-Runner + Standing Auto-Injection (V6 Board Outcome, 2026-06-15)

> Board: lead-architect · integration-architect · qa-reviewer · reviewer-critic (adversarial).
> Founder charter: the value is **automatic specialist selection · automatic skill injection · automatic
> knowledge injection · automatic ownership routing · measurable adoption in real product work** — NOT
> self-spawning agents. "If a bounded runner can automatically select the correct specialist, inject the
> correct skills+knowledge, and drive execution without Claude manually assembling every workflow, we have
> the majority of the value." Mirrors SKILL-PROOF-ARCHITECTURE.md / KNOWLEDGE-LAYER-ARCHITECTURE.md.

## Verdict: APPROVE-WITH-CONDITIONS (reviewer-critic REQUEST-CHANGES; 6 conditions ADOPTED)

## Honest ceiling (binding)
Only the main loop (Claude) spawns subagents. G9 is NOT self-spawning. G9 = collapse the orchestrator's
discretion into a **deterministic dispatch protocol**: route agent + skills + knowledge automatically, inject
by construction, execute pre-approved batches under a bounded envelope. Claude stays the spawner; it stops
being the decider-and-doer. The autonomy that is real = "execute a pre-approved work-list under a bounded
envelope with gates as the brake + a kill-switch," not unbounded self-direction.

## The achievable shape (lead-architect + integration-architect)
- **`dispatch-route.mjs`** (OS-owned, vendored): a thin COMPOSER over the existing routers (agent-route +
  ownership-policy + skill-route + knowledge-route) — zero new scorers. Per dispatch it: selects the agent,
  resolves the required owner (policy wins; route is the explainer), runs skill-route + knowledge-route
  (mint proofIds + markers), and emits ONE **DispatchPlan** + a verbatim `spawnPrompt` with the markers+bodies
  inlined. It mints a `dispatchId` (parent of the per-router proofIds).
- **`dispatch-log.jsonl`**: one append-only line per dispatch — `{dispatchId, task, agent, agentMargin,
  skillsInjected:[{name,proofId}], kusInjected:[{kuId,proofId,contentHash}], injectionBlockHash,
  parallelBatch}`. This is the machine answer to "WHAT WAS AUTO-INJECTED" (previously only memory).
- **proofId spine join:** `dispatchId → proofId_s/proofId_k → skill-health/knowledge-health ledgers → the
  spawned transcript first-record markers (injection by construction) → citations → ownership-gate
  contribution`. All 9 dimensions resolve from telemetry by joining on these keys — no new stream.
- **Adoption becomes STRUCTURAL by construction:** because dispatch-route runs the routers + emits a
  spawnPrompt that already contains the markers+bodies, dispatching the runner-way IS injecting. The only
  remaining variable is "did we dispatch via the runner," which a `dispatch-coverage` RATIO gate drives toward
  1 (bare spawns render RED, fail-closed). Honest limit: the marker is a CONVENTION (paraphrase severs it) and
  step-6 spawn is still Claude — so "structural by construction + enforced ratio," NOT "mechanically unbypassable."
- **A6 Founder-Away-Mode envelope (shape):** a founder-ratified ordered work-list the runner dispatches in
  sequence; mandatory gate trio between items; halt-on-red (no skip-continue); kill-switch sentinel file +
  item-count/cost caps; MAY-NOT = add/reorder items, spawn unlisted agents, cross sensitive boundaries
  (ADR-006/007: no prod migration / credential rotation / legacy-decommission / approval-required outbound),
  merge to main, override a red gate. Produces a per-item audit ledger.

## The 9 reporting dimensions — provable vs PROXY (qa-reviewer + reviewer-critic, honest caps)
| # | Dimension | Source | Strength |
|---|---|---|---|
| 1 | Agent participated | dispatch-log + subagent transcript (agent-health USED) | **PROVABLE** |
| 2 | Agent **materially influenced** | ownership-gate contribution ≥ 0.5 (char-weight) | **PROXY** — "materially produced," NOT causation; DECISIVE only via ablation |
| 3 | Skills available | skill-health installed[] (disk roster) | **PROVABLE** |
| 4 | Skills triggered (auto-injected) | dispatch-log.skillsInjected ↔ skill-selections (proofId) | **PROVABLE (log)** — injection volume, NOT adoption |
| 5 | Skills used | content-bound citation re-found in SKILL.md (L3) / fingerprint (L5) | **ATTESTED / PROVABLE (exec skills)** |
| 6 | Knowledge retrieved | dispatch-log.kusInjected ↔ knowledge-selections (proofId@hash) | **PROVABLE (log)** |
| 7 | Knowledge **influenced execution** | citation@hash (K3); else value-binding | **PROXY** — TRUST (verified cited@hash), NOT causation |
| 8 | What was auto-injected | dispatch-log row ↔ transcript first-record markers | **PROVABLE (by construction)** — REPORT-ONLY, never scored |
| 9 | (Auto-exec / away-mode) actions executed | away-mode per-item ledger + gate results | **PROVABLE (log)** |

## ADOPTED conditions (reviewer-critic)
- **C1 — Runner ≠ checklist.** dispatch-route emits a plan AND a **planned-vs-actual conformance check**
  (actual spawn route vs emitted plan; deviations logged + counted). Without it, "runner" is relabeled discretion.
- **C2 — Injection firewalled from adoption (HARD).** `injected` is a SEPARATE counter that can NEVER touch
  the ladder rung or trust. Promotion stays gated by content-bound citation@hash + organic recurrence. If
  injection volume can move any rung, G9 is rejected. (Reuse skill-health/knowledge-health: trust = cited, never injected.)
- **C3 — "Influenced" = TRUST, not causation.** Dimensions 2 & 7 reported as verified cited@hash / contribution,
  explicitly NOT "materially influenced/decisive" without an ablation. Citation ≠ causation.
- **C4 — Reduced-Claude decomposed + contribution-weighted.** Three permanent lanes: **Dispatch/Routing
  (~100% forever — a constant, never claim improvement)** · **Build (the only meaningful "reduced-Claude" lane,
  ~50% today)** · **Docs/Knowledge (RED today)**. Contribution-weighted, never call-counted (guards
  trivial-delegation: a stub handed off ≠ ownership).
- **C5 — Capped ceiling stated explicitly (the founder's clarification resolves this).** Routing + injection +
  away-mode + conformance = **achievable GREEN now (the MECHANISM = the majority of the value, per founder)**.
  **Organic adoption GREEN = HONESTLY-PENDING-PRODUCT, fail-closed UNMEASURED until a real product slice runs
  through the runner** (the proving-vs-organic classifier routes all meta/proof tasks to PROVING by design — it
  is structurally impossible to farm "adopted" out of dogfooding). G9 proves CAPABILITY now; ADOPTION accrues
  during real work.
- **C6 — Pre-register the 5 kill-criteria** in the slice verify doc.

## Named kill-criteria (any one ⇒ G9 did NOT deliver)
1. Injection laundered the rung (injected promotes past PARTICIPATES, or removing injected-count changes a rung).
2. No build-share drop after a real dispatch (contribution-weighted Build% doesn't fall below ~50% baseline).
3. Injection never converts to organic citation across ≥2 real slices (mechanism exists, adoption doesn't — Exists≠Used).
4. Runner non-binding (actual dispatches deviate from the plan with no logged deviation/conformance count).
5. Away-mode unbounded or fakes outcomes (GREEN with no irreversible-action gate / outcome-verified without re-run).

## Smallest proving slice
ONE real dispatch end-to-end through the runner: dispatch-route emits the plan (agent + ≥1 skill marker + ≥1 KU
marker + spawnPrompt) → Claude spawns the owner with that exact prompt → the specialist materially owns the
work (contribution ≥ 0.5) AND emits a content-bound citation (skill OR knowledge) → a verifier answers all 9
dimensions from telemetry by joining on dispatchId, and a sabotage (drop the marker / quote-not-at-hash) flips
used→injected-not-cited. Build: `dispatch-route.mjs` (+ self-test: routing determinism, both markers in
spawnPrompt, dispatchId stable, conformance, log round-trip) + `dispatch-coverage` ratio (report-only first) +
a `## Auto-Injection Evidence` region wired additively into slice-close (NOT in REQUIRED_SECTIONS until a
deliberate paired change — frozen-header discipline). Do NOT build the away-mode runner or flip any gate to
blocking until the chain is green on ONE dispatch. Honest ceiling: this session's slices are PROVING → the
most G9 earns now is "BUILT + capability proven; adoption PENDING real product use."

## Is G9 the last leverage point before PLOS?
Yes, with honest scoping: the achievable G9 (runner + auto-injection + away-mode + conformance) + the small
**G8 seam single-sourcing precondition** are the last STRUCTURAL items. Organic adoption GREEN then accrues
during normal product work (measured by the standing checks), and G8 PLOS inheritance is the "V6 landed" 2nd-app
proof. Building G9 does not require real product work; PROVING its adoption does.
