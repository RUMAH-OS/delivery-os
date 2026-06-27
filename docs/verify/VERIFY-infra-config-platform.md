---
slice: "Infrastructure Config Platform — config-doctor + registry + deploy-gates + consolidated FAP"
verify_status: verified
# ^ planned | generated | executed | verified. 'verified' only when ALL acceptance criteria PASS on their own surface.
author: "build agent (Opus 4.8 build session) — config-doctor + registries + gate wiring + FAP"
verifier: "qa-test agent (independent invocation, 2026-06-27) — landed the platform across 3 repos"
date: "2026-06-27"
independence_basis: "recorded-distinct-invocation (landing/verification session, separate from the build session)"
machine_probe: "node templates/tools/config-doctor.mjs --self-test  +  node infra/config-doctor.mjs --env production (per consumer repo)"
scope: "delivery-os (doctor+schema+FAP) · property-lead-os (infra/ + deploy.yml pre-build gate) · rumah-admin (infra/ + config-gate.yml)"
---

# VERIFY — Infrastructure Config Platform (cross-repo independent verification + landing)

## Verdict
**verify_status:** `verified` — every acceptance criterion in the work order PASSes on its own surface, proven by
execution (not description), independently of the author's own `VERIFY-config-doctor.md`. The self-test passes 16/16
(exit 0); each consumer's production doctor FAILS with EXACTLY the missing-key set the consolidated FAP advertises
(PLOS 8, rumah-admin 4); the DATABASE_URL→transaction-pooler-6543 rule is encoded in the doctor and both registries;
the deploy gates are wired fail-closed pre-build; every registry key maps to a real code read (no phantom keys); and
the registries match the real env schemas. One documentation-accuracy defect was found and corrected during landing
(the FAP was silent on the Vercel TEAM scope — the single highest-risk founder step); two non-blocking observations
are filed as bug reports below.

## Independence header (Governance §3/§12 — proves author ≠ verifier)
- Verifier identity / invocation: qa-test agent · independent landing/verification invocation · 2026-06-27.
- Author identity (code under test): build agent (Opus 4.8 build session) — authored config-doctor.mjs, both
  registries, the gate wiring, and the FAP.
- [x] The verifier did NOT author the production tool under test (config-doctor.mjs / the registries / the gate YAML).
- [x] Independence was real — a true second invocation; the author's own `VERIFY-config-doctor.md` was read but
      NOT relied on for any verdict; every criterion was re-executed here.
- Scope note (honesty): the verifier applied a DOCUMENTATION-ONLY correction to the FAP (Vercel team scope) during
  landing. The code-under-test (doctor + registries + gate YAML) was left byte-untouched — see Bug report 1.

