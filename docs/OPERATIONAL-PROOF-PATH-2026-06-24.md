# Smallest Path to Operational Proof — running the business through PLOS (2026-06-24)

> Goal: move **Daily Operational Usability** from NOT-YET → READY. What's the *smallest* path to prove the
> founder can operate the business primarily through PLOS? Which founder-facing workflows are highest-leverage,
> and what gaps/regressions still block it? (Jarvis out of scope.)
> Evidence: code-cited investigation of PLOS Room/business-band/invoice/mailbox surfaces + the send paths.

## The reframing (the key finding)
**The founder-driven money loop is already BUILT and LIVE end-to-end** — not prepare-only. The earlier "dunning
no-ops in prod" finding was about the *autonomous engine-driven* path; the **founder-driven** path (founder acts
from the Room) is complete and wired to a real Gmail send + an audit ledger. So PLOS is **much closer to
operational than the engine-maturity lens implied** — the smallest proof needs almost no new build.

**Two dunning/send paths exist — don't conflate them:**
| Path | How it runs | Status |
|---|---|---|
| **Founder-driven** (Room → prepare → approve → send) | the founder clicks, approves, sends | **LIVE end-to-end** (`business-actions.ts:414`, `invoice-send-actions.ts:748`, oauth_user Gmail send, `invoice_sends` ledger, stop-on-paid guard, cross-surface idempotency) |
| **Engine-autonomous** (workflow engine sweeps + sends unattended) | heartbeat → engine → dunning pack | gated (needs G2 heartbeat + populated `customer_contacts`) — the SCALE path, not the first proof |

The **smallest path to operational proof uses the founder-driven path**, which already works.

## What the founder SEES today (the cockpit — all LIVE)
- **Business Band** (reads Admin `/v1/ops` live): overdue invoices (number · days · balance), pending signatures, expiring contracts, pending invoice-gen, awaiting-action — real figures, real-time (`business-band.ts:254-274`).
- **Invoice Surface**: every invoice, unpaid-first; detail with send/reminder/delivery history (`invoice-surface.ts:88-95`).
- **Morning Band**: outreach cockpit (since-yesterday / your-move / forgetting-watch) — read-only.
- **Mailbox Surface**: unified Gmail read (30-day, triage advisory) — read-only.

## What the founder can DO today (actions — LIVE unless noted)
- ✅ **Send an overdue payment reminder** (Room → Business Band → Follow up → approve → send). Stop-on-paid guard, recipient resolution, idempotent, real Gmail send, ledger-recorded.
- ✅ **Send a reminder / resend an invoice** from invoice detail (same send, distinct idempotency keys).
- ✅ **Propose a contract renewal** (expiring → Follow up → approve → send).
- ✅ **Link a contact inline** (`link-contact` → `createCustomerContact`, curated, **no DPIA**) — the recovery when a send is gated on a missing recipient.
- ✅ **Classify escalated mailbox emails** → routes dunning intent to the preparer.
- ⛔ **Mailbox reply** — draft path exists, **execute seam NOT wired** (the one real missing action).
- ⛔ **Mark Paid** — intentionally Admin-only (Admin = payment SoR); honest deep-link. *Correct by design.*

## The smallest "I ran my business through PLOS today" loop
```
Founder opens /room
 → sees a REAL overdue invoice from Admin (e.g. "2026-0060 · 5d overdue · €1.200,00")
 → "Follow up on payment" → prepare (live, deterministic draft, verbatim figures)
 → Approve
 → execute: re-reads Admin (still unpaid?) → stop-on-paid → resolve recipient
     → if no contact: LINK ONE inline (name/email) → send
     → if contact: send  (real Gmail email via the connected mailbox)
 → "✓ Sent" with messageId in the invoice_sends ledger
 → customer pays → founder records payment in Admin → next /room load clears the line
```
**Every numbered step is already wired** (cited above). Only two things gate it from being demonstrable in prod:

