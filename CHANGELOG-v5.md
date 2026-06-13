# Delivery OS v5.0 — the efficiency-tightening release

> **A tightening, not an expansion.** v4's mechanism-over-prose core is kept whole; v5 adds the read-canonical-first
> gate + efficiency moves that **never weaken verification**, all earned by observed failures (N17–N22, Company-OS
> phase) and one negative control (Ruflo). Ratified via one consolidated F2 §11 panel
> (`docs/DECISION-REVIEW-2026-06-13-delivery-os-v5-batch.md`, RATIFY-WITH-CONDITIONS; C1–C9 folded).
> Provenance: `case-studies/2026-06-13-company-os-phase.md`. Plan: `docs/DELIVERY-OS-V5-ADOPTION-PLAN.md`.

## Promoted (each cites an observed failure; each preserves every v4 invariant)
- **A4 — read-canonical-first / contract-grounding** *(keystone, N18).* New Governance §15 clause "a contract
  existing ≠ a contract read" (THE canonical home); an OPERATING-LOOP **Ground** step (cross-system slices) +
  the new `skills/contract-grounding/` (the HOW) + a DoD cross-system check — all **pointers** to the §15 clause
  (§7 one-home; C3). Hook deferred until an observed skip earns it (§12/§13 pattern).
- **A2 — risk-scaled + parallel verification** *(N20).* The DoD "Lightweight vs full" clause is generalized into a
  risk-scaled rubric that **adds rigor above the gate floor, never subtracts below it** (C1 blocker, folded):
  a trivial slice still yields a fresh independent VERIFY; down-classification is second-lens-confirmed +
  fail-closed (contested ⇒ full); `tests/` retains author≠verifier; parallel verifiers stay distinct + blind;
  composition floor for A1+A2+batching seams (C7).
- **A1 — deterministic / direct-edit tier** *(N20).* OPERATING-LOOP doctrine; "mechanical" defined **closed**
  (rename/move/format/comment/read-in-full codemod); kernel-adjacent files + multi-file codemods **excluded**
  (C2). The gate fires on impl files regardless; A1 never suppresses it.
- **A3 — token/cost telemetry** *(N20).* Read-only per-slice/role/verification cost note, registered in the
  instruments-audit cadence; **never** a gate/DoD/`verify_status` input — "cheaper" is not an acceptance
  criterion (C5). *Design-first; mechanized lightly in Phase-1.*
- **A6 — test-fixture hygiene** *(N21).* New `checklists/test-hygiene.md` (tag-scoped teardown + cap-independent
  count-delta + run-unique tokens + CI parity) + the clean-VERIFY-frontmatter rule. The gate-parser tolerance
  (strip a trailing `# …`) is a **kernel change** tracked as its own verified slice (C4).
- **BOUNDARY-first** *(N22).* Governance §15: write the producer/consumer ownership boundary before building
  across it; judge by "does this help the consumer understand and operate?"
- **REPRO + checked-in guard** *(N17).* Governance §15 (extends §1): reproduce prod bugs on the running thing
  under realistic load; leave a regression guard. Folds into the deploy/cutover skills (versioned, Phase-1).

## Rejected + recorded (Ruflo anti-patterns — never re-litigated)
Ruflo package/agent-core (audit: non-functional) · federation/consensus/trust/PII-pipeline (no such trust
boundary) · surface-area scaling (inverts earned-never-scaffolded) · SONA/opaque self-optimization · witness-
manifest-as-work-verification (conflates integrity with correctness; rejecting it *defends* §12) · uncurated
auto-recall vector memory (injects token noise). Ruflo stands in the record as the **negative control** that
validated earned-never-scaffolded + author≠verifier.

## Invariants UNCHANGED (the never-weaken list — re-asserted)
Author≠verifier (§3) · verify-gate driving the running thing (§12, rubric-blind) · §11 consequential-review ·
§14 OS-feedback + promotion bar · §13 mechanism/policy split · §15 mechanism-over-prose · earned-never-scaffolded ·
git-as-substrate · no-backflow + drift lints · irreversible-action human gate · gestured-pull default. No v5 change
removed or weakened any of these (the one risky candidate, A2, became *stronger* — fail-closed — than its prose form).

## Adoption (F1 / pin)
The base mints v5.0 (this changelog + tag + the §14 trigger). Consumers adopt by **pin** (`.claude/.verify-config.json
os_version`) at named moments — never auto. Rollback = stay on the v4 pin + doc-revert (no kernel mechanism removed).

## Phasing & remaining
- **Landed (Phase-0, doctrine/skills/checklist):** A4, A2-rubric, A1, A6-policy, BOUNDARY, REPRO-doctrine + this changelog.
- **v5.0 tag: MINTED** (2026-06-13, founder-authorized documented bypass — see the tag-push lesson below).
- **Finishing (Phase-1, tracked):** the A6 gate-parser tolerance (C4, kernel change → own verified slice); the A3
  cost instrument (light tool); skill version-bumps for `deploy-vercel-supabase`/`cutover-execution`/`verification`
  (REPRO/A2/A6 skill halves); **K-GATE-TAG — fix verify-gate tag-push handling** (kernel slice, own verify);
  per-consumer pins.

## v5-mint lesson (new — earned during this release; the gate found a gap in itself)
**K-GATE-TAG — the verify-gate does not cleanly handle release-TAG pushes.** A tag push carries **no new commits**,
so the gate's "is there a verified VERIFY *in this push*?" check cannot see the verified release artifact that is
already on `main` (the commit the tag points to). v5.0's already-verified release (`VERIFY-delivery-os-v5-release`,
10/10, on `main`) was blocked from tagging; minted via the **documented, logged `DELIVERY_OS_GATE_BYPASS`** with
founder merge-gate authorization (the bypass reduced no discipline — the verification existed; it skipped a check
that could not see it). **Fix (Phase-1 kernel slice):** make the pre-push gate, on a tag push, look at the tag's
**target commit's tree** for a fresh verified `docs/verify/VERIFY-*.md` (a release-class VERIFY) rather than only
the commits "in the push" — so future releases tag without a bypass. Earned-from: the v5.0 mint. Until fixed, a
release tag uses the logged bypass with human merge-gate authorization (a stop-condition decision, never an agent's
unilateral call).
- **A5 (engineer→verifier handoff): DEFERRED** to Phase-1 with rationale (C6) — carried, not dropped; see the
  adoption plan's deferred ledger.
