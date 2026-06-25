# The Operating Loop

```
Implement → Commit (hash) → Independent QA → Domain Review → Documentation → Status → Write-back → Continue
```

## Delivery unit: the vertical slice
- **One vertical slice per PR** — small enough to review in one sitting, **demonstrable end-to-end** (e.g. capture → store → display). Always leaves QA something to exercise.
- **Deterministic-spine-first.** When a system has a deterministic core (scoring, money math, state machine) and a probabilistic/AI or integration layer, **prove the deterministic spine in isolation first** (no AI, no third party), then layer the rest on the *unchanged* spine.
- **No empty speculative folders.** Build only what the slice needs; earn structure when a slice requires it.

## Efficiency without weakening verification (v5)
v5's efficiency moves attack the per-slice double-verify token cost (recorded N20) **without moving the
author≠verifier / verify-gate line** — every item below either points to a kernel mechanism or fails closed.
- **Ground (cross-system slices) — read-canonical-first.** Before *Implement* on any cross-system producer/consumer surface, read the canonical contract + the consumer's actual code + the source of truth and record the shape you build to (Governance §15 *read-canonical-first* — the canonical home; `contract-grounding` skill = the HOW; DoD cross-system row = the check). *A contract existing ≠ a contract read.*
- **Deterministic / direct-edit tier (A1).** Mechanical edits — pure rename/move, formatting, comment/doc text, and codemods whose **full diff a human reads** — are done directly, no subagent. The instant an edit changes runtime behavior, a contract, a schema, a query, money/auth/PII logic, or a **test pin**, it is **not** mechanical → the normal build+verify path. **Excluded from the direct tier (keep a verifier):** `.claude/.verify-config.json`, `.claude/settings.json`, the gate/hook scripts, CODEOWNERS, and multi-file codemods (kernel-adjacent or scope-broad). The verify-gate fires on implementation files regardless; **A1 never suppresses it.**
- **Risk-scaled + parallel verification (A2).** Scale *who/how-much* verification by risk class per the DoD **"Lightweight vs full"** rubric — **add rigor above the gate floor, never subtract below it** (a slice that changes impl files always yields a fresh independent VERIFY; down-classification is second-lens-confirmed + fail-closed). Independent verifications may be **batched into one message** (de-Rufloed "1 message = all related ops") — but each is a **distinct, non-author, non-anchored** invocation (§3/§11/§12). Aggregate load-bearing surface ⇒ full pass regardless of sub-slice labels.
- **Token-cost telemetry (A3).** A **read-only** per-slice/role/verification cost note, registered in the cadenced **instruments-audit** beat so it fails honestly if it stops being written. It is **never** a gate / DoD / `verify_status` input — "cheaper" is not an acceptance criterion; cost may steer A1/A2 *classification*, never *whether* a required independent pass runs.

## Status vocabulary (anti "premature done") — derived, never self-asserted
Each slice carries `verify_status: planned → generated → executed → verified` (Governance §12, full table in `DEFINITION-OF-DONE.md`). **Honest wording (v4):** the verify-gate **checks that a fresh, passing, independence-claimed VERIFY artifact exists and re-executes one machine-readable probe from it** — it does not (cannot) recompute the whole verification, and it cannot prove the verification was truthful (§12 Honest limit). The earlier claim that status is "computed from evidence" overstated the mechanism — the OS's description of its own enforcement had drifted, which is exactly the defect class this document polices. The role assertions ride on it:

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
- **Route the specialist, don't default to general-purpose (canonical-SDLC).** Before spawning any agent for SDLC work (build · verify · review · deploy · release · ci · cleanup), run `node .claude/os/tools/dispatch-route.mjs "<task>" --work-type <wt>` (or `scripts/ownership-gate.mjs "<task>"`) and spawn the **reconciled owner** with the emitted `spawnPrompt`. Defaulting to general-purpose/`claude` for routable work is a **routing miss** — `dispatch-route --conformance` measures adherence and fails closed. Owners are policy-pinned in `scripts/ownership-gate.mjs` (verify→qa-test · review→reviewer-critic · deploy/release→deployment-operator · cleanup→software-engineer · …). G9 holds: the engine never spawns — the main loop does, after routing.

## Knowledge cadence — the Write-back step (v4: three-tier memory)
The loop does not end at "Status." Before **Continue**, route what the slice taught the system to its **one** durable home — so the knowledge layer stays true instead of rotting. This is **routing, not a new store** (one source of truth per concern, Governance §7). Memory is **three tiers** — *portfolio doctrine* (noun-free, travels to every future project) / *project memory* (nouns stay local) / *state* (**never stored, always derived**):

