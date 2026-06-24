---
slice: "s1-agent-routing — make catalog agents natively routable (v6 routing contract + gate)"
verify_status: verified
author: "implementation-session(coordinated)"
verifier: "independent-qa-subagent"
date: "2026-06-24"
independence_basis: "recorded-distinct-invocation"
---

# VERIFY — Slice s1-agent-routing: catalog agents natively routable

## Independence header
This artifact was produced by an independent QA subagent invoked separately from the
implementation session (author≠verifier, Delivery OS §3/§12). The verifier did NOT author any
production file under test (`scripts/`, `templates/tools/`, `templates/githooks/`, `.claude/tools/`,
`.claude/agents/`, `.githooks/`). All commands below were RUN on the real on-disk surface of branch
`feat/s1-agent-routing` at HEAD `b99f9f9`. No production code was modified; the one adversarial
mutation was made on a copy in a system temp dir and deleted. No stray files were left in the repo.

## Verdict
**verify_status:** `verified`

Every acceptance criterion (1–7) was independently RUN and produced the expected behaviour. The
gate passes the roster (16/16), proves fail-closed (exit 1 naming the missing fields), and is wired
fail-closed into BOTH pre-push hooks. The deterministic router assigns all six mandated tasks plus
four verifier-chosen tasks to their intended specialist. The change is purely additive (562 lines
added, 0 removed; harness `name/description/tools` intact on all 16). check-os-drift OK;
agent-route + agent-frontmatter measured ALIVE by capability-health.

Two NON-BLOCKING routing-quality observations (genuine ties between two plausible owners, resolved
deterministically by alphabetical tiebreak) are recorded below as OBS-1/OBS-2 — neither is a wrong
route to a non-plausible agent, neither blocks the gate.

---

## Criterion 1 — Gate passes the roster · PASS
```
$ node .claude/tools/agents-check.mjs --agents .claude/agents
agents:check OK — 16 agents carry the v6 routing contract (name/kind/capabilities/triggers).
EXIT:0

$ node .claude/tools/agents-check.mjs --self-test
agents:check self-test OK (rejects missing kind/capabilities/triggers; accepts a complete one)
EXIT:0
```
Exit 0, message names 16 agents and the contract. Self-test OK.

## Criterion 2 — Fail-closed proof (adversarial) · PASS
Copied all 16 agents to a temp dir; stripped `kind` + `capabilities[]` + `triggers[]` from the
`qa-test.md` copy only; pointed the gate at the temp dir:
```
$ node .claude/tools/agents-check.mjs --agents <tmp>
agents:check FAIL — 1/16 agent(s) missing the routing contract:
  qa-test.md:
    - kind: required and must be "agent" (got undefined)
    - capabilities[]: required non-empty list of what the agent DOES (verbs/nouns) — without it the router can't match this agent (founder would recall by hand)
    - triggers[]: required non-empty list of task phrases that should route here — without it the agent is invisible to deterministic routing
agents:check: 1 agent(s) are INVISIBLE to deterministic routing — build blocked.
EXIT:1
```
Exit 1; all THREE missing fields are NAMED with the offending file. Temp dir deleted; the real
`.claude/agents/qa-test.md` was never touched (verified by `git status` — clean except the slice's
own staged frontmatter additions).

## Criterion 3 — Real-task routing (operational proof) · PASS (with 2 OBS)
`node .claude/tools/agent-route.mjs "<task>" --agents .claude/agents` (stdout = chosen route):
```
design a migration                                      -> database-data
validate this slice                                     -> qa-test
review for conformance and scope                        -> reviewer-critic
touches payments, check the auth                        -> security-compliance
implement the feature, open a PR                        -> software-engineer
would the founder enjoy this screen                     -> founder-experience-reviewer
evaluate the LLM prompt output quality                  -> ai-product          (verifier-chosen)
wire up an external API integration                     -> api-integration      (verifier-chosen)
deploy the release to production                        -> deployment-operator  (verifier-chosen)
decide the system architecture and boundaries           -> integration-architect (verifier-chosen)
```
All six mandated tasks route to their intended specialist. Three of four verifier-chosen tasks
(ai-product, api-integration, deployment-operator) route correctly. Router `--self-test` also PASS
(routing + per-token dedup + why-rationale).

**OBS-1 (low, non-blocking) — architecture tie.** "decide the system architecture and boundaries"
scores a genuine 3.0 TIE between `integration-architect` (trig:system) and `lead-architect`
(trig:architecture); alphabetical tiebreak picks `integration-architect`. Both are plausible
architect owners, so this is not a wrong route, but a founder who meant the lead architect would be
surprised. Candidate scores recorded:
```
    3.0  integration-architect  (trig:system)
    3.0  lead-architect  (trig:architecture)
```
Disambiguates correctly when phrased toward a role, e.g. "design the overall system architecture"
→ lead-architect (4.0), "lead the architecture decision" → lead-architect (3.5).

