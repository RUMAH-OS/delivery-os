# The rollback playbook — the Neo move is never a one-way door

> Every step of the Neo CI/CD move is reversible by **one repo variable** or **one line**
> (NEO-ARCH-01 §B.4, ADR-004; NEO-EXEC-07 §7.4). That reversibility — not the absence of risk — is
> what makes concentrating CI + deploy on one solo-owned machine acceptable. The escape hatch lives on
> **GitHub**, precisely so a dead Neo cannot disable its own rescue.

## The three tiers, fastest first

### Tier 1 — flip `vars.CI_RUNNER` (the headline lever) — seconds, no commit, works when Neo is DEAD

In the GitHub UI: **Settings → Secrets and variables → Actions → Variables**.

- **Roll the whole fleet back to GitHub-hosted:** **clear or delete** the `CI_RUNNER` variable.
  Empty ⇒ the expression returns `ubuntu-latest`. Every future job runs on a GitHub-hosted runner
  immediately, with **no commit, no PR, no green pipeline required, and no dependency on Neo.**
- **Roll forward again:** set `CI_RUNNER` back to `["self-hosted","neo"]`.

> Do **not** set the variable to a bare `ubuntu-latest` string — it is parsed by `fromJSON()` and a
> non-JSON value errors. The supported rollback is to **clear** it (the `== ''` branch returns
> `ubuntu-latest`). This is the single most important operational fact in this folder.

**When to use:** Neo offline/dead, a runner-env regression, a macOS update broke colima, or any time
the whole CI floor needs to be on hosted *now*.

### Tier 2 — per-check revert — minutes, isolates one flaky check

Give the *one* misbehaving job a literal `runs-on: ubuntu-latest` while every other job keeps the
`vars.CI_RUNNER` expression. This isolates a single check that is flaky on Neo without abandoning the
move for the rest of the fleet. It is a one-line commit to that job.

```diff
   flaky-check:
-    runs-on: "${{ vars.CI_RUNNER == '' && 'ubuntu-latest' || fromJSON(vars.CI_RUNNER) }}"
+    runs-on: ubuntu-latest   # pinned to hosted while we debug Neo-specific flake
```

### Tier 3 — bad-deploy rollback — `vercel promote` to the last-known-good

If the **binding** post-deploy verify ALARMs (it now fails the job instead of swallowing the error),
the deploy that just shipped is unhealthy. Roll production back by **promoting the last-known-good
deployment** — no rebuild, instant:

```sh
node infrastructure/execution-node/ci-cd/rollback-helper.mjs
# prints the exact `vercel promote <url>` for the previous READY production deployment
```

The helper is **read-only** (it lists deployments via the Vercel API and prints the command); it does
**not** execute the promote — promoting prod stays a deliberate founder act (Class-C). Run the printed
command to roll back.

## The full lever table (CI + worker, for completeness)

| Lever | Mechanism | RTO | When |
|---|---|---|---|
| **`vars.CI_RUNNER` flip** | clear the repo variable in the GitHub UI | seconds | Neo offline/dead; whole CI floor back to hosted |
| **Per-check `runs-on` revert** | literal `ubuntu-latest` on one job | minutes | a single check flaky on Neo |
| **`vercel promote`** (Tier 3) | `rollback-helper.mjs` → promote last-known-good | minutes | a binding post-deploy verify ALARM |
| Worker daemon restart | launchd `KeepAlive` auto-restart | auto | daemon crash/OOM (worker scope, not CI) |
| Worker daemon unload | `launchctl bootout system/com.deliveryos.worker` | seconds | a bug-loop (worker scope) |
| Token rotation | rotate via the config platform; ephemeral runner ⇒ no stale secret persists | minutes | suspected token leak |

## The honest cost of the fallback

GitHub-hosted is the fallback **floor**, but it **costs the very minutes the Neo move set out to
stop spending**. So Tier 1 is a **bridge, not a home**: clear `CI_RUNNER` to survive a Neo outage, but
the operational goal is to get Neo healthy and flip back. The off-Neo watchdog is what turns "Neo
silently died" into "the founder got a ping" before the minutes drain.
