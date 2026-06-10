# Process: API Governance

For API-first backends and any app exposing/consuming APIs.

## Contract as source of truth
- The **contract** (OpenAPI/typed schema) is authoritative; code conforms to it; it's versioned in the repo.
- **Standard error model** — consistent shape, codes, and messages across endpoints.
- Pagination, filtering, auth, and rate limits are defined, not ad hoc.

## Versioning & compatibility
- **No silent breaking changes.** Breaking change → a new version + a **deprecation path** (timeline + sunset).
- Additive changes are backward-compatible by default.
- **Contract tests** prevent consumers from breaking; they run in CI.

## Reliability
- **Idempotency keys** for state/money-changing writes (safe to retry).
- Timeouts, retries-with-backoff, circuit-breaking for downstream calls.
- **Verify inbound webhooks** (signature + freshness/replay protection) before acting.
- **Honest failure** — surface a failed downstream call, don't 200 over it.

## DoD rows (`api-first` pack)
- [ ] Contract defined + error model · [ ] Contract tests green · [ ] No breaking change (or versioned + deprecation) · [ ] Idempotency on state/money ops · [ ] Webhooks verified.
See `checklists/api-change.md`.
