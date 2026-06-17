# Capability Manifest Standard — `*.capability.json` (DRAFT canonical)

> DRAFT — cross-system standard. lead-architect authors; founder ratifies.
> Status: DRAFT canonical. This is the platform's ROOT primitive (P1 / hop H1 / the #1 ranked gap in
> `PLATFORM-READINESS-CAPABILITY-EXPOSURE-2026-06-17.md`). Proven on Admin's OWN capabilities first
> (admin-first-proof-directive); PLOS and future systems DECLARE later, never as part of this build.

## 1. What this is (and what it is NOT)

A **Capability Manifest** is a small, machine-readable, declarative file — `*.capability.json` — that a
system **co-locates with its capability in its own repo** to DECLARE that capability to the platform. It is
the single mechanism by which any system (admin, plos, founder-os, delivery-os) says *"this capability
exists, here is who owns it, here is its state, and here is each of its five facets."*

It exists so the platform can, generically and without bespoke per-capability code:
- **discover** what capabilities exist across systems (hop H2),
- **render** them on the Delivery OS UI (hop H3),
- **invoke** them uniformly / via Jarvis (hop H4),
- **inherit** their skill+wiki+contract+events bundle (hop H7).

It is the **single source of capability provenance**. It SUPERSEDES the ad-hoc `OS-owned` / `vendored` /
`canonical` header comments that several Admin tools carry today. Where a file's header and its manifest
disagree about a capability's home/ownership, **the manifest wins** and the header is the bug.

**This standard is NOT:**
- the **OS inherit-list** (`os-foundation.manifest.json`). That file lists the byte-vendored set every
  project pulls via `os-inherit`. A capability manifest is a *cross-system catalog entry with five facets*,
  not an inheritance instruction. A capability MAY be both registered (here) and inherited (there); they are
  orthogonal concerns with different lifecycles.
- a **hand-maintained markdown table** (`06-source-of-truth-registry.md`, `CAPABILITY-LEDGER.md`). Those are
  prose a human edits. A manifest is declared once, co-located, and read by a tool — it removes the human
  from the discovery loop.
- a **promotion / relocation** mechanism. Declaring a capability does not move it. Promotion (giving a
  capability a canonical home in delivery-os) is a separate, later step.

## 2. The five facets a complete capability declares

A capability is COMPLETE only when it has all five facets (each reachable through a seam, not merely a file).
The manifest declares each facet's **reference, or explicit `null`** when the capability genuinely lacks it.
Honest `null` is a deliverable: it is how the platform answers *"which capabilities have which facets."*

| Facet | Field | Meaning | `null` means |
|---|---|---|---|
| (a) Contract / interface | `facets.contract` | a versioned, machine-checkable interface (schema + conformance) | no declared interface |
| (b) Events | `facets.events` | the business event types it emits on the outbox (frozen vocabulary) | emits nothing |
| (c) Delivery OS UI surface | `facets.ui` | a founder-facing DOS surface answering what-happened / is-it-done | no UI surface (true for almost all today — there is no DOS-UI mechanism yet) |
| (d) Skill | `facets.skill` | a routable, cited execution procedure | no skill |
| (e) Wiki | `facets.wiki` | a routable KU (claim / trap / why / rollback) | no KU |

`facetCompleteness` (e.g. `2/5`) is **DERIVED, never stored** = the count of the five facets that are
non-null. Storing it would let it drift from the refs; the registry computes it at scan time.

> **'Complete' has two layers: the manifest declares FACET-completeness (5/5 facets present) + `status` (…|promoted); PROPAGATION/inherited state is NOT a manifest field — it's the registry/os-inherit check's job. The CAPABILITY-FRAMEWORK-SUFFICIENCY 'complete capability' = facet-complete AND promoted AND inherited. The manifest covers the first two.**

