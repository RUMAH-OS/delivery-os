# Neo Execution Node 1 — Live-Node Validation Runbook

> **What this is.** The step-by-step the **founder + Project Owner (PO) walk together once Neo is up** to prove,
> with objective evidence, that Neo operates as **Execution Node 1**. It drives
> `infrastructure/execution-node/validation/validate-node.mjs` — the **end-to-end acceptance layer** above
> `bootstrap/verify-health.sh`. Where `verify-health.sh` proves the on-node subsystems are healthy *right now*,
> this runbook proves the **nine acceptance boxes of FOUNDER-INSTALLATION-GUIDE §11** end-to-end and produces the
> one **`VALIDATION-EVIDENCE.md`** the founder + PO sign off.
>
> **The gate this opens.** All nine boxes GREEN = **"Execution Infrastructure is OPERATIONAL"** = the **trigger to
> start Sprint 5.3** (the Slack control surface). Until then, **Neo is installed, not accepted.**
>
> **The harness OBSERVES only.** It never reboots Neo, never stops a daemon, never sends. The destructive
> acceptance steps (stop the supervisor for the synthetic miss; hard power-cycle for the cold-boot test) are **your
> hands** — the harness records their objective post-conditions and your attestation.

---

## 0. Prerequisites — before you run anything

| # | Precondition | How to confirm |
|---|---|---|
| 0.1 | **Neo is fully installed** per `docs/architecture/neo/FOUNDER-INSTALLATION-GUIDE.md` §1–§10 (every `[AUTOMATED-BY-SCRIPT]` step green; `bootstrap/verify-health.sh` exits 0). | `verify-health.sh` → "ALL automated checks GREEN". |
| 0.2 | **You run this from the founder's laptop, on the tailnet** (so `http://neo:8787/ready` resolves) — NOT from Neo. The watchdog/independence whole point is a *different* failure domain. | `tailscale status \| grep neo` shows `neo` online; `ping neo` resolves. |
| 0.3 | **`gh` CLI is installed and authenticated** as the founder (the GitHub-Actions boxes a/b/c query the Actions API; `gh` carries its **own** ambient auth — this harness embeds **no token**). | `gh auth status` → logged in; `gh api repos/<owner>/<repo>` returns JSON. |
| 0.4 | **A PR and a merge-to-main have actually run on Neo** (boxes a/b/c read *real* runs): one PR with `vars.CI_RUNNER=["self-hosted","neo"]` (a/b) and one merge that ran `deploy.yml` on Neo (c). Trigger these first if they have not happened. | GitHub → Actions shows a green `ci` run and a green `deploy` run executed on the `self-hosted,neo` runner. |
| 0.5 | **The off-Neo status page is deployed** (its own Vercel project, §10.1). | The page loads at its URL and shows `neo-node2`. |
| 0.6 | **Environment configured** (no secrets — host/port/repo/URLs only): set the variables in §1. | `echo $DOS_GH_REPO` etc. resolve. |

> If a prerequisite is not met, the corresponding **objective box fails closed** with an honest evidence line
> (e.g. "DOS_GH_REPO not set … it stays NO-GO") — the harness never silently passes a box it could not probe.

---

## 1. Configure (env only — no secrets)

```bash
export DOS_GH_REPO="RUMAH-OS/delivery-os"        # owner/repo for the Actions boxes (a, b, c)
export DOS_NODE_ID="neo-node2"                    # the registry id under test
export DOS_NEO_MAGICDNS="neo"                      # the tailnet MagicDNS name
export DOS_HEALTH_PORT="8787"                      # the ACL health port
export DOS_HEALTH_SCHEME="http"                    # http over the tailnet (tailnet-only, never public)
export DOS_STATUS_PAGE_URL="https://<your-neo-status>.vercel.app"   # the off-Neo status page (box f)
# optional: DOS_CI_WORKFLOW=ci.yml  DOS_DEPLOY_WORKFLOW=deploy.yml  DOS_VALIDATE_TIMEOUT_MS=8000
```

No token, pooler URL, or secret is ever passed to this harness. `gh` authenticates itself; the tailnet/status GETs
are unauthenticated reads.

---

## 2. The order to run the checks — and what each proves

Run the harness from the repo root. It executes all nine boxes and prints the `VALIDATION-EVIDENCE.md` report.
**Run the two destructive founder steps (e, i) FIRST**, then run the harness with your attestations so the report
is complete in one pass — or run the harness any time and re-run with `--attest` once you have done them.

### Stage A — the local, zero-node objective gates (run these first; they need no live Neo)

These prove the architecture holds *by construction* and need only the repo on your laptop:

