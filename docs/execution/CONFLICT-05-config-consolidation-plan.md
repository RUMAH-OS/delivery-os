# CONFLICT-05 — Config & Secret Registry consolidation + adoption plan

**Sprint:** 1.2 — Single Config & Secret Registry + I-Config oracle
**Spec:** RS-DOS-v1 §57.2 (canonical registry) · §57.4 (`I-Config` oracle) · §54.1/§54.2 (data_class + trust boundary)
**Status:** FIRST SLICE BUILT in delivery-os (the project-agnostic source). This document is the **follow-on adoption plan** for migrating rumah-admin + property-lead-os onto the canonical schema. It is a plan, not yet executed — per Sprint 1.2 scope (the registry + oracle ship here; the two repos adopt in follow-on slices).

> **Independent-verifier note (Sprint 1.2 DoD).** The validation criterion is: *every key from both legacy
> registries is present in the canonical one with identical schema/validation; 100% read-agreement over a sample.*
> This plan provides the field-by-field mapping the auditor checks against. The hand-authored canonical registries
> (step 2 per repo) are the artifact the auditor diffs against the legacy ones — NOT the auto-normalized in-memory
> form (which infers `data_class` and must be human-confirmed; see "The inference caveat").

---

## 1. What was built in this slice (delivery-os — the canonical source)

| Artifact | Path | Role |
|---|---|---|
| Canonical schema | `templates/tools/config-secret-registry.schema.json` | THE one registry schema (metadata only; §57.2). Supersedes both legacy shapes. |
| Worked example | `templates/tools/config-secret-registry.example.json` | Every field + every `data_class`; the migration reference. |
| I-Config oracle | `templates/tools/i-config.mjs` | The sole readiness oracle. `PRESENT/MISSING/INVALID/DRIFTED` over the live planes. Reads canonical OR legacy (auto-normalized) during the dual-read window. Report-only by default. |

The oracle **never reads or prints a secret value**: remote planes (Vercel/GitHub) are checked presence-only; the
local plane (inside the §54.2 trust boundary) may read a value to apply its `validation_rule` but the value is
held transiently and never emitted (the self-test asserts a planted secret never appears in the report). The
legacy `config-doctor.mjs` is **slated for retirement behind `i-config.mjs`** once both repos adopt (step 4).

---

## 2. The two legacy systems being consolidated

| Legacy system | Repo | Shape |
|---|---|---|
| `infra/config-registry.json` + `infra/config-doctor.mjs` | rumah-admin | declarative JSON registry + a manual loader/validator (the seed `config-doctor`). 10 keys. |
| `infra/config-registry.json` | property-lead-os | the SAME declarative JSON shape (14 keys), derived from the Zod schema below. |
| `packages/config/src/env.ts` | property-lead-os | a **Zod** `envSchema` — the runtime boundary validator (~90 keys: required + optional + defaults + `.url()`/`.min()`/`.enum()`/`coerce.number`). |

CONFLICT-05 = **two registries + two validators** expressing config truth in two incompatible idioms. The
canonical schema is designed to be a faithful **superset** of both.

---

## 3. Field mapping — legacy JSON registry → canonical

The admin/PLOS `config-registry.json` entry shape maps field-for-field:

| Legacy field | Canonical field | Transform |
|---|---|---|
| `name` | `key` | verbatim |
| `owner` ∈ {`vercel-env`,`supabase`,`github-secret`} | `source_provider` ∈ {`vercel`,`supabase`,`github`} | `vercel-env→vercel`, `supabase→supabase`, `github-secret→github` |
| *(none — `owner` was overloaded as the provider)* | `owner` (accountable human/team) | **NEW field — author by hand** (e.g. `platform`, `founder`). §57.2 separates accountable owner from source plane. |
| *(none — implicit in `rule`/`name`)* | `data_class` ∈ {PUBLIC,INTERNAL,CONFIDENTIAL,PII,SECRET} | **NEW field — author by hand** (§54.1). The oracle's auto-normalizer INFERS it conservatively (`secret-min:*`→SECRET, `github-secret`→SECRET, name matches token/secret/key/jwt→SECRET, else INTERNAL) and flags `data_class_inferred:true` — the hand-authored registry must confirm/correct each one. |
| `required` keys (the env names) | `env_scope` | the set of envs the key appears under; `development→dev`, `production→prod` |
| `rule` | `validation_rule` | verbatim id (`postgres-pooler-6543`, `url`, `secret-min:N`, `enum:…`, `flag`, `non-empty`) |
| `required` (`{development,production}→bool`) | `required_per_env` (`{dev,prod}→bool`) | env names normalized |
| `purpose` | `purpose` | verbatim |
| `example` | `example` | verbatim (already redacted) |
| `fix` | `fix` | verbatim |
| `platforms.{vercel,github}` (registry root) | `planes.{vercel,github}` | renamed; same contents |
| *(none)* | `schema_version: "config-secret-registry/v1"` | **add** — marks the canonical registry so the oracle reads it natively (no normalization) |

