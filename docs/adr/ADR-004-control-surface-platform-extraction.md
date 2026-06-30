# ADR-004: Control Surface is a Delivery OS platform capability (Slack = adapter #1)

- **Status:** ACCEPTED — 2026-06-30 (founder-approved after the adversarial challenge; implementation P1–P4
  is a planned milestone that follows the roadmap and must not delay Neo completion or Sprint 5.3)
- **Date:** 2026-06-30 · **Deciders:** founder (architectural approval), builder (author)
- **Class:** Platform Boundary Decision (same class as the Governance Platform Extraction)
- **Cross-project note:** the locus is the Delivery OS platform (it adopts a capability), so this is a
  delivery-os ADR. Its one cross-project consequence — retiring `jarvis-slack-control-surface` as a
  standalone project — requires a companion **ecosystem-registry update (ECR-0008 / registry edit)**, listed
  in Follow-ups. (Per the ADR template, pure cross-project *seam* decisions are ECRs; this is a
  platform-contents decision with a registry consequence.)

## Context
`jarvis-slack-control-surface` is a standalone repo, but inspection shows it is **not a project**: three
files with a ports-and-adapters seam already cut — `goals-client.ts` (a channel-agnostic HTTP client over
the Delivery OS goal surface), `handle-goal.ts` (the channel-agnostic operator-control brain; no Slack SDK;
ports injected), and `slack-app.ts` (the only Slack-specific file). It imports nothing from any consumer.

**The Delete Test indicts the boundary:** deleting the jarvis repo would destroy the channel-agnostic
operator-control capability — a capability every future control surface (CLI, Web, REST, Teams, Discord,
voice) needs. That capability is therefore platform code marooned outside the platform — the same situation
as governance-embedded-in-rumah-admin before the Governance Platform Extraction.

**Founder adversarial challenge (the approval condition), answered and unchanged:**
1. Deleting the standalone repo is **more platform-correct, not merely convenient** (driver = Delete Test).
2. It **strengthens** the Delete Test (capability survives deletion of any channel/node; adapter kept isolable).
3. It **improves** the platform/consumer boundary (jarvis is reclassified out of a category error; consumers
   untouched).
4. It **preserves** clean-room via the ship-vs-run line + a no-runtime invariant (capability scrubs to zero
   project nouns; lint green).
5. It is **channel-invariant** — identical conclusion if only CLI/Web existed (the core has no Slack
   dependency). This is the decisive evidence it is a true boundary decision, not a Slack convenience.

## Decision
Adopt the **Control Surface** as a first-class Delivery OS platform capability. The channel-agnostic core
moves into the platform; **Slack becomes adapter #1** (not a separate project); the always-on process runs
on an **Execution Node**. Retire `jarvis-slack-control-surface` as a standalone repo (preserve its history
as the seed/case-study). The multi-channel adapter *framework* is **deferred** until a 2nd surface earns it
(Waterline / N=1); the capability is already channel-agnostic, so no abstraction is invented now.

### Why the boundary changes
Because platform capability (operator-drives-Delivery-OS) is currently filed outside the platform, in a
channel-named repo. The boundary must follow the Delete Test: a capability needed by every channel belongs
in the platform; a channel is an adapter; an always-on process is a node deployment.

