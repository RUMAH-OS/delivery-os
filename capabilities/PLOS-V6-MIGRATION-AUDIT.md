# PLOS v6 Migration Audit — knowledge-preservation census (pre-cutover gate)

> **The no-loss standard (founder, 2026-06-15):** *"No proven skill, lesson, pattern, workflow or
> founder-learning disappears during the migration; the upgrade is complete only when knowledge is
> preserved or promoted, not lost."*
>
> **This is the pre-cutover gate.** A v5→v6 cutover is NOT "PLOS now runs the new tools." It is
> "every proven thing PLOS learned is **preserved or promoted**, nothing dropped." Method:
> `delivery-os/.claude/skills/v6-migration-audit/SKILL.md`. **Fail-closed: the cutover is GO only when
> LOST = 0 AND every CAPABILITY/INHERITED-SKILL row is represented in a ledger.**
>
> **Read-only audit.** No PLOS file was modified. This artifact lives in delivery-os (cross-project),
> non-colliding with any parallel PLOS session.
>
> Auditor: migration-auditor · Date: 2026-06-15 · Project: `c:\Users\brian\RUMAH\property-lead-os`

## Destination taxonomy
- **MEMORY** — fact / context / founder-preference that stays a memory entry (preserved as-is).
- **WIKI / PRESERVED-DOC** — explanation/playbook/decision-record that stays documentation.
- **CAPABILITY (project-local)** — recurring lesson/pattern that becomes a skill/agent/gate/automation in PLOS's backlog/ledger (executes, doesn't just describe).
- **INHERITED-SKILL (OS-foundational)** — proven capability promoted to delivery-os so every future project inherits it via os-inherit/os-sync.
- **LOST (must rescue)** — no destination yet. The gate's enemy; any LOST row blocks cutover.

---

## Section A — Memory entries (`~/.claude/projects/c--Users-brian-RUMAH-property-lead-os/memory/`)
PLOS uses **user-level file-based memory** (NOT a repo `memory/` dir). 32 entries + the `MEMORY.md` index.

