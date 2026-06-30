# `bootstrap/` — the idempotent install scripts (Neo → Execution Node 1)

> The seven scripts the **Founder Installation Guide** invokes to turn a clean Apple-Silicon MacBook ("Neo")
> into a registered, working Delivery OS **Execution Node 1**. Designed in
> `docs/architecture/neo/07-execution-infrastructure-complete.md` (§3 bootstrap, §6 scripts) and
> `docs/architecture/neo/FOUNDER-INSTALLATION-GUIDE.md`.
>
> **This is an Adapter-subsystem asset** (under `infrastructure/`). The scripts orchestrate the **host**
> (Homebrew, Tailscale, launchd, colima, the System keychain) — they are **not Core** and import no Core
> knowledge. **They install nothing here** — they run later, on Neo, by the founder.

## The seven scripts (run in order, or one at a time)

| # | Script | Split | Responsibility |
|---|---|---|---|
| 1 | `install-prereqs.sh` | AUTOMATED | install + pin Homebrew stack: node@22, git, colima, docker CLI, gitleaks, vercel@48.12.1, supabase CLI, tailscale, jq, gh |
| 2 | `join-tailnet.sh` | SEMI | `tailscale up` (exec-node tags, MagicDNS, SSH); render the ACL; assert tailnet-only bind |
| 3 | `register-runner.sh` | SEMI | register the **ephemeral** GH runner under `ci-runner`; install as a launchd service |
| 4 | `bootstrap-secrets.sh` | MANUAL | seed the **System** keychain (never login); `config-doctor` fail-closed; Ed25519 pubkey only |
| 5 | `install-daemons.sh` | AUTOMATED | render + load the launchd plists (worker/supervisor); colima up; FileVault-aware boot posture |
| 6 | `verify-health.sh` | AUTOMATED + ★ | the go-live gate: config-doctor → `/ready` → `/health` → platform-health → heartbeat → watchdog |
| 7 | `install-all.sh` | ORCHESTRATOR | run 1→6 in order, each gated on the prior, halting on failure; pause at the manual gates |

Plus `_lib.sh` (the shared triad/logging/banner/render helpers — sourced, not executed) and
`node-config.env.example` (the **non-secret** placeholder sheet → copy to `node-config.env`).

## The idempotency contract

Every script is a **precondition-probe → action → verification** triad. A satisfied node re-runs every script
as a **green no-op**, which is also the diagnose path — re-running `install-all.sh` is the one-command answer to
"did the macOS update break colima?" (NEO-EXEC-07 §3.2).

## The hard rules these scripts hold

- **No secret is ever hard-coded or written to the tree.** Tokens arrive as a parameter (`--token`) or env var
  and are handed straight to the tool; daemon secrets live ONLY in the System keychain, seeded interactively
  (`read -s`, never echoed). `bootstrap-secrets.sh` runs `gitleaks` to prove the tree stayed clean.
- **Fail-closed.** Any missing tool / unresolved `{{placeholder}}` / failed verification exits non-zero with the
  exact cause. `config-doctor` (exit-code-1-on-missing) is the secret-set gate.
- **MANUAL / ONE-TIME-AUTH / FOUNDER-APPROVAL steps are banner-labelled** — the automated body is everything
  outside a banner. The manual residual is irreducible by security design (NEO-EXEC-07 §8).

## P3.3 config-template dependencies (referenced by path; may not exist yet)

The render/load steps consume the parameterized templates designed in NEO-EXEC-07 §5 and materialized by
**Sprint P3.3**. Until they land, the relevant step **fails closed with a clear "P3.3 dependency missing"**
message and the rest still run:

- `supervision/com.deliveryos.worker.plist.template` · `supervision/com.deliveryos.supervisor.plist.template`
- `tailscale/acl.hujson.template`
- `colima/colima-profile.yaml.template`
- `config/secret-registry.neo.template` (the key list `bootstrap-secrets.sh` reads)
- (referenced elsewhere: `runner/runner.config.template`, `watchdog/*.template`, `config/env.neo.template`)

## Usage (on Neo, later)

```sh
cp node-config.env.example node-config.env   # fill the NON-SECRET placeholder sheet
./install-all.sh                             # full ordered bootstrap (pauses at manual gates)
./install-all.sh --from 4                    # resume at a step
./verify-health.sh                           # re-verify / diagnose anytime (read-only)
```

**Status: DESIGN — installs nothing.** Independent VERIFY is static here; the founder validates on a real install.
