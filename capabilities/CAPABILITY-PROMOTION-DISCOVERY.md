# Capability Promotion & Discovery — the meta-capability (DRAFT, founder ratifies)

> DRAFT — lead-architect authors; founder ratifies. **Not self-certified.** DESIGN-ONLY (founder said
> "before proceeding"): no build, no scripts, no file moves, no manifests created in this pass.
>
> **Anti-fragmentation is the governing constraint of this doc.** Everything below EXTENDS an existing
> canonical artifact. Where a doc already owns a concern, I cite it and sharpen it; I do not regenerate it.
> Where two docs overlap I PROPOSE a Curator merge — I do not execute it. This doc is the *consolidating
> index* for promotion+discovery; it must NOT become a third competing lifecycle list.
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
| **Capability Reference as a knowledge TYPE** (consumption-facing "how to consume") | **NET-NEW (this doc B) — extends the knowledge layer** | `V6-KNOWLEDGE-SYSTEM.md sec3`; not yet a type |
| **Stage-2 deterministic reusability trigger** (auto-flag `scope:shared` by construction) | **NET-NEW (this doc A2)** | this doc |
| **Dedup / rebuild-detector gates** (pre-flight search; new-seam-vs-catalog overlap scan) | **NET-NEW (this doc C4/C5) — reuses curator clustering + operating-model-check wiring** | this doc |
| **Unified lifecycle reconciling founder-10-stages x the 7-hop model** | **NET-NEW (this doc A) — reconciles, does not add a 3rd list** | this doc |

> **One-line honest verdict:** discovery is *built but report-only*; promotion + auto-generation + the
> canonical catalog are *absent*. The platform can already DISCOVER a capability once a human declares it; it
> cannot make declaration/promotion/documentation happen *by construction*. This capability closes exactly
> that gap — it is the forcing-function layer ON TOP of the BUILT discovery primitives.

---

## A. The unified capability lifecycle (founder's 10 stages x the 7-hop model = ONE list)

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
| L6 | **Reference generated** | (6) Capability Reference generated | H7 INHERIT (the wiki facet) | manifest generated (L4) | **knowledge-layer Reference generator** (B) — a new knowledge TYPE, NOT a parallel doc store | a `Capability Reference` KU (consumption-facing) | reference gate (non-placeholder; drift-by-contract-hash) | knowledge-engineer (scaffold + narrative) |
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
- **PII-free is load-bearing** (ECR-0007 boundary): a seam that would carry Contact PII is NOT auto-shared;
  it routes to the human boundary review instead. The classifier flags `scope:shared-blocked:pii` rather than
  silently promoting. This keeps the founder's strict PII boundary intact by construction.

Human judgment is retained for exactly ONE thing the rule cannot see: the *narrative* "is this worth the
maintenance cost" call — but that is a `scope:shared-candidate -> confirm` review, not the *detection*. The
detection is deterministic; the confirmation is a cheap gated ack (the dedup gate, C4, is the real teeth).

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
- **Its shape:** the registry's existing catalog entry shape (id, name, description, ownerSystem, status,
  version, home, facets, facetCompleteness, invoke, health) **plus four durable fields the cache lacks:**
  `scope` (shared|project|shared-blocked:pii), `consumers[]` (L8), `dependsOn[]`/`emits<->consumes` (L9), and a
  `contractHash` (the drift anchor, B). No new schema — it is the catalog row, made durable + the promotion-time fields.
- **How it is updated:** generated by `capability-registry.mjs` (BUILT) at promotion (L3) and slice-close;
  the *canonical* copy is written only on promotion (a deliberate, gated act), keeping it author!=verifier-clean.
- **How it is queried:** by the BUILT `capability-route.mjs` (query/discover) locally, and **across systems
  via a versioned read seam** (C3) — the symmetric counterpart to ECR-0006's `/v1/ops` read seam. PLOS does
  not scan Admin's disk; it reads `GET /v1/capabilities`.

