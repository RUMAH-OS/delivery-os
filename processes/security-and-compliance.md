# Process: Security & Compliance

For any slice touching auth, money, signatures, or personal data. **Fail-closed on doubt.** See `checklists/security-review.md`, `templates/threat-model.md`.

## Always
- **AuthZ on every endpoint + record access** (no IDOR — test cross-tenant access); least privilege; server-side checks.
- **Secrets** never in code/logs/responses; correct env scope; rotation possible. Diagnostics report **presence, not values**.
- **Audit log** every sensitive action (who/what/when/which record).
- **Threat-model** each sensitive surface; test the abuse cases (tamper, replay, escalation, injection, oversized input).

## Money / invoicing
Exact decimal types (no float rounding); **idempotent + transactional** money ops; immutable ledger; sequential invoice numbering; reconciliation tests; no negative-amount abuse.

## E-signatures
Required legal assurance level (e.g. eIDAS tier); document hashed + tamper-evident; signer identity; immutable signed record + audit trail.

## Data protection (GDPR)
Lawful basis/consent; minimization; defined retention; export + erasure; PII encrypted in transit + at rest.

## Gate
No sensitive slice ships without a security review note; no secret/PII exposure; every sensitive action authorized + audit-logged; abuse cases handled fail-closed.
