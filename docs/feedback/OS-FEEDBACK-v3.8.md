---
event: "release tag v3.8"
date: "2026-06-11"
triaged_by: "orchestrator-build-session (framework self-release)"
---

# OS Feedback Triage — v3.8 (the OS Feedback Loop itself)

> The first triage, fired by the first release that requires one. Recursive by design: building the loop produced lessons about the loop.

## 1. Were any framework-level lessons discovered this cycle?
Yes — three, all already incorporated:
- **The loop's own trigger was memory-dependent in its first draft.** The revised proposal rode the triage on a model-dispatched skill + a human-run hygiene pass — so the OS would have learned only when someone remembered. Lesson: *a trigger must be a mechanism, not a convention riding a discretionary touchpoint.* → fixed (the release-tag hard-block).
- **The no-backflow guardrail was a hope, not a control** — and on its first run the new lint caught a real backflow (a project noun in `check-os-drift.mjs`'s comment). Lesson: *a guardrail that depends on the author writing neutrally is discipline; mechanize it.* → fixed (`scripts/check-no-backflow.mjs`, exit-1).
- **An allowlist trigger can under-fire just as an allowlist impl-surface can** (the v3.6 `apps/**` lesson, re-confirmed): the release trigger fires on tags (releases) but review/postmortem events rely on templates carrying the triage section — a known bound, documented, not silent.

## 2. Are there any OS Candidates?
None open. All three lessons above were promoted this cycle (the loop's creation absorbed them).

## 3. Routing
| Lesson | Layer | Why | Destination |
|---|---|---|---|
| Trigger must be mechanical | Delivery OS | every project; no project noun; counterfactual cites a recorded review finding | GOVERNANCE §14 + the release-tag gate in `verify-gate.mjs` |
| No-backflow must be mechanized | Delivery OS | every project; recorded failure (the lint's own first hit) | `scripts/check-no-backflow.mjs` (a **lint**, not a skill) |
| Allowlist triggers under-fire | Delivery OS | generalizes the v3.6 finding | documented bound in §14 + the template-carried review-event triage |

## 4. Promotions
All three landed via this release (each reviewed in the 4-lens Principle-11 panel recorded in `proposals/DELIVERY-OS-OS-FEEDBACK-LOOP.md`). Note the routing: one became **doctrine** (§14), one became a **lint**, one became a **documented bound** — **none became a skill.** That is the §14 clarification working: the right lesson in the right place.