| asset (file) | knowledge it holds (1 line) | destination | concrete target | status |
|---|---|---|---|---|
| `MEMORY.md` | the memory index (one line per entry) | MEMORY | stays memory (the index) | preserved |
| `market-and-waterline.md` | market boundary + the LOCKED Waterline Rule (EPC beachhead, segment-agnostic spine) | MEMORY | stays memory (mirrors LOCKED doc `docs/strategy/market-definition-and-waterline.md`) | preserved |
| `conversations-not-data.md` | North Star — success = conversations/customers, not data/supply | MEMORY | stays memory (founder North Star) | preserved |
| `conversation-preservation-doctrine.md` | founder doctrine — conversation value = intelligence produced; preservation is primary; the unscrapeable moat | MEMORY | stays memory (founder doctrine) | preserved |
| `conversations-not-data.md` ↔ `room-exit-is-the-metric.md` | judge Company-OS by how rarely founder must LEAVE The Room (complete loops, not features) | MEMORY | stays memory (founder metric) | preserved |
| `answer-is-the-operational-surface.md` | the reasoning answer should BECOME an operational surface (inspect→prepare→approve→execute) | MEMORY | stays memory (product direction) | preserved |
| `daily-operating-view-08h-understanding.md` | Move 3 north-star — the 08:00 "what must I understand to run the company today?" test | MEMORY | stays memory (design north-star) | preserved |
| `queue-as-product-design.md` | LOCKED design decisions for the Queue-as-Product surface (actions-not-workflows, contact_events, tiers) | MEMORY | stays memory (locked design) | preserved |
| `advisor-live-usage-phase.md` | the memory-backed Advisor (Jarvis) is LIVE on Room+Floor; usage-before-expansion | MEMORY | stays memory (project state) | preserved |
| `m1-mailbox-workflow-live.md` | M1 mailbox workflow (read→triage→draft→send) LIVE — first complete Company-OS loop | MEMORY | stays memory (project state) | preserved |
| `identity-boundary-tenant-vs-contact.md` | ADR-0003 identity boundary (Admin Tenant = PII-free op entity; PLOS Contact = human identity) | MEMORY | stays memory (mirrors ADR-0003) | preserved |
| `floor-click-first-standard.md` | founder standard — The Floor is click-first; keyboard optional power-user layer | MEMORY | stays memory (founder UX standard) | preserved |
| `decide-dont-overask.md` | founder preference — take specialist defaults, don't escalate minor UX choices | MEMORY | stays memory (founder preference) | preserved |
| `project-operating-model.md` | lightweight roadmap playbook + monthly bottleneck/runway review (reflection, not rulebook) | MEMORY | stays memory (founder operating model) | preserved |
| `ruma-buyer-role-evidence.md` | real Ruma deals came from operational roles, never execs (operational-owner thesis basis) | MEMORY | stays memory (founder evidence) | preserved |
| `validation-2.2.1-and-scoring-refinement.md` | Slice 2.2.1 6-company live validation results + parked scoring weaknesses | MEMORY | stays memory (validation evidence) | preserved |
| `conversion-evidence-milestone.md` | supply-creation engine live; next = real funnel numbers + learning review | MEMORY | stays memory (project milestone) | preserved |
| `workspace-keyless-dwd-validated.md` | keyless DWD multi-mailbox read validated live (one Workspace setup, no key file) | MEMORY | stays memory (project state) | preserved |
| `live-db-migration-gap.md` | the live `plos` review DB is migrated BY HAND — apply migrations post-merge or it drifts | MEMORY + **near-CAPABILITY** | stays memory; the auto-apply/drift-check is **a candidate not yet in any ledger** — see Rescue R3 | **tracking gap** |
| `delivery-os-v38-adopted.md` | PLOS adopted v3.8 (SUPERSEDED by v5) — base/overlay + verify-gate mechanics still hold | MEMORY | stays memory (superseded history) | preserved |
| `delivery-os-v5-adoption-queued.md` | PLOS ADOPTED v5.0 (#106) — 5 v5 + 4 PLOS doctrines; verify-gate parser bug fixed | MEMORY | stays memory (adoption state — the v5 baseline this cutover moves from) | preserved |
| `keyless-dwd-fat-defects.md` | the keyless lane passed CI but failed from a clean clone — 3 latent gaps the live FAT surfaced | MEMORY | stays memory (feeds CAP-6 credential health-check; lesson already routed) | preserved |
| **`founder-ready-quality-bar.md`** | component-complete ≠ workflow-complete ≠ founder-ready; component-green is necessary, far from sufficient | **CAPABILITY** | **→ PLOS CAP-1** (founder-ready DoD gate + qa/verify outcome redefinition) | already tracked |
| **`jarvis-product-reality-review.md`** | founder-triggered board-style "does it FEEL like Jarvis?" 7-lens review | **CAPABILITY** | **→ PLOS CAP-2** (Jarvis product-reality review skill) | already tracked |
| **`founder-facing-milestone-format.md`** | every hand-off = Engineering-Setup + Founder-Validation sections (zero eng context in founder part) | **CAPABILITY** | **→ PLOS CAP-3** (hand-off skill + DoD gate) | already tracked |
| **`request-path-cost-discipline.md`** | perf root cause = expensive work on the SYNC request path; measure-first; + silent auth-session death | **CAPABILITY** | **→ PLOS CAP-5** (request-path perf gate) **+ CAP-6** (credential health-check) | already tracked |
| **`architecture-vs-operational-burden.md`** | elegant designs can install hidden recurring operational tax; "what keeps working in 6 months untouched?" | **CAPABILITY** | **→ PLOS CAP-7** (operational-burden / runtime-fit lens) | already tracked |
| **`v6-capability-conversion-discipline.md`** | Memory remembers · Wiki explains · Skills execute · Agents own outcomes; convert recurring docs to capability | **INHERITED-SKILL** | **→ delivery-os `census-detector` + capability-ledger discipline** (this is the v6 doctrine itself) | already in OS ledger (census-detector candidate) |
| **`v6-signal-capability-changes-outcomes.md`** | the real v6 signal = a capability that CHANGES a decision/outcome; track the inheritance gap | **INHERITED-SKILL** | **→ delivery-os anti-decay rule + maturity-stage tracker** (already encoded in CAPABILITY-LEDGER §maturity / §anti-decay) | already in OS ledger |
| **`measurement-plus-experience-validation.md`** | founder-facing "solved" needs BOTH live measurement AND independent fail-closed experience review | **INHERITED-SKILL** | **→ delivery-os experience-gate + founder-experience-reviewer** (the proven pattern) | already in OS ledger (experience-gate, in-OS) |
| **`real-path-not-bypass-verification.md`** | a smoke that bypasses the production resolver/port is NOT real-path proof; drive the real product path | **INHERITED-SKILL** | **→ delivery-os v5 doctrine D-REAL-PATH-VERIFY / Runtime-Repro** (already inherited) | already in OS (v5 doctrine) |
| **`evidence-before-constraint.md`** | verify actual runtime state before declaring anything missing/broken; no weak-probe "facts" | **INHERITED-SKILL** | **→ delivery-os v5 doctrine (Runtime-Repro / measure-before-assume)** — sibling of request-path discipline | already in OS (v5 doctrine) — see note R1 |
| **`execution-model-by-work-size.md`** | per-work-size pipelines; no actor builds+validates+approves its own work; VERIFY artifacts audit it | **INHERITED-SKILL** | **→ delivery-os verify-gate (author≠verifier) + OPERATING-LOOP** (already inherited) | already in OS |

> **MEMORY note:** every memory entry is *also* preserved as-is regardless of a capability route — the
> founder-learning text stays a memory entry; the CAPABILITY/INHERITED routing is the *additional*
> executable destination, not a deletion. No memory entry is dropped by this audit.

## Section B — Skills (`.claude/skills/`) — 7, all delivery-os-sourced
PLOS has authored **ZERO** project-local skills (confirmed: `docs/v6-adoption-status.md` line 36).

| asset | knowledge | destination | concrete target | status |
|---|---|---|---|---|
| `discovery-interview/` | founder discovery → BRIEF/MISSION/NORTH-STAR | INHERITED-SKILL | already canonical in delivery-os (os-sync) | already tracked |
| `grill-me/` | adversarial depth interview | INHERITED-SKILL | already canonical in delivery-os | already tracked |
| `migration-assessment/` | capability-by-capability legacy audit | INHERITED-SKILL | already canonical in delivery-os | already tracked |
| `principle-11-review/` | independent multi-lens consequential-decision review | INHERITED-SKILL | already canonical in delivery-os | already tracked |
| `production-readiness-review/` | pre-release go/no-go lenses | INHERITED-SKILL | already canonical in delivery-os | already tracked |
| `ecosystem-alignment-review/` | owned/consumed entity cross-check vs registry | INHERITED-SKILL | already canonical in delivery-os | already tracked |
| `verify-gate/` | author≠verifier enforcement | INHERITED-SKILL | already canonical in delivery-os | already tracked |

> Nothing PLOS-authored here → nothing to promote and nothing at risk. These are consumed via the
> single canonical path; the cutover re-syncs them, it does not lose them.

## Section C — Wiki (`wiki/`) — 2 files, ZERO content pages
| asset | knowledge | destination | concrete target | status |
|---|---|---|---|---|
| `wiki/_index.md` | the navigable map — explicitly **no pages yet** ("earned, not scaffolded") | WIKI / PRESERVED-DOC | stays the wiki index (scaffold/standard) | preserved (no knowledge to migrate) |
| `wiki/FRONTMATTER-CONTRACT.md` | the wiki frontmatter contract + records-vs-understanding boundary | WIKI / PRESERVED-DOC | stays the contract (mirrors delivery-os template) | preserved |

> **The wiki holds no homeless knowledge.** All PLOS understanding currently lives in memory + docs.
> Nothing to lose here.

## Section D — Binding decisions / load-bearing invariants (`docs/`)
The founder-named invariants (D2 no-send, D6 deterministic scoring, D9 LinkedIn lane, the Waterline).

| asset | knowledge | destination | concrete target | status |
|---|---|---|---|---|
| `docs/architecture-spec.md` §0 (D1–D8) | binding CTO decisions: D2 (draft-sequence-up-front, one-approval, per-touch hash — no lazy send), D6 (deterministic scoring + single cheap judge call), D3/D4/D5/D7/D8 | WIKI / PRESERVED-DOC | stays the binding-decision record (LOCKED architecture) | preserved |
| `docs/architecture-addendum-01.md` | referral channel & decision-maker intelligence | WIKI / PRESERVED-DOC | stays preserved (extends the spec) | preserved |
| `docs/architecture-addendum-02.md` | 5-agent modular redesign w/ built-in learning; preserves D1–D9; D9 = LinkedIn lane gated/deferred | WIKI / PRESERVED-DOC | stays preserved (the D9 LinkedIn-lane invariant lives here) | preserved |
| `docs/architecture-addendum-03.md` | the delivery (SDLC) agent team + D1–D9 conformance review responsibility | WIKI / PRESERVED-DOC | stays preserved | preserved |
| `docs/strategy/market-definition-and-waterline.md` | **the LOCKED Waterline Rule** (segment-specific above; spine below stays agnostic) | WIKI / PRESERVED-DOC | stays the LOCKED strategy reference | preserved |
| `docs/adr/0001-project-first-discovery.md` | ADR — project-first discovery | WIKI / PRESERVED-DOC | stays ADR | preserved |
| `docs/adr/0002-advisory-boundary.md` | ADR — the Advisory Boundary (facts deterministic, reasoning advisory) | WIKI / PRESERVED-DOC | stays ADR | preserved |
| `docs/adr/0003-identity-boundary.md` | ADR — Tenant vs Contact identity boundary | WIKI / PRESERVED-DOC | stays ADR | preserved |
| `docs/learning-review-preregistration.md` | FROZEN pre-registered learning review (questions/metrics/triggers committed before data) | WIKI / PRESERVED-DOC | stays frozen pre-registration | preserved |
| `docs/learning-review-query-pack.md` | the executable query pack for the learning review | WIKI / PRESERVED-DOC (→ feeds `learning-review` skill) | stays preserved; consumed by the inherited learning-review skill | preserved |
| `docs/definition-of-done.md` | the DoD (where "founder-ready" is currently prose — CAP-1's target) | WIKI / PRESERVED-DOC | stays DoD; the founder-ready CHECK becomes CAP-1 (tracked) | preserved |
| `docs/founder-acceptance-test.md` | the Founder Acceptance Test (FAT) — human-run lifecycle gate | WIKI / PRESERVED-DOC | stays preserved | preserved |
| `docs/build-plan.md` · `docs/implementation-roadmap.md` · `docs/project-vision.md` | plan / roadmap / vision narrative | WIKI / PRESERVED-DOC | stays preserved | preserved |
| `docs/engineering-workflow.md` | how PLOS builds | WIKI / PRESERVED-DOC | stays preserved (points to delivery-os) | preserved |
| **`docs/capability-backlog.md` (CAP-1..7 + Inheritance ledger)** | the lesson→capability queue + the v5→v6 inheritance-gap ledger | **CAPABILITY (the ledger itself)** | **feeds delivery-os CAPABILITY-LEDGER.md** (single canonical ledger) — see §promotion | already tracked |
| **`docs/v6-adoption-status.md`** | "uses v6 vs operated-by-v6" scorecard + the two highest-leverage moves | WIKI / PRESERVED-DOC + CAPABILITY signal | stays preserved; its gaps are tracked CAP rows + OS-ledger rows | preserved |

## Section E — Document families (bulk; explanation/evidence layer)
These are the "wiki explains / preserved evidence" layer. Each family is preserved wholesale (no
deletion); none is a recurring lesson needing a NEW capability beyond what §A/§D already route.

| family (count) | knowledge it holds | destination | concrete target | status |
|---|---|---|---|---|
| `docs/verify/VERIFY-*.md` (55) | independent verification evidence per slice (the audit trail of author≠verifier) | WIKI / PRESERVED-DOC | stays preserved (verification record) | preserved |
| `docs/slices/*.md` (29) | per-slice design specs + acceptance tests + 1 postmortem | WIKI / PRESERVED-DOC | stays preserved (design history; CAP-4 cached-source pattern cites `mailbox-local-cache.md` §9 — tracked) | preserved |
| `docs/proposals/*.md` (26) | design proposals (The Room, conversation-intelligence, workspace lanes, Floor, advisor) | WIKI / PRESERVED-DOC | stays preserved (design exploration) | preserved |
| `docs/reviews/*.md` (10) | decision-reviews + phase/learning reviews + OS-retrospective + skills-first/inheritance recommendations | WIKI / PRESERVED-DOC | stays preserved (review record) | preserved |
| `docs/design/*.md` (5) | honest-motion, invoice-delivery-flow, the-floor, room-operational-surfaces | WIKI / PRESERVED-DOC | stays preserved | preserved |
| `docs/runbooks/*.md` (2) | first-invoice-send walkthrough + founder setup/delivery runbook | WIKI / PRESERVED-DOC | stays preserved (operational playbooks) | preserved |
| `docs/analysis/*.md` (3) · `docs/strategy/*` · `docs/architecture/*` · `docs/contracts/*` (2) | corridor/signal analysis, the-room-company-os arch, seam contracts | WIKI / PRESERVED-DOC | stays preserved | preserved |
| `docs/reviews/DECISION-REVIEW-2026-06-14-mailbox-*.md` (2) | §11 decision reviews (ED-1 + OAuth migration) — blind-lens output | WIKI / PRESERVED-DOC | stays preserved (decision record) | preserved |

---

## Promotion list — INHERITED-SKILL (the compounding set → delivery-os)
Proven-in-PLOS capabilities that should compound to every future project via os-inherit/os-sync. **All
are already represented in `delivery-os/capabilities/CAPABILITY-LEDGER.md`** (verified against that file):

| from PLOS (memory/doc) | promote to delivery-os as | ledger status |
|---|---|---|
| `measurement-plus-experience-validation.md` + the `pnpm experience:review` harness | **experience-gate + founder-experience-reviewer** | **in-OS** (verified PLOS PR #127) ✅ |
| `v6-capability-conversion-discipline.md` (lesson→capability conversion test) | **census-detector** (≥3× auto-extraction) + the capability-ledger discipline | candidate in OS open-backlog (`census-detector #10`) ✅ |
| `v6-signal-capability-changes-outcomes.md` (capability-changes-outcome signal + inheritance gap) | **anti-decay rule + maturity-stage tracker** | encoded in CAPABILITY-LEDGER §maturity / §anti-decay ✅ |
| `real-path-not-bypass-verification.md` · `evidence-before-constraint.md` | **v5 Runtime-Repro / D-REAL-PATH-VERIFY doctrine** | already inherited (v5 doctrines) ✅ |
| `execution-model-by-work-size.md` | **verify-gate (author≠verifier) + OPERATING-LOOP** | already inherited ✅ |
| **CAP-1 founder-ready DoD gate** + **CAP-2 Jarvis product-reality review** | OS-foundational once built+proven in PLOS (reconcile with the existing experience-gate/founder-experience-reviewer — do NOT fork) | named promotion candidates in CAPABILITY-LEDGER (lines 28–29) ✅ |

> The single proof-of-the-whole-loop the founder is owed: take ONE proven capability (the
> experience-review), make it fire automatically (DONE — PLOS #128 CI gate), AND have a fresh project
> inherit it via os-inherit. That last hop (apply os-inherit to PLOS) is the OS open-backlog HIGH item.

## LOST / rescue section
**LOST (no destination at all): 0.** Every inventoried asset has a destination.

**Tracking gaps (near-LOST — a CAPABILITY/INHERITED candidate not yet in any ledger).** Per the method,
a recurring-lesson candidate left untracked is a near-LOST and a rescue task:

- **R1 — `evidence-before-constraint.md` is not explicitly named as a distinct delivery-os doctrine row.**
  It is *covered* by the v5 Runtime-Repro / measure-before-assume family and is a sibling of CAP-5
  (request-path: measure before reaching for infra). **Risk:** low (the behavior is inherited), but the
  specific "never let one weak probe become a stated constraint" lesson has no ledger row of its own.
  **Rescue:** add a one-line note under CAP-5 (or the OS Runtime-Repro doctrine) that this memory is its
  founder-evidence source — so the lesson is traceable, not just behaviorally absorbed. *Non-blocking.*

- **R2 — CAP-4 "cached external source" pattern (`docs/slices/mailbox-local-cache.md` §9).** Tracked as
  PLOS CAP-4 (extraction-trigger = 2nd consumer, rule-of-three), so it IS in the PLOS backlog — but it
  is **not yet in the canonical `delivery-os/capabilities/CAPABILITY-LEDGER.md`** (correctly, n=1).
  **Risk:** low — deliberately deferred to the 2nd consumer. **Rescue:** none required pre-cutover;
  note it is intentionally PLOS-local until proven twice. *Non-blocking — by design.*

- **R3 — `live-db-migration-gap.md` (hand-migrated `plos` DB → silent runtime drift).** This is an
  operational hazard with an obvious capability form (auto-apply-on-merge / migration-drift gate against
  the live DB) but is **in NO ledger** (not CAP-1..7, not the OS ledger). It currently survives only as a
  memory note. **Risk: medium** — it has already bitten at runtime and relies on human memory.
  **Rescue:** add a CAP-8 row to `docs/capability-backlog.md` (target form: a `db:migrate:check`
  extension / drift gate against the live review DB). *This is the one genuine tracking gap that should be
  closed; it does not lose KNOWLEDGE (the memory persists) so it does not hard-block, but it is the
  clearest "lesson left as prose" the founder's standard warns against.*

No asset is without a home; the three items above are **tracking-completeness** rescues, not knowledge
that would vanish. The memory entries themselves all persist through the cutover.

---

## VERDICT: **GO** (with 3 non-blocking rescue tasks logged)

- **LOST (no destination): 0** → the hard gate (LOST = 0) is satisfied.
- Every memory entry is **preserved as-is**; every CAPABILITY row (CAP-1,2,3,5,6,7) is **already tracked**
  in `docs/capability-backlog.md`; every INHERITED-SKILL row is **already represented** in
  `delivery-os/capabilities/CAPABILITY-LEDGER.md`; the wiki holds no homeless knowledge to lose; all
  binding invariants (D2 no-send, D6 deterministic scoring, D9 LinkedIn lane, the LOCKED Waterline) are
  preserved as documents.
- **GO is conditional on honesty about R3:** knowledge is not lost (the `live-db-migration-gap` lesson
  persists in memory), so the no-loss gate passes — but R3 is the one lesson sitting as prose with an
  obvious unbuilt capability form and NO ledger row. Recommend logging CAP-8 before/at cutover so the
  founder's "promoted or preserved, never lost" standard is met in spirit, not just letter. R1 and R2 are
  traceability/timing niceties.

**Re-run trigger:** if any of R1/R3 is desired as a hard precondition, this flips to BLOCKED until the
CAP-8 row (R3) exists. As written against the literal no-loss gate (LOST = 0, every capability/inherited
row in a ledger), the verdict is **GO**.

### Counts per destination
| destination | count (distinct asset rows) |
|---|---|
| MEMORY (preserved as-is) | 33 (32 entries + index) |
| WIKI / PRESERVED-DOC | ~150 (2 wiki + 3 ADR + spec+3 addenda + waterline + learning-review×2 + DoD/FAT/plans/workflow + 55 verify + 29 slices + 26 proposals + 10 reviews + 5 design + 2 runbooks + analysis/contracts) |
| CAPABILITY (project-local, PLOS ledger) | 6 routed (CAP-1,2,3,5,6,7) + capability-backlog itself |
| INHERITED-SKILL (delivery-os) | 7 consumed skills + 6 promoted patterns (all in CAPABILITY-LEDGER) |
| LOST | **0** |
| Tracking gaps (rescue tasks) | 3 (R1 low, R2 by-design, R3 medium → log CAP-8) |
