---
artifact: FOUNDER INSTALLATION GUIDE — clean Apple MacBook (Neo) → fully-operational Delivery OS Execution Node 1
id: NEO-FIG-08
date: 2026-06-30
status: GUIDE — the founder runs these steps later; this document INSTALLS NOTHING and RUNS NOTHING. It is the
  single, ordered, copy-pasteable capstone that turns a clean Neo into a registered, working Execution Node 1 with
  minimal ongoing intervention. Every step is tagged [MANUAL] / [ONE-TIME-AUTH] / [FOUNDER-APPROVAL] /
  [AUTOMATED-BY-SCRIPT], gives the exact command or UI action, says what it does, and gives the verification that
  proves it worked. Idempotent throughout: every script is a safe no-op on an already-satisfied node, so re-running
  this guide is also how you DIAGNOSE a degraded node.
synthesizes:
  - docs/architecture/neo/00-ARCHITECTURE-execution-layer.md (NEO-ARCH-00 — the M-pre→M7 order, §11)
  - docs/architecture/neo/02-tailscale-and-security.md (NTS-DOS-v1 — Tailscale install/registration/ACL, secrets, Ed25519 break-glass)
  - docs/architecture/neo/03-heartbeat-and-monitoring.md (NEO-HBM-v1 — the heartbeat layers, the off-node watchdog, the status page)
  - docs/architecture/neo/06-neo-node1-operations-and-migration.md (NEO-OPS-06 — FileVault/reboot, boot-survival, the cold-boot M-gate)
  - docs/architecture/neo/07-execution-infrastructure-complete.md (NEO-EXEC-07 — the bootstrap sequence, the 7 install scripts, the 10 templates, the 3 launchd daemons, CI/CD)
  - docs/architecture/neo/templates-and-scripts-inventory.md (NEO-EXEC-07-INV — the build manifest)
tag_legend:
  - "[MANUAL]              — the founder performs it by hand; it is NOT scriptable (a console click, a typed secret, a key gen)."
  - "[ONE-TIME-AUTH]       — a one-time authorization act (device approval, a short-lived token, a secret seed) that, by SECURITY DESIGN, cannot be automated without a standing god-credential on disk."
  - "[FOUNDER-APPROVAL]    — a founder ★ gate that touches the merge/release floor (binding-check flip, deploy go-live). The node EXECUTES; the founder AUTHORIZES."
  - "[AUTOMATED-BY-SCRIPT] — an idempotent bootstrap script does the work; the founder runs one command and reads the verification."
---

# Founder Installation Guide — clean MacBook (Neo) → Delivery OS Execution Node 1

> **Read this first.** You are turning a brand-new, never-configured Apple Silicon MacBook ("Neo") into **Execution
> Node 1**: the machine that runs your CI required-checks, the independent VERIFY (physical author≠verifier), the
> deploy executor, and the always-on **worker daemon** that drains the durable Supabase bus on its own clock.
> GitHub, Vercel, and Supabase stay SaaS (reached outbound over TLS); **nothing on Neo ever listens on a public
> port.** When you finish, Neo runs unattended, an off-Neo watchdog pages you if it dies, and an off-Neo status
> page shows you one green word.
>
> **The seven install scripts do the heavy lifting** — `install-prereqs.sh`, `join-tailnet.sh`,
> `register-runner.sh`, `bootstrap-secrets.sh`, `install-daemons.sh`, `verify-health.sh`, and the
> `install-all.sh` orchestrator (all under `infrastructure/execution-node/bootstrap/`). They are **idempotent**:
> each probes "is this already done?" first and does nothing if so. The irreducibly-manual steps are manual *by
> security design* — automating them would require a standing god-credential on disk, the exact thing the model
> forbids (NEO-EXEC-07 §8).
>
> **The order is load-bearing and reversible.** Follow the sections top-to-bottom. Two hard rules from the
> architecture: **(a) the off-Neo watchdog (M0) must exist before any meter-bearing move** (NEO-HBM ADR-001), and
> **(b) every step reverts** by clearing one repo variable (`vars.CI_RUNNER`) or one `launchctl bootout`.

---

## 0. Before you start — fill these in once (the placeholder sheet)

Resolve each value **once**, write it here, and reuse it everywhere below. These map 1:1 to the `{{placeholders}}`
in the config templates (NEO-EXEC-07 §5). **None of these is a secret value** — secrets are seeded separately in
§6 and never written into this sheet, the repo, or a dotfile.