| What you learned | Lands in (its single home) |
|---|---|
| Agent cross-session continuity | `memory/MEMORY.md` (the inbox/WAL — **derived, never authority**) |
| A noun-free lesson every project should inherit | `memory/doctrine/` (the portfolio doctrine tier, seeded at scaffold from `templates/memory/doctrine-seed.md`) — each entry cites its earning case study; promotion to the base routes via §14 |
| Durable project-local understanding (carries a project noun) | `memory/<project>/` (project memory) or the owning `docs/` file — *the wiki layer is retired (founder ruling F6; zero pages across two projects, 57+ slices — see `case-studies/2026-06-wiki-citation-survival.md`)* |
| A project decision | the `DECISIONS.md` ledger entry (+ an ADR or proposal+signature body — both dialects valid, F3) |
| **A cross-project decision / ownership change** | an **ECR** in the ecosystem layer + the affected registry — **never a project file** |
| A reusable technique that got better | bump the **Skill** `version` (+ `## Changelog` line) — **bump-or-declare-no-learning**: the learning-review forces each used skill to either bump or record "no learning" (every skill in three repos sat at 1.0.0 after the heaviest procedure month on record) |
| A canonical fact changed | update the canonical doc, then refresh the `CLAUDE.md` pointer (derived sections re-render; hand-editing them is a lint failure) |
| **A maybe-framework lesson** (would help *every* project, not just this one) | flag `os_candidate: true` on the record; it is triaged at the next §14 trigger (review-artifact / N-merges / release) — *not assumed to become a skill* |

**Memory is the universal inbox, never the final home** — the write-back step empties it into the correct durable store and leaves a one-line pointer. **State is never written into memory** — anything that can go stale (phase, shipped capabilities, peer status) is derived at read. Where a project has no CI, hygiene is a manual checklist item — honest, not hidden.

## Standing beats (v4 — scheduled, never discretionary)
- **Friction intake** — the friction log is **the sole intake from founder reality** (the one mechanism in the record with a zero-wrong-answer record); every founder complaint or operating observation becomes a triaged row (`friction-triage` skill), including founder *strategy* reports. A **missed skill/hook fire is logged here as a defect** and root-caused like any founder-reported defect.
- **Cadenced instruments-audit** — a SCHEDULED read-only audit of live data vs measurement claims (`instruments-audit` skill), per milestone, never founder discretion. Earned: a mis-stamped version column, a dormant capture at 296/298 pending, destroyed bodies, and 47% unscored events were all invisible to QA, the gate, and every panel — found only by one founder-improvised audit. *"Capture everything" had shipped; "verify the instruments" was the missing half of the loop.*
- **Audit-before-assume** — any plan that gates on a **peer repo's** state carries a same-day read-only audit citation (`cross-system-reality-audit` skill + the session-start sibling probe). Never plan against a registry's or router's claim about a sibling (incident 5: days planned behind a gate that was already open).
- **Operating begins at a named cutover** — a project declares the moment it goes from building to operating; that declaration fires the production-readiness decision class (Governance §11). Drifting into operation is how readiness machinery silently never runs.
- **Slice batching guidance** — under launch pressure, batch micro-slices into verifiable units of ~half a day. Three same-day single-purpose verifications taught: the gate is right; slicing too fine just multiplies ceremony.

## The verify-gate (mechanical — Governance §12)
The loop's status transitions are not honor-system. A scaffolder-installed `.claude/settings.json` hook fires **without the builder choosing to**: it blocks `git commit`/`git push` (`PreToolUse`) and turn-end (`Stop`) whenever implementation files (`src/ app/ lib/ api/ migrations/ db/`) changed without a **fresh, passing, independent** `docs/verify/VERIFY-<slice>.md`, and warns on each implementation write (`PostToolUse`). A committed `.githooks/pre-push` backstops it for any git client. v4 additions: the gate **re-executes the artifact's `machine_probe`** when one is declared, **polices the author/QA write boundary into `tests/`**, and carries the **§14 review-artifact detector + N-merges backstop**. This is what converts "ready for QA → verified" from a remembered step into a system behavior — within the honest limit stated in §12.

**Merging is also mechanical:** the only sanctioned merge path is the **merge gate** (`templates/tools/merge-pr.mjs`) — it reads the checks API machine-readably and hard-fails on anything but explicit all-green, with **no override flag**. Never parse piped/watched CI output for a gate decision (the recorded incident: a pipe swallowed a red CI status and the merge ran anyway).

## Irreversible-action gate
Merges **and** outward/irreversible business actions (sending, charging, publishing, migrating, deleting) require **explicit human approval**. Automated/AI agents **draft**, they do not act. (See `core/GOVERNANCE.md`.)
These gates are **founder boundaries** (Governance §16): a `/goal` runs autonomously up to one, then **terminates with a Founder Action Package and the `/goal resume` command — it never waits/polls/idles at the gate.** Reaching a boundary is the autonomous segment *succeeding*, not stalling. Contract: `capabilities/GOAL-EXECUTION-CONTRACT.md`.

## Where the gates attach (by surface)
- UI-affecting → design-parity / accessibility review.
- Public surface → SEO/indexability review.
- Auth / money / signatures / PII → security-&-compliance review.
- Runtime AI agents → **evals** + determinism + agent-run audit.
- Data/schema → reversible-migration + applies-clean check.
- **Consequential decision** (architectural / migration / production-readiness / security-sensitive / data-sensitive) → **independent multi-agent decision review before any recommendation** — role lenses work blind, disagreements are surfaced, then consolidated (Governance §11). No single agent concludes alone.

Which gates are active is set by the project's **domain pack(s)**.
