# Slice <id> — <title>

- **Phase:** <n> · **Size:** S | M | L · **Depends on:** <ids / —>
- **Authority:** <the ratifying proposal / DECISIONS.md row / panel verdict this slice executes — a slice without an authority pointer is freelancing>
- **Signatures:** <founder/owner sign-off where the authority requires one; date + verbatim verdict>

## Objective (end-to-end, demonstrable)
<the one outcome this slice delivers, exercisable by QA — e.g. "capture → store → display">

## Scope
- In: <…>
- **Exclusions (binding):** <what this slice explicitly does NOT do — the Reviewer/Critic rejects anything beyond In; QA does not fail the slice for an Exclusion>

## Invariants touched
<INVARIANTS.md entry IDs this slice's changes brush against — each keeps its scan green; a new invariant ⇒ a new registry entry + scan in this PR>

## Pre-registered reversal (behavioral surfaces)
<If this slice ships a behavior/placement/UX bet: name NOW what observation reverses it and what the one-change
reversal is. Earned: three recorded pivots each cost one mount change because the reversal was pre-registered —
panels lock invariants + reversals only; the operating record settles behavior.>  *(or "n/a — no behavioral bet")*

## Founder acts / credentials needed
<every credential, account, DNS, console click, or approval this slice needs from a human — named at spec time,
requested day one (the long pole). "none" is a valid, explicit answer.>

## Deliverables
- <code / endpoint / page / migration / agent + eval>

## Acceptance criteria (QA-owned; independent of the builder's tests)
1. <observable, testable> 2. <…> 3. <determinism / grounding / security where relevant>

## Done-ness
Per `core/DEFINITION-OF-DONE.md` (the rows are enforced by the verify-gate, the merge gate, and the write-back
gate — they are not restated here as checkboxes; dead checkboxes train skimming).
Engineer asserts **"ready for QA"**; only the independent verifier asserts **"verified"**; only a merge **via the
merge gate** makes it done.

## Notes / risks / de-risk
<deps, deterministic-spine-first ordering, audit-before-assume citations for any cross-repo gate>
