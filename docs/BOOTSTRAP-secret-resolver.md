# Bootstrap runbook — the Secret Vault (local vault = source of truth)

How a node (Neo, a CI runner) is provisioned with the **local encrypted vault** and its **single**
root credential (the vault master key), how secret values are **seeded** in once, how a consumer
**reads** a value, how the vault **pushes** values out to the write-only planes, and how to verify it
all **without exposing a value**.

> Companion of `i-config` (presence oracle). Capability: `capabilities/secret-resolver.capability.json`.
> Tool: `templates/tools/secret-resolver.mjs` (portable) · `rumah-admin/infra/secret-resolver.mjs` (in-repo).

---

## 0. Doctrine recap (read once)
- **Platforms are write-only.** All Vercel env vars are Sensitive (the API never returns their
  value); GitHub Actions secrets are write-only. So **nothing can be pulled** from a platform.
- The node keeps a **local encrypted vault** (AES-256-GCM at rest) inside the §54.2 trust boundary.
  It is the **source of truth** for values. Unlocked by **one** root credential: the **vault master
  key**.
- `seed` puts a value in ONCE from its origin; `get` reads it (stdout only); `push` writes it OUT.
- A value is emitted **exactly once, to stdout, nowhere else**. Diagnostics + audit → **stderr**
  (name + time + verdict, never a value). Fail-closed on every error; **never a faked/pulled value**.

## 1. Create the vault + the ONE root credential (once per node)
The trust boundary is *proven*: the vault dir must be `0700` owner-only; the master key + each entry
`0600`. `vault-init` does both.

```bash
export DELIVERYOS_VAULT="$HOME/.deliveryos/vault"   # or /opt/deliveryos/vault (0700)
node templates/tools/secret-resolver.mjs vault-init --vault "$DELIVERYOS_VAULT"
# → creates the 0700 vault dir and a fresh 0600 master key at <vault>/.master.key
ls -ld "$DELIVERYOS_VAULT"                # drwx------
ls -l  "$DELIVERYOS_VAULT/.master.key"    # -rw-------
```
Alternative roots (pick ONE): a macOS Keychain item, `age`/`sops` (document as an optional
dependency), or the key in `$DELIVERYOS_VAULT_KEY_B64` (base64 of 32 bytes) for CI. The default is
the zero-dep `0600` master-key file.

> Rotate the root by regenerating the master key and re-encrypting the vault. Because platforms are
> write-only, the root is a vault key — **not** a platform token.

## 2. Seed each secret ONCE from its origin
Each key's `retrieval_source` in the registry says where its value comes from:

```bash
# generated — minted locally (e.g. CRON_SECRET):
node templates/tools/secret-resolver.mjs seed CRON_SECRET --env prod --from generated

# manual — pasted once from its write-only origin (Supabase JWT secret, Vercel Sensitive value…).
# Read WITHOUT echo; the value goes in on stdin and never touches argv/history/logs:
node templates/tools/secret-resolver.mjs seed AUTH_JWT_SECRET --env prod --from manual
#   → paste the value at the silent stdin prompt, press Ctrl-D.
```
`supabase` origin is documented-only (the legacy JWT secret is not cleanly returned by the Management
API) — it falls through to a one-time `--from manual` seed. The resolver refuses honestly rather than
fake a value.

## 3. Read a value into a consumer (never into a file or log)
```bash
AUTH_JWT_SECRET="$(node rumah-admin/infra/secret-resolver.mjs get AUTH_JWT_SECRET --env prod)" \
  node rumah-admin/scripts/mint-service-token.mjs --sub svc-neo --ttl 900
```
If the vault has no value (`NOT_SEEDED`, exit 4), `$( … )` is empty and `mint-service-token` refuses —
no unsigned/garbage token, and no fabricated "pull" from a write-only plane.

## 4. Push values OUT to (re)provision the planes / fix drift
This is the direction that works. It reads the vault and writes to the write-only planes:
```bash
# needs VERCEL_TOKEN + VERCEL_PROJECT_ID for the vercel sink, and `gh auth` for github:
node templates/tools/secret-resolver.mjs push CRON_SECRET --env prod --to vercel
node templates/tools/secret-resolver.mjs push AUTH_JWT_SECRET --env prod --to vercel,github
# vercel → POST /v10/projects/{id}/env?upsert=true (type:sensitive)
# github → gh secret set <KEY> --body -   (value on stdin; gh does the libsodium sealed box)
```
Use i-config first to see WHERE drift is (`MISSING`/`DRIFTED`), then `push` to fix it from the vault.

## 5. Verify end-to-end WITHOUT exposing a value
```bash
# 5a. Offline proofs (mocked providers — no real secret touched):
node templates/tools/secret-resolver.mjs --self-test       # → 9/9 passed
node templates/tools/secret-resolver.test.mjs              # → 23/23 passed

# 5b. Plan a key (origin + push targets, NO value):
node templates/tools/secret-resolver.mjs plan AUTH_JWT_SECRET --env prod

# 5c. Seed a throwaway generated key, read its LENGTH only (never the value):
node templates/tools/secret-resolver.mjs seed CRON_SECRET --env prod --from generated
LEN=$(node templates/tools/secret-resolver.mjs get CRON_SECRET --env prod | wc -c)
echo "resolved CRON_SECRET: ${LEN} bytes"                  # length only

# 5d. Confirm the never-log guarantee: capture stderr; the value must NOT be in it.
node templates/tools/secret-resolver.mjs get CRON_SECRET --env prod 1>/dev/null 2>stderr.txt
grep -c 'key=CRON_SECRET' stderr.txt    # audit line present (name only); the value is never there
rm -f stderr.txt
```

