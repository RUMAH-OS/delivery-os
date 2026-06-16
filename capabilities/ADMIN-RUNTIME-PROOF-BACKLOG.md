# Admin Runtime-Proof Backlog — "Prove the operating model in Admin first" (2026-06-16)

> **Founder directive (post board review):** G8 / ecosystem propagation REMOVED from active consideration.
> Admin is the laboratory. Objective = **"Can V6 prove itself in Admin beyond reasonable doubt?"** — turn
> every runtime uncertainty GREEN, measured by the standing checks (not memory), against the intended model
> `Founder → Claude (orchestrator) → Agents → Skills → Knowledge → Execution` and the long-term target
> **~10% Claude / ~90% agent contribution** (build lane; dispatch/routing stays ~100% Claude by harness and is
> never counted as improvement). Source of the gaps: `V6-RUNTIME-REALITY-BOARD-2026-06-16` (4-seat board).

## The 11 founder uncertainties → where each is addressed
| # | Founder uncertainty | Backlog item(s) |
|---|---|---|
| 1 | specialist ownership | R3 (window) · R4 (idle specialists) |
| 2 | agent orchestration | R2 (routing honesty) · R3 |
| 3 | skill adoption | R3 · R4 (dormant skills) |
| 4 | knowledge adoption | R3 · R6 (citation fragility / dark surface) |
| 5 | ownership measurement | R1 |
| 6 | contribution measurement | R1 |
| 7 | Claude reduction | R3 (build-share trend) |
| 8 | parallel execution | R8 |
| 9 | runtime robustness | R5 · R7 |
| 10 | propagation robustness (Admin's OWN os-inherit) | R5 |
| 11 | self-healing capability updates | R5 |

## The forcing-function principle (board root cause #2)
Today dispatch-coverage, ownership-gate, contribution, and `--owner` are **report-only** — nothing is enforced,
so the model holds by operator discipline, not by construction. **No adoption pillar can go GREEN while its gate
is advisory.** Tier 0 below flips the load-bearing gates to enforcing FIRST; every downstream proof is
"discipline-dependent" until it does.

---

## RANKED BACKLOG

### TIER 0 — Forcing functions (make the model hold by construction). Do first; everything else depends on these.

**R1 — Honest ownership + contribution measurement (ban `--owner`-declared PASS).**
- *Uncertainties:* ownership measurement, contribution measurement.
- *Current (RED):* every ownership-gate PASS this session used `--owner` *declared* (`Contribution % = n/a (declared)`), which the locked Pillar-2 criteria explicitly forbid counting. Ownership is asserted, not measured.
- *GREEN:* slice-close / ownership-gate computes contribution-weighted ownership **from telemetry** (char-weight ≥ threshold) for the slice's work-type; a `--owner`-declared PASS can NEVER satisfy Pillar 2; ownership-gate flips to **BLOCKING** for ≥1 work-type (fail-closed on TOKEN-contribution or specialist-idle-on-worked-turf). Negative test: a slice where Claude did the build cannot show a specialist as owner.
- *Depends on:* nothing. **This is the foundation.**

**R2 — Routing honesty (router accuracy vs policy correction) + dispatch enforced.**
- *Uncertainties:* agent orchestration.
- *Current (YELLOW/RED):* 9/13 dispatches were RECONCILED — the router's pick was overridden by the ownership policy; in 8/13 a specialist was demoted to a generalist. "Automatic selection" is currently "selection + automatic correction"; conformance 0.714. dispatch-coverage is report-only.
- *GREEN:* report a first-class `routerCorrect` (pre-policy agentSelected == agentRequired) **separately** from policy-corrected conformance; resolve the selector-vs-policy contradiction to ONE ownership source of truth; dispatch-coverage flipped to **enforcing** (≥90% of build-bearing slices routed, bare spawns fail-closed). Router pre-policy accuracy reported on a trend.
- *Depends on:* R1 (ownership source of truth).

### TIER 1 — The proof window (turns adoption from theoretical to proven).

**R7 — Test-DB + reliability path (unblock the safe-runtime precondition).**
- *Uncertainties:* runtime robustness.
- *Current:* built + PARKED in `stash@{0}` (env.ts loader + off-prod test-DB + prod-write guardrail exits 3). Stacked commits (invoice-pdfref, runner-repair) push-blocked on this. NOT independently verified.
- *GREEN:* independent verifier (author≠verifier — software-engineer built it) confirms the running thing off-prod; guardrail proven to refuse prod writes; committed; push unblocked. **Precondition for running real product slices safely (R3).**
- *Depends on:* nothing (just resume + verify).

**R4 — Resolve idle specialists + dormant skills (real turf or retire).**
- *Uncertainties:* specialist ownership, skill adoption.
- *Current (RED):* 3 specialists IDLE (database-data, api-integration, integration-architect → 0 build mutations); 5–7 skills DORMANT (0 lifetime triggers). The ≥80%-specialist bar is unreachable if the substrate has no specialist turf.
- *GREEN:* each specialist either owns ≥ contribution-threshold on eligible Admin work within the window, OR is explicitly retired (anti-IDLE use-or-retire); each dormant skill is triggered on real work or removed. Roster denominator reflects only live capabilities.
- *Depends on:* R3 substrate selection (which product slices have which turf).

**R3 — Run the N=10 / M=3 proof window on REAL Admin product work, gates enforcing.**  ← **highest leverage**
- *Uncertainties:* specialist ownership, agent orchestration, skill adoption, knowledge adoption, Claude reduction.
- *Substrate:* Admin's **own operator-queue product work** (June invoicing run · re-send the 2 in-flight signings · slugs/publish flow · Supabase-Auth login slice). This is the board's fix for the self-referential confound — real founder value AND the proving substrate, no PLOS needed.
- *Current (RED):* all 24 prior slices were OS-meta in a single ~22h burst; only invoice-pdfref was product-adjacent. Window not started.
- *GREEN (the locked Pillar-2 criteria, no softening):* over N=10 real Admin-engineering/product slices spanning M=3 milestones — dispatch ≥90% + conformance PASS · specialists own ≥80% by **contribution** (no `--owner`) + Claude build-share trends DOWN toward the ~10% target + 0 specialists idle-on-worked-turf · ≥3 skills HABITUALLY-PARTICIPATES (cited@hash, organic, ≥2 distinct slices each) · ≥3 KUs HABITUALLY-PARTICIPATES (cited@hash, ≥2 slices each) · sustained, not bursty.
- *Depends on:* R1, R2 (gates must enforce or the window proves nothing), R7 (safe DB), R4 (turf).

### TIER 2 — Runtime robustness (the machinery must be trustworthy under the window).

**R5 — Semantic-compat self-test gate (Admin's own os-inherit; propagation robustness + self-healing).**
- *Uncertainties:* propagation robustness, self-healing capability updates, runtime robustness.
- *Current (RED):* `os-inherit` sync/check verify byte-currency (`sha(vendored)==sha(canonical)`), NOT importer export-surface — a stale re-vendor dropped exports and crashed the runner while os:check / INHERITED.json / drift-lint stayed GREEN. RCA drafted (uncommitted, delivery-os repo).
- *GREEN:* os-inherit sync+check run each vendored tool's `--self-test` AND the seam good/bad fixtures against the **vendored** copy, fail-closed; negative test = remove an export (e.g. `routeTask`) → both sync and check exit non-zero. (Admin-internal inheritance only — NOT PLOS.)
- *Depends on:* nothing; can run in parallel with the window. Verify the RCA first (author≠verifier).

**R6 — Knowledge adoption robustness (citation fragility + raw-Read dark surface).**
- *Uncertainties:* knowledge adoption.
- *Current (RED/YELLOW):* ~1:1 fabricated:cited (the verbatim-substring check rejects honest paraphrase); ~99% of execution is Markdown→Claude→Execution and invisible (a raw `Read` of a KU leaves no telemetry). Measured knowledge surface ≈ 1%.
- *GREEN:* citation matching becomes tolerant-but-anchored (content-hash is the real anchor; fuzzy quote allowed) OR raw-Reads of `wiki/**` are instrumented; fabricated:cited ratio falls materially; measured knowledge surface rises well above the current ~1%.
- *Depends on:* nothing; lands before/during the window so R3's knowledge numbers are trustworthy.

### TIER 3 — Remaining proofs.

**R8 — Parallel execution proof.**
- *Uncertainties:* parallel execution.
- *Current (UNPROVEN):* the runner can emit parallel batches, but real concurrent specialist execution with logged conformance + measured wall-clock benefit is not demonstrated on a real slice.
- *GREEN:* ≥1 real window slice dispatches a parallel batch of specialists; conformance logged per item; wall-clock benefit measured vs serial.
- *Depends on:* R2 (conformance), R3 (real slices).

**R9 — Founder Operability Review (Pillar 3 — founder-judged, cannot be self-certified).**
- *Uncertainties:* the founder-trust dimension that gates "V6 complete."
- *Current (RED):* never run.
- *GREEN:* on ≥3 RANDOMLY-selected real slices across ≥3 milestones, the founder answers Q1–7 from the standing record ALONE (no code-reading, no asking Claude), Q7 = "yes", AND founder control is demonstrated ≥1× (stop/redirect/override a real dispatch, honored).
- *Depends on:* R3 (real slices to review at each milestone close).

---

## Critical path (dependency order)
```
R1 (honest ownership)  ─┐
R2 (routing + enforce) ─┼─→ R3 (N=10/M=3 product window) ─→ R8 (parallel) ─→ R9 (founder review)
R7 (test-DB unblock)   ─┤        ▲
R4 (specialist turf)   ─┘        │
R5 (semantic-compat) ────────────┤  (parallel, robustness under the window)
R6 (knowledge robustness) ───────┘
```
**Start order:** R1 → R2 → (R7 ∥ R5 ∥ R6) → R4 → **R3 the window** → R8 → R9.

## What "beyond reasonable doubt" means here
V6 is proven in Admin when, over ≥3 milestones of **real Admin work** with gates ENFORCED (not report-only):
the dispatch-runner is the standing path, specialists own ≥80% of build by measured contribution with Claude
trending toward ~10%, ≥3 skills and ≥3 KUs are habitually cited@hash, the inheritance machinery cannot
silently ship a broken capability, and the **founder** can reconstruct any slice from its record alone and
control the system. Mechanism-built is necessary but never sufficient — these are proven by use, not by build.
