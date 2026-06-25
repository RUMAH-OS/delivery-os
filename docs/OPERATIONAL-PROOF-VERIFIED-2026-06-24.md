# Operational Proof — VERIFIED with evidence (2026-06-24)

> Five specialized agents independently verified the `OPERATIONAL-PROOF-PATH` claims (workflows · founder-experience ·
> integrations · evidence-audit · regressions). This supersedes the optimistic claims in that doc where they diverge.
> **Headline correction:** the money loop is **WIRED to a real Gmail send (not a stub) — but it has NEVER closed in
> production, and "merge #181 + connect a mailbox" is NOT sufficient.** The honest status is **WIRED-BUT-GATED** behind
> one real code/build fix + several config items + one linked contact.

## What the verification CONFIRMED (claims that held)
- **The send path is REAL, not prepare-only.** Execute genuinely calls `productionReplySendPort` → `sendGmailReplyKeyless` → googleapis `messages.send` (`business-actions.ts:498`, `mailbox-send-port.ts:98`). Not a stub. *(workflows)*
- **65/65 off-prod real-path tests pass** — real `invoice_sends` ledger writes, byte-verbatim RFC822 body, idempotent single-send, stop-on-paid. *(workflows + evidence-audit re-ran 18 dunning + 6 pooler + recovery C1–C6 green today.)*
- **Admin→PLOS seams are contract-conformant + PII-free** (`/v1/ops` `ops:read`; events `events:read`; producer emits the full notice payload). *(integrations)*
- **The mailbox-reply path IS wired** (contradicting the earlier "not wired" claim). *(founder-experience)*

