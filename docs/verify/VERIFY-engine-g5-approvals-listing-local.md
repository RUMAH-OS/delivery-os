---
slice: engine-g5-approvals-listing
verify_status: verified
author: "implementation-session"
verifier: "independent-qa-subagent"
date: 2026-06-24
independence_basis: recorded-distinct-invocation
---

# VERIFY — G5: pending-approvals listing (GET /approvals) + G4 per-step verdict hardening

## Independence header
This verification was performed by an independent QA invocation that did NOT author the
G5 / G4-hardening change (author ≠ verifier, Delivery OS Governance §3/§12). No production
code was modified by the verifier. Evidence below is from direct reads of the canonical
engine source, a byte-identical vendored-copy diff, and a verbatim, independently-run
consumer typecheck.

## Changes under test
1. **G5 — pending-approvals listing.** `templates/workflow-engine/approvals-route.ts` adds
   `GET /approvals`: returns workflow steps that are `state='blocked'` AND
   `awaitSource='human-response'` (= pending human approvals), projecting ONLY
   `{runId, seq, awaitingEventId, stepType, owner, updatedAt}` plus `count`. Gated by the
   same `humanPrincipal.requireHuman(requiredScope)` middleware as `POST /approvals`.
2. **G4 hardening.** `templates/workflow-engine/workflow-route.ts` — the per-step `verdict`
   in the `GET /workflow/runs/:id` projection is now a coded subset `{verdict, reasons, rung}`
   instead of the raw stored jsonb (drops `suggestedImprovement`/`advisory`/`score`). The
   top-level `verify` summary is unchanged (already verified in
   `VERIFY-engine-g4-verdict-projection-local.md`).

## Sync provenance (vendored copy = canonical)
Both canonical files were synced into the demo-app's vendored engine. Verified byte-identical
via `diff` (exit 0, "IDENTICAL"):
- `templates/workflow-engine/approvals-route.ts` == `examples/engine-demo-app/.claude/os/engine/approvals-route.ts`
- `templates/workflow-engine/workflow-route.ts` == `examples/engine-demo-app/.claude/os/engine/workflow-route.ts`
- `schema.ts` and `human-principal.ts` (referenced types) also byte-identical.

## Consumer typecheck — verbatim evidence
Command: `cd C:/Users/brian/RUMAH/delivery-os/examples/engine-demo-app && npx tsc --noEmit`

```
EXIT_CODE=0
```

(No diagnostics emitted; clean exit. Hono pinned at 4.12.26.)

## Per-claim verdicts

### G5-1 — query columns exist on `workflowStep` — PASS
`schema.ts` `workflowStep` defines every column the G5 query reads:
`runId` (uuid), `seq` (integer), `awaitingEventId` (uuid), `stepType` (text),
`owner` (text), `updatedAt` (timestamptz), and the two filter columns `state` (text) and
`awaitSource` (text). All present; typecheck confirms the Drizzle select compiles.

### G5-2 — projection is PII-free (IDs / coded only) — PASS
The select projects ONLY: `runId` (uuid), `seq` (int), `awaitingEventId` (uuid),
`stepType` (coded step kind), `owner` (coded ownership-policy owner — `definitions.ts:25`
"resolved owner (ownership-policy requiredOwner)", a role/owner string derived from the
workflow definition, not user input), `updatedAt` (timestamp). It does NOT select `result`,
`error`, `checkpoint`, `verdict`, `input`, `actorEmail`, or any payload/body. No email, name,
or free-text body reaches the response. PII-free by construction.

### G5-3 — GET gated by `requireHuman` (applies to all methods at the path) — PASS
Line 47: `approvalsApi.use("/approvals", ctx.humanPrincipal.requireHuman(requiredScope))`,
registered BEFORE both handlers (`get` at line 54, `post` at line 65). In Hono v4,
`app.use(path, mw)` with a non-wildcard path registers middleware for ALL HTTP methods at
that EXACT path. Both `GET` and `POST` handlers are bound to exactly `/approvals`, so the
human gate runs first for both. There is no other GET route that could reach the handler
unguarded. Middleware is preserved across sub-app mount, so the gate holds regardless of the
mount prefix the app chooses.

