# Capability Governance Ladder — when may a capability be ENABLED for autonomy?

> Founder-OS canon, recorded 2026-06-17 from the founder's capability-governance directive.
> **Status: ratified-pending** — drafted as canon; the founder holds the merge/ratify gate. DRAFT until ratified.
> Retrievable form: wiki `ku-capability-governance-ladder` + `ku-enable-capabilities-on-trust-not-existence`.

## The principle (headline)

A capability must **NOT** be enabled for autonomous use because it technically *exists* or was *built*. It is
enabled only when it has passed the required validation ladder **AND** has accrued sufficient operational trust.
The governing question is never *"can we build it?"* but *"under what conditions is it trustworthy enough to
enable?"* (see `ku-enable-capabilities-on-trust-not-existence`).

### Founder directive 2026-06-17 — verbatim source quotes

These are the founder's own words from the 2026-06-17 capability-governance directive, recorded here verbatim
as the on-disk source of truth the KUs cite:

- Headline (enable on trust, not existence): "a capability must NOT be enabled because it technically exists; it is enabled only when it has passed the required validation ladder AND has sufficient operational trust"
- The right question: "The right question is never \"can we build it?\" but \"under what conditions is it trustworthy enough to enable?\""
- The ladder: "exists → reachable → validated → observable → trusted → enabled"
- The learning loop: "workflows generate learning → learning becomes knowledge → knowledge becomes capability (the Founder-OS/Jarvis loop)"

## The ladder

Every autonomous capability advances through six ordered rungs, **one rung at a time, only on evidence**.
**Enablement is the LAST rung, gated on operational trust + observability.**

```
exists → reachable → validated → observable → trusted → enabled
```

| Rung | Means | Evidence to advance |
|---|---|---|
| **1. exists** | built; code + tests exist (shape only) | the capability is implemented |
| **2. reachable** | something can actually invoke it through a real surface | a seam/CLI/agent can call it; not dead code |
| **3. validated** | passes its validation ladder | independent verification (author≠verifier); right gates green; correct on its claims |
| **4. observable** | its runs are recorded and re-findable | outcome/events/errors surfaced; you can see it work AND see it fail |
| **5. trusted** | operational trust accrued | run on real data; safeguards ENFORCED (verified approver, audit, idempotency, reversibility); no outstanding critical risk |
| **6. enabled** | turned on for autonomous use | a deliberate gated act, only after 4+5 |

A capability that merely *exists* sits on rung 1 and is **not** eligible for autonomous use, however finished
the code looks. Skipping a rung is how build-convergence masquerades as readiness.

## Distinct from the completeness ladder (do not conflate)

| | Completeness ladder | Capability governance ladder (this doc) |
|---|---|---|
| Question | "is it DONE?" | "may it be ENABLED for autonomy?" |
| Sequence | Build → Proved → Reachable → Continuable → Founder-verifiable → Used | exists → reachable → validated → observable → trusted → enabled |
| Home | `V6-LANDED-DEFINITION.md` (COMPLETENESS PRINCIPLE) | this doc |

The two are orthogonal: a capability can be **complete** (a founder can use it end-to-end by hand) yet **not
enabled** for the platform to run autonomously — completeness does not by itself establish the operational
trust + observability enablement requires. Use completeness to decide *done*; use this ladder to decide *turn
it on for autonomous execution*. Autonomous capabilities run BOTH; the answers can legitimately differ.

## How to use it

1. Place every autonomous capability on a rung, explicitly. "Built" is rung 1, not rung 6.
2. Advance one rung at a time, on named evidence. No evidence → no advance.
3. Treat enablement as a separate, last, deliberate decision — never a side-effect of validating or shipping.
4. For any "can we enable this?" question, answer with the named conditions for the missing rung(s), not "it
   works." Unmet conditions → NOT-YET, and the conditions become the backlog.

## Load-bearing instance

The 2026-06-17 controlled-execution §11 review
(`../../rumah-admin/docs/DECISION-REVIEW-2026-06-17-controlled-execution.md`) returned a unanimous **NOT-YET**
on enabling live execution: the invoke path *existed* and the consumption loop was *validated* + *observable*
(describe-only) but had not reached *trusted* (presence-only `--approve`, sideEffect-honesty declared-not-
enforced, never run on a real intent). Holding at the current rung instead of jumping to *enabled* is exactly
what this ladder makes a principled, repeatable call.

## Provenance

Founder directive 2026-06-17 (capability governance). Companion canon: `V6-LANDED-DEFINITION.md` (completeness
ladder), `HEALTH-FRAMEWORK.md` (the *observable* rung's standing-monitoring discipline). Cross-linked KUs:
`ku-capability-governance-ladder`, `ku-enable-capabilities-on-trust-not-existence`. DRAFT — queued for
independent verification; not self-certified.
