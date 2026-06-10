# API Contract — <endpoint/service> v<N>

> The contract is the source of truth. Code conforms to this; contract tests enforce it.

## Endpoint(s)
`<METHOD> /path` — <purpose>

## Request
- Auth: <scheme> · Headers: <…> · Idempotency-Key: <required for state/money writes?>
- Body schema: <typed/Zod/OpenAPI ref>

## Response
- Success: <status + schema> · Pagination: <…>
- **Error model (standard):** `{ code, message, details? }` — codes: <…>

## Semantics
- Idempotent? <yes/no> · Side effects: <…> · Rate limit: <…>

## Versioning & compatibility
- Version: v<N> · Breaking change policy: new version + deprecation window <…>
- Backward-compatible additions allowed; breaking changes are **not** silent.

## Webhooks (if any)
- Signature verification: <…> · Replay protection: <…>

## Contract tests
- <where they live; what they assert>