- **(g) Delete Test** — `node scripts/delete-test.mjs` → exit 0. *Proves:* deleting the entire Execution-Infra
  adapter leaves **Core building and its self-tests green** — host-agnostic by construction.
- **(h) Dependency-direction gate** — `node scripts/arch-boundary-guard.mjs` → exit 0. *Proves:* **no Core file
  imports anything under `infrastructure/`** or an infra SDK — the Runtime is infrastructure-independent.

The harness runs both for you (boxes g, h); you can also run them standalone to see the full output.

### Stage B — the tailnet objective probes (need Neo up + you on the tailnet)

- **(d) Heartbeat / `/ready`** — the harness `GET http://neo:8787/ready`. *Proves:* verdict `ok`, which **folds
  heartbeat-freshness** (tick_seq advancing) per the Health-Emission contract, so the `/ready`-gated Healthchecks
  push is firing. (Glance at the Healthchecks dashboard to confirm cadence — noted in the evidence line.)
- **(f) Status surface** — the harness `GET $DOS_STATUS_PAGE_URL`. *Proves:* the off-Neo page renders and surfaces
  `neo-node2` with a verdict.

### Stage C — the GitHub-Actions objective probes (need the real runs from §0.4)

- **(a) Runner executes a build** — the harness reads the latest green `ci` run + the runners list. *Proves:* a PR
  ran `ci` **on Neo**, went green, and the **ephemeral runner re-registered** (idle/online).
- **(b) CI/CD round-trip, `node: neo-node2`** — the harness downloads the Neo job's log. *Proves:* the
  `machine_probe` line **`node: neo-node2`** is present — **physical author≠verifier** (built on Windows, verified
  on hardware the author does not control).
- **(c) Deploy, token-attributed, binding verify** — the harness reads the latest green `deploy` run. *Proves:* it
  ran **on Neo on a push to the default branch** (token-attributed, no actor click) and the **binding
  `post-deploy-verify`** step went green (no `continue-on-error`).

### Stage D — the two FOUNDER-ATTEST boxes (your hands + your eyes; the harness will NOT auto-pass them)

These cannot be objectively probed from a laptop — a real page to a real phone, a real physical reboot. **Do
them, then record your yes/no.** The harness prompts you and leaves the box **AWAITING-ATTEST** (not green) until
you attest.

- **(e) Watchdog pages on a synthetic miss** — perform §9.3 of the install guide:
  ```bash
  ssh ci-runner@neo 'sudo launchctl bootout system/com.deliveryos.supervisor'   # stop the /ready-gated pusher
  # wait past the grace window (HC_GRACE_SECONDS, ~5–10 min)
  # CONFIRM: you receive the page on BOTH Healthchecks AND the Windows pull-watchdog
  ssh ci-runner@neo 'sudo launchctl bootstrap system .../com.deliveryos.supervisor.plist'   # restore
  # CONFIRM: the check returns to green and the weekly all-green digest resumes
  ```
  *Objective assist (recorded automatically):* the harness runs `node monitoring/pull-watchdog.mjs --self-test` to
  prove the watchdog's **miss-fires / de-dupes / recovers** logic offline. That strengthens the evidence; it does
  **not** substitute for the live page — **you attest the live page**.

- **(i) Cold-boot / reboot-survival** — perform §11 / NEO-OPS-06 §3.5:
  1. **Planned:** `ssh ci-runner@neo` then `sudo fdesetup authrestart` → Neo reboots → confirm worker + colima +
     runner autostart and `/ready` goes green **with no human after the command**.
  2. **Unplanned:** hard power-cycle with FileVault locked → confirm Neo sits at the pre-boot screen, the worker
     does **not** come up, and the **off-Neo watchdog pages within grace** → log in → confirm recovery to `/ready`.
  3. **Keychain:** boot with no GUI login → confirm the daemon reads secrets from the **System keychain** and
     `config-doctor --enforce` passes.
  *Objective assist (recorded automatically):* the harness records that `/ready` is green *now* (a necessary
  post-condition of recovery). "Recovered unattended after a real reboot" is **your attestation**.

### Run it

```bash
cd <repo root>
# after doing (e) and (i):
node infrastructure/execution-node/validation/validate-node.mjs \
  --attest watchdog-pages=yes \
  --attest reboot-survival=yes \
  --out VALIDATION-EVIDENCE.md
```

- Drop the `--attest` flags to run a first pass that lists the objective verdicts and leaves e/i AWAITING.
- Record `=no` for a box that did **not** hold — that is an honest **ATTESTED-FAIL**, not a silent skip.
- `--json` emits a machine-readable result; `--out FILE` writes the evidence report.

---

