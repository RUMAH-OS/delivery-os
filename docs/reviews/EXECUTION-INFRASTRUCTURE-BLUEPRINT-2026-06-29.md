---
artifact: EXECUTION-INFRASTRUCTURE-BLUEPRINT (the buildable plan to make the Runtime execution-provider-independent)
id: EIB-DOS-v1
date: 2026-06-29
status: BLUEPRINT — READ-ONLY AUDIT + DESIGN. Changes no code. A hard founder gate decides build authorization.
forcing_function: GitHub-hosted Actions minutes EXHAUSTED (2870/3000 → 0). Hosted runners can no longer be the execution architecture.
extends:
  - docs/reviews/RUNTIME-SPECIFICATION-2026-06-28.md (RS-DOS-v1 §46 I-Placement, §45 I-Resource, §53 interface catalog, §54 trust boundary)
  - docs/reviews/RUNTIME-ARCHITECTURE-2026-06-28.md (the V-H headless-spawn finding: GO-WITH-CONDITIONS; autonomy host = worker/queue, not serverless)
scope_guard: Audit of the real configs in rumah-admin, property-lead-os, delivery-os + a design. No code, no runner registration, no secret moves are performed here.
key_deliverable: the EXECUTION-PROVIDER ABSTRACTION (§9) — a platform (delivery-os) ExecutionProviderPort that lets the Project Owner route a unit of work to ANY node (Windows / Neo / Linux / Mac Studio / cloud) with no architectural change. It is the concrete, buildable implementation of RS-DOS §46 I-Placement.
---

# Execution Infrastructure Blueprint (EIB-DOS-v1)

> **Why this exists now.** We burned 100% of the GitHub-hosted Actions allotment (2870/3000 → 0). That is not a
> billing nuisance — it is the architecture telling us the truth: **a metered third-party execution provider
> cannot be the spine of a system whose entire ambition is continuous, unattended, portfolio-scale execution.**
> A dedicated Apple MacBook (codename **Neo**) is on hand. This blueprint audits what actually runs today, finds
> the drain, and designs the path to an **execution-provider-independent Runtime** — where the Project Owner
> routes work to Windows, the Neo, a future Linux box, a Mac Studio, or a cloud node through ONE injected port,
> with no architectural change. This is a **platform (delivery-os) capability**, not a consumer one.

---

## 0. TL;DR (the decision in one screen)

1. **The drain is the cron, not the CI.** `rumah-admin/.github/workflows/dead-man-switch.yml` runs
   `cron: "*/5 * * * *"` = **288 runs/day ≈ 8,640 billed minutes/month** by itself (GitHub bills a 30-second job
   as a full minute). That single workflow exceeds the entire 3,000-minute allotment **before any PR runs at
   all.** Per-PR fan-out (7 rumah-admin workflows + the PLOS `orchestrator` `workflow_run` re-trigger) is the
   second, smaller drain.
2. **The fix is not "buy more minutes."** It is two moves: **(a)** move the *scheduled tiers* (dead-man's-switch,
   heartbeat, goal-supervisor, PO-reconciler) OFF GitHub-Actions cron and onto the **Neo as a long-running
   worker/queue daemon** — exactly the V-H finding (the autonomy host must be a worker, not serverless/cron);
   **(b)** move the *PR-triggered required checks* onto a **self-hosted GitHub Actions runner on the Neo**, kept
   as the event/gate substrate it is good at.
3. **The two-node topology STRENGTHENS author≠verifier.** Build on **Windows** (Node 1 / dev), run the
   independent VERIFY + `machine_probe` on the **Neo** (Node 2 / verify). The verify-gate's "neutral hardware"
   requirement (D9) is *satisfied by physical separation* for the first time — today both run on the same
   GitHub-hosted pool or the same Windows box.
4. **The architectural deliverable is the `ExecutionProviderPort`** (§9) — the buildable form of RS-DOS §46
   I-Placement, mirroring the engine's existing `AgentExecutor` injected port
   (`templates/workflow-engine/agent-runner.ts`). The PO describes a job provider-agnostically; a Placement
   selector picks a node; results/evidence return on the durable bus. Adding the Neo, then a Linux box, then a
   Mac Studio, then a cloud node = **registering an adapter, never touching the core.**
5. **Cost:** GitHub-hosted on the current load is **~$80–150/month and rising with the portfolio** (and
   macOS-hosted minutes bill at **10×**). The Neo is **already-owned hardware: ~$0 marginal + ~$3–5/month
   electricity + the real cost, which is the founder's maintenance time.**
6. **Honest verdict (§13):** self-hosting is the right call *because the workload is continuous*, but it trades a
   metered bill for **standing operational surface a solo founder must personally own** — a machine that must
   stay up, patched, reachable, and recoverable. Mitigated, not eliminated. Do it **incrementally with
   rollback** (§12), never as a big-bang cutover.

---

## 1. What actually runs today (the audited execution surface)

### 1.1 rumah-admin — `.github/workflows/` (all `runs-on: ubuntu-latest`)

