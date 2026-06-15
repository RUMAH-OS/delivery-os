# Knowledge Layer Architecture — V6 Board Outcome (2026-06-15)

> Board: lead-architect · documentation · integration-architect · qa-reviewer · reviewer-critic (adversarial).
> Founder mandate: do NOT design a wiki — design a **Knowledge Capability** that moves us from
> `Markdown → Claude → Execution` to `Knowledge → Retrieval → Citation → Trust → Skills → Agents →
> Execution`, with measurable adoption and EVIDENCE. Companion: KNOWLEDGE-ADOPTION-GAP.md (the gap),
> SKILL-PROOF-ARCHITECTURE.md (the proofId spine + evidence ladder this REUSES).

## Verdict (board): APPROVE-WITH-CONDITIONS
The adversarial seat issued **REQUEST-CHANGES**, and its 6 conditions are **ADOPTED** (below). The
diagnosis (gap report) stands; the *proving slice* and the *gate-PLOS recommendation* are amended. One
condition (C5) **reverses the gap report's own recommendation to gate PLOS** — the board judges that
over-reach, and we correct ourselves rather than defend it.

## Headline (honest, unanimous)
Knowledge is **structurally weaker on the proof axis than skills**, and the design must say so. A skill
prescribes a unique artifact *structure* (an execution fingerprint — PROVABLE at L5). A knowledge unit is
a *claim/fact*; it prescribes a *value or constraint*, not a structure. Therefore **knowledge is
mechanically PROVABLE at retrieval (K1) + injection (K2), ATTESTABLE at citation (K3), and collapses to
PROXY at K4/K5 in the general case** — with a PROVABLE K5 **only** for "value-binding" units (where the
artifact carries a value uniquely derivable from the unit). It is also **MORE gameable than skills** (a
prose quote can be name-dropped decoratively with no structural witness), so the false-positive defenses
must be *stronger*, not weaker. Any design claiming more is the inference tower the skill board forbade.

## The Knowledge Capability — shape (lead-architect)
- **Knowledge unit (KU)** = an addressable, citable atom (NOT a file): a markdown doc with machine-parseable
  frontmatter — same parser as `skill-frontmatter` (reused). Identity = `kuId@version` (path-independent);
  `contentHash` over the body = tamper-evidence + citation-binding + currency proof; `supersedes` = version
  chain (one canonical current answer per concern).
- **Retrieval seam** = `knowledge-route.mjs`, a near-verbatim **fork of `skill-route.mjs`**: reuse
  `parseFrontmatter`, `routeTask`/`scoreSkill` (concern-agnostic ranker), `mintProofId`, `appendSelection`.
  New: `loadKnowledge`, the retrieval marker `[knowledge:<kuId>@<ver>#<proofId>]`. It is the **only
  observable path** to a KU — a raw `Read` produces no record and counts as zero (fail-closed by construction).
- **Composition:** zero forks of the spine. Reused: proofId, scorer, frontmatter parser, telemetry-union,
  `classifyDormant` (a never-retrieved KU = DORMANT knowledge — the "prose that never converted" disease, now
  *measured*), adoption-report (extended), author≠verifier. Genuinely new (small): the `kind: knowledge`
  registry, the retrieval marker convention, the `contentHash` citation-binding, and the honest **absence**
  of an L5 fingerprint for general knowledge.

## Knowledge lifecycle & ownership (documentation)
- **Inclusion test (gateable):** a KU is admissible iff (1) it survives **noun-stripping** as a second-app
  lesson (END-STATE disambiguation) OR is explicitly `applies-to:[this-app]` domain-binding, AND (2) it
  names a **non-obvious** claim (a trap/why/rollback — not a restated obvious fact) with ≥`citation`-strength
  backing, AND (3) it carries a **retrieval trigger**.
- **Promotion pipeline (promote-AND-preserve, Knowledge-Lost=0):** NOMINATE (census-detector flags signals
  recurring ≥3 sources with no capability) → DISTILL (one `wiki/<id>` file, reuse memory frontmatter shape) →
  BIND PROVENANCE (`{earned-from, source-file, anchor, git-sha-at-promotion, signal-pattern}`; source doc
  STAYS + gets a `promoted-to:` back-link — promotion is never deletion) → REGISTER (through the seam, so
  retrieval is observable).