### G5-4 — non-human (service token) cannot hit GET /approvals — PASS (with stated boundary)
`requireHuman` is the engine doctrine port over `isVerifiedHuman` (`human-principal.ts:56`):
a principal whose role is in `NON_HUMAN_ROLES` (`service`/`agent`/`system`/`integration`, ∪
app extras) is rejected BY CONSTRUCTION even if `requiredScope` leaked onto the token, AND a
human must carry `requiredScope` (or be role `admin`). The same gate guards POST, so GET has
identical machine-rejection. Boundary (honest): the actual HS256/JWT verification and scope
minting are the APP's `requireHuman` impl (engine declares the port, app supplies the token
verifier). The engine cannot statically prove the app's impl routes through `isVerifiedHuman`;
that is the app installer's contract.

### G5-5 — filter correctness (no false positives) — PASS
`where(and(eq(state,"blocked"), eq(awaitSource,"human-response")))` returns exactly steps
that are blocked AND awaiting the human source. Steps blocked on any other source
(callback/timer/etc.) are excluded; steps in any non-blocked state (done/failed/ready/...)
are excluded. A previously-human gate that was resolved is `done`/`failed` (and its
`awaitingEventId` is cleared to null on resolve, lines 117/128), so it cannot reappear. No
false positives.

### G4-H — per-step verdict is a coded subset, not raw jsonb — PASS
`workflow-route.ts:122-123` maps each step's verdict to
`s.verdict ? { verdict: s.verdict.verdict ?? null, reasons: s.verdict.reasons ?? [], rung: s.verdict.rung ?? null } : null`.
The raw `s.verdict` jsonb is NOT spread; only the three coded fields are extracted, so
`suggestedImprovement`/`advisory`/`score` are dropped from the observe surface. This matches
the already-verified top-level `verify` summary contract and tightens the per-step surface
from a convention-only-PII-free passthrough to a PII-free-by-construction subset. Sound.

## Bugs
None blocking. No defects filed.

## Honest limits (static verification only)
- **No live HTTP/DB exercised.** This pass verifies types, projection shape, PII surface,
  filter predicate, and auth wiring by source reading + consumer typecheck. It does NOT
  execute a request against a running engine + Postgres.
- **App-supplied auth impl not exercised.** `requireHuman`'s JWT verification is the app's
  code; the engine-side doctrine (`isVerifiedHuman`, `NON_HUMAN_ROLES`) is verified, the
  app's wiring of it is not (out of engine scope).
- **No tenant scoping in the G5 query.** The listing returns ALL blocked human-response
  steps in the engine database, scoped only by the `requireHuman` scope — there is no tenant
  column in `workflow_step` (engine is single-tenant-per-DB by doctrine). Advisory: an app
  that multiplexes multiple tenants into ONE engine DB would expose cross-tenant approval
  IDs/coded refs via this endpoint. Consistent with the engine's single-tenant-DB design,
  but flag for any future multi-tenant installer.
- **`reasons[]` passed verbatim.** Both the top-level and per-step `reasons` arrays are
  forwarded as-is; "S4 coded reasons only" remains a verifier convention, not enforced by
  construction (identical posture to the already-verified top-level summary).

## Recommended integration follow-up (not blocking this gate)
Add an integration test against a live engine + Postgres:
1. Enqueue + tick a run until a step blocks on a human gate (`awaitSource='human-response'`).
2. `GET /approvals` (with a verified-human token + admin scope) → asserts the run/seq/
   awaitingEventId appears, `count == 1`, and no PII fields are present.
3. `GET /approvals` with a service-role token → asserts 401/403 (machine rejected).
4. `POST /approvals` resolves the gate (approve) → 200 resolved.
5. `GET /approvals` again → the resolved step is gone, `count == 0`.
Register the negative (service-token-rejected) and the empty-after-resolve assertions as
permanent regression entries.

## Verdict
**verify_status: verified.** G5 columns exist and the projection is PII-free; the GET listing
is gated by the same verified-human middleware as POST (Hono `use(path)` covers all methods
at the exact path); the blocked + human-response filter is correct with no false positives;
the G4 per-step verdict hardening is sound (coded subset, raw jsonb dropped). Consumer
typecheck is clean (exit 0) against byte-identical vendored copies. Limits are static-only;
an integration follow-up is recommended but not required for this gate.