> **Anti-fragmentation note:** the catalog is NOT a new registry mechanism — it is the *promotion of the
> existing regenerable cache into a vendored, drift-gated canonical artifact*, using os-inherit (the one
> propagation path, per the Ledger's "no parallel mechanisms" rule). It also retires two hand-maintained
> markdown tables (`06-source-of-truth-registry.md`, the `CAPABILITY-LEDGER.md` verified-capabilities table)
> as the discovery *source* — those become *prose about* the catalog, not the catalog.

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

**The Capability Reference is a knowledge TYPE — it EXTENDS the knowledge layer, it is NOT a parallel doc
store.** `V6-KNOWLEDGE-SYSTEM.md sec3` already defines first-class types (Wiki/Skill/Workflow/Contract/Decision/
Governance-Asset/...) and the rule that each routes through the seam. The Reference is a **new consumption-facing
type**, distinct from the existing types on the why/how axis:
- ADR/Decision/KU answer **"why"** (the constraint, the rationale, the trap).
- The **Capability Reference answers "how to consume"** (the commands, queries, events, examples) — it is the
  generated, contract-derived consumption surface.
It therefore lives **in the knowledge layer**, registered through `knowledge-route` (so an agent about to
consume a capability is *handed* its Reference), authored/maintained by the knowledge-engineer, and subject to
the same author!=verifier + cite@hash discipline. **Co-design, do not duplicate:** the Reference generator is a
new emitter the knowledge layer owns; it must NOT spawn a second `/references/` doc tree outside the layer.
(Add the Reference type to `V6-KNOWLEDGE-SYSTEM.md sec3.1` — a one-row EXTENSION, not a new doc.)

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
A **versioned read seam — the symmetric counterpart to ECR-0006's `/v1/ops` read seam** (same auth model:
scoped service JWT, read-only, data-minimised). Proposed as a new ECR (reserve **ECR-0008** —
capability-catalog read seam) since it is a cross-system contract.
- `GET /v1/capabilities` — params: `?owner=`, `?facet=`, `?status=`, `?scope=`, `?keyword=`, `?since=<catalogVersion>`.
- `GET /v1/capabilities/:id` — the full catalog entry (facets, invoke interface, consumers, deps, contractHash).
- `GET /v1/capabilities/discover?intent=<text>` — the ranked discover() output, server-side.
- **Response shape** = the canonical catalog entry (A5) verbatim — one schema, reused. Versioned by the
  catalog's `version` + per-entry `version`; `since` enables incremental pull (PLOS polls deltas, exactly like
  the ECR-0006 events drain). PLOS never scans Admin's disk.

