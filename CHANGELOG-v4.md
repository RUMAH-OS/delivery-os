# Delivery OS v4.0 — the Consolidation (Admin + PLOS learning promoted into the base)

**Status:** built on branch `v4.0-consolidation`; **pending the F2 consolidated ratification** (the independent
verification of this packet IS that check) — then merge, tag `v4.0`, push. NOT merged, NOT pushed by its author.
**Authority:** founder commission ("Produce and implement the Delivery OS updates required to preserve and
compound learning") executing the design pair: property-lead-os `docs/reviews/cross-system-os-assessment.md`
(#84) + `docs/reviews/consolidated-inheritance-recommendation.md` (#85 — the authoritative manifest; its §A.3
is the translation ledger; **an unmapped row rejects this release**).
**Triages carried:** `docs/feedback/OS-FEEDBACK-RETRO-ADMIN-2026-06-12.md` · `OS-FEEDBACK-RETRO-PLOS-2026-06.md`
· `OS-FEEDBACK-CONSOLIDATION-2026-06.md` (filed in this packet — the inheritance loop's missing artifacts).
**Earning evidence per promotion:** every ledger row below cites its #85 row; the incidents live in
`case-studies/2026-06-incident-ledger.md` (anchored) — the F2 "per-promotion evidence in the packet" condition.

## Version identity (founder ruling F1)
- **v4.0 is a REAL base version**: this changelog + the `VERSION` marker (which the v4 §14 review-artifact
  detector recognizes in a push) + the `v4.0` git tag **applied at merge** (the tag push then fires the
  original §14 tag trigger, satisfied by the triages above). Rollback = re-pin to `v3.8` + os-sync re-render —
  possible again precisely because v4.0 is tagged.
- **Supersedes rumah-admin's unilateral `v4.0-skills-first` router label** — an overlay-minted version string
  with no tag behind it (nothing to roll back from or to). Rule now in Governance §14: overlays never mint OS
  versions; consumers adopt by pin.
- **Named adoption moments (recorded per F1):**
  - **PLOS** adopts (re-pins 3.8 → 4.0) **when its learning-review gate fires** (gates.md: ≥10 outreach
    outcomes → the pre-registered learning review).
  - **rumah-admin** adopts **when the June invoicing run completes** — deliberately doubling as the first
    real-work test of the skills-first packaging (N1: a conversion is unproven until it fires).
  - At each adoption: local dialect copies of merged skills are deleted in the same change (anti-third-fork rule).

## The DO-NOT list (re-ratified from #84 step 9 — binding on this and future cuts)
1. **NO `core/` → `KERNEL/` rename** (T10) — three repos point at `core/` paths by literal string; the kernel
   is a content discipline, not directory surgery. (Same logic kept `principle-11-review`'s directory name;
   `blind-design-panel` is its recorded alias.)
2. **NO wholesale reference-catalog imports** — only the three adopt verdicts (validate-skills lint, the
   vendored debugging skill, the description discipline) + adapted fragments; rejections recorded with reasons
   in `skills/README.md` (X11).
3. **NO re-litigation of the loop** — the slice → independent VERIFY → review → human merge loop is proven
   (zero violations at every mechanical link) and untouched.
4. **NO forcing every lesson into a skill** — §14's routing rule: most v4 lessons landed as hooks, template
   rows, DoD rows, and doctrine lines.

---

## The translation ledger — every #85 §A.3 row → its landing on this branch

Legend: file paths are branch-relative. `(commit)` markers refer to the branch's logical commits.
M-rows are PROJECT-destined (they stay in their repos; base ships nothing for them — listed for completeness).

### KERNEL rows (31)
| Row | Landed at |
|---|---|
| K1 §0 never migrates (+75-PR evidence comment) | `templates/CLAUDE.md.template` §3 invariant-block comment |
| K2 answers-or-points + ~100-line cap | `templates/CLAUDE.md.template` header (cap + eviction rule) |
| K3 DELETE the "hand-maintained" header | `templates/CLAUDE.md.template` header (deleted + tombstone note) |
| K4 hand/derived split; hand-edit = fail-closed lint | `templates/CLAUDE.md.template` header + `templates/tools/check-os-drift.mjs` |
| K5 doctrine seed = the day-1 inheritance mechanism | `templates/memory/doctrine-seed.md` + scaffolder 4d |
| K6 evidence-before-constraint | doctrine-seed D-EVIDENCE |
| K7 conversations-not-data | doctrine-seed D-NORTHSTAR |
| K8 decide-don't-overask + pre-framed packages | doctrine-seed D-OVERASK (+ S10 skill) |
| K9 preservation-before-extraction | doctrine-seed D-PRESERVE |
| K10 self-inflicted destruction defect class | doctrine-seed D-DESTRUCT + `processes/qa-and-testing.md` row + S8 step 3 |
| K11 gates change by signature; owner + reconsideration date | doctrine-seed D-GATES + `templates/gates.md.template` |
| K12 author≠verifier as identity-level law | doctrine-seed D-AV + GOVERNANCE §12 (mechanism already base) |
| K13 mechanism-over-prose law | GOVERNANCE §15 ¶1 + doctrine-seed D-MECH |
| K14 deterministic-spine-first | doctrine-seed D-SPINE (OPERATING-LOOP wording kept verbatim) |
| K15 ownership-as-mechanism; SAP test; reads-truth/events-triggers | doctrine-seed D-OWNER |
| K16 contracts+probes never narrative | GOVERNANCE §15 ¶3 + doctrine-seed D-CONTRACT |
| K17 audit-before-assume | doctrine-seed D-AUDIT + DoD row 8 + loop standing beat |
| K18 cheapest-reversible + pre-registered reversal | doctrine-seed D-REVERSIBLE + `templates/slice.md` reversal field |
| K19 prefer-the-recoverable-direction | doctrine-seed D-RECOVER |
| K20 rehearsal-then-production identical tooling | doctrine-seed D-REHEARSE + S12 |
| K21 cross-derive one number by hand | doctrine-seed D-DERIVE + S1 red flag + S12 step 7 |
| K22 refusal gates around irreversibles | doctrine-seed D-REFUSE + S10/S11 enforcement steps |
| K23 decision-surfacing-is-the-product | doctrine-seed D-SURFACE + S11 step 6 |
| K24 founder-acts-are-the-long-pole; credentials at spec time | doctrine-seed D-LONGPOLE + `templates/slice.md` founder-acts field + `templates/api-contract.md` credentials section |
| K25 operating begins at a named cutover | doctrine-seed D-CUTOVER + OPERATING-LOOP standing beat + §11 trigger |
| K26 verify-environment-before-DDL | doctrine-seed D-ENV + S12 precondition |
| K27 platform-conventions-first 15-min pass | doctrine-seed D-PLATFORM + S15 section |
| K28 one-derivation-many-consumers | doctrine-seed D-ONEDERIVE + S3 step 7 |
| K29 events for deltas + reads for truth (founder-credited, N15) | doctrine-seed D-EVENTS + incident-ledger #n15-founder-hybrid |
| K30 LLM-narrates-tools | doctrine-seed D-NARRATE (+ ledger #relayed-prose) |
| K31 credentials = stop condition; classifier as 4th layer | GOVERNANCE §15 ¶4 + doctrine-seed D-CREDS |

### BASE rows (38)
| Row | Landed at |
|---|---|
| B1 author≠verifier write-binding + probe re-execution | GOVERNANCE §12 (v4 bullets) + `templates/hooks/verify-gate.mjs` |
| B2 write-scoping polices tests/ | GOVERNANCE §12 bullet + verify-gate `changedTests` + VERIFY `test_pins_amended_by` |
| B3 honest wording + machine-readable probe | OPERATING-LOOP status section + verify-gate `probeHolds` + VERIFY `machine_probe` |
| B4 machine-read merge gate | `templates/tools/merge-pr.mjs` + DoD row 9 + OPERATING-LOOP merge ¶ + scaffolder install |
| B5 derived state over hand-maintained | `templates/tools/render-kernel.mjs` (+pin) + `check-os-drift.mjs` fail-closed + K3/K4 rows |
| B6 scoped derived-state rule | GOVERNANCE §7 |
| B7 os_version derives from the pin | `templates/tools/check-os-drift.mjs` (fail-closed) + render-kernel |
| B8 capability manifests + sibling probes | `templates/manifest.schema.json` + `templates/hooks/sibling-probe.mjs` + settings.json SessionStart |
| B9 audit-before-assume DoD row + loop beat | DoD row 8 + OPERATING-LOOP standing beat |
| B10 panel economics | GOVERNANCE §11 economics block |
| B11 invariants + reversals only | GOVERNANCE §11 economics block |
| B12 production-readiness folds into the panel skill | GOVERNANCE §11 + `skills/principle-11-review` v2.0 + X3 archive note |
| B13 evidence governor | GOVERNANCE §15 ¶2 + `templates/gates.md.template` rules |
| B14 durability-as-Phase-0 non-waivable | DoD Phase-0 row + `templates/release-readiness.md` first hard gate |
| B15 §14 continuous-delivery trigger | GOVERNANCE §14 + verify-gate pre-push (detector + backstop, hard-block F7) + pre-push hook |
| B16 bump-or-declare-no-learning | `skills/learning-review` step 7 + OPERATING-LOOP write-back row |
| B17 three-tier memory | OPERATING-LOOP write-back table + scaffolder memory/ dirs + doctrine seed |
| B18 question-keyed DECISIONS.md (Admin status grammar; F3) | `templates/DECISIONS.md.template` + GOVERNANCE §7 pointer |
| B19 write-back-gate | DoD row 7 + `skills/write-back-gate` |
| B20 environment hygiene day 1 | scaffolder 5a + PATH-stripped smoke + `scripts/dev-worktree.sh` + `.gitattributes` |
| B21 PS-5.1 byte/secret rule | GOVERNANCE §15 ¶6 (+ S15 step 2) |
| B22 gestured-pull posture + honest ceiling | GOVERNANCE §15 ¶5 |
| B23 registry LAW vs STATE | GOVERNANCE §7 (execution remains ecosystem-side) |
| B24 unenforced DoD rows deleted; hygiene rule | DEFINITION-OF-DONE hygiene rule (+ X4) |
| B25 machine-guard + run-unique tokens | `processes/qa-and-testing.md` + S1 step 2 + VERIFY machine-guard line |
| B26 one-DDL-truth + three-truths evidence | `processes/database-migrations.md` |
| B27 migration/schema scaffold defaults + .env NEVER-COMMIT | `processes/database-migrations.md` defaults + scaffolder 5a |
| B28 smoke battery + login-path smoke | `templates/release-readiness.md` + S15 step 5 |
| B29 assertTestDatabase test harness | `templates/test-harness/assert-test-database.mjs` + scaffolder |
| B30 harvest litmus replacement | `skills/README.md` |
| B31 skill format v2 (hybrid, C3-amended) | `templates/SKILL.md.template` + `skills/README.md` |
| B32 description discipline | `skills/README.md` + validate-skills error |
| B33 trigger hierarchy + slash commands | `skills/README.md` + `templates/commands/*` + validate-skills must-fire rule |
| B34 per-phase + always-on install | scaffolder 2b + `skills/README.md` install model |
| B35 rendered task→skill routing | `templates/tools/render-kernel.mjs` Trigger column |
| B36 composition vocabulary | `agents/README.md` |
| B37 validate-skills fail-closed lint | `templates/tools/validate-skills.mjs` + `scripts/validate-skills.mjs` + pre-push Gate 3 |
| B38 half-day batching guidance | OPERATING-LOOP standing beats |

### TEMPLATE rows (12)
| Row | Landed at |
|---|---|
| T1 SKILL.md.template + exemplar note | `templates/SKILL.md.template` |
| T2 slice = a template, upgraded | `templates/slice.md` |
| T3 VERIFY amendments | `templates/VERIFY.md.template` |
| T4 four registries | `templates/{DECISIONS,INVARIANTS,gates,friction-log}.md(.template)` + scaffolder 4c |
| T5 doctrine seed file | `templates/memory/doctrine-seed.md` |
| T6 manifest.json schema | `templates/manifest.schema.json` |
| T7 api-contract upgrade | `templates/api-contract.md` |
| T8 incident-backed rationalization tables (scoped per C3) | `templates/SKILL.md.template` section + S1/S14 exemplars |
| T9 two-doc rule | `checklists/migration.md` + S12 step 10 |
| T10 NO core/→KERNEL/ rename | the DO-NOT list above (deliberately *not* landed as a change) |
| T11 settings template wiring | `templates/settings.json.template` (SessionStart probe; §14 detector rides pre-push) |
| T12 OS-FEEDBACK event enum | `templates/OS-FEEDBACK.md.template` |

### SKILL rows (19)
| Row | Landed at |
|---|---|
| S1 verification v2.0 (P ∪ A ∪ R) | `skills/verification/SKILL.md` |
| S2 blind-design-panel / principle-11 v2.0 | `skills/principle-11-review/SKILL.md` (directory kept per T10; alias recorded) |
| S3 executable-contracts | `skills/executable-contracts/SKILL.md` |
| S4 cross-system-reality-audit | `skills/cross-system-reality-audit/SKILL.md` |
| S5 ecosystem-alignment-review trigger amendment | `skills/ecosystem-alignment-review/SKILL.md` (1.1.0) |
| S6 friction-triage | `skills/friction-triage/SKILL.md` + `templates/friction-log.md.template` |
| S7 gate-ledger | `skills/gate-ledger/SKILL.md` |
| S8 instruments-audit | `skills/instruments-audit/SKILL.md` |
| S9 learning-review (+C1 fork, F8) | `skills/learning-review/SKILL.md` |
| S10 decision-ratification (+N5/N8) | `skills/decision-ratification/SKILL.md` |
| S11 legacy-migration-etv | `skills/legacy-migration-etv/SKILL.md` (migration pack) |
| S12 cutover-execution (+N4/N6) | `skills/cutover-execution/SKILL.md` (migration pack) |
| S13 write-back-gate | `skills/write-back-gate/SKILL.md` + DoD row 7 |
| S14 debugging-and-error-recovery (vendored) | `skills/debugging-and-error-recovery/SKILL.md` |
| S15 deploy-vercel-supabase → platform pack (C4) | `skills/platform/deploy-vercel-supabase/SKILL.md` |
| S16 ops-truth-integration stays project | `skills/README.md` catalog note (meta-doctrines in seed/S3) |
| S17 interview-me mechanics (future) | `skills/README.md` catalog note + `_archive` resurrection condition |
| S18 stock skills kept; verify-gate dialect fixed (C6) | `skills/{discovery-interview,migration-assessment}` kept; `skills/verify-gate` 1.1.0 |
| S19 grill-me retired | `skills/_archive/grill-me` + `skills/_archive/README.md` |

### PROJECT rows (14 — stay in their repos; base ships nothing, by design)
M1–M12 (PLOS: AttentionItem grammar, ask-routes, tokenization, 16-table pin evidence, INVARIANTS
consolidation P1, the pre-registration freeze [NEVER MOVES], LinkedIn channel law, dev-doctor, machine-local
trivia, race specifics, moat strategy note, referral evidence) and M13–M14 (Admin: seam specifics + import
list; ADR grammar grandfathered under F3). Their noun-free extracts ARE in base (B25/B26/K10/K18/B13 etc. —
see the OS-FEEDBACK triages' routing tables); the noun-bearing rows must not enter the clean-room
(`check-no-backflow.mjs` enforces).

### Archive-with-pointer rows (12)
| Row | Landed at |
|---|---|
| X1 wiki | scaffold removal + `docs/archive/{wiki-templates,framework-wiki}` + `case-studies/2026-06-wiki-citation-survival.md` |
| X2 grill-me | `skills/_archive/grill-me` + README pointer |
| X3 production-readiness-review | `skills/_archive/production-readiness-review` + folded into §11/S2 |
| X4 STATUS/project-log DoD rows | deleted from DoD + scaffolder; meta-lesson = the DoD hygiene rule (B24); templates remain on disk for grandfathered consumers |
| X5 spec-fiction archive (PLOS) | PROJECT disposition — gated on the dated superseding addendum (PLOS P0-4); out of base scope |
| X6 dead vendor adapters (PLOS) | PROJECT disposition — out of base scope |
| X7 superseded planning docs (PLOS) | PROJECT disposition — citation-sweep project-side |
| X8 the incident ledger | `case-studies/2026-06-incident-ledger.md` |
| X9 Slice-1.0 RCA kept | `case-studies/2026-06-10-author-verifier-not-operationalized.md` (indexed) |
| X10 Admin's 5-doc migration family | superseded by the two-doc rule (`checklists/migration.md`) |
| X11 rejected reference material | `skills/README.md` negative doctrine |
| X12 N14/N15 case studies | `case-studies/2026-06-incident-ledger.md` (#emergent-assets, #n15-founder-hybrid) |

---

## Contradiction rulings applied (C1–C6) and founder signatures (F1–F8)
- **C1** → the blast-radius fork is written INTO `skills/learning-review` (step 6a/6b) — **F8 signed** with it.
- **C2** → os_version derives from the pin; `check-os-drift.mjs` fails closed on a hand-edited derived field;
  the "hand-maintained" template line is deleted (a render-kernel requirement, noted in the template).
- **C3** → rationalization tables only where a named incident exists (`SKILL.md.template`, README).
- **C4** → deploy-vercel-supabase reclassified as a shared ecosystem **platform pack**.
- **C5** → debugging-and-error-recovery vendored NOW (the need had already recurred).
- **C6** → the stock verify-gate skill brought to the one dialect; `validate-skills.mjs` keeps it that way.
- **F1** signed (version identity + adoption moments above) · **F2** signed (this packet + the independent
  verification = the consolidated ratification; precedent recorded in §14) · **F3** signed (ledger-fronts-both;
  `DECISIONS.md.template` ships Admin's status grammar) · **F6** signed (wiki retired, archive-with-pointer) ·
  **F7** signed (hard-block detectors) · **F8** signed (lightweight learning-review default WITH the fork).
- **F4/F5 remain open** — they are PLOS-side P0 obligations (events-v1 contract; durability execution), not
  base content; the base now carries their doctrine (T7/B14) and their exhibits (incident ledger).

## Honest notes for the verifier (known gaps, stated not hidden)
1. **The framework's own installed copies** (`.claude/hooks/verify-gate.mjs`, `.claude/tools/*.mjs`,
   `.githooks/pre-push`, `.claude/skills/*`) are **not re-synced** in this packet: overwriting live hooks was
   denied by the permission layer mid-build and honored as a stop condition (§15 D-CREDS). The templates are
   canonical; sync the self-install at ratification (`cp templates/... .claude/...` + os-sync + render-kernel)
   — the framework router's §5 therefore still lists the v3 skill set until that sync.
2. The root `CLAUDE.md` §9 is hand-refreshed in this cut (its render tooling is part of the same deferred
   sync); §4's wiki table was updated to point at the archive.
3. `templates/STATUS.md` and `templates/project-log.md` remain on disk (grandfathered consumers may still
   reference them) but are no longer scaffolded or DoD-required — delete in v4.1 after both consumers re-pin.
4. The release acceptance test (#84 step 9 / #85 C2: scaffold a throwaway repo, one-afternoon inventory,
   PATH-stripped smoke) is **the verifier's to run** — author≠verifier; it was deliberately not self-certified here.
