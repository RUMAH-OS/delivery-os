# Case Study — the Company-OS phase (provenance for the v5 doctrine)

> Continues `2026-06-incident-ledger.md`. The June-12 cutover ledger covered discovery→production; this covers the
> phase AFTER: Admin-as-truth-source for The Room (events/ECR-0006 → recurring-agreements → flexible fees →
> data-confidence → Company-OS truth feeds), ~15 verified slices, two prod releases. **Incidents are the
> provenance of doctrine** — every v5 promotion cites a row here. Case studies may name projects; **doctrine never
> does.** Project-local detail: `rumah-admin/docs/RETROSPECTIVE-2026-06-13-company-os-phase.md` +
> `RUFLO-INVESTIGATION-2026-06-13.md` + `DELIVERY-OS-V5-RECOMMENDATIONS-2026-06-13.md`.

## The one finding this phase adds
The June ledger's split (mechanism held / prose drifted) held again. This phase adds a sharper one: **a frozen
contract that EXISTS but is not READ is functionally a prose claim.** Every cross-system defect this phase traced
to building against a *model* of a contract instead of its bytes — the contract was on disk, ratified, the whole
time. → earns **A4 (read-canonical-first / contract-grounding gate)**, the v5 keystone.

## New incidents (continuing the ledger numbering)