> **`facets.ui`, when built, is a DATA-contract `{kind, dataContract, route}` where `dataContract` points at an authenticated read-seam endpoint returning a typed view-model the Delivery OS shell renders — NEVER a component reference (a DOS shell cannot import another system's component). The full inner shape is finalized WHEN the DOS UI shell is built (Waterline); this constraint only locks the data-driven intent now.**

## 3. Schema — `*.capability.json`

A single JSON object. Required fields are marked. Unknown extra fields are allowed (forward-compatible) but
SHOULD be avoided.

```jsonc
{
  // --- identity & provenance (all required except version) ---
  "id":          "knowledge-harvester",        // REQUIRED. stable kebab-case id, unique across systems.
  "name":        "Knowledge Harvester",        // REQUIRED. human label.
  "description": "Report-only scanner that ...",// REQUIRED. one honest sentence.
  "ownerSystem": "admin",                       // REQUIRED. enum: admin | plos | founder-os | delivery-os
  "status":      "built",                       // REQUIRED. enum: candidate | built | verified | promoted
  "version":     "v1",                          // optional. capability version (default "v1" if omitted).

  // HONEST provenance — the truth the os-inherit / "OS-owned" headers should reflect.
  // This is the single source of where the capability ACTUALLY lives right now.
  "home": {
    "repo": "rumah-admin",                      // REQUIRED. the repo the capability lives in TODAY.
    "path": "scripts/knowledge-harvester.mjs"   // REQUIRED. repo-relative path to the capability's entry file.
  },

  // --- the five facets (every key REQUIRED; value is a ref-or-null) ---
  "facets": {
    "contract": null,                           // path (repo-relative) | { ref } | null
    "events":   null,                           // array of event-type strings | null   (e.g. ["invoice.generated"])
    "ui":       null,                           // a DOS UI surface ref | null           (null today for ~all)
    "skill":    null,                           // a skill ref (id or path) | null
    "wiki":     null                            // a KU ref (kuId or path) | null
  },

  // --- how the platform / Jarvis calls it (required) ---
  // The invoke descriptor is now an INTERFACE, not merely a LOCATOR. kind+ref say WHERE the
  // capability lives; the EXTENDED fields (all OPTIONAL except sideEffect-when-invocable) say
  // HOW to call it safely — the command-seam primitive (Waterline). A generic invoker
  // (capability-invoke.mjs) plans/gates/executes purely from THIS descriptor — no bespoke
  // per-capability integration.
  "invoke": {
    "kind": "cli",                              // REQUIRED. enum: cli | http | event | none
    "ref":  "node scripts/knowledge-harvester.mjs", // REQUIRED unless kind==="none"; then null/omitted.

    // --- EXTENDED invocation interface (Waterline command-seam) ---
    "input":  null,                             // optional. arg schema: an inline shape { name:{type,required?} } | a "$ref" path | null
    "output": null,                             // optional. a schema ref (path) or inline shape describing the result | null
    "sideEffect": "read",                       // REQUIRED WHEN INVOCABLE (kind ∈ {cli,http,event}). enum: read | write | outward
    "idempotent": true,                         // optional bool. true = calling twice is safe (no extra effect).
    "observability": null,                      // optional. { outcome: "<how the outcome is observed>" } — a health ref / delivery callback / event | null
    "errors": null                              // optional. an error-taxonomy ref (path) OR an inline list of declared error codes/labels | null
  },

  // --- health probe (required key; null when none) ---
  "health": null                                // a health ref (path/endpoint) | null
}
```

### 3.1 Field rules
- `id` — kebab-case `[a-z0-9-]+`, globally unique across all manifests the registry scans.
- `ownerSystem` ∈ `{admin, plos, founder-os, delivery-os}`. Unknown value = validation FAIL.
- `status` ∈ `{candidate, built, verified, promoted}` (the capability ladder; `verified` = author≠verifier
  passed; `promoted` = it has a canonical home in delivery-os). Unknown value = validation FAIL.
- `home.repo` + `home.path` — both required, both strings. `path` is repo-relative, forward-slashed.
- `facets` — the object MUST be present and MUST contain all five keys. A missing key = FAIL. A facet ref
  (contract / ui / skill / wiki path-style) that points to a file the registry can resolve but that does NOT
  EXIST is flagged (drift). `events` is an array of strings or `null`.
- `invoke.kind` ∈ `{cli, http, event, none}`. `invoke.ref` required unless `kind === "none"`.
- **`invoke.sideEffect`** ∈ `{read, write, outward}` — **REQUIRED when the capability is invocable** (`kind ∈ {cli, http, event}`); omitted/ignored only when `kind === "none"`. Honest classification:
  - `read` — observes state; mutates NO domain / persistent BUSINESS state (DB records, invoices, contracts, signatures) and affects nothing outside. A read capability MAY still write its OWN log / report / catalog / citation artifacts (e.g. a router's ranked-KU report or a harvester's catalog) — these are observability outputs, not domain writes, and are excepted. SAFE to call. The invoker MAY proceed. (This is why caps like knowledge-route / dispatch-route / knowledge-curator / knowledge-harvester are honestly `read` despite emitting their own log/report artifacts — they are not the `write` gate's concern, which is domain state.)
  - `write` — mutates persistent state (DB / records). HUMAN-GATED.
  - `outward` — sends to / affects the outside world (email, an external API, another system). HUMAN-GATED.
  An unknown `sideEffect` value, or its absence on an invocable capability, is a validation FAIL.
- **`invoke.input`** — optional. Either an inline shape `{ <argName>: { type, required? } }` (type ∈ string|number|boolean|object|array) the invoker validates args against, OR a `$ref`-style path to a schema, OR `null` (no declared input — any args pass through unvalidated).
- **`invoke.output`** — optional schema ref/inline shape or `null`. Declares the expected result shape (surfaced in the plan; not enforced).
- **`invoke.idempotent`** — optional bool. Surfaced so a caller knows whether a retry is safe.
- **`invoke.observability`** — optional `{ outcome: "<string>" }` or `null` — how the outcome of a call WOULD be observed (a health ref, a delivery callback, an emitted event). Surfaced in the plan.
- **`invoke.errors`** — optional. A path ref to an error taxonomy OR an inline array of declared error codes/labels OR `null`. Surfaced in the plan.
- NOTE: **`invoke.kind:"none"` means not-platform-invocable** (no command-seam endpoint — reached implicitly / via a deep link). `sideEffect` is not required for `none`.

### 3.1.1 The human-gate rule (by construction — SAFETY-CRITICAL)
The invocation interface encodes the founder's gate (D2 / ADR-006/007): **all outbound/write actions are human-approved.** This is enforced BY THE INVOKER, not merely documented:
- `sideEffect: "read"` → invocation MAY proceed (it is safe to observe).
- `sideEffect: "write"` or `"outward"` → invocation REQUIRES an explicit human approval token. Without it the invoker returns a `GATED: requires human approval` plan and executes **nothing**.
The default invoker mode is **describe / dry-run**: it returns the planned call + gate status and executes nothing. Live execution is a strictly-limited, explicit-flag opt-in (see the generic invoker tool). A capability declaring `write`/`outward` can therefore be DESCRIBED freely (the plan is safe) but never EXECUTED without approval — `sideEffect` honesty is what makes the gate trustworthy.

**Approval-token scope (N2).** The current `--approve` flag is **presence-only**: any non-empty value lifts the GATE from `GATED`→`describe`. It is NOT a verified/authenticated approver identity and is NOT audit-logged. This is safe today only because the live lane NEVER executes `write`/`outward` (the live allow-list is `cli + read + admin` with a node-script ref under the repo root), so a present-but-unverified token can never cause an effectful execution — at most it flips a plan to describe-only. **Any future live `write`/`outward` (or outward HTTP) lane MUST bind `--approve` to a verified approver identity and an audit-log entry before it may execute.**
- `health` — a ref or `null`.

### 3.2 Where the file lives
A system co-locates manifests under a conventional dir so the registry can find them. Admin uses
`rumah-admin/.claude/capabilities/<id>.capability.json`. Any path matching `**/*.capability.json` inside a
scanned root is discovered, so a system MAY also drop a manifest directly beside its capability.

## 4. Provenance: this supersedes ad-hoc "OS-owned" headers

Several Admin tools (`knowledge-route.mjs`, `dispatch-route.mjs`, `knowledge-harvester.mjs`) historically
opened with a `Delivery OS — …` / `OS-owned / vendored` banner while living **only** in Admin with no
upstream in delivery-os and no entry in `os-foundation.manifest.json`. That banner was a FALSE provenance
claim (the drift documented in `CAPABILITY-FRAMEWORK-SUFFICIENCY-2026-06-17.md` §1).

Under this standard:
- the manifest's `home` is the **single source of truth** for where a capability lives and `status` for how
  far it has travelled the ladder;
- a file header MUST NOT claim `OS-owned` / `vendored` / `canonical home: delivery-os` unless a manifest
  with `ownerSystem: delivery-os` (or `status: promoted` + a delivery-os `home`) backs it;
- the registry's **drift check** flags any file making that claim with no backing manifest, or a manifest
  whose `home` says otherwise — catching exactly this class of lie by construction.

The fix for the current drift is **honest headers pointing at the manifest**, NOT relocation. Relocation is a
later promotion step (P5 / hop H7), gated separately.

## 5. The registry tool (the platform aggregator)

`rumah-admin/scripts/capability-registry.mjs` (proving-ground placement; promotes to delivery-os once
proven, same path the harvester took). Zero-dep ESM, cross-platform, `--json`, `--self-test`,
**REPORT-ONLY** (exit 0 — it informs, it does not gate, for now). It:
1. scans configured roots (default: Admin + delivery-os + ecosystem + PLOS; `--roots` override) for
   `**/*.capability.json`;
2. validates each manifest against this schema (required fields, enum values, facet-ref existence);
3. aggregates into a catalog (`capability-catalog.json`, gitignored/regenerable) with per-capability
   `facetCompleteness` (X/5) and overall stats;
4. runs the **drift check** (false `OS-owned`/`vendored`/`canonical` headers without a backing manifest, and
   facet refs to missing files).

## 6. Lifecycle & sequencing
This is FIRST BUILD of the platform-enablement sequence. Everything downstream (DOS UI surface, command
seam, workflow engine, cross-system health, Jarvis orchestration) operates on **what a capability declares
here**. Per the Waterline rule it is proven on a concrete, already-real set (Admin's own capabilities) before
the schema is generalized. PLOS declares its capabilities here later, post-V6, past the N=1 gate — never as
part of this build.

> DRAFT — founder ratifies. Schema is cross-system-ready; only Admin capabilities are registered today.
