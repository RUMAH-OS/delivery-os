# G8 Seam-Contract RCA + Remediation (integration-architect, 2026-06-15)

> Read-only investigation. Decision-grade. Gates G8 PLOS propagation.

## Verdict (one line)
PLOS validates the Admin→PLOS drain with a hand-written Zod schema that is **structurally weaker than, and never reconciled against, the canonical executable contract** — a drift/omission (NOT a deliberate divergence) that re-opens the FV-4/FV-5/LC-1 class the contract was earned to close. Fix is mechanical (reuse `os-inherit`).

## 1. Root cause
- **Timeline proves drift, not design:** PLOS consumer built `0984b56` (2026-06-13 04:54), one day BEFORE the canonical contract `d7d50f6` (2026-06-14 04:54). It was written against the PROSE ECR-0006 §A envelope because no executable contract existed yet — reasonable then, wrong the moment the contract shipped, never repointed.
- **No distribution reached PLOS:** PLOS has no `.claude/os/` at all; `os-inherit` has never run there. Admin closed the gap for itself (vendored, sha256 `412ca9…`, INHERITED.json); PLOS was left behind. Cross-repo distribution was explicitly deferred in the contract header.
- **Consumer design is deliberately tolerant → fail-open:** private Zod uses `.passthrough()` + `payload: z.record(z.unknown()).nullable()` (`admin-events-consumer.ts:42-71`); the body is written verbatim into `admin_event_inbox.payload` (`apps/web/lib/admin-events.ts:80`) with no per-type validation.

## 2. Risk assessment
| # | Risk | Severity | Detonation |
|---|---|---|---|
| R1 | HTML in a text field (FV-4) accepted | **Critical** | `invoice.send_requested.notice.body` with `<p>` passes; canonical HTML_TAG_RE never runs consumer-side |
| R2 | PII leak (ECR-0006 §2) accepted + persisted | **Critical** | `tenant{name,email}`/`iban` written to inbox; canonical scanPii never runs — fail-open |
| R3 | Malformed/missing-required (FV-5) accepted | High | `send_requested` with no `notice` passes |
| R4 | Unknown event type accepted | High | typo/un-ratified type drains silently; canonical rejects by design |
| R5 | Lifecycle drift invisible (LC-1, #16) | High | a missing inverse transition can't be seen per-event |
| R6 | False-reject / semantic v2 drift | Medium | versioned event persisted as if v1 |
| R7 | **Drift invisible until prod — founder detonation** | **Critical (meta)** | producer & consumer validated against two different "valid"; both green; founder integrates the disagreement live |

Headline asymmetry: **Admin fail-closed against canonical; PLOS fail-open against a private subset. A one-sided contract is not a contract.**

## 3. Remediation (reuse os-inherit; no new mechanism)
1. `os-inherit sync --from ../delivery-os --into .` in PLOS → vendors the contract + seam-gate byte-for-byte, writes PLOS INHERITED.json with the identical sha256 `412ca9…`. Cross-repo hash-equality is then transitive via `os-inherit check` in both CIs.
2. **Repoint the drain** (`apps/web/lib/admin-events.ts writePage`) to call `validateSeamBatch(events)` from the vendored contract BEFORE the inbox insert; `!ok` → existing `bad_contract` path (503, cursor unmoved). **The load-bearing change** — vendoring bytes nobody imports closes nothing.
3. PLOS `seam:check` script + **blocking** CI lane (mirror Admin `scripts/seam-check.ts`).
4. PLOS `os-inherit check` in CI (drift gate).
5. CODEOWNERS bind the consumer + vendored `.claude/os/tools/**` (author≠verifier at the seam).

## 4. Required Admin changes
**None for correctness** (already single-sourced + hash-checked + CODEOWNERS-bound). One non-blocking accuracy fix: the canonical contract header's "cross-repo distribution OUT OF SCOPE" comment is stale once PLOS inherits — fix on the next deliberate contract edit, don't gold-plate.

## 5. Required PLOS changes (load-bearing set)
- Vendor the contract (step 1 output; no hand-edit).
- Repoint the drain to `validateSeamBatch`, fail-closed (`apps/web/lib/admin-events.ts`).
- Demote the private Zod to envelope-only (cursor/dedup needs only `id`/`meta`); canonical is the authority for per-type/PII/encoding/lifecycle.
- `seam:check` script + blocking CI (PLOS has none today).
- `os-inherit check` in CI.
- CODEOWNERS seam binding (PLOS has none today).

## 6. Delivery-mindset verdict
- **MUST (collapses R1–R5,R7):** vendor + repoint-drain-to-validateSeamBatch + PLOS seam:check blocking CI.
- **SHOULD (same PR, cheap, prevents regress):** os-inherit check + CODEOWNERS.
- **SKIP:** the stale Admin header comment; over-refactoring the working stateless client.
- **Staging:** G8 may propagate the *mechanism* (os-inherit reaching PLOS) first, but **G8 is not CLOSED until the MUST set is green on PLOS's real drain and QA has independently re-run the gate on BOTH sides.** Negative test: a crafted HTML/PII/missing-notice batch must FAIL `bad_contract` in PLOS where today it silently accepts.
- **Honest caveat:** risks demonstrated by code path (read-only), not a live failing run; QA to confirm with a crafted batch before/after.
