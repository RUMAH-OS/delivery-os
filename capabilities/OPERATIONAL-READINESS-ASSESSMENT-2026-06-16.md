# Operational Readiness Assessment — is the PLOS↔Admin command seam the next frontier? (2026-06-16)

> Founder-OS-level validation. Standard: a capability is not complete because it EXISTS — prove it is USED in
> production on real data, ownership functions, founder workflows are real, failure modes reviewed, lessons
> propagated. OPERATIONAL evidence, not implementation status. Challenge the convergence.

## VERDICT (challenged, not rubber-stamped)
**The PLOS↔Admin COMMAND seam is NOT the next frontier. It is premature.** Both systems concluded "command
seam" from BUILD status, not OPERATIONAL status — the exact error the standard warns against. The evidence:
Admin is operationally proven as a **System of Record + read/truth surface**, and **NOT proven as an operating
engine**; the **read seam has never run prod→prod** (PLOS consumer is wired to `localhost`, loop idle/stale
~594m); the **contract is single-sourced on the producer side only** (PLOS still has no `.claude/os`, no vendored
contract, fail-open Zod); and **newer events drain into a void** (`invoice.credited` has no PLOS handler).
**The real next frontier is OPERATIONAL VALIDATION** — make Admin operate, prove the read seam prod→prod, bind
the contract both ways. The command seam becomes sound only after those.

## 1. What is OPERATIONALLY PROVEN vs assumed
- **PROVEN (real prod data):** the 2026-06-12 cutover into prod SoR `clfocpodfbtgzivnivck` — 2 owners / 18
  properties / 14 tenants / 23 contracts / 9 signings / 18 invoices / 5 payments, reconciliation EXACT
  (`CUTOVER-EXECUTED.md`). The read/truth seam answers correctly on real data (PLOS-token `/v1/ops/attention`
  → 7 overdue = €2,441, hand-verified). **Admin is a real System of Record.**
- **NOT PROVEN:** every action that touches the outside world — see §2/§3.