| Workflow | Trigger | Cron | Status | Required check? | Notes |
|---|---|---|---|---|---|
| `ci.yml` | PR + push main | — | **ON** | **YES** (binding gate) | 2 jobs; `build-and-migrate` has 20+ steps + a postgres service; `engine-ownership` drift; `slice-delivery-gate`, `learning:check`, `skills:check`, product-quality. `concurrency: ci-${{ github.ref }}`, cancel-in-progress on PR only. The heaviest single run (~5–10 min). |
| `migration-runner.yml` | PR + push main | — | **ON** | **YES** (`migration-lint`) | 3 jobs (lint · migrate-runner w/ postgres + advisory-lock proof · deploy-gate). Encodes expand-before-code via `needs:`. Prod apply disabled by construction. |
| `secret-scan.yml` | PR + push main | — | **ON** | **YES** (`gitleaks-scan`) | 2 jobs; working-tree + full-history (`fetch-depth: 0`) gitleaks v8.18.4 + planted-secret validate-the-validator. |
| `config-gate.yml` | PR + push main + dispatch | — | **ON** | should be (per comment) | fail-closed prod-config validator vs live Vercel env (read-only). |
| `deploy-gate-d7.yml` | PR + push main + dispatch | — | ON (SHADOW) | NO (explicitly kept off) | D7 state-gated deploy evaluator; always exits 0. |
| `scheduler-tiers.yml` | PR + push main + dispatch | — | ON (SHADOW) | NO | validates the scheduler-tier registry + Vercel-Hobby cron budget; flags competing schedulers, never fails. |
| **`dead-man-switch.yml`** | schedule + dispatch | **`*/5 * * * *`** | **ON** | NO | **The drain.** External liveness watchdog (C8). 1 job, 2 steps, `concurrency: dead-man-switch` no-cancel. 288 runs/day. |
| `heartbeat-driver.yml` | dispatch (schedule **commented**) | `*/5` (disabled) | PARTIAL | NO | C13 engine tick driver; live cutover deferred. |
| `goal-supervisor.yml` | dispatch (schedule **commented**) | `*/30` (disabled) | PARTIAL | NO | C7 progress watchdog; SHADOW; live cutover is a founder ★ (Sprint 5.3). |
| `prod-smoke.yml` | dispatch + `deployment_status` | — | ON | NO (release gate) | `npm run smoke:prod` against live prod after a successful prod deployment. |

**Binding required checks today:** `build-and-migrate` (ci.yml), `slice-delivery-gate`, `migration-lint`,
`gitleaks-scan`. These are the floor a PR cannot merge without — and the set that **must keep working** through
any migration.

### 1.2 property-lead-os — `.github/workflows/` (all `runs-on: ubuntu-latest`)

| Workflow | Trigger | Status | Notes |
|---|---|---|---|
| `ci.yml` | PR + push main | ON | 6 jobs: **ci-db-test** (postgres:16 service), **ci-static** (OS-drift + lint + typecheck), **ci-build** (`--max-old-space-size=6144` + `.next` cache), `verify` aggregator, `experience-review`, `founder-experience-scorecard`. No matrix. |
| `orchestrator.yml` | `workflow_run` after CI + PR + dispatch | ON | Read-only CI monitor; **re-triggers on every CI completion** (a second run per PR cycle). `cancel-in-progress: true`. `contents:read` only — never merges/deploys. |
| `deploy.yml` | push main + dispatch | ON | Auto-deploy to Vercel prod. `concurrency: vercel-production-deploy`, **no-cancel** (a newer push never supersedes an in-flight deploy). |
| `discovery-sweep-trigger.yml` | dispatch (`confirm=fire`) | ON | one-shot; `vercel pull` → `curl -m 295` the prod cron route. |
| `discovery-seed-trigger.yml` | dispatch (`confirm=seed`) | ON | one-shot; `curl -m 300` the prod seed route. |

**The PLOS Vercel deploy is TOKEN-attributed, not identity-attributed.** `deploy.yml` runs
`vercel deploy --prebuilt --prod --token=${{ secrets.VERCEL_TOKEN }}` (CLI pinned `48.12.1`, forced by the API
floor ≥47.2.2). It performs **no check that the actor is `bkasanwiredjo`** — the *token* carries the identity.
This is the lever that resolves the Hobby-plan "deploys must be authored by bkasanwiredjo" constraint
(MEMORY: plos-vercel-deploy-identity-constraint): **a self-hosted runner deploys cleanly as long as it holds the
founder's Vercel token.** Identity travels with the secret, not the machine. (Post-deploy health verify is
`continue-on-error` — a known soft spot, out of scope here but noted.)

### 1.3 delivery-os — the self-hosted kernel gate (no GitHub Actions; pre-push hooks)

The framework dogfoods its gate **locally on Windows**, via `git config core.hooksPath .githooks`:
- `.githooks/pre-push` runs 4 gates over the **committed push range**: (1) `verify-gate.mjs pre-push`
  (impl changes need a verified independent VERIFY in the push), (2) `check-os-drift.mjs` (the router/CODEOWNERS
  must not advertise a skill/agent not on disk), (3) `agents-check.mjs` (every agent carries the v6 routing
  contract), (4) `check-hook-paths.mjs` (every hook reference resolves + `node --check`-loads).
- `templates/tools/check-os-drift.mjs` is read-only, fail-closed on phantom dispatch.

**This is the model for the whole migration:** the gate is **machine-independent and travels in the repo**, so it
fires on Windows today and on the Neo tomorrow with zero change. The execution-provider abstraction generalizes
exactly this property from "the push gate" to "any unit of work."

### 1.4 The PO loop today (where work physically runs)
- **Build/agents:** headless Claude + specialist agents run **locally on this Windows machine.** No queue, no node
  selection — "the execution node" is implicitly "wherever the founder's terminal is."
