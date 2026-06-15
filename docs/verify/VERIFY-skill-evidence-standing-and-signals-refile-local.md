---
verify_status: verified
author: "claude-opus main build session 2026-06-15"
verifier: "qa-test subagent (independent, 2026-06-15)"
independence_basis: recorded-distinct-invocation
date: 2026-06-15
scope:
  - templates/tools/milestone-report.mjs   # 4th REPORTING-ONLY section: SKILL USAGE EVIDENCE
  - templates/tools/file-lesson.mjs         # sanitizeField strips **, keeps →/|, always JSON.stringify
  - capabilities/signals.jsonl              # re-filed corpus (44 records, 0 malformed, LOST=0)
load_bearing:
  - criterion-2-signals-integrity-LOST=0
  - criterion-5-reporting-only
---

# VERIFY — Skill-Usage-Evidence standing + signals re-file (independent QA)

Independent validation (author != verifier) of two uncommitted delivery-os changes. All
runs below were executed by the verifier in a clean checkout of the working tree; temp
artifacts were created under a throwaway dir and removed. Nothing was committed.

## Verdict: VERIFIED (5/5 PASS)

| # | Criterion | Result |
|---|-----------|--------|
| 1 | file-lesson `--self-test` exit 0 + `→ \| **` round-trip | PASS |
| 2 | signals.jsonl integrity — every line valid JSON, count == HEAD, LOST=0 (**load-bearing**) | PASS |
| 3 | milestone-report `--self-test` exit 0 (skill-section wiring + graceful-skip + not-a-verdict-input) | PASS |
| 4 | milestone-report integration shows SKILL USAGE EVIDENCE w/ verification-playbook real row | PASS |
| 5 | Reporting-only — skill-health fail/absent does NOT flip OVERALL VERDICT (**load-bearing**) | PASS |

---

## Criterion 1 — file-lesson self-test + independent round-trip — PASS

`node templates/tools/file-lesson.mjs --self-test` → **exit 0**. All 12 assertions PASS,
including the regression case:

```
  PASS  `→ | **` line parses back as valid JSON (round-trips, not mangled)
  PASS  parsed pattern === sanitize(input) (no `**`, `→`/`|` preserved)
  PASS  parsed capability === sanitize(input) (no `**`, `→`/`|` preserved)
  PASS  sanitized pattern contains no `**` markdown
  PASS  sanitized pattern STILL contains the `→` and `|` (only `**` stripped)
PASS: file-lesson self-test green (idempotent {pattern, source} de-dup).
```

