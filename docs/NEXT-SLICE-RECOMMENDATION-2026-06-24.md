# Next highest-leverage slice → production-proven operational (2026-06-24)

> Coordinator consolidation of a 5-lens panel (architecture · rollout · implementation · verification · founder-experience),
> each evaluating candidates C1–C5. S1 (route) is DONE. Question: the next slice to move
> `capability → trigger → route → agent → verify → learn` to a **production-proven operational** system.

## Verdict (panel resolved)
**The milestone is C1 — the first real production dunning run. The next slice is to drive it there.**
4 of 5 lenses rank C1 #1; implementation ranks C2 #1 *only* as "highest-leverage buildable-now without a founder
gate." Both are right — they answer different questions. **C1 is the operational critical path (mostly founder-gated);
C2 is the best parallel engineer track (zero gate).** Run C1 as primary and C2 alongside — they don't contend.

The §11 disagreement, surfaced not smoothed (architecture + verification): a *strict* reading of "complete the
named chain" points at **C2** (the only **broken** link is `agent`). But the live business loop **routes around the
agent link** (dunning is prepare-only + `requireHuman`, no agent step), so closing C2 off-prod makes the *framework
chain* complete in a harness — **not the *system* operational.** "Production-proven **operational**" = real value under
real load in prod = **C1**. The founder directive ("operational proof, not more architecture") breaks the tie for C1.

## C1 has two rungs (verification split, resolved)
| Rung | Proves | Needs | Money-safe? |
|---|---|---|---|
| **C1a — autonomous SHADOW self-start** | a business event auto-started a workflow that **landed, visible, in the founder's approval queue** (no human trigger) | #181 + #182 + heartbeat + **1 linked contact** | YES — prepare-only; a cron tick structurally cannot `requireHuman`-send |
| **C1b — money-loop CLOSED** | the founder **approved and a real reminder left the mailbox** (Gmail message-id + `invoice_sends` row) | C1a **+ B1 googleapis bundle deployed + 1 mailbox OAuth** | gated by the founder approve-and-send |
C1a is the engine-operational checkpoint; **C1b is the true production-proven milestone** (a prepared-but-unsent run
is one rung below — and must **supersede the no-op run `49983faa`**, which was `gated_honestly`, no send, no money).

## Dependencies (who unblocks what)
```
FOUNDER-GATED (only the founder)                ENGINEER-BUILDABLE NOW (me; non-gated)
  merge+deploy PLOS #181 (EMAXCONN) ──┐           B1 googleapis Vercel bundle (THE code blocker to a send)
  merge+deploy PLOS #182 (sweep A+B) ─┤           B2 mailbox state-lie fix (~1–2h; standing experience defect)
  schedule heartbeat G2 (pg_cron/cron)┤  ──C1a──► B3 deep-link the queue item to the GOLD invoice surface
  link 1 contact (the "silent killer")┘           Slice E — shadow-surface the run onto the approval queue
  ── then ──                                          (depends on delivery-os #1 G4/G5 being merged)
  set INVOICE_SEND_MAILBOX + connect 1 mailbox │   Slice D — AD-4 honest-GREEN (gated-but-owed can't hide)
  approve-and-send the gold path     ─┘  ──C1b──► inverse-transition retract (paid-mid-window draft) [before Phase 1]
                                                   confirm the at-send stop-on-paid re-read in executeBusinessAction
PARALLEL (zero founder gate):
  C2 engine executor-bridge OFF-PROD proof in examples/engine-demo-app — engine already honors agent-result;
     runner+registry built; 3 files (demo-agent pack, runtime wiring, run-agent-demo proof) + simulated executor.
```

## Founder-experience conditions (non-negotiable — a degraded C1 poisons the proof)
- **A — the run must have a SURFACE to land on.** Bundle **G4/G5 (#1) + Slice E**, or the system runs itself and the
  founder *sees nothing* — "an invisible autonomous run is the original failure in a new costume."
- **B — it must land on the GOLD surface.** Deep-link to `/room/invoices/[id]` (faithful preview + inline link form),
  **not** the dead-end `/room/business` where the gated reason renders as dead text (the FV-2 class that earns the role).

## Recommended next slice (the build)
**Primary — C1, "drive the dunning loop to its first real prod run":** I build the non-gated enablers now — **B1
googleapis bundle** (confirm whether `next.config.mjs` already fixed it), **B2 state-lie**, **B3 gold deep-link**, and
**Slice E shadow-surfacing** (after #1 merges) — bundled so the autonomous run lands correctly. The **founder** then
does the gated critical path: merge #181→#182, schedule the heartbeat, link one contact → **C1a self-start proof**;
then deploy B1 + connect one mailbox + approve-and-send → **C1b money-loop closed**.

**Parallel — C2 off-prod executor-bridge proof:** the highest-leverage buildable-now slice; first end-to-end
demonstration of the `agent → verify → record` links (built but never exercised). Keep it scoped to the demo harness +
a **simulated** executor (the `claude -p` prod runner is a separable later slice; G9: engine emits, runner spawns).
Advances the v6 chain while the founder's C1 gates clear; unblocks S5/S6 and gives the learn loop real outcomes.

## Risks
- **No-op trap (verification):** a prod run id alone isn't proof; the artifact must show a real Gmail message-id +
  ledger row on **merged `main`**, with idempotency + stop-on-paid negatives, explicitly superseding `49983faa`.
- **Money-adjacent:** at-send stop-on-paid re-read **unconfirmed**; paid-mid-window draft can linger (**inverse
  transition unbuilt** — build before widening); gated-but-owed hiding behind GREEN (**Slice D** before Phase 1);
  exclude disputed/credit invoices before widening; pool exhaustion (mitigated by #181 + `DUNNING_SWEEP_MAX`).
- **Proven ≠ on main:** all PLOS proof rides unmerged branches today; re-run the regression suite on merged `main`.
- **C2 mis-scope:** don't pull the prod Admin `claude -p` runner into the slice — demo + simulated executor only.

## Expected operational impact
- **C1a:** the first time the system runs itself — a chase the founder *didn't* create appears in their queue. Money-safe.
- **C1b:** the money loop closes — *"I watched my business chase a real customer for money without me triggering it."*
  The exact emotional/operational proof this whole arc has chased; the founder's job collapses to one approve-and-send.
- **C2:** the `agent → verify` link demonstrated end-to-end for the first time; unblocks engine-native agents (S5/S6)
  and feeds real outcomes into the learn loop (S2/C3) — the architecture track to autonomy the founder can't yet feel.

## Single highest-leverage action THIS WEEK (founder)
Merge+deploy **#181 → #182** and **schedule the heartbeat**, with `DUNNING_SWEEP_ENABLED=true` scoped to one pilot
debtor that has one linked contact — the smallest gesture that flips the system from "verified off-prod" to
"autonomously self-starting in prod," with a single env flag as the instant kill-switch. The **heartbeat is the
load-bearing, easily-missed half** — without it the merges are inert.
