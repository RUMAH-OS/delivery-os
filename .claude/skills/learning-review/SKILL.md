---
name: learning-review
version: 2.0.0
stability: stable
description: >
  MANDATORY post-milestone review that converts experience into CAPABILITY, not prose. Reconstructs the
  milestone from artifacts, answers the founder questions honestly, and FEEDS the capability ledger
  (every lesson → a skill/agent/gate/automation candidate; every capability that FAILED to catch
  something → a strengthened capability). A milestone is not closed until this has run and fed the ledger.
kind: execution
capabilities: [post-milestone-learning-review, convert-lesson-to-capability, feed-capability-ledger, anti-decay-capability-strengthening, assumptions-ledger, post-failure-review]
triggers: [run the post-milestone learning review, what did we learn this milestone, which founder pains repeated, which capability failed to catch this, convert lessons into capabilities, close out the milestone retro]
decision_class: governance
class: OS-foundational
inputs:  [the milestone's commits, VERIFY docs (incl. FAIL sections), decision records, founder-experience reports, permission-refusal moments, the founder's own pain reports]
outputs: [docs/RETROSPECTIVE-<date>.md + appended rows in capabilities/CAPABILITY-LEDGER.md + implemented OS/skill/gate changes in the same commit series]
earned_from: "Admin rebuild retro 2026-06-12 (7 skills) + the v6 founder mandate 2026-06-14 (make every lesson a capability and every proven capability part of the OS)"
---
# Learning Review — the feedback engine of the capability chain

**This is the engine that makes future projects harder to break.** A milestone's lessons must leave as
CAPABILITIES (rows advanced in `capabilities/CAPABILITY-LEDGER.md`), never as another memory entry or process
note. MANDATORY: a major milestone is not "closed" until this review has run and fed the ledger.

## When (trigger — not optional)
After EVERY major milestone (a migration, launch, integration, cutover, or a shipped founder-facing capability)
and after any significant failure. Standing, not founder-prompted.

## The founder questions (answer each from artifacts, brutally honest)
1. **What worked?** — name the mechanism, not the virtue.
2. **What failed?** — include the embarrassing ones (wrong adapters, encoding bugs, false assumptions acted on).
3. **Which founder pains repeated?** — a repeat is a capability the OS still lacks.
4. **Which assumptions were wrong?** — proven vs disproven, each with the moment it was tested.
5. **Which capabilities should be created?** — each → a `candidate` row in the ledger (skill/agent/gate/automation).
6. **Which EXISTING capability FAILED to catch something?** — the anti-decay question. If the founder (or anyone)
   discovered an issue a gate/reviewer should have caught, that capability gets a strengthened row + a regression
   case. Coverage only grows. **The founder's discovery rate must trend toward zero.**

## Process
1. **Reconstruct from artifacts, not memory** — walk the commit log, VERIFY docs (incl. FAIL sections), decision
   records, founder-experience reports, and permission-refusal moments. The failures the record preserved are the curriculum.
2. **Pattern census** — workflows/reviews/fixes repeated ≥2× (with counts). Each → a ledger candidate: skill (executes
   better next time), agent responsibility (someone owns it), gate/automation (it should be code), or a practice note (judgment only).
3. **Feed the ledger** — append/advance rows in `capabilities/CAPABILITY-LEDGER.md`: new candidates from Q5,
   strengthened rows from Q6, and advance any capability that reached `verified`/`in-OS`/`propagated` this milestone.
4. **Promotion check** — for each capability that became `verified` and is OS-foundational, is it `in-OS` and on the
   upgrade path so every project inherits it? If not, that promotion is itself a ledger candidate.
5. **IMPLEMENT in the same series** — the highest-leverage candidate is built/started now (earned, never scaffolded;
   every skill cites what it was earned from); kernel/router/gates updated; drift-lint green; committed. A review that changes nothing was a meeting.

## The mandatory gate
A milestone close is BLOCKED until a fresh `docs/RETROSPECTIVE-<date>.md` exists AND the capability ledger has been
fed (≥1 candidate advanced or a justified "no new capability needed, here's why"). Same fail-closed discipline as the
verify-gate — the review is a system behaviour, not a memory exercise.

## Red flags
- Lessons phrased as virtues ("communicate better") instead of mechanisms.
- Skills scaffolded for things done once.
- A capability that failed to catch a founder-discovered issue, left unstrengthened (Q6 skipped).
- The review praising a process the same review's evidence shows was bypassed.
