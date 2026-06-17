# V6 Knowledge System — Consolidating Design (DRAFT, founder ratifies)

> Author: knowledge-engineer (Knowledge-Layer owner). **DRAFT — I draft + maintain; I do NOT ratify.**
> Status: DESIGN-ONLY pass (founder directive 2026-06-17). No build, no file moves, no repo reorg in this
> pass. This doc PROVES understanding and CONSOLIDATES the existing artifacts; it does not regenerate a
> parallel design (that would be the markdown-sprawl this whole initiative fights).
>
> **CONSOLIDATES — does not replace — five existing canonical artifacts (cited throughout):**
> 1. `KNOWLEDGE-ARCHITECTURE.md` — the 7-bucket model, the lifecycle, Harvester/Curator, retrieval
>    hierarchy, adoption enforcement (the SYSTEM design; knowledge-engineer).
> 2. `KNOWLEDGE-LAYER-ARCHITECTURE.md` — the V6 board seam contract: KU model, `knowledge-route`,
>    the K1–K7 evidence ladder, trust model, conditions C1–C6, the named kill-criterion (the SPINE).
> 3. `KNOWLEDGE-MIGRATION-PLAN.md` — the HOW/WHEN/RISK sequencing (lead-architect).
> 4. `KNOWLEDGE-INVENTORY-2026-06-17.md` — the ~700-file file-level audit.
> 5. `FOUNDER-OS-MIGRATION-PRINCIPLE.md` + `CAPABILITY-GOVERNANCE-LADDER.md` + `HEALTH-FRAMEWORK.md`.
>
> **What this doc ADDS that the five do not have** (the genuine gaps): a **type-level** map (the inventory
> is file-level), **Evidence/Review/Decision/Governance-Asset as first-class types** with explicit
> **promotion rules** (the 7-bucket model covers only the 7 destinations), a **lifecycle evaluation**
> (the founder asked us not to assume the existing one is correct), and a **first MEASURED/repeatable
> slice** that turns the already-demonstrated ad-hoc promotion into a proven capability.
>
> **Honesty bar (inherited from the board):** adoption measures influence, never correctness; a widely-cited
> wrong fact is a propagated defect; author≠verifier governs every promotion; UNMEASURED fails closed;
> knowledge is structurally weaker on the proof axis than skills, and this doc says so.

---

## 0. What ALREADY EXISTS vs what is NET-NEW (read this first — anti-fragmentation)

| Concern | State | Evidence (cited) |
|---|---|---|
| 7-bucket structure (Wiki/Skill/Workflow/Health/Objective/Contract/Archive) | **DONE (designed, founder-pending)** | `KNOWLEDGE-ARCHITECTURE.md §1` |
| KU model, retrieval seam, K1–K7 ladder, trust model, kill-criterion | **DONE (board APPROVE-WITH-CONDITIONS)** | `KNOWLEDGE-LAYER-ARCHITECTURE.md` |
| Lifecycle pipeline (Discussion→…→System-Wide Reuse) | **DONE (designed)** — *re-evaluated in Task 2* | `KNOWLEDGE-ARCHITECTURE.md §2` |
| Harvester + Curator capability design | **DONE (designed)** | `KNOWLEDGE-ARCHITECTURE.md §3–§4` |
| Harvester v1 (`knowledge-harvester.mjs`, report-only, Admin-only, `--self-test`) | **BUILT** | `rumah-admin/scripts/knowledge-harvester.mjs` |
| Curator v1 (`knowledge-curator.mjs`, report-only, propose-never-merge) | **BUILT** | `rumah-admin/scripts/knowledge-curator.mjs` |
| Retrieval seam `knowledge-route.mjs` + `knowledge-health.mjs` | **BUILT (Admin, fail-closed)** | `.claude/os/tools/knowledge-route.mjs` · `scripts/knowledge-health.mjs` |
| `dispatch-route.mjs` composer (injects skill+knowledge into spawnPrompt) | **BUILT** | `.claude/os/tools/dispatch-route.mjs` |
| Real KUs promoted (19 in `rumah-admin/wiki/`) | **BUILT** | `wiki/ku-*/KU.md` |
| Ad-hoc proof of promote→consume→inherit→not-trapped | **DEMONSTRATED (not measured)** | `ku-learn-once-promote-system-wide`, `ku-seam-url-must-match-app-mount` |
| File-level inventory (~700 files, ~430 durable, ~270 archive-only) | **DONE** | `KNOWLEDGE-INVENTORY-2026-06-17.md` |
| Sequencing/gates/risks | **DONE** | `KNOWLEDGE-MIGRATION-PLAN.md §3,§5,§7,§8` |
| **TYPE-LEVEL map (per knowledge-TYPE: location/owner/consumer/dup/discoverable/lost)** | **NET-NEW (Task 1)** | this doc §1 |
| **Lifecycle evaluation (right/wrong/incomplete) + the lifecycle V6 actually needs** | **NET-NEW (Task 2)** | this doc §2 |
| **Evidence/Review/Decision/Governance-Asset as first-class types + promotion rules** | **NET-NEW (Task 3)** | this doc §3 |
| **First MEASURED/repeatable proving slice (turn ad-hoc into capability)** | **NET-NEW (Task 5)** | this doc §5 |
| **Curator merge of KNOWLEDGE-ARCHITECTURE ↔ LAYER-ARCHITECTURE (PROPOSAL only)** | **NET-NEW proposal (Task 4)** | this doc §4.6 |