### N17 — the pooler 3-iteration concurrency saga (the phase's top token + attention sink)
Production reads returned **crossed columns** and hung. Fix 1 blamed connection exhaustion (wrong — the DB had
9/60 conns). Fix 2 set the pool to **`max:1` — which made the corruption *consistent*** by forcing all concurrent
requests onto one shared connection through the Supabase **transaction** pooler (postgres.js pipelining mis-associates
responses there). Fix 3 — the **session** pooler (dedicated backend per connection) — was the real fix; proven by a
**concurrency repro against the running prod thing** (txn pooler HANGS; session 1400/1400 clean) and locked by a
checked-in `smoke:concurrency` guard that runs every deploy. ROOT CAUSE: the first two fixes came from
assumptions/curl, not the running thing under realistic concurrency. → strengthens §1 evidence-over-assumptions +
D-EVIDENCE; earns **D-RUNTIME-REPRO** (reproduce prod bugs on the running thing under realistic load; ship a
checked-in regression guard). NB the transaction-pooler/pipelining foot-gun was already half-known ("pooler
prepare:false", June ledger) — the concurrency-corruption half was not.

### N18 — built the cross-system producer BEFORE reading the canonical contract (the keystone incident)
The canonical, founder-ratified events contract existed on disk. The producer was built from a *mental model* of
it → divergent transport (PULL built vs PUSH ratified) **and** a divergent envelope **and** a duplicate contract
doc. Reconciled (transport amended to PULL, envelope fixed to the frozen shape, duplicate removed, re-ratified).
Two siblings of the same root in the same phase: (a) the **consumer contract had silently drifted** from what the
producer emits — caught only by reading the consumer's actual code; (b) a first design had the producer **rank
attention for the consumer** — caught *before code* by reading the consumer and finding it already owns ranking.
This is the **dual-contract incident's** continuation (June F4 obligation) and the single most expensive class this
phase. → earns **A4: read-canonical-first / contract-grounding gate** — before building any cross-system
producer/consumer, READ (1) the canonical contract, (2) the consumer's real code, (3) the source of truth, and
record the shape you are building to. Extends §15 *contracts+probes* and the operating-loop *audit-before-assume*
with the missing clause: **a contract existing ≠ a contract read.**

### N19 — verification saves, re-confirmed (the crown jewel)
Independent QA driving the *running* thing (not the author's tests) caught, pre-merge: a data-confidence diagnostic
flagging **~155–200 false "double-occupancy" findings** (an inclusive date-overlap rule firing on extension chains
/ boundary touches — a data-*accuracy* tool that would have *mis*represented reality, the worst possible bug for
that feature; held at `executed`-not-`verified`); a paginating cursor that **re-served the boundary row** (ms-vs-µs
truncation); a worklist that would **409 every non-rental agreement**; and an audit endpoint that ignored a
**hostile client-supplied `confirmed_by`**. ≥1 rejection per phase is the right rate; a verifier that never rejects
is decoration. → confirms §3/§12 + D-AV.

### N20 — token + ceremony cost of the per-slice double-subagent cycle (no instrument to see it)
~15 slices each ran engineer-build + independent-qa (+ occasional re-verify) as separate subagent invocations,
each re-reading large files from cold context. Right on load-bearing/cross-system/schema slices; **overkill on
trivial ones** (tests-only, tiny UI, docs). The OS measures `verify_status`, drift, gates, evidence counters —
**everything except token cost**, so this spend was invisible while it happened. → earns **A1** (deterministic /
direct-edit tier before spawning agents), **A2** (risk-scaled verification + parallel-batched independent
subagents), **A3** (a token/cost observability primitive — the OS's missing instrument), **A5** (cheaper
engineer→verifier context handoff). *Self-check:* none of these may weaken §3/§12 — independence stays
non-negotiable for the load-bearing classes; A2 only relaxes *trivial* slices, which the gate's non-impl exemption
already contemplates.

### N21 — shared-DB test-fixture accumulation flake (fixed twice = a missing standard)
data-confidence suites used cap-dependent presence assertions and left fixtures behind; the shared test DB
accumulated rows across runs until a fixture fell outside a 100-item display cap → intermittent red full-suite.
Fixed once (count-delta assertion), recurred (a second suite's leftover anomaly rows), fixed again (tag-scoped
teardown). Also: a VERIFY frontmatter **inline comment broke the gate's `verify_status` parser**. → strengthens
June's B25 (cross-test race); earns **A6** (test-fixture hygiene standard: tag-scoped teardown + cap-independent
count-delta assertions on shared DBs) + a clean-frontmatter rule for the gate.

### N22 — the boundary emerged through correction, not up front
"Producer owns facts / consumer owns ranking-attention", "do not edit the sibling repo", "do not build presentation
the consumer will replace" each arrived as **founder corrections mid-phase**, after effort had gone the other way
(operator-UX polish the consumer will replace; a producer-ranks-attention design). → earns **D-BOUNDARY-FIRST**:
write the cross-system ownership boundary *before* building across it, and judge work by *"does this help the
consumer understand/operate?"* — a one-line lens that would have pre-empted three corrections.

## Positive exhibits

### The negative control — Ruflo (scaling surface ahead of verified function)
A 59k-star multi-agent harness with "1999/1999 tests green" and an independent audit finding the **core
agent-execution non-functional** ("the wire connecting LLM providers, task queue, and agent registry is missing";
agents register but stay idle; "verify" = byte-integrity attestation, not work-correctness). It is the documented
failure mode of capability-count-as-marketing — and thereby **empirically validates two invariants**:
*earned-never-scaffolded* and *independent author≠verifier verification.* Green self-reported tests ≠ a working
system — exactly why the gate drives the *running* thing. → confirms D-MECH, N1; earns **D-NEGATIVE-CONTROL**
(study a mature-surface/hollow-core peer as a validation of discipline, not a feature menu).

### Additive data-minimised contracts + reads-are-truth held
The events §A envelope (`.strict()`) and the read-seam projections evolved additively across the whole phase; the
consumer tolerates new fields (`.passthrough()`); occupancy/health derive from one shared function (one-derivation-
many-consumers). The truth feeds shipped without coupling the consumer to the producer's schema. → confirms
D-ONEDERIVE, D-EVENTS, D-OWNER.

### The §14/§11 machinery is the right home for this very review
This phase's lessons route through the OS's own loop: this case-study (provenance) → an `OS-FEEDBACK` triage (§14,
mandated by the review-artifact detector) → a batch-ratified (F2) promotion into v5 → version bump → inheritance.
The review applying the OS's machinery to itself is the §14 design working as intended.

## Doctrine earned (noun-free; the v5 promotion candidates)
- **A4 / D-GROUND — read-canonical-first.** Before cross-system build: read the canonical contract + the consumer's real code + the source of truth; *a contract existing ≠ a contract read.* (N18; extends §15, audit-before-assume.)
- **D-RUNTIME-REPRO.** Reproduce prod bugs on the running thing under realistic load; leave a checked-in regression guard. (N17.)
- **A1/A2/A3/A5 — efficiency without weakening verification.** Direct/deterministic tier before agents; risk-scaled + parallel-batched verification; a token-cost instrument; cheaper engineer→verifier handoff. Independence stays non-negotiable for load-bearing classes. (N20.)
- **A6 — test-fixture hygiene.** Tag-scoped teardown + cap-independent assertions on shared DBs; clean VERIFY frontmatter. (N21.)
- **D-BOUNDARY-FIRST.** Write the cross-system ownership boundary before building across it; judge by "does this help the consumer understand/operate?" (N22.)
- **D-NEGATIVE-CONTROL.** A hollow-core mature-surface peer validates discipline; never a feature menu. (Ruflo.)
- **Re-confirmed:** D-MECH, D-AV, D-EVIDENCE, D-ONEDERIVE, D-EVENTS, D-OWNER, N1.
