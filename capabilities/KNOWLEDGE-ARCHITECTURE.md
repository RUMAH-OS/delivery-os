# Knowledge Architecture — The Founder OS Knowledge System (DRAFT, founder ratifies)

> Author: knowledge-engineer (owns the Knowledge Layer). **DRAFT — I design + maintain; I do NOT ratify.**
> Status: design + proposed implementation shape (no big code build this pass).
> Initiative: 2026-06-17 — make company knowledge structured, reusable, EXECUTABLE intelligence, not
> thousands of markdown files.
>
> **This doc owns the SYSTEM design.** Sequencing/migration order is owned by the parallel
> `KNOWLEDGE-MIGRATION-PLAN.md` (lead-architect). Where they touch, the plan defers to this doc for
> structure and to itself for ordering.
>
> **EXTENDS, does not replace:**
> - `FOUNDER-OS-MIGRATION-PRINCIPLE.md` — the founder-LOCKED 6-bucket classifier (project-context / Wiki /
>   Skill / Workflow / Health / Objective) + classify-don't-delete + gradual-no-big-bang.
> - `KNOWLEDGE-LAYER-ARCHITECTURE.md` (V6 board, 2026-06-15) — the KU contract, the proofId/evidence ladder,
>   `knowledge-route`, `knowledge-health`, the trust model, the conditions C1–C6, the named kill-criterion.
> - Live canon: KU frontmatter contract · `knowledge-route.mjs` · `knowledge-health.mjs` · `dispatch-route.mjs`.
>
> **Core founder principle (verbatim governing rule):** *"No markdown file is a permanent destination."*
> Every doc resolves to one+ of: Wiki / Skill / Workflow / Health / Objective / Contract / Archive. Raw docs
> are temporary; structured knowledge is permanent. Goal = ONE canonical answer per concept, not 20 competing
> files.

---

## 0. What is new in this doc (vs the two it extends)
1. Adds **two buckets** to the locked 6 → the canonical **7-bucket structure**: **Contract** (event schemas /
   API contracts / shared models) and **Archive** (raw source, last-resort).
2. Defines the **end-to-end knowledge lifecycle** (Discussion → … → Archive Source) — the rule that the final
   destination is never the original markdown.
3. Designs two new capabilities: the **Knowledge Harvester** (continuous detect+classify+dedup) and the
   **Knowledge Curator** (consolidate+canonicalize+retire+link), with the agent-vs-script split decided and a
   concrete v1 implementation shape proposed for the Harvester.
4. Defines the **retrieval hierarchy** (Skills → Workflows → Health → Objectives → Wiki → Contracts → Archive)
   and how `knowledge-route` should honor it.
5. Designs **adoption enforcement** — the auto-inject-before-execution mechanism and the measure-of-adoption —
   tied to the existing `dispatch-route` + `skill-route` + `knowledge-health`, answering the standing
   `knowledge-adoption-gap` concern.

Everything here inherits the board's honesty bar: **adoption measures influence, never correctness**; a
widely-cited wrong fact is a propagated defect; **author ≠ verifier** governs every promotion; UNMEASURED
fails closed. Knowledge is structurally weaker on the proof axis than skills, and this design says so.

---

## 1. The canonical 7-bucket structure

The locked 6 buckets stand unchanged. This doc adds **Contract** and **Archive**. For every document or
capability, ask which ONE bucket is its PRIMARY home (it may cross-link to others, but it has exactly one
canonical owner — the "one canonical answer per concept" rule).