- **CI / required checks:** **GitHub-hosted Linux runners.**
- **Scheduled tiers:** **GitHub-Actions cron** (the dead-man's-switch live; heartbeat + goal-supervisor staged).
- **Deploy:** **GitHub-hosted runner → Vercel (token) + Supabase (pooler).**

So execution is **split across three providers with no abstraction between them**, and the only *continuous* one
(cron) is the one that drained the meter.

---

## 2. The minutes post-mortem (arithmetic, not vibes)

GitHub Actions bills **per-job, per-minute, rounded UP**, and the private-repo allotment is 3,000 Linux-min/month
(Pro). macOS jobs bill at **10× the Linux rate.**

| Source | Math | Billed min/month |
|---|---|---|
| **`dead-man-switch` cron** | 288 runs/day × 30 × ≥1 min (job ~30s, billed 1) | **~8,640** |
| rumah-admin per-PR fan-out | ~7 workflows × ~3–8 min × N PR-cycles/day | grows with delivery |
| PLOS per-PR | ci (6 jobs) + `orchestrator` re-trigger + deploy | grows with delivery |
| heartbeat + goal-supervisor (when enabled) | `*/5` + `*/30` = +8,640 + 1,440 | **+10,080 (latent)** |

**The dead-man's-switch alone is ~2.9× the entire monthly budget.** Enabling the two staged crons would have
added another ~10,000. **No PR activity is required to exhaust the meter** — the autonomy clock did it. This is
the empirical proof of the V-H finding: *a serverless/cron substrate cannot host continuous supervision at
portfolio scale.* The supervision tiers must become **daemons on owned hardware.**

---

## 3. Recommended execution architecture (the target state)

**Two physical nodes, one logical fabric, three execution roles — all behind one port.**

```
                         ┌──────────────────────────── Tailscale tailnet (WireGuard mesh) ───────────────────────────┐
                         │                                                                                            │
  ┌──────────────────────┴───────────┐                                  ┌───────────────────────┴────────────────────┐
  │  NODE 1 — Windows (this machine)  │                                  │   NODE 2 — Neo (Apple MacBook)              │
  │  role: DEV / BUILD / interactive  │                                  │   role: VERIFY + CI + the AUTONOMY WORKER   │
  │  • headless Claude build sessions │   build artifact + push          │   • self-hosted GH Actions runner (ephem.)  │
  │  • the founder's terminal         │ ───────────────────────────────▶ │     → required checks: ci, migration, gitleaks
  │  • git push (pre-push gate)       │                                  │   • the WORKER/QUEUE daemon (launchd):       │
  └──────────────────────────────────┘                                  │     engine-tick · PO-reconciler ·            │
                         ▲                                               │     goal-supervisor · dead-man's-switch      │
                         │  independent VERIFY runs on a DIFFERENT node  │   • the deploy executor (founder Vercel tok) │
                         └───────────────────────────────────────────── │   • Docker: ephemeral test Postgres          │
                                                                         └─────────────────────────────────────────────┘
                                       both reachable for FUTURE nodes: Linux server · Mac Studio · cloud worker
```

- **GitHub stays the system of record + the event source** (PRs, required-check API, branch protection,
  CODEOWNERS). We do **not** leave GitHub; we **stop renting GitHub's CPU.**
- **The three execution roles** map cleanly to the substrate that fits each:
  - **PR-triggered required checks** → self-hosted GitHub Actions runner on Neo (event-driven; GitHub's
    check-status integration is worth keeping).
  - **Scheduled supervision tiers** → a **launchd-managed worker daemon** on Neo (continuous; this is the V-H
    worker/queue, NOT a cron-of-an-LLM).
  - **Interactive build** → stays on Windows (Node 1); the Neo can also take build jobs once the port exists.
- **author≠verifier becomes physical:** build on Node 1, verify on Node 2. The verify-gate's `machine_probe`
  re-runs on a node the author does not control (D9 "neutral hardware") — *for the first time actually true.*

---

## 4. Neo as Execution Node 1 — the setup plan (concrete)

> "Execution Node 1" in the prompt = the **first non-Windows execution provider** behind the port. Physically it
> is Node 2 in the topology; semantically it is the first proof that the Runtime is provider-independent.

### 4.1 Two distinct things to install on Neo (do not conflate them)
1. **A self-hosted GitHub Actions runner** — for the *PR-triggered required checks.*
2. **A launchd worker daemon** — for the *scheduled supervision tiers* (this is the architecturally important
   one; it kills the cron drain).

### 4.2 The GitHub Actions self-hosted runner (per repo, or org-level)
- **Register** at the *repository* level first (solo repos, least blast radius), Settings → Actions → Runners →
  New self-hosted runner (macOS). Use the **ephemeral** flag so each job gets a clean runner that de-registers
  after one job: `./config.sh --url <repo> --token <reg-token> --ephemeral --labels neo,macos,self-hosted`.
- **Labels** are the routing surface. Recommended: `self-hosted`, `macos`, `neo`, and a capability label
  `pg` (has Docker Postgres). Workflows target `runs-on: [self-hosted, neo]`.
- **Run as a service, NOT a login shell:** `./svc.sh install && ./svc.sh start` registers a launchd service so
  the runner survives logout/reboot. Set it to a **dedicated, non-admin macOS user** (`ci-runner`) with no
  Keychain access to the founder's personal secrets.
- **Toolchain:** Node 22 + pnpm/npm (match the workflows), Docker Desktop or colima for the Postgres service
  (the GHA `services: postgres:16` block does not run natively on a self-hosted mac — see §6), gitleaks
  v8.18.4, the Vercel CLI `48.12.1`.
- **Ephemeral + auto-scale-of-one:** for a solo repo one ephemeral runner is enough; the queue serializes. Add a
  second labelled runner later only if check latency hurts.

### 4.3 The worker daemon (the cron-killer — the important half)
- A single **`launchd` `LaunchDaemon`** (runs at boot, before login, `KeepAlive=true`, auto-restart) hosting a
  long-lived Node process — the **engine `agent-runner` drain loop**
  (`templates/workflow-engine/agent-runner.ts`) plus internal interval timers for the four scheduled tiers:
  - engine-tick (liveness) — replaces `heartbeat-driver` cron;
  - PO-reconciler slot — replaces the (future) reconciler cron;
  - goal-supervisor slot — replaces `goal-supervisor` cron;
  - dead-man's-switch — **stays OFF Neo** for failure-domain independence (see §4.4).
- This is the V-H finding made real: **the autonomy host is a worker that owns its own clock**, draining the
  durable Postgres bus with SKIP-LOCKED + lease (already built), not a serverless function re-invoked by a
  third-party scheduler. **Cost of running it: $0 marginal.** It can tick every 5s instead of every 5 min
  because there is no per-invocation meter.
- **Crash-safety is already designed in:** a crashed worker's claim auto-expires and another worker reclaims it
  (`agent-runner.ts` lease semantics). A Neo reboot → launchd restarts the daemon → it re-reads durable state →
  resumes. No essential RAM state. This is exactly RS-DOS §4.4 / §14 F2–F3.

### 4.4 Keep the dead-man's-switch on a DIFFERENT failure domain
The dead-man's-switch watches the supervisor; **it must not share the supervisor's hardware** or a Neo outage
silences both (the 76-commit billing-outage class). Options, cheapest first: a **free external uptime monitor**
(UptimeRobot/Healthchecks.io) pinging `/v1/health/platform` and SMS/emailing the founder on silence; OR a tiny
**Vercel cron** (the one cron cheap enough to keep, sub-300s, on the free budget); OR the **Windows box** running
the same watchdog as a Scheduled Task. **Recommendation: Healthchecks.io (free) + a Windows Scheduled Task
backup.** Zero GitHub minutes; genuinely independent failure domain.

---

## 5. The pipelines, restated on the new substrate

### 5.1 Build pipeline
- **Windows (Node 1)** remains the interactive build host. Headless Claude build sessions produce a slice +
  commit; the **pre-push gate** (`.githooks/pre-push`) runs locally and is machine-independent (§1.3).
- Once the port (§9) exists, a build job can also be **placed on Neo** — e.g. a long-lane build the founder
  doesn't want tying up the Windows terminal. No code change; a different `placement_req`.

### 5.2 Verification pipeline (the independent VERIFY + CI checks)
- **Required checks move to `runs-on: [self-hosted, neo]`:** `ci` (build-and-migrate), `migration-lint`,
  `gitleaks-scan`, `config-gate`. The workflow YAML changes by **one line each** (`runs-on`). Logic is
  Node/Postgres/gitleaks — all platform-agnostic.
- **The binding verify-gate (D9) is preserved and strengthened:** the `verify-coverage` status check + branch
  protection + CODEOWNERS stay on GitHub (the *gate* is GitHub's job; the *compute* is Neo's). The
  `machine_probe` re-runs on Neo — **a node the author (Windows) does not control** — so author≠verifier holds
  on hardware, not just on identity. This is a net **security upgrade** over today's same-pool execution.
- **SHADOW workflows** (`deploy-gate-d7`, `scheduler-tiers`) move too or are paused; they exit 0 and burn minutes
  for no gate value — pause them until the Neo runner is live, restore as Neo jobs.

### 5.3 Deployment pipeline (Vercel + Supabase, identity-respecting)
- The deploy runs on the **Neo self-hosted runner** holding the **founder's `VERCEL_TOKEN`** (and the team
  `--scope team_1CST…`, MEMORY: infrastructure-config-platform). Because Vercel attributes the deploy to the
  *token*, not the runner host, **the Hobby author-identity constraint is satisfied without the founder
  click-deploying by hand** (MEMORY: plos-vercel-deploy-identity-constraint resolved). Pin `vercel@48.12.1`.