| Placeholder | Recommended / your value | Where it comes from |
|---|---|---|
| `{{NODE_ID}}` | `neo-node2` (the registry ID; hostname is `neo`) | NEO-ARCH-00 §A.3 |
| `{{RUNNER_USER}}` | `ci-runner` | the dedicated non-admin user (§1) |
| `{{FOUNDER_EMAIL}}` | `brian.kasanwiredjo@gmail.com` | the only `group:founder` member |
| `{{OWNER}}/{{REPO}}` | your GitHub `org/repo` (e.g. `RUMAH-OS/delivery-os`) | GitHub |
| `{{NODE_VERSION}}` | `22` (LTS) — **match each repo's CI** (PLOS 22, admin 20) | NEO-ARCH-00 §8 |
| `{{VERCEL_CLI_VERSION}}` | `48.12.1` (pinned; API floor ≥47.2.2) | NEO-ARCH-00 §8 |
| `{{TICK_INTERVAL_MS}}` | `20000` (15–30s; **not** 5s — 5s is ~60× the bus load) | NEO-ARCH-00 §9.9 / §11 M0 |
| `{{HEALTH_PORT}}` | `8787` | the ACL health port (NTS §D) |
| `{{DISPATCH_PORT}}` | `9443` | inter-node dispatch (latent) |
| `{{TAILNET_BIND_ADDR}}` | the `tailscale0` / MagicDNS interface addr (NEVER `0.0.0.0`) | resolved after §4 |
| `{{COLIMA_CPU}}/{{COLIMA_MEMORY_GB}}/{{COLIMA_DISK_GB}}` | `4 / 8 / 60` | NEO-EXEC-07 §5.4 |
| `{{HC_PERIOD_SECONDS}}/{{HC_GRACE_SECONDS}}` | `60 / 300` (grace 300–600) | NEO-HBM §4.2 |
| `{{LOG_DIR}}` | `/Users/ci-runner/Library/Logs/delivery-os` | runs as `ci-runner` |

> **Idempotency promise (true for every `[AUTOMATED-BY-SCRIPT]` step):** the script asks "is the postcondition
> already true?" before acting. A re-run on a finished node is a sequence of green no-ops that **re-verifies**
> the node. This is why the same `bootstrap/install-all.sh` you run today is also the one-command answer to "did
> the macOS update break something?"

---

## 1. macOS preparation — the non-admin user, FileVault, and boot-survival

> Everything here is **founder console work on a portable secret store.** It is manual because it provisions the
> security and power posture the whole model rests on (NEO-OPS-06 §3). A script *verifies* each of these and
> prints the residual, but the founder *acts*.

**1.1 — Create the dedicated non-admin `ci-runner` user.**  **[MANUAL]**
- Action: System Settings → Users & Groups → Add User → **Standard** (NOT Administrator) → name `ci-runner`,
  set a strong password. (Or `sudo sysadminctl -addUser ci-runner -fullName "CI Runner" -password -` then a
  password set; do **not** add it to `admin`.)
