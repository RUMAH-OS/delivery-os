---
kuId: ku-secret-resolution-store-one-derive-all
title: The node's local encrypted vault is the source of truth; platforms are write-only push targets
kind: knowledge
status: active
version: 1
applies-to: [os]
claim: "Secret VALUES cannot be pulled from the platforms this fleet uses — every Vercel env var is a Sensitive (write-only) value the API never returns, and GitHub Actions secrets are write-only by design. So NO platform can be a retrieval source. The secret capability is therefore a LOCAL ENCRYPTED VAULT on the node (inside the §54.2 trust boundary), unlocked by ONE root credential (the vault master key), that is the SOURCE OF TRUTH for values: resolve() reads the vault (offline), seed() puts a value in ONCE from its origin (generated locally, or pasted/read once from Supabase), and push() writes the value OUT to the write-only consuming planes (Vercel Sensitive / GitHub secret) — the direction that actually works. Retrieval is metadata-driven off the canonical registry (refuse undeclared keys), fail-closed (never fabricate or 'pull' a value the vault lacks), honors the trust boundary (a SECRET/PII resolves only inside a proven-tight vault), is honest about write-only planes (refuse, never fake), and emits a value EXACTLY ONCE to stdout — never to a log, error, or committed file. This is the retrieval counterpart of the presence oracle (i-config): same registry, opposite direction, same never-log doctrine."
triggers:
  - "how does a node get a secret it doesn't have"
  - "the config-gate is stalling on a hand-pasted secret"
  - "can we pull the secret from vercel"
  - "why can't we read the vercel/github secret back"
  - "where do the canonical secret values live"
  - "store one derive all"
  - "how do we re-provision a node or fix config drift"
  - "seed a secret / push a secret to the planes"
topics:
  - vault-is-source-of-truth
  - platforms-are-write-only
  - root-of-trust-vault-master-key
  - seed-once-push-out
  - secret-retrieval-fail-closed
  - never-log-the-value
  - trust-boundary-gated-retrieval
evidence-strength: runtime-evidenced
cited-quote: "Delivery OS should have a capability that carries all secrets or knows how to get all secrets — so this never happens again"
source-provenance:
  earned-from: "Founder directive (secret capability) + a live finding: nodes had no way to obtain platform-stored secret VALUES, and all Vercel env vars turned out to be Sensitive (write-only) — so a 'pull from Vercel' resolver is impossible. Corrected to a local-vault-source-of-truth model. Built as templates/tools/secret-resolver.mjs."
  source-file: "capabilities/secret-resolver.capability.json"
  anchor: "provider_roles[] (vault=read+write source-of-truth; vercel/github=write-only push; supabase=read-origin/seed; generated=mint) + requires_secret DELIVERYOS_VAULT_KEY as the single root of trust"
  signal-pattern: null
  ratification-note: "Held at runtime-evidenced: the seed→resolve→push→refuse matrix is proven under MOCKED providers (self-test 9/9, proof 23/23). The live Vercel/GitHub PUSH is implemented against documented shapes but not exercised against a real project in-repo; the Supabase Management API seed is documented-only. Promote to founder-ratified after a live push smoke on a non-secret key + security review."
related:
  - ku-enable-capabilities-on-trust-not-existence
  - ku-sensitive-changes-require-security-review
  - ku-sensitive-audit-append-only-at-the-db
tags: [security, secrets, vault, source-of-truth, write-only-planes, root-of-trust, trust-boundary, fail-closed, platform, i-config]
---

# The local encrypted vault is the source of truth; platforms are write-only push targets

## The claim
You cannot pull secret values from the platforms this fleet uses — every Vercel env var is a
**Sensitive** (write-only) value the API never returns, and GitHub Actions secrets are write-only by
design. So the secret capability is **not a puller**. It is a **local encrypted vault** on the node,
inside the §54.2 trust boundary, that holds the canonical values, unlocked by **one** root credential
(the vault master key).

## Why it holds
- **The vault is the only readable store.** `resolve()` reads it offline — no platform round-trip,
  and no dependence on a value that no API will return.
- **Seed once, push out.** A value enters the vault **once** from its origin (`generated` locally, or
  `manual`/paste from Supabase), and `push()` writes it **out** to the write-only planes — the
  direction that works. That is how config drift is fixed and how new nodes/CI get provisioned.
- **One root of trust.** The vault master key (a `0600` file / env / Keychain) unlocks everything;
  rotate it + re-encrypt to rotate the root. Not a platform token — platforms can't be read anyway.
- **Metadata-driven + fail-closed + never-log.** Refuses undeclared keys; every error is typed,
  non-zero, stdout-silent; **never fabricates or "pulls" a value the vault lacks** (`NOT_SEEDED`); the
  value is emitted exactly once to stdout and never to a log/error/commit.
- **Honest about write-only planes.** A `sensitive` Vercel var / GitHub secret is push-only; the
  resolver says so instead of faking a read.
- **Trust-boundary gated (§54.2).** A `SECRET`/`PII` resolves/seeds only inside a *proven* boundary.

## What it is NOT
Not a puller (platforms are write-only); not a hoard of platform copies (it is the *origin* store);
not enabled because it exists (`ku-enable-capabilities-on-trust-not-existence`) — it stays `candidate`
until it earns trust; retrieval + push are security-sensitive and review-gated.

## Composes with
`i-config` (presence oracle) — same registry, opposite direction. i-config finds `MISSING`/`DRIFTED`
on a plane; `push` fixes it from the vault.
