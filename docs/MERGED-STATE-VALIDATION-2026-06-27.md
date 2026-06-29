# Merged-State Validation — post-12-merge full regression (2026-06-27)

QA / independent verification. Read-only except this report. NEVER touched prod / ALLOW_PROD_DB.
Scope: the **merged `main`** of all three repos after this session's 12 merges. Out of scope (separately
founder-gated): Wave-1 live e2e + deployed-prod verification.

**Goal:** confirm each merged `main` is regression-green **modulo the documented known pre-existing reds** —
i.e. the 12 merges introduced no cross-PR regression.

## VERDICT: GREEN (merged state)

All three merged mains are regression-green modulo the documented known pre-existing reds. The 12 merges
introduced **no cross-PR regression**. Two non-listed local reds surfaced in rumah-admin and were
root-caused to **test-harness / local-environment artifacts (NOT code regressions)** and proven green under
CI-canonical conditions (details below). No NEW post-merge regression found in any repo.

| Repo | HEAD sha | typecheck | build | suite | verdict |
|---|---|---|---|---|---|
| delivery-os | `099db2a` | n/a | n/a | self-tests PASS; validate-skills fail = known 3-skill gaps | GREEN modulo known |
| rumah-admin | `7afa85a` | 0 | 0 | 1001 passed / 2 failed (both classified non-regression or known) | GREEN modulo known |
| property-lead-os | `99e7596` | 0 | 0 | 2608 passed, 0 failed | GREEN |

---

## 1. delivery-os — HEAD `099db2a`

`main` up to date. Working tree near-clean (signals.jsonl append + untracked docs/skill — not under test).

| Check | Exit | Result |
|---|---|---|
| `node scripts/check-hook-paths.mjs` | 0 | PASS — 34 references, 0 broken |
| `node scripts/check-hook-paths.mjs --self-test` | 0 | PASS |
| `node scripts/validate-skills.mjs` | 1 | FAILED (fail-closed) — see below |
| `templates/tools/review-trigger.mjs --self-test` | 0 | PASS |
| `templates/tools/learning-trigger.mjs --self-test` | 0 | PASS (3-level trigger + fail-safe proofs) |
| `templates/tools/boundary-classify.mjs --self-test` | 0 | PASS |
| `templates/tools/goal-stop.mjs --self-test` | 0 | PASS |

**validate-skills (exit 1):** 26 skills, 4 errors across exactly **3 skills** — `ci-release-orchestrator`
(missing `## Process`), `parity-oracle` (missing `## Process` + `## Verification`), `repo-governance`
(missing `## Process`). This matches the **documented pre-existing 3-skill format gaps**. The new untracked
skill `capability-ux-audit` validates `ok`. **No new skill regression.**

**Verdict: GREEN modulo the documented pre-existing 3-skill validate-skills format gaps.**

---

## 2. rumah-admin — HEAD `7afa85a`

