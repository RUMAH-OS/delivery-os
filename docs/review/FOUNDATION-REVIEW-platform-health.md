---
review: foundation
date: "2026-06-27"
change: "platform-health — Infrastructure Runtime-Health, Diagnostics, Rollback & Self-Healing layer (the runtime half of the Infrastructure Platform; builds on config-doctor)"
verdict: "STABLE — build on it"
lenses: "reviewer-critic (internal consistency / contradiction) + lead-architect (forward gaps / boundary)"
---

# Foundation Review — platform-health layer

> Auto-triggered by the Review-Class Trigger (Governance §14 · ADR-003 L2) — a new capability /
> architecture / integration change. Question: **are the foundations this change builds on still
> internally consistent + still valid?**

## Foundation set reviewed
- The Infrastructure Config Platform (`config-doctor.mjs` + `config-registry.schema.json`, delivery-os PR #15 / PLOS #201 / rumah-admin #17) — the layer this one composes WITH and delegates config-class faults to.
- The reliability keystone in rumah-admin (heartbeat + stateless SKIP-LOCKED tick + poison-pill quarantine) and the PLOS health probes (admin-handoff, discovery, mailbox) — the existing surfaces this layer UNIFIES rather than replaces.
- The vendored-CLI template→per-app pattern (the config-doctor precedent: byte-identical `.mjs` in `infra/`, run by CI/ops, no app-graph coupling).
- Governance invariants: read-only operational tools · one-source-of-truth-per-concern · no-silent-failure · author≠verifier.

## VERDICT: STABLE — build on it
- **Consistency (reviewer-critic):** No contradiction with config-doctor. The boundary is clean and respected in code: health NEVER re-reads env for a config fault — `classifyFailure` routes any `CONFIG_KEY_MISSING` symptom to `config-doctor --env production` (verified by self-test `dx CONFIG_KEY_MISSING … + delegates` and the ordering test `dx config beats db ordering`). The canonical health shape is a NEW concern (runtime state), not a redefinition of the config registry — no overlap. The "no silent failure" invariant is enforced structurally: `runHealth` turns a thrown/timed-out probe into a `down` subsystem carrying the classified cause, and the taxonomy's terminal branch is `UNKNOWN`-but-named, never a swallow.
- **Forward gaps (lead-architect):** The model supports the vision. One deliberate boundary: the reusable layer ships the CONTRACT (canonical shape + schema), the DIAGNOSTICS engine, and the app-neutral OPS tools (rollback, post-deploy) as vendored CLIs; the per-app `/api/health/platform` aggregator is native (it must call app-specific probes) but is held to the SAME shape by `platform-health.schema.json` + a per-app validation test. This is the same reuse-without-coupling shape config-doctor proved — not a new pattern to defend. No structural gap found; cross-app consistency is enforced by the schema, not by hope.

## Findings + fixes
| # | Sev | Finding | Fix applied / required |
|---|-----|---------|------------------------|
| F1 | Should | The diagnostics taxonomy is the single source of "what a failure means", but the per-app endpoints fold the verdict natively (small duplication of the worst-wins rule). | Mitigated: the fold is pinned by `platform-health.schema.json` + each app vendors `platform-health.mjs` and a test that validates real responses against it (drift fails the test). The verdict rule is also exported from the vendored `.mjs` for apps that import it directly. |
| F2 | Should | A health probe that accidentally MUTATES (e.g. driving a real `tick`) would violate read-only and could mask/forge recovery. | Doctrine line written into the runbook + the template header: a health probe READS liveness (last-beat/cursor age), never advances state. Enforced per-app in the consumer wiring (rumah-admin reads heartbeat liveness; it does not call `tick()` in the health path). |
| F3 | Nice | `rollback-helper` infers "current production" from the newest READY deploy when the alias API is unavailable (best-effort). | Acceptable + honest: it degrades to a tolerant read and never promotes; the operator confirms before running the printed command. Documented in the tool header. |

## Conclusion
The foundations are stable to build on. config-doctor and the health layer compose cleanly along a respected concern boundary (config vs. runtime), the no-silent-failure invariant is enforced in code (not just intended), and cross-app consistency rests on a pinned schema rather than convention. Build it — no redesign required.
