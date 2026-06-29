---
review_type: learning-review
capability: "Admin → PLOS invoice-delivery pipeline (incident + architectural completion)"
date: "2026-06-26"
author: "implementation-session (coordinated)"
status: lessons-captured
---

# Learning Review — Admin→PLOS Invoice Delivery (production incident + architectural completion)

> Companion to `rumah-admin/docs/INVOICE-DELIVERY-PIPELINE-ROOTCAUSE-2026-06-26.md`. Captures framework-level
> lessons + OS candidates. Final production-verification evidence is appended on capability completion.

## What worked
- **Coordinator-first parallel tracing** isolated the break fast: an Admin-side trace + a PLOS-side trace +
  a live prod probe ran concurrently and converged (Admin healthy: 11 events with full refs + `/v1/events` 200;
  PLOS broken: queue 500 + `delivery` table empty). The empirical probe caught what code-reading alone missed
  (the `provenance` 500 the PLOS trace had not hit).
- **The architecture conformance audit** (vs the ratified ADR-0005 contract) surfaced 4 MUST-FIX deviations the
  bug-fix alone would have left in place — exactly the "don't stop after fixing the queue" the founder demanded.

## What failed (and the lessons)
1. **Prod schema-drift recurs and is invisible until something reads the missing column.** Migrations are authored
   + tested locally but not applied to prod — Admin `0047–0049` (a near-miss I caught only by re-verifying the prod
   schema) and PLOS `0035` (THIS production incident: the Review queue 500'd on `column "provenance" does not exist`).
   The deploy guarantees code parity but **not migration parity**.
2. **`loadEnv` silently resolves `--prod` to the test DB.** `db:migrate --prod` hit `localhost` because the dev-path
   precedence loads `.env.test` before `.env` when no ambient URL is set; "0 applied / up to date" was the test DB
   already migrated. Caught only by independently verifying the prod schema after.
3. **Integration-injected prod secrets aren't retrievable via `vercel env pull`.** PLOS's prod `DATABASE_URL` is
   injected by the Supabase Vercel integration at runtime → empty in the pull → can't run `drizzle-kit migrate`
   locally. The sanctioned path is a runtime migrate (a one-off secured route in the deployed app).
4. **Autonomous work built as an in-process `setTimeout` loop is structurally dead on serverless.** Vercel freezes
   instances between requests + the timer was `.unref()`'d, so the Admin-events drain never fired in prod; events
   were pulled only on a manual page-open. The comment claimed "autonomous drain STARTED" — true only on a
   long-lived server, which apps/web is not.
5. **A SHADOW governance control is theater.** The capability classifier (ADR-003) that should have fired a
   Founder/Learning Review for this L2 architectural change ran in SHADOW *and* had a `contracts/`+`migrations/`
   hole → fired nothing. No protection until promoted to enforce. (This is the founder's "I find it strange no
   review was triggered" — the control existed but didn't bind.)
6. **A ratified architecture needs conformance tests, not just an ADR.** ADR-0005 said "immutable package"; the
   code re-rendered it live each fetch with no version/hash, and the delivery callback never updated invoice
   status (breaking `/resend`). The design was right; nothing kept the implementation honest to it.

## OS candidates (feed the census/promotion machinery)
- `os_candidate`: **prod-migration-parity gate** — a deploy/CI check that the prod DB's applied-migration ledger
  equals the repo's migrations; fail/alert on drift. (Closes lessons 1, and the Admin near-miss.)
- `os_candidate`: **fail-closed prod-migrate target guard** — `--prod` + a resolved URL lacking the prod ref ⇒
  REFUSE (never fall back to test). (Lesson 2; already filed in `OS-FEEDBACK-delivery-and-owner-invoices`.)
- `os_candidate`: **serverless-autonomy doctrine/lint** — no in-process timers/loops for autonomous work on
  serverless; use platform crons/queues/webhooks. (Lesson 4.)
- `os_candidate`: **promote-or-delete SHADOW controls** — a SHADOW governance control older than N cycles must be
  promoted to enforce or removed (no permanent theater). (Lesson 5.) — *partially discharged this cycle: the
  review trigger was promoted SHADOW→ENFORCE.*
- `os_candidate`: **architecture-contract conformance tests** — a ratified ADR/contract must ship executable
  conformance assertions (immutability, no-business-rendering, callback-updates-status), enforced like VERIFY.
  (Lesson 6.)

## Routing
| Lesson | Layer | Destination |
|---|---|---|
| prod-migration drift invisible | Delivery OS (gate) | prod-migration-parity check in the deploy/verify gate |
| `--prod` migrate hits test | Delivery OS (guard) | extend guardProdDb / the migrate runner |
| integration-injected prod secrets | Delivery OS (doctrine) | sanctioned runtime-migrate mechanism, documented |
| serverless setTimeout autonomy | Delivery OS (lint/doctrine) | "no in-process timers on serverless" |
| SHADOW control = theater | Delivery OS (governance) | promote-or-delete policy on SHADOW controls |
| ratified contract not enforced | Delivery OS (checklist) | architecture-contract conformance-test requirement |

## Promotions proposed
None auto-promoted (each runs a scaled Principle-11 panel first). The **review-trigger SHADOW→ENFORCE** promotion
WAS made this cycle (the founder's complaint = that decision) and is recorded in `core/GOVERNANCE.md §14` +
`docs/adr/ADR-003-learning-review.md`. The prod-migration-parity gate is the strongest remaining candidate
(two observed near-misses + one production incident this cycle).
