---
slice: "ei-cicd-p3-4 — runs-on flip + binding deploy + handshake + rollback (static)"
verify_status: verified
author: "Builder (P3.4 — infrastructure/execution-node/ci-cd assets)"
verifier: "qa-test (independent, claude-opus-4-8) — 2026-06-30T00:00Z"
independence_basis: "recorded-distinct-invocation — separate QA session, no authorship of the assets under test; checks re-run from a clean read of disk"
machine_probe: "node --check infrastructure/execution-node/ci-cd/rollback-helper.mjs"
runtime_validation: "DEFERRED to install-time — the runs-on flip, the Neo deploy, and the live workflow edits cannot run without the online self-hosted runner + Neo; the founder validates on a real apply (M1 parity / M3 / M5)."
---

# VERIFY — ei-cicd-p3-4 (CI/CD + deploy wiring assets, STATIC)

## Verdict
**verify_status: `verified`** — all 7 acceptance criteria pass under independent static checks. All
three `.yml` parse, the `.mjs` parses, the `runs-on` flip has a working always-available GitHub-hosted
floor with a clear-to-rollback that survives a dead Neo, there is **no active `continue-on-error`** in
the binding deploy verify, **no inline secret literals**, the rollback helper is **read-only**, and the
binding cutover (M3/M5) is correctly gated as a founder ★ act. Runtime validation is **DEFERRED** to
install — these assets install nothing and edit no live workflow (by design).

## Acceptance criteria — results

| # | Criterion | Result |
|---|---|---|
| 1 | Well-formedness — 3 `.yml` parse + `node --check` the helper | PASS |
| 2 | `runs-on` flip logic correct (floor + clear-to-rollback warning) | PASS |
| 3 | Deploy verify BINDING (no continue-on-error; token-attributed; migrate-before-code) | PASS |
| 4 | No secret literals | PASS |
| 5 | Label + isolation consistency with `register-runner.sh` | PASS |
| 6 | `rollback-helper.mjs` is read-only | PASS |
| 7 | Apply procedure correctly gated (M3/M5 founder ★, live edits deferred) | PASS |

## Primary probe — parse results

```
=== node --check rollback-helper.mjs ===
PARSE-OK: rollback-helper.mjs

=== YAML parse (python/pyyaml safe_load) ===
YAML-OK: runs-on/runs-on-flip.snippet.yml
YAML-OK: deploy/deploy-job.snippet.yml
YAML-OK: deploy/reusable-deploy.yml
```

All three workflow YAMLs are well-formed; the helper parses as valid JS.

## Primary probe — `continue-on-error` grep

Searched the whole folder for the literal, then narrowed to an ACTIVE YAML key
(`^\s*continue-on-error:` in `*.yml`):

```
=== active continue-on-error YAML keys in *.yml ===
NONE-ACTIVE (only diff/comment/doc mentions)
```

The only occurrences are:
- `deploy/DEPLOY-JOB.md:31` — `-        continue-on-error: true` inside a **`diff` block, on a `-`
  (removed) line** — i.e. documenting the PLOS line being deleted, not an active key.
- comments / prose in `reusable-deploy.yml`, `deploy-job.snippet.yml`, `apply-cicd.md`, `DEPLOY-JOB.md`
  that assert "no continue-on-error".

The two real deploy templates (`deploy-job.snippet.yml:80`, `reusable-deploy.yml:103`) have a
`Post-deploy health verification (BINDING)` step with **no `continue-on-error`** key — so an unhealthy
deploy after the retry/self-heal window fails the job. PLOS's soft spot is fixed. **PASS.**

## `runs-on`-expression assessment — is there ALWAYS a GitHub-hosted fallback?

Expression (identical in all three YAMLs):
`"${{ vars.CI_RUNNER == '' && 'ubuntu-latest' || fromJSON(vars.CI_RUNNER) }}"`

GitHub `a && b || c` short-circuit evaluation:

| `vars.CI_RUNNER` | `== ''` | resolves to | Effect |
|---|---|---|---|
| unset / empty | true → `true && 'ubuntu-latest'` | `'ubuntu-latest'` | **GitHub-hosted floor (always available)** |
| `["self-hosted","neo"]` | false → `\|\| fromJSON(...)` | `[self-hosted, neo]` | routes to Neo |
| bare `ubuntu-latest` (UNSUPPORTED) | false → `fromJSON('ubuntu-latest')` | **errors** | — see below |