- **Enforcement (a gate, not a hope):** wire census-pressure so an UNPROMOTED recurring signal **fails
  slice-close** (the knowledge analog of anti-idle); a learning-bearing slice cannot close DONE until its
  lesson is promoted or explicitly waived; every `cited-quote` must re-find in `source-file` at the recorded
  `git-sha` (fail-closed); a KU that exists but was never retrieved = `UNADOPTED`, not "adopted."
- **First unit nominated:** `ku-issued-artifact-immutability` (from `invoice-immutability-principle.md`) —
  highest evidence rung (founder-ratified), clean noun-strip (proves OS-reuse) with a real Admin binding left
  behind (proves promote-AND-preserve), sharp recurring trigger. (integration-architect's alt:
  `migration-fidelity-principles`, which has a checkable value-binding — preferred IF we want to exercise K5.)

## Evidence + telemetry model (integration-architect + qa-reviewer)
**Ladder (each evidence type caps the level it may claim):**
`ABLATION > CONTENT-BOUND-CITATION-AT-HASH > VALUE-BINDING > GENERIC-CITATION > MECHANICAL-LOG > CORRELATION.`

| CP | Knowledge checkpoint | Class | Strongest admissible evidence | Honest limit |
|---|---|---|---|---|
| K1 Retrieved | selection record `{proofId,kuId,contentHash,task}` | **PROVEN** | re-runnable seam log (`log`) | selected by seam ≠ agent attended; raw Read invisible → 0 |
| K2 Injected | marker = transcript first record + hash match | **PROVEN (construction)** | marker + `contentHash` (`structural`) | bytes in context, not attention |
| K3 Cited | `applied-knowledge:`+`knowledge-quote:` re-found in body **at the retrieved hash** | **ATTESTED** | verified verbatim substring (`citation`) | had+reproduced the fact; not causation |
| K4 Decision | non-obvious cited guidance tied to a choice | **PROXY** | ablation only for DECISIVE | mention ≠ causation |
| K5 Execution | artifact carries a value/constraint **uniquely** determined by the KU | **PROVEN only for value-binding KUs**; else PROXY | value-binding re-find; or `fingerprint(attributed)` via proofId-join to a skill's L5 in the same slice — **never bare fingerprint** | general prose has NO fingerprint → cap at K4 |
| K6 Outcome | slice trio on KU-retrieved slices | **per-slice unprovable** | population/ablation (`correlation`) | confounded by gates + competence |
| K7 Trust | `knowledge-health` aggregation | derived summary | ledger of independently-verified events | NOT a gameable scalar |

**`knowledge-selections.jsonl` record:** `{proofId(reused), ts, task, query, chosen/kuId, contentHash,
contentEncoding, score, why, candidates, k, parallelBatch, corpusRoot}`.

**`knowledge-health.mjs`** = fork of skill-health. **Applies the roster-integrity lesson we just fixed:**
`--json` to STDOUT only; `installed[]` = authoritative corpus from disk (never scraped, never skip-filtered);
`unknownCited[]` = citations of non-corpus units (surfaced, never in roster/totals); **NEW `staleCited[]`** =
cited-at-wrong-hash. UNMEASURED → exit 2 (fail-closed). `--self-test` must flip under sabotage.

**adoption-report:** the hardcoded `## Wiki Usage Evidence = 0` body is replaced by `buildKnowledgeSection`
(byte-sibling of `buildSkillSection`) consuming `knowledge-health --json` → real Retrieved/Cited/Influenced/
Trust + a `⚠ Data-quality` line. **Header `## Wiki Usage Evidence` stays frozen** (the completeness gate keys
on it). Until a corpus+log exist it renders `available: 0 · Retrieved: UNMEASURED` — honest, not a fake 0.

## Trust model (qa-reviewer; reviewer-critic binding)
`knowledge-trust(KU) = count of INDEPENDENTLY-VERIFIED influence events` (verified-citations-at-hash +
value-bindings), author≠verifier on the provenance itself. **Never retrieval count** (retrieval is the
cheapest, most farmable signal — a poller would manufacture infinite "adoption"). Recency/frequency are
capped, low-weight context. **Two HARD false-positives:** (1) `fabricated-citation` (quote not in body — the
load-bearing detector, mirrors skill "cited-but-no-fingerprint"); (2) `version-mismatch` (quote found in
*latest* but not at the *retrieved* hash — knowledge-specific; verifying against live instead of the pinned
hash is itself a telemetry-integrity hole like the phantom-skill bug). **Trivial-quote Goodhart:** a verified
but boilerplate quote counts only as `generic-citation` (does NOT increment trust); only non-obvious quotes
count.

