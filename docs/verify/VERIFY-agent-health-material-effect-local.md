---
verify_status: verified
author: claude-opus main build session 2026-06-15
verifier: qa-test subagent (independent, 2026-06-15)
independence_basis: recorded-distinct-invocation
date: 2026-06-15
---

# VERIFY — agent-health material-effect (Q6) + Q3 selection rationale

Independent verification (author != verifier) of the material-effect upgrade to
`templates/tools/agent-health.mjs`. Per-invocation it now reads each subagent's
`.meta.json` (agentType) AND the sibling `.jsonl` transcript's FINAL assistant
message, classifies the verdict via `classifyVerdict(text)`
(DECISIVE / CONFIRMING / LOW-SIGNAL / AMBIGUOUS), with `isMaterial(v) === (v==="DECISIVE")`,
and reports per-agent decisive-rate, a system material-effect %, a verdict breakdown,
and a Q3 selection rationale from `--selections <path>`.

No production code was modified. All evidence below comes from the verifier's own
runs against a verifier-authored corpus in a temp directory. Numbers are verbatim.

## VERDICT: verified

All six acceptance criteria PASS. The two load-bearing criteria — (2) classification
follows the text, and (3) rates follow a known corpus (mutation-proven) — both hold.

| # | Criterion | Result |
|---|-----------|--------|
| 1 | `--self-test` exit 0, all cases incl. new verdict cases | PASS |
| 2 | `classifyVerdict` + `isMaterial` follow my own strings (mutation) | PASS |
| 3 | Report reads transcripts + rates follow a KNOWN corpus, flip-proven | PASS |
| 4 | Q3 selection rationale prints w/ `--selections`, honest line without | PASS |
| 5 | `--no-material` skips transcript reads, no Q6 line, no crash | PASS |
| 6 | Read-only (no writes to telemetry/transcript/agents dirs) | PASS |

---

## Criterion 1 — self-test (PASS)

`node templates/tools/agent-health.mjs --self-test` → exit 0; all 15 cases PASS,
including defect-found / VERIFIED-gate / REJECTED → DECISIVE, tests-pass → CONFIRMING,
errored & empty → LOW-SIGNAL, and isMaterial(DECISIVE)=Y / isMaterial(CONFIRMING)=N,
plus the parallel-rate proof (1/2). Output observed verbatim (exit 0).

## Criterion 2 — classifyVerdict follows the text (PASS, load-bearing)

Drove `classifyVerdict` + `isMaterial` with the verifier's OWN strings (distinct from
the tool's self-test corpus).

NOTE / OBSERVATION (non-blocking): the module is NOT import-safe — its top-level
dispatch (`if (argv.includes("--self-test")) selfTest(); else measure();`) runs and
calls `process.exit(0)` on import, so a direct `import { classifyVerdict }` from the
real file never reaches the test body. The verifier worked around this by importing a
byte-faithful copy of lines 1–230 (the pure exports, dispatch stripped). The pure logic
under test is identical; only the auto-run tail was removed. Filed as observation BUG-1
below (testability), not a correctness defect.

Truth table driven (all PASS, got == want, isMaterial correct):

| input string | got | want | isMaterial |
|---|---|---|---|
| `I found a defect while tracing the migration path.` | DECISIVE | DECISIVE | true |
| `Two defects found in the snapshot logic.` | DECISIVE | DECISIVE | true |
| `REJECTED` | DECISIVE | DECISIVE | true |
| `## Verdict: VERIFIED\n...` | DECISIVE | DECISIVE | true |
| `...\nverify_status: verified\nmore` | DECISIVE | DECISIVE | true |
| `All 222 tests passed, no defects observed in this run.` | CONFIRMING | CONFIRMING | false |
| `Implementation complete and ready for QA review by the gate.` | CONFIRMING | CONFIRMING | false |
| `error: timeout` | LOW-SIGNAL | LOW-SIGNAL | false |
| `` (empty) | LOW-SIGNAL | LOW-SIGNAL | false |
| `ok` (short) | LOW-SIGNAL | LOW-SIGNAL | false |
| normal paragraph, no verdict words | AMBIGUOUS | AMBIGUOUS | false |

isMaterial-only-DECISIVE violations: 0. `isMaterial` is true for exactly and only DECISIVE.

## Criterion 3 — rates follow a KNOWN corpus, mutation-proven (PASS, load-bearing)

Verifier planted a temp telemetry dir with 4 transcripts (meta.json + sibling .jsonl,
each .jsonl a valid `{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"..."}]}}`),
plus an EARLIER assistant line per transcript reading "...should be ignored" to prove
the reader takes the LAST assistant text:

