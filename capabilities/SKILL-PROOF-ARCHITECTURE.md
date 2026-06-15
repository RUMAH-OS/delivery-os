# Skill Usage Proof Architecture — V6 Board Review outcome (2026-06-15)

> Board: lead-architect · qa-reviewer · integration-architect · reviewer-critic (adversarial) · software-engineer.
> Question: prove with EVIDENCE that a skill was triggered → injected → consulted → influenced a decision →
> influenced execution → influenced an outcome. Founder rejects inferred usage.

## Headline (honest, unanimous)
The full 6-level "proof" is **NOT achievable by telemetry/citation/trust-score alone**. Levels 1–2 are mechanically PROVABLE; Level 3 is *attestable* (content-bound citation), Level 5 is PROVABLE for execution skills via **artifact-fingerprint**, and Levels 4 & 6 are **proxy-only unless an ablation (counterfactual) is run**. Any design that claims more is "stacking an inference tower on the verify-gate's self-admitted best-effort footing" (reviewer-critic). Therefore **every influence record carries `evidence-strength: ablation|fingerprint|citation|log|correlation`**, and no weak signal may be laundered into a strong claim.

## 1. Proposed architecture
A single **`proofId`** minted at trigger by `skill-route` threads the chain (fixes the join-key gap G6 named). Checkpoints + where each artifact lives:
- **CP1 Trigger** → `skill-route --log` writes `.claude/os/telemetry/skill-selections.jsonl {proofId,task,chosen,score,why,candidates}`. *(deterministic, re-runnable)*
- **CP2 Injection** → the orchestrator's injected prompt **is the first record of the subagent transcript** (verbatim); embed `[skill:<name>#<proofId>]` in the prompt → guaranteed present in transcript + correlatable by `toolUseId`/`agentId`. *(provable by construction)*
- **CP3 Consulted** → the agent emits a **content-bound citation** (a verbatim quote from the SKILL.md that an independent verifier re-finds in the file). *(attestation; verifiable the agent HAD the guidance, not that it attended)*
- **CP4 Decision-influence** → cited non-obvious guidance tied to a choice. *(proxy; DECISIVE only via ablation)*
- **CP5 Execution-influence** → **artifact-fingerprint**: the output exhibits a structure the skill UNIQUELY prescribes (e.g. a VERIFY doc with verdict-flipping adversarial-mutation rows) — the agent can't make the fingerprint appear without doing the work. *(PROVABLE for execution skills)*
- **CP6 Outcome** → `classifyVerdict` proxy live; DECISIVE only via offline **ablation** fixtures. *(per-slice unprovable — confounded by gates + base competence)*
- **CP7 Trust** → `skill-health` aggregates, evidence-strength-stamped (NOT a gameable scalar — see §4).
Single source of truth per concern; `skill-health` is a pure read-aggregator joining on `proofId` (mirrors agent-health↔agent-route). Reuse: skill-route, skill-frontmatter, agent-health (`classifyVerdict`/`readTelemetryUnion`/`finalAssistantText`), agents-idle-check, slice-close.

## 2. Evidence model (strength ladder — each evidence type caps the level it may claim)
**ABLATION (counterfactual) > CONTENT-BOUND CITATION (verified, non-obvious) > ARTIFACT FINGERPRINT > GENERIC CITATION > MECHANICAL LOG > OUTCOME-CORRELATION.**
| Level | Provable here? | Strongest admissible evidence |
|---|---|---|
| 1 Triggered | **PROVEN** | deterministic, re-runnable trigger record |
| 2 Injected | **PROVEN** | injected prompt = verbatim first transcript record + content hash |
| 3 Consulted | **Attested** | content-bound verbatim quote re-found in SKILL.md (necessary, not sufficient) |
| 4 Decision | **Proxy / ablation** | non-obvious cited guidance + ablation for high-value judgment skills |
| 5 Execution | **PROVEN (execution skills)** | artifact-fingerprint (unique prescribed structure present) |
| 6 Outcome | **Per-slice unprovable** | population holdout / ablation only; correlation is a fleet pointer, never a single-run verdict |
**False-positive detection:** injected-but-not-cited (cap at L2) · **cited-but-no-fingerprint (HARD FP — suspected fabricated citation)** · cited-but-outcome-unchanged (decorative/inert) · selected-for-wrong-task (selector precision). The load-bearing FP = cited-but-no-fingerprint (catches credit-claiming; mechanically detectable).

## 3. Telemetry model + provenance (honesty ledger)
Six append-only JSONL streams mirroring `appendSelection`. The chain is **evidenced at the ends, trust/convention/proxy in the middle**:
| Link | Class |
|---|---|
| trigger record | **structural, re-runnable** (re-derive chosen/score/why) |
| toolUseId / transcript first-record | **structural, harness-emitted** |
| outcome (slice trio) | **structural** (capability re-run-verified) |
| orchestrator carries proofId | **TRUST** (model behavior) |
| proofId-in-prompt token | **CONVENTION** (paraphrase/drop severs it) |
| consultation/influence | **PROXY** (mention ≠ causation) |
Dormant + wiki-retrieval reuse the same proofId spine. Wiki retrieval telemetry is **blocked** until wiki access goes through a tool seam (raw Reads are unobservable). UNMEASURED → fail-closed (never "dormant by assumption").

## 4. Trust model (reviewer-critic's warning is binding)
Do **NOT** ship a single auto-ranking trust scalar — any usage-count metric is Goodhart-farmable (frequency/recency poking). Instead: an **evidence ledger per skill**, each claim stamped with its `evidence-strength`; "trust" = the count of **independently-verified** prevention/fingerprint events (author≠verifier on the provenance itself), never raw usage. Recency/frequency are capped, low-weight context, never the basis. A trust *number* may be shown only as a derived summary of the ledger, never as the source of truth.
**Dormant caveat:** add a `cadence: one-shot|recurring` field to SKILL.md frontmatter — one-shot skills (cutover-execution, legacy-migration-etv) must NOT be flagged dormant for non-use; they're single-use-by-nature.

## 5. Smallest proving slice
**One execution skill that leaves a fingerprint** (e.g. push-upstream-preflight, or verification-playbook). Carry it end-to-end with an artifact at every CP:
1. `skill-route --log` (port `appendSelection` from agent-route — skill-route has NO log today) → CP1 proven.
2. inject `[skill:#proofId]` marker → appears in transcript first record → CP2 proven by construction.
3. agent emits a content-bound quote → an independent verifier re-finds it in SKILL.md → CP3 attested.
4. the output carries the skill's unique artifact-fingerprint → CP5 PROVEN.
5. `skill-health.mjs` (fork agent-health: citation classifier + outcome join + evidence ledger + dormant mirror) emits the Skill Evidence row, every cell stamped with evidence-strength; UNMEASURED fails closed.
6. defer CP4/CP6 to an explicit, amortized ablation (per-skill default baseline run once per task class).
**Build = one new `skill-health.mjs` + `skill-route --log` + the citation/fingerprint verifier + the marker convention.** Prove the chain on ONE skill before scaling. Do not mass-extract.

## What we will NOT claim
Per-run outcome causation; "consulted" as proof of attention; a trust scalar as truth; any influence without its evidence-strength label. The defensible product: **honest event logging (L1–2 proven), content-bound citation (L3 attested), artifact-fingerprint (L5 proven for execution skills), ablation-gated L4/L6**, every record carrying its own honest limit.
