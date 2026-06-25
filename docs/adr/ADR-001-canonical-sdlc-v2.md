# ADR-001 — Canonical Delivery OS SDLC v2 (Class A/B/C, Delivery-OS-owns-repo-ops, CI dedup, self-healing)

- **Status:** PROPOSED — autonomous parts ratified; the effectful envelope is **founder-gated** (§11 + signature + shadow cohort).
- **Date:** 2026-06-25
- **Supersedes/evolves:** `capabilities/CANONICAL-SDLC.md` (the 4-lens dev-first SDLC, same day) — *evolves, does not overturn*.
- **Decision class:** CONSEQUENTIAL (architectural ∩ security-sensitive ∩ production-readiness — Governance §11).
- **Panel:** lead-architect (design) · CI/reliability lens · governance/security adversarial lens (board review). No single agent adjudicated.

## Context
The founder mandated SDLC v2: make the SDLC (not `/goal`) the primary contract; make founder review **exception-based** via **Class A/B/C** change classification; have **Delivery OS own ALL repository operations** (the founder never merges/deletes/deploys/manages GitHub); **dedup CI** (verify once); and make internal orchestration **self-healing** (never trap Claude in hook loops). Every repo inherits it.

## The design (what was proposed)
1. **Class A/B/C classifier** — A (backend/infra/CI/tests/refactors/OS-internals) → auto-continue; B (visible UI) → lightweight DEV validation; C (payments/pricing/auth/contracts/AI-prompts/security/strategic) → explicit founder approval. C is a deny-list that always wins; A requires positive allowlist proof + clean + size cap; **ambiguous/novel → B, never A**; runs in CI, label-gated, fail-closed-to-B.
2. **Delivery OS owns repo ops** — merge runs **server-side** (a GitHub Action, the bounded runner — not the local agent the harness denies). The one founder setup = an **Auto-Merge Authorization** (a merge-capable bot, branch-protection-gated to class:A+green+VERIFY; founder installs + signs once).
3. **Branch model** — *recommended* collapse the long-lived `dev` → trunk + per-PR previews (flagged as its own §11 call).
4. **CI dedup** — verify once on the PR; on promotion the identical git **tree-hash** (squash-invariant) skips the full re-verify, running prod smoke only; tree-differs → full verify (fail-closed).
5. **Self-healing orchestration** — after K identical Stop-hook fires with no progress, a classifier routes to founder-action(FAP) / impl-defect(author-ward) / agent-failure(respawn) / orchestration-failure.

## Board verdict: NOT-READY for the effectful envelope → SHADOW-FIRST, founder-gated
The governance/security lens returned **NOT-READY** with a viable ready-with-conditions path. The decision honors it:

### Blockers (the effectful envelope is DEFERRED to the founder)
- **B1 — Class-A auto-merge contradicts the just-merged canon.** `CANONICAL-SDLC.md` lists lights-out auto-merge as ASPIRATIONAL/forbidden ("violates G9+C6 — irreversible needs a human") and says "Block any engine-autonomous auto-merge." Moving the merge server-side does **not** cure C6 (the *act* is irreversible). **→ Requires a founder-signed amendment to the canon + its own §11 ruling. Not enacted here.**
- **B2 — classifier-protects-classifier only airtight if rules read from BASE not HEAD** (a PR must not weaken its own judge). **→ enforced from the base ref by an immutable workflow.**
- **B3 — label/SHA TOCTOU + the real gate gap.** The on-disk `merge-pr.mjs` checks **only all-green CI** — it reads **no label, no CODEOWNER** (the canon's "founder-approved label = C6 gate" describes machinery that doesn't exist yet). Any bot must bind the class-check to the exact head SHA, the `class:A` label must be bot-only, author≠gate-clearer. **→ this gap must close BEFORE any bot gets merge rights.**
- **B4 — self-healing bypass must never proceed past a kernel gate.** A "proceed-past" bypass is a §13 kernel-mechanism swap; "no progress" is indistinguishable from a correctly-refusing gate. **→ redefined: orchestration-failure ESCALATES to a `failure` FAP only (the goal-contract H1 terminal), never proceeds.** Folded into the build.
- **B5 — collapsing `dev` needs its own §11 + a DECISIONS.md** (which didn't exist — a standing §7 gap). **→ keep the conservative `dev` fallback; the collapse is its own future panel; `DECISIONS.md` created.**

### Should-fix (folded into the shadow build)
- **S1** — force C by **path** for migrations/RLS/authz/money/env/prompts independent of keywords; a new unknown top-level path → never A.
- **S2** — smallest diffs are the most dangerous (a 1-line fee/authz change), not the least.
- **S3** — CI dedup must skip only **source-deterministic** checks; migration-apply, integration-against-prod-config, and **smoke always run on promote** (tree-identity ≠ runtime-identity).
- **S4** — a §6 founder ruling is needed on whether branch-protection-as-guard substitutes for a human on Class A.

### Decision
- **RATIFIED (autonomous, this slice):** the **change-classifier in SHADOW mode** (classify + log what it *would* do, **no merge fired**), the **self-healing tools** (progress-stall + stall-classify, B4-corrected to escalate-only), the **CI-dedup tree-marker** (source-deterministic skips only; smoke always runs), and this ADR + `DECISIONS.md`.
- **DEFERRED to the founder boundary:** the **Auto-Merge Authorization** (the bot + the signed marker), wiring Class-A **auto-merge** live, fixing `merge-pr.mjs` to actually enforce label+CODEOWNER+author≠clearer (B3), and **collapsing `dev`**. These need a **founder-signed canon amendment + an independent §11 ratification + a pre-registered SHADOW cohort** (run the classifier on delivery-os itself, measure the false-A rate vs founder ground truth; kill metric: **one false-A on any C-semantics change = halt**).

## World-class benchmark (adopt / reject)
ADOPT: trunk-based dev (for Class A), per-PR preview envs, progressive delivery + fast rollback over manual gates, GitHub-flow + squash + continuous deployment. REJECT: merge queues (premature — Waterline; revisit on observed PR contention), monorepo (breaks the producer/consumer os-inherit boundary), GitFlow (the branch sprawl the governance auditor deletes), lights-out *engine* merge (G9/C6 forbidden). SDLC v2 = **trunk-for-A, human-for-B/C** — calibrated to a founder-operated money business with a thin test net (more conservative than pure trunk-based on the visible/business surface).

## Consequences
- **Positive:** founder review becomes exception-based (Class A/B/C); the self-healing fix ends the hook-loop traps observed this very session; CI-minutes ~halve per slice; repo-ops ownership is designed; the §7 ledger gap is closed.
- **Negative / accepted risk:** Class-A misclassification residual is mitigated (deny+allow+size+path+content), not eliminated — which is exactly why auto-merge is **shadow-first + founder-gated**, never default-on. The classifier is a new single point of trust (drift-linted, fail-closed-to-B, audited).
- **The honest limit:** a keyword/path classifier cannot read intent; a small, clean money/authz refactor is the worst escape. The founder's signature on the shadow-cohort results is the gate that accepts (or rejects) that residual — it is not assumed.

## Why this becomes canonical going forward
SDLC v2 makes the SDLC the primary contract, automates the *mechanical* back half (the founder never does repo ops), and reserves the founder strictly for **meaningful product/business validation** — while refusing to remove the human from irreversible production merges until a founder-signed, evidence-backed §11 ratification says the false-A rate is acceptably low. It is autonomy maximized **up to the C6 line**, not past it.
