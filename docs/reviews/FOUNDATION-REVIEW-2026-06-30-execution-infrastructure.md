---
review: foundation
date: "2026-06-30"
change: "Execution-Infrastructure implementation P0.1–P3.5 — platform extraction landing + manifest hygiene + dependency-enforcement layer + host-agnostic execution/health contracts + Neo execution-node Adapter subsystem"
verdict: "STABLE — build on it"
lenses: "reviewer-critic (consistency/contradictions) + lead-architect (forward gaps) — applied across the independent verification chain (7 slice VERIFYs + the Wave-1 challenge)"
---

# Foundation Review — Execution-Infrastructure implementation (P0.1–P3.5)

> Auto-triggered by the Review-Class Trigger (§14 · ADR-003 L2). Question: are the foundations this change
> builds on still internally consistent + still valid? Consolidated from the independent verification chain
> (each slice carries an author≠verifier VERIFY; the Wave-1 challenge stress-tested the design).

## Foundation set reviewed
The load-bearing foundations this EI build rests on, cross-checked against the just-built reality:
- **The Repository & Dependency Principle** (`PRINCIPLE-repository-and-dependency-rule.md`, kernel §3) — the inward-only rule.
- **The Runtime** (`templates/governance-engine/` — 14 organs behind 6 ports + the state-machine validator + golden-master cages).
- **The contracts** (`ExecutionProviderPort`, the Health-Emission contract).
- **The enforcement** (`architecture.config.json` + `arch-boundary-guard.mjs` + `delete-test.mjs` + Gate 5 + drift coverage).

## VERDICT: STABLE — build on it
- **Consistency (reviewer-critic):** Coherent, and a prior contradiction was *closed* by this work. The kernel §3 had over-claimed enforcement as present-tense ("enforced by…") while it was 100% unbuilt — the Wave-1 challenge caught it; §3 now reads "designed/clean today; enforcement built in P1.1" and the claim is **drift-covered** (the kernel can no longer advertise enforcement the disk lacks). The Runtime organs are byte-unchanged (identical self-test counts across P2.1/P3.1/P3.5). No remaining contradiction between the docs and disk.
- **Forward gaps (lead-architect):** The model supports the long-term vision without rework. The provider-port idiom is uniform (`ExecutionProviderPort` today; the future `MemoryProviderPort` is the same shape) and the dependency gate treats them identically. The Delete Test proves the EI is genuinely an Adapter (`rm -rf infrastructure/execution-node/` ⇒ Core builds). The `composition` layer added in P3.5 is the correct Clean-Architecture "main" — scoped to exactly the 3 entry files and adversarially proven not to be a loophole (a planted adapter→core import still fires). No structural gap.

## Findings + fixes
| # | Sev | Finding | Fix applied / required |
|---|-----|---------|------------------------|
| F1 | Nice | Install scripts + templates are STATIC-verified only (bash -n, render-parse, secret-grep) — runtime/idempotent re-run can't run without macOS/Neo. | Accepted + explicit: runtime validation deferred to the founder's live install (the Installation-Guide acceptance checklist + the live-node validation phase). |
| F2 | Nice | The governance-engine tree was git-untracked until this push, so "organs unchanged" had no HEAD byte-diff. | Proven instead by identical self-test counts + zero-reference grep; now committed (future diffs are gitted). |
| F3 | Nice | Stale `neo-node-1` mentions linger in two prior VERIFY docs; a founder username appears in one ci-cd deploy doc. | Non-blocking (historical docs); runtime surface unified on `neo-node2` via `DOS_NODE_ID`. Refresh on next docs pass. |

## Conclusion
The foundations are stable and, on one axis, *more* consistent than before this change (the kernel over-claim is corrected and now gated). The EI builds on an adversarially-verified base. **Build on it** — proceed to the founder install + live validation; nothing must be redesigned first.
