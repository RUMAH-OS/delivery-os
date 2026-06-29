---
name: linkedin-outreach
version: 0.1.0
stability: experimental
description: >
  Run PLOS-driven LinkedIn relationship outreach as a stateful, human-in-the-loop loop: for each lead PLOS
  surfaces, send a connection request, later detect whether they accepted (added you back), and once accepted
  send a lightly-personalised message — recording EVERY step back in PLOS (the system of record). Operator-driven
  via Claude-in-Chrome on the founder's authenticated browser; NOT an unattended bot. Invoke to run an outreach
  pass over the current PLOS queue, or to check pending acceptances.
owner: property-lead-os (PLOS owns the lead lifecycle + templates + state; this skill is the operator ARM)
surface: Claude-in-Chrome (live, logged-in browser) + PLOS "The Floor" + LinkedIn
inputs:  [the PLOS Floor queue + per-lead state, each lead's LinkedIn profile URL (PLOS provides it), the founder-set message template]
outputs: [LinkedIn connection requests sent · acceptances detected · post-accept messages sent · every step recorded in PLOS ("done today" / "waiting on LinkedIn" / messaged)]
earned_from: "First real run 2026-06-29 — Eva Marx (Project Support Medewerker, Dura Vermeer Railinfra): connect request sent via her profile (Meer → Connectie maken → Verzenden zonder opmerking) then recorded in PLOS (Send request → Send request (no note)). PLOS's own card states the model: 'You send it in LinkedIn — this records it.'"
guardrails: "ToS-aware, low-volume, founder approves EVERY outward send, daily cap, never bypass bot-detection/CAPTCHA"
---

# LinkedIn Outreach (PLOS-driven, human-in-the-loop)

## What this is — and is NOT
A **repeatable operator procedure** for working PLOS's outreach queue. PLOS is the **brain + system of record**
(lead list, per-lead state, message template, "register everything"); this skill is the **arm** that executes the
LinkedIn steps in the founder's live browser and writes the result back to PLOS.

It is **NOT** an unattended/scheduled bot. It needs the founder's logged-in browser + Claude-in-Chrome live + the
founder present to approve sends and clear any CAPTCHA. LinkedIn's ToS prohibits automation, so this stays
**low-volume, human-paced, founder-approved**. If asked to run it headless / on a cron / at scale → refuse and
explain the account-restriction risk.

## The state machine (per lead — PLOS owns it)
```
queued → request_sent → accepted? ──yes──→ messaged → done
                          └── no (still pending / expired) ──→ leave waiting / nudge later
```
PLOS already surfaces this: a lead card's action ("Send connection request"), a "X done today" counter, and a
**"N waiting on LinkedIn"** list = the acceptance-check work queue.

## Guardrails (non-negotiable)
1. **Founder approves EVERY outward send** — each connection request AND each message. Show the exact target
   (name + profile URL) and, for messages, the exact text BEFORE it fires. (Founder chose "approve each send".)
2. **Daily cap + cadence** — default **≤ 15 connection requests/day** and **≤ 20 messages/day**, with a short gap
   between actions. Never fire a burst. If the cap is hit, stop and report.
3. **Verify identity before any send** — open the profile PLOS links and confirm name + company + role match the
   PLOS card (avoid wrong-person sends).
4. **CAPTCHA / checkpoint / "unusual activity" → STOP** and hand back to the founder. Never attempt to solve or
   evade bot-detection.
5. **Record every step in PLOS** — a send that isn't logged in PLOS doesn't count. PLOS is the source of truth.

## RUN PROCEDURE

### 0. Set up
- `tabs_context_mcp` (createIfEmpty). Use the founder's existing LinkedIn session — never log in, never touch the
  password/token. Confirm logged in (LinkedIn top nav shows Home/Mijn netwerk/Berichten/Ik).
- Open PLOS Floor: `https://property-lead-os-bkasanwiredjos-projects.vercel.app/`. Read the queue + states
  (`read_page` interactive). Each lead card exposes an "Open …'s LinkedIn profile" link (the canonical URL) and
  the next action.

### A. CONNECT  (lead state: queued)
1. From PLOS, take the lead + its LinkedIn URL. Open the profile; verify identity vs the card.
2. **Pause → founder approves** sending this connect.
3. Send on LinkedIn: profile → **Meer** (More) → **Connectie maken** (Connect) → in the dialog
   **Verzenden zonder opmerking** (Send without note) — or **Opmerking toevoegen** if the founder wants a note.
   Confirm the button flips to **In behandeling / Pending**.
4. Record in PLOS: on the lead card click **Send connection request** → it expands ("You send it in LinkedIn —
   this records it") → **Send request (no note)** (or "Write a note"). PLOS increments "done today" and adds the
   lead to **"waiting on LinkedIn"**.

### B. ACCEPTANCE CHECK  (lead state: request_sent / "waiting on LinkedIn")
> Acceptance takes hours-to-days — never expect it seconds after sending.
1. For each "waiting" lead, open their LinkedIn profile.
2. **Accepted signal:** the profile now shows **1ste graad (1st degree)** and a plain **Bericht / Message** button
   with **no "In behandeling / Pending"**. (Cross-check: founder's **Mijn netwerk → Connecties** list.)
3. If accepted → in PLOS use the lead's **"Log what happened" / Log outcome → "Accepted"** action. This records
   `linkedinAcceptedAt` + flips the outreach `status` to `accepted`, and PLOS then surfaces the **send_first_message**
   stage (the accepted lead floats to the top of the Floor). Proceed to C. If still pending → leave it waiting
   (drop/nudge is a founder call).
   > PLOS model: `send_connection` (channel `linkedin_connection`) → `awaiting_acceptance` (derived from
   > `linkedinAcceptedAt` null) → log "Accepted" → `send_first_message` (channel `linkedin`). Don't invent states —
   > use these.

### C. MESSAGE  (lead state: accepted)
1. Compose from the **founder-set template** (below), **lightly personalised** (first name, company, role, a
   specific hook from their profile/recent post if obvious).
2. **Pause → founder approves the exact message text.**
3. Send: profile → **Bericht / Message** → paste → send. (Keep it short; the connect note, if any, was the opener.)
4. Record in PLOS as messaged (advance the lead → done).

### D. Close the pass
Report: how many connects sent, acceptances detected, messages sent, what's still waiting, and whether the daily
cap was hit. Everything reflected in PLOS.

## Message template  (FOUNDER-SET — the real opener)
A short, casual qualifying opener — **language chosen PER LEAD** from their profile. One line only; it's an
opener question, not a pitch. No links.

**Dutch** (default — these are Dutch employers):
```
Hoi {voornaam}, ben jij degene die gaat over de huisvesting van buitenlands personeel?
```
**English** (only for clearly international / English-language profiles, or a lead based outside NL):
```
Hi {voornaam}, are you the one who handles housing for international staff?
```

**Language rule:** default **NL** when the profile is Netherlands-based / Dutch company / Dutch headline. Use
**EN** only when the profile/headline is clearly English or the person is based outside NL. When unsure → **NL**.
Only token: `{voornaam}` (first name; drop "Hoi {voornaam}," → "Hoi," if no clean first name). Founder still
approves the exact text per lead before it sends.

## PLOS is already the brain (verified 2026-06-29)
PLOS (Next.js + Postgres/Drizzle monorepo) ALREADY owns the lifecycle — no migration needed:
- Two-stage flow `send_connection → awaiting_acceptance → log "Accepted" → send_first_message` (floor verbs in
  `apps/web/lib/floor.ts`; outreach status enum `…sent → accepted → replied → meeting` in `packages/core/src/enums.ts`).
- `outreach.linkedinAcceptedAt` (acceptance timestamp) and **immutable `outreach.messageBody`** (every sent message
  is recorded) — so "register everything" is native. The write path is `/api/outreach/send` + `/api/outreach/outcome`.
- **Deferred-by-design gap:** a reusable NAMED-template LIBRARY (`outreach.templateId` is a reserved, unused column;
  messages are AI-drafted today). NOT required for this skill — the opener lives here and PLOS records what's sent.
  Build the library only if the founder wants reusable named templates picked on the Floor (a real PLOS slice:
  migration 0019 + `message_templates` table + CRUD API + Floor picker → must clear PLOS CI + verify-gate + review).

## Make-it-durable roadmap
- **Capability ledger:** new capability candidate — run `learning-review` after a few real passes to harden the
  cadence cap, the acceptance-signal heuristics, and the template.
- **Do NOT** evolve this into a scheduled/headless sender (ToS + account risk). Human-in-the-loop, founder-approved,
  capped IS the design, not a limitation.