## What we will NOT claim
Per-run outcome causation · retrieval = influence · "1.7MB is adopted knowledge" · trust scalar as truth ·
citation = attention · **NEW: "the fact is true because it is trusted/adopted"** (adoption measures influence,
never correctness — a widely-cited wrong fact is a propagated defect, not a validated one).

## ADOPTED conditions (from the adversarial seat)
- **C1 — Fingerprint-or-cap.** Define a knowledge fingerprint (output exhibits a value/constraint uniquely
  from the KU, re-found independently); if none exists for a KU, its claim is **capped at CITATION strength**
  and stamped so. No green "knowledge adopted" without fingerprint-or-honest-cap.
- **C2 — Name the raw-Read enforcement model + a DENOMINATOR.** State one of: advisory-with-honest-label /
  coverage-denominator / blocked-raw-Read. Adoption must be a **ratio** (retrievals / knowledge-relevant
  tasks) so non-adoption renders **RED**, not a small green count. UNMEASURED fails closed.
- **C3 — Decorative-citation FP detector** (cited-but-content-not-reflected-in-artifact) — mechanically
  detectable, or the citation is inadmissible as influence evidence.
- **C4 — One KU, one task class, author≠verifier on the provenance.** Reuse the proofId spine; no second KU
  until the chain is proven.
- **C5 — DECOUPLE from PLOS (reverses the gap report).** Knowledge Adoption is an **Admin-internal v6
  completeness item** on the prove-in-one-app track. The PLOS gate is the END-STATE **master gate** (PLOS
  inherits core + one cross-repo workflow green + one demonstrated reuse). They run in **parallel**; neither
  blocks the other. Coupling them would stake the N=1 escape on the **least-proven, most-gameable** layer —
  the inverse of risk management.
- **C6 — Fix skill-health roster bug first.** ✅ DONE (commit `9706eb2`, verified) — precondition met, since
  knowledge-health forks the same aggregator.

## NAMED KILL-CRITERION for the proving slice
> If, on the single promoted KU, an independent verifier cannot establish content-binding **above CITATION
> strength** on at least one real task — i.e. no fingerprint shows the KU's content shaped the output, only
> that it was retrieved and named — then the knowledge layer is **NOT proven**, the slice is **KILLED**, no
> second KU is promoted, no raw-Read-blocking and no PLOS coupling proceed, and the honest standing claim
> reverts to: *"knowledge is stored, retrieval is loggable, influence is unproven."*
Secondary kill: if the only way to green the slice is to count bare retrievals (K1) as "adoption," it failed.

## Smallest proving slice (the founder's 5 proofs + the conditions)
1. **One retrieval seam** — `knowledge-route.mjs` (fork; self-test: routing + proofId determinism + marker
   shape + log round-trip; a raw Read writes NO record).
2. **One promoted KU** — `ku-issued-artifact-immutability` (or `migration-fidelity-principles` if exercising
   K5), promote-AND-preserve, provenance frontmatter + `contentHash`.
3. **One content-bound citation** — agent emits `applied-knowledge:`+`knowledge-quote:`; independent verifier
   re-finds it **at the retrieved hash**; fabricated → `fabricated-citation`; stale → `version-mismatch`;
   trivial → `generic-citation` (no trust).
4. **One measurable retrieval event** — `knowledge-health --json`: authoritative roster, unknown/stale
   surfaced separately, UNMEASURED fails closed, trust = verified influence (100 retrievals + 0 citations →
   trust 0).
5. **One adoption report showing influence** — full chain K1→K2@hash→K3(verified)→(K5 value-binding if
   applicable), each cell strength-stamped, **K4/K6 explicitly DEFERRED-TO-ABLATION (not claimed)**, adoption
   shown as a **ratio** (C2). Over-claim or laundered FP → the report FAILS.

**Placement:** seam + health = OS-owned (`delivery-os/templates/tools/`), vendored + drift-gated; corpus =
app-local, promotion-to-shared gated on ≥2-app reuse + `contentHash` lock. Prove the chain on ONE KU in
Admin; do NOT mass-promote the 21 memory files + 76 signals.
