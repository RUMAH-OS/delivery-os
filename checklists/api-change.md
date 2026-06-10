# API change checklist

See `processes/api-governance.md` + `templates/api-contract.md`.

## Contract
- [ ] Contract (OpenAPI/types) updated as the source of truth · [ ] standard error model · [ ] pagination/auth/rate-limit defined

## Compatibility
- [ ] Additive + backward-compatible? ship · [ ] **Breaking?** new **version** + **deprecation path** (timeline + sunset) — never silent
- [ ] **Contract tests** updated + green in CI

## Reliability (state/money endpoints)
- [ ] **Idempotency key** honored (replay → no double effect) · [ ] timeouts/retries/backoff on downstream · [ ] failures **surfaced** (no 200 over a failed call)

## Webhooks (if touched)
- [ ] Signature verified · [ ] replay/freshness protection
