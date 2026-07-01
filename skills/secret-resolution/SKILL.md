---
name: secret-resolution
version: 1.0.0
stability: experimental
description: >
  Hold, retrieve, and push secrets from a node's LOCAL ENCRYPTED VAULT — the source of truth —
  because every platform store this fleet uses is write-only (all Vercel env vars are Sensitive;
  GitHub Actions secrets are write-only), so no platform can be a read source. The retrieval
  counterpart of i-config: it reads the same canonical registry for each key's plane + data_class +
  retrieval_source; resolve() reads the vault, seed() puts a value in once from its origin, push()
  writes it out to the write-only planes. Refuses undeclared keys, resolves a SECRET/PII only inside
  the §54.2 trust boundary, never fabricates or 'pulls' a value the vault lacks, emits the value
  EXACTLY ONCE to stdout, and NEVER logs it. Fail-closed on every error.
decision_class: security-sensitive
inputs:  [a registry-declared KEY + target env, the canonical config-secret-registry.json, the node-local encrypted vault + its 0600 master key, the value origin (generated / manual-paste / Supabase)]
outputs: [the secret value on stdout ONLY (get), a vault entry (seed), or a write to the consuming planes (push) — each with a name-only audit line; or a typed fail-closed refusal]
earned_from: "Founder directive: 'Delivery OS should have a capability that carries all secrets or knows how to get all secrets — so this never happens again' + a live finding that ALL Vercel env vars are Sensitive (write-only), which makes a 'pull from Vercel' resolver impossible and forces a local-vault-source-of-truth model. Occasioning reality: go-live and the CI config-gate kept stalling on a hand-pasted secret. Promotes to verified after an independent QA run of the seed/resolve/push/refuse matrix (mocked providers) + a live push smoke on a non-secret key."
mechanical_spine: "templates/tools/secret-resolver.mjs — the zero-dep vault lib + CLI (fs, crypto, fetch, child_process[gh push]). This skill is its human-readable half. Effects: read (get/plan), write-vault (seed), write-plane (push); it never commits a secret and never enables an undeclared key."
# --- v6 frontmatter fields (capability-routable; per skill-frontmatter.mjs #6) ---
kind: execution
capabilities: [resolve-secret-from-vault, seed-secret-into-vault, push-secret-to-planes, gate-secret-by-trust-boundary, refuse-write-only-read]
triggers:
  - "get the secret value"
  - "the config-gate is stalling on a hand-pasted secret"
  - "can we pull the secret from vercel"
  - "seed a secret into the vault"
  - "push the secret to vercel/github"
  - "re-provision a node with the secrets"
  - "why can't we read the sensitive var back"
  - "store one derive all"
hooks:
  pre: []
  post: []
---
# Secret Resolution (v1.0 — v6 execution skill)

## Overview
Secret VALUES live only in platform stores — and in this fleet **every one is write-only**: all
Vercel env vars are **Sensitive** (the API never returns them) and GitHub Actions secrets are
write-only. So you **cannot pull** a value from a platform, and go-live / the `config-gate` kept
stalling waiting for a human to paste one. This skill is the capability that ends that: the node
keeps a **local encrypted vault** (the source of truth) unlocked by **one** root credential, reads
values from it, and **pushes** them out to (re)provision the write-only planes. It is the retrieval
counterpart of **i-config** and honors the same doctrine, deliberately stricter (it handles values).

## Doctrine (load-bearing)
1. **Vault = source of truth** — platforms are write-only; the only readable store is the local
   AES-256-GCM vault inside the §54.2 trust boundary.
2. **Metadata-driven** — reads the registry for each key's plane + `data_class` + `retrieval_source`;
   **refuses undeclared keys**.
3. **Never log a value** — emitted exactly once, to stdout, nowhere else; audit = name + time +
   verdict.
4. **Fail-closed** — typed error + non-zero exit + nothing on stdout; **never fabricate or "pull" a
   value the vault lacks** (`NOT_SEEDED`).
5. **Trust boundary (§54.2)** — a `SECRET`/`PII` resolves/seeds only inside a *proven* `0700`
   owner-only vault.
6. **Root of trust = the vault master key** (a `0600` file / `$DELIVERYOS_VAULT_KEY_B64` / Keychain).

## Provider roles
| Plane | Role | Note |
|---|---|---|
| `vault` | **read+write (source of truth)** | AES-256-GCM at rest, `0600` files, `0700` dir |
| `vercel` | **write-only (push) + presence** | Sensitive ⇒ never a read source |
| `github` | **write-only (push) + presence** | `gh secret set` handles the sealed box |
| `supabase` | **read origin (seed)** | documented-only; default = one-time manual seed |
| `generated` | **mint-on-seed** | `node:crypto` per `validation_rule` |

## Process (when invoked, do this)
1. **Locate the key** — `plan <KEY> --env <env>` (origin + push targets, no value). Not in the
   registry ⇒ declare it first, don't retrieve it.
2. **Ensure the vault + boundary** — `vault-init` once (a `0700` dir + `0600` master key). A loose
   vault ⇒ a `SECRET`/`PII` is REFUSED, and that is correct.
3. **Seed the value ONCE** from its origin: `seed <KEY> --from generated` (mint) or
   `--from manual` (paste at the silent stdin prompt — the honest default for Supabase/write-only
   origins).
4. **Retrieve into a consumer**, never into a file or log:
   ```bash
   AUTH_JWT_SECRET="$(node templates/tools/secret-resolver.mjs get AUTH_JWT_SECRET --env prod)" \
     node scripts/mint-service-token.mjs --sub svc-neo --ttl 900
   ```
5. **Push out** to (re)provision or fix drift: `push <KEY> --env prod --to vercel,github`.
6. **On any refusal, read the typed exit code** (2–8) and fix the *cause*; never work around the gate.
Bootstrap + verify-without-exposure: `docs/BOOTSTRAP-secret-resolver.md`.

## Red flags (stop and refuse)
- "Just pull it from Vercel" / "read the sensitive var back" — impossible; it is write-only. Seed the
  vault instead.
- Being asked to print a secret to a log / message / file, or to store platform copies as the origin.
- Resolving/seeding a `SECRET`/`PII` on a host whose vault is not `0700`/owner (outside the boundary).
- Faking a value for a write-only plane or an un-seeded key so a script "passes".
- Adding an undeclared key to the *code* to touch it, instead of declaring it in the registry.

## Verification (of this skill's own output)
Run the mechanical spine's proofs — they must be green before trusting the vault:
`node templates/tools/secret-resolver.mjs --self-test` (9/9) and
`node templates/tools/secret-resolver.test.mjs` (23/23, mocked providers). The independent VERIFY is
`docs/verify/VERIFY-secret-resolver.md`. A live push smoke (non-secret key) is in the runbook. If any
proof is red, the capability is NOT trustworthy — do not resolve or push.

## Changelog
- v1.0.0 (2026-07-01) — initial: local-encrypted-vault-source-of-truth model (platforms are
  write-only). Verbs seed/get/push; vault AES-256-GCM (zero-dep); generated/manual origins + mocked
  supabase seed; vercel/github push sinks; trust-boundary gate; never-log + no-fake-pull guarantees.
  Earned from the founder secret-capability directive + the all-Vercel-vars-Sensitive finding.