| # | Bucket | What belongs | Artifact format | Canonical physical home (delivery-os) | Retrieval status |
|---|---|---|---|---|---|
| 1 | **CLAUDE.md** (project-context) | project-specific context + bootstrap/loader (identity, live phase, local pointers). NOT migrated. | thin markdown router per project | `<app>/CLAUDE.md` (STAYS local) | not in the seam (it IS the loader) |
| 2 | **Wiki** | reusable knowledge: architecture, decisions, lifecycles-as-principle, operating principles, playbooks, traps/why/rollback | **KU** (`KU.md` + frontmatter contract) | `delivery-os/wiki/<kuId>/KU.md` | `knowledge-route` (PRESENT) |
| 3 | **Skill** | executable behavior: a repeatable PROCEDURE (invoicing, contact resolution, outreach, verification, incident investigation) | SKILL (`SKILL.md` + skill-frontmatter) | `delivery-os/skills/<skill>/` (+ `.claude/skills/` install) | `skill-route` (PRESENT) |
| 4 | **Workflow** | lifecycle definition: the STATE MACHINE of a business object (lead / tenant / invoice / payment / contract lifecycle) | WORKFLOW (states + transitions + entry/exit + owner per stage) | `delivery-os/workflows/<obj>/` | `workflow-route` (proposed; bucket MISSING-create-when-needed) |
| 5 | **Health** | monitoring logic: what "healthy" means for a seam/system + how it is checked (seam / CI / mail / OAuth / LinkedIn / deployment health) | HEALTH-CHECK (signal + threshold + probe + RED/GREEN) | `delivery-os/health/<concern>/` | `health-route` (proposed; bucket MISSING) |
| 6 | **Objective** | completion logic: success criteria, completion rules, founder-attention models, "what done means" | OBJECTIVE (definition-of-done + acceptance + verifier) | `delivery-os/objectives/<concern>/` | `objective-route` (proposed; bucket MISSING) |
| 7 | **Contract** *(NEW)* | the shared SEAM: event schemas, API contracts, shared data models — the machine-checkable interface BETWEEN systems | CONTRACT (versioned, executable schema + conformance test) | `delivery-os/contracts/<seam>/` | `contract-route` (proposed) — see §1.1 |
| 8 | **Archive** *(NEW)* | raw source markdown after its durable knowledge has been harvested into 2–7; last-resort provenance only | original markdown, frozen, with `promoted-to:` back-links | `<app>/docs/archive/` or `delivery-os/archive/` | last resort only (§5) — never the first hop |

> Numbering note: CLAUDE.md is bucket #1 (project-context, the locked classifier's first row) and is NOT a
> migration target. The **seven STRUCTURED destinations** that "no markdown is permanent" resolves into are
> #2–#8: Wiki / Skill / Workflow / Health / Objective / Contract / Archive. That is the "7-bucket" structure
> in the founder's framing.

**Founder examples placed in their buckets (canonical homes):**

| Bucket | Founder's examples |
|---|---|
| **Wiki** | Founder OS Architecture · Contact Architecture · Health Framework (the framework, not the live checks) · V6 Architecture · Delivery Principles |
| **Skill** | Invoice Lifecycle (execution) · Contact Resolution · Workflow Review · Health Monitoring (the procedure) · Outreach · Incident Investigation |
| **Workflow** | Lead Lifecycle · Tenant Lifecycle · Invoice Lifecycle · Payment Lifecycle · Contract Lifecycle |
| **Health** | Seam Health · CI Health · Mail Health · OAuth Health · LinkedIn Health · Deployment Health |
| **Objective** | Founder Attention model · Completion Rules · Workflow Success Criteria |
| **Contract** | Event Schemas (contract.signed, invoice.generated, payment.received) · API Contracts (Admin /v1/ops read seam, /v1/events drain) · Shared Models (Organisation/Contact/Lead shared-schema) |