## 2. Per-capability (Built · Operationally-used · Founder-workflow · Ownership · Failure-modes · Inheritance)
| Capability | Built | Op-used in PROD | Founder workflow real | Ownership | Failure modes | Inherit | Flag |
|---|---|---|---|---|---|---|---|
| Properties | Y | read YES; edit NO | NO (no edit UI in prod) | SoR ✓ | partial | dev | READ proven, EDIT not |
| Tenants | Y | data YES; edit unused | NO | SoR ✓ | weak (no audit) | dev | not op-proven |
| Owners | Y | data YES; lifecycle dev-only | NO | SoR ✓ | partial | dev | impl, not op-proven |
| Contracts | Y | read YES | partial (create/extend not prod-proven) | SoR ✓ | reviewed | dev | most mature |
| Invoices | Y | data YES; gen=manual, **send=no-op** | partial | SoR ✓ | strongly reviewed | dev | data proven, workflow+send NOT |
| Payments | Y | data YES; reversal dev-only | NO | SoR ✓ | reviewed | dev | impl, not op-proven |
| Signing | Y | migrated; **0 captured post-cutover**; 2 in-flight not re-sent | NO | SoR ✓ | heavily reviewed | dev | not op-proven |
| Company health | Y | endpoint live; **consumer-side use not evidenced** | N/A (Room's) | boundary ✓ | reviewed | dev | live, consumption unproven |
| Renewal reminders | **partial** (fact-emit only, no email, no scheduler, no drain) | NO | NO | boundary ✓ | reviewed | dev | latent |
| Room payment visibility | Y (PLOS render code) | **NO** (read seam points localhost; loop idle/stale) | NO | boundary ✓ | reviewed | — | latent in prod |

## 3. IMPLEMENTED BUT NOT OPERATIONALLY PROVEN (the honest list)
1. **All Wave-2 work this session** (tenant/property/owner detail+edit, invoice detail, payment reversal,
   credit-notes, legacy delete) — slice-PASS + test-DB-verified + shipped to **dev**; a gate is not real use.
2. **Email delivery** — `RESEND_API_KEY` not set in prod → `sendMail` no-ops → **nothing reaches a tenant**.
   The founder's #1 pain (invoicing that actually arrives) is NOT proven end-to-end.
3. **Reminders + invoice generation** — no scheduler (every cron is a "later" comment); manual, fact-only.
4. **Signing on real data** — zero signatures captured natively post-cutover; 2 in-flight legacy not re-sent.
5. **The READ seam prod→prod** — PLOS `.env` `ADMIN_*_URL=http://localhost`; drain loop `idle (drained=0)`,
   monitor `handoff stalled ~594m`. Never run against `rumah-admin.vercel.app` with prod tokens.
6. **Contract inheritance in PLOS** — PLOS has NO `.claude/os`, does NOT vendor the contract, does NOT call
   `validateSeamBatch`; consumer is fail-open Zod mirrored by prose. Producer single-sourced; consumer not.
7. **`invoice.credited` (and reverse transitions)** — in the contract + fixtures, but NO PLOS consumer →
   drained into a durable void (capability-#16 / LC-1 lesson: missing inverse transition, invisible to
   per-event validation).
8. **Production-usage observability** — no audit log, no operator-action log. We cannot PROVE use of any write
   path because nothing records it. (We have V6-mechanism telemetry, not business telemetry.)
9. **`main` branch is stale** (frozen 2026-06-11; prod tracks `dev`) — a `main`-based rollback would erase prod.
10. **Public Inventory API** — `/v1/inventory` returns 404 in prod (regression vs the cutover validation).

## 4. Is the COMMAND seam the next bottleneck? — NO, not yet
A command seam is a WRITE path PLOS→Admin. Building it now would: (a) stack a write path on a read substrate
that has **never run against production**; (b) add a SECOND prose-synced contract in the more dangerous (write)
direction while the read contract is single-sourced on one side (the pdfRef incident already detonated this
class past two green VERIFYs); (c) demand round-trip lifecycle handling while the existing event lifecycle
already drains into a void. The convergence was build-convergence; operationally the substrate isn't ready.

## 5. The ACTUAL next frontier — OPERATIONAL VALIDATION ("make it real")
**Problem statement:** the components and the seam are build-/dev-verified, but **no founder workflow has run
end-to-end on real production data, nothing is delivered/scheduled/observed, and the read seam has never run
prod→prod.** Component-correctness ≠ workflow-correctness (the founder-burden lesson) — now confirmed at the
operational layer.

**What success looks like (operational, founder-visible):**
1. **One real invoice delivered** to a real/controlled recipient (set `RESEND_API_KEY` in prod).
2. **One reminder fired by a scheduler** (wire pg_cron/pgmq → `reminders/run`; drain the outbox).
3. **One signature captured natively** post-cutover (re-send the 2 in-flight signings).
4. **The read seam proven prod→prod** — point PLOS at `rumah-admin.vercel.app` with prod tokens; the drain loop
   clears its stale-WARN; the Room renders real prod payment facts to the founder.
5. **Operator-action audit logging** so use is observable (close the production-observability gap).
6. **Contract bound both ways** — PLOS vendors `admin-plos-seam-v1.mjs` + `validateSeamBatch` + cross-repo hash;
   `invoice.credited` gets a real consumer.

**Risks it resolves:** shipping blind (no observability); the founder's #1 pain unproven; building a command
seam on an unvalidated read substrate; a prose-synced contract detonating in the write direction; a stale-`main`
rollback erasing prod.

**What it unlocks:** a trustworthy operational baseline + a prod-proven, contract-bound read/event seam — which
is the *precondition* that makes the COMMAND seam sound.

## When the COMMAND seam DOES become the frontier (for the record)
After §5: **Problem** — the founder/Room can SEE Admin truth but cannot ACT on it (e.g. trigger a send, record
a decision) without leaving the Room. **Success** — a PLOS→Admin command (e.g. "send this invoice now") executes
through the seam, fail-closed, idempotent, author-gated, audited, with the result visible. **Risk resolved** —
the founder operating from one surface instead of stitching systems. **Unlocks** — Jarvis-style cross-system
action. But only on a read seam proven prod→prod and a contract bound both ways.

## Lessons propagated?
Partially. The producer-side seam contract + gate are single-sourced (good). But the consumer-side contract
binding never landed in PLOS, and the round-trip-handshake lesson (one real emit→drain→consume) is surfaced but
not yet enforced cross-repo. Propagation is incomplete on exactly the axis the command seam would depend on.
