# Secret Resolver / Vault — the retrieval counterpart of I-Config

**Capability:** `secret-resolver` · **Home:** `templates/tools/secret-resolver.mjs` (portable) ·
`rumah-admin/infra/secret-resolver.mjs` (in-repo, alongside `i-config.mjs`) ·
**Manifest:** `capabilities/secret-resolver.capability.json` · **Skill:** `skills/secret-resolution/SKILL.md` ·
**KU:** `wiki/ku-secret-resolution-store-one-derive-all/KU.md` · **Runbook:** `docs/BOOTSTRAP-secret-resolver.md`

## Why a vault, not a puller
Secret VALUES live only in platform stores — and in this fleet **every one of them is write-only**:
all Vercel env vars are marked **Sensitive** (the API never returns their value — confirmed live) and
GitHub Actions secrets are write-only by design (`gh secret list` returns names only). So **no
platform can be a retrieval source**. A "pull from Vercel" resolver is impossible here.

The only reliably-readable store is a **local encrypted vault** on the node, inside the §54.2 trust
boundary. The vault is the **source of truth** for secret values; the platforms are **push targets**.
A node that needs a value reads the vault (offline, fast); a value enters the vault **once** from its
origin; and the vault **pushes** values out to (re)provision the write-only planes.

## I-Config vs. the Vault (they compose)
| | I-Config (`i-config.mjs`) | Secret Vault (`secret-resolver.mjs`) |
|---|---|---|
| Question | *Is it PRESENT on the plane?* | *GET the value (from the vault)* / *PUSH it out* |
| Reads a value? | **Never** (presence-only) | reads the **vault** (never a platform) |
| Registry | `config-secret-registry.json` | **same** registry (+ `retrieval_source`/`sensitive`) |
| Fixing drift | reports `MISSING`/`DRIFTED` | `push` writes the vault value out to fix it |

## The three verbs
- **`seed <KEY> --from generated|manual|supabase`** — put a value into the vault **once**, from its
  origin. `generated` mints locally (`CRON_SECRET`); `manual` reads it on stdin (the honest default
  for a write-only origin — paste the Supabase JWT secret once); `supabase` is documented-only.
- **`get <KEY>`** — read the value from the vault → **stdout only** (for piping into a consumer).
- **`push <KEY> --to vercel,github`** — write the vault's value **out** to the write-only planes.

## Doctrine (load-bearing)
1. **Metadata-driven** — reads the registry for each key's plane + `data_class` + `retrieval_source`; **refuses undeclared keys**.
2. **Never log a value** — emitted exactly once to stdout; audit (stderr / append-only log) = name + time + verdict only.
3. **Fail-closed** — typed error + non-zero exit + nothing on stdout; in particular **never "pull" a value the vault lacks** (→ `NOT_SEEDED`).
4. **Trust boundary (§54.2)** — a `SECRET`/`PII` resolves/seeds only inside a *proven* (`0700`, owner-only) vault dir.
5. **Root of trust = the vault master key** (a `0600` key file / `$DELIVERYOS_VAULT_KEY_B64` / macOS Keychain), NOT a platform token.

## Provider roles
| Plane | Role | Mechanism | Honesty note |
|---|---|---|---|
| `vault` | **read+write (source of truth)** | AES-256-GCM at rest (zero-dep `node:crypto`), `0600` files | the only readable store |
| `vercel` | **write-only (push) + presence** | `POST /v10/projects/{id}/env?upsert=true` `type:sensitive` | Sensitive ⇒ never a read source |
| `github` | **write-only (push) + presence** | `gh secret set <KEY> --body -` (stdin; gh does the sealed box) | write-only by design |
| `supabase` | **read origin (seed)** | Management API (PAT) | **documented-only**: legacy JWT secret not cleanly readable → one-time manual seed |
| `generated` | **mint-on-seed** | `node:crypto` randomBytes per `validation_rule` | — |

## Registry extension
Each key gains (all optional, i-config ignores them): `retrieval_source` (`supabase|generated|manual|vault` —
where the value ORIGINATES when seeding, distinct from `source_provider` = the consumption plane),
`sensitive` (`true` ⇒ write-only plane, push-only), `consumers` (extra push targets),
`supabase_project_ref`.

## Real vs. documented
- **Real & proven (mocked providers):** the whole seed→resolve→push→refuse matrix — seed
  (generated/manual, + a mocked supabase hook), resolve from the vault, encryption-at-rest, push to
  mocked vercel+github sinks, the never-log guarantee, the `NOT_SEEDED` "no fake pull", the
  trust-boundary gate, the `0600` leak guard, unknown-key + missing-master-key typed refusals, and
  the CLI stdout-only emission. Self-test 9/9 + independent proof 23/23.
- **Real but not exercised live in-repo:** the actual Vercel push (`POST …/env`) and GitHub push
  (`gh secret set`) — implemented against the documented shapes; run the node/CI smoke from the
  runbook, they are not called with a live token in tests.
- **Documented-only:** the Supabase **Management API** seed path (legacy JWT secret isn't cleanly
  returned; the resolver refuses honestly and points at the one-time manual seed).

## Lifecycle — auto-renewal, rotation-safety, and the Supabase-decoupling seam
A long-running consumer (the Slack control-surface adapter) presents a bounded-TTL HS256 service
token (`GOALS_API_TOKEN`). Three lifecycle guarantees keep it from ever going stale or manual:
- **Auto-renewal** — `scripts/renew-service-token.mjs` (on a launchd/systemd timer;
  `templates/ops/com.deliveryos.token-renewer.plist` / `…timer.md`) re-mints the token from the
  vault-held signing key when it is within a threshold of expiry, and writes it back to the vault.
  No manual re-issuance ever.
- **Rotation-safety** — with `--probe`, the renewer detects a `401` from the engine (root rotated at
  origin), re-syncs the root and re-mints; if the re-sync is impossible it **fails closed and alerts**
  (never keeps a dead/faked token).
- **Dedicated service-signing key (seam)** — `SERVICE_SIGNING_KEY` (origin `generated`, vault-only,
  rotatable) is a node-controlled HS256 key the renewer prefers over `AUTH_JWT_SECRET`. Follow-on
  **engine** change (design note, not implemented): verify `aud=service` tokens with this second key
  in parallel, so machine automation is independent of Supabase's user-key (asymmetric-migration)
  lifecycle. The vault/registry are already shaped for it.

## Governance
Status `candidate` — holding, retrieving, and pushing secret values is security-sensitive; enable on
**earned trust, not existence** (`ku-enable-capabilities-on-trust-not-existence`). Security review
required (`ku-sensitive-changes-require-security-review`). Promotes after an independent VERIFY + a
live push smoke on a non-secret key.