### C4. How will we PREVENT duplicate capabilities being created? (pre-flight + dedup gate)
- **Pre-flight at creation:** before a slice declares a new capability, run `capability-route --discover` on
  the proposed name + domain-nouns + events; if a strong match exists, surface it ("this may already exist:
  <id>"). This is the "search before you build" step (C2) applied at *creation*.
- **The dedup gate (the teeth):** keyed on **entities / events / domain-nouns** — REUSE the Curator's BUILT
  match heuristic. `knowledge-curator.mjs` already builds **connected-components over a dupCandidate graph**
  using **jaccard + titleSimilarity + fingerprint**; the same clustering runs over catalog entries:
  - **match signal** = overlap on `facets.events` (shared event types) + jaccard over domain-noun tokens of
    id/name/description + fingerprint of the contract surface. A new manifest whose signal clusters with an
    existing canonical capability above threshold is flagged `DUP-CANDIDATE`.
  - **gate behavior** (report->enforce): report-only first (cluster surfaced at slice-close); when enforced, a
    new `scope:shared` manifest that clusters with an existing one **cannot reach `promoted`** until either
    merged-into or explicitly justified-as-distinct (the sec1 invoice-Workflow-vs-Skill "shares words != duplicate"
    adjudication — a human ack, logged).
  - It NARROWS, never auto-merges (the Curator's propose-never-merge discipline preserved).

### C5. How will we DETECT a project rebuilding something that already exists? (rebuild-detector)
A scanner over a project's NEW seams/endpoints/events vs the canonical catalog:
- **Input:** the project's declared `*.capability.json` deltas + a light scan of new HTTP routes / event-type
  registrations / contract files since the last catalog version.
- **Match:** the same clustering heuristic as C4 (events intersect, domain-noun jaccard, contract fingerprint),
  but cross-*system* — a new Rumah/PLOS endpoint whose event-vocabulary or domain-nouns cluster with an existing
  `delivery-os`-promoted capability is flagged `REBUILD-SUSPECT: overlaps <id> in <ownerSystem>`.
- **Wiring (reuse, don't reinvent):** the standing **`operating-model-check.mjs`** harness (already runs at
  slice-close + milestone, report-only, reads tool STDOUT JSON) is the host — add a `rebuild-detector` section
  exactly as `slice-close.mjs` already hosts registry + capability-route + curator sections. **report->enforce:**
  report-only first; promoted to a milestone gate once the heuristic's precision is proven on Admin's own caps
  (admin-first), never blocking on a false-positive in the report phase.

---

## D. Enforcement = part of the OS (not a habit)

The founder's principle ("part of the OS, not a manual habit") becomes a **fail-closed property of shipping**
via four gates, wired into the EXISTING harnesses, report->enforce, and propagated to EVERY project via
os-inherit (so the gates are *inherited*, not re-implemented per project — the one-propagation-path rule).

| Gate | What it fails-closed on | Host (existing) | report->enforce stage |
|---|---|---|---|
| **registration gate** | a `scope:shared` capability (A2) with NO manifest, OR a manifest that fails `validateManifest` | slice-close (registry section, BUILT) | report now -> enforce after dedup precision proven |
| **reference gate** | a promoted capability whose Capability Reference has an unfilled (iii) placeholder OR is `STALE-AGAINST-CONTRACT` (B) | slice-close (knowledge section) | report now -> enforce at promotion (L3) |
| **drift-by-contract-hash gate** | the catalog `contractHash` differs from the live contract hash (manifest/catalog/reference out of sync with the executable contract) | os-inherit `check` (the sha-pin mechanism, VERIFIED) + slice-close | enforce reuses the proven os-inherit drift mechanic |
| **dedup / rebuild gate** | a new `scope:shared` manifest that clusters with an existing canonical capability (C4) / a project rebuilding a catalogued capability (C5) | operating-model-check + slice-close | report now -> milestone gate after precision proven |

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

### Verdict: YES — foundational, and **co-first with Entity Resolution**, ahead of the other four.
The founder's intuition is correct and provable from the dependency structure: *every future project depends
on discovering + reusing rather than rebuilding.* A capability that is not discoverable is rebuilt; a rebuilt
capability fragments the platform — the precise anti-fragmentation failure this whole initiative fights. So
Capability Promotion & Discovery is the **substrate the other capabilities register into and are found
through.**

### Dependency ordering relative to the five
| Capability | Relationship to Promotion & Discovery | Direction |
|---|---|---|
| **Entity Resolution** | **CO-FIRST.** It is itself a domain capability that must REGISTER into the catalog — but the dedup/rebuild heuristic (C4/C5) is *entity/noun clustering*, which is what Entity Resolution does well. They share a clustering substrate (the Curator's connected-components today; ER strengthens it later). Build the thin promotion/discovery spine first using the BUILT Curator clustering; let ER upgrade the match heuristic when it lands. | bidirectional / co-design |
| **Contact Intelligence** | **REGISTERS INTO** it (a domain/runtime capability discovered via the catalog). Also PII-bounded -> exercises the `scope:shared-blocked:pii` rule (A2). | registers in |
| **Workflow Execution** | **CONSUMES** it. A workflow engine *composes discovered capabilities* — it cannot sequence steps it cannot discover/invoke. Per the Sufficiency VERDICT, the workflow engine is the conductor; this is the orchestra it conducts. Discovery must exist first for the conductor to have players. | consumes |
| **Agent Coordination** | **CONSUMES** it. Agents route via discovery (the "search before you build" step, C2); dispatch composes discovered capabilities into the spawnPrompt. | consumes |
| **Memory / Learning** | **OVERLAP — co-design, do not duplicate.** The Capability Reference is a knowledge TYPE (B) -> it lives in the knowledge/learning layer, not a parallel store. Promotion is also a *learning* event (a proven capability becomes shared) — it should feed the same learning loop (learning-review / census). Build the Reference generator AS an emitter the knowledge layer owns. | overlap / co-design |

**Why foundational / co-first (not just useful):**
- It is the **H1 root** the platform-readiness review already named #1-ranked: with no declaration STANDARD,
  the platform cannot discover, render, invoke, or inherit anything generically; every other primitive has
  nothing to operate on. The *discovery* half is BUILT; this capability adds the *promotion + auto-doc +
  catalog + enforcement* half that makes it self-sustaining.
- Workflow Execution and Agent Coordination both **consume** it -> they cannot precede it.
- Entity Resolution is co-first because the dedup/rebuild heuristic *is* an entity-clustering problem; they
  share a substrate and should be sequenced together so neither builds a throwaway matcher.
- Memory/Learning is parallel-and-shared (the Reference type), not a dependency.

**Roadmap position:** sequence it **immediately after the BUILT discovery primitives are proven, alongside
Entity Resolution, before Workflow Execution / Agent Coordination / Contact Intelligence.** Concretely (per the
platform-readiness Waterline sequence): the discovery hops (H1/H2/H3/H4) are built report-only; the next slice
is the **promotion + enforcement layer** (this doc), proven on Admin's OWN 10 capabilities (turn the 10
report-only manifests into a promoted, referenced, deduped, canonical catalog), THEN generalize. Do NOT build
the catalog/gates abstractly — prove on the real 10 caps first (Waterline). PLOS authoring against the C3 seam
is the FIRST real cross-system consumer, gated post-V6 + N=1.

---

## F. Proposed Curator merges (PROPOSE — do NOT execute)
Anti-fragmentation requires naming the overlaps this capability touches so they converge instead of breeding:
1. **The two hand-maintained discovery tables** (`ecosystem-architecture/06-source-of-truth-registry.md` +
   `CAPABILITY-LEDGER.md` verified-capabilities table) -> become *prose about* the canonical catalog (A5), not
   the discovery source. The catalog is the machine truth; the tables narrate it. (Same call the manifest
   standard already made; this doc makes the catalog the destination.)
2. **The Capability Reference type** -> a one-row EXTENSION of `V6-KNOWLEDGE-SYSTEM.md sec3.1`, NOT a new doc tree.
3. **This doc itself** is the consolidating index for promotion+discovery — if after ratification the founder
   wants one doc, fold A/B into `CAPABILITY-MANIFEST-STANDARD.md` (the standard) and C/D into the
   platform-readiness sequence, retiring this as a stub. It must not grow into a third lifecycle list.

---

## G. Status & the author-not-equal-verifier gate on THIS doc
DRAFT, authored by lead-architect; **NOT self-certified.** Done (for this DESIGN-ONLY pass) when it: EXTENDS
the cited artifacts rather than regenerating them · reconciles the 10 stages x 7 hops into ONE lifecycle ·
gives the honest auto-gen split (refusing 100% generation) · answers the five discovery questions on BUILT
primitives + the two net-new gates · and is queued for independent review. The founder ratifies: (a) the A2
deterministic reusability trigger, (b) the A5 canonical catalog as a vendored/drift-gated artifact, (c) the
Capability Reference as a knowledge type (B) + the scaffold-and-preserve drift mechanism, (d) the four
fail-closed gates report->enforce sequencing (D), and (e) the co-first roadmap verdict (E). An independent
verifier checks that nothing here forks the spine (no parallel registry/propagation/doc-store) or restates the
canon it cites. **Built is not Adopted:** this design is "adopted" only when the gates run on Admin's own 10
capabilities and the canonical catalog is promoted+vendored — not because this doc exists.