> **Important placement correction (honest finding):** the founder brief and CLAUDE.md §4 say the KUs live in
> `delivery-os/wiki/`. They do **not** yet — all 19 live in **`rumah-admin/wiki/`** (delivery-os has no `wiki/`
> dir). This is correct per admin-first-proof (corpus is app-local-until-proven) but it means CLAUDE.md §4's
> "Owner: knowledge-engineer" table and the canon docs' `delivery-os/wiki/` paths are **aspirational, not
> current** — a drift the Curator should log. `ku-learn-once-promote-system-wide` even *claims* "Canonical
> source: delivery-os/wiki/" in its body while physically sitting in `rumah-admin/wiki/`. Net-new finding for
> the backlog (§6, B-DRIFT).

---

## 1. Task 1 — Current-state TYPE-LEVEL map (the genuine gap above the file-level inventory)

`KNOWLEDGE-INVENTORY-2026-06-17.md` already did the **file-level** audit (~700 files, per-repo totals, bucket
distribution, merge clusters). I do **not** redo it. The gap the founder named is the **type-level** view:
for each knowledge-TYPE the company actually produces, *where does it live · who owns it · who consumes it ·
is it duplicated · is it discoverable through the seam · is it effectively lost after creation?* The inventory
answers "which files"; this answers "which TYPES leak."

