---
review_type: foundation-review
capability: "Admin → PLOS invoice-delivery pipeline — architectural foundations"
date: "2026-06-26"
author: "implementation-session (coordinated)"
status: foundations-validated
---

# Foundation Review — Admin→PLOS Invoice Delivery (architectural foundations)

> Validates the capability against Delivery OS foundational invariants. Cross-refs: root cause
> `rumah-admin/docs/INVOICE-DELIVERY-PIPELINE-ROOTCAUSE-2026-06-26.md` · Founder Review (decisions A–D) ·
> Learning Review (lessons + candidates) · conformance audit (4 MUST-FIX gaps).

## 1. Foundational invariants — does the architecture hold?
| Invariant (North Star §3) | Holds? | Notes |
|---|---|---|
| **One source of truth per concern** | YES (with decision A) | Admin = SoT for the *package* (recipient, render, PDF, money); PLOS = SoT for *communication execution* (send, track). The one ambiguity — who owns *delivery state* — is decision A (frozen-contract: delivery log authoritative vs ADR-0005: callback mutates invoice). |
| **Admin renders, PLOS executes (ADR-0005)** | YES (after the fix) | The composer-fallback business-rendering on PLOS (the dual-IBAN hazard) is removed → gate-on-failure. PLOS now previews/sends Admin's bytes verbatim; zero business rendering. |
| **Immutable package** | YES (after the fix) | Freeze-at-issue + `version` + sha256 content hash + invoiceId + timestamps + tracking id (migration 0050). Previously re-rendered live each fetch — a foundational gap now closed. |
| **Seam = versioned, fail-closed contract** | YES | `admin-plos-seam-v1.mjs` additive-evolved (deliberate); the package gains an explicit `packageVersion`. Transport = the proven pull seam (`/v1/events` + cursor + at-least-once + idempotency-by-id). |
| **No silent stop / honest state** | RESTORED | The two faults were exactly silent stops (queue 500 swallowed; serverless loop never fired). The cron + the migration restore the path; the gate-on-failure surfaces an honest "package unavailable" rather than a divergent send. |
| **Reuse over rebuild** | YES | Reuses the invoice engine, the outbox, the cursor/inbox idempotency, the delivery log, the dunning-sweep cron pattern, the snapshot-freeze pattern. No parallel machinery. |
| **Verification operationally enforced (§12)** | YES (and improved) | Each impl slice carries an independent VERIFY; and the review-trigger capability now makes Foundation/Founder/Learning Review auto-fire for L2 — closing the meta-gap that let this very change go unreviewed. |

## 2. Inheritance / propagation validated
- The InvoiceDeliveryPackage is consumed by PLOS unchanged (fetch-only); the package schema (version/hash/ids)
  propagates as additive seam fields — no breaking change to existing consumers.
- The delivery callback + the `/v1/events` cursor are reused unchanged; idempotency is layered (event-id inbox,
  per-invoice send-dedup, callback (eventId,status) dedup) — no double-send across the chain (pending e2e proof).
- The owner-invoice seam (`owner_invoice.send_requested`) is a sibling and out of scope — unaffected.

## 3. Architectural soundness call
**Sound, with decision A open.** The canonical "Admin SoT + immutable package, PLOS executes only" is the right
foundation and is now enforced in code (not just an ADR). The single foundational tension is **delivery-state
ownership** (A) — two ratified contracts disagree; resolving it (recommend: delivery-log-authoritative, read-overlay
reflects delivery, `/resend` reads the log) makes the SoT boundary clean. Decisions B/C/D are operational, not
foundational. No new foundational debt is introduced; one pre-existing gap (live-rendered package) is retired.

## 4. Completion gate
Foundations validated. Final production verification (e2e Vishoek 3 all stages + full regression + the A–D
resolutions implemented + their VERIFYs) is required before the capability is declared complete — appended on close.