### The ONLY blockers for the smallest proof
1. **Merge PLOS #181 (EMAXCONN)** — so the Room + drain + sends work under real concurrency. *(founder: 1 click)*
2. **Connect ONE sending mailbox** (Gmail OAuth, the `oauth_user` lane / `GMAIL_SEND_SCOPE`) — the send channel. *(founder: one-time consent; gap-register's "oauth_user lane" item)*

That's it. **No DPIA, no bulk `customer_contacts` backfill, no heartbeat, no discovery** — those are for *scale*, not the first proof. The missing recipient is solved per-customer by the inline `link-contact` gesture.

## Highest-leverage founder-facing workflows (ranked by business value)
1. **Chase overdue → get paid** (the money loop) — LIVE. The single highest-leverage workflow; it's how the business collects.
2. **Send/resend invoices** — LIVE. Getting bills out.
3. **Contract renewals** (expiring) — LIVE (with a gating nuance, see gaps).
4. **Respond to customer mail** (comms loop) — read+triage LIVE, **reply NOT wired** (highest-leverage *missing* action).
5. **Operational triage** (Room cockpit: what needs attention) — LIVE.

## Gaps & regressions that still block daily primary use (ranked)
| # | Gap | Why it matters | State | Fix |
|---|---|---|---|---|
| R1 | **EMAXCONN** (Floor/Room/drain fail under load) | the cockpit must be reliable to live in | fix built, **PLOS #181** | merge + redeploy |
| 1 | **`customer_contacts` empty + no auto-sync** | every send gated until a contact is linked → fine for 1 proof, blocks *volume* | inline link works; bulk path gated (DPIA) | auto-sync/backfill from Admin (the scale step) |
| 2 | **Mailbox reply not wired** | founder must leave PLOS to answer customers → breaks "primary OS" | draft exists, execute seam missing (~small slice) | wire `execute-reply` route + `productionReplySendPort` (D2 gate unchanged) |
| 3 | **One sending mailbox not connected** | no send channel at all until done | `oauth_user` lane built, not consented | founder OAuth consent (one-time) |
| 4 | **Renewal send gating** (contract↔tenant) | a renewal may serve multiple workers; no stop-on-active-contract check | honest-gates today (correct, but limited) | add contract-status check symmetric to stop-on-paid |
| 5 | **No autonomous sweeps** (heartbeat/triggers) | founder-driven works; unattended scale doesn't | G2 prepared | enable extensions → apply heartbeat (scale) |

## What moves Daily Operational Usability NOT-YET → READY
- **READY-for-proof (days):** R1 merged + one mailbox connected → the founder-driven money loop is demonstrable on a real customer. **This is the smallest operational proof.**
- **READY-for-daily-primary (a few small slices):** + mailbox **reply** wired (#2) + `customer_contacts` **auto-sync** (#1, removes per-send friction) → the founder can run chase-money + answer-mail entirely in PLOS.
- **READY-at-scale (later):** + heartbeat/autonomous sweeps (G2) + engine-driven dunning + verifier calibration (G8) → the system works *while the founder sleeps*.

## Recommended smallest path (do in this order)
1. **Merge #181** *(founder, 1 click)* → redeploy PLOS.
2. **Connect one Gmail sending mailbox** *(founder, one-time OAuth)*.
3. **Operational proof run** *(founder, ~5 min)*: open /room → pick a real overdue invoice → Follow up → approve → link the contact inline if prompted → send → confirm "✓ Sent" + the customer receives it. **← this is operational proof.**
4. **Then I build (small slices, engineer→QA→reviewer):**
   - **S-reply:** wire the mailbox `execute-reply` seam (#2) — closes the comms loop in PLOS.
   - **S-contacts:** `customer_contacts` auto-sync/backfill from Admin (#1) — removes per-send linking friction at volume (this is where the DPIA/Admin-source work earns its place).
   - **S-renewal:** symmetric contract-status gate for renewals (#4).
5. **Scale later:** heartbeat (G2) + engine-autonomous dunning + G8 calibration.

## Honest limits
- "LIVE end-to-end" is verified by code-path tracing + off-prod tests; the *prod* demonstration needs #181 merged + a connected mailbox (neither doable from here). The proof in step 3 is the real confirmation.
- The inline-link path makes the first proof DPIA-free (one founder-curated contact); the *bulk* `customer_contacts` sync still needs the DPIA — but it's a scale step, not a proof blocker.