- **There is always a GitHub-hosted fallback:** an unset/empty variable deterministically yields
  `ubuntu-latest`. Because `CI_RUNNER` is a GitHub-side repo variable, the floor has **no dependency on
  Neo** — clearing it reroutes the whole fleet to hosted in seconds, with no commit and no green
  pipeline, even when Neo is dead. The escape hatch lives where it can still be pulled.
- **The dead-Neo strand is avoided.** The deploy job uses the same expression; clearing the variable
  also returns the deploy to `ubuntu-latest`, and the doc correctly notes the token (not the host)
  carries deploy identity, so hosted can still deploy.
- **The `fromJSON` foot-gun is explicitly warned** in all three places: `runs-on-flip.snippet.yml:16-17`,
  `RUNS-ON-FLIP.md:57-59`, `ROLLBACK.md:19-21` — each states the rollback is to **CLEAR** the variable,
  NOT to set a bare `ubuntu-latest` string (which is invalid JSON and would error `fromJSON()`).
- **Per-check escape (Tier 2):** a single flaky job can be pinned to a literal `runs-on: ubuntu-latest`
  while the rest keep the expression (`ROLLBACK.md` Tier 2). Sound.

**Assessment: the flip cannot strand CI on a dead Neo — the always-available `ubuntu-latest` floor and
the clear-to-rollback are present, correct, and documented. PASS (no BLOCKING issue).**

## Remaining criteria — evidence

- **3 (binding deploy, cont.):** token-attributed via `--token="${{ secrets.VERCEL_TOKEN }}"` on
  pull/build/deploy (`deploy-job.snippet.yml:63,65,71`); no interactive auth. The Supabase migrate
  (`supabase migration up --db-url "$SUPABASE_DB_URL"`, session pooler `:5432`) runs at lines 56-59,
  BEFORE the pull/build/deploy steps (62-73) — schema ahead of code, forward-only. PASS.
- **4 (no secret literals):** grep for `team_…` / `prj_…` / `postgres(ql)://…` / 40+-char tokens →
  none. Every secret flows via `secrets.*` / `env:` / `inputs:`. The only `supabase.co` hits are the
  prose `db.<ref>.supabase.co` placeholder explaining why Neo must use the pooler. PASS.
- **5 (label + isolation):** `runs-on: [self-hosted, neo]` ⊆ the runner's registered labels
  `DOS_RUNNER_LABELS="neo,macos,self-hosted"` (`bootstrap/_lib.sh:147`, `node-config.env.example:24`,
  `register-runner.sh:90-94`) — matches by intersection. Handshake posture is sound: runner long-polls
  OUTBOUND (no inbound port / no public IP, `HANDSHAKE.md:38`), `--ephemeral` (de-registers per job),
  non-admin `ci-runner` user, and **never `pull_request_target`** (an absolute reviewed rule,
  `HANDSHAKE.md:63-65`; `config-templates/runner.config.example` `"no_pull_request_target": true`). PASS.
- **6 (helper read-only):** `rollback-helper.mjs` performs a single GET (`fetch .../v6/deployments`,
  Authorization Bearer) and `console.log`s the `vercel promote <url> --token=$VERCEL_TOKEN` command.
  No `child_process`/`exec`/POST/promote call anywhere; token + ids read from `process.env` only
  (`readEnv()`); explicit "does NOT execute the promote" (lines 13, 106). PASS.
- **7 (gating):** `apply-cicd.md` marks **Step 4 (M3)** and **Step 5 (M5)** as "★ FOUNDER GATE";
  M3 (binding-check flip) is gated on "parity proven and the runner online" (Step 3 M1 byte-identical
  proof first); the "Deferred to install-time" section confirms the live `rumah-admin`/`property-lead-os`
  workflow edits and the `CI_RUNNER` creation are NOT done by shipping these assets. PASS.

## Notes / scope
- **Runtime validation DEFERRED to install** (no runner / no Neo in this environment). The static gate
  proves the assets are well-formed, secret-clean, rollback-safe, and correctly gated; it does NOT prove
  a live Neo run yields a byte-identical verdict — that is the founder's M1 parity proof at apply-time.
- No production code was modified. No live workflow was edited. No push.

## Independent reproduction
```
node --check infrastructure/execution-node/ci-cd/rollback-helper.mjs
python -c "import yaml; yaml.safe_load(open(f))"   # for each of the 3 .yml
grep -rnE '^[[:space:]]*continue-on-error:' --include='*.yml' infrastructure/execution-node/ci-cd
grep -rnE 'team_[0-9a-zA-Z]{20,}|prj_[a-zA-Z0-9]{20,}|postgres(ql)?://[a-zA-Z0-9]' infrastructure/execution-node/ci-cd
```
