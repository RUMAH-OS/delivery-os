---
review: foundation
date: "2026-06-27"
change: "Infrastructure Platform milestone — config-registry + config-doctor + fail-closed config-gate; health/rollback/post-deploy layer; infra inventory + drift register; A-to-Z e2e verification"
verdict: "STABLE-WITH-FIXES"
lenses: "reviewer-critic (consistency/contradictions) + lead-architect (forward gaps) — worked blind, then consolidated"
---

# Foundation Review — Infrastructure Platform

> Auto-triggered by the Review-Class Trigger (Governance §14 · ADR-003 L2). Question: **are the foundations
> this milestone builds on still internally consistent + still valid?** Two INDEPENDENT lenses worked BLIND
> (reviewer-critic = contradictions/consistency · lead-architect = forward gaps), then consolidated. No single
> agent concludes alone (§11). Constraint: do not redesign unless necessary.

## Foundation set reviewed
The load-bearing foundations this milestone rests on, cross-checked against the just-built reality:
- **ECR-0005** (infrastructure & compute plane strategy — ratified) — the policy this milestone operationalizes.
- The **deploy-vercel-supabase skill doctrine** (pooler rule + single-`DATABASE_URL` convention).
- **The config-registry/config-doctor/config-gate** built this milestone (delivery-os #15 / PLOS #201 / Admin #17).
- The **health/rollback/post-deploy-verify** self-healing layer (#16/#202/#18).
- The **infra inventory + drift register** (`docs/audits/INFRASTRUCTURE-INVENTORY-2026-06-27.md`).
- The **A-to-Z e2e verification** (`docs/verify/E2E-WORKFLOW-VERIFICATION-2026-06-27.md`) — independent QA.
- The **verify-gate / review-class trigger** (the floor that gated this milestone's merges + secrets).

## VERDICT: STABLE-WITH-FIXES

- **Consistency (reviewer-critic):** The foundations are internally COHERENT, with two recorded
  contradictions that the milestone correctly handles by RECORDING rather than smoothing (Principle 11 —
  surface disagreements, never smooth them):
  - The **pooler inversion** (Admin session-`:5432` vs PLOS transaction-`:6543`) is a real contradiction with
    ECR-0005 ("never port 5432"). It is NOT an error — both choices are workload-correct, each earned from a
    production 503. Resolution: record per-app with rationale + amend ECR-0005 for Admin's exception. This is
    the right move; forcing uniformity would re-break one app. **Additive (ECR amendment), not a redesign.**
  - **BUG-4** is a genuine consistency defect: `main` advertises `config-doctor.mjs` (remediation strings +
    runbook) while the file lives only on an unmerged branch. The promise and the deploy branch disagree. This
    is a real fix-before-cutover, not cosmetic — but it is a packaging/merge fix, not a design flaw in the
    capability.

- **Forward gaps (lead-architect):** The model still supports the vision (a self-contained, registry-backed
  infra platform every project inherits). Three forward gaps, all ADDITIVE:
  - **No registry home exists yet** — the inventory is seed data; `12-infrastructure-registry.md` must be
    created in ecosystem-architecture for the facts to have a system of record. Until then the drift it found
    can re-drift. Additive (new doc + template), not a redesign.
  - **The config-gate must ride the branch that deploys** — BUG-4 generalizes to a structural rule: a
    pre-deploy gate that isn't on the deploy branch is theatre. The forward fix is `deploy-preflight` chaining
    config + build-shape + migration-state on the deploy branch itself.
  - **PLOS direct-host rewrite gap (D1b)** — `toTransactionPoolerUrl()` silently passes a direct host
    unpooled. A startup assertion (prod `DATABASE_URL` is a pooler host) closes it. Additive hardening.

## Findings + fixes
| # | Sev | Finding | Fix applied / required |
|---|-----|---------|------------------------|
| F1 | Should | BUG-4: `main` advertises config-doctor but it is only on `infra/config-registry-layer` (not an ancestor of HEAD) | Merge the config-doctor slice onto the deploy branch (independent verification required) OR stop advertising it until merged — REQUIRE-MERGE before cutover |
| F2 | Should | Pooler inversion contradicts ECR-0005 for Admin | Record per-app pooler mode + rationale in the new registry + amend ECR-0005 to allow the session-pooler exception (cite the 2026-06-13 incident). Do NOT unify |
| F3 | Should | No concrete infra registry exists (refs/scope/pooler live in code/Vercel only) | Create `ecosystem-architecture/12-infrastructure-registry.md` seeded by this inventory (candidate in the ledger) |
| F4 | Should | Vercel scope drift (D2) — live PLOS docs name personal scope; apps run on team scope | Correct the two PLOS docs to the canonical team scope; record team scope in the registry (founder-confirm during cutover) |
| F5 | Nice | PLOS direct-host rewrite gap (D1b) | Add a startup assertion that prod `DATABASE_URL` is a pooler host; harden `toTransactionPoolerUrl()` to handle/reject a direct host |
| F6 | Nice | check-hook-paths does not cover runbook/remediation references (let BUG-4 through) | Extend reference-integrity to operator-facing text (Learning Review Q4 candidate) |

## Conclusion
The foundations are **STABLE to build on** — the config-platform architecture, the health/rollback layer, and
the inventory are coherent and field-proven (rumah-admin PR #17 failed-closed on all 4 keys). The required
fixes are **additive and merge/packaging-level (F1–F4), not a redesign**: merge the config-doctor onto the
deploy branch before cutover (F1), give the recorded facts a registry home + ECR-0005 amendment (F2/F3), and
correct the scope docs (F4). The pooler inversion is a strength (recorded divergence), not a defect to unify.
No redesign required.