## 6b. Auto-renewal — long-running services never go stale (no manual re-issue)
A long-running consumer (the Slack control-surface adapter) presents a bounded-TTL HS256 service
token (`GOALS_API_TOKEN`, e.g. 30 days). The renewer re-mints it from the vault-held signing key
**before** expiry, on a timer:
```bash
# one run (renew if <threshold left, else no-op):
node rumah-admin/scripts/renew-service-token.mjs --once --env prod
# install the daily timer (macOS launchd): templates/ops/com.deliveryos.token-renewer.plist
#   cp … ~/Library/LaunchAgents/ && launchctl load … && launchctl start com.deliveryos.token-renewer
# Linux systemd: templates/ops/deliveryos-token-renewer.timer.md
```
The renewer reads the current token from the vault, decodes its `exp`, and only re-mints when it is
within `--threshold` of expiry (default 7 days for a 30-day token). The fresh token is written back to
the vault (and, if configured, the adapter's `0600` env file). No value is ever logged.

**Signing key preference (the Supabase-decoupling seam):** the renewer signs with
`SERVICE_SIGNING_KEY` (the dedicated, node-controlled, vault-only key — origin `generated`, rotated on
our schedule) if it is seeded; otherwise it falls back to `AUTH_JWT_SECRET` (today's Supabase legacy
symmetric secret). Seed the dedicated key once and machine tokens become independent of Supabase:
```bash
node rumah-admin/infra/secret-resolver.mjs seed SERVICE_SIGNING_KEY --env prod --from generated
```
> **Follow-on engine change (design note — not implemented here):** the engine currently verifies ALL
> tokens (user + service) with one HS256 secret (`AUTH_JWT_SECRET` = the Supabase legacy JWT secret).
> Supabase is migrating to asymmetric signing keys, so that symmetric secret is a long-term liability.
> Add a SECOND, node-controlled HS256 key dedicated to `aud=service` tokens (`SERVICE_SIGNING_KEY`,
> held + rotated in the vault), verified in parallel during an overlap window, so machine automation is
> fully independent of the Supabase user-key lifecycle. The vault/registry are already shaped for it
> (the `SERVICE_SIGNING_KEY` entry, origin `generated`, rotatable).

## 6c. Rotation-safety — a rotated root is detected, not silently trusted
If the engine's signing secret is rotated at its origin, previously-minted tokens start returning
`401`. Run the renewer with a probe so it detects this and re-mints:
```bash
node rumah-admin/scripts/renew-service-token.mjs --once --env prod --probe https://rumah-admin.vercel.app/v1/health
```
On a `401` the renewer attempts to **re-sync the root from its origin** and re-mint. If the re-sync is
impossible (the Supabase legacy secret is not auto-readable — the honest default), it **fails closed
and ALERTS** (stderr + optional `$DELIVERYOS_ALERT_WEBHOOK`) rather than keep a dead or faked token —
then a human re-seeds the root once: `secret-resolver seed AUTH_JWT_SECRET --env prod --from manual`.
Rotate the dedicated `SERVICE_SIGNING_KEY` on your own schedule with `seed … --from generated` (the
renewer picks up the new key on its next run).

## 7. Wire the CI `config-gate` (documentation-only — no branch-protection change)
The `config-gate` already runs i-config's presence checks. To let it materialize a value it needs, add
the vault master key to the CI job as `$DELIVERYOS_VAULT_KEY_B64` (a CI secret) alongside the vault
entries, and call `get`/`push`. **Do not** change branch protection or the gate's required status here
— that is a separate, founder-gated action.

## Failure modes (all fail-closed, all honest)
| Symptom | Exit | Meaning / fix |
|---|---|---|
| `UNKNOWN_KEY` | 2 | Key not in the registry — declare it first. |
| `PLANE_REFUSED` / `UNSUPPORTED` | 3 | Trying to read a write-only plane, an un-enabled supabase seed, or an unknown push sink — seed the vault / paste once instead. |
| `NOT_SEEDED` | 4 | The vault has no value for this key/env — `seed` it (never a fake pull). |
| `INSECURE_STORE` | 5 | A vault entry / master key is group/other-readable — `chmod 600`. |
| `OUTSIDE_BOUNDARY` | 6 | Resolving/seeding a SECRET/PII but the vault dir is not `0700`/owner — fix it (step 1). |
| `MISSING_ROOT_CREDENTIAL` | 7 | No vault master key — `vault-init` / set `$DELIVERYOS_VAULT_KEY_B64`. |
| `PROVIDER_ERROR` | 8 | Transport/HTTP/registry/decrypt error — see the stderr detail. |