`main` fast-forwarded (#16 keystone-reliability + owner-invoices-enterprise wave). Clean tree.
Suite run CI-canonical: `RUMAH_ENV=test` against the throwaway test DB (`rumah-admin-testdb`, :55432),
schema fully migrated incl. the founder-gated set (`db:migrate -- --include-gated`), capability catalog
generated, serial vitest (`fileParallelism:false`).

> Tooling note: the first `npm ci` aborted (EPERM — a stale `esbuild.exe` locked `tsx/.../esbuild.exe`,
> a Windows file-lock, not a code issue). `taskkill` was denied (read-only safety). A non-destructive
> `npm install` reconciled deps cleanly (exit 0). This is an environment artifact only.

| Check | Exit | Result |
|---|---|---|
| `npm run typecheck` | 0 | PASS |
| `npm run build` | 0 | PASS |
| `RUMAH_ENV=test npm test` | 1 | Test Files 3 failed / 80 passed (83); Tests **2 failed / 1001 passed / 4 skipped** (1007) |

### Red classification (4 files showed red across runs) — 0 NEW regressions

1. **`tests/contract.inventory-v1.test.ts`** → **KNOWN pre-existing** (the inventory-v1 red). Accepted.
2. **`tests/inventory-units-seam.test.ts`** → **KNOWN pre-existing** (shared-outbox timing flake; failed in a
   2-file isolation run, green in the full serial run). Accepted.
3. **`tests/migration.smoke.test.ts`** → **NOT a regression — env-injection harness gap.** The file reads
   `process.env.DATABASE_URL` directly at module load (not via `src/env.ts`). With only `RUMAH_ENV=test`
   the var isn't in `process.env`. CI exports `DATABASE_URL`. Re-run with `DATABASE_URL` exported →
   **PASS 3/3.**
4. **`tests/capability-consume-real-intents.qa.test.ts`** → **NOT a regression — local-sibling artifact;
   CI-green (proven).** Root cause: the test's independent oracle filters catalog rows matching
   `/\bsign(ing|ature)?s?\b/i` and asserts only `mail` matches. Running locally with the sibling
   `../delivery-os` present, `capability-registry.mjs` scanned delivery-os too and pulled in the
   `deployment-authorization` capability (description contains "founder **signature**"), making the oracle
   `['mail','deployment-authorization']`.
   - The CI `build-and-migrate` job does **no sibling delivery-os checkout** (ci.yml L53-59: "no
     delivery-os checkout → 27 rumah-admin-vendored caps") — the test is baselined for exactly that.
   - The `deployment-authorization` manifest + its "signature" wording predate this session (delivery-os
     commit `7267ef8`, 2026-06-25); the test and `capability-registry.mjs` were **untouched** by this
     session's 2 rumah-admin merges (`2655360..HEAD` empty for both).
   - **Proof of CI-green:** regenerated the catalog CI-faithfully (`--roots <rumah-admin>` → 27 caps,
     signing-oracle = `['mail']`) and re-ran the test → **PASS 9/9.**

**Keystone reliability + Owner-Invoices co-exist green:** `keystone-p0-heartbeat.author.test.ts` (9),
`keystone-p0-send-and-drain.author.test.ts` (6), and the full owner-invoices set
(`owner-invoices.independent-qa` 34, `owner-invoices-ar-regenerate.independent-qa` 9,
`owner-invoice-detail.independent-qa` 11, + 5 more files) all GREEN.

**Verdict: GREEN modulo the 2 known pre-existing inventory reds.** The other two reds are a local
harness/env artifact and a local-sibling artifact, both proven green under CI-canonical conditions.
No cross-PR regression.

---

## 3. property-lead-os — HEAD `99e7596`

`main` fast-forwarded (discovery-pipeline-continuity, orchestrator-auto-trigger, optimize-verify-parallel,
db-transaction-pooler). Clean tree. Suite run with `DATABASE_URL` → :5433 server; the harness derives +
drops/recreates the guarded `plos_test` DB per run (globalSetup) and overwrites each worker's
`DATABASE_URL` (setup-db).

| Check | Exit | Result |
|---|---|---|
| `pnpm -r typecheck` | 0 | PASS — all 12 workspace projects |
| `pnpm -r build` | 0 | PASS |
| `pnpm test` | 0 | **Test Files 221 passed / 1 skipped (222); Tests 2608 passed / 7 skipped (2615)** |

- **No reds at all.** The known acceptable red `tests/r1-business-pack.test.ts` (shared-DB flake) was
  **green this run** (6/6).
- `"relation ... already exists, skipping"` lines are harmless idempotent-migration NOTICEs.

### Scope-pins consistent (no leftover stale pins from the 4 merges)

The orchestrator defines failure class **F1 = stale-conformance-migration-pins** (re-pin expected migration
count/maxNum to the on-disk value). The 4 merges added **no new migrations** (the pull diff is cron
routes / lib / tests only — no `packages/db/migrations/*`), so those pins were undisturbed. The full
conformance suite — `scope-conformance`, `s29/s31/s32/s33-conformance`, `admin-events-migration` — is
**green**, which is the authoritative consistency signal. The merged Discovery + reliability scope-pins are
consistent.

**Verdict: GREEN.**

---

## Cross-repo conclusion

The merged `main` of each repo is **regression-green modulo the documented known pre-existing reds**:
- delivery-os: 3-skill validate-skills format gaps (known).
- rumah-admin: `contract.inventory-v1` + `inventory-units-seam` (known); the two non-listed reds
  (`migration.smoke`, `capability-consume`) are test-harness / local-environment artifacts, proven green
  CI-canonically — **not code regressions.**
- property-lead-os: none.

**The 12 merges did not introduce any cross-PR regression. MERGED STATE: GREEN.**
(Wave-1 live e2e + deployed-prod verification remain separately founder-gated and out of scope here.)
