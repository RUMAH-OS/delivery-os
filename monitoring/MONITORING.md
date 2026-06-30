# Off-Neo monitoring & watchdog — wire-up (MONITORING-WIREUP-v1)

> The OFF-Neo half of the Neo operational nervous system (`docs/architecture/neo/03-heartbeat-and-monitoring.md`,
> NEO-HBM-v1). The ON-Neo half (the engine-tick, the `/health`+`/ready` server, the `/ready`-gated Healthchecks
> pusher) is built in `infrastructure/execution-node/`. This subsystem (`monitoring/`) is everything that must run
> on a **different failure domain than Neo** — the independent pull-watchdog and the founder status surface.
>
> **Position:** `monitoring/` is an **adapter** (`architecture.config.json` → `adapters` layer). It consumes the
> Core Health-Emission **contract** by shape only and imports no Core internal; it is a sibling of
> `infrastructure/` (NOT nested inside Neo's node folder) precisely because it cannot share Neo's failure domain.
> **Nothing here is installed by this sprint** — the founder wires the Scheduled Task and deploys the page per the
> Founder Installation Guide.

---

## 1. The two failure domains (why there are two watchdogs)

A watchdog that rides the machine it watches dies in the same outage (the 76-commit billing-outage class,
RS-DOS §7.4). So the dead-man is split across **two off-Neo domains that share nothing but the founder's phone**:

| # | Domain | Mechanism | Lives where | Pages when | Built in |
|---|---|---|---|---|---|
| **1 — PUSH** | Healthchecks.io (SaaS) | Neo **pushes** a check-in to `hc-ping.com/<uuid>` every ~60s, **gated on `/ready`** | on Neo (the pusher) + Healthchecks.io (the timer) | no check-in within the grace window | `infrastructure/execution-node/bootstrap/supervisor-entry.mjs` + `config-templates/watchdog/healthchecks.config.template` |
| **2 — PULL** | the Windows box (`windows-node1`) | a Scheduled Task **pulls** Neo's tailnet `/ready` every ~5 min; on N consecutive misses it alerts | on `windows-node1` (a **different machine**) | N consecutive misses (unreachable / 503 / down) | **`monitoring/pull-watchdog.mjs`** (this sprint) + `config-templates/watchdog/windows-pull-task.xml.template` |

**Why two, not one:** if Healthchecks.io itself has an outage, the Windows pull still catches a dead Neo; if the
Windows box is off, the push still pages. A single fault disables at most one domain. The pull domain also catches
**"up enough to ping Healthchecks but actually wedged"** and can disambiguate a bus outage from a node outage.

```
            ┌──────────────── domain 1 (PUSH) ────────────────┐
  Neo ──/ready green?──► supervisor-entry pusher ──► Healthchecks.io ──► founder phone
   │                                                                          ▲
   │  (tailnet /ready)                                                        │
   └───────────────────► windows-node1 pull-watchdog.mjs ─── N misses ───────┘
            └──────────────── domain 2 (PULL) ────────────────┘   (this sprint)
```

---

## 2. What pages whom

- **Domain 1 (push):** Neo's pusher POSTs/GETs the Healthchecks ping URL **only when its own `/ready` is green**
  (ADR-003 — a degraded-but-running node *stops* pinging). Healthchecks.io owns the grace timer and the alert
  channel (email + a phone-push integration). The page **originates off-Neo**, so it works when Neo is down.
- **Domain 2 (pull — `pull-watchdog.mjs`):** the Windows Scheduled Task invokes the script once per cadence. The
  script GETs `http://<MagicDNS>:<port>/ready`, treats **HTTP 200 = ready** and anything else (unreachable /
  503 / non-200) = a **miss**, tracks the consecutive-miss streak in a durable JSON file between runs, and on the
  **Nth consecutive miss** calls the injected **notifier** (the off-Neo alert channel). It is **read-only** — it
  never restarts Neo, never promotes, never writes Neo state; a dumb timer that pages a human (NEO-HBM §4.3).

**The notifier seam.** `pull-watchdog.mjs` ships with a console-only default notifier (inert, honest — no channel
wired). A real Slack/email/SMS notifier is **injected** (same discipline as the governance-engine ports); its
credential is read from the host credential store **at the edge** — there is **no secret literal** in this repo.

---

## 3. The status surface — where it deploys

The founder's one screen (`monitoring/status-page/`) answers the binary question *"is everything healthy?"* and
**survives Neo being down** (it shows `neo-node2: DOWN` rather than going dark).

- `index.html` — a self-contained static page. It `fetch`es a **same-origin** `status.json` (falling back to the
  bundled `status.sample.json` for local preview) and renders it through `status.mjs` — the **same pure shaper**
  the Node self-test exercises.
- `status.mjs` — the read-only data shaper: folds a Neo `/ready` `PlatformHealthReport` + the dead-man's last
  check-in into the view model (overall verdict · per-subsystem up/degraded/down · last-report age light ·
  the watchdog's own health). Browser-and-Node safe; no Core import at runtime; **no secret**.
- `status.sample.json` — the shape of the snapshot + the local-preview fixture.

**Deploy (off-Neo, founder step — NOT done here):** host the three files on any static host (the doc names Vercel).
Because Neo's `/health`/`/ready` bind to the **tailnet only**, a public static host cannot reach them directly —
so an **off-Neo collector** (which holds the tailnet/Supabase reach; e.g. a tiny job on `windows-node1` or the
Vercel SSR layer reading Supabase) writes the live `status.json` next to `index.html`. **The credential lives at
the collector edge, never in the page.** Local preview: `npx serve monitoring/status-page` (or any static server)
renders the bundled sample with zero secrets.

> This is the **no-Prometheus** decision (NEO-HBM ADR-002): no time-series DB, no exporters, no on-Neo dashboard —
> one render over data that already exists. Two free backstops sit behind it: the **Tailscale device list** ("is
> the node even powered?") and the **Healthchecks dashboard** ("is the dead-man happy?").

---

## 4. Install pointers (founder — out of scope for this sprint, no install performed)

1. **Pull-watchdog (domain 2):** render `config-templates/watchdog/windows-pull-task.xml.template` (fill
   `{{NEO_MAGICDNS}}`, `{{HEALTH_PORT}}`, `{{POLL_INTERVAL_MIN}}`, `{{WATCHDOG_SCRIPT}}`, `{{FOUNDER_EMAIL}}`) and
   import it into Task Scheduler on `windows-node1`. Point the action at **`node monitoring/pull-watchdog.mjs`**
   (the template's `{{WATCHDOG_SCRIPT}}` placeholder — a one-line `node …` invocation, or a thin `.ps1` that
   shells `node`). Config is env-only, no secret:
   - `DOS_NEO_MAGICDNS` (e.g. `neo`) · `DOS_HEALTH_PORT` (e.g. `8787`) · `DOS_HEALTH_SCHEME` (`http`)
   - `DOS_WATCHDOG_THRESHOLD` (N consecutive misses; default `3`) · `DOS_WATCHDOG_TIMEOUT_MS` (default `5000`)
   - `DOS_WATCHDOG_STATE` (the streak file path; default `./.watchdog/neo-pull-watchdog.state.json`)
   - To page a real channel, inject a notifier (Slack/email) reading its token from the **Windows credential
     store** — never a literal.
2. **Push dead-man (domain 1):** already built in `infrastructure/execution-node/` — see §5.
3. **Status page (founder):** deploy `monitoring/status-page/` to a static host; stand up the off-Neo collector
   that writes `status.json`.

---

## 5. Cross-check with the on-Neo PUSH dead-man (supervisor-entry.mjs)

Reviewed `infrastructure/execution-node/bootstrap/supervisor-entry.mjs` against the NEO-HBM §4 design. **The push
dead-man is functionally complete and correctly gated.** Confirmed:

- ✅ `/health` (liveness, no DB) and `/ready` (full `buildReport()` worst-wins fold) are served, and **refuse to
  bind a wildcard/routable address** (fail-closed to the tailnet only).
- ✅ The pusher pings **only when `isReady(report)` is true** (ADR-003) — a degraded-but-running node stops
  pinging, so the off-Neo domains catch "alive but not supervising," not just "powered off."
- ✅ `isReady` is **imported from the Core contract**, not re-derived — the emit and consume sides agree by
  construction.
- ✅ The ping URL is resolved from the **System keychain only** (`HC_PING_URL`), never a literal/dotenv.
- ✅ Fail-closed throughout: a `buildReport()` throw or a missing/empty URL ⇒ **no ping** (toward paging, never a
  false green).

**Gaps found — and how this sprint relates:**

1. **The second (pull) domain did not exist** — until this sprint. NEO-HBM §4.2 requires the Windows pull task as
   a *second independent* failure domain; without it, domain 1 (Healthchecks.io) was a single off-Neo dependency
   whose own outage would blind the founder. **Closed by `monitoring/pull-watchdog.mjs`** (this sprint). This was
   the load-bearing gap.
2. **Comment vs. verb (cosmetic, not a defect):** the pusher's header comment says it "POSTs" the ping URL while
   the code issues a `GET`. Healthchecks.io accepts **both** GET and POST on a ping URL, so check-in semantics are
   unaffected. Recommend a one-word comment fix in `supervisor-entry.mjs` for honesty; **not** a functional gap.
   (Left untouched here — that file is `infrastructure/execution-node/`'s surface, not this subsystem's.)
3. **The weekly "all-green" digest** (NEO-HBM §7 — the dead-man for the dead-man, proving the alert path itself is
   alive) is a **Healthchecks.io dashboard setting**, declared in `healthchecks.config.template`
   (`weekly_all_green_digest: true`), not node code. It is a founder configuration step in the Installation Guide,
   **not** a code gap.
4. **The status-page collector** (the off-Neo writer of `status.json`) is **named, not built** here (Waterline):
   the page + shaper are complete and proven against the contract shape; the collector is a small tailnet/Supabase
   reader the founder stands up with the deploy. The interface (`status.json` shape = `status.sample.json`) is
   fixed, so adding it later re-architects nothing.

**Net:** the on-Neo push side is complete and correct; the one real gap was the **missing independent pull
domain**, which this sprint delivers. The two domains are now both present (one built here, one already on Neo).

---

## 6. Self-verification (build-checks, this sprint)

- `node --check monitoring/pull-watchdog.mjs` · `node --check monitoring/status-page/status.mjs` — clean.
- `node monitoring/pull-watchdog.mjs --self-test` — miss-threshold fires the notifier once (then de-dupes),
  healthy is silent, recovery re-arms, a 503/down body pages, a supplementary-probe failure pages; injected
  fetch + clock + in-memory store — **no real network, loop, or disk**.
- `node monitoring/status-page/status.mjs --self-test` — parses a sample `PlatformHealthReport`, folds the view
  model, renders DOWN when the node is unreachable (the surface still renders), age buckets correct.
- `node scripts/arch-boundary-guard.mjs` — **CLEAN** (the new files classify as `adapters`; no Core-internal
  import; no infra-SDK).
- `node scripts/delete-test.mjs --subsystem monitoring` — **PASS** (the REAL Core builds and all three Core
  self-tests pass with `monitoring/` deleted — Core does not depend on this subsystem).
- No secret literals in `monitoring/`.
