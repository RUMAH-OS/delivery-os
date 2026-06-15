# Autonomous Execution — canonical definition (V6 board, 2026-06-15)

> Board: lead-architect · integration-architect · reviewer-critic (adversarial). The founder asked for the
> canonical DEFINITION first, no implementation. The board split on the OS question; the adversarial seat
> caught a goalpost-move in our own canon (below). This doc is the honest resolution.

## The self-correction (named, not hidden)
`AUTO-EXEC-CRITERIA.md` (founder-required, pre-registered: "we do not soften the word Operationally to fit")
made **autonomous agent operation a FIXED target** (≥N cycles over ≥M days, runtime-evidenced). The later
`V6-LANDED-DEFINITION.md` **excluded autonomous execution** and reclassified the away-mode envelope as
"post-landed optional." **That is a goalpost-move** — the convenient doc softened the pre-registered bar. It
must be reconciled by an explicit founder trade, not left as two contradicting canon files.

## Three strata (the load-bearing distinction)
- **AUTOMATION** (Claude pulls every trigger; deterministic select/inject/route): **A, B, C.** This is the
  majority of the value the founder named, and it is built — but it is **automation, not autonomy.** Calling
  A/B/C "autonomous" inflates the claim. Autonomy begins where the founder is NOT in the per-instance loop.
- **AUTONOMY** (work advances across an operator absence, no per-instance human, bounded + gated): **D, F, H,
  J.** **NOT harness-blocked** — a cron/away-mode runner driving a founder-ratified work-list of scripts+gates
  founder-absent is achievable. Currently designed (A6 envelope), unbuilt.
- **OUT OF SCOPE** (removes the orchestrator): **I** (agents spawn agents — genuinely harness-blocked AND
  founder-ruled-out). **E** as "machine replaces Claude's planning judgment" (vs E as a ratified work-list = D).

## A–J classification (board synthesis)
| | Interpretation | Original vision? | State | Class | Proof = GREEN |
|---|---|---|---|---|---|
| A | Dispatch (auto-select+route) | yes | built (automation); adoption pending | **Required (as AUTOMATION)** | dispatch-log + conformance on a real slice |
| B | Knowledge auto-inject | yes | built; injection≠adoption firewalled | **Required (automation)** | KU cited@hash organically ≥2 real slices |
| C | Skill auto-inject | yes | built; firewalled | **Required (automation)** | content-bound citation, organic recurrence |
| D | Multi-step workflow, no founder between steps | **yes (the gut vision)** | designed (A6), not built | **AUTONOMY — Required to earn "OS"** | A6 runner drives a ratified work-list, gate-trio between items, halt-on-red, audit ledger |
| E | Planning (decompose goal→slices) | partial | Claude does it each turn | **Nice-to-Have** | (as ratified work-list = D); orchestrator-replacement = OoS |
| F | Recovery (detect+retry/escalate) | **yes** | not built | **AUTONOMY — Required to earn "OS"** | failure → fail-closed halt + escalate trace, never silent-skip |
| G | Cross-app propagation | yes (Pillar 2) | partial (seam built, PLOS not inheriting) | **Required (ecosystem)** | G8.1/G8.2/E2/E3. NB: deliberate per-app sync is a FEATURE (blast-radius), not an autonomy gap — GREEN = byte-current + cross-check FAILs a stale consumer, NOT auto-push |
| H | Long-running (hours/days) | **yes ("away")** | not built | **AUTONOMY — Required to earn "OS"** | away-mode runs a work-list across a real window within count/cost/wall-clock caps + kill-switch |
| I | Agent self-spawning | no (ruled out) | harness-blocked | **Out-of-Scope (permanent)** | none possible |
| J | Founder-absence test | **yes (the whole point)** | not built | **AUTONOMY — Required to earn "OS"** | away-mode completes a ratified work-list founder-absent, every gate enforced, kill-switch honored, zero unlisted/sensitive actions (ADR-006/007), founder reconstructs it from reports |

## The OS question — is it honestly an AI Operating System if D/F/H/J stay unbuilt?
Board split: lead-architect + integration-architect said "yes, an *operator-driven* OS, scoped." reviewer-critic
said **no**, and the synthesis sides with the adversarial seat on the NOUN:
> **An Operating System is defined by what it does when you are not looking. This system, with D/F/H/J unbuilt,
> does nothing when you are not looking — Claude initiates every action every turn.** With G8 + adoption +
> ecosystem + founder-experience GREEN, it is the **best-instrumented, enforced, legible delivery operating
> MODEL / orchestration layer in the ecosystem** — a genuine, major achievement — but **"AI Operating System"
> (unqualified) is an over-claim until it can operate unattended.** Honest: **"V6 model landed" ≠ "AI OS."**
> The OS noun is *earned* when D/F/H/J land (per AUTO-EXEC-CRITERIA's bar).

## THE canonical definition
> **Autonomous execution = the system advances real work across an operator absence, without per-instance
> human initiation, inside a bounded fail-closed envelope (kill-switch, count/cost/wall-clock caps,
> irreversible/outward actions human-gated, author≠verifier preserved).**
> - **IN (required to ever use "autonomous" / to earn the "OS" noun):** D (multi-step no-founder), F (detect→
>   halt/escalate, never silent-skip), H (long-running in guardrails), J (founder-absence passed, runner-
>   attributable).
> - **OUT (permanent):** I (agent self-spawning — harness-blocked + ruled out); unbounded self-direction; the
>   runner editing/reordering its own work-list; crossing sensitive boundaries; merging to main; overriding a
>   red gate.
> - **AUTOMATION, not autonomy (relabel everywhere):** A/B/C auto-select/inject/route — Required-for-Landed as
>   automation, the majority of the value, but NOT the autonomy claim. Stop calling them "autonomous."

## The founder trade to sign (the contradiction must be resolved, not averaged)
**Option 1 — Autonomy is a 5th landed pillar (earn the OS noun):** D/F/H/J ("Autonomous Operation," graded by
AUTO-EXEC-CRITERIA §C) join the landed definition; "AI Operating System" is claimable only when they're GREEN.
**Option 2 — Conscious defer (don't claim the noun yet):** D/F/H/J stay post-landed; AUTO-EXEC-CRITERIA becomes
the standing target for *when* the OS noun is earned; until then the honest label is "landed V6 delivery model
/ orchestration layer," explicitly **not** "AI Operating System." The founder accepts that trade in writing.
**Not acceptable:** leaving both docs on disk so the project implies autonomy is handled while the pre-registered
target sits unmet one file over. Pick one; sign it.