## Execution evidence (direct runtime output — never a description)
| # | Command | cwd | Exit | Output (verbatim / summarized) |
|---|---------|-----|------|--------------------------------|
| 1 | `node templates/tools/config-doctor.mjs --self-test` | delivery-os | 0 | 16 `✓` lines incl. `✓ 6543 pooler URL is VALID`, `✓ direct :5432 URL is INVALID (port)`, `✓ 6543 but non-pooler host is INVALID`, `✓ non-postgres scheme is INVALID`, `✓ empty DATABASE_URL is MISSING` → `self-test: 16/16 passed.` |
| 2 | `node infra/config-doctor.mjs --env production` | property-lead-os | 1 | `summary: 3 present · 8 missing · 0 invalid · 3 optional-absent (of 14; 11 required)` · `RESULT: FAIL — 8 required key(s) MISSING/INVALID.` Missing set: **DATABASE_URL, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_JWT_SECRET, TICK_TOKEN, CRON_SECRET, ANTHROPIC_API_KEY**. `planes: vercel=unreadable (VERCEL_TOKEN / VERCEL_PROJECT_ID not set) · github=read · local=not consulted`. Each `✗` carries an actionable FIX (DATABASE_URL FIX names the 6543 transaction pooler). |
| 3 | `node infra/config-doctor.mjs --env production` | rumah-admin | 1 | `summary: 0 present · 4 missing · 0 invalid · 6 optional-absent (of 10; 4 required)` · `RESULT: FAIL — 4 required key(s) MISSING/INVALID.` Missing set: **DATABASE_URL, AUTH_JWT_SECRET, CRON_SECRET, PUBLIC_BASE_URL**. Same honest planes line; DATABASE_URL FIX names the 6543 pooler + non-service-role principal. |
| 4 | `diff -q <template doctor> <consumer doctor>` (both consumers) | RUMAH/ | 0 | `PLOS-IDENTICAL` · `ADMIN-IDENTICAL` — vendored doctors are byte-identical to `templates/tools/config-doctor.mjs`. |
| 5 | `node infra/config-doctor.mjs --env development` | both consumers | 1 | dev lane consults local `.env`; reports per-key states without printing values. PLOS: 1 INVALID (local dev DB is not a 6543 pooler — see Bug report 2). rumah-admin: 2 INVALID (same dev-DB-vs-pooler rule). Non-blocking: the dev env is NOT gated in CI (only production is). |
| 6 | grep each registry key vs real code (`packages/config/src/env.ts`, `src/env.ts`/`src/auth.ts`/`src/heartbeat-api.ts`/`src/index.ts`) | both consumers | — | Every registry key resolves to a real read in the codebase. CRON_SECRET + DISCOVERY_SWEEP_ENABLED are read by PLOS cron routes; AUTH_JWT_SECRET/CRON_SECRET/PUBLIC_BASE_URL by rumah-admin src. No phantom/extra keys. DATABASE_URL is the only ZOD-hard-required PLOS key; the rest are zod-optional but PRODUCTION-operational-required (the registry's stated, honest contract). |
| 7 | read `deploy.yml` (PLOS) + `config-gate.yml` (rumah-admin) | both consumers | — | PLOS: a `Config doctor — validate prod config (pre-build gate)` step runs `node infra/config-doctor.mjs --env production` AFTER `vercel pull` and BEFORE `vercel build` — fail-closed (exit 1 stops the deploy). rumah-admin: a `config-gate` workflow on push/PR/dispatch runs the same, fail-closed; intended as a required status check. |
| 8 | independent Vercel-scope cross-check: `deploy.yml` env + `.vercel/repo.json` orgId | both consumers | — | BOTH target TEAM scope **`team_1CSTFxqvnOe9lvHtCsPHSeax`** (PLOS `VERCEL_ORG_ID`; Admin `.vercel/repo.json:orgId`). Corroborates infra-inventory finding D2. The consolidated FAP was SILENT on scope (Bug report 1) — corrected during landing. |

## Acceptance criteria (from the work order — each PASS/FAIL + evidence pointer)
| # | Criterion | Evidence | PASS/FAIL |
|---|-----------|----------|-----------|
| 1 | `--self-test` passes 16/16 (delivery-os) | #1 | PASS |
| 2 | Each app's prod doctor FAILS listing the missing keys (the known truth) | #2 (PLOS 8), #3 (rumah-admin 4) | PASS |
| 3 | Dev/test env behaves honestly | #5 (dev lane reports per-key; non-gated; see Bug 2) | PASS |
| 4 | Registry cross-checks the REAL env schema — no missing/extra required keys vs code | #6 | PASS |
| 5 | DATABASE_URL → transaction-pooler-6543 rule encoded (build-fix + 503-cure) | #1 (rule self-test), #2/#3 (FIX text), doctor `RULES["postgres-pooler-6543"]` + both registries `"rule":"postgres-pooler-6543"` | PASS |
| 6 | Deploy gates run the doctor pre-build and FAIL FAST with the full list | #7 (PLOS pre-`vercel build`; rumah-admin config-gate.yml) | PASS |
| 7 | Consolidated FAP accurate + complete (all keys grouped by platform, correct sources) | #2/#3 (key sets match FAP §2 exactly), #8 (scope gap found + corrected → now complete) | PASS (after the landing correction in Bug 1) |

## Surface statement (anti-Slice-1.0)
- Real surface: a read-only Node CLI validator/resolver + a declarative JSON registry per service + two CI gate
  wirings + one founder-action document. Every behavioral criterion was proven by RUNNING the tool against the real
  on-disk registries and reading the real CI YAML / Vercel link files — not by reading source. The read-only/no-secret
  claims were independently re-confirmed (prod lane reports `local=not consulted`; no value printed).
- [x] No criterion was "verified" via a surface that bypasses the slice.

## Classified open assumptions
| Claim | Status | Severity |
|-------|--------|----------|
| Self-test proves the pooler-6543 rule + the other validators | Evidence-backed (#1) | Blocker (cleared) |
| Prod doctor FAILs with exactly the FAP's missing-key sets | Evidence-backed (#2/#3 = FAP §2 verbatim) | Blocker (cleared) |
| Every registry key maps to a real code read (no phantom keys) | Evidence-backed (#6) | Should-fix (cleared) |
| Vendored doctors === template | Evidence-backed (#4 byte-identical) | Should-fix (cleared) |
| Deploy gates are fail-closed + pre-build | Evidence-backed (#7) | Blocker (cleared) |
| The Vercel scope the founder must edit | Evidence-backed (#8 = TEAM scope, both repos) — FAP corrected to name it | Blocker (cleared via Bug 1 fix) |
| Whether the keys are ALSO truly absent in live Vercel prod | Assumption — the runs report MISSING because the Vercel plane is unreadable here (no token); "not checked, so unverified". Criteria only require MISSING+fix+exit 1, which holds. Live-plane truth is confirmed by the gate running WITH the token in CI. | Safe-to-defer |
| Dev-env DATABASE_URL pooler rule vs a local dev DB | Evidence-backed (#5) — INVALID for a local non-pooler DB; dev is not gated, so non-blocking (Bug 2) | Safe-to-defer |

## Gate ledger
| Gate | Status | Evidence |
|------|--------|----------|
| Build/validate green (self-test 16/16) | ✅ | #1 |
| Failure paths → honest error, no false success | ✅ | #2/#3 (unreadable plane → MISSING/unverified, exit 1 — "not checked" is never "passed") |
| Read-only / no-secret-leak | ✅ | prod lane `local=not consulted`; no value printed (#2/#3); author VERIFY #5/#7/#8 source audit corroborates |
| Determinism (identical inputs → identical output) | ✅ | #1 pure self-test; #2/#3 deterministic given fixed registry + no live planes |
| Migration reversible / fresh-DB | n/a | no DB migration in this platform |
| CI green — machine-read at merge | ⬜ | this is the pre-merge independent lens; CI runs on the PRs |
| Dedicated commit + VERIFY in push | ✅ | this doc + author's `VERIFY-config-doctor.md` both ride the push (delivery-os) |

## FAIL history
- none (no criterion failed; one accuracy DEFECT was found in a doc and corrected during landing — Bug 1).

## Bug reports (defects flow author-ward — the verifier files; here the verifier also corrected the doc-only Bug 1 because the FAP IS the single founder deliverable being landed and accuracy of it is an explicit acceptance criterion)
1. **[Corrected during landing · was Blocker for the founder action] FAP silent on the Vercel TEAM scope.**
   `docs/goals/FAP-infra-config-cutover.md` instructed "Vercel → project property-lead-os / rumah-admin → …" without
   naming the scope. BOTH projects live under the TEAM scope `team_1CSTFxqvnOe9lvHtCsPHSeax` (proven: PLOS
   `deploy.yml VERCEL_ORG_ID`, Admin `.vercel/repo.json orgId`; infra-inventory D2), and the superseded
   `FAP-platform-hardening-v6.md:49` actively named the WRONG personal scope `bkasanwiredjos-projects`. A founder
   editing the personal-scope project would have the deploy silently read the team project → secrets never take
   effect. FIX APPLIED: a CANONICAL VERCEL SCOPE callout was added to FAP §3 and each Vercel section (A/B/C) now names
   the team scope. The code/registries were NOT touched. Forwarded to the author for awareness.
2. **[Non-blocking · observation] DATABASE_URL pooler-6543 rule also applies to `--env development`.**
   Both registries set DATABASE_URL `required.development=true` with `rule: postgres-pooler-6543`, so a developer's
   LOCAL Postgres (e.g. `localhost:5432`, not a `*.pooler.supabase.com:6543` host) is reported INVALID under
   `--env development` (evidence #5). This never blocks anything (only the PRODUCTION lane is gated in CI), and the
   pooler is correct for prod. Author may wish to relax the dev-lane rule (e.g. `postgres-url` for development) so the
   dev report is clean. Filed for the author; not a release blocker.
3. **[Non-blocking · forwarded] Stale wrong-scope line in a sibling doc.**
   `docs/goals/FAP-platform-hardening-v6.md:49` still names the personal scope `bkasanwiredjos-projects`. It is
   declared SUPERSEDED by `FAP-infra-config-cutover.md` (this platform's FAP), but the stale, misleading instruction
   line remains in an untracked doc owned by a different workstream. The verifier did NOT edit it (out of this slice's
   scope + a separate workstream's untracked file); filed so its owner corrects/removes it.

## What the founder must do (the single remaining action — unchanged in substance, now scope-correct)
Per the corrected FAP: enter the production secrets (Vercel TEAM `team_1CSTFxqvnOe9lvHtCsPHSeax`, projects
`property-lead-os` + `rumah-admin`, Production env), upgrade the team plan, apply the prod migrations. Then the deploy
gate re-runs the doctor live and reports PASS. Nothing else here requires founder authority.