- **Supabase:** migrations via the **session pooler (5432)**, app via the **transaction pooler (6543)** with
  `prepare:false` (skill `deploy-vercel-supabase`). The Neo is IPv4 — it **must** use the pooler, never the
  IPv6-only `db.<ref>.supabase.co:5432` direct host. Forward-only, expand/contract, applied before code.
- **Class-C (prod deploy / merge-to-main) stays a Founder boundary** — the runner *executes* an authorized
  deploy; it does not *authorize* it. The `deployment-operator` agent's `.deploy-lane.json` scope rules apply.

### 5.4 Permanent staging
- Today there is **no permanent staging** (RS-DOS §11 names it; it isn't built). Stand up a **persistent staging
  Vercel project + a dedicated Supabase staging branch/project** (same plan/scope/pooler shape as prod — the
  HE-1…HE-6 catch surface). The Neo runner deploys to staging on every merge-to-`dev`; prod stays
  state-gated. Staging is **cheap and always-on**, unlike per-PR ephemeral previews that multiply minutes.

### 5.5 Runtime services (the goal-governance engine, when live)
- The goal-governance organs (engine-tick, PO-reconciler, goal-supervisor) are **the worker daemon of §4.3** —
  they are not CI and must never be modeled as CI. They are **long-running services on Neo**, drawn from the
  durable bus, observable via `I-Ops` (RS-DOS §49). This is the home the V-H finding demanded.

---

## 6. Docker strategy

- **Test Postgres:** the GHA `services: postgres:16` block is provided by GitHub-hosted runners for free; on a
  self-hosted mac you supply it. Run **colima + a `postgres:16` container** (lighter than Docker Desktop, no
  licensing) started by the runner job (`docker run --rm -d -p 5432 postgres:16`) or kept warm as a launchd
  service. Pin the tag to match CI (`postgres:16`) for migration-parity.
- **Runtime services:** the worker daemon does **not** need Docker — it is a Node process against the real
  Supabase pooler. Keep Docker scoped to **ephemeral test infra only** (test DB, maybe a gitleaks container),
  to minimize the always-on surface on Neo.
- **Do NOT containerize the GitHub Actions runner agent itself on macOS** (nested virtualization pain); run it
  natively as a launchd service, run *its workloads'* dependencies in containers.

## 7. Secrets management (no secrets in the tree; how an owned-hardware runner gets them safely)

**Invariant (already enforced by `secret-scan.yml` / gitleaks, RS-DOS §30): zero secrets in any repo.** The
self-hosted runner does not change that; it changes *where the platform store hands secrets to the compute.*

- **GitHub Actions Secrets** remain the store for CI/deploy secrets (`VERCEL_TOKEN`, `CRON_SECRET`,
  `DELIVERY_OS_TOKEN`, Supabase pooler creds). A self-hosted runner receives them **the same way a hosted runner
  does** — injected as env into the job, never written to disk. The risk delta is that they transit *your*
  machine; mitigate with **ephemeral runners** (clean checkout each job, no secret persists between jobs) and a
  **dedicated non-admin macOS user** with no access to the founder's personal Keychain.
- **The worker daemon's secrets** (it is not a GHA job) live in the **macOS Keychain** under the `ci-runner`
  user, read at process start — never in a dotfile, never in the repo. Rotate via the config platform
  (`infra/config-doctor.mjs` + registry, MEMORY: infrastructure-config-platform). The fail-closed pre-build
  config-doctor gate already refuses to run without a complete, valid config set.
- **Least privilege per role:** the deploy token is deploy-scoped; the supervisor's metric-probe identity is
  read-only (RS-DOS §7.2); the runner's `GITHUB_TOKEN` is job-scoped and auto-expires. No long-lived god token
  on Neo.
- **Data-class trust boundary (RS-DOS §54):** PII/SECRET work is pinned to trusted nodes; the Neo qualifies as a
  trusted, owned, co-located node — but the *contract* (`data_class` on every WorkPackage) is what makes adding
  an *untrusted* cloud node later safe. The port (§9) carries `data_class`; the selector refuses to place
  PII/SECRET on an ineligible node, fail-closed.

## 8. Tailscale topology (mesh-connecting the nodes)

**Tailscale (WireGuard mesh)** is the right fabric: zero-config NAT traversal, stable per-node identity, ACLs as
code, no opened ports, no public IPs. It is the substrate that makes "future Linux server / Mac Studio / cloud
node" a *join*, not a network project.

- **Addressing:** every node gets a stable `100.x.y.z` tailnet IP + a MagicDNS name: `windows-node1`,
  `neo-node2`, future `linux-node3`, `studio-node4`, `cloud-node5`. The worker daemon, the runner, and the
  founder's terminal all reach each other by MagicDNS name, never by LAN IP or public DNS.
- **ACLs (least privilege, as code in the tailnet policy file):**
  - the **founder's devices** → all nodes (admin);
  - **node↔node** → only the ports the fabric needs (the bus is Supabase-hosted, reached over the public pooler
    with TLS, so node↔node tailnet traffic is mostly SSH for ops + health endpoints);
  - **tag:ci-runner** (Neo) → outbound to GitHub + Vercel + Supabase only; **no inbound** except the founder and
    the health monitor.
- **Tailscale SSH** for founder ops onto Neo (no exposed sshd, audited, key-free). **Tailnet lock** on, so a
  rogue node cannot silently join. **A future cloud node** joins the tailnet with a tag that the ACL constrains
  to its data-class (§7) before it can take any PII work.

## 9. THE EXECUTION-PROVIDER ABSTRACTION — `ExecutionProviderPort` (the key deliverable)

> This is what makes the Runtime execution-provider-independent. It is a **platform (delivery-os) capability** —
> the buildable, code-level form of **RS-DOS §46 `I-Placement`** ("the PO never knows *where* execution
> happens"), built by **mirroring the engine's existing injected `AgentExecutor` port**
> (`templates/workflow-engine/agent-runner.ts` line 48: `type AgentExecutor = (task) => Promise<outcome>`). The
> store-port pattern, applied to *compute*.

### 9.1 The principle
The Project Owner / Sprint Engine describes **WHAT** work must happen and its **REQUIREMENTS**; it never names a
machine. A **Placement Selector** maps requirements → a node; an injected **`ExecutionProviderPort`** runs the
job on that node and returns evidence on the durable bus. Adding Windows, Neo, Linux, Mac Studio, or cloud =
**registering one more adapter.** No PO/Sprint-Engine code changes — the §44 acceptance test
("adding an implementation must not change Runtime behavior").

### 9.2 The provider-agnostic job description (`ExecutionRequest`)
Derived from the existing `WorkPackage` (RS-DOS §54.4) — no invented fields:
```ts
interface ExecutionRequest {
  jobId: string;                 // idempotency key (write-ahead-intent; dup = no-op)
  goalId: string;                // tenancy scope — a node may only touch its own goal_id (§54.3)
  kind: "build" | "verify" | "deploy" | "supervise" | "migrate" | "probe";
  payload: Record<string, unknown>;          // OPAQUE, PII-free refs/codes (mirrors AgentTask.task)
  data_class: "PUBLIC"|"INTERNAL"|"CONFIDENTIAL"|"PII"|"SECRET";   // §54.1 — gates eligibility FIRST
  placement_req: {               // → the Placement Selector (§46)
    lane: "short" | "long";      // short = a check (runner); long = a soak/build/autonomy run (worker)
    isolation: "shared" | "dedicated";
    resource_class: "cpu-small" | "cpu-large" | "gpu" | "macos" | "any";
    capabilities?: string[];     // e.g. ["pg","docker","vercel-token"] — matched against node labels
  };
  budget: { maxWallclockMs: number; maxCost?: number };   // H1 cap travels with the job
}
```

### 9.3 The port (mirrors `AgentExecutor`, extends it with placement)
```ts
// The ONE app/runtime coupling. Each node is an adapter implementing this.
interface ExecutionProviderPort {
  readonly nodeId: string;                 // "windows-node1" | "neo-node2" | ...
  readonly labels: string[];               // ["self-hosted","macos","neo","pg","vercel-token"]
  readonly trustDomain: "trusted" | "contractual" | "external";   // §54.2 gate
  canAccept(req: ExecutionRequest): boolean;       // label + resource + data_class eligibility (pure)
  execute(req: ExecutionRequest, signal: AbortSignal): Promise<ExecutionOutcome>;  // does the work, honors budget
}

type ExecutionOutcome =
  | { ok: true;  jobId: string; evidenceRef: string; metrics?: Record<string, number> }   // evidenceRef → bus
  | { ok: false; jobId: string; error: string; retryable: boolean };
```
The shape is **deliberately identical in spirit to `AgentExecutor`**: opaque task in, ok/error + evidence out,
timeout/budget enforced by the *caller* (the runner already does this — `runExecutor` race against
`executorTimeoutMs`). The Neo runner adapter, the Windows adapter, and a future cloud adapter all satisfy this
one interface.

### 9.4 The Placement Selector (how the PO picks a node — constraint-first, optimize-second)
Mirrors RS-DOS §54.2 (data_class **gates**, then optimize):
```ts
function selectNode(req: ExecutionRequest, registry: ExecutionProviderPort[]): ExecutionProviderPort | "no-eligible-node" {
  const eligible = registry.filter(n =>
    n.canAccept(req) &&                                   // labels + resource_class + capabilities
    trustBoundaryOk(req.data_class, n.trustDomain));      // §54.2 — PII/SECRET → trusted only, fail-closed
  if (eligible.length === 0) return "no-eligible-node";   // → HALT + summon (never silently downgrade)
  return optimize(eligible, /* by */ ["lowest-queue-depth", "lowest-cost", "lowest-latency"]);
}
```
**Fail-closed:** no eligible node ⇒ the job waits or the goal halts-and-summons — it **never** runs PII work on
an external node, and **never** invents a node. This is `selectAgentFor`'s no-match/ambiguous discipline
(`agent-runner.ts`) lifted to nodes.

### 9.5 How results/evidence return
Unchanged from the built engine: the provider writes `ExecutionOutcome.evidenceRef` (a VERIFY artifact, a build
ref, a deploy URL, a ProgressSample) and the step completes via the **existing `completeAwaitingStep` completer**
on the durable bus (idempotent, CAS-guarded, lease-released). **No new return path is invented** — the port plugs
into the runner's `runOnce` exactly where `AgentExecutor` does today. A crashed node's lease expires; another
node (or the same one on reboot) reclaims. Author≠verifier holds because a `verify`-kind job is *placed on a
different node* than the `build`-kind job by policy.

### 9.6 Why this is a platform capability, not a consumer one
It lives in **delivery-os** (`templates/workflow-engine/` — alongside `agent-runner.ts`), versioned by the base,
adopted-by-pin by consumers (RS-DOS §51). rumah-admin and PLOS get node-independence **for free** when they pin
the runtime version that ships the port. A consumer never re-implements placement; it registers the nodes it
has. **This is the I-Placement adapter row of the §53 interface catalog, made buildable.**

### 9.7 What is built first vs deferred (Waterline honesty)
- **Build now (N=2):** the port interface + two adapters (`windows-node1` for build, `neo-node2` for
  verify/CI/worker/deploy) + the constraint-first selector + the `data_class` gate (vacuous at single trust
  domain but contract-present so the cloud node is safe later).
- **Deferred-until-pulled:** a global cross-project scheduler (RS-DOS §45 `I-Resource`), GPU/`provider_profile`
  selection (RS-DOS §47 `I-Provider`), N>1 multi-tenant isolation hardening. Named, not built. The interface
  *admits* them; the build waits for the first real driver.

## 10. Monitoring & health checks

- **`I-Ops` read model (RS-DOS §49):** a read-only portfolio view derived from the durable stores — node
  liveness, queue depth/wait, F1–F15 failure rates, cost. No new control plane.
- **Per-node health:** each node exposes/answers a liveness probe; the worker daemon answers
  `/v1/health/platform` (the dead-man's-switch's input). Tailscale's own device list is the cheap "is the node
  up" signal.
- **Layered watchdogs (independence preserved):** engine-tick (liveness) → goal-supervisor (progress) →
  dead-man's-switch (watches the supervisor, **off-Neo**, §4.4) → founder alarm. Exactly RS-DOS §7.5's three
  tiers, but the substrate is the worker daemon + an external monitor instead of three GHA crons.
- **Deploy health:** keep `prod-smoke.yml` (now on Neo, fired by `deployment_status`) but **make the post-deploy
  health verify binding** (today PLOS's is `continue-on-error` — a real gap).

## 11. Disaster recovery

| Failure | Detection | Recovery | RTO |
|---|---|---|---|
| Neo crashes / reboots | dead-man's-switch (off-Neo) + Tailscale offline | launchd auto-restarts daemon + runner → re-read durable bus → resume | minutes (auto) |
| Neo dies (hardware) | dead-man's-switch alarm → founder | **fail back to GitHub-hosted** by flipping `runs-on` (the rollback lever, §12); bring up worker on Windows/Mac Studio via the port (§9 — a node is an adapter) | hours |
| Worker daemon bug-loops | goal-supervisor / cost ledger trip | circuit-breaker OPEN (durable) → HALT → summon | minutes |
| Secret leak on Neo | gitleaks + rotation runbook | rotate via config platform; ephemeral runner means no persisted secret | hours |
| Supabase pooler outage | health probe | retries; staging unaffected; prod read-only degrade | provider-bound |
| Tailnet/Tailscale outage | node-unreachable | nodes still reach Supabase/GitHub/Vercel over public TLS; only founder ops-SSH degrades | low impact |

**The load-bearing DR property:** because state is **100% on the durable Postgres bus** and **no node holds
essential RAM state** (already designed, `agent-runner.ts`), *every* node is replaceable. The port makes node
replacement a registration, not a migration. **Back up the Supabase database** (the real crown jewel) — that is
the one thing whose loss is not recoverable by re-registering a node.

## 12. Migration strategy (incremental, with rollback at every step)

**Never big-bang.** Each step is independently reversible by reverting one `runs-on` line or one launchd unload.

| Phase | Action | Rollback | Validates |
|---|---|---|---|
| **M0** | Pause SHADOW crons + the dead-man cron **on GitHub**; stand up **Healthchecks.io** + a Windows Scheduled-Task watchdog. | re-enable the GHA cron | the meter stops bleeding immediately |
| **M1** | Register the **ephemeral self-hosted runner** on Neo (rumah-admin first). Add a `runs-on: [self-hosted, neo]` **duplicate** of `ci` under a non-required name; compare results vs GitHub-hosted. | delete the runner; required checks untouched | the runner runs CI green, parity with hosted |
| **M2** | Flip the **non-binding** checks (`config-gate`, `deploy-gate-d7`, `scheduler-tiers`) to Neo. | flip `runs-on` back | low-stakes checks stable on Neo |
| **M3** | Flip the **binding** checks (`ci`/build-and-migrate, `migration-lint`, `gitleaks-scan`) to Neo, **one at a time**, watching the required-check status. | flip back per check | the floor holds on Neo; author≠verifier now physical |
| **M4** | Stand up the **worker daemon** on Neo (launchd), engine-tick + reconciler + goal-supervisor, draining the bus. Run **alongside** the (still-disabled) GHA crons in SHADOW. | unload launchd; nothing depended on it | continuous supervision off-meter; V-H worker proven |
| **M5** | Move **deploy** to the Neo runner with the founder Vercel token; stand up **permanent staging**. | deploy from Windows/founder click | identity-clean token deploys; staging catches HE-1…6 |
| **M6** | Ship the **`ExecutionProviderPort`** in delivery-os; register `windows-node1` + `neo-node2` adapters; route a real `verify`-kind job by policy to Neo. | the engine still runs single-executor (back-compat path in `agent-runner.ts`) | the abstraction is real, not a diagram |
| **M7** | Repeat M1–M5 for **PLOS**. | per-repo, independent | provider-independence is portfolio-wide |

**Gate:** M3 (binding checks) and M5 (deploy) are **founder ★ checkpoints** — they touch the merge/release floor.

## 13. Operational complexity — the honest verdict

**Self-hosting is correct here, and it is not free of pain. Both are true.**

- **What you are buying:** the workload is *continuous supervision*, which a metered serverless/cron substrate
  charges for forever and caps arbitrarily. On owned hardware that workload is ~$0 and can run at 5-second
  granularity. The V-H finding *requires* a worker; a worker wants a host you control. The Neo is that host.
- **What you are taking on (do not pretend otherwise):** a **standing machine a solo founder must personally
  keep alive** — OS + Docker + Node + runner-agent patching; a mac that must not sleep (disable App Nap / sleep,
  `caffeinate` or `pmset`), must rejoin Tailscale after a reboot, must have its disk not fill with Docker layers,
  must survive a power cut. The self-hosted runner agent **auto-updates and can break**; Docker on mac is
  heavier than on Linux. When Neo is down at 2am, **there is no on-call but you.**
- **The genuinely hard part is not setup, it's the long tail:** a year of "the runner went offline and I didn't
  notice," "macOS updated and broke colima," "the token rotated and the daemon didn't pick it up." The
  dead-man's-switch + Healthchecks alarm is the *only* thing that converts that silent rot into a ping.
- **Net:** **GO, incrementally, with the off-Neo watchdog as a hard precondition.** The architecture (durable
  bus, no RAM state, the port) makes the *blast radius* of Neo failure small — fail back to GitHub-hosted by
  flipping a line. That reversibility is what makes the operational risk acceptable for a solo founder. Without
  the rollback lever and the independent watchdog, it would not be.

## 14. Cost comparison

| | GitHub-hosted (status quo) | Self-hosted on Neo |
|---|---|---|
| Scheduled supervision | ~8,640+ min/mo → **overage $ or hard cap** (the drain) | **$0 marginal** (worker daemon) |
| CI / required checks | per-PR fan-out, grows with delivery; macOS jobs **10×** | $0 marginal (electricity) |
| Monthly $ at current load | **~$80–150 and rising** (Linux overage @ $0.008/min; far worse if any macOS) | **~$3–5 electricity** |
| Hardware | $0 (rented) | $0 (already owned) |
| Hidden cost | none operationally, but a hard ceiling on autonomy | **founder maintenance time** (the real price, §13) |
| Scaling cost | linear $ per node-minute, forever | one-time setup per node; marginal ~$0 thereafter |

The crossover is not close: at portfolio scale the metered model is **unbounded and capped at the same time** (you
pay more *and* still hit a ceiling). Owned hardware trades a rising bill for a fixed time-cost.

## 15. Validation plan

1. **M0 proof:** Actions usage graph flatlines within 24h of pausing the dead-man cron (the drain is gone).
2. **Parity proof (M1):** the Neo `ci` run and the GitHub-hosted `ci` run produce **byte-identical gate verdicts**
   on the same commit (the runner is a faithful substrate, not a different environment).
3. **author≠verifier-on-hardware proof (M3):** a build authored on Windows is verified by a `machine_probe` whose
   logs show it ran on `neo-node2` — physical separation demonstrated.
4. **Worker proof (M4):** kill the worker daemon mid-drain; confirm a reboot reclaims the leased step and
   completes it (no double-execute, no lost work) — RS-DOS DoD-1.
5. **Dead-man proof (M4):** stop the worker; confirm the **off-Neo** monitor alarms the founder within the
   threshold — RS-DOS DoD-3.
6. **Port proof (M6):** register a third **mock** node adapter; route a job to it by changing only
   `placement_req`/labels — **zero PO/Sprint-Engine code changes** (the §44 acceptance test).
7. **Deploy-identity proof (M5):** a Neo-runner Vercel deploy lands attributed correctly (token identity), no
   founder click required.

## 16. Future multi-node execution

- **Linux server (`linux-node3`):** the cheapest CI/worker node (Docker-native, no macOS-update churn); joins the
  tailnet, registers as an adapter, takes `resource_class: cpu-large` long-lane builds.
- **Mac Studio (`studio-node4`):** the heavy macOS/iOS or large-build node; same adapter shape.
- **Cloud worker (`cloud-node5`):** burst capacity; **`trustDomain: external`** — the `data_class` gate (§9.4,
  §54.2) **refuses PII/SECRET on it, fail-closed**, which is exactly why the contract field is built now while
  it's vacuous.
- **The selector grows from "pick the one eligible node" to "balance across N by queue-depth/cost"** (RS-DOS §45
  `I-Resource`) — a policy change behind the same port, pulled when N makes it hurt. **The architecture does not
  change; the registry gets longer.** That is the whole point of the port.

---

## 17. Top 3 risks

1. **Single point of failure = the Neo (and the founder).** A self-hosted node concentrates CI + verify + the
   autonomy worker + deploy on one machine owned by one person with no on-call. **Bound it:** the off-Neo
   dead-man's-switch (hard precondition), the one-line `runs-on` rollback to GitHub-hosted, durable-bus state so
   any node is replaceable, and a backed-up Supabase. *Mitigated, not removed.*
2. **Self-hosted-runner code-execution exposure.** A self-hosted runner that executes PR code is the classic
   foot-gun — a malicious PR runs arbitrary code on your hardware and can exfiltrate secrets. **For these solo,
   private repos with no external contributors the exposure is low, but not zero** (compromised dependency, token
   theft). **Bound it:** ephemeral runners (clean per job, no persisted secret), a dedicated non-admin macOS
   user, least-scope job tokens, **never** `pull_request_target` on a self-hosted runner, and Tailscale ACLs that
   give the runner outbound-only to GitHub/Vercel/Supabase. *Re-evaluate the moment a second contributor or a
   public fork appears.*
3. **Operational rot over the long tail.** The failure mode is not setup — it's the silent six-months-later
   "runner offline / macOS update broke colima / token rotated and the daemon didn't reload." **Bound it:** the
   independent uptime monitor turns silence into a ping, the config-doctor fail-closed gate refuses a stale
   secret set, and Healthchecks/Windows-task redundancy on the watchdog. The honest residual: **a solo founder
   is now the SRE.** The reversibility lever is what keeps that acceptable.
```
