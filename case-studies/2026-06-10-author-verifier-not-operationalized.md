# Case study — "Documented ≠ Operationalized": the author≠verifier gap (2026-06-10)

**Class:** framework defect (enforcement). **Found in:** live operation, Rumah Admin Slice 1.0. **Caught by:** the founder — not by any framework mechanism, which is itself the finding.

## What happened
The orchestrator generated the Slice 1.0 code scaffold (Drizzle schema, migrator, Hono API, a smoke test, CI yaml) and presented it as progress. No independent verifier ran. When the founder forced a verification, an independent 4-lens panel found: the migration DDL applied cleanly on a fresh DB and 3/3 tests passed — **but** the app/API code (`src/index.ts`, the Drizzle layer) had never been executed (tests used raw SQL, never imported `src/`), the rollback was never run, CI had never run (the project was not a git repo), and a HIGH SQLi advisory (`drizzle-orm 0.36.4 < 0.45.2`) was open. **A clean, ADR-aligned scaffold — but not a verified slice.**

## Root cause (confirmed in the framework's own words)
Delivery OS v3 **documented** Author≠Verifier (Governance §3) and consequential-review (§11) but did **not operationalize** them for the single-orchestrator / no-git case:
- **§3 was enforced only by CODEOWNERS-on-a-git-PR.** The project was not a git repo → CODEOWNERS was an inert text file → one orchestrator played author, verifier, and reporter.
- **Skills are dispatched by native description-matching — model discretion, no hook.** `production-readiness-review` / `principle-11-review` could only be *chosen*, never *fired*. `.claude/` was never even created (the scaffolder was never run here).
- **The scaffolder wrote no `git init` and no `.claude/settings.json`.** There was no mechanical element anywhere in the stack that fires without the orchestrator choosing to.
- **The status vocabulary, the DoD gate, and the self-QA carve-out were all aspirational** — no executor enforced them. The data-store+migrations slice was self-classified as "scaffolding," exactly the self-judgment §11 says a single agent may not make alone.

Recurrence was **guaranteed**: prevention depended on the operator *remembering* — which is not a control.

## The fix (Governance §12 — "verification is operationally enforced, not remembered")
Two structural controls make the other six real:
1. **No git ⇒ no build.** The scaffolder runs `git init` + `main`/`dev` and fails closed; CODEOWNERS/CI/commit-provenance are inert without it.
2. **The verify-gate hook** (`.claude/settings.json` + committed `.githooks/pre-push`) blocks commit/push and turn-end when implementation files changed without a fresh, passing, **independent** `docs/verify/VERIFY-<slice>.md`.

Supporting (conventions the hooks check for): the VERIFY artifact (`templates/VERIFY.md.template`), the no-VCS author≠verifier fallback (§12), the derived `verify_status` ladder `planned→generated→executed→verified` (never self-asserted), the always-on router rule ("no slice reported in the turn it was authored"), and the closed self-QA loophole (DoD).

## The lessons (durable)
- **A principle that depends on memory is a hope, not a control.** If recurrence is prevented only by someone remembering, it will recur.
- **`generated` ≠ `executed` ≠ `verified`.** Code that compiles, or DDL that runs, is not a verified slice until an independent lens confirms acceptance on the slice's **real surface**. "Tests pass" that bypass the app (raw SQL for an API criterion) prove nothing about the app.
- **A hook can enforce that an artifact exists; it cannot enforce that the work was honest.** State the limit; keep the model-independent layers (committed git hook, PR-with-a-second-reviewer).
- **Dogfood the gate.** Treat the gate itself as a slice and verify that it actually blocks a turn.
