# Security & compliance review checklist

For any slice touching auth, money, signatures, or PII. Fail-closed on doubt.

## AuthN/AuthZ
- [ ] Every endpoint + record access enforces authz (try another tenant's id → denied) · [ ] least privilege · [ ] server-side checks · [ ] sessions/tokens secure, expiring, revocable

## Money / invoicing
- [ ] Exact decimals (no float) · [ ] idempotent + transactional money ops (no double-charge on retry) · [ ] immutable ledger/audit · [ ] sequential numbering · [ ] no negative-amount abuse

## E-signatures
- [ ] Required legal assurance level · [ ] document hashed + tamper-evident · [ ] signer identity · [ ] immutable signed record + audit

## Data protection (GDPR)
- [ ] Lawful basis/consent · [ ] minimization · [ ] retention defined · [ ] export + erasure · [ ] PII encrypted in transit + at rest

## Secrets & logging
- [ ] No secrets in code/logs/responses · [ ] correct env scope · [ ] rotation possible · [ ] **audit log** every sensitive action · [ ] diagnostics report presence, not values

## Abuse testing
- [ ] Tampering, replay, privilege escalation, injection, oversized input — handled, fail-closed
