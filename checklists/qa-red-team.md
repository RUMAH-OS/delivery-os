# QA red-team checklist

Independent of the implementer. Assume it's broken until proven otherwise. Verify at runtime.

## Mindset
- [ ] Treat every claim as **false until shown true** · [ ] Verify against the **real runtime** (raw HTTP / view-source / logs / DB / eval), not the code

## Functional
- [ ] Happy path end-to-end
- [ ] **Failure paths**: empty/missing config, invalid input, downstream failure → **honest error, no false success**
- [ ] Boundary/abuse: oversized input, spoofed headers, rate limits, double-submit, replay
- [ ] Idempotency on state/money ops (safe to retry)
- [ ] **Determinism** where required (identical inputs → identical output)

## Data & state
- [ ] No data loss on failure; writes atomic · [ ] AuthZ on every record access (no IDOR) · [ ] Migration reversible; pre-change backup exists

## Surfaces (per pack)
- [ ] Public: canonical/robots/sitemap correct · [ ] UI: parity / a11y · [ ] Sensitive: authz + audit + no secret/PII leak · [ ] AI: evals pass + grounding (no fact without source)

## Output
- [ ] Verdict PASS / PASS-with-conditions / FAIL · [ ] findings classified Blocker/Should-fix/Safe-to-defer (none dropped) · [ ] regressions added to harness/evals · [ ] conditions re-verified resolved
