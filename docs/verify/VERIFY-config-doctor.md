---
slice: "config-doctor — Infrastructure Registry & Configuration layer"
verify_status: verified
# ^ one of: planned | generated | executed | verified. The verifier sets 'verified' only when ALL gates below pass.
# RE-VERIFIED 2026-06-27 (sensitive-env fix): an INDEPENDENT qa-test invocation (distinct from the build agent that
# authored the fix) re-ran the gates against the new sensitive-aware classifyVercelEnv() + github-secret process.env
# fallback + 4 new self-test cases. Self-test 20/20 (exit 0); classification rule independently probed 6/6 incl.
# the security edge (a sensitive var carrying a value is still PRESENT, never blank, and its value is never printed);
# github-secret env-fallback forced-tested (gh-unavailable + injected VERCEL_* ⇒ lane github-secret(env), no value
# leak); no regression in the MISSING/INVALID/read-only/no-secret-leak guarantees against both real consumer
# registries; and the template change is byte-identical (LF-normalized) to the merged PLOS PR #205 corrections —
# the only residual template↔PLOS deltas are pre-existing path-resolution (HERE/fileURLToPath) + a lint pragma,
# untouched by this fix. Author != verifier (§3/§12) is satisfied: the verifier did NOT author the code under test.
author: "build agent (Opus 4.8 — sensitive-env fix session)"
verifier: "qa-test agent (Opus 4.8 — independent re-verification invocation, 2026-06-27; distinct from the build agent)"
date: "2026-06-27"
independence_basis: "real-independent — a true second qa-test invocation re-ran the gates against the new code; the verifier did not author the production change under test"
machine_probe: "node templates/tools/config-doctor.mjs --self-test"
impl_fingerprint: '{"templates/tools/config-doctor.mjs":"c1802847c0e2fcd3be5fb97157bbed3a07dc9c53cb288f0d36f25711a100f68a","templates/tools/config-registry.schema.json":"24e23ed9bf3fa581bd85deaa96eadeabda05e82716fb8fff11dc55c11a9689e3"}'
# NOTE (fingerprint correction): the schema hash was stale in the prior header (0a4d7e7a…). The committed schema
# (unchanged since the original infra commit de1f695, verified via git) hashes to 24e23ed9… (sha256, LF). This fix
# touches ONLY config-doctor.mjs (c1802847…, unchanged this verification); the schema entry is corrected to its true value.
---

# VERIFY — Slice config-doctor — Infrastructure Registry & Configuration layer

## Verdict
**verify_status:** `verified` (independent re-verification of the sensitive-env fix; PASS)  ·  one line: the
sensitive-env false-negative fix is APPLIED and an INDEPENDENT qa-test lens (≠ the build agent) re-ran the gates
against the new `classifyVercelEnv()` + github-secret `process.env` fallback — self-test **20/20** (exit 0, incl.
the 4 new sensitive/blank classification cases), the classification rule independently re-probed **6/6** (incl. the
security edge), the env-fallback forced-tested (gh-unavailable + injected `VERCEL_*` ⇒ PRESENT, no value leak), no
regression in the MISSING/INVALID/read-only/no-secret-leak guarantees against both real consumer registries, and the
template change is byte-identical (LF-normalized) to the merged PLOS PR #205 corrections (no extra behavior).

