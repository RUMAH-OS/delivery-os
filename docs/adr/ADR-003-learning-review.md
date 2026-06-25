# ADR-003 — Learning Review as a first-class lifecycle hook (the 3-level trigger policy)

- **Status:** **PROPOSED — 2026-06-25 (founder ratification pending).** Registers Learning Review as a first-class Delivery OS lifecycle hook (peer to VERIFY and Founder Review) governed by a ratified 3-level trigger policy. The board scored the alternatives and converged; the founder has not yet signed. Until ratified, the trigger ships in **SHADOW** (classify + log, no blocking review fired). Relates to `DECISIONS.md` **D10**.
- **Date:** 2026-06-25
- **Supersedes/evolves:** `core/GOVERNANCE.md` §14 (the OS Feedback Loop) — *evolves; it names the hook that OWNS the §14 triggers.* It leaves the §14 **promotion bar** (observed failure OR second consumer), **close-default**, the scaled **§11 promotion panel**, and the **no-backflow lint** UNCHANGED. Turns `CANONICAL-SDLC.md`'s terminal "Learning Capture" stage / "Phase 5 (unbuilt)" into a registered lifecycle stage.
- **Decision class:** CONSEQUENTIAL (architectural ∩ governance — Governance §11/§13/§14). It changes when the OS's learning machinery fires.
- **Panel:** a board scored the alternatives (incl. reject-every-slice); founder-approval pending. No single agent adjudicated.

## Context
The record shows the learning loop failing in **both directions at once**:
- **UNDER-fire (the 175-overdue).** The §14 review-trigger had effectively never fired on continuous trunk work; the field record carried a retro that was **~175 commits overdue** — learning debt accumulated with no mechanical cap, because the only trigger that fired reliably (a release tag) is never created by continuous-delivery projects.
- **OVER-fire (the 14×-fanout).** When review *was* run, it fanned out into ~14 blind same-model lens-runs against a small reversible question — the ceremony-overrun §11 already names (panel saturation arrives ~5–6; 14/14 unanimity is repetition, not coverage). A naive "review every slice" fix would industrialize exactly this over-fire.

A single threshold cannot serve both: the same mechanism must capture cheaply on every slice yet reserve the heavy multi-specialist retro for the events that actually purchase lessons.

## Alternatives scored (the board)
- **A — review every slice (REJECTED).** Reproduces the 14×-fanout over-fire at industrial scale; violates §11 panel economics (ceremony rate-limited by evidence) and §16 (manufacturing boundaries the goal can never autonomously clear). The cure becomes the disease.
- **B — keep the single release-tag trigger (REJECTED).** This is the under-fire that produced the 175-overdue; trunk projects never tag.
- **C — the 3-level trigger policy (CHOSEN).** A graded ladder: continuous cheap capture, a light checkpoint, and a full review reserved for heavy triggers — with the N-merge backstop as the completeness floor that makes a 175-overdue structurally impossible.

## Decision
Register **Learning Review** as a first-class lifecycle hook, peer to VERIFY (D8/D9) and Founder Review (D6), governed by a **3-level trigger policy**:
- **L0 — continuous capture (every slice).** Append-only signal capture (`capabilities/signals.jsonl` via `file-lesson.mjs` + the gates). No review, no block.
- **L1 — lightweight checkpoint (phase-end / routine boundary).** A fast bump-or-declare-no-learning checkpoint. Non-blocking.
- **L2 — full multi-specialist review (heavy triggers only).** Fires on **incident · ADR/board decision · new-capability · founder-epic · milestone · census-candidate · the §14 N-merge backstop (>30)**. Runs the `learning-review` skill + a **scaled §11 panel** (composing principle-11's lens machinery into the retro), then auto-classifies and emits the Founder Learning Package.

**The auto-decision rule:** `learning_expected = (L1 ∨ L2)`; **default no-review (close-default).** The classifier `learning-trigger.mjs` decides the level; evaluation is **FAIL-OPEN** — an L0/L1 classification never blocks a push, commit, or goal (only the heavy-trigger L2 path schedules the review).

**Multi-asset classification (never assumed a skill).** Every **approved** learning is auto-classified by `learning-classify.mjs` into exactly the right asset of the **10-way taxonomy** — *hook · template · doctrine-line · skill · agent-change · lint · process-adjustment · capability-ledger-row · ADR/decision · no-framework-change* — and inherited via `os-foundation.manifest.json`. Storing a lesson in the wrong artifact is itself a defect (§14).

**The Founder Learning Package.** An L2 review emits `founder-learning-package.mjs`'s zero-tech founder-facing artifact — what was learned, what changed, what (if anything) the founder must decide — mirroring the Founder Review Package envelope (impl detail hidden).

**Completeness.** The §14 **N-merge backstop** (default 30) is the completeness guarantee: learning debt cannot exceed 30 commits, so the recorded 175-overdue is structurally impossible.

## Consequences
- **Positive:** the loop fires proportionally — cheap on every slice, heavy only on events that earn it; the under-fire is closed by the backstop and the over-fire by reserving L2 for heavy triggers; learning becomes a registered lifecycle stage, not a never-fired "Phase 5".
- **Negative / accepted:** the level classifier is a new calibration surface — hence the SHADOW rollout (classify + log before gating) so trigger thresholds are observed on real work before any blocking.
- **Invariants preserved:** §14's promotion bar, close-default, the scaled §11 promotion panel, and the no-backflow lint are UNCHANGED — Learning Review FEEDS the promotion machinery, it does not replace or relax it. §11 panel economics (lens cap, refusal rule, saturation ~5–6) are intact — the L2 panel is scaled, not maximal.

## What is REUSED vs net-new (the ~reuse-first discipline)
- **REUSED (compose existing):** `file-lesson.mjs` + `capabilities/signals.jsonl` (L0 capture), `census-detector.mjs` (the census-candidate trigger), the `learning-review` skill (the retro procedure + the blast-radius fork + bump-or-declare), the §14 N-merge backstop + review-artifact detector, principle-11's lens machinery (scaled into L2).
- **NET-NEW (small, named):** `learning-trigger.mjs` (the 3-level classifier), `learning-classify.mjs` (the 10-way taxonomy router), `founder-learning-package.mjs` (the L2 founder artifact), and this registration (the capability manifest + D10 + §14 hook ownership + the CANONICAL-SDLC stage row + `templates/workflows/learning-review.yml`). *The three tools are owned by a separate track; this ADR references them by name + behavior.*

## Rollout (SHADOW-mode, the D3/ADR-001 precedent)
`learning-trigger.mjs` **classifies + logs** the level + the would-fire decision **without scheduling a blocking review**, until trigger calibration is observed on real work. Promotion out of SHADOW is a founder decision once the false-fire/missed-fire rates are seen — exactly the SHADOW discipline ADR-001/D3 established for the auto-merge classifier.

## References
- `DECISIONS.md` D10 · `core/GOVERNANCE.md` §14 (OS Feedback Loop), §11 (panel economics), §13 (mechanism/policy line), §16 (boundary)
- `capabilities/learning-review.capability.json` · `capabilities/CANONICAL-SDLC.md` (Learning Review row)
- `skills/learning-review/SKILL.md` · `templates/workflows/learning-review.yml`
- `templates/tools/learning-trigger.mjs` · `templates/tools/learning-classify.mjs` · `templates/tools/founder-learning-package.mjs` (owned/built by the learning-tools track)
- `templates/tools/file-lesson.mjs` · `templates/tools/census-detector.mjs` · `capabilities/signals.jsonl` (reused)
