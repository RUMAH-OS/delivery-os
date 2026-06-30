# The `runs-on` flip pattern — one line per job + a UI kill-switch

> The headline lever of the whole Neo move (NEO-ARCH-01 §B.4, ADR-004; NEO-EXEC-07 §7.1).
> Moving a check's compute from a GitHub-hosted runner to Neo is **one line changed per job plus one
> repo variable**. Reverting it is **zero lines** — you clear the variable in the GitHub UI.

## What changes (the exact diff)

Per binding-check job, the only edit is the `runs-on:` value:

```diff
 jobs:
   build-and-migrate:
-    runs-on: ubuntu-latest
+    runs-on: "${{ vars.CI_RUNNER == '' && 'ubuntu-latest' || fromJSON(vars.CI_RUNNER) }}"
     services:
       postgres:
         image: postgres:16
     # ... every step below is UNCHANGED ...
```

Apply the identical edit to each job you want on Neo (`build-and-migrate`, `engine-ownership`, …).
Nothing else in the job changes — the steps are platform-agnostic (Node + `postgres:16` + gitleaks
behave identically on Neo's colima as on a GitHub-hosted runner). See `runs-on-flip.snippet.yml`.

## The repo variable `vars.CI_RUNNER` — the kill-switch

`CI_RUNNER` is a GitHub **repository variable** (Settings → Secrets and variables → Actions →
**Variables** → New repository variable), *not* a secret. It carries no credential; it only selects
where jobs run. The expression above resolves it as:

| `vars.CI_RUNNER` value | `runs-on` resolves to | Effect |
|---|---|---|
| unset / empty | `ubuntu-latest` | **GitHub-hosted (the always-available floor)** |
| `["self-hosted","neo"]` | `[self-hosted, neo]` | routes the job to the Neo runner |

**The value, when set, must be a JSON array string** — it is parsed by `fromJSON()`. Set it to
exactly `["self-hosted","neo"]` (no spaces required; this is what the runner is labelled with by
P3.2 `register-runner.sh`: `DOS_RUNNER_LABELS="neo,macos,self-hosted"`).

## Why this shape (and not a literal `runs-on: [self-hosted, neo]`)

A literal label in the file is a valid first move, but reverting it then needs a **commit + push +
CI run** — which is the one thing you cannot do cleanly when Neo (your CI) is dead. Routing through
the repo variable means:

- **The flip has no commit.** Set or clear `CI_RUNNER` from the UI; future runs reroute immediately.
- **The rollback works when Neo is down.** Clearing the variable falls through to `ubuntu-latest`
  with no dependency on Neo, GitHub, or a green pipeline. The escape hatch lives on GitHub, not on
  the machine it rescues.
- **It is fleet-wide by default, per-check by exception.** One variable flips every job that uses the
  expression. To isolate a single flaky check, give *that one job* a literal `runs-on: ubuntu-latest`
  while the rest keep the expression — per-check rollback without abandoning the move.

## How to roll back (precisely)

**Clear or delete the `CI_RUNNER` variable** in the GitHub UI. Empty ⇒ `ubuntu-latest`. Do **not**
set it to a bare `ubuntu-latest` string — that is not valid JSON and `fromJSON()` would error; the
supported rollback is to clear it so the expression's `== ''` branch returns `ubuntu-latest`.
(Full ladder in `../docs/ROLLBACK.md`.)

## The order of application (do not skip)

1. **Parity-prove first (M1).** Add a *non-binding* clone of the check pinned to `[self-hosted, neo]`
   and confirm a **byte-identical verdict** vs the GitHub-hosted run on the same commit. Only then flip.
2. **Flip binding checks one at a time (M3 — founder ★).** Binding checks gate the merge floor; move
   them individually so a regression is isolated to one check, not the whole gate.

Both steps require the **runner online** and are deferred to install-time — they are not done by
shipping this asset.