### What moves INTO Delivery OS (platform capability — shipped, not run)
`templates/control-surface/`:
- `core/goals-client.ts` — the goal-API client (submit + observe), channel-agnostic.
- `core/handle-goal.ts` — the operator-control handler (route → observe → honest verified report).
- the ports — `GoalCommand` (in), `Say` (out) — and the `SubmitResult`/`Run` contracts.
- `adapters/slack/slack-app.ts` — the Slack adapter (adapter #1), **source only**.
- `README.md` + `VERIFY-control-surface.md`.
All scrubbed of project nouns (clean-room / no-backflow lint must stay green).

### What REMAINS infrastructure (never platform code; per-deployment operator grants)
Slack app registration, OAuth (bot/app tokens), `SLACK_*` and `GOALS_API_*` secrets, the workspace install,
the `/goal` slash-command setup. These are operator authentication/authorization actions.

### What RUNS on the Execution Node (deployment, not capability)
The always-on Socket-Mode process (the Slack adapter wired to the capability) is **deployed and run on an
Execution Node** (Neo today) — Socket Mode is always-on, exactly like the heartbeat. The platform ships the
code; the node installs `@slack/bolt` and runs it. **No-runtime invariant:** Delivery OS itself never
installs `@slack/bolt` and never runs the surface.

## Migration phases
- **P0 (this ADR):** ratify the boundary. No code moves until approved.
- **P1 — capability lands:** PR into delivery-os adding `templates/control-surface/` (core + Slack adapter,
  scrubbed) + a VERIFY. Clean-room lint green. Founder-gated merge (author≠verifier, as ADR-002/PR #26).
- **P2 — adapter consumes platform:** the Slack deployment imports the capability from the platform
  (vendored, sha-pinned, as the workflow-engine is); `slack-app.ts` shrinks to pure wiring.
- **P3 — deploy on Neo:** run the Slack control surface as an Execution-Node deployment (launchd, like the
  heartbeat), tokens supplied as node infrastructure (founder grants).
- **P4 — retire the repo:** archive `jarvis-slack-control-surface`; preserve history as the seed/case-study;
  companion ecosystem-registry update (ECR-0008) reclassifies it from "project" to "platform capability +
  node deployment."
- **Deferred:** the multi-channel adapter interface — distilled from TWO real adapters when surface #2
  (CLI/Web) is real.

## Verification criteria (how we know each phase is correct)
- **Clean-room:** `node scripts/check-no-backflow.mjs` adds **0** new violations after P1.
- **Capability integrity:** `npm run typecheck` green on the moved capability; the prior independent
  jarvis VERIFY (8/8 PASS) re-run against the platform-hosted capability still passes (happy path, no-match,
  ambiguous, idempotency, token-gate).
- **No-runtime invariant:** delivery-os `package.json` does **not** depend on `@slack/bolt`; the surface
  only runs on a node.
- **Channel-agnostic proof:** the core builds and is exercised with the SDK absent (the existing
  disabled-path + proof discipline).
- **Node deployment:** on Neo, the Socket-Mode process starts and a `/goal` round-trips (founder-gated on
  Slack tokens) — or the disabled-path logs cleanly when tokens are absent.

## Rollback strategy
- **Before P4 (repo still exists):** the standalone jarvis repo remains the source of truth; if P1–P3 reveal
  a problem, revert the delivery-os PR (capability dir deletion is self-contained) — the platform returns to
  its pre-ADR state; the jarvis repo keeps working unchanged. Safe restore point: delivery-os `main` at the
  ADR merge.
- **After P4 (repo archived):** archival is reversible — un-archive `jarvis-slack-control-surface`; the
  preserved history restores the standalone surface. The capability in the platform is additive and can
  coexist, so rollback never leaves a gap.
- **Invariant breach (clean-room or no-runtime):** the lints/CI fail closed and block the merge — rollback
  is "the PR never lands."

## Consequences
- **Positive:** Delete Test passes; platform owns the operator-control capability; the platform/consumer
  boundary sharpens; future channels are thin adapters over one capability; control surfaces deploy on
  Execution Nodes (consistent with the layering).
- **Trade-offs:** the Slack adapter now lives inside the platform tree (mitigated by an isolable
  `adapters/slack/` dir); a vendoring/sha-pin discipline applies to the deployment.
- **Follow-ups/risks:** ECR-0008 ecosystem-registry update (jarvis reclassified); guard the no-runtime
  invariant in CI; resist building the multi-channel framework before surface #2.

## Alternatives considered
- **A — keep jarvis as an independent repo:** rejected — Delete Test fails (platform capability marooned).
- **B — move everything into delivery-os and run it there:** rejected — violates clean-room "runs no app."
- **C — split: capability→platform, Slack adapter stays its own repo:** sound, but rejected by the founder
  in favor of folding the adapter in (Slack-first, "not a new project"); kept as the fallback if the adapter
  later needs a fully independent release cadence.
- **D — full multi-channel adapter registry now:** rejected — speculative at N=1 (Waterline). This ADR's
  destination, not its starting point.

---
*ADRs are immutable. To change this decision, write a superseding ADR. Cross-project consequence tracked as
ECR-0008 in the Ecosystem layer.*