- What it does: boxes every runner job and the worker daemon inside a non-admin account with **no access to your
  personal keychain, SSH keys, or browser profiles** (NEO-ARCH-00 §2.3 precondition #2).
- Verify: `dscl . -read /Users/ci-runner` returns a record; `groups ci-runner` does **not** list `admin`.

**1.2 — Enable FileVault (at-rest encryption — non-negotiable for a portable node).**  **[MANUAL]**
- Action: System Settings → Privacy & Security → FileVault → **Turn On**. Store the recovery key in your vault
  (NOT on Neo).
- What it does: encrypts the disk so a stolen/borrowed powered-off laptop does **not** yield `VERCEL_TOKEN`,
  pooler creds, or break-glass material (NEO-OPS-06 §3.2, the theft posture of §2.8).
- Verify: `fdesetup status` prints `FileVault is On.`

**1.3 — Point boot-time secrets at the System keychain, never a login keychain.**  **[MANUAL]**
- Action: nothing to toggle yet — this is a **rule you commit to now and §6 enforces**: the worker daemon reads
  from `/Library/Keychains/System.keychain` (root-readable at boot) or a `chmod 600` file, never a *user-login*
  keychain. The launchd plist sets `DOS_SECRET_SOURCE=system-keychain` (NEO-EXEC-07 §5.1).
- What it does: deletes the "keychain locked at boot" wall — a `LaunchDaemon` runs as root before any GUI login,
  but a *login* keychain is locked until that user logs in (NEO-OPS-06 §3.1 Decision A).
- Verify: deferred to §6/§8 (`config-doctor --enforce` after a no-GUI-login boot).

**1.4 — Disable sleep and exclude App-Nap (so the daemon never silently stalls).**  **[MANUAL]**
- Action:
  ```bash
  sudo pmset -a sleep 0 disablesleep 1        # never sleep on power
  sudo pmset -a autorestart 1                 # auto-restart after a power loss (still gated by FileVault unlock)
  ```
  App-Nap exclusion is set on the worker process by the launchd plist (`ProcessType=Background` +
  `NSAppSleepDisabled`, NEO-EXEC-07 §5.1) — no separate command.
- What it does: stops macOS from sleeping or throttling the background drain mid-job (NEO-OPS-06 §2.3).
- Verify: `pmset -g | grep -E 'sleep|disablesleep'` shows `sleep 0` and `disablesleep 1`.

**1.5 — Set clamshell-on-power (lid-closed operation).**  **[MANUAL]**
- Action: connect Neo to power + (optionally) a dummy display or just keep it on AC; with sleep disabled (1.4),
  closing the lid keeps it running. Place it ventilated (thermals — NEO-OPS-06 §2.4).
- What it does: lets Neo run headless, lid-closed, on AC — a supported macOS mode once sleep is disabled.
- Verify: close the lid on power; `pmset -g log | tail` shows no sleep transition; Neo stays reachable (after §4).

**1.6 — Learn the planned-reboot command (`fdesetup authrestart`).**  **[MANUAL — memorize, run later]**
- Action (use this for **every** deliberate reboot, notably macOS updates — do NOT use plain `reboot`):
  ```bash
  sudo fdesetup authrestart
  ```
- What it does: holds the FileVault key in RAM for **exactly one** reboot, so Neo comes back **booted and
  unlocked with no human at the screen** — the daemons autostart and `/ready` goes green unattended
  (NEO-OPS-06 §3.3). The rare *unplanned* reboot (panic / drained battery) instead pages you to log in.
- Verify: exercised in the §11 cold-boot test.

---

## 2. Required software installation — the pinned stack (`install-prereqs.sh`)

**2.1 — Install Homebrew (the package manager everything else uses).**  **[MANUAL — one bootstrap line]**
- Action (run as your normal admin user, once):
  ```bash
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  ```
- What it does: installs Homebrew to `/opt/homebrew` (Apple Silicon). This is the only step `install-prereqs.sh`
  cannot do for you (it needs brew to exist first).
- Verify: `brew --version` prints a version; `which brew` → `/opt/homebrew/bin/brew`.

**2.2 — Install + pin the whole stack.**  **[AUTOMATED-BY-SCRIPT]** — `install-prereqs.sh`
- Action:
  ```bash
  cd ~/delivery-os/infrastructure/execution-node/bootstrap
  ./install-prereqs.sh
  ```
- What it does: installs and **pins** `node@{{NODE_VERSION}}`, `colima`, the `docker` CLI, `gitleaks`,
  `vercel@{{VERCEL_CLI_VERSION}}`, `tailscale`, `jq`, and `gh` (NEO-EXEC-07 §6 C1). Idempotency probe: skips any
  tool already at its pin; re-pins drift.
- Verify (the script asserts each and exits 0 only if all resolve):
  ```bash
  node --version          # v22.x
  vercel --version        # 48.12.1
  colima version; docker --version; tailscale version; gitleaks version; jq --version; gh --version
  ```

> **Per-repo Node match:** the daemon pins Node 22, but each consumer repo's CI must match its own `packageManager`
> (PLOS 22, admin 20) or you get works-on-node-fails-on-hosted drift (NEO-ARCH-00 §8). The runner job uses the
> repo's pinned version, not the daemon's.

---

## 3. Docker installation — colima + the Postgres image

> The runner needs a `postgres:16` for CI; on macOS that is a colima Lima-VM, not native dockerd. Pinned and
> autostarted so the socket is up before a job needs it (NEO-OPS-06 §2.2).

**3.1 — Start colima from the pinned profile.**  **[AUTOMATED-BY-SCRIPT]** (folded into `install-daemons.sh`, or run standalone)
- Action:
  ```bash
  colima start --cpu {{COLIMA_CPU}} --memory {{COLIMA_MEMORY_GB}} --disk {{COLIMA_DISK_GB}}
  # uses colima/colima-profile.yaml.template (autoStart: true)
  ```
- What it does: brings up the Lima VM + the Docker socket with capped CPU/mem/disk (NEO-EXEC-07 §5.4). Idempotency
  probe: `docker info` already returning ⇒ no-op.
- Verify: `docker info` returns without error; `colima status` shows `Running`.

**3.2 — Warm the `postgres:16` image.**  **[AUTOMATED-BY-SCRIPT]**
- Action:
  ```bash
  docker pull postgres:16
  ```
- What it does: pre-pulls the exact CI Postgres so the first required check doesn't pay a cold-pull tax.
- Verify: `docker image inspect postgres:16` succeeds; a throwaway `docker run --rm postgres:16 postgres --version`
  prints `16.x`.

**3.3 — Confirm colima autostart at boot.**  **[AUTOMATED-BY-SCRIPT]** — `install-daemons.sh` confirms `com.colima`
- Action: `install-daemons.sh` (§7) verifies the Homebrew `com.colima` launchd service is enabled.
- What it does: brings the Docker socket up at boot before the worker or a CI job needs it (NEO-EXEC-07 §4).
- Verify: `brew services list | grep colima` → `started`; after a reboot, `docker info` returns with no manual
  `colima start`.

> **Note the test Postgres binds `127.0.0.1` ONLY** — it is never reachable even on the tailnet (NTS §A.2). Don't
> change that.

---

## 4. Tailscale installation and registration — the private fabric

> Tailscale is the control/ops plane (who-may-reach-what), never the data plane. No node gets a public IP; nothing
> binds to `0.0.0.0` (NTS-DOS-v1). The CLI was installed in §2.

**4.1 — Turn on manual device approval (before joining).**  **[MANUAL — console, once]**
- Action: Tailscale admin console → Settings → **Device approval: ON**.
- What it does: a new device gets **no** access on auth alone — you must approve it. Closes the "auth key → silent
  join" hole at N=2–3 nodes (NTS §E.1).
- Verify: the setting shows enabled.

**4.2 — Join the tailnet with the right tags.**  **[AUTOMATED-BY-SCRIPT + ONE-TIME-AUTH]** — `join-tailnet.sh`
- Action:
  ```bash
  cd ~/delivery-os/infrastructure/execution-node/bootstrap
  ./join-tailnet.sh        # runs: tailscale up --advertise-tags=tag:exec-node,tag:ci-runner --hostname=neo
  ```
  The script prints an approval URL.
- What it does: brings Neo onto the WireGuard mesh as `neo` with `tag:exec-node,tag:ci-runner`, and renders
  `tailscale/acl.hujson` from the template (NEO-EXEC-07 §6 C2). Idempotency probe: `tailscale status` already
  joined+tagged ⇒ no-op.
- **[ONE-TIME-AUTH]** Approve the device: open the printed URL (or admin console → Machines → approve `neo`).
- Verify: `tailscale status` shows `neo` **online** with both tags; `tailscale ip -4` prints a `100.x` address.

**4.3 — Apply the ACL policy (default-deny + tests).**  **[MANUAL — console paste, ONE-TIME-AUTH]**
- Action: copy the rendered `tailscale/acl.hujson` (resolved `{{FOUNDER_EMAIL}}`/`{{HEALTH_PORT}}`/
  `{{DISPATCH_PORT}}`) into Tailscale admin console → **Access Controls** → Save. **Ship the `tests[]` block with
  it** (NTS §D).
- What it does: enforces least-privilege — founder devices reach everything; `tag:ci-runner` is a tailnet **sink**
  (nothing reaches it, it can't pivot); `tag:watchdog` hits **only** `:8787`; `tag:external` is quarantined;
  `funnel:deny` pinned on `tag:ci-runner` (NTS §D).
- Verify: the console's ACL **test runner** shows the `tests[]` block **passing** (an ACL without passing tests is
  an assertion, not a gate). Spot-check: `tag:ci-runner` is denied `tag:dev:22` and `tag:exec-node:8787`.

**4.4 — Confirm MagicDNS + tailnet-only binding.**  **[AUTOMATED-BY-SCRIPT]** (`verify-health.sh` re-checks)
- Action / Verify:
  ```bash
  tailscale status | grep neo                       # MagicDNS name resolves
  ping neo                                            # resolves by name, not 100.x
  sudo lsof -iTCP -sTCP:LISTEN -n -P                  # nothing on 0.0.0.0 or a routable LAN addr
  ```
- What it does / proves: the health endpoint + SSH are reachable **only** over the tailnet; the test Postgres is
  `127.0.0.1`-only; net inbound surface = Tailscale SSH + `:8787` health, both tailnet-only (NTS §A.2, §E.5).

> **Enable the macOS application firewall** too (System Settings → Network → Firewall: ON). Tailscale ACLs govern
> tailnet traffic, not Neo's local LAN — the firewall closes the "someone on Neo's home Wi-Fi reaches the runner
> directly" gap (NTS §E.5).

---

## 5. GitHub self-hosted runner — install + register (ephemeral)

> One job → fresh runner → de-register. Runs under `ci-runner`. Long-polls **outbound** to GitHub; no inbound port
> (NEO-ARCH-00 §2.2). This is the M1 step.

**5.1 — Fetch a short-lived registration token.**  **[ONE-TIME-AUTH]**
- Action (as the founder, on a trusted device):
  ```bash
  gh api -X POST repos/{{OWNER}}/{{REPO}}/actions/runners/registration-token --jq .token
  ```
- What it does: mints a **short-lived** registration token (expires in ~1h). It is founder-supplied because
  automating it would mean a standing GitHub admin credential on Neo (NEO-EXEC-07 §6 C3, §8).
- Verify: the command prints a token string (do not store it; paste it into the next step within the hour).

**5.2 — Register the ephemeral runner under `ci-runner`.**  **[AUTOMATED-BY-SCRIPT + ONE-TIME-AUTH]** — `register-runner.sh`
- Action (the script downloads `actions/runner`, then runs `config.sh` as `ci-runner`):
  ```bash
  sudo -u ci-runner ./register-runner.sh --token <PASTE_TOKEN_FROM_5.1>
  # internally: ./config.sh --url https://github.com/{{OWNER}}/{{REPO}} \
  #             --ephemeral --labels self-hosted,neo --unattended
  ```
- What it does: registers an **ephemeral** runner labelled `self-hosted,neo` owned by the non-admin user
  (NEO-EXEC-07 §5.6, §6 C3). Idempotency probe: `svc.sh status` already registered+online ⇒ no-op.
- Verify: `gh api repos/{{OWNER}}/{{REPO}}/actions/runners --jq '.runners[].name'` lists the runner.

**5.3 — Install the runner as a launchd service.**  **[AUTOMATED-BY-SCRIPT]**
- Action:
  ```bash
  sudo ./svc.sh install ci-runner
  sudo ./svc.sh start
  ```
- What it does: installs `actions.runner.{{OWNER}}-{{REPO}}.<name>` as a `LaunchDaemon` (via `svc.sh`), with
  `KeepAlive` re-registering a fresh ephemeral runner after each job (NEO-EXEC-07 §4).
- Verify: `sudo ./svc.sh status` → running; GitHub → Settings → Actions → Runners shows **Idle / online**.

---

## 6. Secrets / bootstrap — seed the System keychain once, fail-closed

> The one-time founder seeding, over Tailscale SSH, from the **authoritative platform stores**. Values are typed
> into the SSH session, **never** written to a file or the repo (NTS §F.2). `config-doctor --enforce` then
> fail-closes a half-bootstrapped node.

**6.1 — Create the Healthchecks.io dead-man check (to obtain `HC_PING_URL`).**  **[ONE-TIME-AUTH — do this here so the URL exists to seed]**
- Action: Healthchecks.io → New Check → name `{{NODE_ID}}-deadman`, period `{{HC_PERIOD_SECONDS}}`s, grace
  `{{HC_GRACE_SECONDS}}`s, enable the **weekly all-green digest**; copy the **ping URL**.
- What it does: creates the off-Neo dead-man (the M0 safety floor). The ping URL becomes the `HC_PING_URL`
  secret (NEO-HBM §4.2, NEO-EXEC-07 §5.5).
- Verify: the check shows in the Healthchecks dashboard as "new / never pinged."

**6.2 — Generate the Ed25519 break-glass keypair (private key stays OFF Neo).**  **[MANUAL — on your founder device, ONE-TIME]**
- Action (run on your **laptop**, NOT Neo):
  ```bash
  ssh-keygen -t ed25519 -f ~/.dos/breakglass -C "dos-break-glass" -N ''
  # PRIVATE key (~/.dos/breakglass) STAYS on the founder device. Only the PUBLIC key goes to Neo.
  ```
- What it does: implements ADR-SEC-3 — the **private signing key never lives on the execution node**, so a
  compromised Neo **cannot mint** a prod-write grant (NTS §F.5 / ADR-3; a go-live precondition, NEO-OPS-06 §5.1).
- Verify: `~/.dos/breakglass` (private) exists only on the founder device; `~/.dos/breakglass.pub` is what you
  seed as `BREAK_GLASS_PUBKEY` in 6.3.

**6.3 — Seed each System-keychain secret over Tailscale SSH.**  **[AUTOMATED-BY-SCRIPT prompts + ONE-TIME-AUTH/MANUAL seeding]** — `bootstrap-secrets.sh`
- Action (founder SSHes to Neo as `ci-runner`, then runs the script which prompts only for **missing** keys):
  ```bash
  ssh ci-runner@neo                     # Tailscale SSH (keyless, ACL-governed; no public sshd)
  cd ~/delivery-os/infrastructure/execution-node/bootstrap
  ./bootstrap-secrets.sh                # for each registry key not PRESENT, prompts you to paste the value
  # under the hood, per key:
  #   security add-generic-password -a ci-runner -s DATABASE_URL -w '<value>' -U
  ```
  Seed the registry keys (NEO-EXEC-07 §5.7) — pull each from its authoritative store, never from a file:
  - `DATABASE_URL` — the Supabase **pooler** URL (`*.pooler.supabase.com:6543`; IPv4 ⇒ pooler, never the IPv6 direct host)
  - `VERCEL_TOKEN` — deploy-scoped Vercel token (`vercel env pull` / dashboard)
  - `CRON_SECRET` — from your vault
  - `HC_PING_URL` — the URL from 6.1
  - `BREAK_GLASS_PUBKEY` — the **public** key from 6.2 (public key only)
- What it does: writes each secret into the **System keychain** under `ci-runner`, encrypted at rest, scoped to
  the runner user (your personal keychain is untouched). Idempotency probe: re-run prompts **only** for keys
  `config-doctor --include-local` still reports missing (NEO-EXEC-07 §6 C4).
- Verify: `security find-generic-password -a ci-runner -s DATABASE_URL` returns the item metadata (never run with
  `-w` in a shared session). No secret appears in any file: `gitleaks detect` over the repo stays clean.

**6.4 — Fail-closed validation (`config-doctor --enforce`).**  **[AUTOMATED-BY-SCRIPT]**
- Action:
  ```bash
  config-doctor --include-local --enforce
  ```
- What it does: confirms **every** required key is PRESENT and valid **without printing any value**; exits non-zero
  (refusing daemon start) if the secret set is incomplete — a half-bootstrapped node fails **loud, not silent**
  (NTS §F.3, NEO-OPS-06 §3.1).
- Verify: the command **exits 0**. (A non-zero exit names the exact missing/invalid key — go back to 6.3 for it.)

> **The deploy token is a co-equal prod-mutation path.** `VERCEL_TOKEN` can deploy attacker code to prod as you,
> bypassing break-glass. Before deploy goes live on Neo (§7/§11), put a co-equal control on it — deploy
> author≠verifier, a deploy-approval gate, or a second factor (NEO-ARCH-00 §6.5, HOST-2). Carried as a hard gate.

---

## 7. Delivery OS registration — daemons, node-registry, the runner switch

> Three **deliberately not-nested** launchd `LaunchDaemon`s + the colima service. Then register Neo as an
> `ExecutionProviderPort` adapter so the Runtime can place work on it — without the Runtime ever learning the word
> "Neo" (NEO-EXEC-07 §2.1).

**7.1 — Install the three daemons.**  **[AUTOMATED-BY-SCRIPT]** — `install-daemons.sh`
- Action:
  ```bash
  cd ~/delivery-os/infrastructure/execution-node/bootstrap
  ./install-daemons.sh        # renders the plists with resolved placeholders, then launchctl bootstrap each
  ```
- What it does: renders + loads (NEO-EXEC-07 §4, §5.1–§5.2):
  - `com.deliveryos.worker` — the engine-tick / reconciler / GS drain loop (`caffeinate -dimsu` wrapped,
    `DOS_TICK_INTERVAL_MS={{TICK_INTERVAL_MS}}`, reads System-keychain secrets, fail-closes on `config-doctor`).
  - `com.deliveryos.supervisor` — the **health bridge**: serves `/health`+`/ready` on `{{TAILNET_BIND_ADDR}}:{{HEALTH_PORT}}`
    and runs the `/ready`-gated Healthchecks pusher.
  - `actions.runner.*` — confirmed loaded (from §5.3).
  - `com.colima` — confirmed autostart (from §3.3).
  Idempotency probe: `launchctl print system/<label>` already loaded ⇒ no-op; re-renders on drift.
- Verify:
  ```bash
  sudo launchctl print system/com.deliveryos.worker      | grep -E 'state|KeepAlive'
  sudo launchctl print system/com.deliveryos.supervisor  | grep state
  ```
  Both show **running** with `KeepAlive` active.

**7.2 — Register the node in the node-registry.**  **[AUTOMATED-BY-SCRIPT]**
- Action: add the adapter entry (`adapters/neo/neo-provider.ts` is registered) —
  `nodeId: "neo-node2"`, `labels: ["self-hosted","macos","neo","pg","vercel-token"]`, `trustDomain: "trusted"`
  (NEO-EXEC-07 §2.1, D1).
- What it does: makes Neo selectable by the constraint-first `PlacementPort`. The Runtime emits
  `ExecutionRequest{kind, placement_req:{resource_class:"macos", capabilities:["pg"]}}` and the selector matches
  the **opaque label strings** — it never writes "neo" (NEO-EXEC-07 §2.1 discriminator).
- Verify: the registry lists `neo-node2`; a `placement` dry-run for a `macos`+`pg` request selects it.

**7.3 — Flip `vars.CI_RUNNER` to route CI to Neo (or keep GitHub-hosted until M3).**  **[FOUNDER-APPROVAL]**
- Action (GitHub UI → repo → Settings → Variables → Actions):
  - Keep **empty** (or `ubuntu-latest`) to stay GitHub-hosted — the safe default until you've parity-proven.
  - Set `CI_RUNNER = ["self-hosted","neo"]` to route CI to Neo.
  ```yaml
  # ci.yml already reads: runs-on: ${{ vars.CI_RUNNER == '' && 'ubuntu-latest' || fromJSON(vars.CI_RUNNER) }}
  ```
- What it does: the **UI-flippable kill-switch** (NEO-EXEC-07 §7.1) — moves CI to Neo with no commit; clearing it
  is the instant fallback that works **even when Neo is dead**. Per NEO-ARCH-00 §11, flip non-binding clones first
  (M1/M2), then **binding** checks one at a time (M3, each a ★ gate).
- Verify: a test PR's `ci` job runs **on Neo** (the runner picks it up); the `machine_probe` log records
  `node: neo-node2` — physical author≠verifier (build on Windows, verify on Neo).

**7.4 — Confirm the worker daemon ticks.**  **[AUTOMATED-BY-SCRIPT]**
- Action / Verify:
  ```bash
  curl -s http://neo:{{HEALTH_PORT}}/ready | jq '.verdict'     # "ok"
  # engine_heartbeat rows advancing on the bus (tick_seq increments, last_tick_at fresh):
  ```
- What it does / proves: the worker owns its clock and stamps `engine_heartbeat{tick_seq++, last_tick_at}` every
  `{{TICK_INTERVAL_MS}}` (NEO-HBM Layer B).

---

## 8. Health verification — `/ready` green, the daemon ticking

**8.1 — Run the go-live gate.**  **[AUTOMATED-BY-SCRIPT]** — `verify-health.sh`
- Action:
  ```bash
  cd ~/delivery-os/infrastructure/execution-node/bootstrap
  ./verify-health.sh
  ```
- What it does: the pure read/verify gate — `config-doctor --include-local --enforce` → `/ready` green →
  (at M4/M5) cold-boot recovery test → runner parity-prove (NEO-EXEC-07 §6 C6). Mutates nothing; always runnable.
- Verify: the script exits 0 and prints each subsystem `ok`.

**8.2 — `/ready` reports green; `/health` is Supabase-independent.**  **[AUTOMATED-BY-SCRIPT]**
- Action / Verify:
  ```bash
  curl -s -o /dev/null -w '%{http_code}\n' http://neo:{{HEALTH_PORT}}/ready    # 200 (503 when verdict=down)
  curl -s http://neo:{{HEALTH_PORT}}/health | jq '.ok'                          # true — process up, NO DB touch
  ```
- What it does / proves: `/ready` folds DB-reachable + heartbeat-fresh + cursor-advancing + config-valid + GS-in-window
  worst-wins; `/health` proves the process is up without touching Supabase (disambiguates "bus down" from "node
  down", NEO-HBM §3.3).

**8.3 — `platform-health` report.**  **[AUTOMATED-BY-SCRIPT]**
- Action: `node templates/tools/platform-health.mjs` (or the `/v1/health/platform` body).
- What it does: the canonical `buildReport`/`computeVerdict`/`classifyFailure` report — every failure is a **named
  cause**, never a silent omission (NEO-EXEC-07 §2.2).
- Verify: `verdict: "ok"`, every `critical` subsystem `ok`.

**8.4 — Heartbeat rows advance.**  **[AUTOMATED-BY-SCRIPT]**
- Action / Verify: query `engine_heartbeat` for `neo-node2` twice, ~30s apart; `tick_seq` increased and
  `last_tick_at` advanced (< 60s old). A wedged-but-alive daemon stops advancing `tick_seq` (NEO-HBM Layer B).

---

## 9. Heartbeat verification — the off-Neo watchdog is receiving check-ins

> M0 is the hard precondition (NEO-HBM ADR-001): the dead-man lives on a **different failure domain** than Neo.
> Two off-Neo domains — Healthchecks.io (push) + the Windows pull-watchdog — sharing only your phone.

**9.1 — Confirm Healthchecks is receiving the `/ready`-gated push.**  **[AUTOMATED-BY-SCRIPT (push) + MANUAL (verify)]**
- Action: the `com.deliveryos.supervisor` pusher (from §7.1) POSTs `HC_PING_URL` every `{{HC_PERIOD_SECONDS}}`s
  **only when `/ready` is green** (NEO-HBM ADR-003).
- Verify: Healthchecks dashboard → the `{{NODE_ID}}-deadman` check shows **green / "up"** with a recent ping and a
  steady cadence.

**9.2 — Install the Windows pull-watchdog (the independent backup domain).**  **[MANUAL — on the Windows box, ONE-TIME]**
- Action: on `windows-node1`, import `watchdog/windows-pull-task.xml.template` as a Scheduled Task
  (`{{NEO_MAGICDNS}}`, `{{HEALTH_PORT}}`, `{{POLL_INTERVAL_MIN}}`); it pulls **both** `http://neo:{{HEALTH_PORT}}/ready`
  **and** a direct Supabase probe every ~5 min (NEO-EXEC-07 §5 B6, NEO-HBM §4.2).
- What it does: catches "daemon up enough to ping Healthchecks but actually wedged," and disambiguates a Supabase
  outage from a Neo outage (so a bus outage doesn't misfire as "node down").
- Verify: the Task History shows successful runs; a forced `/ready` 503 makes it alert.

**9.3 — Trigger a synthetic miss → confirm it pages.**  **[MANUAL — a deliberate test]**
- Action: stop the supervisor briefly so the push stops:
  ```bash
  sudo launchctl bootout system/com.deliveryos.supervisor      # stops the /ready-gated pusher
  # wait past the grace ({{HC_GRACE_SECONDS}}s), confirm the page, then restore:
  sudo launchctl bootstrap system gui/<uid>/.../com.deliveryos.supervisor.plist
  ```
- What it does: proves the dead-man converts **silence into a ping** within grace — the single control that turns
  six-month silent rot into one alert (NEO-HBM §4, §11 cold-boot test analog).
- Verify: within the grace window you receive the Healthchecks alarm (email/SMS/push) **and** the Windows task
  alerts. Restore the supervisor and confirm the check returns to green + the weekly all-green digest resumes.

---

## 10. Monitoring verification — the off-Neo status page survives Neo being down

**10.1 — Deploy the off-Neo status page.**  **[MANUAL — one-time Vercel project]**
- Action: deploy `health-bridge/status-page/` as its **own Vercel project**, reading Supabase directly
  (NEO-EXEC-07 §1.1 D7, NEO-HBM §8). It is hosted **off Neo** on purpose.
- What it does: the single glanceable surface — nodes up/down + last-seen, engine-tick age (green<30s / amber<2m /
  red>2m), runner online + queued-checks, goals/breaker, queue depth, last deploy + verify verdict, the watchdog's
  own last check-in, and the worst-wins overall verdict (one word: ok/degraded/down).
- Verify: the page loads at its Vercel URL and shows `neo-node2` **green**.

**10.2 — Prove it still renders when Neo is stopped.**  **[MANUAL — a deliberate test]**
- Action: stop the worker (`sudo launchctl bootout system/com.deliveryos.worker`) or power Neo down; reload the
  status page.
- What it does / proves: because the page reads the **durable Supabase bus** (not Neo), Neo can be a smoking crater
  and the page still renders the full picture — it simply shows `neo-node2: DOWN`, last-tick red, and the dead-man's
  last check-in (NEO-HBM §8). This is exactly when it earns its keep.
- Verify: with Neo stopped, the page still loads and shows `neo-node2: DOWN`. Restore the worker; the node returns
  to green. (Two free Supabase-independent backstops behind it: the Tailscale device list + the Healthchecks
  dashboard, NEO-HBM §5.4.)

---

## 11. Acceptance checklist — proof Node 1 is operational

> Tick every box. Until all pass, Neo is *installed*, not *accepted*. These map to the M1–M6 founder gates and the
> standing Delete Test (NEO-ARCH-00 §11; NEO-EXEC-07 §1.2).

- [ ] **Runner executes a build.** A PR with `vars.CI_RUNNER=["self-hosted","neo"]` runs `ci` on Neo; the job
      goes green; the ephemeral runner de-registers and a fresh one re-registers (`svc.sh status` online).  **[FOUNDER-APPROVAL]**
- [ ] **CI/CD round-trips.** PR → required checks on Neo → branch protection green → CODEOWNERS review →
      `verify-coverage` binding status green → founder merges. The `machine_probe` log shows `node: neo-node2`
      (physical author≠verifier).  **[FOUNDER-APPROVAL]**
- [ ] **A deploy completes, token-attributed.** Merge-to-main runs `deploy.yml` on Neo: `config-doctor --env
      production` → `supabase migration up` (pooler) → `vercel deploy --prebuilt --prod --token` (attributed to
      the founder, no actor click) → **binding** `post-deploy-verify.mjs` green (no `continue-on-error`). The
      co-equal deploy-token control (HOST-2) is in place.  **[FOUNDER-APPROVAL]**
- [ ] **Heartbeat works.** `engine_heartbeat` `tick_seq` advances; `/ready` is green; the Healthchecks push is
      arriving on cadence.  **[AUTOMATED-BY-SCRIPT]**
- [ ] **Watchdog works.** The §9.3 synthetic miss paged you within grace, on **both** Healthchecks and the Windows
      pull; the weekly all-green digest is enabled.  **[MANUAL]**
- [ ] **Status page works.** The off-Neo page shows `neo-node2` green normally, and still renders `DOWN` when Neo
      is stopped (§10.2).  **[MANUAL]**
- [ ] **The Delete Test passes.** CI `rm -rf infrastructure/execution-node/` ⇒ **Core still typechecks and the
      contracts still resolve** — the Runtime builds with the entire Neo adapter deleted (the operational
      definition of host-agnostic; NEO-EXEC-07 §1.2 E2).  **[AUTOMATED-BY-SCRIPT]**
- [ ] **The Runtime is infra-independent.** The dependency-direction gate (`scripts/arch-boundary-guard.mjs`) is green: no file
      under `templates/governance-engine` or `templates/workflow-engine` imports anything under
      `infrastructure/execution-node/` or an infra SDK.  **[AUTOMATED-BY-SCRIPT]**
- [ ] **The reboot-survival cold-boot test passes** (NEO-OPS-06 §3.5):  **[MANUAL]**
  - [ ] **Planned:** `sudo fdesetup authrestart` → Neo reboots → worker + `com.colima` + runner autostart →
        `/ready` green → Healthchecks ping resumes, **with no human after the command**.
  - [ ] **Unplanned:** hard power-cycle with FileVault locked → Neo sits at the pre-boot screen, the worker does
        **not** come up, and the off-Neo watchdog **pages within grace** → you log in → recovery to `/ready` green.
        (Proves the residual is *detected, not silent*.)
  - [ ] **Keychain:** boot with no GUI login → the daemon reads secrets from the **System keychain** (not a login
        keychain) and `config-doctor --enforce` passes.

---

## What runs automatically from here (the closing note)

Once §11 is all-ticked, Neo is a **cattle node, not a pet** — all durable state is on the Supabase bus; Neo holds
nothing irreplaceable. From here, **without you**:

- **The worker daemon** ticks every `{{TICK_INTERVAL_MS}}`, drains the bus (SKIP-LOCKED + lease), advances the
  goal loop, and stamps the heartbeat. A crash → launchd `KeepAlive` relaunches it → it re-reads the bus and
  resumes (no lost work — NEO-HBM Tier 0–1).
- **The ephemeral runner** picks up each required check, runs it on a clean checkout, and de-registers; a fresh one
  re-registers for the next job.
- **colima** autostarts the Docker socket at boot; **planned reboots** (`fdesetup authrestart`) come back unattended.
- **The off-Neo watchdog** (Healthchecks push + the Windows pull) converts any silence into a page; the **weekly
  all-green digest** proves the alarm path itself is alive.
- **The off-Neo status page** answers "is everything healthy?" in one word, and keeps answering even when Neo is down.
- **Re-running `bootstrap/install-all.sh`** is the one-command health re-verify and the fix for "a macOS update
  broke colima" — every script is a green no-op on an already-healthy node.

**What still needs you (the bounded manual residual, by security design — NEO-EXEC-07 §8):** the rare **unplanned**
reboot is a paged manual-login event (kernel panic / drained battery); the two **founder ★ gates** (binding-check
flips, deploy go-live) touch the merge/release floor and stay yours; and **secret rotation / device removal** on a
compromise is a one-console-action runbook (NTS §E.4). You are the SRE — but the design's whole job is to make each
manual act a single, guided, re-checkable prompt, and to keep the *re-run* path frictionless.

**The reversibility lever, always available:** clearing `vars.CI_RUNNER` in the GitHub UI falls the entire CI floor
back to `ubuntu-latest` in seconds — no commit, **no Neo needed**. The kill-switch lives on GitHub precisely so a
dead Neo cannot disable its own escape hatch.

*This is a guide. It installs nothing and runs nothing — the founder executes these steps. An independent §11 panel
ratifies the design (author≠verifier) and a founder gate authorizes before any of it is built; M0 (the off-Neo
watchdog) is the hard precondition that precedes every meter-bearing step.*