## Criterion 4 — Frontmatter quality · PASS (with 1 OBS)
Ran `validateAgentFrontmatter` + `parseFrontmatter` over all 16 (independent script, deleted after):
```
count=16 — all 16 PASS
  nameMatch=true for every file (name == filename stem)
  kind=agent for every file
  capabilities[] non-empty (6–8 each); triggers[] non-empty (6–8 each)
  YAML frontmatter parses for every file
allOk=true
```
**OBS-2 (low, non-blocking) — identical-trigger collision.** Exactly one trigger string is shared
verbatim across two agents: `"write an ADR"` appears in BOTH `documentation` and `lead-architect`.
"write an adr" therefore produces a genuine 16.0 TIE (whole-phrase match on both), resolved
alphabetically to `documentation`:
```
   16.0  documentation  (trigger~"write an ADR", trig:write/adr)
   16.0  lead-architect  (trigger~"write an ADR", trig:write/adr)
```
ADR ownership is legitimately debatable (architect authors the decision; documentation curates the
record), so this is an ambiguity to resolve by editing one agent's triggers, not a defect in the
gate or router. No other identical-trigger collisions exist across the roster.

## Criterion 5 — Harness-compat (no regression) · PASS
All 16 agents still carry the harness spawn shape (`name` + `description` + `tools`):
```
harness(name/desc/tools)=true for all 16 files
```
The slice is purely additive — `git diff HEAD --numstat` over `.claude/agents/` + `.claude/base/agents/`:
```
added=562 removed=0
```
Sample diff (software-engineer.md) confirms only `kind/capabilities/triggers` keys were inserted
inside the existing `---` block; body untouched, existing `name/description/tools` lines unchanged.

## Criterion 6 — System integrity · PASS
```
$ node .claude/tools/check-os-drift.mjs
drift-lint: OK (7 skills checked, 0 warning(s)) — router matches disk.
EXIT:0

$ node templates/tools/capability-health.mjs
  [ALIVE  ] agent-frontmatter  — wired: .githooks/pre-push (agents:check)
  [ALIVE  ] agent-route        — wired: .githooks/pre-push (agents:check)
PASS: every measured capability is wired-to-run (ALIVE) in this project.
EXIT:0
```
Both routing capabilities measured ALIVE, evidenced by the pre-push wiring. (Note: `capability-health.mjs`
is not installed in `.claude/tools/`; it lives in `templates/tools/` and was run from there — this is
the pre-existing install footprint, not a regression of this slice.)

## Criterion 7 — Pre-push wiring · PASS
`agents-check.mjs` is invoked fail-closed (block on non-zero exit) in BOTH hook files:
```
.githooks/pre-push:26        if [ -f .claude/tools/agents-check.mjs ]; then
.githooks/pre-push:27          if ! node .claude/tools/agents-check.mjs >&2; then  (exit 1 on failure)
templates/githooks/pre-push:36  if [ -f .claude/tools/agents-check.mjs ]; then
templates/githooks/pre-push:37    if ! node .claude/tools/agents-check.mjs >&2; then  (exit 1 on failure)
```
Installed routing trio confirmed present in `.claude/tools/`: `agent-frontmatter.mjs`,
`agent-route.mjs`, `agents-check.mjs` (and mirrored in `templates/tools/`).

---

## Bug reports / observations
| ID | Sev | Type | Summary | Owner suggestion |
|----|-----|------|---------|------------------|
| OBS-1 | low | routing-ambiguity | "decide the system architecture and boundaries" ties 3.0 integration-architect vs lead-architect; alphabetical tiebreak picks integration-architect | tighten one role's triggers if lead-architect should own bare "architecture and boundaries" |
| OBS-2 | low | frontmatter-quality | Identical trigger `"write an ADR"` in both `documentation` and `lead-architect` → 16.0 tie, alphabetical → documentation | de-duplicate the ADR trigger to the intended single owner |

Neither observation blocks the gate: routing is deterministic and stable, all mandated routes are
correct, and both ties resolve to a plausible (not wrong) owner.

## Honest limits / out of scope
- **No live spawn-by-router was exercised.** This slice makes agents *routable* (frontmatter +
  deterministic ranker + gate); it does not change how the harness actually spawns a subagent. A
  live "router picks → harness spawns the chosen specialist" loop needs a fresh session and is not
  claimed here.
- **dispatch-route taxonomy is build-only / S3.** Wiring agent-route into the broader dispatch-route
  taxonomy is explicitly out of this slice's scope (S3) and was not verified.
- **Tie-break is alphabetical-by-name only.** OBS-1/OBS-2 are inherent to that policy; no semantic
  disambiguation exists yet. Acceptable for S1; flagged for future tightening.
- **capability-health install footprint** unchanged by this slice (run from `templates/tools/`).