Planted truth:
- t1 qa-test → final "## Verdict: VERIFIED" → DECISIVE
- t2 qa-test → final "## Verdict: VERIFIED" → DECISIVE
- t3 qa-test → final "I found a defect..." → DECISIVE
- t4 software-engineer → final "All tests passed, ready for QA..." → CONFIRMING

Expected: qa-test 3/3 decisive, software-engineer 0/1, system 3/4 = 75%,
breakdown DECISIVE:3 CONFIRMING:1.

Reported (verbatim) BEFORE the flip:
```
[USED   ] qa-test            3× (75%)  decisive 3/3 (100%)
[USED   ] software-engineer  1× (25%)  decisive 0/1 (0%)
Q6 — material effect: 3/4 invocations DECISIVE (75%) · breakdown DECISIVE:3 CONFIRMING:1
```
EXACT match to planted truth. Last-assistant extraction confirmed: the earlier
"ignored" assistant line did not flip t1/t2 away from DECISIVE (had the reader taken
the first assistant message, t1/t2 would have been AMBIGUOUS).

MUTATION: changed t1's final message from "## Verdict: VERIFIED" → "all tests passed".
Expected flip: t1 DECISIVE → CONFIRMING; qa-test 2/3; system 2/4 = 50%;
breakdown DECISIVE:2 CONFIRMING:2.

Reported (verbatim) AFTER the flip:
```
[USED   ] qa-test            3× (75%)  decisive 2/3 (67%)
[USED   ] software-engineer  1× (25%)  decisive 0/1 (0%)
Q6 — material effect: 2/4 invocations DECISIVE (50%) · breakdown CONFIRMING:2 DECISIVE:2
```
EXACT match. The numbers FOLLOW the corpus: decisive 3→2, system 75%→50%,
breakdown DECISIVE 3→2 / CONFIRMING 1→2. Not hard-coded.

## Criterion 4 — Q3 selection rationale (PASS)

Temp selection log (2 records `{"chosen":"qa-test","task":"verify X|Y","why":["trig:verify"]}`).

With `--selections`:
```
Q3 — why selected (agent-route logged rationale):
  → qa-test              for "verify X"  ∵ trig:verify
  → qa-test              for "verify Y"  ∵ trig:verify
```
Without `--selections`:
```
Q3 — why selected (agent-route logged rationale):
  (no selection log at --selections <path> — selection rationale not yet captured for this window)
```
Both records' rationales print when supplied; honest "no selection log" line otherwise.

## Criterion 5 — --no-material (PASS)

`--no-material` run completes exit 0, no crash, and emits NO `Q6 — material effect`
line (transcript reads skipped). Roster decisive columns show 0/N and SUMMARY shows
`material=0% decisive` (zeros because no verdict was computed — counts genuinely absent,
not crashing). Cosmetic note BUG-2 below: the 0-valued decisive column / SUMMARY token
still render under `--no-material`; harmless but could read as "0% material" rather than
"not measured". Non-blocking.

## Criterion 6 — read-only (PASS)

Before/after `find -printf "%p %s %T@"` snapshot of the telemetry dir, agents dir, and
selection log across a full run: `diff` empty → "NO CHANGES — READ ONLY CONFIRMED".
No new files created. Source confirms: the module imports only
`readFileSync, existsSync, readdirSync, statSync` — no write APIs.

---

## Defects / observations

- BUG-1 (testability, non-blocking): `agent-health.mjs` is not import-safe; top-level
  dispatch auto-runs `measure()`/`selfTest()` and `process.exit`s on import, preventing
  direct unit import of `classifyVerdict`/`isMaterial`. Recommend guarding the dispatch
  with `if (import.meta.url === pathToFileURL(process.argv[1]).href)` so the pure
  exports can be imported by tests without spawning the CLI. Verifier worked around it
  with a faithful library copy; criterion 2 still proven.
- BUG-2 (cosmetic, non-blocking): under `--no-material`, the roster `decisive 0/N` column
  and the SUMMARY `material=0% decisive` token still render despite material being
  disabled. Consider omitting them (or printing "not measured") to avoid a false 0%.

Neither defect blocks the verdict; both are improvements, not correctness failures.

## Post-fix confirmation (2026-06-15)

Independent re-verification (author != verifier) of the two fixes applied AFTER the
original verification above. Classification/rate logic unchanged; only BUG-1 and BUG-2
were addressed. Verifier ran each check itself; results verbatim:

