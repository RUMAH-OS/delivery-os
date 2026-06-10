# Proposal — The OS Feedback Loop (Delivery OS learns from its consumers)

> **Status: PROPOSAL, revised after a 4-lens Principle-11 review (panel record at the end). Not implemented.** If ratified → a short `core/GOVERNANCE.md` §14 + one-line additions to `core/OPERATING-LOOP.md` (Write-back + context-hygiene) + a `production-readiness-review` sweep + a no-backflow lint beside `check-os-drift.mjs`. No framework behavior changes until then. Date 2026-06-10. Baseline v3.7.
> **The review made this design SMALLER and MORE honest** — the loop dogfooded itself.

## 1. Problem
Delivery OS already **inherits** lessons mechanically (framework change → CHANGELOG + version bump → every future project via the scaffolder + version boundary — proven v3.1–v3.6). The missing half is **systematic capture + promotion**: today a lesson reaches the framework only because a human *remembers* to start an OS review. The whole v3 review was this loop run **by hand**. Goal: make capture/promotion not-depend-on-memory, **without ceremony or framework bloat.**

## 2. Responsibility split
- **Framework owns the loop mechanism** (trigger surfacing, candidate status, promotion bar, no-backflow lint, inheritance).
- **Projects surface** lessons (flag, don't adjudicate).
- **Ecosystem owns cross-project facts** (ownership/integration → ECRs, never the framework).

## 3. Three-layer routing (sharpens the framework branch of the existing Write-back table)
| Lesson type | Decisive test | Home | Inherited by |
|---|---|---|---|
| **Project-specific** | carries a **project noun** / only this project cares | project `wiki/{learnings,findings}` + ADR | that project |
| **Ecosystem-specific** | changes who-owns-what / integration | `ecosystem-architecture/` (ECR) | Spine consumers |
| **Delivery OS** | **statable with NO project noun** AND every future project benefits | `case-studies/` + a noun-stripped framework change → version bump | every future project, automatically |

**The no-project-noun test is the leading, decisive discriminator** (panel finding: it is the one gate that reliably stops project-preference promotion). `@plos/scoring` → fails → stays overlay. `apps/**` → passes (generic) → framework.

## 4. The triage (3 gates, default outcome = CLOSE)
1. **No-noun routing** (§3) — leads. Routes to project / ecosystem / framework.
2. **Earned bar (Waterline §8)** — a framework candidate must be earned by an **observed failure** OR a **second consumer pulling** for it. Neither → `os_candidate` and **wait**.
3. **Counterfactual (supporting evidence, bounded):** *"What would have happened if this lesson existed before the project started?"* — **admissible only when it cites a recorded artifact of an actual failure** (a `VERIFY`/`DECISION-REVIEW`/incident), never an imagined one; adjudicated in the promotion panel, **never by the proposer alone**. (This is the founder's question, bounded against hindsight bias — it is *confirming* evidence for gates 1–2, not a standalone promote signal.)

## 5. `os_candidate` — a non-authoritative inbox flag (no new store)
A learning/finding/**verification/decision record** may carry `os_candidate: true` the moment someone suspects framework-worthiness — a *hint, not a status claim* (it stays on the record that surfaced it; §12 derived-not-asserted is preserved because it is explicitly non-authoritative). **No `os-candidates/` store, no frontmatter-contract amendment.** Retrieved by grep. Resolved at triage to **promote / redirect / close**, recorded inline.

## 6. The mechanical trigger (event-fired, not memory — the founder's binding refinement)
**The trigger is a MECHANISM; the judgment stays human** — the §12 pattern applied to learning. The verify-gate (already firing on commit/push/tag) gains a **predefined-event detector**. The trigger events are all mechanically observable from the commit/push range:
- **A release** — a git **tag** (the `pre-push` hook already receives tag refs).
- **A review / postmortem / compatibility / production-readiness / major-architecture-review** — the **commit of its artifact** (`DECISION-REVIEW-*`, a review-class `VERIFY-*`, a `*postmortem*`, a `*compatibility*`/`*readiness*` doc), detected in the changed-file set the gate already computes.

On such an event the gate **requires an OS-feedback triage to exist** — **fail-closed at the durable boundary** (a tag/release push blocks without `docs/feedback/OS-FEEDBACK-<event>.md`), and a **required-section check** on review/postmortem artifacts (the triage rides *inside* the artifact the event already produces — no new file). The triage answers three questions: *Were framework-level lessons discovered? Any OS Candidates? Route each to project knowledge / ecosystem architecture / Delivery OS?*

This is the **§12-analog for learning**: *"no slice is done without a VERIFY"* → *"no release or review or postmortem completes without an OS-feedback triage."* The events that produce the richest framework lessons (compatibility reviews found `apps/**`; postmortems found the toolchain lesson; the README audit found the v2 drift) are **exactly the events that fire the trigger** — the OS learns at the moments learning happens, fired by the OS, not by memory.

**Event-gated, not calendar-gated** — a slice or a routine PR triggers nothing; only release-class and review-class events do (rare, and precisely when reflection is warranted). No empty-agenda milestone ceremony. The `os_candidate` flag (§5) becomes an *optional early-capture convenience*; the **mechanical backstop is the event-fired triage**, which asks "were there framework lessons?" even if no one flagged anything during the work.

**A derived surfacer complements it** (anti-graveyard): the gate also emits a **non-blocking** "⚠ N untriaged os_candidates (oldest <date>)" warning — a grep view, not a second store (§7-clean).

## 7. The honest limit (stated, not hidden — identical to §12)
The gate forces the triage to **exist and be answered**; it **cannot force the answer to be insightful** (someone could write "no framework lessons" to pass) — the exact honest limit §12 states for verification truth. Mitigations, same as everywhere: (a) the trigger rides on the review/postmortem events that already generate the deepest lessons, so the *question is mechanically asked at the right moment*; (b) any promotion runs an independent scaled §11 panel (§8), where the answer gets teeth. **The mechanism guarantees the opportunity to learn is created automatically; the review culture guarantees the lesson is real.**

## 8. Promotion is itself a scaled Principle-11 decision (Blocker fix from the panel)
Promoting a lesson **into the framework** changes how every future project builds — architectural/consequential by §11's own list, and inherited+non-swappable per §13. **Therefore every promotion runs a scaled §11 panel (≥2 independent lenses + Reviewer/Critic, blind-first, surface disagreements).** Triage / redirect / close do **not** (nothing changes for future projects). The loop is recursive; this closes the recursion. *(This very review is an instance.)* The promotion artifact = **case study (project-noun evidence) + noun-stripped framework change + version bump**; "promoted" status is **derived** from (change committed + case study + version bump), never self-asserted.

## 9. No-backflow guardrail — MECHANIZED (should-fix from the panel)
"No framework file names a project" becomes a **lint, not discipline** — the proven analog already exists (`check-os-drift.mjs`). A sibling check greps the framework tree (`core/`, `skills/`, `templates/`, the promotion-side of `case-studies/` doctrine) for a project-noun denylist (`@<scope>/*`, known project names, stack-specifics) → **exit 1 on a hit**, same as phantom-dispatch. This belongs in the §13 **kernel-mechanism** column.

## 10. Mechanism vs policy line (§13)
- **MECHANISM** (non-swappable, fires without consent): the **event-fired trigger** (a release tag / a review·postmortem artifact requires an OS-feedback triage — fail-closed at the durable boundary) · the **no-backflow lint** · the **derived candidate surfacer** · the **version-bump inheritance** (unchanged). *The trigger creates the opportunity to learn automatically.*
- **POLICY** (judgment, never hook-fired): the triage **content** (were there lessons; routing project/ecosystem/framework) · layer routing (§3) · the earned bar · the counterfactual · promote/redirect/close — all **gated by the §8 promotion panel**.
- **The line, in one sentence:** *the OS mechanically creates the trigger and requires the triage to exist; humans answer it and decide every promotion.* This is the founder's requirement — mechanical trigger, human judgment — satisfied through the same split as §12.

## 11. What this does NOT do (anti-bloat, tightened by the review)
No new store · no new agent · no `OS-FEEDBACK` per-milestone artifact · no `os-candidates/` log · no calendar-gated triage · no hard release gate (convention, permanently) · **not every lesson becomes a skill** (most resolve project-local; a framework lesson may be a doctrine line, a checklist row, a scaffolder fix, or a case study — a skill bump is the rare case). `§14` is **short** — a sibling to §11 naming the loop + the promotion-is-§11-gated rule + the bar + a pointer to the lint; the routing already lives in the Write-back table.

---

## Principle-11 Review — panel record (4 blind lenses; disagreements surfaced, not smoothed)
**Verdict: SOUND-WITH-CHANGES** (all four lenses). The changes above are the ratified result.

- **Framework Architect:** sound; reuses Write-back/hygiene/inheritance correctly; **cut 6 triage questions → 3**; `os_candidate` = flag-on-existing-record (option C), **not** a frontmatter-contract field; **reject** the `os-candidates/` staging log (`case-studies/` is the *promotion* home, "not doctrine"); don't name a new "PLOS doctrine" — no-backflow = §8+§7.
- **Reviewer/Critic (anti-bloat):** the first draft was a **disguised parallel track** (the `OS-FEEDBACK` artifact + staging log + calendar trigger). Strip to one flag + one hygiene line + one retro question; **default = close**; the hard-gate escalation is a §13 trap — convention permanently; **Q1 is a bloat-accelerant** (hindsight) — demote it and lead with the no-noun test.
- **Operations (will it run):** the inheritance half is mechanical; the capture half was **memory-dependent in disguise** ("trigger is the release" is false — the readiness skill is model-dispatched and PLOS doesn't even have it installed; most projects ship continuously). The **candidate-graveyard is the place it dies quietly.** Required anchor: the **non-blocking derived surfacer** (§6) — ship now.
- **Governance purist (§13):** the mechanism/policy split is honest and mirrors §11/§12. **Blocker: promotions must be §11-gated** (the recursion — §8 above). **Should-fix: mechanize no-backflow** (§9). §8 Waterline faithfully reused; §7 clean *iff* no staging log; §12 honesty restored by the surfacer + derived-promoted-status.

**Disagreements (held, per §11):**
1. **A staging store vs none.** Operations wanted a single `os-candidates/INBOX.md`; Architect/Governance/Reviewer rejected any new store (§7). **Resolution:** no authoritative store; the candidate flag stays on its origin record, and the surfacer is a **derived grep view** — this gives Operations the anti-graveyard surfacing *without* the §7 second-master. Both concerns met.
2. **Q1 keep vs cut.** Architect/Governance: keep, bounded to a recorded failure artifact. Reviewer/Critic: cut/demote (hindsight accelerant). **Resolution:** kept (founder's explicit question) but **demoted to bounded confirming evidence**, never the leading or sole gate — the no-noun + earned-bar lead.
3. **A new §14 section vs no new doctrine.** Reviewer/Critic: no new section (tighten the Write-back table). Governance: §14 needed to home the recursive-§11-gating rule + the lint. **Resolution:** a **short** §14 (sibling to §11) for the genuinely-new rules (promotion-is-§11-gated, the bar, the no-backflow lint pointer); routing stays in the Write-back table. Minimal but named.

## Founder refinement (post-panel) — the trigger is mechanical, and it overrides one panel position
After the panel, the founder applied the §12 standard to the loop's **trigger** (not just its promotion): *"Future projects should automatically create opportunities for Delivery OS to learn — because the OS creates the trigger, not because someone remembers."* Evaluation confirmed a **residual memory dependency**: the revised design's triage rode on discretionary touchpoints (a model-dispatched skill, a human-run hygiene pass) — so the loop still learned only when someone remembered. **§6 is corrected accordingly: the trigger becomes a mechanism** (a release tag / a review·postmortem artifact mechanically requires an OS-feedback triage, fail-closed at the durable boundary), while the triage **content** and every promotion stay human judgment.

**This overrides the Reviewer/Critic lens (held open, per §11).** That lens argued the triage should be *"convention permanently — a hard gate is a §13 trap that blocks shipping working software on process-hygiene."* The founder's binding decision is that learning-capture is important enough to gate a **release** (not a slice), accepting that cost. The dissent's legitimate concern is mitigated, not dismissed: the trigger is **event-gated** (only release/review/postmortem events, never a slice/PR — no empty-agenda ceremony), the triage may be a **one-line "no lessons"** in the cheap common case, and for review/postmortem events it is a **required section in an artifact that already exists** (no new file). The only true block is a **release tag** lacking an `OS-FEEDBACK`. *Open choice for the founder:* hard-block the tag (the §12-faithful default) vs. warn-and-require-acknowledgment (softer, honoring the dissent). The proposal defaults to hard-block; the founder may dial to warn.

**If ratified, the change set is:** a short GOVERNANCE §14 · the **event-fired trigger** in the verify-gate (release-tag + review/postmortem detection → require an OS-feedback triage, fail-closed) · one line in Write-back · one line in the context-hygiene pass · a triage section in `production-readiness-review` + the postmortem/compatibility templates · the `os_candidate` flag convention · the derived non-blocking surfacer · the no-backflow lint beside `check-os-drift.mjs`. **No new store, no new agent, no parallel review track.**
