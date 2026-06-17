# Knowledge Migration Plan — from sprawling markdown to executable Founder OS intelligence

> **Status: DRAFT (founder ratifies).** Foundational, not a backlog item (founder, 2026-06-17).
> Planning only — no code in this document.
> **Authorship split:** the knowledge-engineer owns the **WHAT** (the 7-bucket structure, lifecycle,
> Harvester, Curator, retrieval hierarchy, enforcement) in KNOWLEDGE-ARCHITECTURE.md (in-progress,
> referenced forward). THIS document (lead-architect) owns the **HOW / WHEN / RISK** — the sequence,
> the gates, the reversibility, the reconciliation with standing doctrine.
> **Canonical predecessors this REUSES (does not re-decide):**
> - KNOWLEDGE-LAYER-ARCHITECTURE.md — the V6 board outcome (APPROVE-WITH-CONDITIONS): the KU model, the
>   knowledge-route seam, the evidence ladder (K1..K7), the trust model, the named kill-criterion, the
>   smallest proving slice. That board outcome is the spine; this plan schedules its execution at scale.
> - FOUNDER-OS-MIGRATION-PRINCIPLE.md — the 6-bucket classifier (this adds **Contract** + **Archive** = 7)
>   and the classify-dont-delete / gradual / no-big-bang / gated-post-proof rule.
> - CAPABILITY-LIFECYCLE.md + CAPABILITY-LEDGER.md — the ONE promotion path (file-lesson -> census-detector
>   -> ledger -> build-canonical -> os-release -> os-inherit). The Harvester is the industrialized front of
>   THIS loop, not a parallel mechanism.

---

## 0. The one-paragraph thesis

Today the company durable intelligence lives as ~1.7 MB of unindexed markdown (ADRs, decisions, reviews,
audits, memories, postmortems, architecture docs, handoffs) read raw by Claude — the
Markdown -> Claude -> Execution model the V6 board diagnosed as the accumulation disease. The target is
Knowledge -> Retrieval -> Citation -> Trust -> Skills -> Agents -> Execution, where durable learning lives as
**structured, retrievable, measured** units in **delivery-os canonical**, apps **consume** it via os-inherit
+ the knowledge-route seam, and the originating markdown is **archived (never deleted)** once its durable
content is harvested. We get there by **harvesting**, not big-bang migration: a Harvester continuously
classifies sources into 7 buckets and proposes structured units; a Curator reviews, dedups, promotes, and
retires; enforcement makes retrieval mandatory-and-measured; and the whole thing is **reversible and gated**
behind the existing post-V6-proof + N=1 gates.

---

## 1. Current markdown inventory (METHOD, not a file list)

I do not enumerate the corpus here — the Explore/Harvester agents produce the live list. I own the
**method** and its **freshness guarantee**.