### The inference caveat (auditor must check)
Auto-normalization is provided ONLY so both repos keep working during the dual-read window (the oracle reads a
legacy file unchanged). It **infers `data_class`**, which is lossy — e.g. `DATABASE_URL` (rule
`postgres-pooler-6543`, name has no secret-token substring) infers `INTERNAL`, but a Postgres connection string
carries a password and is in truth a **SECRET**. The hand-authored canonical registry MUST set the correct
`data_class` for every key. The `?` suffix in the oracle's human output (`SECRET?`/`INTERNAL?`) marks an inferred
class — zero `?` after migration is a completion signal.

---

## 4. Field mapping — PLOS Zod schema (`env.ts`) → canonical

The Zod schema is the richest source. Each Zod field becomes (or confirms) one canonical key:

| Zod construct | Canonical mapping |
|---|---|
| `z.string().url()` | `validation_rule: "url"` |
| `z.string().min(N)` (secret) | `validation_rule: "secret-min:N"`, `data_class: SECRET` |
| `z.enum([a,b])` | `validation_rule: "enum:a\|b"` |
| `z.coerce.number()` / `.int().nonnegative()` | `validation_rule: "number"` / `"int-nonneg"` |
| `.optional()` | `required_per_env[env]: false` for the relevant envs |
| `.default(x)` | `default: "x"` (recorded as metadata; the oracle does not apply it — it reports readiness, it does not load config) |
| the doc-comment above each key | `purpose` |
| OAuth/JWT/token/key fields (`*_SECRET`, `*_TOKEN`, `*_KEY`, `MAILBOX_TOKEN_ENC_KEY`, `GOOGLE_DWD_SA_KEY`) | `data_class: SECRET` |
| personal-email fields (`GMAIL_SENDER`, `MAILBOX_OWNER(S)`, `*_SEND_MAILBOX`) | `data_class: PII` (§54.2 — never copied into a non-prod env) |
| model/tunable/URL/flag fields (`A2_MODEL`, `*_INTERVAL_MS`, `ADMIN_*_URL`, `DISCOVERY_ENABLED`) | `data_class: PUBLIC` or `INTERNAL` |

**Source-of-truth rule after migration:** the canonical `config-secret-registry.json` is the single declaration
of *which keys exist, their class, scope, and validation*. `env.ts` (Zod) remains the **runtime loader/parser**
(it still parses `process.env` into typed config at boot) but stops being a second *declaration of requiredness* —
its required/optional posture is derived to agree with the registry (verified by the read-agreement check). The
oracle does not replace Zod's load step; it replaces the *remembered* readiness check with an *enforced* one.

---

## 5. Per-repo adoption (follow-on slices — NOT this slice)

