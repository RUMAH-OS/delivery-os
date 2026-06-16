---
kuId: ku-sensitive-audit-append-only-at-the-db
title: An audit trail for a destructive or financial action must be append-only ENFORCED at the database, not by code discipline
kind: knowledge
status: active
version: 1
applies-to: [os]
claim: "An audit trail for a destructive or financial action must be append-only ENFORCED at the database — the runtime role may INSERT and SELECT audit rows but has NO policy permitting UPDATE or DELETE (RLS), so the rows are tamper-evident by construction — never merely protected by code discipline or a missing grant, because code can be bypassed and grants can be re-added, whereas a denying RLS posture holds even when the role holds the table-level privilege."
triggers:
  - "how do I make an audit trail tamper-proof"
  - "append-only audit log"
  - "should the audit table be protected by code or the db"
  - "RLS for an audit table"
  - "can the app role edit or delete audit rows"
  - "tamper-evident audit at the database"
  - "audit log for a destructive action"
  - "insert and select but no update or delete"
  - "is the audit protected by a missing grant"
topics:
  - sensitive-audit-append-only-at-the-db
  - rls-insert-select-no-update-delete
  - tamper-evident-by-construction
  - deny-is-rls-not-missing-grant
  - enforce-at-db-not-code-discipline
  - audit-trail-for-destructive-action
evidence-strength: runtime-evidenced
cited-quote: "The append-only property therefore comes from RLS (no permitting policy), exactly the tamper-evident design; it is not an accident of revoked grants."
source-provenance:
  earned-from: "wave4 legacy-invoice-delete Condition A (append-only audit RLS) 2026-06-16"
  source-file: "../rumah-admin/docs/verify/VERIFY-wave4-legacy-invoice-delete.md"
  anchor: "Condition A catalog (line 22, EXACTLY 2 policies insert+select); tamper probes (lines 32-35, UPDATE/DELETE → 0 rows RLS DENIED); deny-is-RLS-not-missing-grant (line 38); round-trip (line 40); scope (line 44); verdict RESOLVED (line 46)"
  signal-pattern: null
related:
  - ku-sensitive-changes-require-security-review
  - ku-issued-artifact-immutability
  - ku-record-only-state-the-action-achieved
  - ku-fail-closed-gates
tags: [security, audit-trail, append-only, rls, database-enforced, tamper-evident, destructive-action, financial]
---

# A sensitive audit trail must be append-only ENFORCED at the database — not by code discipline

> **Canonical source: `delivery-os/wiki/` (Founder OS). Apps inherit; this copy is identical — do not diverge.**

**Claim (the rule).** The audit trail for a destructive or financial action (a delete, a reversal, a credit
note, a balance change) must be **append-only, enforced at the database**: the runtime role may **INSERT** and
**SELECT** audit rows, but there is **NO policy permitting UPDATE or DELETE** (RLS), so the rows are
tamper-evident *by construction*. Crucially, the deny must come from the *posture*, not from a withheld
privilege:

> The append-only property therefore comes from RLS (no permitting policy), exactly the tamper-evident design; it is not an accident of revoked grants.

Protecting the audit "by being careful in the code" is not enforcement — code can be bypassed, a future path
can edit the row, and a revoked grant can be re-added; a denying RLS posture holds even when the role *holds*
the table-level UPDATE/DELETE privilege.

**Why (the non-obvious reason).** An audit trail's entire value is that it cannot lie — it is the record you
reach for *after* something went wrong, so if it can be altered or erased, it provides false comfort exactly
when it matters. Code discipline ("we only ever INSERT here") feels sufficient because today's code only
inserts; but the protection is only as strong as every future code path, every migration, every admin script,
every direct connection — and the one path that mutates an audit row is the one nobody reviewed. A subtler
trap is "protected by a missing grant": if the audit looks append-only only because the role was never granted
UPDATE/DELETE, then the day someone broadens grants (a convenience migration, an inherited default privilege)
the audit silently becomes mutable, with no error to announce it. The robust posture is the inverse — the role
*holds* the table-level privilege yet still cannot UPDATE/DELETE because **no RLS policy permits it** — so the
append-only guarantee is a positive, tested property of the database, not a fragile absence.

**How to apply (domain-stripped, reusable).**
1. **Enforce append-only at the database, with RLS.** Enable row-level security on the audit table and define
   EXACTLY two policies for the runtime role: one INSERT, one SELECT. Define NO UPDATE policy, NO DELETE
   policy, and NO catch-all FOR ALL policy.
2. **Make the deny come from the posture, not a missing grant.** Verify that even when the runtime role HOLDS
   table-level UPDATE/DELETE, an UPDATE/DELETE affects **0 rows** because no policy permits it. That proves the
   append-only property survives a future grant broadening.
3. **Adversarially prove tamper-evidence.** Run real attacks as the runtime role — `UPDATE … SET
   reason='TAMPERED'` → 0 rows; `DELETE FROM audit` → 0 rows; confirm the genuine row is unchanged. Both
   directions, captured in the verification.
4. **Keep the policy in ONE migration and make it reversible.** Define the append-only policies in a single
   migration whose down path cleanly drops them, and re-applying recreates EXACTLY the two narrow policies.
   Write the audit row in the SAME transaction as the action it records (atomic, with the authenticated
   principal as `deleted_by`/actor).

**The test for any audit trail.** Ask: *"as the runtime role, can I UPDATE or DELETE an audit row — and if it
fails, does it fail because a DENYING RLS policy refused it, or merely because the grant happens to be
missing?"* If the protection is code discipline, or an absent grant that a future migration could restore, the
audit is not tamper-evident. A mutable/erasable audit trail behind code-only protection is the failure mode
this unit exists to prevent.

**Runtime evidence anchor (the load-bearing instance).** The wave4 legacy-invoice-delete audit table
(`invoice_deletion_audit`) was hardened (Condition A) to EXACTLY two RLS policies — `rumah_app_insert`
(INSERT) + `rumah_app_select` (SELECT), both `TO rumah_app`, with RLS enabled and **no** UPDATE/DELETE/FOR-ALL
policy. The independent re-attestation ran the tamper probes as the runtime role: `UPDATE … SET
reason='TAMPERED'` → **0 rows (RLS DENIED)**, `DELETE FROM invoice_deletion_audit` → **0 rows (RLS DENIED)**,
the genuine row unchanged. The strong proof: `role_table_grants` showed `rumah_app` *holds* table-level
INSERT/SELECT/UPDATE/DELETE (inherited) — yet UPDATE/DELETE still affected 0 rows, so the append-only property
comes from RLS (no permitting policy), "not an accident of revoked grants." The migration round-trip was clean
both directions, and the audit row is written in the same transaction as the delete, keyed to the
authenticated principal.

**Source binding (promote-AND-preserve — Knowledge-Lost = 0).** Distilled from the wave4 legacy-invoice-delete
Condition A re-attestation, which STAYS as the detailed source:
`../rumah-admin/docs/verify/VERIFY-wave4-legacy-invoice-delete.md` — the exactly-2-policies catalog, the
UPDATE/DELETE → 0-rows tamper probes, the "deny is RLS, not a missing grant (the strong proof)" finding, the
migration round-trip, and the RESOLVED verdict. The destructive-action context (and the broader
production-observability gap — "no audit log, no operator-action log") is recorded in
`../delivery-os/capabilities/OPERATIONAL-READINESS-ASSESSMENT-2026-06-16.md` §3 item 8. This KU is the
retrievable distilled form; the verify/assessment docs are preserved, not replaced.