## What the verification CORRECTED (claims that were wrong/overstated)
1. **"LIVE end-to-end in prod" — FALSE.** The only real prod run (`49983faa`, recorded in `property-lead-os/docs/runbooks/PLOS-PROD-E2E-EXECUTED-2026-06-24.md`) was **`no_send_no_money / gated_honestly`** — prepare-only, empty email. **No real Gmail send has ever executed in prod.** *(workflows)*
2. **"Just merge #181 + connect a mailbox" — INSUFFICIENT.** One reminder also needs `ADMIN_OPS`+`ADMIN_EVENTS` env, `INVOICE_SEND_MAILBOX`, and **one linked contact** (the silent killer). *(integrations)*
3. **"Mailbox reply NOT wired" — WRONG.** It IS wired; a **UI state-lie** ("Sending isn't enabled yet — lands in M1.3") shown next to a working "Approve & send" button masks it — and almost certainly fooled the original mapping. *(founder-experience)*
4. **"Link a contact inline" — only HALF true.** Works on the invoice surface; on the `/room/business` surface the gated reason renders as **dead text with no input** (dead-end for a new customer). *(founder-experience)*
5. **"Proven" ≠ on main.** All PLOS proof work rides one unmerged branch (`feat/s1.3-delivery` + PR #181); **none is on PLOS `main` or in prod.** A clean checkout of main reproduces none of it. *(evidence-audit)*

## Per-workflow prod-executability (verified)
| WF | Can it run E2E in prod TODAY? | Send path | Where it breaks (cited) |
|---|---|---|---|
| **W1 Overdue reminder** (band→business/execute) | **WIRED-BUT-GATED** | REAL (`business-actions.ts:498`) | googleapis bundle · `ADMIN_OPS_TOKEN` · linked contact · connected mailbox · #181 deploy |
| **W2 Invoice reminder/resend** (invoice-surface) | **WIRED-BUT-GATED** | REAL (`invoice-surface-actions.ts:359`) | same; **this is the gold UI** (preview + readiness + inline link) |
| **W3 Contract renewal** (expiring) | **WIRED-BUT-GATED** | REAL (same route, renewal profile) | same + Admin expiring rows + per-tenant contact |
| **W4 Inline link-contact** | **FULLY-WIRED (no send)** | n/a | gated on `ADMIN_OPS_TOKEN` (derives tenantId) |
| **Mailbox reply** | **WIRED but UI-masked** | REAL (`mailbox-actions.ts:355`) | the state-lie tells the founder it's off |

## The blockers, by class (verified)
### Code/build (mine to fix; ~hours each)
- **B1 — `googleapis` not in the Vercel bundle** → `/api/mailbox/authorize` 500s → **cannot connect a mailbox or send.** The ONE true code blocker to a first send. *(workflows; `gmail-mailbox.ts` dynamic imports)* — **~few hours (externalize/bundle googleapis).**
- **B2 — mailbox-reply state-lie** → comms loop silently disabled in the founder's perception. *(FX; `mailbox-actions.ts:193,304`)* — **~1-2h.**
- **B3 — Room band mis-routes the chase** to the weak/dead-end `/room/business` instead of the gold `/room/invoices/[id]`. *(FX)* — **~0.5-1d (deep-link) .**
- **B4 — `window.location.href` hard-nav** re-runs force-dynamic reads. *(FX)* — **~1h.**

### Founder config / gesture (only the founder)
- **C1** — set `ADMIN_OPS_URL`/`ADMIN_OPS_TOKEN` + `ADMIN_EVENTS_URL`/`ADMIN_EVENTS_TOKEN` (else nothing to chase, no recipient key, drain inert).
- **C2** — set `INVOICE_SEND_MAILBOX`/`MAILBOX_OWNER` + connect ONE mailbox (OAuth; needs B1 fixed first).
- **C3** — set `ADMIN_UI_URL` (else Room drill-downs are dead text).
- **C4** — grant the seam token `invoice:read` if the PDF should attach (else body-only — non-blocking).
- **C5** — merge + deploy **PLOS #181** (EMAXCONN). **VERIFIED engagement:** main is `max:10` (2 instances × 10 > the 15-cap → EMAXCONN); the fix rewrites a `*.pooler.supabase.com:5432` URL → `:6543` and the `EMAXCONNSESSION` error name is *only* emitted by the Supabase session pooler — **near-proof prod is on that host, so the rewrite WILL engage.** Residual: a no-op (not harmful) if prod is on the direct host (unlikely given the error). *(regressions)*

### Data
- **D1 — one linked contact** for the target tenant (the silent killer; via the invoice-surface inline form, which needs C1).

## The single biggest blocker (cross-agent consensus)
**`customer_contacts` has no live feed.** It starts empty in prod; only manual linking or the gated privileged backfill writes it; the PII-free seams carry no email by design. It **gates every send** — connecting a mailbox + wiring the drain does nothing to lift it. For the *first* proof: link ONE contact manually (no DPIA). For *scale*: wire the privileged Admin contact-source backfill (DPIA-gated).

## The corrected SMALLEST path to operational proof (one real founder-driven reminder send)
1. **(code, me) Fix B1 — googleapis Vercel bundling** + (recommended) B2 state-lie. Verify off-prod. *(~0.5 day)*
2. **(founder) Merge PLOS #181 + deploy** the above → redeploy PLOS.
3. **(founder) Set env:** `ADMIN_OPS_URL/TOKEN`, `ADMIN_EVENTS_URL/TOKEN`, `INVOICE_SEND_MAILBOX`, `ADMIN_UI_URL`. *(minutes)*
4. **(founder) Connect ONE mailbox** (OAuth — works once B1 deployed). *(one-time)*
5. **(founder, in the app) Operate the gold path:** Room → **Invoices →** → a real overdue invoice → **Send reminder** → faithful preview → **Approve** → **link the contact inline** → **Confirm** → **"Sent"** + delivery-history row. **← operational proof.**
   - Requires Admin to actually be emitting overdue/invoice data (C1 + a real overdue invoice exists).

**Net effort to first real send: ~0.5–1 day of code (googleapis + state-lie) + founder config/gestures + Admin having real overdue data.** Not the "2 clicks" the proof-path doc implied.

## Recommended priorities
1. **B1 googleapis bundling** (unblocks mailbox connect/send — the gating code item).
2. **#181 merge + deploy** (EMAXCONN — surfaces reliable).
3. **Founder config C1–C3** + connect one mailbox + link one contact → **run the gold-path proof (step 5).**
4. **B2 state-lie + B3 band→invoice deep-link** (make the advertised path the working path; unlock comms loop).
5. **Then scale:** `customer_contacts` auto-sync (privileged backfill + DPIA), heartbeat (G2), engine-autonomous dunning, G8 calibration.

## Next implementation slices (engineer→QA→reviewer; builder never grades own)
- **S0:** B1 googleapis externalize → `/api/mailbox/authorize` 200 (verify on a preview deploy).
- **S1:** B2 kill the mailbox-reply state-lie + B3 Room→invoice deep-link + B4 router.push.
- **S2 (after founder config + proof):** harden — the non-conformant second event emitter (integration latent hazard), PDF token-scope decision.
- **S3 (scale):** `customer_contacts` auto-sync from Admin; heartbeat (G2); engine-autonomous dunning.
- **(capability)** the proposed **automatable experience-gate** (state-consistency / dead-end-gate / dead-link / hard-nav lints) — would have caught B2/B3/B4/state-lie mechanically.

## Evidence index
- Workflows: `business-actions.ts:414-526`, `mailbox-send-port.ts:75-127`, `business/execute/route.ts:77-81`, `PLOS-PROD-E2E-EXECUTED-2026-06-24.md:21-22,30-32`; 65/65 off-prod tests.
- Founder-experience: `room/page.tsx`, `business/business-surface-view.tsx:149`, `invoices/[invoiceId]/invoice-detail-view.tsx:310-359,490-565`, `mailbox/mailbox-surface-view.tsx:192`, `mailbox-actions.ts:193,304,355-399`.
- Integrations: `admin-ops-client.ts`, `events-api.ts`, `instrumentation.ts:51,64`, `customer-contacts.ts:39-51`, `invoice-send-actions.ts:472,776`, `admin.ts:1881-1889,2444`.
- Evidence-audit: 18 dunning + 6 pooler tests re-ran green today; recovery C1–C6 green; all four VERIFYs fresh + author≠verifier; **none merged to PLOS main**.
- Regressions (VERIFIED): EMAXCONN REAL on main (`client.ts:88` max:10) → FIXED-IN-#181 (`:46-63` rewrite, engages on session-pooler URL). **After #181, exactly ONE coded regression still blocks the smallest proof: `customer_contacts` empty** (`0023…sql` DDL-only; gate `business-actions.ts:455-462`) — solved by linking ONE contact. Discovery-off, `ADMIN_UI_URL`/3s-timeout, mailbox-never-synced + **DWD reauth are ALL by-design and do NOT block the founder-driven send** (`discovery-flag.ts`, `business-band.ts:169`, `sync-replies/route.ts:1-4`, `env.ts:160-179` — send uses the durable `oauth_user` lane, not the keyless DWD forwarder). Config preconditions to also hold: `ADMIN_OPS`/`ADMIN_EVENTS` env + a valid `INVOICE_SEND_MAILBOX` OAuth grant.

## Honest limits
- No agent could run against prod (gated); prod-executability verdicts are code-path + config analysis + off-prod test runs. The real confirmation is the step-5 gold-path run after B1 + config.
- "WIRED-BUT-GATED" means: the code will send a real email once B1 + the config/data preconditions hold — verified by tracing the real send port + 65 real-path tests, not by a prod send.
