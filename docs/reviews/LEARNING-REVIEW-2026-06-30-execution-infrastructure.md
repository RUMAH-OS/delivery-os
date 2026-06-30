---
event: "architecture-review"
date: "2026-06-30"
change: "Execution-Infrastructure implementation P0.1–P3.5 (platform-side foundation + Neo execution-node Adapter)"
triaged_by: "PO (reconstructed from commits 1ad46dd..2b5f541, the 7 slice VERIFYs, the Wave-1 challenge, and the P3.2↔P3.3 reconciliation)"
milestone: "EI buildable-assets complete + verified (pre-founder-install)"
---

# Learning Review — Execution-Infrastructure implementation (P0.1–P3.5)

> Auto-triggered by §14. Experience → routed capability.

## 1. Reconstruct from artifacts
Across P0.1–P3.5 the platform-side foundation + the Neo execution-node Adapter were built and each slice independently verified (`docs/verify/VERIFY-{manifest-hygiene-p0-1, dependency-enforcement-p1-1, execution-contracts-p2-1, neo-adapter-p3-1, ei-install-assets-p3-2-3, ei-cicd-p3-4, ei-install-assets-p3-5}.md`). Three independent challenges materially changed the work: the **Wave-1 challenge** (`WAVE1-CHALLENGE.md`) corrected the kernel over-claim + refuted the original Delete-Test oracle; the **combined P3.2+P3.3 verify** caught a parallel-build seam defect (verdict `executed`, not verified); the **P3.5 reconciliation** then found a deeper latent false-green in `render_template`.

## 2. Were any framework-level lessons discovered?
Yes — three, all earned from a check that fired (or failed to fire):
1. **Parallel agents building *coupled* artifacts need a SEAM verify, not just per-slice verifies.** P3.2 (scripts) and P3.3 (templates) were built concurrently; their paths/placeholders diverged → `install-daemons.sh` exited 0 loading zero daemons (false-green). Each slice passed its own checks; the defect lived only in the seam between them.
2. **Fail-closed must be *tested on the false-green path*, not asserted.** `render_template`'s `die` was swallowed inside a command substitution (bash disables `errexit` there) → empty artifact at exit 0; `install-daemons` warn-skipped → exit 0. Happy-path checks were green; only deliberately exercising the missing-template path exposed it.
3. **The governance rollout can itself commit the §12 violation.** The kernel §3 advertised enforcement that was 100% unbuilt — the exact "advertise what's not on disk" failure the principle exists to prevent, reproduced in its own elevation.

## 3. Capability impact (the §14 routing)
| Lesson | Layer | Asset | Destination |
|--------|-------|-------|-------------|
| Coupled parallel artifacts need a seam/integration verify | Delivery OS | process + verify-checklist row | DESIGN-FIRST via `docs/feedback/OS-FEEDBACK-parallel-seam.md` → a "seam verify" step when concurrent sprints produce a producer+consumer pair |
| Verify the fail-closed path, not just the happy path | Delivery OS | doctrine (verify-gate checklist) | OS-FEEDBACK → add "did you exercise the failure/missing-input path?" to the VERIFY rubric |
| Drift-gate must cover the kernel's enforcement claims | Delivery OS | lint (check-os-drift) | **DONE in P1.1** — the principle's enforcement artifacts are now drift-covered (the kernel can't advertise un-built enforcement) + this case study |

## 4. Did any EXISTING capability fail to catch this?
- The **per-slice verify-gate** did not catch the P3.2↔P3.3 seam defect — it verifies a slice in isolation, not the integration between two concurrently-built slices. → the seam-verify candidate (lesson 1). (It WAS caught, by the combined verify the PO chose to run — institutionalize that choice.)
- The **drift-gate** did not previously cover the kernel's enforcement claims, so the kernel over-claim was un-gated. → closed in P1.1.

## 5. Blast-radius fork
- **Project-local lessons (implemented in this series):** the P3.5 reconciliation fixed the seam + both false-greens; P1.1 added the kernel-claim drift coverage and the corrected Delete-Test oracle.
- **OS-base / cross-system lessons (DESIGN-FIRST, never written from a retro):** the "seam verify for coupled parallel artifacts" process + the "verify the fail-closed path" doctrine → `docs/feedback/OS-FEEDBACK-*.md` for ratification before any base change.
