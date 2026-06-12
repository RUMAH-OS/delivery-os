---
name: friction-triage
version: 1.0.0
stability: stable
description: >
  Convert a verbatim founder report (complaint, observation, or strategy note) into a classified,
  root-caused defect with fix lineage and founder-gated closure in docs/friction-log.md. Invoke on ANY
  founder complaint or operating observation, on any missed skill/hook fire, or via /friction.
decision_class: governance
inputs:  [the founder report VERBATIM, docs/friction-log.md]
outputs: [a friction-log entry (F/W/U classified, root-caused, fix-lineage linked, founder-gated closure)]
earned_from: "Consumer P's friction log: the SOLE intake from founder reality, and the one mechanism in the whole record with a zero-wrong-answer record — defects #8–#11 each converted a founder complaint into shipped structure same-day, and one log entry out-judged 13 blind panel lens-runs on a daily-experience question. The sibling consumer lacked the mechanism entirely (cross-pollination gap, now closed at base)."
mechanical_spine: "/friction command; docs/friction-log.md is a scaffolder-instantiated day-1 registry; the missed-fire-is-a-defect rule routes OS misfires here"
---
# Friction Triage

## Overview
Founder reality outranks panel consensus on behavioral questions — but only if it is captured verbatim and
triaged to root cause. This skill is the procedure behind the friction log's zero-wrong-answer record.

## When to use (and NOT)
- Use when: the founder reports ANYTHING about operating the system (friction, wrongness, a wish, a strategy
  observation); a skill/hook should have fired and didn't (the missed-fire rule).
- **NOT** for: defects QA found (normal bug flow, author-ward); feature requests from non-operating sources.

## Process
1. **Capture VERBATIM first** — the founder's words, unparaphrased, into `docs/friction-log.md`. Interpretation
   at intake destroys the signal the log exists to carry.
2. **Classify**: **F** (friction — works but costs) · **W** (wrong — behaves incorrectly) · **U** (unmet — capability missing).
3. **Four diagnostics**: what surface · what expectation · what actually happened · what evidence.
4. **Root cause, not symptom** — name the cause class (unmechanized gate / stale state / scope gap / environment),
   not the surface that showed it.
5. **Fix lineage**: link the slice/PR that fixes it, or a dated, signed decision not to fix.
6. **Founder-gated closure**: the entry closes only when the founder confirms (date + word). A fix the founder
   hasn't felt is not closed.
7. **Supersession annex**: if the fix changes a doctrine/spec, the write-back rule applies (DoD row 7).

## Red flags
- A paraphrased intake ("founder wants X" instead of the words).
- Closure by the fixer ("shipped, closing") without the founder's confirmation.
- Strategy reports filtered out as "not defects" — they are intake too.
- A missed hook/skill fire shrugged off instead of logged (it is the rollback signal for the retrieval model).

## Verification (of this skill's own output)
- The entry quotes the founder verbatim; class + root cause + lineage fields are filled.
- Closure shows a founder confirmation, not an implementer assertion.

## Changelog
- 1.0.0 — promoted from consumer P's harvested skill + log format (#76 §8.1); day-1 log file ships via the scaffolder (T4).