1. **Self-test** — `node templates/tools/agent-health.mjs --self-test` → exit 0, all
   15 cases PASS (14 labelled cases + parallel-rate 1/2). PASS.
2. **Import-safety (BUG-1)** — a temp `_t.mjs` doing
   `import { classifyVerdict, isMaterial } from "./templates/tools/agent-health.mjs"`
   and logging `classifyVerdict("found a defect"), isMaterial("DECISIVE")` printed
   exactly `DECISIVE true` and exit 0 with NO roster/report output — the module did NOT
   auto-run on import. Dispatch is now guarded by
   `isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href`
   (lines 233–234). The REAL module can now be imported directly — the byte-faithful
   library copy used in original criterion 2 is no longer needed. Temp file deleted. PASS.
3. **`--no-material` (BUG-2)** — against the real session telemetry dir
   (`.../1286afbe-.../subagents`, 116 invocations) with
   `--agents ../rumah-admin/.claude/agents --no-material`: roster shows
   `decisive n/a (--no-material)` for every agent and SUMMARY shows
   `material=not measured (--no-material)`; no `Q6 — material effect` line; exit 0.
   The SAME command WITHOUT `--no-material` shows real decisive percentages
   (e.g. `qa-test 60/64 (94%)`, `Q6 — material effect: 94/116 invocations DECISIVE (81%)`,
   `SUMMARY ... material=81% decisive`). The false 0% is gone. PASS.

**Result: all 3 checks PASS. BUG-1 and BUG-2 are RESOLVED.** verify_status remains
`verified`. Not committed.

## batch-parallel signal confirmation (2026-06-15)

Independent verification (author != verifier) of the new exported pure fn
`batchParallel(selections)` — the AUTHORITATIVE parallel signal that counts
router-logged parallel batches (mtime undercounts same-message dispatches). Q5 now
reports both the authoritative batch count and the mtime lower-bound. Verifier ran each
check itself against the REAL module; results verbatim.

1. **Self-test (check 1)** — `node templates/tools/agent-health.mjs --self-test` →
   exit 0, all 16 cases PASS, including the new
   `PASS  batch-parallel (got 1/2, want 1/2)` AND the existing
   `PASS  parallel-rate (got 1/2, want 1/2)`. PASS.
2. **Import-drive `batchParallel` from the real module (check 2)** — `import { batchParallel }`
   from the real `./templates/tools/agent-health.mjs` (import-safe per BUG-1 fix), no
   library copy. Truth table:

   | input | output |
   |---|---|
   | `[{parallelBatch:"A",chosen:"x"},{parallelBatch:"A",chosen:"y"},{parallelBatch:"B",chosen:"z"}]` | `{batches:2, parallelBatches:1}` |
   | `[]` | `{batches:0, parallelBatches:0}` |
   | records with no `parallelBatch` field (`[{chosen:"x"},{chosen:"y"}]`) | `{batches:0, parallelBatches:0}` (ignored) |

   All three match expectation exactly. PASS.
3. **End-to-end, mutation-proven (check 3)** — verifier-authored temp selection log
   (2 records sharing batch `P1`, 1 record batch `P2`) + temp telemetry dir, run with
   `--selections <temp> --telemetry <temp>`. Q5 printed verbatim:
   `authoritative (router batches): 1/2 batches dispatched >1 agent in parallel`.
   MUTATION: changed the second `P1` record's batch to a distinct `P3` (all 3 now unique)
   and re-ran → Q5 printed `authoritative (router batches): 0/3 batches dispatched >1
   agent in parallel`. The number FOLLOWS the verifier's log (1/2 → 0/3), not hard-coded.
   PASS.
4. **Without `--selections` (check 4)** — same temp telemetry, no `--selections`. Q5
   printed ONLY `mtime lower-bound: 0/1 spawn-seconds had >1 agent (undercounts; see
   caveat)` under the `Q5 — parallel:` header; NO `authoritative` line; exit 0, no crash.
   PASS.

**Result: all 4 checks PASS. The authoritative batch-parallel signal is real and
follows the input.** verify_status remains `verified`. Not committed.

## Cleanliness

- Production code: unchanged by the verifier. The only working-tree modification
  (`M templates/tools/agent-health.mjs`, +111/-24) is the author's upgrade under test,
  present before verification began.
- Real session telemetry corpus and real `.claude/agents/*.md` files: never written;
  all verifier writes were confined to `%TEMP%/qa-agenthealth/` and this VERIFY doc.
- Temp corpus cleaned after verification.
- Not committed.
