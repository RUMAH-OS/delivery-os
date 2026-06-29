---
review_type: founder-review
capability: "Admin → PLOS invoice-delivery pipeline — incident fix + architectural completion"
date: "2026-06-26"
author: "implementation-session (coordinated)"
reviewer: "founder — A-b RATIFIED 2026-06-27"
status: "ratified A-b · queue hydrated + testable · admin-hardening deploy completing"
---

# Founder Review — Admin→PLOS Invoice Delivery

## ✅ FINAL STATUS (2026-06-27) — founder-facing summary

**Decision RATIFIED: A=b** — the invoice row is the immutable financial source of truth; the delivery
callback RECORDS to the delivery log (never mutates the invoice); the Admin UI OVERLAYS delivery status;
`/resend` reads the log.

**GO** — proven end-to-end on live production:
- **Review queue is HYDRATED + testable NOW** — ready rows show Admin's complete package (recipient + email +
  fully-rendered body + PDF + metadata); PLOS renders nothing. Open PLOS `/room/invoices` → review → Confirm.
- **Full e2e PROVEN** (test invoice `2026-0065` → founder mailbox): Admin publish → event transport → immutable
  package → fully-hydrated queue → Confirm → SMTP (Gmail messageId) → mailbox → delivery callback → Admin
  `delivery` row `status=sent`. `pdfAttached:true`, `outcomePosted:true`; invoice row stayed immutable.
- **6 root causes** found + fixed (the screenshot symptom = a `{data}` seam-envelope mismatch in PLOS's package
  parser). Full list in the root-cause doc.

**Still completing (last mile):** the Admin A=b hardening deploy (immutable InvoiceDeliveryPackage freeze + send
dedup + tracking-key persistence) — merged to `main`; the Vercel prod deploy is finishing (delayed by the
dogfooded gate's slice-evidence → verify_doc → seam-parity → verify-freshness → squash-merge-coverage checks,
each of which caught a genuine defect). Duplicate queue rows collapse once the dedup lands. The final regression
+ the tracking-persistence e2e confirmation are the remaining steps.

> Cross-refs: root cause `rumah-admin/docs/INVOICE-DELIVERY-PIPELINE-ROOTCAUSE-2026-06-26.md` · lessons
> `docs/LEARNING-REVIEW-invoice-delivery-2026-06-26.md` · architecture audit (conformance table, 4 MUST-FIX).

## 1. What happened (founder-facing)
Invoices "sent" from Admin never reached PLOS for review, so **no customer received an invoice** since the
cutover. Operators saw "queued" but nothing was delivered. Two PLOS-side faults: a **missing prod migration**
(the Review queue 500'd) and **no autonomous drain in production** (a serverless-incompatible in-process loop).

## 2. Decision: go / no-go
**Architecture: GO** — the ratified contract (Admin = single source of truth producing one immutable
InvoiceDeliveryPackage; PLOS executes only, zero business rendering) is correct and is now being enforced in
code (immutable package + version + content hash; callback updates Admin status; gate-on-failure; dedup).
**Production go-live: PENDING final verification** — e2e on Vishoek 3 (publish→…→customer mailbox→callback→Admin
status) + full regression must pass before declaring complete (appended on completion).

## 3. Architectural decisions taken (ratified by the founder's canonical-architecture restatement)
| # | Decision | Resolution |
|---|---|---|
| Immutable package | freeze-at-issue + `version` + sha256 content hash + invoiceId + timestamps + tracking id | **adopted** — PLOS previews exactly the bytes it sends |
| Delivery-state ownership | the PLOS delivery callback flips Admin `status→sent/delivered + emailSentAt`; `/resend` works off it | **adopted** |
| Fallback policy | **gate-on-failure** (no send, no divergent render) — kills the dual-IBAN misroute | **adopted** (PLOS zero business rendering) |
| Dedup | per-invoice send-request guard + stable idempotency key | **adopted** |
| Recipient authority | Admin's frozen recipient on the package; verify on a real tenant in the e2e | **adopted, verify-pending** |

## 4. Genuinely-open founder decisions

**(A) Delivery-state ownership — TWO ratified positions contradict.** ADR-0005 + the send-endpoint's own comment +
your restated architecture say the PLOS callback should **update Admin's invoice status→sent**. But a *later
frozen* contract (`docs/design/admin-delivery-outcome-contract.md`, 2026-06-13) ratified the **opposite**: "no
invoice column updates — the delivery log is authoritative" (the invoice status is read-overlaid from the delivery
log; QA test `deliveries-seam-qa Condition 5` enforces no-mutation). The Admin build implemented the ADR-0005
behavior (callback mutates the invoice), which breaks that frozen contract + its test.
  - **Option (a):** callback mutates the invoice → `sent` (built; simple; **reverses the frozen contract**).
  - **Option (b) — RECOMMENDED:** keep the delivery log authoritative (preserve the frozen contract), have the
    read-overlay already reflect "sent/delivered" from the log, and **rewrite `/resend` to read the delivery log**
    (not `emailSentAt`). Satisfies "Admin reflects delivery" + "lifecycle → delivered" WITHOUT mutating the
    immutable invoice. Your call — which contract wins.

**(B) A true invoice `delivered` status?** The invoice CHECK is `prepared|issued|sent|void|scheduled`; the build
maps both `sent` + `delivered` callbacks to invoice `sent` (the granular `delivered/bounced/failed` stays on the
`delivery` log + timeline). Adding a real `delivered` status is a **money-class change** (CHECK + immutability
trigger + transition table + lifecycle tests). **Recommend: defer** (keep delivered→sent + the log) unless you want
the invoice lifecycle itself to carry `delivered`.

**(C) Transport frequency / mechanism.** The drain is now a Vercel cron, but **Hobby caps crons at once/day** — too
slow. Options: (1) **external free scheduler** every ~5 min — $0, no plan change, zero code change *(recommended
interim)*; (2) Vercel Pro (~$20/mo) → `*/5`; (3) **Admin→PLOS push webhook** on emit — cleanest, cross-repo
*(recommended long-term)*. Shipped daily as the floor; **your call on 1/2/3.**

**(D) Dedup window** — the guard protects the in-flight window only; after a settled outcome a fresh `/send`
legitimately re-emits, and `/resend` is exempt. Confirm this boundary.

## 5. Governance decisions (the review-trigger capability)
This change should have auto-fired a Founder/Learning Review and didn't — the classifier ran in SHADOW with a
`contracts/`+`migrations/` hole. Fixed + promoted SHADOW→ENFORCE (recorded in GOVERNANCE §14 / ADR-003). Sub-decisions
defaulted + reversible: enforce-on by default (your complaint = that decision); the gate proves a review *exists*
+ is non-shell, not that it is *truthful* (a human limit, §12); all-three-reviews-per-L2 is the current default —
tune the marker→posture map if false-fire rates warrant.

## 6. Evidence & completion gate
Root cause + per-stage evidence: see the root-cause doc. Final sign-off requires: e2e Vishoek 3 (all 10 stages,
customer receives PDF, no duplicate events/sends, immutable history preserved, lifecycle → delivered) + full
regression (generation · package · transport · queue · resend · reminders · tracking · callbacks · audit ·
event history) — appended here on completion.
