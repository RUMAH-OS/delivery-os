# Knowledge & Skill Adoption — V6 Gap Report (2026-06-15)

> Founder question: are we **Knowledge → Skills → Agents → Execution**, or still
> **Markdown → Claude → Execution**? Concern: we may have solved *Agent* Adoption before
> *Knowledge* Adoption. This report answers with runtime evidence and recommends whether
> Knowledge/Wiki Adoption becomes a V6 completion item BEFORE PLOS propagation.

## Headline (honest, one line)
**We solved Agent Adoption. We did NOT solve Knowledge Adoption, and we BUILT but did not ADOPT
Skill Adoption. The live operating model is still `Markdown → Claude → Execution`.** The founder's
concern is correct.

## Diagnosis against the founder's three hypotheses
| Layer | A telemetry gap | B adoption gap | C architecture gap | Verdict |
|---|---|---|---|---|
| **Knowledge/Wiki** | — | — | ✔ | **Pure C.** No wiki capability exists. You cannot have a telemetry gap (A) or an adoption gap (B) for a capability that does not exist. |
| **Skills** | partial | ✔ | partial | **Mostly B on a partial-C.** The measurement machinery exists (G11 proving slice) but is NOT the standing dispatch flow → near-zero organic triggers. |
| **Agents** | — | — | — | **Solved.** Routed (agent-route), measured (agent-health, 328 invocations), anti-idle (0 idle), trust-scored. This is the model the other two layers lack. |

## 1. Skill Architecture + adoption telemetry (evidence)
- **Skills that exist:** 14 (on disk under `.claude/skills/`).
- **Triggered (telemetry):** `skill-selections.jsonl` holds **2 records EVER** — both from a single manual
  `batch-skillproof-demo` (the G11 proving slice), 0 organic. (Denominator caveat: only **9 slices** exist
  total, not 100 — the founder's "last 100 slices" exceeds our history; the honest figure is **~0 organic
  skill triggers across all 9 slices**.) Contrast: `agent-selections.jsonl` = 16.8 KB, full corpus.
- **Materially influenced execution:** **1** skill — `verification-playbook` — carries fingerprint+citation
  evidence (trust 18). That too came from the proving slice, not the organic workflow.
- **Effectively idle:** **12 of 14** skills have never been triggered. `skill-health` with no `--selections`
  defaults to `UNMEASURED` (fail-closed, correct) — it only populates because `adoption-report` passes the
  log explicitly. There is no standing producer writing to that log per slice.
- **Defect found (skill-health roster):** the populated Skill table renders a **phantom skill `X`** and drops
  2 real skills (13 rows shown vs 14 on disk: `cutover-execution` + `legacy-migration-etv` missing). The
  roster parser is buggy → skill telemetry integrity is compromised and must be fixed before skill adoption
  is trusted.

## 2. Knowledge Architecture (evidence)
- **Does a formal Wiki capability exist? NO.** No wiki tool (`scripts/`, `.claude/os/tools/` — none), no wiki
  directory (`docs/wiki`, `.claude/wiki`, `delivery-os/wiki` — none), no retrieval seam. The string "wiki"
  appears only in the two scripts that *scan for it* and find nothing.
- **What qualifies as Wiki Usage today?** Nothing can. There is no observable retrieval path to instrument.
  `Wiki Usage = 0` in every report is **structurally correct**, not a measurement error.
- **Are agents reading markdown directly? YES.** Every agent definition exposes only
  `Read, Glob, Grep, Bash` (+ Write/WebFetch for some). Knowledge is accessed by **raw `Read` on `.md`**.
