---
event: "new-capability"
date: "2026-06-27"
change: "platform-health — Infrastructure Runtime-Health, Diagnostics, Rollback & Self-Healing layer"
triaged_by: "build agent (reconstructed from the build artifacts: the three tool self-tests, the VERIFY, and the config-doctor precedent)"
milestone: "Infrastructure Platform — runtime half (composes with the config half landed in PR #15/#201/#17)"
---

# Learning Review — platform-health layer

> Auto-triggered by the Review-Class Trigger (Governance §14 · ADR-003 L2). Converts experience into ROUTED
> CAPABILITY, not prose.

## 1. Reconstruct from artifacts
- The founder's goal had two halves: config validation (done — config-doctor) and the runtime
  health/diagnostics/rollback/self-healing layer (this slice). The investigation found the runtime surfaces
  already existed but were SCATTERED and INCONSISTENT: PLOS had `/api/health/{admin-handoff,discovery,mailbox}`
  each with its own `ok|warn|alarm` shape; rumah-admin had a heartbeat/tick-liveness keystone and a basic
  `/health`. There was no single verdict per app and no consistent shape across apps.
- Built: a reusable engine (`platform-health.mjs` — canonical shape + worst-wins verdict + a diagnostics
  taxonomy that delegates config faults to config-doctor), a pinned cross-app schema, a read-only rollback
  helper, a post-deploy self-healing verifier, and a runbook. All four tools self-test green (47 cases).

## 2. Were any framework-level lessons discovered?
Yes — three.

## 3. Capability impact (the §14 routing)
| Lesson | Layer | Asset | Destination |
|--------|-------|-------|-------------|
| L-A: A platform's runtime health needs ONE canonical shape across apps, or "poll everything" is impossible. Scattered per-endpoint shapes are observability debt. | Delivery OS | template + schema | `templates/tools/platform-health.{mjs,schema.json}` — the contract every app's `/api/health/platform` validates against. Shipped. |
| L-B: "Remove every silent failure" is only real if the terminal branch of the diagnostics is itself non-silent. A taxonomy that throws away the unrecognized case re-introduces the silence it exists to kill. | Delivery OS | doctrine-line + lint-shaped self-test | `classifyFailure` always returns a named cause; `UNKNOWN` still prints what was observed + asks for a new rule. Pinned by the self-test `dx UNKNOWN — but NOT silent`. |
| L-C: A health probe that MUTATES state (e.g. driving a real engine tick to "test" it) can forge or mask recovery and breaks read-only. Liveness must be READ, never driven. | Delivery OS + project | doctrine-line | Written into the template header + the runbook; applied in rumah-admin wiring (read heartbeat liveness, do not call `tick()` in the health path). |

## 4. Did any EXISTING capability fail to catch this?
- The config-doctor capability did NOT (and should not) cover runtime health — that gap is by design, and this
  layer fills it on the correct side of the concern boundary. No existing capability regressed.
- Observation (not a miss this slice closes): there was no gate ensuring new health endpoints conform to a
  shared shape — which is exactly why drift accumulated. The new `platform-health.schema.json` + the per-app
  validation test IS that strengthened capability. Candidate for a future CI lint: "a new `/api/health/*`
  route must emit a schema-valid platform-health subsystem" — recorded as a signal, not built this slice.

## 5. Blast-radius fork
- **Project-local lessons** → implemented in the same series: the PLOS + rumah-admin per-app wiring PRs
  (endpoints + diagnostics + post-deploy script + tests), each emitting the canonical shape.
- **OS-base / cross-system lessons** → the reusable engine, schema, ops tools, and runbook in `templates/`
  (this PR) + a capability-ledger signal so the conformance-lint candidate is not lost. No base doctrine was
  written from a retro speculatively; only the proven contract shipped.