## 3. The go / no-go gate

The harness prints one gate line and exits accordingly:

| Gate | Meaning | Exit | Action |
|---|---|---|---|
| **GO** | **All 9 boxes GREEN.** Execution Infrastructure is **OPERATIONAL**. | `0` | **This is the trigger to start Sprint 5.3 (Slack control surface).** Founder + PO sign `VALIDATION-EVIDENCE.md`. |
| **INCOMPLETE** | Every objective box is green, but a FOUNDER-ATTEST box (e/i) awaits your confirmation. | `3` | Do the §9.3 / cold-boot steps, then re-run with `--attest <id>=yes\|no`. **Do not sign off.** |
| **NO-GO** | At least one box is RED (objective FAIL or attested-no). | `1` | **Neo is installed, not accepted.** Fix per the box's evidence line + §4 rollback, then re-run. |

**Sign-off (author≠verifier).** The harness is the *author*. The **PO independently re-runs it** and reviews every
evidence line against its box criterion; the **founder attests** the FOUNDER-ATTEST boxes. No box is signed off on
trust — each cites an objective observation or a founder attestation. Both sign the generated `VALIDATION-EVIDENCE.md`.

---

## 4. Rollback — if a check fails

Every Neo move is reversible; a red box never strands you. Map the failing box to its honest fallback:

| Failing box | What it means | Rollback / fix |
|---|---|---|
| **(a)/(b) runner / CI round-trip** | CI on Neo is not green, or the verify did not physically move to Neo. | **Clear `vars.CI_RUNNER` in the GitHub UI** → CI falls back to `ubuntu-latest` in seconds, **no commit, no Neo needed** (the kill-switch lives on GitHub precisely so a dead Neo can't disable its own escape hatch). Repair Neo, re-flip, re-run. |
| **(c) deploy** | The deploy did not complete on Neo, or the binding post-deploy-verify did not gate. | Keep deploy GitHub-hosted (revert the `runs-on` flip). Confirm the HOST-2 co-equal deploy-token control + a binding (no `continue-on-error`) `post-deploy-verify` before re-routing deploy to Neo (a ★ founder gate). |
| **(d) heartbeat / `/ready`** | Neo is down, wedged, or not on the tailnet. | Run `bootstrap/verify-health.sh` on Neo for the named subsystem cause; re-run `bootstrap/install-all.sh` (idempotent re-verify). Until green, do not accept. |
| **(e) watchdog** | The synthetic miss did **not** page. | **Do not proceed** — the dead-man is the M0 safety floor (it must exist before any meter-bearing move). Fix the Healthchecks check / Windows pull task (§9.1–§9.2) and re-test before anything else. |
| **(f) status page** | The off-Neo surface does not render / does not show the node. | Re-deploy `health-bridge/status-page/` as its own Vercel project reading Supabase directly (§10.1); confirm it reads the **durable bus**, not Neo. |
| **(g) Delete Test** | Deleting the adapter broke Core — a boundary leak (a Core file imports `infrastructure/`). | A real architecture defect, not a Neo problem. Fix the offending import (depend on a **contract/port**, not a Core internal), re-run `scripts/delete-test.mjs` until green. **Blocks acceptance.** |
| **(h) boundary gate** | A Core file reaches outward (imports `infrastructure/` or an infra SDK). | Same as (g): move the infra use behind a port adapter; re-run `scripts/arch-boundary-guard.mjs` until CLEAN. **Blocks acceptance.** |
| **(i) cold-boot** | Recovery was not unattended / not detected. | Re-check HOST-3 (`fdesetup authrestart`, battery-as-UPS, System-keychain secrets) per NEO-OPS-06 §3; for the unplanned case confirm the watchdog detection path. If the FileVault wall materially bites, that is objective migration **trigger 4c** — see the host-swap runbook (NEO-OPS-06 §5). |

> **The always-available lever.** `vars.CI_RUNNER` cleared in the GitHub UI falls the entire CI floor back to
> `ubuntu-latest` in seconds. A red validation never forces you to keep a broken Neo in the loop.

---

## 5. What this runbook does NOT do

- It **installs nothing and changes no Neo state** — the harness only OBSERVES; you perform the destructive steps.
- It does **not** re-run the on-node subsystem checks — that is `bootstrap/verify-health.sh`; this is the
  end-to-end acceptance layer **above** it (no duplication).
- It does **not** sign off for you — author≠verifier: the harness produces the evidence, the **PO independently
  verifies**, the **founder attests and accepts**.

*End of the live-node validation runbook. Drive `validate-node.mjs`; produce `VALIDATION-EVIDENCE.md`; gate Sprint 5.3 on a GO.*
