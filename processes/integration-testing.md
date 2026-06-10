# Process: Integration Testing

For apps with third-party integrations or multiple services. Catches what unit tests don't.

## Layers
- **Contract tests** — your side conforms to the API/consumer contract (and vice versa); run in CI.
- **Integration tests** — components + a real (or sandbox) dependency work together.
- **Test doubles** — record/replay or sandbox accounts for external providers; never hit prod third parties in CI.

## What to test (the failure modes that bite in prod)
- **Idempotency** — replay a write; no double effect.
- **Retries/backoff/timeouts** — the dependency is slow/down → graceful degradation, no hang.
- **Webhooks** — valid signature accepted, invalid/old rejected (replay protection).
- **Partial failure** — one provider fails mid-flow → flagged partial result, honest error, no corruption.
- **Auth/credential rotation** — expired key → clean failure + alert, not a silent drop.

## Principle
Treat every external dependency as **unreliable**. The integration's job is to degrade gracefully and **surface** failure (honest failure), never to fake success.
