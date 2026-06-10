---
name: grill-me
version: 0.1.0
stability: experimental
description: >
  Adversarial, deep follow-up interview that pushes each load-bearing field of
  BRIEF/MISSION/NORTH-STAR to a measured confidence threshold (or an honest TBD).
  Invoke after discovery-interview when answers feel vague, or when the founder wants depth.
decision_class: none
required_lenses: [reviewer-critic]   # the blind skeptic that grades answer quality (author != verifier on elicitation)
inputs:  [the in-progress docs/PROJECT-BRIEF.md, PROJECT-MISSION.md, NORTH-STAR.md, the founder (live)]
outputs: [hardened BRIEF/MISSION/NORTH-STAR, a Confidence Ledger appended to each]
---
# Grill-Me  *(experimental — thresholds need calibration on ≥3 real projects)*

Extends `discovery-interview` with an adversarial loop. It produces **no new doc types** — it hardens the three discovery docs and attaches a **Confidence Ledger** the gate reads.

## What is measured — the Confidence Ledger (0–3 per load-bearing field)
Fields (from `FOUNDER-INTERVIEW.md` Q1–Q16): audience · problem/status-quo · success metric · non-goals · boundaries (owns vs consumes) · invariant.
`0` absent · `1` vague · `2` specific · `3` specific + falsifiable/evidenced.

## Stop condition (the thresholds — bounded, terminating)
- **Pass:** every mission-critical field ≥ **2**, mean ≥ **2.3**, zero boundary/source-of-truth conflicts, and every remaining `TBD` *classified* (founder genuinely doesn't know — acceptable — vs not-yet-pushed — must push).
- **Per-field cap:** max **3** adversarial follow-ups; still < 2 → record a hard `TBD — to confirm` ("pushed 3×, unresolved"). **Honest failure, not infinite loop.**
- **Global cap:** ≤ ~40 follow-ups or founder says stop → emit a partial ledger flagged `below-threshold` rather than blocking.

## Procedure (per field, score 0–3)
```
while score < 2 and pushes < 3:
  Interviewer asks the targeted follow-up (escalate FOUNDER-INTERVIEW "probe weak answers")
  Reviewer/Critic (BLIND skeptic) attacks: falsifiable? what's the number? what do they do TODAY?
                                           name one real instance? conflicts with an owned entity?
  re-score; pushes++
record final score + verbatim answer in the Ledger
```

## Output → the docs
Raise field confidence; convert soft `TBD`s to hard answers or *classified* honest unknowns; append the Ledger to each doc. The discovery gate gains a row: *grill-me confidence ≥ threshold OR every below-threshold field founder-acknowledged.* Skipping grill-me is allowed but shows as "confidence: ungated."

## Honest failure
Never fake confidence. A below-threshold field is reported as such, not smoothed into a green.

## Changelog
- 0.1.0 — new. The confidence-ledger loop is the one genuinely new v3 capability; thresholds provisional.