### 5a. rumah-admin
1. Vendor `i-config.mjs` + `config-secret-registry.schema.json` from delivery-os `templates/tools/` into `infra/` (the existing os-sync path).
2. Hand-author `infra/config-secret-registry.json` (canonical) from the 10-key legacy registry using the §3 mapping; set the correct `owner` + `data_class` for each (confirm the inferred ones — esp. `DATABASE_URL`→SECRET, `AUTH_JWT_SECRET`→SECRET, `CRON_SECRET`→SECRET, `PUBLIC_BASE_URL`→INTERNAL, `PROD_BASE_URL`→INTERNAL, `PROD_SMOKE_TOKEN`→SECRET).
3. Auditor diffs canonical vs legacy: every key present, identical `validation_rule` + `required_per_env`; run `i-config --registry infra/config-secret-registry.json --env prod --json` and `--registry infra/config-registry.json` and confirm 100% verdict agreement on a sample.
4. Repoint the deploy gate + Founder Action Package generation from `config-doctor.mjs` to `i-config.mjs --enforce` (this is the Sprint 1.3 gate-binding; until then `i-config` runs report-only alongside the existing `config-doctor`).
5. Delete the legacy `config-registry.json` + retire `config-doctor.mjs` only after step 4 is green (anti-dual-read close).

### 5b. property-lead-os
1. Vendor `i-config.mjs` + schema as in 5a.
2. Hand-author `infra/config-secret-registry.json` (canonical) merging BOTH sources: the 14-key legacy registry (the prod-operational contract) AND the Zod schema (the full key set + `data_class`/`default` detail per §4). The canonical registry should enumerate every key that blocks or breaks an environment; pure model/tunable knobs may stay Zod-only with `default`s (record them with `data_class: PUBLIC` + `required_per_env:false` if enumerated).
3. Keep `packages/config/src/env.ts` as the runtime parser; reconcile its required/optional posture to the registry (the read-agreement check is the gate).
4. Auditor diff + read-agreement as in 5a (sample: DATABASE_URL, SUPABASE_JWT_SECRET, TICK_TOKEN, CRON_SECRET, ANTHROPIC_API_KEY, VERCEL_*).
5. Repoint deploy gate to `i-config --enforce` (Sprint 1.3); retire the legacy registry after green.

### 5c. delivery-os (self-host)
The canonical schema + oracle live here already. When the framework grows its own runtime config, it declares a
`config-secret-registry.json` and runs `i-config` in its own pre-push gate (the dogfood path).

---

## 6. Scope boundaries (what this slice does NOT do)

- **No gate enforcement.** `i-config` defaults to report-only; wiring it as a fail-closed precondition into C9
  (pre-flight) / D7 (deploy) / C13 (startup) is **Sprint 1.3** (§57.5). The `--enforce`/`--enforce-drift` flags
  prove the capability exists; nothing consumes them yet.
- **No capability requirements.** `requires_config`/`requires_secret` on capability descriptors (§57.3) is Sprint 1.3.
- **No I-LegacyGuard standing detections** (tree-secrets / bypass kill-switch / drift / duplicates — §57.6) — Sprint 1.3.
- **No drift auto-remediation** — explicitly out of scope (evidence-only, §50). The oracle *reports* DRIFTED; it never fixes.
- **Value-level drift** (live value ≠ a registry-pinned fingerprint) is **designed but deferred** — it needs live
  planes + a fingerprint-pinning mechanism, and is not asserted here to avoid a false-open. The DRIFTED verdict
  shipped in this slice is **env-scope drift** (a key present on a plane outside its declared `env_scope`, e.g. a
  local-only SECRET found on the prod plane — a real §54.2 trust-boundary signal) plus **registry-vs-plane drift**
  (undeclared keys present on a live plane, surfaced in `report.drift[]`).

---

## 7. Verification evidence (this slice)

- `node templates/tools/i-config.mjs --self-test` → **32/32 pass** (offline). Proves the four verdicts via the
  full `evaluateKey()` path with injected planes: PRESENT (required+valid), MISSING (required+absent), INVALID
  (rule-fail), DRIFTED (out-of-scope SECRET on the prod plane); the **no-secret-values guarantee** (a planted
  secret never appears in the serialized report); and **legacy→canonical normalization** (name→key, provider map,
  env map, data_class inference, required_per_env).
- `i-config --registry <admin legacy> --env prod` and `<plos legacy>` → both normalize and report (10 / 14 keys).
- Live DRIFTED demonstrated: a local-only SECRET planted at `--env prod --include-local` → `DRIFTED` with the
  §54.2 trust-boundary detail.
- `--enforce` → exit 1 on required MISSING; report-only default → exit 0.
