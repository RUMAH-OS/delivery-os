# The Operating Loop

```
Implement → Commit (hash) → Independent QA → Domain Review → Documentation → Status → Write-back → Continue
```

## Delivery unit: the vertical slice
- **One vertical slice per PR** — small enough to review in one sitting, **demonstrable end-to-end** (e.g. capture → store → display). Always leaves QA something to exercise.
- **Deterministic-spine-first.** When a system has a deterministic core (scoring, money math, state machine) and a probabilistic/AI or integration layer, **prove the deterministic spine in isolation first** (no AI, no third party), then layer the rest on the *unchanged* spine.
- **No empty speculative folders.** Build only what the slice needs; earn structure when a slice requires it.

## Status vocabulary (anti "premature done") — derived, never self-asserted
Each slice carries `verify_status: planned → generated → executed → verified`, **computed by the verify-gate from evidence** (Governance §12, full table in `DEFINITION-OF-DONE.md`). The role assertions ride on it:

| Who | May assert | Caps the slice at |
|---|---|---|
| Software Engineer | **"ready for QA"** — never "done" | `generated` (code exists) / `executed` (it ran) |
| QA / Test (≠ author) | **"verified"** — the only role that can, and only with a fresh passing `VERIFY-<slice>.md` | `verified` |
| Merge (human) | **"done"** — only a merge makes it done | done |

**`generated` ≠ `executed` ≠ `verified`.** A scaffold that compiles is `generated`; code that *ran* with captured output is `executed`; only an independent lens confirming acceptance on the slice's **real surface** earns `verified`. The builder may not report "done" while the derived status is below `verified`.

## The roles in the loop
`implement (Engineer) → validate (QA, owns tests/evals) → conformance + simplicity + scope (Reviewer/Critic) → stakeholder acceptance (human) → merge (human)`
- **Author ≠ verifier**, enforced by file ownership (see `agents/README.md`).
- **Defects flow author-ward** — QA/Reviewer report; only the author fixes. No grader patches the work it grades.

## Knowledge cadence — the Write-back step (v3)
The loop does not end at "Status." Before **Continue**, route what the slice taught the system to its **one** durable home — so the knowledge layer stays true instead of rotting. This is **routing, not a new store** (one source of truth per concern, Governance §7).

| What you learned | Lands in (its single home) |
|---|---|
| Agent cross-session continuity | `memory/MEMORY.md` (the inbox/WAL — **derived, never authority**) |
| Durable project-local understanding (narrative, learnings, market, customer, process) | `wiki/` (the right page; + a line in `wiki/learnings/`) |
| A project decision | `docs/adr/` (an ADR) |
| **A cross-project decision / ownership change** | an **ECR** in the ecosystem layer + the affected registry — **never a project file** |
| A reusable technique that got better | bump the **Skill** `version` (+ `## Changelog` line) |
| A canonical fact changed | update the canonical doc, then refresh the `CLAUDE.md` pointer + `last_verified` |
| **A maybe-framework lesson** (would help *every* project, not just this one) | flag `os_candidate: true` on the record; it is triaged at the next release/review (OS Feedback Loop, **Governance §14**) — *not assumed to become a skill* |

**Memory is the universal inbox, never the final home** — the write-back step empties it into the correct durable store and leaves a one-line pointer. **Cross-project facts never land in the wiki.** Freshness is visible, not silent: a wiki page past its `last_verified` cadence is flagged `stability: stale` and surfaces in the periodic **context-hygiene** pass (a milestone-boundary review that re-confirms `source_of_truth:` pointers resolve, harvests `learnings/` into stable pages/Skills, re-checks staleness, **and sweeps open `os_candidate` flags to triage them (§14)**). Where a project has no CI, hygiene is a manual checklist item — honest, not hidden.

## The verify-gate (mechanical — Governance §12)
The loop's status transitions are not honor-system. A scaffolder-installed `.claude/settings.json` hook fires **without the builder choosing to**: it blocks `git commit`/`git push` (`PreToolUse`) and turn-end (`Stop`) whenever implementation files (`src/ app/ lib/ api/ migrations/ db/`) changed without a **fresh, passing, independent** `docs/verify/VERIFY-<slice>.md`, and warns on each implementation write (`PostToolUse`). A committed `.githooks/pre-push` backstops it for any git client. This is what converts "ready for QA → verified" from a remembered step into a system behavior.

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
