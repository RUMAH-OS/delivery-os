# V6 Adoption Review Standard — Mechanism GREEN ≠ Adoption GREEN (permanent, 2026-06-15)

> Founder principle (locked): a capability is NOT adopted because it exists; it is adopted because it is
> **repeatedly used during normal product execution.** Applies equally to Agents · Skills · Knowledge Layer ·
> Ownership Routing · Dispatch Runner · Auto-Injection. What matters is whether **normal product work is
> flowing through the machinery** — not whether the machinery exists. The failure to avoid:
> `G9 GREEN · G11 GREEN · G12 GREEN` while real execution is still `Founder → Claude → Execution`.

## The permanent distinction (never collapse these)
- **Mechanism GREEN** = the capability is built, wired, deterministic, fail-closed, self-tested. Achievable by building.
- **Adoption GREEN** = real product work repeatedly flows through it (organic, multi-slice). Achievable ONLY by real use.
- **Progression (prove each stage with runtime evidence):** `Built ≠ Used · Used ≠ Influential · Influential ≠ Habitual`.

## EVIDENCE-BASED VERDICT (2026-06-15) — have we achieved the intended structure?
Source: `operating-model-check --json` (45,863 transcript lines) + build-ownership-probe + skill/knowledge-health. **Honest answer: NO — not in practice.** The structure is BUILT and MEASURED; execution is still dominated by Claude + one general builder.

| Evidence | Reading |
|---|---|
| Build: **Claude 49.9% + software-engineer 40.4% = 90.3%**; specialists frontend-engineer 1.4%, database-data/api-integration/integration-architect **0%** | Claude + ONE general builder do ~90% of build; 3 specialists IDLE |
| Documentation **86.7% Claude** · Knowledge Management **97% Claude** | knowledge/docs still Claude's job |
| Skills: **0 organic** (proving-only) · Knowledge: **0 organic** (proving-only) | skills+knowledge exist on paper, not in real execution |
| Dispatch through a runner: **0** (G9 not built) | no automatic select/inject/route in real work yet |
| Reviews 73% agents ✅ · Reporting tool-automated ⚙ · Routing Claude 100% ✅ (by design) | the parts that ARE working |
| Skills/Knowledge ladder rung: **PARTICIPATES (proving-only)** | NOT Habitually-Participates |

**Verdict:** today the real operating model is **`Founder → Claude (+ software-engineer) → Execution`, with the
intended `→ Agents → Skills → Knowledge →` layer BUILT and MEASURED but largely UNUSED.** We have the honest
measurement of the gap, not the closure of it. Reviews are genuinely agent-owned; everything else is mechanism-
GREEN / adoption-RED. **This gap stays RED in the backlog until organic adoption thresholds are met (below).**

## Standing V6-Adoption-Review contract (MANDATORY in milestone · roadmap · completion · V6-status reviews)
Auto-generated (never memory) by `v6-review.mjs` from telemetry. Every such review MUST include, with TREND vs the previous milestone snapshot (▲ increasing / ▬ flat / ▼ decreasing):
1. **Agent Participation** — retrieved · triggered · participated · influenced · owned
2. **Skills** — retrieved · triggered · used · influenced execution
3. **Knowledge Layer** — retrieved · cited · influenced execution
4. **Ownership Routing** — required owner · actual owner · contribution % · pass/fail
5. **Auto-Injection** — what was auto-injected · how often · influence strength
6. **Trend vs previous milestone** — per dimension: ▲/▬/▼ (trend visibility, not just snapshots)

## The 6 V6-review questions (every V6 review must answer, from real execution data)
1. **% of real product work owned by specialist agents** (contribution-weighted, organic only)
2. **% that used skills** (organic, cited)
3. **% that used knowledge retrieval** (organic, cited@hash)
4. **% that flowed through dispatch** (the runner)
5. **% that involved auto-injection** (injected AND cited — not injection volume)
6. **Is Claude's direct execution share decreasing over time?** (Build lane, contribution-weighted; Dispatch ~100% is a constant, never counted as improvement)

Honest caps (carried from the G9 board): "influenced" = verified citation@hash TRUST, **not causation** (DECISIVE needs ablation). "Auto-injected" is REPORT-ONLY, **firewalled from the adoption rung** (injection volume can never promote Used/Influential/Habitual). UNMEASURED fails closed. Proving usage can NEVER promote past PARTICIPATES.

## The THREE original-vision outcome gates (RED — post-G8; "V6 complete in practice" requires ALL THREE met, not just mechanism+ecosystem proven)
> G8 proves the ecosystem MECHANISM + generates initial adoption EVENTS. It does NOT demonstrate these three
> outcomes — they are sustained-usage (PLOS, over time) + two genuinely-new knowledge pieces. Do NOT declare
> V6 complete until each threshold is MET in practice (measured by the standing checks over real product work).

**Outcome 1 — Specialist ownership → ~90% agent / 10% Claude** (Adoption proof; measured in PLOS product work)
- 1a contribution-weighted Claude **build** share trends to **≤10%** over a sustained window of real product slices.
- 1b all 3 IDLE specialists (frontend-engineer · database-data · api-integration) OFF idle, each owning its turf ≥ contribution threshold.
- Cap: build-lane only; dispatch stays ~100% Claude by harness (never counted as a miss). No new mechanism — needs real volume.

**Outcome 2 — Habitual skill retrieval + measurable influence** (Adoption proof; PLOS)
- 2a ≥K skills reach **HABITUALLY-PARTICIPATES** (organic, ≥2 distinct real product slices, cited@hash).
- 2b influence = cited + fingerprinted (L5), TRUST accrued.
- 2c (OPTIONAL) ablation harness for DECISIVE causal influence — the only way past the TRUST/citation proxy (founder decides if required). **NEW mechanism.**

**Outcome 3 — Habitual knowledge + influence + update propagation + cross-system reuse** (richest; two NEW pieces)
- 3a habitual knowledge retrieval + influence (cited@hash) over real product slices. (Adoption proof; PLOS)
- 3b **update propagation** — a KU version-bump propagates byte-current to all consumers + a multi-consumer cross-check asserts every app's INHERITED.json is current. **NEW mechanism** (END-STATE "two new pieces", not built).
- 3c **cross-system reuse** — a shared KU authored once (OS/Admin) retrieved + cited in PLOS on real work ("learned once, reused everywhere"). **Ecosystem proof, post-G8.**

**These three gates stay RED until met in practice. "V6 landed" (G8) is necessary but NOT sufficient for "V6 complete."**

## Backlog gate — "V6 STRUCTURE ADOPTED IN PRACTICE" (RED — keep visible until genuinely closed)
Distinct from "G9/G11/G12 mechanism GREEN." Closes ONLY when, over real product slices:
- specialist agents own ≥ a target share of real build (contribution-weighted; the 3 IDLE specialists off 0),
- skills + knowledge reach **Habitually-Participates** (organic, ≥2 distinct real slices, cited@hash),
- dispatch + auto-injection are the standing path for real work,
- **Claude's contribution-weighted Build share is trending DOWN** across milestones.
Until then: **mechanism may be GREEN; adoption is RED; V6 is NOT landed in practice.**

## The honest path (more reporting will NOT move these numbers)
The reporting machinery is now comprehensive. The trend will stay **flat-at-zero** until: (1) G9 runner built so
real work CAN flow through auto-select/inject/route; (2) **real product work runs through it**; (3) the standing
trend then shows movement. So the sequence is **G9 mechanism → real product slices → adoption trend moves** —
not more measurement. The standing V6-review keeps us honest that we haven't closed the gap by building reports.
