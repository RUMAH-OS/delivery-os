# Checklist — Test Hygiene (v5: A6)

> Earned from N21 (Company-OS phase): shared-DB fixture accumulation + cap-dependent assertions made a full suite
> intermittently red (fixed twice — once is a fluke, twice is a missing standard); and a VERIFY frontmatter inline
> comment broke the gate's `verify_status` parser. Extends the June B25 cross-test-race lesson. Verification
> reliability + CI parity is a precondition for trusting the verify-gate — a flaky suite trains gate-skimming.

## Shared-DB fixtures (the recurring flake class)
- [ ] **Tag-scoped teardown.** Every test file that seeds a shared DB removes its OWN rows in `afterAll`, scoped
      by a run-unique tag (cascade from the tagged root rows). Leaving fixtures behind accumulates across runs.
- [ ] **Cap-independent assertions.** Never assert a seeded row's *presence* in a capped/paginated list (the row
      falls outside the window once the shared DB grows). Assert a **count-delta** (`after − before == N`) or query
      narrowly by the seeded id — not membership in a truncated `items[]`.
- [ ] **Run-unique tokens** on every fixture name (`<purpose>-<ts>-<rand>`) so parallel test files don't collide
      and teardown is unambiguous (June B25).
- [ ] **A GET endpoint performs zero writes** — assert read-only endpoints don't mutate (tagged-row count
      before/after).

## CI parity
- [ ] The suite is **stable across consecutive runs** on a clean DB (run it ≥2×; intermittent red = a hygiene
      defect, not a flake to retry).
- [ ] A reset/migrate of the disposable test DB returns the suite to green (no dependence on accumulated state).

## VERIFY artifact frontmatter (gate-input integrity)
- [ ] `verify_status:` is on its own line with **no inline comment** (`verify_status: verified`, never
      `verify_status: verified  # ...`) — an inline comment is captured into the value and the gate's `=== "verified"`
      check silently fails. (The durable fix is parser-side tolerance in the gate hook — a kernel change, tracked
      separately; this checklist is the authoring-side belt.)

## Author≠verifier still holds (A2 reminder)
- [ ] A "trivial / lightweight-QA" classification is **second-lens-confirmed and recorded** (DoD "Lightweight vs
      full"); `tests/` slices **retain** author≠verifier; risk-scaling adds rigor, never subtracts below the gate
      floor.
