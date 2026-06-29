---
title: Learning Review — Platform Extraction Gate (Delivery OS coupling)
date: 2026-06-29
trigger: platform-architecture change (preserve architectural artifacts + open the platform-extraction gate)
reviewer: project-owner (independent of the slice authors)
verdict: FRAMEWORK LESSON CAPTURED — a generic Runtime capability was built inside the first consumer (rumah-admin) instead of the platform (delivery-os); the platform must enforce residency-at-build-time, not discover coupling at audit-time.
---

# Learning Review — Platform Extraction Gate

## What triggered this
The founder challenged the North Star directly: **Delivery OS is the platform; `rumah-admin` is only the first consumer.** A file-cited architecture validation (`ARCHITECTURE-VALIDATION-platform-vs-consumer-2026-06-29.md`) found that the goal-governance Runtime built across Phases 3 + 5 (Project Owner, Goal Intake, Sprint Planning, Goal Supervisor, Reconciler, Lifecycle Controller, Sprint Engine, Founder Summon, Slack surface, Execution lifecycle) lives **only in `rumah-admin/src/`** — so the "delete rumah-admin, stand up a new consumer" test FAILS for those capabilities today.

## The framework lesson (non-empty answer)
**A generic Runtime capability was implemented inside the first consumer, not the platform — and nothing caught it for ~15 sprints.** The root cause is a single missing abstraction: the organs bind to admin's Postgres through raw tagged-SQL, whereas the already-platform-resident C11 Result Bus injects its database (`EngineContext.db`) and therefore vendors cleanly into *both* admin and PLOS. The C11 bus is the existence proof that the model works; the governance organs simply never adopted the seam. The trigger was "build it in the engine's home (admin), where the durable state lives" — convenient, but it quietly made the platform's heart a consumer's asset.

Why it went unnoticed: every per-slice gate we built (verify-gate, slice-gate, learning-review) checks *correctness and verification* — none checks *residency* (is this generic capability being built in the platform or a consumer?). Correctness gates pass happily while architecture drifts.

## Lessons → capability candidates
- **Platform-residency gate**: a check that flags when a slice adds generic Runtime logic (organs, lifecycle, supervisors) to a *consumer* repo without a store-port/db-injection seam — caught at build time, not at an architecture audit months later. The signal: raw SQL / direct `import postgres` inside a capability that the spec marks generic.
- **Store-port-by-default**: any new Runtime organ must take its durable store via an injected port interface (mirroring `EngineContext.db`) from sprint 1 — never raw tagged-SQL — so it is born vendorable.
- **The Delete Test as a standing CI assertion**: encode "could a new consumer reuse this without copying from rumah-admin?" as a periodic platform check, not a one-off audit.

## Verdict
Framework lesson captured and actionable. The correction (extract a `GoalStorePort`, lift the organs into a vendored `governance-engine/`, prove with a PLOS domain) is the subject of the Platform Extraction Blueprint now in progress under the founder gate. This is exactly the kind of architectural drift the platform must learn to prevent by construction.
