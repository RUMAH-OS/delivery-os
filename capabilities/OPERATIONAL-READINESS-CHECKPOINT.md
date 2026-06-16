# Operational Readiness Checkpoint — a standing Founder-OS review gate (canonical, inheritable)

> Founder-OS / Delivery-OS capability. **Canonical source = delivery-os** (apps inherit via os-inherit; do
> NOT fork). This is a MANDATORY checkpoint, run at TWO moments: (a) before relying on / declaring complete a
> capability, and (b) before OPENING A NEW FRONTIER on top of it. It exists because two systems once concluded
> "the next frontier is X" from BUILD status, not OPERATIONAL status — the exact error this gate prevents
> (`OPERATIONAL-READINESS-ASSESSMENT-2026-06-16.md`).
>
> The governing standard (V6-LANDED-DEFINITION.md, founder-locked): **a capability is NOT complete because it
> EXISTS.** Build → Proved → Reachable → Continuable → Founder-verifiable → **Used successfully in a real
> workflow, observably, on real production data.** "Built / verified / shipped-to-dev" is the *Built* column
> only — never the *done* column.

## When this checkpoint is MANDATORY
1. **Frontier-opening.** Before declaring "the next bottleneck / next frontier is X," assert that the substrate
   X depends on is OPERATIONALLY proven (not merely built). Do NOT stack a frontier on an unvalidated base.
2. **Milestone / "declare complete."** Before reporting a capability done or relying on it in a real workflow,
   run every column below. A red column means NOT done — regardless of slice-PASS, test-DB green, or dev ship.

## The checkpoint — assert EACH column, per capability (honest: Y / partial / N / UNMEASURED)

| # | Column | The assertion (what makes it GREEN) | Anchor KU |
|---|---|---|---|
| 1 | **Built** | Code exists, tests pass, the slice gate is green. | — |
| 2 | **Operationally Used (prod, real data)** | A real user/founder workflow has RUN this in production on real data, and the run is OBSERVABLE (re-findable record). A gate is not real use; dev-ship is not use; a test-DB verify is not use. | [[ku-implemented-is-not-operationally-proven]] |
| 3 | **Founder Workflow Validated** | A real founder workflow completed end-to-end through this — reachable, continuable (a next step, no dead-end), and the recorded STATE reflects what actually happened (no "marked sent" when nothing left the system). | [[ku-record-only-state-the-action-achieved]] |
| 4 | **Ownership Validated** | The correct specialist actually OWNED the build (routed + measured by the change's diff, not lifetime file weight); not silently collapsed to the general builder/orchestrator. | [[ku-attribute-contribution-by-commit-diff-not-lifetime]] · [[ku-specialist-ownership-requires-enforcement]] |
| 5 | **Failure Modes Reviewed** | Failure paths examined. If the change touches money / a legally-binding artifact / PII / a data-integrity invariant, an INDEPENDENT security-compliance review signed off, and any sensitive audit trail is append-only ENFORCED at the DB. | [[ku-sensitive-changes-require-security-review]] · [[ku-sensitive-audit-append-only-at-the-db]] |
| 6 | **Delivery-OS Updated** | The lesson/decision is captured in canonical Delivery-OS (capability doc / ADR), not left as session prose. | — |
| 7 | **Skill Extracted** | If the work prescribes a repeatable procedure that recurs, a skill was earned (or a Knowledge→Skill promotion proposed) — not re-discovered next time. | — |
| 8 | **Canon / Wiki Updated** | The non-obvious lesson is a retrievable KU (frontmatter contract, cited@hash, routable by `knowledge-route`, measured by `knowledge-health`) — not homeless prose. | [[ku-injection-is-not-adoption]] |
| 9 | **Ready to Rely On** | ALL of the above hold. Only then may the capability be relied upon / declared complete / built upon. | — |

## Classification step (capture-only — Founder OS Migration Principle)
When a capability is reviewed, also CLASSIFY each of its artifacts into the 6 Founder-OS buckets and RECORD
where it should live. This is capture-only: deciding the bucket happens now; the physical move stays gated and
gradual (→ `FOUNDER-OS-MIGRATION-PRINCIPLE.md` — classify, don't delete; no big-bang). Do NOT create new
per-project markdown collections — author shared intelligence toward its bucket.

| Artifact is… | Target bucket |
|---|---|
| project-specific context | stays in `CLAUDE.md` (per project) |
| reusable knowledge (architecture / decisions / lifecycles / principles / playbooks) | **Wiki** |
| executable behavior (a repeatable procedure: invoicing, onboarding, verification, …) | **Skill** |
| a lifecycle definition (lead / invoice / contract / tenant / payment lifecycle) | **Workflow** |
| monitoring logic (seam / workflow / company health) | **Health** |
| completion logic (completion rules / success criteria / founder-attention models) | **Objective** |

Record the verdict as a short list (artifact → bucket → intended home), even when the target structure does
not yet exist (Workflow / Health / Objective are create-when-first-needed). No artifact is deleted by this step.

## Cross-system seams — one extra mandatory assertion
If the capability is a cross-system seam (API contract / event stream / handoff), column 2 is satisfied ONLY by
**one real producer→drain→consumer round-trip on real data** — NOT by two isolated half-verifies that each
pass, and the shared contract must be single-sourced and bound BOTH ways. → [[ku-verify-seam-by-one-real-round-trip]]

## How to run it
- Produce the per-capability table above (one row per capability under review), each column marked Y / partial /
  N / UNMEASURED with a one-line evidence pointer (the observable prod run, the round-trip, the security
  re-attestation, the KU/skill).
- **Fail-closed:** UNMEASURED is NOT a pass (you cannot prove use you didn't observe). A column you can't
  evidence is red.
- **Author ≠ verifier:** the readiness verdict is independently checked; the builder/orchestrator does not
  self-certify "operationally proven." → [[ku-author-not-equal-verifier]]
- **The frontier rule:** if column 2 (Operationally Used) is red on the substrate, the next frontier is
  OPERATIONAL VALIDATION of that substrate — not a new capability on top of it.

## The anchored Knowledge Units (canonical in delivery-os/wiki, mirrored to app wikis for the proving phase)
- [[ku-implemented-is-not-operationally-proven]] — built/verified/dev-shipped ≠ operationally proven.
- [[ku-verify-seam-by-one-real-round-trip]] — prove a seam by ONE real round-trip, not two half-verifies.
- [[ku-record-only-state-the-action-achieved]] — status must reflect reality; surface honest not-done states.
- [[ku-attribute-contribution-by-commit-diff-not-lifetime]] — attribute by the diff, not lifetime file weight.
- [[ku-sensitive-changes-require-security-review]] — money/legal/PII/integrity → independent security review.
- [[ku-sensitive-audit-append-only-at-the-db]] — sensitive audit trail append-only ENFORCED at the DB (RLS).

## Provenance (promote-AND-preserve)
Earned from the 2026-06-16 Operational Readiness Assessment (`OPERATIONAL-READINESS-ASSESSMENT-2026-06-16.md`)
and the Founder-Experience Audit (`rumah-admin/docs/audit/FOUNDER-EXPERIENCE-AUDIT-2026-06-16.md`), under the
COMPLETENESS PRINCIPLE in `V6-LANDED-DEFINITION.md` and the `FOUNDER-OS-MIGRATION-PRINCIPLE.md` (build shared
intelligence ONCE in Founder OS, apps inherit). Those source docs are preserved, not replaced.

> author ≠ verifier: this checkpoint was DRAFTED by the knowledge-engineer and is queued for independent
> verification; it is not self-certified.
