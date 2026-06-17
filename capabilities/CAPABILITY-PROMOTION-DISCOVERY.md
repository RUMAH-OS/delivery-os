# Capability Promotion & Discovery — the meta-capability (v2 — §11 conditions applied)

> **v2 — §11 conditions applied.** DRAFT — lead-architect authors; founder ratifies. **Not self-certified.**
> DESIGN-ONLY (founder said "before proceeding"): no build, no scripts, no file moves, no manifests created in
> this pass. The §11 panel (reviewer-critic · security-compliance · knowledge-engineer · api-integration)
> returned **RATIFY-WITH-CONDITIONS 4/4**; this revision applies them.
>
> ### Changelog v1 → v2 (which §11 condition each edit satisfies)
> | # | Change | §11 condition |
> |---|---|---|
> | C-A | **Central inversion adopted** (THE ONE INVERSION below): internal catalog is rich; the cross-system seam is a deliberately impoverished, **promoted-only + PII-asserted MINIMIZED projection**. `discloseLevel` distinct from `scope`. Collapses several findings into one rule. | SEC-2 |
> | C-B | **PII fail-CLOSED by construction:** new manifest `pii: true\|false\|unknown` field (+ optional `seamValidator` ref reusing the ECR-0007 enforcing pattern). Classifier DEFAULTS to NOT-shared; `scope:shared` reachable ONLY on an affirmative machine-checkable PII-free assertion; silence/unknown ⇒ `shared-blocked:pii`. No catalog PII before ADR-007 ACCEPTED. | SEC-1 |
> | C-C | `GET /v1/capabilities` requires a dedicated **`capabilities:read`** scope; never public. Seam serves ONLY `status:promoted` + CODEOWNERS-verified entries; `ownerSystem` cross-checked vs repo/CODEOWNERS owner, fail-closed on mismatch. Dedup re-labelled an anti-fragmentation **HINT**, not an authenticity control. | SEC-3, SEC-4 |
> | C-D | **Capability Reference materialized as a routable KU** (KU.md + KU frontmatter in the knowledge-route corpus; triggers from domain-nouns/events, topics from facets; generated/narrative split lives INSIDE the KU body). Struck the unbacked present-tense "discoverable via knowledge-route" claim; added the proof bar. One-row EDITs flagged + made to `V6-KNOWLEDGE-SYSTEM.md §3.1` + `KNOWLEDGE-ARCHITECTURE.md §1`. | KNOW-5, KNOW-6 |
> | C-E | Dedup re-labelled: **reuses the Curator's CLUSTERING MACHINERY (connected-components)** with a NEW capability-match signal, report-only until precision-proven — not "the Curator's heuristic." Narrative inherits the CITATION ceiling + author≠verifier re-review; drift-by-hash proves staleness-SURFACED, not narrative-correct. | KNOW-7 |
> | C-F | **Capability versioning designed FIRST:** identity = `(id, version)`; catalog keys on the tuple; dedup clustering scoped WITHIN a version line; added `deprecates`/`supersededBy`/`deprecatedAt`. | API-8 |
> | C-G | Declared a **`catalog-entry-v1` contract** (the response body) DISTINCT from the manifest schema, with every field + the empty/200-vs-4xx contract. | API-9 |
> | C-H | ECR-0008 sharpened: `limit` + deterministic cursor; `catalogVersion` vs per-entry `capability.version`; versioned ranker `?ranker=v1`; **dedup gate SPLIT** (exact `facets.events` overlap MAY enforce; fuzzy jaccard/fingerprint stays report-only-with-human-adjudication until a precision bar passes on Admin's real 10 caps; `*-send` PLOS caps = known-non-dup test set). | API-10 |
> | C-I | **Cross-repo staleness surfaced:** each entry stamped `observedAt` + `sourceCommit`; seam serves the PINNED canonical catalog (not the live local cache); PLOS rows = "Admin-observed snapshots," not live PLOS truth. | API-11 |
> | C-J | **Section A reconciled** against the founder-RATIFIED `CAPABILITY-LIFECYCLE.md` (2026-06-15) — proven ORTHOGONAL (cross-PROJECT promotion-via-census vs within-project promotion-to-shared); cite, do not create a 3rd list. | CRIT-12 |
> | C-K | Roadmap softened: "foundational to the platform SUBSTRATE" but MUST NOT block the Lead-to-Contract product slice; dropped the unsupported "co-first with Entity Resolution" framing; kept the supported dependency-ordering argument. | CRIT-13 |
> | C-L | `contractHash` defined for manifest-only caps (no single executable-contract file). | CRIT-14 |
> | C-GATED | **FOUNDER-GATED, NOT executed:** demoting/retiring `CAPABILITY-LEDGER.md` + `ecosystem-architecture/06-source-of-truth-registry.md` from canonical-discovery-source. Left canonical; consolidation flagged as awaiting founder sign-off. | CRIT-C3 / founder-gate |
>
> **Anti-fragmentation is the governing constraint of this doc.** Everything below EXTENDS an existing
> canonical artifact. Where a doc already owns a concern, I cite it and sharpen it; I do not regenerate it.
> Where two docs overlap I PROPOSE a Curator merge — I do not execute it. This doc is the *consolidating
> index* for promotion+discovery; it must NOT become a third competing lifecycle list.
>
> **THE ONE INVERSION (SEC-2 — adopt this and several findings collapse):** there are TWO catalogs, not one.
> The **internal catalog** is rich (home paths, raw invoke refs, internal dependency edges) and stays inside
> the owning repo. The **cross-system seam** (`GET /v1/capabilities`) is a deliberately *impoverished*,
> *promoted-only*, *PII-asserted*, *CODEOWNERS-verified* MINIMIZED PROJECTION of it — it NEVER emits
> `home.path`/`home.repo`/raw `invoke.ref` or internal dependency edges; it exposes an **opaque invocation
> handle**, not a script path. `discloseLevel` (internal | shareable) is a field DISTINCT from `scope`
> (project | shared | shared-blocked:pii). Read every section below through this split.
>
> **What this capability IS:** the meta-capability that makes a reusable capability *self-promote,
> self-document, self-discover* — so the platform ACCUMULATES reusable capabilities, not just historical
> decisions, with ZERO reliance on a human remembering to write a manifest / registry row / wiki page.
> Founder principle, verbatim intent: *"If a capability is promoted, Delivery OS should enforce promotion
> automatically … Delivery OS should accumulate reusable capabilities, not just historical decisions … part
> of the OS, not a manual habit."*

---

## 0. What ALREADY EXISTS vs what is NET-NEW (read first — anti-fragmentation ledger)

The honest disk state. Inventory Units v1 shipping with no manifest + no wiki is the *symptom*; the table
below is the diagnosis — most of the **discovery** plumbing is BUILT (report-only), but every **promotion**
and **auto-generation** step is a manual hope.

| Concern | State on disk | Evidence (cited) |
|---|---|---|
| Manifest STANDARD (`*.capability.json`, 5 facets, invoke interface, home/provenance) | **DONE (DRAFT canonical)** | `CAPABILITY-MANIFEST-STANDARD.md` |
| Registry aggregator (scan -> validate -> derive facetCompleteness -> catalog -> drift check) | **BUILT (report-only, exit 0)** | `rumah-admin/scripts/capability-registry.mjs` |
| Discoverability layer (query · ranked discover · summary) | **BUILT (report-only)** | `rumah-admin/scripts/capability-route.mjs` |
| Generic invoker (plan/gate/execute from the `invoke` descriptor; describe-default; human-gate by construction) | **BUILT** | `rumah-admin/scripts/capability-invoke.mjs` |
| Jarvis consumption loop (intent -> discover -> select -> plan -> invoke-plan(GATED) -> observe; executes nothing) | **BUILT** | `rumah-admin/scripts/capability-consume.mjs` |
| First DOS UI exposure surface (renders the catalog from manifests alone; no per-cap UI code) | **BUILT** | `rumah-admin/scripts/capability-ui.mjs` -> `docs/capability-exposure.html` |
| 10 real manifests incl. cross-system `observed-plos` | **BUILT** | `rumah-admin/.claude/capabilities/*.json` |
| os-inherit vendoring (single-author -> vendored -> sha-pinned -> drift-gated) | **VERIFIED** | `os-foundation.manifest.json` · `.claude/os/INHERITED.json` · `templates/tools/os-inherit.mjs` |
| Curator clustering: connected-components over a dupCandidate graph (jaccard + titleSimilarity + fingerprint) | **BUILT (report-only, propose-never-merge)** | `rumah-admin/scripts/knowledge-curator.mjs` |
| slice-close already runs registry + capability-route + curator (report-only sections) | **BUILT** | `rumah-admin/scripts/slice-close.mjs` (L192, L213, L231) |
| **Promotion = enforced gate** (a reusable cap MUST be declared/promoted/inherited) | **MISSING (manual hope)** | `CAPABILITY-FRAMEWORK-SUFFICIENCY-2026-06-17.md sec1,sec5` |
| **Auto-generation of facets from the contract** (Reference/Commands/Queries/Events/Consumers/deps) | **MISSING** | Sufficiency sec2 (G6); facets hand-authored |
| **Canonical cross-system capability CATALOG** (queryable, versioned, durable — distinct from the inherit-list) | **MISSING** | `PLATFORM-READINESS...2026-06-17.md` H2; catalog is gitignored/regenerable, not canonical |
| **Capability Reference materialized as a routable KU** (consumption-facing "how to consume"; KU.md + KU frontmatter in the knowledge-route corpus) | **NET-NEW (this doc B) — a KU-shaped generation-class, NOT a new doc store / router** | `V6-KNOWLEDGE-SYSTEM.md sec3.1`; `KNOWLEDGE-ARCHITECTURE.md sec1`; not yet a type — one-row EDIT proposed to BOTH |
| **Stage-2 deterministic reusability trigger — fail-CLOSED by construction** (DEFAULT not-shared; `scope:shared` only on an affirmative machine-checkable PII-free assertion) | **NET-NEW (this doc A2) — reuses the ECR-0007 enforcing seam-validator pattern** | this doc · `admin-plos-seam-v1.mjs` |
| **`(id, version)` capability identity + the durable `catalog-entry-v1` response contract** (versioning designed FIRST; response body is a contract, not a scanner side-effect) | **NET-NEW (this doc A6/C3)** | this doc |
| **Dedup / rebuild-detector** (pre-flight search; new-seam-vs-catalog overlap scan) — an anti-fragmentation HINT, report-only until precision-proven | **NET-NEW (this doc C4/C5) — reuses the Curator's CLUSTERING MACHINERY (connected-components) with a NEW capability-match signal + operating-model-check wiring** | this doc |
| **Within-project promotion-to-shared lifecycle** (orthogonal to the founder-ratified cross-PROJECT `CAPABILITY-LIFECYCLE.md`) | **NET-NEW (this doc A) — reconciles, does not add a 3rd list** | `CAPABILITY-LIFECYCLE.md` (2026-06-15) |

> **One-line honest verdict:** discovery is *built but report-only*; promotion + auto-generation + the
> canonical catalog are *absent*. The platform can already DISCOVER a capability once a human declares it; it
> cannot make declaration/promotion/documentation happen *by construction*. This capability closes exactly
> that gap — it is the forcing-function layer ON TOP of the BUILT discovery primitives.

---

## A. The within-project promotion-to-shared lifecycle (founder's 10 stages x the 7-hop model = ONE list)

> **A0. Reconciliation with the founder-RATIFIED `CAPABILITY-LIFECYCLE.md` (2026-06-15) — CRIT-12, mandatory.**
> There is already a founder-ratified lifecycle: `delivery-os/capabilities/CAPABILITY-LIFECYCLE.md`. **This
> doc does NOT compete with it and does NOT create a third lifecycle list.** They are **two orthogonal axes**:
> - **`CAPABILITY-LIFECYCLE.md` = the cross-PROJECT axis** (a *lesson* in one project becomes *every*
>   project's capability): `file-lesson → census-detector (≥3× or ≥2 projects) → CAPABILITY-LEDGER → build+verify
>   in delivery-os → OS release → os-inherit`. Its trigger is a **recurring lesson detected by census**; its
>   unit of travel is **a lesson**; its question is *"does this generalize across projects?"*
> - **THIS doc (A1–A10) = the within-PROJECT promotion-to-shared axis** (a single capability, once built in
>   the proving-ground project, becomes a *promoted, documented, discoverable, catalogued* shared artifact).
>   Its trigger is **a built capability that exposes a PII-free cross-system seam (A2, deterministic)**; its
>   unit of travel is **a capability + its manifest/facets/catalog-entry**; its question is *"is THIS thing
>   shareable, and is it self-documenting + discoverable by construction?"*
>
> **Where the two axes MEET (the single hand-off, not a fork):** this doc's **L3 Promoted** is the *producer*
> of the artifact that `CAPABILITY-LIFECYCLE.md`'s `build+verify in delivery-os → os-inherit` then *propagates*.
> `CAPABILITY-LEDGER.md` stays the ONE queue (per CAPABILITY-LIFECYCLE.md); this doc adds the *enforcement +
> auto-documentation + catalog* that makes an entry in that ledger self-promoting instead of a manual hope. If
> after ratification these read as redundant, FOLD A1–A10 into `CAPABILITY-LIFECYCLE.md` as its
> "within-project promotion detail" — do **not** maintain two. (No third list is created here; the table below
> is the *detail* of one hop of the ratified loop, explicitly mapped.)

The founder named 10 stages; `PLATFORM-READINESS...2026-06-17.md` named 7 hops (declare -> discover -> render ->
invoke -> observe -> orchestrate -> inherit). **These are not competing — they are the same path at two
resolutions.** The 7 hops are the *transport* a complete capability travels at runtime; the 10 stages are the
*promotion* events that produce the artifacts those hops carry. The reconciliation: the 10 stages all happen
*at or before* hop H1 (DECLARE) — they are the **birth + registration** of the capability that the 7 hops then
*move*. I fold them into ONE numbered lifecycle, mapping each stage to its hop, and explicitly NOT inventing a
third list.

| # | Unified stage | Founder stage | Maps to hop | Trigger | Mechanism / component | Artifact produced | Enforcement gate | Owner |
|---|---|---|---|---|---|---|---|---|
| L1 | **Created** | (1) created | pre-H1 | a slice ships a capability (code + tests) | software-engineer; existing build | the entry file + tests | `capability-health` (exists->reachable) | software-engineer |
| L2 | **Flagged reusable** | (2) identified-as-reusable | pre-H1 | **deterministic** (see A2) — exposes a versioned PII-free cross-system seam (API + events) | a *reusability classifier* over the manifest/contract (NET-NEW, A2) | `scope:shared` flag on the manifest | dedup gate fires FIRST (C4) — cannot proceed if it duplicates an existing cap | lead-architect (rule); auto-evaluated |
| L3 | **Promoted** | (3) promoted | precondition of H7 | L2 = shared AND facets present-or-explicit-`null` | os-inherit promotion (single-author -> vendored -> sha-pinned) | a canonical home in `delivery-os/` + an `os-foundation.manifest.json` row | **promotion gate** (fail-closed; D) | lead-architect / founder |
| L4 | **Manifest generated** | (4) manifest generated | **H1 DECLARE** | promotion (L3) OR build (L1) | **generate FROM the executable contract** (A4) — not hand-authored | `<id>.capability.json` | registry validation (`validateManifest`) | software-engineer (declares the narrative deltas only) |
| L5 | **Catalog updated** | (5) registry updated | **H2 DISCOVER** | a manifest appears/changes | registry scan -> the **canonical catalog** (A5 — the missing piece) | a durable, versioned `capability-catalog` entry | catalog-freshness gate (stale-catalog = RED) | platform (registry) |
| L6 | **Reference generated** | (6) Capability Reference generated | H7 INHERIT (the wiki facet) | manifest generated (L4) | **knowledge-layer Reference generator** (B) — emits a KU generation-class into the EXISTING wiki corpus, NOT a new store/router | a routable `cap-ref-<id>-<version>` KU (KU.md + KU frontmatter; consumption-facing) | reference gate (non-placeholder; drift-by-contract-hash) + the KNOW-5 proof bar (a consumption-intent route must return it) | knowledge-engineer (scaffold + narrative) |
| L7 | **Owner assigned** | (7) owner assigned | H1 (a manifest field) | manifest generated | `ownerSystem` + CODEOWNERS binding (existing) | `ownerSystem` + a CODEOWNERS row | drift-lint (CODEOWNERS <-> manifest) | lead-architect |
| L8 | **Consumers tracked** | (8) consumers tracked | **H5 OBSERVE** | another system imports/invokes the cap | consumer-edge derivation (B — from invoke-logs + import scan + `observed` manifests) | `consumers[]` in the catalog entry | report-only first (D) | platform (registry/health) |
| L9 | **Dependency graph updated** | (9) dependency graph updated | H6 ORCHESTRATE | manifest generated/changed | derive edges from facets+invoke refs (B) — events-published<->events-consumed, contract refs | a `dependsOn[]`/`emits<->consumes` graph in the catalog | cycle-detector (no dependency cycles — a standing arch rule) | platform |
| L10 | **Discoverable by all DOS systems** | (10) discoverable by all | H2+H3+H4 | catalog updated (L5) | capability-route (query/discover) + capability-ui (render) + capability-invoke (call) — **all BUILT** | live discovery/render/invoke from the catalog | discovery is the *property*, not a gate | platform |

**Three design calls the founder asked me to make explicit:**

### A2. Stage-2 trigger must be DETERMINISTIC, not human judgment
**Recommendation (justified):** a capability is reusable **by construction** — auto-flag `scope:shared` — when
its manifest declares **a versioned, PII-free, cross-system seam: a contract facet (a) AND an events facet (b),
with an `invoke` descriptor whose `kind` is `http` or `event` (cross-system-reachable), OR a `home` outside the
single owning app's private code path.** This is the exact shape already proven by `admin-plos-seam`
(contract + 13 events + ECR-0006 PULL). Why deterministic-by-construction beats human judgment:
- The founder's defect ("manual hope, not an enforced gate") is precisely that *someone has to decide+remember*.
  A rule keyed on **observable manifest facts** removes the human from the trigger.
- It matches the `sideEffect` honesty discipline already in the standard: the manifest already classifies
  read/write/outward; reusability is the *symmetric* construction-time fact.
- It is conservative in the right direction: a capability with no contract + no cross-system events stays
  `scope:project` (project-earned, per the Ledger's two classes) — we never over-promote app-local glue.
- **PII fail-CLOSED by construction (SEC-1 — load-bearing, the single most important security correction).**
  v1 was fail-OPEN: there was no `pii`/`scope` field on the manifest, so "PII routes to shared-blocked" could
  NEVER fire — *silence read as PII-free*. v2 fixes this:
  - The reusability classifier **DEFAULTS to NOT-shared.** `scope:shared` is reachable **ONLY** when an
    **affirmative, machine-checkable PII-free assertion passes** — exactly the ECR-0007 enforcing
    seam-validator pattern (`admin-plos-seam-v1.mjs`), reused, not reinvented.
  - **New required manifest field:** `pii: true | false | unknown` (and/or a `seamValidator` ref naming the
    executable PII-free validator the seam must pass). The classifier evaluates it as:
    `pii:false` *and* a passing `seamValidator` ⇒ `scope:shared` is *eligible*; **`pii:true` ⇒
    `scope:shared-blocked:pii`; `pii:unknown` or field ABSENT ⇒ `scope:shared-blocked:pii`** (silence/unknown
    is treated as PII, never as PII-free). There is no path where a missing assertion yields `shared`.
  - **Hard gate on the catalog:** **no PII may enter the cross-system catalog before ADR-007 is ACCEPTED.**
    Until then a `pii:false` assertion may *flag* eligibility, but a `shared` entry carrying any Contact field
    cannot be served on the seam — the registration/dedup pipeline holds it at `shared-blocked:pii`.
  This is the symmetric construction-time fact to the `sideEffect` honesty discipline, and it keeps the
  founder's strict PII boundary intact *by construction*, not by a reviewer remembering.

Human judgment is retained for exactly ONE thing the rule cannot see: the *narrative* "is this worth the
maintenance cost" call — but that is a `scope:shared-candidate -> confirm` review, not the *detection*. The
detection is deterministic; the confirmation is a cheap gated ack. **The dedup gate (C4) is an
anti-fragmentation HINT — NOT a security or authenticity control (SEC-4);** the security teeth are (a) the
fail-closed PII assertion above and (b) the CODEOWNERS provenance cross-check (SEC-4, §D).

### A4. Stage-4 manifest is GENERATED from the executable contract — field-by-field provenance
The contract (the `*-v1.mjs` executable interface + the events vocabulary + the `invoke` descriptor) is the
single source. The manifest is a *projection* of it, not a parallel hand-authored truth. Precise split:

| Manifest field | Source | Generation class |
|---|---|---|
| `facets.contract` | the contract file path/ref | **(i) fully derived** — the file IS the contract |
| `facets.events` | the event-type list the emitter registers (frozen vocabulary) | **(i) fully derived** — read from the events module |
| `invoke.kind/ref/sideEffect/idempotent/input/output/errors` | the contract's exported signature + the seam-gate's known side-effect class | **(i) derived** where typed; **(ii) declared** where the side-effect is not inferable |
| `home.repo/home.path` | the file location | **(i) fully derived** |
| `id` | kebab-case of the entry-file/cap name | **(i) derived** (collision-checked against the catalog) |
| `ownerSystem` | the repo it lives in | **(i) derived** |
| `status` | the governance-ladder rung (built/verified/promoted) | **(ii) declared** — advanced only on evidence (not inferable from code) |
| `name`, `description` | — | **(iii) narrative** — one honest sentence; human-authored, gate-enforced non-placeholder |
| `facets.skill`, `facets.wiki` | exist only if a skill/KU exists | **(ii) declared** (ref) — honest `null` default; never auto-fabricated |
| `facets.ui` | the data-contract surface, when built | **(ii) declared** (gated on the DOS-UI mechanism) |
| `id` *(now half of identity)* | kebab-case of the entry-file/cap name | see `id` row above — but identity is the **`(id, version)` tuple** (A6) |
| `version` *(NEW, API-8)* | the capability's semver-ish version line | **(ii) declared** — the producer states the version; the catalog keys on `(id, version)`; a new `version` is NEVER a dedup-candidate of an older one (A6/C4) |
| `deprecates` / `supersededBy` / `deprecatedAt` *(NEW, API-8)* | the prior `(id, version)` this replaces / the successor / when | **(ii) declared** — lifecycle metadata, honest `null` until a successor exists |
| `pii` *(NEW, SEC-1)* | `true \| false \| unknown` — does any facet carry Contact PII across the seam? | **(ii) declared** — but **silence/`unknown` ⇒ treated as `true` (PII)** by the classifier; `false` requires the `seamValidator` to pass |
| `seamValidator` *(NEW, SEC-1)* | ref to the executable PII-free validator (ECR-0007 pattern) the seam must pass | **(i) derived where a validator is wired; (ii) declared (ref) otherwise** — absence ⇒ not eligible for `scope:shared` |
| `discloseLevel` *(NEW, SEC-2)* | `internal \| shareable` — distinct from `scope`; gates what the cross-system PROJECTION may emit | **(ii) declared**, defaulting to `internal` — `shareable` only on a promoted + PII-asserted entry |
| `contractHash` *(NEW, CRIT-14)* | the drift anchor (see A6) | **(i) derived** — sha of the executable contract+events vocabulary, OR (for manifest-only caps) sha of the canonical manifest projection (CRIT-14, defined in A6) |
| `health` | a health probe ref | **(ii) declared** |

So **L4 is generate-then-augment:** the generator emits a complete manifest from the contract with honest
`null`s; the human supplies ONLY `name`/`description`/`status`-evidence and any skill/wiki refs. This is the
anti-"forgot to write a manifest" mechanism: there is nothing to forget — promotion (L3) *produces* the
manifest; the human only fills the irreducibly-narrative one sentence, and a gate (D) blocks a placeholder.

### A5. Stage-5: the missing canonical cross-system capability CATALOG (distinct from the inherit-list)
This is the single most important net-new structural call. Today there are TWO things and a GAP:
- `os-foundation.manifest.json` = the **inherit-list** (byte-vendored set every project pulls). It answers
  *"what do I inherit?"* — NOT *"what capabilities exist across systems and what are their facets?"* The
  standard already says these are orthogonal (`CAPABILITY-MANIFEST-STANDARD.md sec1`).
- `capability-catalog.json` = the registry's **aggregated output**, but it is **gitignored / regenerable** —
  a cache, not a source of truth. It vanishes; it is not versioned; PLOS cannot query Admin's without scanning
  Admin's disk.

**Design of the canonical catalog (EXTEND, do not fork):**
- **Where it lives:** `delivery-os/capabilities/capability-catalog.json` — a *committed, versioned* artifact,
  single-authored in delivery-os, **vendored to each project via os-inherit** exactly like a contract (so a
  project has a self-contained, drift-checked copy; same mechanism, no new propagation path). The per-repo
  regenerable cache stays gitignored; the *canonical* catalog is the promoted, pinned one.
- **Identity = the `(id, version)` tuple (A6, API-8 — design this FIRST, hardest to retrofit).** The catalog
  keys on the tuple, NOT on `id` alone. A new `version` of the same `id` is a *new line*, never a
  dedup-candidate of an older one (C4 clustering is scoped WITHIN a version line). `deprecates`/`supersededBy`/
  `deprecatedAt` track succession. This is the irreducible structural decision; everything else hangs off it.
- **`contractHash` for caps with NO single executable-contract file (CRIT-14).** For a cap whose `facets.contract`
  points at a real `*-v1.mjs`, `contractHash` = sha256(contract file bytes + frozen events vocabulary). For a
  **manifest-only cap** (no single contract file — e.g. a report-only script cap), `contractHash` =
  sha256 of the **canonical manifest projection**: the normalized tuple `(invoke.kind, invoke.ref-handle,
  invoke.input, invoke.output, invoke.sideEffect, facets.events[], id, version)` serialized deterministically.
  Either way the hash changes iff the *interface* changes — so the drift gate (§D) works identically for both.
- **Its shape (the INTERNAL catalog entry — rich):** the registry's existing entry shape (id, name, description,
  ownerSystem, status, version, home, facets, facetCompleteness, invoke, health) **plus the durable fields the
  cache lacks:** `scope` (shared|project|shared-blocked:pii), `pii`+`seamValidator` (SEC-1), `discloseLevel`
  (SEC-2), `consumers[]` (L8), `dependsOn[]`/`emits<->consumes` (L9), `contractHash` (above), and
  `observedAt`+`sourceCommit` (API-11 — when/at-what-commit this entry was observed; cross-repo rows are
  *snapshots*, see C3/C5). No new schema mechanism — it is the catalog row, made durable.
- **The CROSS-SYSTEM `catalog-entry-v1` is a DISTINCT, MINIMIZED projection (SEC-2 + API-9), defined in C3** —
  it is NOT the internal entry; it never emits `home.path`/`home.repo`/raw `invoke.ref`/internal `dependsOn`
  edges. The internal catalog is rich; the seam is impoverished, promoted-only, PII-asserted.
- **How it is updated:** generated by `capability-registry.mjs` (BUILT) at promotion (L3) and slice-close;
  the *canonical* copy is written only on promotion (a deliberate, gated act), keeping it author!=verifier-clean.
- **How it is queried:** by the BUILT `capability-route.mjs` (query/discover) locally, and **across systems
  via a versioned read seam** (C3) — the symmetric counterpart to ECR-0006's `/v1/ops` read seam. PLOS does
  not scan Admin's disk; it reads `GET /v1/capabilities`.

> **Anti-fragmentation note:** the catalog is NOT a new registry mechanism — it is the *promotion of the
> existing regenerable cache into a vendored, drift-gated canonical artifact*, using os-inherit (the one
> propagation path, per the Ledger's "no parallel mechanisms" rule).
>
> **⚠ FOUNDER-GATED — NOT executed in this design (CRIT-C3 / founder-gate).** v1 proposed *retiring* two
> hand-maintained markdown tables (`ecosystem-architecture/06-source-of-truth-registry.md` and the
> `CAPABILITY-LEDGER.md` verified-capabilities table) from canonical-discovery-source to "prose about the
> catalog." **Both `CAPABILITY-LEDGER.md` and `06-source-of-truth-registry.md` are founder-ratified and remain
> CANONICAL.** This doc does NOT demote, retire, or rewrite them. The proposed consolidation (machine catalog
> becomes the discovery source; the two tables narrate it) is recorded as a PROPOSAL **awaiting founder
> sign-off** — see §F. Until the founder signs off, the catalog is an ADDITIVE machine artifact alongside the
> two canonical tables, not a replacement for them.

---

## B. The mandatory auto-generation standard — the HONESTY SPLIT (not 100% generation)

The founder requires that on promotion, ALL of these are generated automatically FROM THE EXECUTABLE
CONTRACT: Capability Reference · Owner · Commands · Queries · Events published · Events consumed · Data
contracts · Consumers · Example integrations · Dependency-graph entries. **Honest verdict: most ARE derivable;
two are genuinely narrative.** I refuse to claim 100% generation. Classes: **(i)** fully derivable from the
contract/manifest; **(ii)** derivable but needs one declaration in the manifest; **(iii)** genuinely narrative
(one-time human authoring, gate-enforced non-placeholder + scaffolded).

| Auto-gen target | Class | Source / why |
|---|---|---|
| **Owner** | (i) | `ownerSystem` + CODEOWNERS — already on the manifest |
| **Commands** | (i) | the `invoke` descriptor (kind/ref/input/output/sideEffect) — the command seam IS the interface |
| **Queries** | (i) | read-side endpoints / `sideEffect:read` invoke refs + the contract's read schema |
| **Events published** | (i) | `facets.events` — read from the events module (frozen vocabulary) |
| **Events consumed** | (ii) | derivable from the consumer side's event-handlers, but cross-system -> declare a `consumes[]` in the consumer's manifest; the graph (L9) joins published<->consumed |
| **Data contracts** | (i) | `facets.contract` + the executable schema it points at |
| **Consumers** | (ii) | derived from invoke-logs + an import/seam-call scan + `observed` manifests; needs the observation hop (L8) wired — until then honest `consumers: []` |
| **Dependency-graph entries** | (i) | derive edges from facets/invoke refs + the published<->consumed join (L9) |
| **Capability Reference** (the "how to consume" doc) | **(iii) narrative core + (i) generated skeleton** | the *skeleton* (owner, commands, queries, events, data-contracts, deps) is generated; the *purpose / when-to-use / gotchas* are narrative |
| **Example integrations** | **(iii) narrative** | a real, runnable example cannot be reliably synthesized from a type signature; honestly authored once, drift-checked |
| **Purpose / future-reuse rationale** | **(iii) narrative** | "why this is worth reusing" is judgment, not a contract fact |

**The Capability Reference is MATERIALIZED as a routable KU — a KU-shaped, contract-generated
generation-class, NOT a 15th doc store and NOT a new router (KNOW-5, C3-blocking).** This is the load-bearing
correction from v1, and it satisfies BOTH lenses at once: the knowledge lens ("materialize as a KU, routable +
testable") AND the critic ("render, don't add a doc store").

`knowledge-route` indexes **KUs only** — units shaped `<corpus>/*/KU.md` carrying KU frontmatter
(`kuId` / `triggers` / `topics` / `status`). Therefore a Capability Reference is **real only when it exists as
exactly such a unit:**
- **Physical form:** `wiki/cap-ref-<id>-<version>/KU.md` with KU frontmatter — `kuId: cap-ref-<id>-<version>`,
  `triggers:` **derived from the capability's domain-nouns + event types** (so a consumption-intent like
  "how do I read the ops seam" routes to it), `topics:` **derived from its facets** (contract/events/commands/
  queries/consumers/deps), `status: active`.
- **The generated/narrative split lives INSIDE the KU body**, not as a separate file: the (i)/(ii) sections
  (owner, commands, queries, events, data-contracts, deps) are machine-generated INTO the body; the (iii)
  sections (purpose / when-to-use / gotchas / one example) are scaffolded placeholders in the same body.
- ADR/Decision/KU-claims answer **"why"**; the **Capability Reference KU answers "how to consume."** Same
  corpus, same router, same author≠verifier + cite@hash discipline — a *new generation-class of KU*, not a new
  bucket and not a new router.

**THE PROOF BAR (KNOW-5, verbatim intent):** *no Capability Reference is real until a consumption-intent route
returns it.* "Generated a Reference" is not done; "`knowledge-route --discover "<consumption intent>"`
returns `cap-ref-<id>-<version>` as a top match, verified by an independent party" is done. Any present-tense
claim that a Reference is "discoverable via knowledge-route" is **struck** unless backed by this routed return.

**Required canonical EDITs (KNOW-6 — made one-row, citing this design, so the two docs don't drift):** the
Capability-Reference generation-class is added to BOTH (a) `V6-KNOWLEDGE-SYSTEM.md §3.1` (the type model) AND
(b) `KNOWLEDGE-ARCHITECTURE.md §1` (the bucket model) as a Wiki/KU *generation-class* (NOT a new bucket). See
§F for the exact one-row additions. **Co-design, do not duplicate:** the Reference generator is a new emitter
the knowledge layer owns; it must NOT spawn a second `/references/` doc tree outside the corpus.

### The scaffold-and-preserve + drift-by-contract-hash mechanism (keeps the narrative from going stale)
This is how the (iii) narrative parts stay honest without manual wiki maintenance:
1. **Generate the skeleton** from the contract on promotion: every (i)/(ii) section is filled; every (iii)
   section is scaffolded with a typed placeholder (`<<PURPOSE: one paragraph — why reuse this>>`).
2. **Gate placeholders** (D reference-gate): a Reference with an un-filled (iii) placeholder is RED — the
   capability cannot reach `promoted`. This is the forcing function: you cannot promote without one-time
   authoring the irreducibly-human paragraphs. It is one-time, not maintenance.
3. **Anchor every section to a `contractHash`** (sha of the executable contract + events vocabulary). The
   generator records the hash the Reference was generated against.
4. **Drift detection by hash, not by reading prose:** when the contract changes, its hash changes; the
   reference-gate flags the Reference `STALE-AGAINST-CONTRACT` and:
   - **regenerates the (i)/(ii) sections automatically** (commands/queries/events/deps re-derive — zero human
     cost), and
   - **flags only the (iii) sections for human re-review** (preserved verbatim, marked "verify still true
     against the new contract"). Scaffold-and-preserve: generated sections are owned by the machine; narrative
     sections are preserved and only *flagged*, never overwritten.

This is the exact discipline the standard already uses for facet-ref drift and the os-inherit sha-pin — reused,
not reinvented. **Result:** the only human cost is one-time authoring of purpose + one example, and re-review
of those two *only when the contract actually changed* — everything else regenerates by construction.

> **What the hash gate DOES and does NOT prove (KNOW-7, honesty bar).** The drift-by-contract-hash gate proves
> only that staleness **was SURFACED** — that the (iii) narrative has not been *re-reviewed against the current
> contract*. It does **NOT** prove the narrative is *correct*. The (iii) sections of a Capability-Reference KU
> are ordinary KU prose and therefore **inherit the CITATION ceiling (board C1)** — they cap at "re-findable
> cited claim," never at execution-proven strength — and any change to them is subject to **author≠verifier
> re-review** exactly like any other KU edit. Regenerating the (i)/(ii) sections is mechanical; trusting the
> (iii) sections is bounded by the same trust model as the rest of the wiki.

---

## C. Discovery architecture — concrete answers to each founder question

All five reuse the BUILT primitives; the net-new parts are the cross-system seam (C3) and the two gates (C4/C5).

### C1. How will Jarvis discover capabilities?
Via the BUILT `capability-route.mjs --discover "<intent>"` over the canonical catalog (A5). It already returns
**ranked, explainable** matches (domain-noun > generic-verb scoring, light stemming, deterministic), and
`capability-consume.mjs` already composes discover -> select -> plan -> invoke-plan(GATED) -> observe end-to-end,
executing nothing. **The query interface Jarvis uses:** `discover(intent) -> [{ id, ownerSystem, status,
facetCompleteness, score, reasons }]`, then `capability-invoke <id>` plans/gates the call from the manifest's
`invoke` descriptor. Net-new for Jarvis = nothing structural; it consumes what is built, pointed at the
*canonical* catalog instead of the local cache.

### C2. How will future agents discover capabilities?
Two surfaces, both extending built mechanisms:
- **A "search before you build" step** wired into the dispatch path: `dispatch-route` already composes
  skill+knowledge into the spawnPrompt; EXTEND it to also route the task intent through `capability-route
  --discover` and inject the top matches as a `[capability:<id>]` block. The agent is *handed* "here are
  existing capabilities relevant to your task" before it writes a line — the agent-facing analog of the
  knowledge auto-injection in `KNOWLEDGE-ARCHITECTURE.md sec6.1`.
- **A tool/command catalog** (MCP-style): the catalog is already the right shape (id, description, invoke
  interface, side-effect class). Surfacing it as an agent tool-list is a thin adapter over the BUILT registry —
  not a new mechanism.

### C3. How will PLOS / Rumah / future systems query available capabilities? (versioned catalog query API)
A **versioned read seam — the symmetric counterpart to ECR-0006's `/v1/ops` read seam**, but its response body
is a deliberately impoverished projection (THE ONE INVERSION). Proposed as a new ECR (reserve **ECR-0008** —
capability-catalog read seam) since it is a cross-system contract.

**Auth (SEC-3 — required):** `GET /v1/capabilities*` requires a **dedicated `capabilities:read` scope** on the
service JWT. It is **never public**. (Distinct from `ops:read` — a consumer authorized to read ops facts is not
automatically authorized to enumerate the capability surface.)

**What the seam serves (SEC-4 — provenance, fail-closed):** ONLY entries with `status:promoted` AND a
**CODEOWNERS-verified** owner. The seam serves the **PINNED canonical catalog** (A5), never the raw aggregated
scan and never the live local regenerable cache. At publish time each entry's declared `ownerSystem` is
**cross-checked against the repo/CODEOWNERS owner; on mismatch the entry is DROPPED, fail-closed** (an entry
that cannot prove its owner is not authentic enough to expose). The dedup gate is an anti-fragmentation HINT,
**not** the authenticity control — provenance is (CODEOWNERS cross-check) + promotion status.

**The `catalog-entry-v1` response contract (API-9 + SEC-2) — DISTINCT from the manifest schema.** The response
body is a contract, not a scanner side-effect. It is the MINIMIZED projection of the internal entry:

```jsonc
// catalog-entry-v1  (the ONLY shape the cross-system seam emits)
{
  "id": "ops-read-seam",          // string
  "version": "1",                 // string — identity is the (id, version) TUPLE (API-8)
  "name": "…",                    // string (narrative, gate-enforced non-placeholder)
  "description": "…",             // string
  "ownerSystem": "rumah-admin",   // string — CODEOWNERS-verified (SEC-4)
  "status": "promoted",           // always "promoted" on the seam (SEC-4)
  "scope": "shared",              // shared | shared-blocked:pii  (project never reaches the seam)
  "facets": { "contract": true, "events": true, "skill": false, "wiki": "cap-ref-ops-read-seam-1", "ui": false },
                                  // PRESENCE/ref only — never internal paths
  "events": ["invoice.generated", "payment.received"],   // the public event vocabulary (shareable)
  "invokeHandle": "cap:ops-read-seam@1",                 // OPAQUE handle (SEC-2) — NOT invoke.ref / NOT a script path
  "invokeKind": "http",           // http | event  (enough to know HOW to reach it, not WHERE on disk)
  "consumersCount": 2,            // a COUNT, not the internal consumer edge list
  "contractHash": "ab12…",        // drift anchor (CRIT-14)
  "deprecates": null, "supersededBy": null, "deprecatedAt": null,   // succession (API-8)
  "observedAt": "2026-06-18T…Z",  // when this row was observed (API-11)
  "sourceCommit": "642acc9"       // the commit it was observed at (API-11)
}
```
**NEVER emitted on the seam (SEC-2):** `home.path`, `home.repo`, raw `invoke.ref`, internal `dependsOn[]`
edges, the raw consumer edge list, `pii`/`seamValidator` internals, `discloseLevel`. Those live only in the
internal catalog (A5).

**Endpoints + the empty/error contract (API-9, API-10):**
- `GET /v1/capabilities` — params: `?owner=`, `?facet=`, `?scope=`, `?keyword=`, **`?limit=<n>`** (default 50,
  max 200), **`?cursor=<opaque>`** (a deterministic, stable cursor over `(observedAt, id, version)` — NOT a raw
  offset). Returns `{ catalogVersion, entries: catalog-entry-v1[], nextCursor: string|null }`. **An empty
  result is `200` with `entries: []`** (not 404). **`4xx`** is reserved for auth failure (`401`/`403` — missing
  `capabilities:read`), a malformed cursor/param (`400`), or an unknown `:id` (`404`). `catalogVersion` is the
  **catalog's** version (distinct from each entry's `capability.version`, API-10).
- `GET /v1/capabilities/:id` and `GET /v1/capabilities/:id/:version` — a single `catalog-entry-v1`; `404` if no
  such `(id[,version])`.
- `GET /v1/capabilities/discover?intent=<text>&ranker=v1` — the ranked discover() output. **The ranker is
  versioned (`?ranker=v1`, API-10)** so a future re-tune is an explicit new ranker, never a silent cross-system
  behavior change; default is the lowest stable version, never "latest".

**Staleness is surfaced, not hidden (API-11).** The catalog scans sibling repos on the local FS, so a PLOS row
can be stale or absent. Every entry carries `observedAt` + `sourceCommit`; cross-system rows are explicitly
**"Admin-observed snapshots," not live PLOS truth.** PLOS never scans Admin's disk and Admin never claims to
serve live PLOS state — it serves the pinned canonical catalog with each row's observation provenance, exactly
the honesty the ECR-0006 events drain already practices.

### C4. How will we PREVENT duplicate capabilities being created? (pre-flight + dedup gate)
- **Pre-flight at creation:** before a slice declares a new capability, run `capability-route --discover` on
  the proposed name + domain-nouns + events; if a strong match exists, surface it ("this may already exist:
  <id>"). This is the "search before you build" step (C2) applied at *creation*.
- **The dedup gate (an anti-fragmentation HINT, not authenticity — SEC-4):** it **reuses the Curator's
  CLUSTERING MACHINERY (connected-components)** — `knowledge-curator.mjs` already builds connected-components
  over a dupCandidate graph — with a **NEW capability-match SIGNAL** purpose-built here (it is NOT "the
  Curator's heuristic" reused as-is; it is the Curator's *machinery* driven by a capability-specific signal,
  KNOW-7):
  - **NEW capability-match signal** = (i) **exact overlap on `facets.events`** (shared event types) + (ii)
    **domain-noun jaccard** over id/name/description tokens + (iii) **contract fingerprint** overlap.
  - **Scoped WITHIN a version line (API-8):** a new `(id, v2)` of an existing `(id, v1)` is a successor, NEVER a
    dup-candidate. Clustering only compares DISTINCT `id`s.
  - **The gate is SPLIT by signal strength (API-10) — do NOT enforce the fuzzy part prematurely:**
    - **Exact `facets.events` overlap MAY be enforceable** — two distinct `scope:shared` caps emitting the
      *same* event type is a hard, deterministic collision worth blocking once wired.
    - **Fuzzy jaccard + contract-fingerprint stays report-only-with-human-adjudication** until a **stated
      precision bar passes on Admin's real 10 caps**, using the **`*-send` PLOS caps as the known-non-duplicate
      test set** (they share words/domain-nouns but are genuinely distinct — if the fuzzy signal flags them as
      dups, precision is too low to enforce). No fuzzy enforcement before that bar passes.
  - It NARROWS, never auto-merges (the Curator's propose-never-merge discipline preserved). Clustering is an
    anti-fragmentation hint that something *might* duplicate; it is never a security or authenticity control
    (that is CODEOWNERS + promotion status, §D/SEC-4).

### C5. How will we DETECT a project rebuilding something that already exists? (rebuild-detector)
A scanner over a project's NEW seams/endpoints/events vs the canonical catalog:
- **Input:** the project's declared `*.capability.json` deltas + a light scan of new HTTP routes / event-type
  registrations / contract files since the last catalog version.
- **Match:** the same Curator CLUSTERING MACHINERY + capability-match signal as C4 (exact events overlap,
  domain-noun jaccard, contract fingerprint), but cross-*system* — a new Rumah/PLOS endpoint whose
  event-vocabulary or domain-nouns cluster with an existing `delivery-os`-promoted capability is flagged
  `REBUILD-SUSPECT: overlaps <id>@<version> in <ownerSystem>` — a HINT for a human, not an authenticity verdict.
- **Cross-repo staleness is explicit (API-11):** because the detector scans sibling repos on the local FS, the
  catalog rows it compares against carry `observedAt`+`sourceCommit` and are "Admin-observed snapshots." A
  REBUILD-SUSPECT against a *stale* snapshot is reported WITH its observation age, so a false alarm from an
  out-of-date local cache is visible rather than silently authoritative.
- **Wiring (reuse, don't reinvent):** the standing **`operating-model-check.mjs`** harness (already runs at
  slice-close + milestone, report-only, reads tool STDOUT JSON) is the host — add a `rebuild-detector` section
  exactly as `slice-close.mjs` already hosts registry + capability-route + curator sections. **report->enforce:**
  report-only first; promoted to a milestone gate once the heuristic's precision is proven on Admin's own caps
  (admin-first), never blocking on a false-positive in the report phase.

---

## D. Enforcement = part of the OS (not a habit)

The founder's principle ("part of the OS, not a manual habit") becomes a **fail-closed property of shipping**
via these gates, wired into the EXISTING harnesses, report->enforce, and propagated to EVERY project via
os-inherit (so the gates are *inherited*, not re-implemented per project — the one-propagation-path rule).

> **Security vs anti-fragmentation, separated (SEC-4).** Two of these gates are **security/authenticity
> controls that enforce-by-construction** (the PII fail-closed gate and the provenance/CODEOWNERS gate) plus the
> seam's `capabilities:read` auth (SEC-3). The **dedup/rebuild gate is an anti-fragmentation HINT** — it helps
> the platform not duplicate work; it is explicitly NOT an authenticity or PII control and must never be relied
> on as one. Conflating the two was a v1 ambiguity this row-split removes.

| Gate | What it fails-closed on | Host (existing) | report->enforce stage |
|---|---|---|---|
| **registration gate** | a `scope:shared` capability (A2) with NO manifest, OR a manifest that fails `validateManifest` | slice-close (registry section, BUILT) | report now -> enforce after dedup precision proven |
| **reference gate** | a promoted capability whose Capability Reference has an unfilled (iii) placeholder OR is `STALE-AGAINST-CONTRACT` (B) | slice-close (knowledge section) | report now -> enforce at promotion (L3) |
| **drift-by-contract-hash gate** | the catalog `contractHash` differs from the live contract hash (manifest/catalog/reference out of sync with the executable contract) | os-inherit `check` (the sha-pin mechanism, VERIFIED) + slice-close | enforce reuses the proven os-inherit drift mechanic |
| **PII fail-closed gate** *(NEW, SEC-1)* | a `scope:shared` cap whose `pii` is `true`/`unknown`/absent, OR `pii:false` without a passing `seamValidator` — held at `shared-blocked:pii`; NO catalog PII before ADR-007 ACCEPTED | slice-close (registry section) + the catalog publish step | enforce-by-construction (the default IS blocked) |
| **provenance / authenticity gate** *(NEW, SEC-4)* | a seam-exposed entry whose declared `ownerSystem` ≠ the repo/CODEOWNERS owner, OR `status != promoted` — DROPPED from the seam, fail-closed | the catalog publish step (the pinned-catalog writer) | enforce at publish (security control, not report-only) |
| **dedup / rebuild gate** *(anti-fragmentation HINT, SEC-4 — not a security control)* | exact `facets.events` collision MAY block (C4); fuzzy clustering report-only-with-adjudication until precision-proven (C4/C5) | operating-model-check + slice-close | exact: report -> milestone gate; fuzzy: report-only until precision bar passes |

**How "every project automatically contributes capabilities back" becomes fail-closed:**
1. L1 build -> L2 deterministic reusability flag (no human decision) -> if `scope:shared`, the **registration
   gate** makes the slice un-closeable until the manifest exists. *You cannot ship a reusable capability
   without declaring it* — the exact failure Inventory Units v1 represented.
2. L3 promotion is the deliberate gated act; the **reference gate** makes it un-promotable without the
   one-time narrative. *You cannot promote without documenting.*
3. The gates themselves are **vendored via os-inherit** (like `seam-gate`, `lifecycle-gate` already are) and
   listed in `os-foundation.manifest.json`, so a fresh project inherits them and they run in its CI with no OS
   mounted. *Every project that runs slice-close runs these gates* -> contribution-back is structural.
4. **Gating discipline (honored):** all four are **report-only first** (admin-first-proof: prove the heuristic
   on Admin's own 10 caps before enforcing); enforcement flips on only after precision is demonstrated; PLOS
   coupling (the C3 seam) is gated post-V6 + past the N=1 master gate. Nothing here enforces against PLOS in
   this design.

---

## E. Is this a first-class FOUNDATIONAL Delivery OS capability + roadmap positioning

### Verdict: YES — foundational to the platform SUBSTRATE, by dependency-ordering. (CRIT-13 — softened.)
The dependency structure supports a clear, bounded claim: *Workflow Execution and Agent Coordination CONSUME
discovery — they cannot sequence or route capabilities they cannot discover/invoke — so discovery must precede
them.* That ordering argument is what is supported, and it is enough to call this **substrate**. A capability
that is not discoverable is rebuilt; a rebuilt capability fragments the platform — the anti-fragmentation
failure this initiative fights.

> **Two corrections to the v1 framing (CRIT-13):**
> 1. **DROPPED the "co-first with Entity Resolution" claim.** The cited platform-readiness ranking does NOT
>    name Entity Resolution; asserting co-first was unsupported. ER is treated below only as a *future* signal
>    upgrade to the dedup machinery, not a co-first peer.
> 2. **This MUST NOT block the Lead-to-Contract product slice.** "Foundational to the substrate" is a
>    sequencing statement about the *platform* primitives (Workflow/Agent-Coordination), NOT a license to stall
>    the founder's product work. The product slice proceeds; the promotion+discovery spine is proven on Admin's
>    own caps in parallel and is never a precondition for shipping Lead-to-Contract.

### Dependency ordering relative to the five
| Capability | Relationship to Promotion & Discovery | Direction |
|---|---|---|
| **Entity Resolution** | **REGISTERS INTO it; a FUTURE signal upgrade, NOT co-first.** ER is itself a domain capability that registers into the catalog. The dedup/rebuild *signal* (C4/C5) is noun/event clustering on the Curator's connected-components machinery today; if/when ER lands it can STRENGTHEN that signal. No co-first dependency is claimed (CRIT-13) — build the thin spine on the BUILT Curator machinery now; let ER improve the match later. | registers in / future signal upgrade |
| **Contact Intelligence** | **REGISTERS INTO** it (a domain/runtime capability discovered via the catalog). Also PII-bounded -> exercises the `scope:shared-blocked:pii` rule (A2). | registers in |
| **Workflow Execution** | **CONSUMES** it. A workflow engine *composes discovered capabilities* — it cannot sequence steps it cannot discover/invoke. Per the Sufficiency VERDICT, the workflow engine is the conductor; this is the orchestra it conducts. Discovery must exist first for the conductor to have players. | consumes |
| **Agent Coordination** | **CONSUMES** it. Agents route via discovery (the "search before you build" step, C2); dispatch composes discovered capabilities into the spawnPrompt. | consumes |
| **Memory / Learning** | **OVERLAP — co-design, do not duplicate.** The Capability Reference is a knowledge TYPE (B) -> it lives in the knowledge/learning layer, not a parallel store. Promotion is also a *learning* event (a proven capability becomes shared) — it should feed the same learning loop (learning-review / census). Build the Reference generator AS an emitter the knowledge layer owns. | overlap / co-design |

**Why foundational to the substrate (the supported argument only):**
- It is the **H1 root** the platform-readiness review named #1-ranked: with no declaration STANDARD, the
  platform cannot discover, render, invoke, or inherit anything generically; every other primitive has nothing
  to operate on. The *discovery* half is BUILT; this capability adds the *promotion + auto-doc + catalog +
  enforcement* half that makes it self-sustaining.
- Workflow Execution and Agent Coordination both **consume** it -> they cannot precede it. **This is the
  dependency-ordering argument, and it is what is supported.**
- Entity Resolution is NOT co-first (CRIT-13) — the dedup *signal* could later be upgraded by ER, but no
  co-first dependency exists and the cited ranking does not name ER.
- Memory/Learning is parallel-and-shared (the Reference KU type), not a dependency.
- **It does NOT gate the Lead-to-Contract product slice** (CRIT-13) — substrate work runs alongside product
  work, never as its precondition.

**Roadmap position:** sequence it **immediately after the BUILT discovery primitives are proven, before
Workflow Execution / Agent Coordination / Contact Intelligence** — by dependency-ordering, NOT "co-first with
Entity Resolution" (CRIT-13), and **without blocking the Lead-to-Contract product slice**. Concretely (per the
platform-readiness Waterline sequence): the discovery hops (H1/H2/H3/H4) are built report-only; the next slice
is the **promotion + enforcement layer** (this doc), proven on Admin's OWN 10 capabilities (turn the 10
report-only manifests into a promoted, referenced, deduped, canonical catalog), THEN generalize. Do NOT build
the catalog/gates abstractly — prove on the real 10 caps first (Waterline). PLOS authoring against the C3 seam
is the FIRST real cross-system consumer, gated post-V6 + N=1.

---

## F. Required canonical EDITs + proposed Curator merges
Anti-fragmentation requires naming the overlaps this capability touches so they converge instead of breeding.

### F.1 Required one-row EDITs (KNOW-6 — make these now, citing this design, so the two docs do not drift)
The Capability-Reference generation-class MUST be added to BOTH the type model AND the bucket model so they
stay in sync. These are one-row additions, NOT a new bucket and NOT a new router:
- **`V6-KNOWLEDGE-SYSTEM.md §3.1` (type model)** — add a row: *Capability Reference (generation-class of
  Wiki/KU) · "how to consume" a promoted capability · provability ceiling = CITATION for (iii) narrative,
  generated (i)/(ii) sections re-derive from `contractHash` · canonical home `wiki/cap-ref-<id>-<version>/KU.md`
  · cites: `CAPABILITY-PROMOTION-DISCOVERY.md §B`.*
- **`KNOWLEDGE-ARCHITECTURE.md §1` (bucket model)** — add a note to bucket #2 (Wiki): *a Capability Reference
  is a contract-generated GENERATION-CLASS of KU (KU.md + KU frontmatter), routable via `knowledge-route` like
  any KU — NOT a new bucket; see `CAPABILITY-PROMOTION-DISCOVERY.md §B`.*
> These two one-row edits are flagged here and **applied in this same pass** (see the confirmation in the
> return note); the Reference is a KU generation-class, so neither doc gains a new bucket/type silo.

### F.2 Proposed Curator merges (PROPOSE — do NOT execute)
1. **The Capability Reference** -> the KU generation-class above (F.1), in the EXISTING wiki corpus. NOT a new
   doc tree, NOT a 15th store.
2. **This doc itself** is the consolidating *detail* of ONE hop of the founder-ratified `CAPABILITY-LIFECYCLE.md`
   (A0). If after ratification the founder wants one doc, fold A1–A10 into `CAPABILITY-LIFECYCLE.md` and B/C/D
   into `CAPABILITY-MANIFEST-STANDARD.md` + the platform-readiness sequence, retiring this as a stub. It must
   not grow into a third lifecycle list.

### F.3 ⚠ FOUNDER-GATED — NOT executed (CRIT-C3 / founder-gate)
The v1 proposal to demote `CAPABILITY-LEDGER.md` and `ecosystem-architecture/06-source-of-truth-registry.md`
from canonical-discovery-source to "prose about the catalog" is **left UNDONE.** Both are **founder-ratified and
remain CANONICAL.** The proposed consolidation (machine catalog becomes the discovery source; the two tables
narrate it) **requires founder sign-off** before any change. This design neither edits nor demotes them; it adds
the machine catalog ALONGSIDE them and records the consolidation as a sign-off-gated proposal only.

---

## G. Status & the author-not-equal-verifier gate on THIS doc

> **v2 status:** §11 panel returned RATIFY-WITH-CONDITIONS 4/4; all 14 build-able conditions are applied in
> this design (SEC-1..4, KNOW-5..7, API-8..11, CRIT-12..14). The one founder-gated item (demoting
> `CAPABILITY-LEDGER.md` / `06-source-of-truth-registry.md`) is **flagged, NOT executed** (F.3). The two
> KNOW-6 one-row canonical edits are applied in the same pass (F.1). Still DESIGN-ONLY: no build, no scripts,
> no manifests, no file moves beyond the two one-row doc edits.

DRAFT, authored by lead-architect; **NOT self-certified.** Done (for this DESIGN-ONLY pass) when it: EXTENDS
the cited artifacts rather than regenerating them · reconciles the 10 stages x 7 hops into ONE lifecycle ·
gives the honest auto-gen split (refusing 100% generation) · answers the five discovery questions on BUILT
primitives + the two net-new gates · and is queued for independent review. The founder ratifies: (a) the A2
deterministic reusability trigger, (b) the A5 canonical catalog as a vendored/drift-gated artifact, (c) the
Capability Reference as a knowledge type (B) + the scaffold-and-preserve drift mechanism, (d) the four
fail-closed gates report->enforce sequencing (D), and (e) the substrate (NOT co-first) roadmap verdict that does not block Lead-to-Contract (E). An independent
verifier checks that nothing here forks the spine (no parallel registry/propagation/doc-store) or restates the
canon it cites. **Built is not Adopted:** this design is "adopted" only when the gates run on Admin's own 10
capabilities and the canonical catalog is promoted+vendored — not because this doc exists.