Independent (verifier-authored, not the engineer's test) round-trip through `fileLesson()`
in a temp corpus — pattern `**foo → bar | baz**`, capability `x → y ** z | w`, source
`verify:step → 1 | a`:

```
appended: true
all lines valid JSON: true
parsed.pattern: "foo → bar | baz"        (** stripped, → and | preserved)
parsed.capability: "x → y z | w"          (** stripped, → and | preserved)
parsed.source: "qa-test:verify:step → 1 | a"  (→ preserved in source too)
```

The fix is correct in mechanism: the corruption was markdown `**` plus hand-built
delimiter splitting, NOT the arrows. `sanitizeField()` strips `**`, collapses whitespace,
and the whole record is always `JSON.stringify`-serialized, so `→`/`|` round-trip safely.

## Criterion 2 — signals.jsonl integrity (LOAD-BEARING) — PASS

Counts (comments excluded; corpus has 4 `//` header lines):

```
HEAD (git show HEAD:capabilities/signals.jsonl):  48 total lines · 4 comment · 44 valid JSON · 0 malformed
WORKING TREE (capabilities/signals.jsonl):         48 total lines · 4 comment · 44 valid JSON · 0 malformed · 28 _recovered
EVERY non-comment line parsed: records=44 malformed=0
```

- **0 malformed** — every one of the 44 records parses as JSON (claim confirmed).
- **No signal lost (LOST=0):** record count identical 44 == 44. `git diff --numstat` =
  `28 / 28` (28 changed, 0 net add/delete); total lines 48 -> 48. Per-source pairing is
  preserved exactly — 18 distinct sources in both HEAD and working, **per-source count
  drift = 0**. No `{source}` bucket gained or lost a record; no record collapsed/merged.
- 28 records carry `_recovered`. **0 recovered records have an empty pattern** (no silent
  data loss during recovery).
- The 28 records that still contain the literal `**` carry it **only inside the
  `_recovered` provenance note** (`"re-filed 2026-06-15: split on →/** in original line"`)
  — **0 records have `**` leaking into a `pattern` or `capability` field**. The note is an
  intentional human-written provenance string describing the original defect; it is valid
  JSON and corrupts no data field.

### Nature of the original corruption (clarification for the record)

The HEAD lines were *JSON-parseable* but *semantically corrupted*: the markdown `**` and a
hand-split on `→` mangled the FIELD BOUNDARIES, so the back-half of each lesson (after the
`→`) was misfiled into the `capability` field. The re-file reconstructs correct field
semantics and flags each touched record `_recovered`. So "previously-corrupted" means
field-mangled, not parse-failing — see the two before/after pairs below.

### Two previously-corrupted lines, now clean + well-formed

Line 21 — BEFORE (HEAD): `**` opens the pattern and the real fix-text is stranded after a
`.** ` inside `capability`:
```json
{"pattern":"**npm checks spawned with `shell:false` on Windows","project":"rumah-admin","source":"rumah-admin:retro:SLICE-learning-enforcement","capability":"false FAIL (\"(no output)\").** `runTool` ran `npm.cmd`","date":"2026-06-15"}
```
Line 21 — AFTER (working): coherent pattern (with `→`/`|` intact), correct capability, `_recovered`:
```json
{"pattern":"npm checks spawned with `shell:false` on Windows → false FAIL (no output); runTool ran npm.cmd without a shell","project":"rumah-admin","source":"rumah-admin:retro:SLICE-learning-enforcement","capability":"cross-platform npm spawn self-test (shell:true on win32)","date":"2026-06-15","_recovered":"re-filed 2026-06-15: split on →/** in original line"}
```

Line 23 — BEFORE (HEAD): `**none existed**` markdown fences around the capability:
```json
{"pattern":"`git push` silently no-op'd (13 local-only commits)","project":"rumah-admin","source":"rumah-admin:retro:SLICE-learning-enforcement","capability":"**none existed** — no upstream/push preflight","date":"2026-06-15"}
```
Line 23 — AFTER (working): bold fences stripped, `_recovered`:
```json
{"pattern":"git push silently no-op'd (13 local-only commits); a no-upstream push exits 0","project":"rumah-admin","source":"rumah-admin:retro:SLICE-learning-enforcement","capability":"none existed — no upstream/push preflight","date":"2026-06-15","_recovered":"re-filed 2026-06-15: split on →/** in original line"}
```

## Criterion 3 — milestone-report self-test — PASS

`node templates/tools/milestone-report.mjs --self-test` → **exit 0**. All 13 assertions
PASS, including the wiring assertions for the new section:

```
  PASS  run() emits the '═══ SKILL USAGE EVIDENCE ═══' section header
  PASS  skill-health is reporting-only (never an overallVerdict input)
  PASS  resolveSkillHealthPath → null when scripts/skill-health.mjs absent (graceful skip)
  PASS  resolveSkillHealthPath → path when scripts/skill-health.mjs present
  PASS  skillHealthArgs forwards --telemetry-glob when given / omits when not
PASS: overallVerdict() fail-closed logic holds AND skill-usage-evidence section is wired (graceful-skip + reporting-only).
```

Static-code confirmation: `overallVerdict({ capOk, expRan, expOk })` (lines 68-72) takes
NO skill argument and is called once (line 185) with no skill input. The self-test regex
`!/overallVerdict\([^)]*skill/i.test(selfSrc)` guards against regression.

## Criterion 4 — milestone-report integration — PASS

`node templates/tools/milestone-report.mjs --project ../rumah-admin --skip-experience
--telemetry-glob "C:/Users/brian/.claude/projects/c--Users-brian-RUMAH-rumah-admin/*/subagents"`
→ **exit 0**, OVERALL VERDICT **PASS**. The new section renders with verification-playbook's
real, evidence-stamped row (Triggered 1 / Injected 1 / Used(cited) 3 / Influenced(fp) 14 /
TRUST 17). SKILL USAGE EVIDENCE section, verbatim:

```
─── ═══ SKILL USAGE EVIDENCE ═══ ────────────────────────────────
═══ Skill Usage Evidence · evidence-ladder proof (every cell evidence-strength-stamped) ═══
  selections: ...\.claude\os\telemetry\skill-selections.jsonl  ·  telemetry: union of 2 dir(s) from glob C:/Users/brian/.claude/projects/c--Users-brian-RUMAH-rumah-admin/*/subagents  ·  fingerprint-skill: verification-playbook

── per-skill evidence ledger (Triggered=L1·log · Injected=L2·structural · Used(cited)=L3·citation · Influenced(fingerprint)=L5·fingerprint · Trust=verified L5+L3) ──
  verification-playbook      Triggered  1 [log] · Injected  1 [structural] · Used(cited)  3 [citation] · Influenced(fp) 14 [fingerprint] · TRUST 17  · cadence:recurring · dormancy:USED
  verify-gate                Triggered  1 [log] · Injected  0 [structural] · Used(cited)  0 [citation] · Influenced(fp)  0 [fingerprint] · TRUST  0  · cadence:recurring · dormancy:USED
  decision-ratification      Triggered  0 [log] · Injected  0 [structural] · Used(cited)  0 [citation] · Influenced(fp)  0 [fingerprint] · TRUST  0  · cadence:recurring · dormancy:DORMANT
  deploy-vercel-supabase     Triggered  0 [log] · ... · TRUST  0  · cadence:recurring · dormancy:DORMANT
  discovery-interview        Triggered  0 [log] · ... · TRUST  0  · cadence:recurring · dormancy:DORMANT
  ecosystem-alignment-review Triggered  0 [log] · ... · TRUST  0  · cadence:recurring · dormancy:DORMANT
  grill-me                   Triggered  0 [log] · ... · TRUST  0  · cadence:recurring · dormancy:DORMANT
  learning-review            Triggered  0 [log] · ... · TRUST  0  · cadence:recurring · dormancy:DORMANT
  migration-assessment       Triggered  0 [log] · ... · TRUST  0  · cadence:recurring · dormancy:DORMANT
  ops-truth-integration      Triggered  0 [log] · ... · TRUST  0  · cadence:recurring · dormancy:DORMANT
  principle-11-review        Triggered  0 [log] · ... · TRUST  0  · cadence:recurring · dormancy:DORMANT
  production-readiness-review Triggered  0 [log] · ... · TRUST  0  · cadence:recurring · dormancy:DORMANT
  X                          Triggered  0 [log] · ... · TRUST  0  FP(fabricated-citation): 1  · cadence:recurring · dormancy:WITHIN_GRACE

── derived summary (a view of the ledger, NEVER the source of truth) ──
  Top (most-triggered):     verification-playbook (1× [log])
  Most-Valuable (max trust): verification-playbook (trust 17 = 14 fingerprint + 3 verified-citation)
  Least-Trusted (used, trust 0): verify-gate (triggered 1× but 0 verified influence)
  Dormant (recurring, past grace 10, 0 triggers): decision-ratification, deploy-vercel-supabase, discovery-interview, ecosystem-alignment-review, grill-me, learning-review, migration-assessment, ops-truth-integration, principle-11-review, production-readiness-review

SUMMARY: measured=YES · 2 skill(s) with evidence · trust is verified-influence-count (L5 fingerprint + L3 citation), not raw triggers · L4/L6 deferred to ablation (not claimed).
```

The section is honest (most skills DORMANT, 0 evidence — surfaced verbatim, not faked) and
is printed below the OVERALL VERDICT inputs as reporting-only.

## Criterion 5 — Reporting-only proof (LOAD-BEARING) — PASS

Two controlled scenarios, each against a temp copy of the rumah-admin project (real
`.github`/`scripts`/`.claude`/`package.json` so capability-health passes), only
`scripts/skill-health.mjs` manipulated:

- **Scenario A — skill-health replaced with a stub that `process.exit(1)`:**
  milestone exit **0**, `═══ OVERALL VERDICT: PASS ═══`.
- **Scenario B — skill-health deleted (absent):**
  milestone exit **0**, `═══ OVERALL VERDICT: PASS ═══`,
  `skill-health: SKIPPED (no scripts/skill-health.mjs in project)`.

In both cases the verdict stayed PASS, driven solely by capability-health + experience.
Combined with the static-code fact that `overallVerdict()` takes no skill input
(criterion 3), skill-health is provably reporting-only.

---

## Defects / observations

- **Minor (cosmetic, non-blocking):** in Scenario A, the milestone recap captured
  `→ skill-health (reporting only): Node.js v22.22.3` as the summary — i.e. when a
  spawned skill-health crashes, `summaryLine()` falls back to the last output line (here
  the Node crash banner) rather than a clean "skill-health: FAILED (exit N)" message. Does
  NOT affect the verdict (reporting-only) or any acceptance criterion. Optional polish:
  detect non-zero skill-health exit and print an explicit failure summary.
- **Note (not a defect):** 28 working records contain `**` inside their `_recovered`
  provenance note only. This is intentional (the note literally describes "split on →/**")
  and corrupts no data field; the live `sanitizeField()` path would strip `**`, but these
  notes were hand-written during the re-file, not passed through `sanitizeField`.

## Independence + hygiene

- Verifier ran every script itself in the working tree; did not rely on the author's
  reported output. Round-trip (criterion 1) and reporting-only (criterion 5) used
  verifier-authored harnesses, not the engineer's self-tests.
- No production/template code modified. No commit made.
- Temp: throwaway dirs under the OS temp + `C:/Users/brian/RUMAH/_verify_tmp/` (HEAD
  snapshot of signals); all removed at close.
