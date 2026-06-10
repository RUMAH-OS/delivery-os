# The Operating Loop

```
Implement → Commit (hash) → Independent QA → Domain Review → Documentation → Status → Continue
```

## Delivery unit: the vertical slice
- **One vertical slice per PR** — small enough to review in one sitting, **demonstrable end-to-end** (e.g. capture → store → display). Always leaves QA something to exercise.
- **Deterministic-spine-first.** When a system has a deterministic core (scoring, money math, state machine) and a probabilistic/AI or integration layer, **prove the deterministic spine in isolation first** (no AI, no third party), then layer the rest on the *unchanged* spine.
- **No empty speculative folders.** Build only what the slice needs; earn structure when a slice requires it.

## Status vocabulary (anti "premature done")
| Who | May assert |
|---|---|
| Software Engineer | **"ready for QA"** — never "done" |
| QA / Test | **"verified"** — the only role that can |
| Merge (human) | **"done"** — only a merge makes it done |

## The roles in the loop
`implement (Engineer) → validate (QA, owns tests/evals) → conformance + simplicity + scope (Reviewer/Critic) → stakeholder acceptance (human) → merge (human)`
- **Author ≠ verifier**, enforced by file ownership (see `agents/README.md`).
- **Defects flow author-ward** — QA/Reviewer report; only the author fixes. No grader patches the work it grades.

## Irreversible-action gate
Merges **and** outward/irreversible business actions (sending, charging, publishing, migrating, deleting) require **explicit human approval**. Automated/AI agents **draft**, they do not act. (See `core/GOVERNANCE.md`.)

## Where the gates attach (by surface)
- UI-affecting → design-parity / accessibility review.
- Public surface → SEO/indexability review.
- Auth / money / signatures / PII → security-&-compliance review.
- Runtime AI agents → **evals** + determinism + agent-run audit.
- Data/schema → reversible-migration + applies-clean check.
- **Consequential decision** (architectural / migration / production-readiness / security-sensitive / data-sensitive) → **independent multi-agent decision review before any recommendation** — role lenses work blind, disagreements are surfaced, then consolidated (Governance §11). No single agent concludes alone.

Which gates are active is set by the project's **domain pack(s)**.