## Independent re-verification evidence (sensitive-env fix — qa-test, 2026-06-27)
| # | Command / probe | Exit | Result |
|---|------------------|------|--------|
| R1 | `node templates/tools/config-doctor.mjs --self-test` (cwd delivery-os) | 0 | **20/20 passed** — incl. `✓ sensitive var (value omitted as '') is PRESENT, not blank`, `✓ encrypted var with ciphertext value is PRESENT, not blank`, `✓ non-sensitive var with empty value IS blank`, `✓ sensitive flag is carried through` |
| R2 | independent extraction + isolated eval of `classifyVercelEnv` over 6 cases (sensitive `value:""`⇒not-blank/sensitive · encrypted ciphertext⇒not-blank · non-sensitive empty⇒blank · non-sensitive whitespace⇒blank · plain value⇒not-blank · **sensitive carrying a value⇒still not-blank/sensitive**) | 0 | **6/6 PASS** — the rule is correct beyond the 4 pinned cases; the security edge (a sensitive var is NEVER reported blank) holds |
| R3 | github-secret env-fallback: forced `gh` unavailable (empty PATH) + injected `VERCEL_TOKEN/ORG_ID/PROJECT_ID` into the job env, ran PLOS prod | — | all three resolve `✓ PRESENT … lane=github-secret(env)`; the injected token VALUE is **NOT printed anywhere** in the output (no secret leak) |
| R4 | no-regression: `node infra/config-doctor.mjs --env production` against the real PLOS and rumah-admin registries (read-only) | 1 each | required keys reported `✗ MISSING` with actionable FIX + honest `lane=…(unverified)`; structural validation passed (full reports produced); `--json` valid JSON (`pass=false`); post-run `git status --porcelain infra/` empty in BOTH consumers (no writes) |
| R5 | template↔PLOS parity: LF-normalized diff of `templates/tools/config-doctor.mjs` vs the merged `../property-lead-os/infra/config-doctor.mjs` (#205) | — | the sensitive-env logic (classifyVercelEnv, the vercel-prod sensitive detail branch, the github-secret env fallback, the 4 self-test cases) is **byte-identical**; the only residual deltas are pre-existing `HERE`/`fileURLToPath` path-resolution + a `/* global fetch */` lint pragma — unrelated to this fix and untouched by the staged diff |
> Re-verification was read-only against the real consumer repos (production lane does not consult local `.env`;
> R4 shows no files written). The verifier did not author the code under test (§3/§12).

## What changed since the prior `verified` verdict (the sensitive-env fix — re-verification scope)
- `fetchVercelKeys()` now classifies each Vercel env entry via the new pure `classifyVercelEnv(e)`:
  `type:"sensitive"` with `value:""` ⇒ PRESENT-but-unreadable (NOT blank); only a non-sensitive var with an
  explicitly empty value is blank. (Ports the merged PLOS PR #205 fix.)
- `evaluate()` (vercel-prod lane) PRESENT detail now distinguishes a SENSITIVE variable from an encrypted one.
- `evaluate()` (github-secret lane) now checks `process.env[key.name]` before reporting MISSING(unverified) —
  the VERCEL_* secrets a Vercel runner cannot `gh secret list` but which the workflow injects into the job env.
- `selfTest()` adds 4 cases pinning the classification (sensitive value:"" ⇒ not blank · encrypted ciphertext
  ⇒ not blank · non-sensitive empty ⇒ blank · sensitive flag carried) → **20/20** (was 16/16).
- Independent re-verification owed (qa-test): re-run `--self-test` (expect 20/20), and re-run the live-plane
  behavior checks (#2/#3/#4 below) against the real consumer registries to confirm no regression in the
  MISSING/INVALID/read-only/no-secret-leak guarantees with the new classification path.

## Original verdict (PRE-FIX — retained as history, no longer the active verdict)
**verify_status:** `verified`  ·  one line: all 5 acceptance criteria PASS on their own surface — self-test 16/16 exit 0, both consumer prod runs report the known-missing keys with actionable fixes and exit 1, `--json` is valid JSON, the tool is provably read-only and prints no real secret value, and both consumer registries load through the doctor's structural validation without error.
> A verdict of `verified` is permitted ONLY if: every acceptance criterion PASSes on its OWN surface,
> every load-bearing claim is Confirmed/Evidence-backed, all required gates are closed, and the
> verifier was a REAL distinct lens from the author. Otherwise the slice caps at `executed`.

## Independence header  (Governance §3/§12 — proves author ≠ verifier)
- Verifier identity / invocation: qa-test agent · independent invocation · 2026-06-27 (distinct from the build session that authored the tool)
- Author identity (code under test): build agent (Opus 4.8 build session)
- [x] I assert: the verifier did **not** author the production code under test.
- [x] Independence was **real** (a true second invocation, not the same context restyled).

## Execution evidence  (Governance §1 — direct runtime output, never a description of what *would* happen)
| # | Command | Exit | Output (verbatim / log path) |
|---|---------|------|------------------------------|
| 1 | `node templates/tools/config-doctor.mjs --self-test` (cwd delivery-os) | 0 | 16 `✓` lines incl. `✓ 6543 pooler URL is VALID`, `✓ direct :5432 URL is INVALID (port)`, `✓ 6543 but non-pooler host is INVALID`, `✓ non-postgres scheme is INVALID`, `✓ empty DATABASE_URL is MISSING` → `self-test: 16/16 passed.` |
| 2 | `node infra/config-doctor.mjs --env production` (cwd property-lead-os) | 1 | `✗ MISSING DATABASE_URL (required, vercel-env…)` + pooler-6543 FIX; `✗ MISSING SUPABASE_URL (required, supabase…)` + FIX; `planes: vercel=unreadable (VERCEL_TOKEN / VERCEL_PROJECT_ID not set) … local=not consulted`; `summary: 3 present · 8 missing · 0 invalid · 3 optional-absent`; `RESULT: FAIL — 8 required key(s) MISSING/INVALID.` |
| 3 | `node infra/config-doctor.mjs --env production` (cwd rumah-admin) | 1 | `✗ MISSING DATABASE_URL (required, vercel-env…)` + pooler-6543 FIX; `✗ MISSING AUTH_JWT_SECRET (required, supabase…)` + FIX; `summary: 0 present · 4 missing · 0 invalid · 6 optional-absent`; `RESULT: FAIL — 4 required key(s) MISSING/INVALID.` |
| 4 | `node infra/config-doctor.mjs --env production --json \| node (JSON.parse)` (cwd property-lead-os) | 0 (parse) | `VALID JSON · service=property-lead-os · pass=false · keys=14 · planes.local=not consulted …` — output parsed by a second Node process without error |
| 5 | secret scan of `--json` output (`grep -Eo 'postgres://…\|sk-…\|eyJ…'`) + cross-ref to registry `example` fields | — | matches were ONLY redacted registry examples: `DATABASE_URL example= postgres://postgres.<project-ref>:<redacted>@…pooler.supabase.com:6543/postgres`, `SUPABASE_ANON_KEY example= eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.<redacted>` — no real secret VALUE present (prod `.env` never read: `planes.local=not consulted`) |
| 6 | byte-compare vendored copies vs template (Node `fs.readFileSync` strict `===`) | 0 | `PLOS vendored identical to template: true` · `rumah-admin vendored identical to template: true` |
| 7 | `grep writeFile\|appendFile\|mkdir\|rmSync\|unlink\|createWriteStream\|.write(` over config-doctor.mjs | — | only `process.stdout.write` / `process.stderr.write` hits; no filesystem write API; sole `execSync` is `gh secret list` (read-only) |
| 8 | `git status --porcelain infra/` in both consumers after the runs | 0 | `?? infra/` only (pre-existing untracked dir) — no file created/modified by the runs |
> A row with no command + real output is not evidence. Prose is not evidence.
> **Machine-guard line:** verification is read-only against real consumer repos; the production lane does NOT consult local `.env` by default (`planes.local=not consulted` confirmed in evidence #2/#3/#4), so no real prod secret enters the run. No shared mutable store/port/DB touched.

## Acceptance criteria  (copied verbatim from the slice — each PASS/FAIL + its evidence pointer)
| # | Criterion | Surface exercised | Evidence (→ cmd #) | PASS/FAIL |
|---|-----------|-------------------|--------------------|-----------|
| 1 | `--self-test` exits 0 and proves the validators (esp. DATABASE_URL: pooler :6543 VALID; :5432 INVALID; non-pooler host INVALID; missing = MISSING) | running the tool's self-test (pure rule engine) | #1 | PASS |
| 2 | PLOS prod (no VERCEL_TOKEN) reports DATABASE_URL + SUPABASE_URL MISSING with an actionable fix, exits 1 | running the vendored tool against the real PLOS registry | #2 | PASS |
| 3 | rumah-admin prod reports DATABASE_URL + AUTH_JWT_SECRET MISSING, exits 1 | running the vendored tool against the real rumah-admin registry | #3 | PASS |
| 4 | `--json` emits valid JSON; NEVER prints a secret VALUE (only names/states/redacted examples/fixes); NEVER writes | piping JSON through a parser + secret scan + write-API source audit + post-run git status | #4, #5, #7, #8 | PASS |
| 5 | The registries pass the doctor's structural validation (loading them does not error) | both consumer registries loaded by the doctor through `structuralCheck` without a code-2 error | #2, #3 (reports produced ⇒ structural check passed) | PASS |
> A criterion whose evidence does NOT touch its own surface is FAIL — regardless of a green check.

## Surface statement  (anti-Slice-1.0)
- The slice's real surface: a Node CLI tool (read-only validator/resolver) + a declarative JSON registry per service. Driven by: actually executing the tool against the real PLOS and rumah-admin registries on disk, plus the tool's own self-test for the rule engine, plus a Node JSON parser for the `--json` contract.
- [x] No criterion was "verified" via a surface that bypasses the slice. Each criterion was proven by RUNNING the tool, not by reading it (the read-only/no-secret claims are additionally backed by a source audit, but the behavioral claims are all execution-backed).

## Classified open assumptions  (every claim the verdict rests on)
| Claim | Confirmed / Evidence-backed / Assumption / Unverified / Failed | Severity |
|-------|---------------------------------------------------------------|----------|
| Rule engine catches the critical DATABASE_URL failure modes | Evidence-backed (#1) | Blocker (cleared) |
| Production lane does NOT read local `.env` by default (no real secret enters the run) | Evidence-backed (#2/#3/#4 show `planes.local=not consulted`) | Blocker (cleared) |
| `--json` output contains no real secret VALUE (only redacted examples) | Evidence-backed (#5: matched strings are registry `example` fields with `<redacted>` placeholders) | Blocker (cleared) |
| Tool is read-only (no filesystem writes, no prod writes) | Evidence-backed (#7 source audit: only stdout/stderr writes + read-only `gh secret list`; #8 git clean) | Blocker (cleared) |
| Vendored consumer copies are the same tool as the template | Evidence-backed (#6: byte-identical) | Should-fix (cleared) |
| Both consumer registries pass structural validation | Evidence-backed (#2/#3 produced full reports; a malformed registry exits 2 before reporting) | Should-fix (cleared) |
| The "known truth" of WHICH keys are actually missing in real Vercel prod | Assumption — the runs report MISSING because the Vercel plane is unreadable (no VERCEL_TOKEN), i.e. "not checked, so unverified". The criteria only require these keys be reported MISSING with a fix and exit 1, which is satisfied; whether they are ALSO truly absent in Vercel is not independently confirmed here. | Safe-to-defer |
> ANY load-bearing claim not Confirmed/Evidence-backed → status caps at `executed`.

## Gate ledger  (DoD core rows + active pack rows — each ✅ needs an evidence pointer; ⬜/🔴 are honest)
| Gate | Status | Evidence |
|------|--------|----------|
| Build/validate green (self-test) | ✅ | →R1 (20/20, exit 0) — supersedes the pre-fix cmd #1 (16/16) |
| Dedicated commit + slice id (or NO-GIT flagged) | ⬜ | Verifier does not commit; impl files are working-tree changes (`templates/tools/*`), commit is the author's gate |
| **CI green — machine-read at merge** | ⬜ | Not at merge time; this is a pre-merge independent verification |
| Migration reversible + applies-clean-on-fresh-DB | n/a | No DB migration in this slice (config-validation tool only) |
| Failure paths → honest error, no false success | ✅ | →cmd #2/#3: unreadable plane → keys reported MISSING (unverified), exit 1 — "not checked" is never "passed" |
| Read-only / no-secret-leak (pack: security) | ✅ | →cmd #5, #7, #8 |
| Determinism (identical inputs → identical output) | ✅ | →cmd #1 (pure self-test) + #2/#3 deterministic given fixed registry + no live planes |
> v4 note: CI-green-at-merge is owned by the merge gate; this VERIFY is the pre-merge independent lens.

## FAIL history  (kept in-doc — a failed run is part of the record, never overwritten)
- none

## Bug reports  (defects flow author-ward — the verifier files, never fixes)
1. None blocking. [Safe-to-defer / observation] In production with no readable Vercel plane and no `gh`-discoverable secret, a required key is reported `MISSING` with lane `vercel-prod(unverified)` — the human report's lane label and the "required but not set" detail are honest, but a reader skimming only the `✗ MISSING` line could mistake an *unverified* plane for a *confirmed-absent* value. The header line `planes: vercel=unreadable (…)` mitigates this. Consider surfacing an explicit `UNVERIFIED` qualifier on the per-key line when the authoritative plane was unreadable, to make "not checked ≠ confirmed missing" impossible to miss. Non-blocking; the exit code and overall FAIL are correct.
