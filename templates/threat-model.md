# Threat Model — <surface/feature>

> For any sensitive surface (auth, money, signatures, PII). Keep it short and concrete.

## Assets
<what's worth protecting here — funds, identities, signed docs, PII>

## Entry points / trust boundaries
<endpoints, inputs, webhooks, file uploads, third-party callbacks>

## Threats (STRIDE-ish) + mitigations
| Threat | Example here | Mitigation | Tested? |
|---|---|---|---|
| Spoofing / auth bypass | <…> | authz check, server-side | [ ] |
| Tampering | <…> | integrity/hash, audit | [ ] |
| Repudiation | <…> | audit trail, signer identity | [ ] |
| Info disclosure | <…> | least data, encryption, no secret in logs | [ ] |
| DoS / abuse | <…> | rate limit, size limits | [ ] |
| Elevation of privilege / IDOR | other-tenant id | per-record authz | [ ] |
| Replay | reused webhook/token | nonce/freshness | [ ] |

## Money/decimal (if applicable)
- [ ] exact decimals · [ ] idempotent ops · [ ] immutable ledger · [ ] no negative-amount abuse

## Residual risk / decisions
<accepted risks + why; link ADR if a decision>