> **Trap (one concept, two buckets — resolve, don't duplicate).** "Invoice Lifecycle" appears as BOTH a
> Workflow (the state machine: prepared→issued→sent→paid) and a Skill (the execution procedure that drives a
> transition). They are DIFFERENT concepts: the Workflow is the *definition of legal states/transitions*; the
> Skill is the *how-to that performs a transition*. The Workflow is canonical for "what states exist"; the
> Skill cites the Workflow and is canonical for "how to move". This is the discriminator the Curator enforces
> so we get one canonical answer per concept, not two competing invoice docs.

### 1.1 Why Contract is its own bucket (not Wiki, not Skill)
A Contract is **machine-checkable and bilaterally binding** — it is the only bucket whose violation can be
detected by a conformance test between two systems, not by reading prose. It is not Wiki (Wiki is a claim a
human cites; a Contract is a schema a machine validates) and not a Skill (a Skill is a procedure ONE side
runs; a Contract is the interface BOTH sides honor). It already lives this way in Admin: `admin-plos-seam-v1.mjs`
is an executable contract with a producer-side conformance gate (`seam:check`), and ECR-0006 pins the event
transport. The bucket simply NAMES what is already canonical and routes it through the seam so an agent
touching a cross-system boundary is auto-handed the contract + its conformance test before it writes code.
Evidence-strength for a Contract is the **strongest in the system** (it has an executable fingerprint:
the conformance test passes or fails) — unlike general Wiki knowledge, which caps at CITATION (board C1).

### 1.2 Why Archive is its own bucket (not deletion)
Archive is the operational form of the founder's "promote-AND-preserve / Knowledge-Lost = 0" invariant. When
a markdown file's durable knowledge has been harvested into buckets #2–#7, the source does NOT vanish — it
moves to Archive, frozen, carrying `promoted-to:` back-links to every structured unit it fed. Archive is
**explicitly last-resort in the retrieval hierarchy** (§5): an agent should never reach raw archived markdown
before exhausting the structured layers. Archive exists so the chain is auditable (every KU's `source-file`
resolves) and so harvesting is reversible, not so anyone reads it day-to-day.

---

## 2. Knowledge lifecycle — markdown is never the final destination

The pipeline every piece of knowledge flows through. The invariant: **the final resting place of durable
knowledge is a structured bucket (#2–#7); the original markdown ends in Archive (#8), never as the live
answer.**

```
Discussion → Decision → Implementation → Learning → Knowledge Harvest → Classification
   → Canonical Update → Archive Source
```

| Stage | What happens | Artifact at this stage | Owner |
|---|---|---|---|
| 1. Discussion | a thread/session explores a problem | transcript / scratch notes | the working agents |
| 2. Decision | a choice is made | ADR draft (context·decision·consequences) | knowledge-engineer DRAFTS; founder/decision-maker RATIFIES |
| 3. Implementation | the decision is built | code + the gates that prove it | software-engineer + verifier |
| 4. Learning | a recurring lesson/trap/retro surfaces | `signals.jsonl` entry / retro / postmortem prose | the working agents |
| 5. **Knowledge Harvest** | durable knowledge is detected + extracted from 1–4 | a Harvester classification manifest (candidate units) | **Knowledge Harvester** (§3) |
| 6. **Classification** | each candidate is assigned its ONE canonical bucket; duplicates flagged | classification decision per candidate | Harvester proposes (script+agent); Curator adjudicates |
| 7. **Canonical Update** | the structured unit is created/updated in its bucket, provenance-bound, registered for the seam | KU / Skill / Workflow / Health / Objective / Contract | knowledge-engineer authors; **independent verifier** checks citation (author≠verifier) |
| 8. **Archive Source** | the raw markdown is frozen + back-linked; source STAYS | archived md with `promoted-to:` links | **Knowledge Curator** (§4) |

**Worked example — an ADR flows to canonical knowledge:**
1. A decision is made on invoice numbering timing → I DRAFT `docs/adr/00NN-invoice-number-timing.md`
   (context·decision·consequences). I do not ratify.
2. Founder ratifies → ADR status ACCEPTED.
3. Implementation lands behind the relevant gate.
4. Harvest: the Harvester detects the ratified decision as durable knowledge.
5. Classification: the rule "invoice numbers are assigned at ISSUE, never at prepare" is a **non-obvious
   constraint** → primary bucket **Wiki (KU)**; the *prepared→issued transition* updates the **Workflow**;
   the *number format* may bind a **Contract** if a consumer reads it.
6. Canonical Update: I author `wiki/ku-invoice-number-at-issue/KU.md` with `source-provenance.earned-from`
   pointing at the ADR + its git-sha; an independent verifier re-finds the `cited-quote` in the ADR at that
   sha. The KU is registered → retrievable via `knowledge-route`.
7. Archive Source: the ADR STAYS in `docs/adr/` (ADRs are themselves a durable record), and gets a
   `promoted-to: [ku-invoice-number-at-issue]` back-link. If instead the source were a one-off scratch memo,
   it would move to Archive. **Knowledge-Lost = 0.**

The same flow runs for a retro (→ KU + possibly a Skill), a postmortem (→ Health check + KU), a seam decision
(→ Contract + KU). The constant: prose is the INPUT, structured units are the OUTPUT, and the seam — not a
raw Read — is how execution reaches the output.

---

## 3. Knowledge Harvester — capability design + proposed v1 implementation

**Mission.** Continuously turn the markdown sprawl into classified candidate knowledge so the canonical base
*continuously improves* instead of accumulating prose. It is the engine that operationalizes "no markdown is
a permanent destination."

**Responsibilities.**
1. Scan markdown across repos (Admin, PLOS, delivery-os, ecosystem-architecture).
2. Detect durable knowledge (a non-obvious claim/trap/why/rollback/decision/lifecycle/contract) vs transient
   chatter.
3. Classify each detected unit into one of the 7 buckets (#2–#8).
4. Detect duplicates / near-duplicates against the existing canonical base.
5. Propose canonical / Skill / Workflow updates (create-new vs update-existing vs supersede).
6. Propose archival of fully-harvested sources.
7. Run continuously (on a cadence / at slice-close), so the base improves over time.

### 3.1 The agent-vs-script split (DECIDED)
The dividing line is **judgment vs determinism** — the same line the board drew between LLM scoring and the
deterministic `knowledge-route` ranker.

| Capability | Owner | Why |
|---|---|---|
| filesystem scan, file inventory, change-detection since last run | **SCRIPT** (`knowledge-harvester.mjs`) | deterministic, re-runnable, zero judgment |
| content hashing (per-file + per-section `contentHash`) | **SCRIPT** | reuses `computeContentHash` from `knowledge-route` |
| title/heading + shingle similarity → duplicate CANDIDATE flags | **SCRIPT** | string math, no semantics; surfaces *candidates*, never decides |
| coverage check: is this concept already a registered unit? (route the file's title/triggers through `knowledge-route`/`skill-route`; a strong hit = already covered) | **SCRIPT** | reuses the existing routers — no new scorer |
| "is this durable knowledge or transient chatter?" | **AGENT** (knowledge-engineer pass) | semantic judgment — the board's inclusion test (noun-strip + non-obvious + has-trigger) |
| "which of the 7 buckets is the canonical home?" | **AGENT** | semantic classification |
| "is this a TRUE duplicate of KU-x, or a distinct concept that merely shares words?" | **AGENT** (adjudicates the script's candidate flags) | the invoice Workflow-vs-Skill trap (§1) is exactly this judgment |
| "create new vs update vs supersede existing canonical?" | **AGENT** | judgment, gated by author≠verifier |

**Rule:** the script never *decides* — it *narrows*. It emits a manifest of candidates with deterministic
signals; the agent pass turns candidates into classified, deduped proposals. This keeps the expensive
judgment scarce and the cheap scanning continuous, and it keeps every decision attributable (the manifest is
the evidence trail).

### 3.2 Proposed v1 implementation shape
Two artifacts, composed — mirroring the existing scanner-then-router pattern:

**(a) `delivery-os/templates/tools/knowledge-harvester.mjs`** (OS-owned, vendored, drift-gated — same
placement rule as `knowledge-route`). Zero-dep ESM, Windows-safe, fail-closed, with `--self-test`. It:
- walks a configured set of roots; skips `node_modules`, `.git`, already-archived dirs;
- for each markdown file emits a candidate record:
  ```jsonc
  {
    "path": "<abs>", "title": "<h1>", "sections": [{ "heading": "...", "contentHash": "..." }],
    "fileHash": "<sha256/16>", "lastHarvestedHash": "<prev|null>",   // change-detection
    "alreadyCovered": { "bucket": "wiki", "unitId": "ku-...", "score": 12.0 } | null,  // via existing routers
    "dupCandidates": [{ "unitId": "ku-...", "similarity": 0.81, "via": "shingle" }],   // narrows, never decides
    "signals": { "hasDecision": true, "hasTrap": false, "hasLifecycle": false }       // cheap regex heuristics
  }
  ```
- writes the manifest to `knowledge-harvest-manifest.jsonl` (re-runnable; one line per file);
- prints a summary: N scanned · N changed-since-last · N already-covered · N dup-candidates · N uncovered.
- **Adoption-honest by construction:** "uncovered + durable-signal" files are the *backlog of unconverted
  prose* — the same disease `classifyDormant` measures for KUs, now measured for the whole corpus. This is the
  numeric answer to the `knowledge-adoption-gap` "1.7MB, none measured-retrievable."

**(b) The agent pass (knowledge-engineer, invoked on the manifest).** Reads the manifest, applies the board
inclusion test, classifies each uncovered/changed candidate into a bucket, adjudicates dup-candidates, and
emits **proposals** (never auto-commits):
- `PROMOTE → wiki/<kuId>` (new KU) | `UPDATE <unitId>` | `SUPERSEDE <unitId> WITH <new>` |
  `PROPOSE-SKILL <name>` (when a unit prescribes a repeatable procedure — I PROPOSE; earning a skill stays
  gated) | `ARCHIVE <path>` (fully harvested) | `MERGE <a,b> → <canonical>` (hands to the Curator) |
  `NO-ACTION` (transient/obvious).
- every proposal carries `source-provenance` and is **queued for independent verification** — a proposal is
  not adopted because the Harvester emitted it.

**Cadence (continuous improvement).** Run the script at slice-close and on a daily cadence; run the agent
pass on a review rhythm (e.g. weekly, or when the script reports `uncovered-durable > threshold`). The
script's change-detection means re-runs are cheap and only surface deltas, so the canonical base improves
incrementally without a big-bang sweep — honoring the gradual / no-big-bang rule.

> **Gating reconciliation.** v1 is **scan + propose only**. It does NOT auto-write canonical units, does NOT
> mass-promote the 21 memory files + 76 signals (the board's explicit warning), and respects admin-first: it
> runs on Admin's corpus during the proving phase. Physical promotion-to-shared stays gated on ≥2-app reuse +
> contentHash lock. The Harvester makes the backlog *visible and classified*; humans/verifiers still gate
> what becomes canonical.

---

## 4. Knowledge Curator — capability design

**Mission.** Keep the canonical base ONE-answer-per-concept: consolidate, merge, version, retire, and
maintain the link graph. Where the Harvester grows the base, the Curator keeps it from fragmenting. (Both are
hats the knowledge-engineer wears; naming them separates "find + classify" from "consolidate + maintain".)

**Responsibilities.**
1. **Consolidate duplicates** — when the Harvester flags true duplicates, collapse to ONE canonical unit;
   the loser is redirected (a stub with `superseded-by:` / `see:` pointing at the canonical), not deleted.
2. **Merge overlapping learnings** — two KUs covering one concern from different angles merge into one richer
   canonical unit (union of triggers, strongest evidence, single claim).
3. **Maintain canonical versions** — own the `supersedes` chain; exactly one `status: active` unit per
   concept; older versions `status: superseded` (excluded by `knowledge-route`'s loader, already implemented).
4. **Prevent fragmentation** — enforce the discriminator rules (e.g. Workflow-vs-Skill, §1) so a new unit is
   *rejected or merged* if it duplicates an existing concept rather than admitted as a 21st competing file.
5. **Retire obsolete artifacts** — mark units whose claim is no longer true `status: retired` with a reason +
   `superseded-by` (if replaced) or an Archive move (if simply obsolete). Retirement is provenance-preserving.
6. **Maintain the reference graph** — keep `related: [[links]]` bidirectional and resolvable; no dangling
   links; `unknownCited[]` from `knowledge-health` is the Curator's worklist (citations to non-existent units).

**Mechanism (reuse, don't reinvent).**
- The Curator's *detection* inputs are already produced: `knowledge-health --json` gives `installed[]` (the
  authoritative roster), `unknownCited[]` (dangling links), `staleCited[]` (cited-at-wrong-hash), and DORMANT
  units (never retrieved). The Harvester's `dupCandidates` feed merge decisions.
- The Curator's *actions* are author≠verifier-gated edits: a merge/supersede/retire is a knowledge change that
  an independent verifier checks (the surviving unit's citations still re-find at hash).
- **Curation is measured, not assumed:** "duplicate concepts in the base" and "dangling links" are health
  metrics; the Curator's job is to drive them toward zero, and `knowledge-health` reports whether it did.

> **One canonical answer per concept** is the Curator's single KPI. The Harvester can propose 5 candidates
> for "invoice numbering"; the Curator guarantees exactly one survives as canonical and the other four
> redirect to it.

---

## 5. Retrieval hierarchy — the standard order

When an agent needs knowledge for a task, the system consults buckets in this PRIORITY order. Higher buckets
are more *actionable* and more *proven*; raw markdown is the last resort.

```
1. Skills        — a proven repeatable PROCEDURE for this task?           (most actionable)
2. Workflows     — the lifecycle/state-machine governing this object?
3. Health        — the monitoring contract for this concern (what healthy means)?
4. Objectives    — the definition-of-done / success criteria / attention model?
5. Wiki          — the reusable claim/principle/trap (the KU)?
6. Contracts     — the seam schema/API/model this work must honor?
7. Archive       — raw markdown.  LAST RESORT ONLY.                        (least proven)
```

**Rationale for the order.** Skills first because a proven procedure subsumes the knowledge inside it (the
board's `Knowledge → Skills → Agents → Execution` direction). Workflow/Health/Objective next because they
constrain *what valid execution looks like* (states, healthy, done) before you act. Wiki fifth because a KU
informs but does not prescribe a procedure — it caps at CITATION strength (board C1), weaker than an
executable Skill or Contract. Contracts are sixth not because they are weak — they are the strongest
(executable fingerprint) — but because they are *conditionally relevant*: only cross-system/seam work needs
them, so they are consulted when the task touches a boundary rather than always. Archive is last by
definition: reaching raw markdown means the structured layers had no answer — itself a signal to the
Harvester that a unit is missing.

> **Conditional-relevance note.** The order is the *default priority when multiple buckets match*; it is not
> "always check Skills before anything else regardless of relevance." A seam task with no matching Skill goes
> straight to Contract. The router scores relevance per bucket; the hierarchy breaks *ties* and sets *which
> match wins when several fire*.

**How `knowledge-route` should honor it.** Today `knowledge-route` ranks within ONE corpus (Wiki KUs). The
proposed evolution — implemented by `dispatch-route`, which ALREADY composes the routers — is a
**multi-corpus router with bucket-priority tie-breaking**:
1. Each bucket gets a loader + the SAME deterministic scorer (the concern-agnostic ranker is already reused
   verbatim across `skill-route`/`knowledge-route`/`agent-route` — no new scorer).
2. Route the task through all available bucket-routers; collect each bucket's top match + score.
3. Resolve by **(relevance score, then bucket-priority)**: a strong Skill match beats a weak Wiki match on
   score; equal/near-equal scores break by the hierarchy above. This avoids "Skills always win even when
   irrelevant" while still preferring the more actionable bucket when both are relevant.
4. Emit ALL relevant matches (not just the winner) into the dispatch plan, ordered by the hierarchy, so the
   agent receives the Skill AND the Workflow AND the Objective AND the KU it needs — see §6.
5. A raw `Read` of archived markdown writes NO selection record → counts as zero (fail-closed by
   construction). Reaching Archive is observable as a *miss*, which feeds the Harvester backlog.

> Buckets 4–7 (Workflow/Health/Objective routers) are MISSING today (create-when-first-needed, per the
> migration principle). The hierarchy is the contract those routers will satisfy when their bucket gets its
> first real unit; until then `dispatch-route` composes the buckets that exist (Skill + Knowledge + Contract).

---

## 6. Adoption enforcement — the critical part

This is the answer to the standing `knowledge-adoption-gap` concern: the live model is still
`Markdown → Claude → Execution`; knowledge exists but is not measured-retrievable; skills are
built-not-adopted (2 triggers ever, 12/14 idle). Enforcement has two halves: **auto-injection before
execution** and **measurement of adoption**.

### 6.1 Auto-injection before execution (the forcing function)
**Goal (founder's example):** an agent working on invoices AUTOMATICALLY receives the Invoice Skill +
Workflow + Objectives + Health (+ relevant Contract + KU) BEFORE it executes — not by remembering to look.

**Mechanism — extend `dispatch-route` (the spine already exists).** `dispatch-route.mjs` is already a
"thin COMPOSER over the four routers" that, per dispatch: selects the agent, resolves the required owner,
routes skills + knowledge, mints proofIds + injection markers, and **emits a DispatchPlan + a verbatim
`spawnPrompt` with the markers + bodies inlined and a consult-and-cite instruction.** The enforcement design
is to widen this composer from 2 knowledge buckets (Skill + Knowledge) to all retrievable buckets, honoring
the §5 hierarchy:

1. **Detect the work-type** of the task (it already does this via `ownership-policy.detectWorkTypes` —
   "invoices" is a known work-type).
2. **Route every relevant bucket** for that task (Skill, Workflow, Health, Objective, Contract, Wiki), top-k
   each, ordered by the hierarchy.
3. **Inline them into the `spawnPrompt`** with their retrieval markers (`[knowledge:…]`, `[skill:…]`, and new
   `[workflow:…]`/`[health:…]`/`[objective:…]`/`[contract:…]` markers on the same convention) so the
   injection is provable-by-construction (marker in the transcript's first record = K2 injection).
4. **The orchestrator (Claude) spawns with that prompt.** HONEST CEILING (unchanged from G9): the tool does
   not spawn; it collapses discretion into a deterministic plan + verbatim prompt. The forcing function is
   that the *plan is the prompt* — the agent literally cannot start without the injected bucket bodies in
   context.
5. **Conformance, not hope.** `dispatch-route --conformance` already joins the dispatch-log to the
   actually-spawned agent and flags DEVIATION. Extend the same join to flag a dispatch that touched a
   work-type WITHOUT injecting that work-type's available canonical units (e.g. invoice work spawned with no
   Invoice Workflow injected though one exists) = an **injection gap**, reported.

> **Firewall (board C2, preserved — HARD).** Injection is NOT adoption. `skillsInjected`/`kusInjected` are
> written to `dispatch-log.jsonl`, which `skill-health`/`knowledge-health` NEVER read. Auto-injecting a KU
> does not increment its trust or move it up a rung. Trust is earned only by content-bound citation@hash
> verified by an independent party. This design adds NO path that lets an injection count touch a rung. So
> "we auto-inject everything" can never masquerade as "everything is adopted."

### 6.2 Measurement — which knowledge is used / ignored / obsolete / unadopted
The system must answer four questions; each maps to an existing or extended metric:

| Question | Metric | Mechanism (existing → extension) |
|---|---|---|
| Which units are **USED**? | content-bound citations@hash, verified, per unit | `knowledge-health` trust ledger (verified influence events) — already designed |
| Which units are **IGNORED** (injected but never cited)? | injected-count vs cited-count per unit | join `dispatch-log` (injected) ⟂ `knowledge-selections`/citations (cited); high-injected + zero-cited = ignored despite being handed over |
| Which units are **OBSOLETE**? | DORMANT (never retrieved) + retired + cited-at-wrong-hash | `classifyDormant` (board) + Curator `status: retired` + `staleCited[]` |
| Which **learnings are UNADOPTED** (durable prose never converted)? | uncovered-durable count from the Harvester manifest | `knowledge-harvester.mjs` "uncovered + durable-signal" backlog (§3.2) |

**Adoption must be a RATIO, not a count (board C2).** Adoption = (knowledge-relevant tasks that retrieved +
cited a unit) / (knowledge-relevant tasks). A small green count is NOT adoption; non-adoption renders **RED**.
The denominator is the set of dispatches whose work-type HAD an available canonical unit. UNMEASURED fails
closed (`knowledge-health` exits 2). This is precisely what turns "2 triggers ever, 12/14 idle" from a
footnote into a RED gate.

**Idle/obsolete flagging (forcing-function direction, admin-first).** Per the admin-first-proof directive
(flip report-only gates to enforcing), the staged escalation is:
- **now (report-only):** `knowledge-health` reports the IGNORED / DORMANT / UNADOPTED sets every slice-close
  and milestone (the standing Operating-Model-Check rhythm).
- **next (forcing):** a learning-bearing slice cannot close DONE until its lesson is promoted-or-waived (the
  board's census-pressure gate — the knowledge analog of anti-idle); a dispatch that ignores an available
  canonical unit for its work-type is a reported injection gap that must be acknowledged.
- **the kill-criterion stands:** if the only way to green adoption is to count bare retrievals (K1) as
  "adoption," it failed. Adoption requires verified content-bound influence.

### 6.3 Reconciliation with the gating
- **Gradual / no-big-bang:** enforcement is *wired report-only first*, escalated to forcing only as buckets
  fill and the chain is proven on ONE unit (the board's smallest-proving-slice + named kill-criterion).
- **Admin-first / post-V6 / N=1:** all of this runs in Admin (the proving ground). The tools' canonical home
  is `delivery-os/templates/tools/` (vendored, drift-gated), but promotion-to-shared and any PLOS coupling
  stay gated (board C5 DECOUPLED PLOS; the migration plan owns when). Nothing here couples PLOS.
- **Contract/canon already live:** zero forks of the spine — reuse `knowledge-route`, `dispatch-route`,
  `knowledge-health`, the proofId/marker/contentHash conventions, the KU frontmatter contract, author≠verifier.

---

## 7. Cross-links
- Migration sequencing/order: **`KNOWLEDGE-MIGRATION-PLAN.md`** (lead-architect, parallel) — this doc owns
  the SYSTEM; that doc owns WHEN.
- Locked classifier + classify-don't-delete + gradual rule: `FOUNDER-OS-MIGRATION-PRINCIPLE.md`.
- KU contract, proofId/evidence ladder, trust model, conditions C1–C6, kill-criterion:
  `KNOWLEDGE-LAYER-ARCHITECTURE.md`.
- The gap this enforcement closes: `KNOWLEDGE-ADOPTION-GAP.md` + memory `knowledge-adoption-gap`.
- Live tools this builds on: `.claude/os/tools/knowledge-route.mjs` · `dispatch-route.mjs` ·
  `scripts/knowledge-health.mjs` · the executable seam contract `admin-plos-seam-v1.mjs` (the Contract bucket
  exemplar).
- Completeness + operational-proof bars every new capability must clear: KUs
  `ku-implemented-is-not-operationally-proven`, `ku-verify-seam-by-one-real-round-trip`.

## 8. Status & the author≠verifier gate on THIS doc
This is a **DRAFT design**, authored by the Knowledge-Layer owner. It is NOT self-certified. It is done (for
this pass) when: structured (this 7-bucket contract) · provenance-bound (extends the two locked docs,
cross-linked) · non-duplicative (one architecture doc; the migration plan is its sibling, not a competitor) ·
and **queued for independent review** — the founder ratifies the 7-bucket structure + the Harvester/Curator
split; an independent verifier checks that the proposed tool shapes reuse the spine without forking it.
**Built ≠ Adopted:** this architecture is "adopted" only when the Harvester/dispatch enforcement is wired and
`knowledge-health` shows real retrieval + citation in execution — not because the doc exists.