**Scope (fan-out, 3 corpora):**
- **rumah-admin/** — docs/ (ADRs, decision-reviews, retrospectives, ~100 verify docs, slice records,
  migration evidence) + .claude/ skills/agents + project memory.
- **ecosystem-architecture/ + delivery-os/** — ECRs, the registry, governance/operating-loop, the
  capabilities/ G-docs + assessments, wiki/ KUs, skills/, signals.jsonl.
- **property-lead-os/** — ADRs, capability-backlog, v6-adoption-status (READ-ONLY for inventory; PLOS is
  frozen as a target — see section 7).

**Inventory method (the Harvester classification pass):**
1. **Enumerate** every .md + the structured corpora (signals.jsonl, memory files) across the 3 roots.
2. **Fingerprint** each: path, git-sha-at-scan, contentHash, last-touched, size, owning project-tag.
3. **Classify** each into exactly ONE of the 7 buckets (section 2) with a confidence score + one-line
   rationale. Low-confidence (below threshold) is parked as UNCLASSIFIED for human triage — the Harvester
   never silently guesses on ambiguous, load-bearing docs.
4. **Detect durable signal**: does the doc carry a non-obvious, reusable claim (a trap/why/rollback), or is
   it a point-in-time artifact (a dated review, a handoff)? Drives bucket = Wiki/Skill/Workflow vs
   Contract/Archive.
5. **Emit a manifest** (knowledge-inventory.jsonl) — the addressable, diffable census. This IS the
   inventory; the prose list is a rendering of it.

**How it stays current (the freshness guarantee):** the inventory is NOT a one-time spreadsheet. The
Harvester **re-runs** (per-slice-close + per-milestone, section 4) over the same roots. Each entry is keyed
by path + contentHash, so a re-run produces a **diff**: new (un-harvested), changed (content moved past its
harvested sha -> re-harvest), harvested (already a unit, source eligible for Archive), archived. **Inventory
drift = new/changed entries with no corresponding unit** — surfaced as census-pressure (section 5), never
silently accruing. This is the structural fix for learning-accumulates-as-prose: prose that recurs without
converting now shows up as a failing diff.

**Expected volume / sources (order-of-magnitude, from the gap report):** ~192 files in Admin docs/ (incl.
~100 verify docs — most point-in-time -> **Archive/Contract**, NOT Wiki), 21 memory files, 7+ OS capability
docs, 76+ lesson signals, plus ECRs and PLOS ADRs. **Critical expectation to set with the founder up front:
durable-knowledge yield is a SMALL fraction of the byte count.** Most verify docs, dated reviews, handoffs
are point-in-time -> Archive. A successful harvest produces tens of high-trust units, not a 1.7 MB Wiki.
(The board already forbade 1.7-MB-is-adopted-knowledge.)

---

## 2. Target knowledge architecture (7 buckets — reference; KE owns the detail)

The canonical structure is defined in KNOWLEDGE-ARCHITECTURE.md. The **7-bucket classifier** (the founder 6
+ **Contract** + **Archive**) and **where each physically lives + how apps consume it**:

| # | Bucket | Holds | Physical home | App consumption |
|---|---|---|---|---|
| 1 | (stays local) project-context | per-app facts/config | each app CLAUDE.md | not migrated — STAYS |
| 2 | **Wiki** (KU) | reusable knowledge: architecture, decisions, lifecycles, principles, playbooks, traps | delivery-os/wiki/ | knowledge-route seam (inherited tool) |
| 3 | **Skill** | executable behavior: invoicing, onboarding, matching, verification | delivery-os/skills/ | skill-route seam + os-inherit |
| 4 | **Workflow** | lifecycle definitions (lead/invoice/contract/tenant/payment) | delivery-os/ workflow struct (create-when-first-needed) | os-inherit |
| 5 | **Health** | monitoring logic (seam/workflow/company health) | delivery-os/ health struct (create-when-first-needed) | os-inherit |
| 6 | **Objective** | completion logic (DoD, success criteria, attention models) | delivery-os/ objective struct (create-when-first-needed) | os-inherit |
| 7 | **Contract** (NEW) | binding cross-system facts: ECRs, executable seam contracts, ratified decisions, ADRs of record | delivery-os (seam) + ecosystem-architecture/decisions/ | os-inherit (vendored, drift-gated) |
| 8 | **Archive** (NEW) | point-in-time records whose durable content is harvested: dated reviews, verify docs, retrospectives, handoffs, postmortems | source-root/_archive/ (in place) | last-resort retrieval ONLY (section 6) |

**Why Contract is its own bucket and not Wiki:** a Contract is binding and versioned (an ECR, a seam schema,
a ratified ADR), not advisory reusable knowledge. It changes behavior by obligation, retrieved through the
executable-contract path (already vendored/drift-gated), not the advisory knowledge-route ranker. Conflating
it with Wiki would let a binding obligation be treated as a soft hint. **One source of truth per concern**
(architect rule): ECRs stay canonically in ecosystem-architecture/decisions/; the Wiki cites them, never
re-states them.

**Where it physically lives + how apps consume (the load-bearing reconciliation):** the canonical home is
**delivery-os**. Admin and PLOS do **NOT** maintain their own copies — they **inherit** the seam tools
(knowledge-route, knowledge-health) via os-inherit (vendored + drift-checked) and retrieve canonical units at
runtime. **Transitional exception (matches admin-first-proof):** during the proving phase a unit may be
app-local in Admin with promotion-to-shared gated on >= 2-app reuse + contentHash lock (the board Placement
rule). So: **seam = OS-owned now; corpus = app-local-until-proven, then promoted.**

---

## 3. Required capabilities (and the build sequence — architect de-risking order)

Five capability pieces. The KE designs the Harvester + Curator internals; I own **which is built first and
why** (riskiest-unknown-first; thin slice reaches the real target early).

| Order | Capability | Owner | What it does | Why this position |
|---|---|---|---|---|
| **0 (DONE)** | Retrieval seam knowledge-route + knowledge-health | board / Admin | only observable path to a KU; mints proofId, contentHash, marker; fail-closed | Already built (Admin .claude/os/tools/). The spine exists — everything hangs off it. |
| **1** | Curator (manual-assist first) | knowledge-engineer | reviews proposals, dedups, promotes via lifecycle, retires sources | BEFORE the Harvester scales. The dangerous failure is bad units entering canonical, not slow harvesting. The Curator is the author!=verifier gate that makes any harvest safe. Firehose before filter is the mis-sequence this plan blocks. |
| **2** | Harvester (report-only) | knowledge-engineer | the inventory + classification + proposal engine of section 1 | AFTER the Curator gate exists. Report-only first: emits a manifest + proposals, mutates nothing. Proves classification quality before it drives promotion. |
| **3** | Enforcement (census-pressure -> mandatory retrieval) | KE + lead-architect | unpromoted recurring signal fails slice-close; raw-Read coverage denominator | Staged report-only -> enforcing (section 5). Enforcement before proven retrieval quality = adoption theater. |
| **4** | Retirement / Archive (Curator retires sources) | knowledge-engineer | classify -> harvest -> archive with back-links; last-resort retrieval | LAST. A source is archived only after its durable content is a trust-bearing unit. Archiving before harvest = the premature-deletion risk. |

**The de-risking order in one line:** prove the SEAM (done) -> build the FILTER (Curator) -> build the
FIREHOSE report-only (Harvester) -> make usage MANDATORY (enforcement, staged) -> only then RETIRE sources.
Deliberately the inverse of the tempting mass-harvest-then-sort order.

**Waterline Rule applied:** the seam + Harvester + Curator + enforcement are the variant-neutral spine
(OS-canonical, every project inherits). The 7-bucket content is the variant. Do NOT build the
Workflow/Health/Objective structures now — create-when-first-needed (migration-principle rule); the Harvester
may TARGET those buckets in classification, but the structure is born when a real unit needs it.

---

## 4. Knowledge harvesting process (the operating loop)

The CAPABILITY-LIFECYCLE.md loop, industrialized for documents. **No parallel mechanism** — the Harvester
FEEDS the existing census-detector -> CAPABILITY-LEDGER -> build-canonical -> os-inherit spine.

**When harvesting runs (layered cadence):**
- **Per-slice-close (incremental):** re-scan only new/changed sources touched this slice. A learning-bearing
  slice cannot close DONE until its lesson is harvested-or-explicitly-waived (the knowledge analog of
  anti-idle).
- **Per-milestone (full sweep):** learning-review (already mandatory post-milestone) triggers a full
  re-inventory diff — where accumulated drift is burned down and Archive candidates surface.
- **Continuous is NOT a goal.** Slice-close + milestone is sufficient and avoids a poller manufacturing fake
  adoption (the trust model forbids retrieval-count-as-adoption). Harvesting is proposal generation (cheap);
  promotion is the expensive, gated step.

**Who reviews proposals (author!=verifier for canonical updates):** the Harvester **proposes**; it **cannot
self-certify** into canonical. Promotion requires the Curator + an independent verifier (CODEOWNERS /
verify-gate on the wiki/ + canonical paths). Contract-bucket items (ECRs/ratified decisions) take the higher
bar: the existing section-11 / ECR ratification path. The knowledge-engineer drafts/maintains, never
self-certifies (its charter) — bound here mechanically.

**How a harvested learning becomes a KU / Skill / Workflow with a citation back to source
(promote-AND-preserve; Knowledge-Lost = 0):**

    source.md (durable claim detected)
      -> NOMINATE     Harvester emits a proposal {bucket, candidate-unit, source-file, anchor, git-sha, contentHash, signal-pattern}
      -> DISTILL      Curator authors ONE unit (wiki KU | skill | workflow) with retrieval triggers
      -> BIND PROVENANCE  unit frontmatter: {earned-from, source-file, anchor, git-sha-at-promotion, signal-pattern}
                          AND source.md gets a promoted-to back-link (promotion is NEVER deletion)
      -> VERIFY       independent verifier re-finds the cited quote in source-file AT the recorded git-sha (fail-closed)
      -> REGISTER     unit added through the seam so retrieval is observable + measured
      -> (LATER) ARCHIVE  once the unit is trust-bearing, the redundant point-in-time source is archived (section 6)

The unit carries its provenance; the source is reachable until archived; archive keeps it as last-resort.
**Inclusion test (board, gateable):** admissible iff it (1) survives noun-stripping as a 2nd-app lesson OR is
explicitly applies-to:[this-app], AND (2) names a non-obvious claim with >= citation-strength backing, AND
(3) carries a retrieval trigger. Everything failing this is **Archive**, not Wiki.

---

## 5. Enforcement strategy (mandatory + measured — the founder forcing-function pattern)

Knowledge usage becomes mandatory the way agent adoption did: **auto-serve + measure + stage from report-only
to enforcing.** This plan does NOT invent new measurement — it schedules the board model.

**Make usage mandatory (auto-serve, pre-execution):** when the orchestrator dispatches an agent for a
knowledge-relevant task, it routes the task through knowledge-route and embeds the retrieval **marker** in the
spawned agent prompt VERBATIM (K2 injection, provable by construction). The agent receives the relevant KU
pre-execution — it does not have to remember to look. Raw Read on a .md writes no record and counts as
**zero** (fail-closed by construction — the seam is the only observable path).

**Measure (used / ignored / obsolete / unadopted)** via knowledge-health + dispatch-route:
- **used** = retrieved (K1) AND content-bound-cited at the retrieved hash (K3, verified). Trust = count of
  INDEPENDENTLY-VERIFIED influence events — never retrieval count (the cheapest, most farmable signal).
  Adoption is a **RATIO** (retrievals / knowledge-relevant tasks) so non-adoption renders **RED**, not a small
  green count (board condition C2).
- **ignored** = relevant task ran, no retrieval (the coverage denominator catches it).
- **obsolete** = superseded by a newer version (supersedes chain) or cited-at-wrong-hash
  (staleCited / version-mismatch).
- **unadopted (DORMANT)** = a promoted KU never retrieved — the prose-that-never-converted disease, now
  measured. UNMEASURED fails closed (exit 2).

**The staged forcing-function (report-only -> enforcing):**

    Stage A  HARVEST report-only   — Harvester emits manifest + proposals; nothing promoted automatically.   [START NOW]
    Stage B  RETRIEVAL report-only — knowledge-health measures retrieval/citation ratios; surfaces RED; no block. [START NOW]
    Stage C  PROVE the chain       — board smallest slice on ONE KU: retrieved->injected->cited@hash->(value-binding). GATE: the named kill-criterion.
    Stage D  ENFORCE census        — unpromoted recurring signal (>=3 sources / >=2 projects) FAILS slice-close.
    Stage E  ENFORCE coverage      — knowledge-relevant task with no retrieval FAILS the gate (raw-Read coverage denominator).

**The gate between B and D is the board NAMED KILL-CRITERION:** if an independent verifier cannot establish
content-binding ABOVE citation strength on at least one real KU, the layer is NOT proven, the slice is KILLED,
no enforcement and no PLOS coupling proceed, and the honest claim reverts to knowledge-is-stored,
retrieval-is-loggable, influence-is-unproven. **No stage flips to enforcing on a count of bare retrievals**
(secondary kill). This is the anti-adoption-theater interlock.

---

## 6. Retirement strategy (safe archival — never delete)

Founder-aligned (classify-dont-delete) and board-aligned (Knowledge-Lost = 0):

**classify -> harvest -> archive (never delete).** A source is eligible for Archive ONLY when:
1. its durable content is harvested into a registered, **trust-bearing** unit (not merely promoted — it must
   have survived the verify step), AND
2. the source carries a promoted-to back-link to that unit, AND
3. the unit carries earned-from provenance pointing back at the source + git-sha.

When all three hold, the **Curator** moves the source to source-root/_archive/ **in place** (each repo keeps
its own archive — archives are NOT centralized; that would itself be a lossy migration). The source is
preserved byte-for-byte; only its location changes, as a tracked git operation.

**Archive = last-resort retrieval rule:** archived sources are NOT in the knowledge-route corpus and do NOT
rank in normal retrieval (their durable content now lives in the unit that DOES rank). Reachable only by
explicit path lookup — the fallback when someone needs the original point-in-time context. Keeps the
retrieval surface small and high-signal while losing nothing.

**The Curator also retires OBSOLETE units** (not just sources): a KU superseded by a newer version is marked
via the supersedes chain so only the one canonical current answer per concern ranks; the old version is kept
for provenance/audit but de-ranked. One source of truth per concern, enforced mechanically.

**Data-loss safeguards (defense in depth):**
- **No delete, ever** — Archive is a move, in git history; recoverable.
- **Promote-AND-preserve precondition** — archival is GATED on a verified back-linked unit; you cannot
  archive un-harvested content.
- **Trust precondition** — archival requires the harvested unit to be trust-bearing (verified influence),
  not merely exists; never archive behind a dormant/fabricated unit.
- **Reversible** — nothing deleted + bidirectional back-links, so any archival/promotion walks back to the
  original source at its git-sha.
- **Founder waiver** — any source the founder marks load-bearing-as-prose stays in place regardless of
  harvest state (no machine over-rides a founder hold).

---

## 7. Sequencing — what starts NOW vs what is gated

**Governing gates (unchanged; this plan obeys them):**
- admin-first-proof-directive — **Admin is the proving ground; PLOS is frozen** (removed from active
  consideration, not paused). Knowledge work proves in Admin.
- founder-os-migration-principle — **gradual, no big-bang; migration to Founder OS canonical is gated
  post-V6-proof + the N=1 / proven-reuse gate** (a 2nd app inherits + runs green).
- board condition **C5** — Knowledge Adoption is **Admin-internal**, DECOUPLED from the PLOS master gate;
  they run in parallel, neither blocks the other.

**START NOW (reversible, report-only, zero blast radius — all in Admin):**
1. **Build the Harvester report-only** + run the first full inventory pass -> knowledge-inventory.jsonl (the
   section-1 manifest). Mutates nothing. (Capability order #2, gated behind #1.)
2. **Build the Curator (manual-assist)** — the author!=verifier promotion gate (order #1; before the Harvester
   drives promotion).
3. **Turn on knowledge-health report-only** over the existing seam (already built) — baseline the ratio
   (expected: near-zero adoption, honestly RED).
4. **Run the board smallest proving slice** on ONE KU (ku-issued-artifact-immutability, or
   migration-fidelity-principles if exercising K5) — prove retrieved->injected->cited@hash->influence. The
   wiki/ already holds 6 KUs — start the harvest census against them.

**GATED (do NOT start until the gate clears):**
- **Enforcing gates (Stages D/E)** — gated on the board kill-criterion passing (content-binding above citation
  strength proven on >= 1 KU). Until then, everything is report-only.
- **Mass promotion** — forbidden by the board (do NOT mass-promote the 21 memory files + 76 signals). Promote
  one, prove the chain, THEN scale. The Harvester may CLASSIFY all of it now (report-only); PROMOTE only past
  the proving slice.
- **Promotion of the corpus to delivery-os canonical (out of app-local)** — gated on post-V6-proof + N=1 /
  proven-reuse. Until then the seam is OS-owned/inherited but high-value units may be app-local in Admin.
- **Any PLOS involvement** — gated by admin-first-proof (PLOS frozen) + the END-STATE master gate. Decoupled
  per C5; this plan touches PLOS only as a READ-ONLY inventory source.
- **Building the Workflow / Health / Objective structures** — create-when-first-needed; classification may
  target them now, the structure is born when a real unit needs it.

**Reversibility statement:** every NOW action is report-only or non-deleting. Inventory is a manifest,
harvesting is proposals, archival is gated + non-deleting + git-tracked, enforcement is staged behind a named
kill-criterion. No irreversible step before the founder ratifies and the proving slice passes. **No big-bang.**

---

## 8. Risks (and the mitigation each gets)

| # | Risk | Why it bites | Mitigation (mechanical, not hope) |
|---|---|---|---|
| **R1** | Wrong classification (durable principle filed as Archive; dated review promoted as Wiki) | Harvester guesses; a mis-filed principle is lost from retrieval, a mis-filed review pollutes the corpus | Confidence threshold -> low-confidence parks as UNCLASSIFIED for human triage; the inclusion test (noun-strip + non-obvious + trigger) gates Wiki entry; Curator + author!=verifier on every promotion; classification report-only first. |
| **R2** | Premature deletion / data loss | Archiving before durable content is safely harvested loses the original | No delete ever (Archive = git-tracked move); archival GATED on a verified, trust-bearing, back-linked unit; reversible; founder waiver overrides. |
| **R3** | Harvester drift (inventory stale; new prose accrues un-harvested — the very disease) | A one-time inventory rots; the accumulation disease returns silently | Inventory keyed by path+contentHash -> re-runs produce a DIFF; un-harvested new/changed = census-pressure that FAILS slice-close (Stage D). Drift is a failing gate, not an unread report. |
| **R4** | Adoption theater (green knowledge-adopted with no real influence) | Retrieval is the cheapest, most farmable signal; a poller manufactures infinite adoption; decorative citations | Trust = INDEPENDENTLY-VERIFIED influence ONLY (never retrieval count); adoption is a RATIO (RED on non-adoption); decorative-citation + fabricated-citation + version-mismatch FP detectors; the kill-criterion blocks enforcing on bare retrievals. |
| **R5** | Curator merges distinct concepts (dedup collapses two real, different units) | Over-aggressive dedup destroys nuance; one-source-of-truth mis-applied | Dedup proposes, never auto-merges; merge requires author!=verifier sign-off; supersedes chain (not overwrite) preserves prior versions; a merge that drops a non-obvious claim fails the inclusion test on the survivor. |
| R6 | Over-reach into PLOS / premature canonical promotion | Stakes the N=1 escape on the least-proven layer (board C5 warning) | PLOS frozen (admin-first-proof); corpus promotion gated post-V6-proof + N=1; C5 decoupling kept. |
| R7 | Building structures before need (Workflow/Health/Objective) | Premature generalization (Waterline violation) | create-when-first-needed; classification may target, structure born on first real unit. |

---

## 9. Reconciliation (does this contradict or sharpen standing doctrine?)

**It SHARPENS, does not contradict.**
- **vs founder-os-migration-principle:** that principle says classify into buckets at review time; physical
  move is gated/gradual. This plan **industrializes** it: the Harvester is the mechanical
  classify-at-review-time, and it adds the two missing buckets (Contract, Archive) the prose corpus actually
  needs. It keeps classify-dont-delete, no-big-bang, gated-post-proof, create-when-first-needed, and the
  proven-reuse gate verbatim. **No loosening.**
- **vs admin-first-proof-directive:** Admin remains the proving ground; PLOS frozen. This plan proves the whole
  harvest->promote->enforce->archive loop in Admin first, decoupled from PLOS (board C5). Nothing propagates to
  PLOS before the END-STATE master gate.
- **vs KNOWLEDGE-LAYER-ARCHITECTURE.md (the board):** this plan is **downstream of and obedient to** the board.
  It does not re-decide the KU model, seam, evidence ladder, trust model, or proving slice — it schedules them
  at scale and adds the operating cadence, the Harvester/Curator sequencing, and the retirement/archive
  discipline the board left to then-scale.
- **vs CAPABILITY-LIFECYCLE.md:** the Harvester is the industrialized front of the ONE canonical loop
  (file-lesson -> census -> ledger -> build -> os-inherit), NOT a parallel mechanism. Knowledge units flow
  through the same ledger and the same os-inherit propagation.

**Where this capability lives, given Admin-is-proving-ground but this is a Founder-OS capability:** the seam +
Harvester + Curator + health tooling are **OS-shared intelligence in their PROVING phase** — built and matured
in Admin (the proving ground), and they MIGRATE to delivery-os canonical (apps inherit via os-inherit) once
proven, exactly as the migration principle prescribes for the Jarvis-core set. The **corpus content** (the
KUs) is app-local-until-proven, then promotion-to-shared is gated on >= 2-app reuse + contentHash lock. So:
**this document and its capability designs live in delivery-os/capabilities/ (canonical, where you are reading
it); the proving execution happens in rumah-admin; promotion to canonical corpus + PLOS is gated.** No
contradiction — the migration principle applied to itself.

---

## 10. The one-screen summary (decision-ready)

- **Goal:** Markdown -> Claude -> Execution  =>  Knowledge -> Retrieval -> Citation -> Trust -> Skills ->
  Agents -> Execution, structured in 7 buckets, canonical in delivery-os, consumed by apps, sources archived
  (never deleted).
- **Build order:** seam (done) -> Curator (filter) -> Harvester report-only (firehose) -> enforcement (staged)
  -> retirement. Inverse of the tempting mass-harvest-then-sort order.
- **Start NOW (Admin, reversible, report-only):** Harvester + Curator + knowledge-health baseline + the board
  one-KU proving slice.
- **Gated:** enforcing gates (behind the kill-criterion), mass promotion, canonical-corpus promotion + PLOS
  (post-V6-proof + N=1), Workflow/Health/Objective structures (create-when-first-needed).
- **Hard interlock against theater:** trust = verified influence only; adoption = ratio (RED on non-adoption);
  the named kill-criterion blocks enforcement on bare retrievals.
- **Data-loss = 0:** classify -> harvest -> verify -> archive (git-move, reversible); founder waiver overrides.