**Legend.** Discoverable = retrievable through a seam (`knowledge-route`/`skill-route`), not a raw Read.
Lost-after-creation = produced once, never re-retrieved in execution (the prose-that-never-converted disease,
which `classifyDormant` measures for KUs and the Harvester's "uncovered-durable" measures for the corpus).

| # | Knowledge TYPE | Where it lives today | Owner | Consumer (intended) | Duplicated? | Discoverable (seam)? | Lost after creation? |
|---|---|---|---|---|---|---|---|
| 1 | **Review** (§11 decision-reviews, production-readiness, principle-11) | `rumah-admin/docs/DECISION-REVIEW-*.md`, `docs/verify/` | reviewer-critic / qa | the decision-maker, once | rarely (point-in-time) | **NO** (raw Read) | **YES** — lesson stays trapped in the review (the founder's "not trapped in reviews" concern) |
| 2 | **Memory** (21 project-memory files) | `~/.claude/projects/.../memory/*.md` | Claude auto-memory | Claude next session | **HIGH** (overlapping, e.g. invoice-immutability spans 3) | **NO** (loaded as a blob, not routed) | partially — re-read as a blob, never *retrieved as a unit* |
| 3 | **Decision** (ADRs, ECRs) | `docs/adr/*`, `ecosystem-architecture/decisions/ECR-*` | KE drafts; founder ratifies | future implementers, cross-system | ADRs single-sourced; ECR prose drifts (cluster #2) | **NO** for ADRs; ECRs partly via Contract seam | medium — ADRs are durable but read raw, not cited@hash |
| 4 | **ADR-of-record** (ratified, binding) | `docs/adr/0000-ADR-INDEX.md` + entries | founder ratifies | implementers | low | **NO** | medium |
| 5 | **Governance asset** (CODEOWNERS, gates, governance-ladder, operating-loop) | `delivery-os/core/`, `.claude/hooks/`, `CAPABILITY-GOVERNANCE-LADDER.md` | lead-architect / founder | every agent every slice | some (ladder vs completeness ladder, deliberately distinct) | **PARTLY** (gates run; the *rules* read raw) | NO for executable gates; **YES** for the prose rationale behind them |
| 6 | **Validation** (~270 VERIFY-* docs) | `docs/verify/`, PLOS `verify/` | qa / verifier | the one slice they gated | low individually; collectively redundant | **NO** | **YES, massively** — point-in-time; durable lesson (if any) must be harvested then archived |
| 7 | **Architecture** (NORTH-STAR, V6-*, design docs, the knowledge-system docs themselves) | `docs/`, `delivery-os/capabilities/` | lead-architect / KE | all agents | **YES** — the meta-disease cluster #1 (ARCHITECTURE ↔ LAYER-ARCHITECTURE) | **NO** (raw Read) | medium — re-read but as whole files, not units |
| 8 | **Handoff** (slice handoffs, session handoffs) | `docs/` ad-hoc, transcripts | working agents | next agent/session | low | **NO** | **YES** — consumed once, then dead |
| 9 | **Postmortem** (incident write-ups) | `docs/` ad-hoc | working agents | nobody, after the fix | low | **NO** | **YES** — the founder-failure→health-check lesson exists as a KU pattern but the source postmortems aren't routed |
| 10 | **Workflow-review** (learning-review outputs, retrospectives) | `RETROSPECTIVE-2026-06-1x.md`, `OS-FEEDBACK-*` | learning-review skill | the OS, once | **YES** (3 retros, cluster #6) | **NO** | **YES** — the highest-value lessons accumulate as prose (this is the founder's "learning accumulates instead of converting" defect, verbatim) |
| 11 | **Session-output** (scratch, threads) | transcripts, scratch md | working agents | nobody | n/a | **NO** | **YES by design** — transient; should resolve to Archive or NO-ACTION |
| 12 | **Wiki (KU)** — *the one type already through the seam* | `rumah-admin/wiki/ku-*/` (19) | knowledge-engineer | any agent on a matching trigger | Curator-managed (supersedes) | **YES** (`knowledge-route`) | measured — DORMANT if never retrieved |
| 13 | **Skill** — *the strongest, also through the seam* | `.claude/skills/` (14) | earned | dispatched agents | low | **YES** (`skill-route`) | partly — 12/14 idle (built-not-adopted, the standing gap) |
| 14 | **Contract** | `admin-plos-seam-v1.mjs`, ECRs, `06-registry` | integration-architect | both sides of a seam | cluster #2 (prose drifts from executable) | **PARTLY** (executable gate; prose not routed) | NO (gate enforces) |

**The type-level diagnosis (what the file count hides).** Of 14 types, **only 2 (Wiki, Skill) are
discoverable through a seam**, and a 3rd (Contract) only via its executable gate. The other **11 types are
read raw or not at all** — the live model is still `Markdown → Claude → Execution` for everything except KUs
and skills (confirming memory `knowledge-adoption-gap`). The **highest-value, most-lost types are Review,
Workflow-review, Validation, Handoff, Postmortem** — exactly the types where *learning is born*. This is the
structural restatement of the founder's defect: **knowledge is born in the types that leak it.** The fix is
not "write fewer reviews" — it is a **harvest hop** from each leaky type into a discoverable type
(Wiki/Skill/Workflow), which is what §2's lifecycle and §3's promotion rules formalize.

---

## 2. Task 2 — Lifecycle evaluation (the founder said: don't assume the existing one is correct)

The founder named `Evidence → Review → Decision → Learning → Wiki → Skill → Runtime → Archive` and asked us to
*evaluate* it. The existing canon (`KNOWLEDGE-ARCHITECTURE.md §2`) already has a lifecycle:
`Discussion → Decision → Implementation → Learning → Knowledge Harvest → Classification → Canonical Update →
Archive Source → System-Wide Reuse`. I evaluate BOTH against reality (the 14 types in §1 + the ad-hoc proof in
the KUs).

### 2.1 Where the existing canon lifecycle is RIGHT (keep)
- **Markdown is never the terminus** — every type resolves to a structured bucket; the source archives, not
  deletes (promote-AND-preserve, Knowledge-Lost=0). Correct and load-bearing. *(§2 + Migration §6.)*
- **Harvest + Classification are explicit stages** — the founder's chain has no "harvest" hop, so durable
  knowledge would have to *teleport* from Learning to Wiki. The canon is RIGHT to make harvest first-class.
- **Terminus = System-Wide Reuse, not "canonical"** — proven by `ku-learn-once-promote-system-wide`. The
  founder's chain ends at Archive, which is **wrong** (see 2.3). The canon is right here.
- **Author≠verifier on Canonical Update** — non-negotiable, correct.

### 2.2 Where the founder's named chain is RIGHT and the canon is INCOMPLETE (add)
- **"Evidence" as an explicit FIRST stage.** The founder starts at *Evidence*; the canon starts at
  *Discussion*. Evidence (a VERIFY doc, a runtime log, a commit, a founder quote) is the *provable substrate*
  that makes a Review trustworthy. The canon collapses it into "Discussion," losing the distinction between
  *opinion* and *evidenced finding*. **GAP: Evidence is a first-class input type** (§3 makes it one). This is
  not pedantic — the K1–K7 ladder is entirely about *strength of evidence*, so the lifecycle should name
  Evidence as its origin.
- **"Review" as an explicit stage between Evidence and Decision.** The canon jumps Discussion→Decision. But in
  reality (§1 type #1) Reviews are where the most learning is *born and then trapped*. Naming Review as a stage
  forces the question "what did this review teach that must be harvested?" — the founder's "not trapped in
  reviews" requirement becomes a lifecycle obligation, not a hope.

### 2.3 Where the founder's named chain is WRONG (correct it)
- **`… → Runtime → Archive` makes Archive the terminus.** This is the same error the canon already fixed:
  the terminus is **System-Wide Reuse**, not Archive. Archive is what happens to the *source prose* after
  harvest — it is a side-effect of one stage, **not the end of the lifecycle of the knowledge.** A learning
  that ends in Archive is a learning that died. Keep the canon's terminus.
- **`Wiki → Skill` as a mandatory linear step.** Not every Wiki KU becomes a Skill (most don't — a KU is a
  claim; a Skill is a procedure; see board headline). Linearizing Wiki→Skill would manufacture decorative
  skills. **Skill is a CONDITIONAL promotion** (only when the unit prescribes a repeatable procedure), not a
  lifecycle step. The canon is right to keep them as sibling destinations, not a chain.

### 2.4 The lifecycle V6 ACTUALLY needs (consolidated — reconciles both)
Keep the canon's spine; insert Evidence + Review as named stages; keep the System-Wide-Reuse terminus; make
Wiki/Skill/Workflow **parallel conditional destinations**, not a chain:

```
Evidence  →  Review  →  Decision  →  Implementation  →  Learning
   →  Harvest  →  Classify  →  { Wiki | Skill | Workflow | Health | Objective | Contract }   (one canonical home; Skill only if procedure)
   →  Verify (author≠verifier, cite@hash)  →  Register (seam)  →  System-Wide Reuse
   ⇣ (source side-effect, gated on a trust-bearing unit)
   Archive Source (promoted-to back-link; never deletion; never the terminus)
```

**Why this is the right one (the test):** every one of the 11 leaky types in §1 now has a named hop into a
discoverable type, the source is preserved, and the terminus is reuse — so a learning is *measurably* either
reused-everywhere or visibly-dormant. Nothing can quietly die in a review or an archive.

---

## 3. Task 3 — Canonical knowledge model: the 9 types + the PROMOTION RULES (the real gap)

The existing 7-bucket model (`KNOWLEDGE-ARCHITECTURE.md §1`) defines the 7 **destinations**
(Wiki/Skill/Workflow/Health/Objective/Contract/Archive). It does **not** define **Evidence / Review /
Decision / Governance-Asset** as first-class **input/source** types, nor the explicit **promotion rules**
between any of them. That is the gap I fill. (Wiki/Skill/Workflow/Contract/Governance-Asset/Health-Asset are
referenced from canon; Evidence/Review/Decision are net-new definitions.)

### 3.1 Type definitions
| Type | Definition | Provability ceiling (board ladder) | Canonical home |
|---|---|---|---|
| **Evidence** *(NET-NEW)* | A provable artifact of something that happened: a VERIFY result, a runtime log/round-trip, a commit/diff, a founder quote. NOT a claim — the *substrate* a claim cites. | n/a (it IS the proof) | stays where produced; cited by units via `source-provenance` |
| **Review** *(NET-NEW)* | A point-in-time judgment over Evidence (§11, readiness, QA). Produces findings + a verdict. | point-in-time → Archive after harvest | `docs/DECISION-REVIEW-*`, `docs/verify/` |
| **Decision** *(NET-NEW)* | A ratified choice with context·consequences (ADR/ECR). Binding once ratified. | strong (founder-ratified is top rung) | `docs/adr/`, `ecosystem-architecture/decisions/` |
| **Wiki (KU)** | A reusable non-obvious claim (trap/why/rollback) with a re-findable cited quote. | **CITATION** (C1) unless value-binding | `wiki/<kuId>/KU.md` |
| **Capability Reference** *(generation-class of Wiki/KU — added per `CAPABILITY-PROMOTION-DISCOVERY.md §B`, KNOW-6)* | The contract-generated "how to consume" a promoted capability: generated (i)/(ii) sections (commands/queries/events/data-contracts/deps) + narrative (iii) sections (purpose/when-to-use/gotchas/example), all in ONE KU body. NOT a new bucket, NOT a new router. | **CITATION** for the (iii) narrative; (i)/(ii) re-derive from `contractHash` | `wiki/cap-ref-<id>-<version>/KU.md` (KU frontmatter; routable via `knowledge-route`) |
| **Skill** | A repeatable executable procedure. | **L5 execution fingerprint** (strongest behavioral) | `skills/<skill>/` |
| **Workflow** | A business-object state machine (states + transitions + owner per stage). | structural (states are checkable) | `workflows/<obj>/` (create-when-needed) |
| **Contract** | A machine-checkable bilateral seam (schema + conformance test). | **STRONGEST** (executable fingerprint) | `contracts/<seam>/`, ECRs |
| **Governance-Asset** *(NET-NEW)* | An enforceable rule of how work runs: a gate, CODEOWNERS binding, governance ladder, operating-loop rule. Half prose (rationale), half executable (the gate). | executable gate = PROVEN; prose rationale = CITATION | `delivery-os/core/`, `.claude/hooks/` (executable) + KU (rationale) |
| **Health-Asset** | A monitoring rule: signal + threshold + probe + RED/GREEN. | structural (probe passes/fails) | `health/<concern>/` (create-when-needed) |

> **Governance-Asset is the genuinely-missing 4th first-class type the founder named.** It is neither Wiki
> (it *obligates*, doesn't advise) nor Contract (it's intra-system, not bilateral) nor pure Skill (it gates,
> doesn't execute a business procedure). `CAPABILITY-GOVERNANCE-LADDER.md` is the exemplar: its executable
> half is the gate; its rationale half is `ku-capability-governance-ladder`. Naming the type makes the
> prose↔gate split explicit so the rationale is routable and the gate is enforced — today the gate runs but
> its *why* is read raw.

### 3.2 The PROMOTION RULES (what licenses each hop — the real net-new content)
Each rule states the **trigger**, the **gate** (what must be true to promote), and the **author≠verifier**
check. No hop is automatic; every hop preserves the source.

| Promotion | Trigger (what fires it) | Gate (what licenses it) | Verifier check |
|---|---|---|---|
| **Evidence → Review** | a slice/decision needs judgment | the review cites ≥1 Evidence artifact (no opinion-only reviews) | reviewer ≠ author of the work |
| **Review → Decision** | the review recommends a binding choice | context·decision·consequences captured as ADR/ECR draft | decision-maker/founder RATIFIES (KE never ratifies) |
| **Review → Wiki** | the review surfaced a **non-obvious recurring** finding | passes the inclusion test (noun-strip OR applies-to + non-obvious + has-trigger) with a re-findable cited quote | independent verifier re-finds the quote in the source @ git-sha |
| **Decision → Wiki** | the decision encodes a non-obvious *constraint* (e.g. "invoice number at issue") | same inclusion test; constraint is the claim | quote re-finds @ ratified-sha |
| **Decision → Contract** | a consumer must honor the decision across a seam | an executable conformance test exists | conformance test passes both sides |
| **Decision → Workflow** | the decision changes a business-object's legal states | states + transitions captured; cites the Decision | states match implementation |
| **Wiki → Skill** *(CONDITIONAL)* | the KU prescribes a **repeatable procedure** recurring across tasks | KE PROPOSES; earning a skill stays gated (author≠verifier + §11) | the skill's L5 fingerprint is independently re-run |
| **Learning(signal) → Wiki** | a signal recurs ≥3 sources / ≥2 projects with no capability | census-pressure NOMINATE → DISTILL | quote re-finds; trivial-quote → generic-citation (no trust) |
| **Postmortem → Health-Asset** | a founder/runtime failure recurs and is monitorable | a probe + threshold can be written | the probe flips RED under the original failure |
| **Governance prose → Governance-Asset** | a rule must be enforced, not hoped | an executable gate is written for the prose rule | the gate fails-closed under sabotage (`--self-test`) |
| **any unit → System-Wide Reuse** | the unit is trust-bearing (verified influence) | registered through the seam, reachable from every relevant system | retrieval observable in ≥1 sibling system context |
| **source → Archive** | its durable content is a **trust-bearing** unit (not merely promoted) | promoted-to back-link + earned-from provenance both resolve | the back-link round-trips to the source @ git-sha |

> **The load-bearing dedup with existing canon:** the bottom 3 rows (signal→Wiki, the inclusion test,
> source→Archive) are the board's promotion pipeline and Migration §6 — I cite them, not restate them. The
> **net-new rows** are the ones starting from Evidence/Review/Decision/Postmortem/Governance — the hops the
> 7-bucket model never specified because it only modeled destinations, not origins.

---

## 4. Task 4 — Target architecture (reference canon; sharpen the 6 sub-models)

The structure is `KNOWLEDGE-ARCHITECTURE.md §1` (7 buckets) + `§5` (retrieval hierarchy) + `§6` (enforcement),
and `KNOWLEDGE-MIGRATION-PLAN.md §2` (physical homes). I do not restate them. I sharpen the six sub-models the
founder enumerated, then make the Curator-merge proposal.

### 4.1 Ownership model (sharpened)
- **Knowledge-engineer owns the Knowledge Layer** (KU create/promote, wiki, memory dedup, ADR drafting,
  Knowledge→Skill proposals) — drafts/maintains, **never self-certifies**.
- **Per-type owner** is in the §1 table (Decisions: KE drafts/founder ratifies; Contracts: integration-architect;
  Governance-Assets: lead-architect/founder; Skills: earned). One canonical owner per concern.
- **author≠verifier is the ownership invariant**: the owner who authors a unit is never the party who certifies
  it (`ku-author-not-equal-verifier`).

### 4.2 Folder structure (canon — NO new dirs this pass)
Per `FOUNDER-OS-MIGRATION-PRINCIPLE.md`: Wiki + Skill PRESENT; Workflow/Health/Objective MISSING and
**create-when-first-needed** (not built now); Contract lives in the seam + ecosystem decisions; Archive is
in-place per repo (`source-root/_archive/`). **Honest current state:** the corpus is in `rumah-admin/wiki/`
(app-local-until-proven), NOT `delivery-os/wiki/` — the canonical home is the *destination*, gated post-proof.

### 4.3 Runtime-consumption model (canon — `knowledge-route`)
The seam is the **only observable path** to a unit; a raw Read writes no record and counts as zero (fail-closed
by construction). `dispatch-route` injects the routed units into the spawnPrompt VERBATIM (K2 injection,
provable). **Injection ≠ adoption** (`ku-injection-is-not-adoption`): injection markers live in
`dispatch-log.jsonl`, which `knowledge-health` never reads. The multi-corpus bucket-priority router (canon §5)
is the planned evolution; today `dispatch-route` composes Skill+Knowledge.

### 4.4 Promotion flow (canon + §3 above) and inheritance model (os-inherit)
Promotion flow = the lifecycle §2 + the promotion rules §3.2. Inheritance = `v6-end-state` os-inherit at full
scale: single-authored, vendored, pinned, **drift-gated** (NOT runtime central-load). The
**contentHash-locked mirror is intended propagation, not a duplicate** (`KNOWLEDGE-ARCHITECTURE.md §4.7`); the
Curator escalates only when the hash DIVERGES (a broken pin). Promotion-to-shared needs proven ≥2-app reuse +
the N=1 master gate (a 2nd app inherits + runs green) — gated post-V6-proof.

### 4.5 Archive model (canon — Migration §6)
classify → harvest → **verify (trust-bearing)** → archive (git-move, in-place, reversible, founder-waiver
overrides). Archive is last-resort retrieval, never the terminus (§2.3).

### 4.6 PROPOSAL (do NOT execute this pass) — Curator merge of the two architecture docs
The inventory flagged the **meta-disease** (cluster #1): `KNOWLEDGE-ARCHITECTURE.md` ↔
`KNOWLEDGE-LAYER-ARCHITECTURE.md` ↔ `KNOWLEDGE-ADOPTION-GAP.md` ↔ `G12-KNOWLEDGE-ENGINEERING-GAP.md`. The
Curator's first canonical job is to dogfood itself on its own house. **Proposed (founder ratifies; not done
here):**
- **Keep `KNOWLEDGE-LAYER-ARCHITECTURE.md` as the canonical SPINE** (it owns the executable contract: KU model,
  seam, K1–K7 ladder, trust model, conditions, kill-criterion). One source of truth for the *mechanism*.
- **Keep `KNOWLEDGE-ARCHITECTURE.md` as the canonical SYSTEM design** (7 buckets, lifecycle, Harvester/Curator,
  retrieval hierarchy, enforcement). It EXTENDS the spine; they are siblings, not competitors.
- **Supersede/absorb the two GAP docs** (`KNOWLEDGE-ADOPTION-GAP.md`, `G12-*`) into the SYSTEM doc with
  `superseded-by` stubs — they are diagnoses the design now answers; keep as Archive with back-links.
- **This doc (V6-KNOWLEDGE-SYSTEM.md)** is the **consolidating index/onboarding view** (type-level map +
  promotion rules + first slice + backlog) that points at the two canonical docs — it must NOT grow into a 3rd
  competing architecture. If after ratification the founder wants ONE doc, fold this doc's §1/§3/§5/§6 into the
  SYSTEM doc and retire this as a stub. **Recommendation: keep 2 canonical (SPINE + SYSTEM) + this as the
  thin index; merge the 2 GAP docs in.** That is the minimum-fragmentation outcome.

---

## 5. Task 5 — First MEASURED/repeatable proving slice (the highest-value NET-NEW work)

**The honest starting point:** promote→consume→inherit→not-trapped has **already been demonstrated ad-hoc** —
`ku-seam-url-must-match-app-mount` was harvested from a real VERIFY doc (commit 8ea0876), is `applies-to:[os]`,
retrievable via `knowledge-route`, and carries provenance back to its source. `ku-learn-once-promote-system-wide`
shows the inherit intent. **But this is a demonstration, not a measured capability** — there is no recorded
retrieval→citation→trust event proving the loop *worked in execution*. The board's smallest proving slice
(`KNOWLEDGE-LAYER-ARCHITECTURE.md`, "Smallest proving slice") names the 5 proofs; this slice **operationalizes
them on ONE real review as a repeatable, measured loop** — turning the ad-hoc demo into rung-3 (validated) on
the governance ladder.

### 5.1 Scope (minimal — Waterline)
**One harvest→classify→promote→retrieve→cite loop on ONE real Review, end-to-end, measured.** Concretely:
1. Pick ONE existing Review with a non-obvious trapped lesson — candidate: a `docs/DECISION-REVIEW-*` or
   `docs/verify/` doc whose lesson is NOT yet a KU (the Harvester's "uncovered-durable" list names them).
2. Run `knowledge-harvester.mjs` → it emits the candidate as `uncovered + durable-signal` (BUILT, report-only).
3. Run `knowledge-curator.mjs` → confirms no existing canonical unit covers it (BUILT, report-only).
4. KE authors ONE KU via the lifecycle (§2), provenance-bound, with a re-findable cited quote.
5. **Independent verifier** re-finds the cited quote in the source @ git-sha (author≠verifier; `verify-gate`).
6. A real downstream task routes through `knowledge-route`, retrieves the KU (K1), it is injected (K2), the
   agent emits `applied-knowledge:` + `knowledge-quote:`, verifier re-finds it **at the retrieved hash** (K3).
7. `knowledge-health --json` reports the event: roster, retrieved, cited, trust, and **adoption as a RATIO**.

### 5.2 Success criteria
- The loop runs **end-to-end with NO raw Read** of the source in the consuming task (seam-only).
- The KU reaches **content-bound citation at the retrieved hash (K3)**, verified by an independent party.
- `knowledge-health` shows **adoption as a ratio** (retrievals / knowledge-relevant tasks), honestly RED if
  the denominator says so — not a bare green count.
- The whole loop is **re-runnable**: a second review can go through the same steps without new tooling.

### 5.3 Dependencies (all BUILT — this is why the slice is small)
`knowledge-route.mjs` · `knowledge-health.mjs` · `knowledge-harvester.mjs` · `knowledge-curator.mjs` ·
`dispatch-route.mjs` · `verify-gate` (author≠verifier) · the KU frontmatter contract. **No new tool is
required for the slice** — only a real run + measurement. (A small extension: `knowledge-health` must emit the
ratio with a real denominator; confirm it does before the slice or treat as the slice's one build.)

### 5.4 Proof criteria + the NAMED KILL-CRITERION (board, verbatim intent)
> If, on the single promoted KU, an independent verifier cannot establish content-binding **above CITATION
> strength** on at least one real task — only that it was retrieved and named — the slice is **KILLED**, no
> second KU is promoted, no enforcement and no PLOS coupling proceed, and the honest standing claim reverts to
> *"knowledge is stored, retrieval is loggable, influence is unproven."* Secondary kill: if the only way to
> green the slice is to count bare retrievals (K1) as adoption, it failed.

**What this slice PROVES that the ad-hoc demo did not:** (1) promotion is *repeatable from a Review* via tools,
not hand-crafted; (2) consumption is *measured* (a real retrieval+citation event in the health ledger);
(3) not-trapped is *demonstrated by measurement* (the lesson left the review and was cited in execution);
(4) inheritance is *gated-honest* (corpus stays app-local until ≥2-app reuse). It moves the capability from
"DEMONSTRATED" to "validated" (rung 3, `CAPABILITY-GOVERNANCE-LADDER.md`).

---

## 6. Task 6 — Prioritized backlog (DONE / NEXT / GATED), execution order

> Ordering obeys the Migration plan's de-risking order (seam → filter → firehose → enforce → retire) and the
> admin-first / post-V6 / N=1 gates. Report-only before enforcing, always.

### DONE (built or designed; do not rebuild)
- **D1** Retrieval seam `knowledge-route` + `knowledge-health` (fail-closed, Admin). — *capability rung: built/observable*
- **D2** Harvester v1 + Curator v1 (report-only, `--self-test`, Admin). — *rung: built*
- **D3** 7-bucket structure + lifecycle + retrieval hierarchy + enforcement DESIGN (founder-pending).
- **D4** 19 KUs promoted with the frontmatter contract; ad-hoc promote→consume→inherit DEMONSTRATED.
- **D5** Migration sequencing, gates, risks, reconciliation.
- **D6** File-level inventory (~700 files).
- **D7** Governance ladder + Founder-OS migration principle (founder-ratified) as the gating canon.

### NEXT (start now — reversible, report-only, Admin; in order)
- **N1 — Run the §5 first MEASURED slice** on ONE real Review (architecture work). *Highest value: turns the
  ad-hoc demo into a validated capability + exercises the kill-criterion.* Depends only on DONE tools.
- **N2 — `knowledge-health` ratio confirmation** (validation): verify adoption is emitted as a real ratio with
  the knowledge-relevant-task denominator; if not, that is N1's single build.
- **N3 — Curator first canonical pass: the meta-disease cluster #1** (governance/architecture): execute the
  §4.6 PROPOSAL *after founder ratifies it* — absorb the 2 GAP docs, confirm SPINE+SYSTEM+index split. Dogfood
  the Curator on its own house.
- **N4 — Type-level map → Harvester signals** (architecture): teach the Harvester to tag source TYPE (§1's 14)
  so "uncovered-durable" is reported per leaky type (Review/Workflow-review/Validation first).
- **N5 — Memory dedup pass** (migration): consolidate the 21 overlapping memory files toward KUs (the
  invoice-immutability/migration-fidelity overlaps first) — report-only proposals, founder-waiver honored.
- **N6 — Fix the drift** (governance, B-DRIFT below): reconcile CLAUDE.md §4 + canon `delivery-os/wiki/` paths
  vs the actual `rumah-admin/wiki/` location — log it, don't move files (gated).

### GATED (do NOT start until the gate clears)
- **G1 — Enforcing gates (Stages D/E)**: census-pressure fails slice-close; raw-Read coverage denominator.
  **Gate: the §5 kill-criterion passes** (content-binding above CITATION proven on ≥1 KU).
- **G2 — Mass promotion** of the 21 memory files + 76 signals. **Forbidden by the board** — promote one, prove
  the chain, then scale. Harvester may CLASSIFY all now (report-only).
- **G3 — Promotion of the corpus to `delivery-os/` canonical** (out of app-local). **Gate: post-V6-proof +
  N=1 / ≥2-app reuse + contentHash lock.**
- **G4 — Workflow / Health / Objective bucket structures**: create-when-first-needed; classification may target
  them now, the structure is born on the first real unit.
- **G5 — Any PLOS involvement**: PLOS frozen (admin-first-proof); decoupled per board C5; END-STATE master gate.
- **G6 — Governance→executable promotion** of un-gated governance prose (the Governance-Asset type): gated
  behind N1 proving the loop + the relevant gate's `--self-test`.

### NET-NEW finding to log (not a build)
- **B-DRIFT** — KUs physically in `rumah-admin/wiki/` while CLAUDE.md §4 and canon docs say `delivery-os/wiki/`;
  `ku-learn-once-promote-system-wide` body claims "Canonical source: delivery-os/wiki/" from an app-local path.
  Correct per admin-first (app-local-until-proven) but it is **undocumented drift** — the Curator's worklist.

---

## 7. Status & the author≠verifier gate on THIS doc
This is a **DRAFT consolidating design**, authored by the Knowledge-Layer owner; **NOT self-certified**. It is
done (for this DESIGN-ONLY pass) when: it CONSOLIDATES rather than regenerates (cites all 5 source artifacts) ·
adds only the genuine type-level/lifecycle/promotion-rule/first-slice gaps · proposes the Curator merge without
executing it · and is **queued for independent review** — the founder ratifies (a) the lifecycle correction
(§2.4), (b) the 4 net-new types + promotion rules (§3), (c) the §4.6 merge proposal, and (d) the §5 first
slice as the next execution; an independent verifier checks that nothing here forks the spine or restates the
canon it cites. **Built ≠ Adopted:** this design is "adopted" only when the §5 slice runs and `knowledge-health`
shows a real retrieved+cited+trust event — not because this doc exists.