- **Why doesn't that count as knowledge usage?** Because a raw `Read` is **unobservable** — no `proofId`, no
  selection record, no citation, no trust. (`SKILL-PROOF-ARCHITECTURE.md` already named this:
  *"Wiki retrieval telemetry is blocked until wiki access goes through a tool seam — raw Reads are
  unobservable."*) There is no join key between "knowledge exists" and "knowledge influenced an outcome."
- **How much knowledge exists?** ~**1.7 MB** of markdown: 192 files in `docs/` (incl. **100 verify docs**,
  30 top-level docs, 10 ADRs, 5 decision-reviews, 3 retrospectives, 9 slice records) + **21 memory files** +
  **7 OS capability docs** + **76 lesson signals** (`signals.jsonl`). Substantial knowledge, **zero of it
  retrievable through a measured capability.**

## 3. The two operating models (the founder's exact framing)
```
ASPIRED (Agents already work this way):     ACTUAL for knowledge/skills today:
  Knowledge                                   Markdown files (1.7 MB)
    → Wiki (retrievable, measured)              → Claude (raw Read, unobservable)
    → Skills (routed, trust-scored)             → Execution
    → Agents (dispatched, idle-checked)
    → Execution (telemetered end-to-end)      (no proofId, no selection, no trust, no gate)
```
Agents traverse the left column. Knowledge and skills traverse the right column.

## 4. Missing enforcement (why this persists)
1. **No standing skill-dispatch flow.** `agent-route` is wired as the standing selector (every dispatch logs);
   `skill-route --log` exists but nothing *requires* a slice to route candidate tasks through it → 2 lifetime
   triggers. There is no skill-equivalent of `agents-idle-check`'s anti-idle pressure on the workflow.
2. **No knowledge-retrieval seam.** No tool wraps knowledge access, so no gate *can* observe or require it.
   Knowledge adoption is unmeasurable by construction, not by neglect.
3. **No Knowledge→Wiki promotion.** Lessons accumulate in `signals.jsonl` (76) + prose and never become a
   retrievable, citable wiki page. This is the "learning accumulates as prose instead of converting to
   capability" disease (`founder-ready-gate-and-os-burden`) — at the knowledge layer.
4. **skill-health roster bug** (phantom `X`, 2 skills dropped) — telemetry can't be trusted until fixed.

> **AMENDED 2026-06-15 by the Knowledge Layer board (condition C5 — see KNOWLEDGE-LAYER-ARCHITECTURE.md):**
> the recommendation below to *gate PLOS on Knowledge Adoption* was judged **over-reach and is REVERSED**.
> Knowledge Adoption is an **Admin-internal** v6 completeness item; the PLOS gate is the END-STATE master
> gate (PLOS inherits core + one cross-repo workflow green + one reuse). They run in **parallel** — neither
> blocks the other. Coupling them would stake the N=1 escape on the least-proven, most-gameable layer. The
> rest of this section (make it a completion item; prove in Admin; don't mass-build) stands.

## 5. Recommendation — make it a V6 completion item (PLOS-decoupled, per board C5)
**Knowledge Adoption + Skill-Adoption-as-standing-flow should become V6 completion items, proven in Admin.**
Rationale:
- Propagating now copies the `Markdown → Claude` model to app #2 — **the exact accumulation disease v6 exists
  to kill, relocated to a second app.** Agent adoption alone is not "v6 proven."
- It aligns with the **END-STATE** (Delivery-OS = the brain that holds knowledge·wiki·lessons·skills·trust)
  and the **N=1 master gate** (prove in Admin before propagating).
- "Exists ≠ Used" — the standard now enforced for agents and capabilities must extend to knowledge and skills.

### Smallest proving path (do NOT mass-build — mirror the skill-proof board)
1. **Fix the skill-health roster bug** (phantom `X`) — telemetry integrity precondition.
2. **Convene a V6 board: "Knowledge Layer Architecture"** (lead-architect · documentation · qa-reviewer ·
   integration-architect · reviewer-critic adversarial) — return: knowledge model, retrieval seam design,
   evidence/telemetry model (reuse the `proofId` spine), trust model, **smallest proving slice**.
3. **Smallest proving slice (candidate):** one **knowledge-retrieval seam** (a tool that wraps access to a
   `wiki/` page and logs `{proofId, page, task}`) + **one wiki page promoted from an existing lesson** +
   an agent that retrieves it and emits a content-bound citation → prove **Knowledge → retrieved → cited →
   influenced** on ONE page, exactly as the skill evidence ladder proved one skill. Then scale.

## What we will NOT claim
That 1.7 MB of markdown is "adopted knowledge." That raw `Read` is retrieval. That skills are adopted because
the machinery exists. Built ≠ Adopted — for knowledge and skills as strictly as for agents and capabilities.
