# OS-FEEDBACK — Platform-degradation recovery doctrine (Governance §14)

**Filed:** 2026-06-12 · **By:** claude-orchestrator (PLOS) · **Status:** recommendation, pending §11 ratification + a version bump (v4.1 candidate). Founder-commissioned ("formalize a platform rate-limit recovery doctrine and promote it into Delivery OS if the evidence supports it").

## 1. The failure mode (named)

A class distinct from every incident in the v4.0 ledger (`case-studies/2026-06-incident-ledger.md`):
those were *implementation* or *prose-vs-mechanism* failures. This one is **platform-layer**:
the model/API tier degrades (rate limit, model temporarily unavailable, session limit, safety-
classifier outage) **while healthy work is mid-flight** — most often a verifier mid-verification.
The underlying work is fine; the *evidence channel* fails. Retrying into the degraded state adds
load without producing information, and can deepen the outage (more agents → more classifier calls
→ classifier fails → Bash blocks → retries).

## 2. Evidence (clears the ≥2-occurrence + earning-incident bar)

From the PLOS session record, 2026-06-12 (one session, clustered when agent concurrency was high):

| # | Incident | Underlying work | What broke |
|---|---|---|---|
| 1 | DWD-spike verifier (`a7c1caa`) | typecheck/lint/full-suite GREEN, worktree preserved | "Server is temporarily limiting requests · Rate limited" at 92 tool-calls / ~14 min — died before writing the VERIFY artifact or returning a verdict |
| 2 | DWD-spike build, attempt 1 (`a32bed1`) | n/a (died at start) | same rate-limit at 397 tokens / 4 tool-calls / 36s |
| 3 | S43 verifier (earlier) | slice healthy | "You've hit your session limit · resets 2:50am" — sibling failure mode (quota, not rate) |
| 4 | Bash safety classifier (post-#2) | n/a | "claude-opus-4-8 is temporarily unavailable, so auto mode cannot determine the safety of Bash" — the *classifier itself* failing under the same load |
| 5 | ≥2 subagent completions earlier in the session | work healthy | "The safety classifier was unavailable when reviewing this subagent's work" |

Common signature: **healthy work + failed evidence channel + retry-amplification risk.** Absent from
the v4.0 ledger → net-new lesson. Earned, not theoretical.

## 3. The doctrine (recommended — a base behavior + a checklist)

**RATE-LIMIT / PLATFORM-DEGRADATION RECOVERY MODE.** Trigger: any of — `rate limit` / `temporarily
limiting requests` / model `temporarily unavailable` / `session limit` / `classifier was unavailable`
on a tool result or agent completion. On trigger, the orchestrator enters recovery mode:

1. **Stop spawning.** No new author/verifier/panel agents until recovery is confirmed.
2. **Stop retry loops.** No verifier re-dispatch, no `gh pr checks --watch`, no `until curl` poll,
   no status-check loop. A retry into a known-degraded state is forbidden — it adds load, not info.
3. **Preserve + record state.** The worktree is already isolated (never the main checkout) — leave it.
   Record what completed (build green? which verification steps ran?) in one line so resume is cheap.
4. **Do not merge on partial evidence.** A verifier that died before writing its artifact produced NO
   verdict; author≠verifier + the merge gate already block this — recovery mode makes it explicit so
   the orchestrator does not "fill in" the missing verdict.
5. **Switch to read-only / Write-only work** if anything useful remains that does not depend on the
   degraded tier (the safety classifier gates Bash; Read/Grep/Glob/Write do not) — or stop and report.
6. **Resume later as a clean re-run**, not a continuation: re-dispatch the single failed step (usually
   one verifier) against the unchanged worktree. Same contract, fresh agent.

This is the *operational* twin of the already-shipped *evidence-rate-limited ceremony* doctrine
(v4.0 GOVERNANCE §11): that one throttles review volume by evidence; this one throttles
**tool/agent volume by platform health.** Both say: load that produces no new information is waste.

## 4. Orchestration-efficiency findings (the founder's second question — yes, there was avoidable parallelism)

Audited against this session's actual pattern:

- **Author+verifier concurrency:** the orchestrator ran builds and *unrelated* verifications
  concurrently, and spawned a verifier the instant a build finished — peak concurrency is what
  clustered the rate limits. **Recommend:** a soft concurrency cap (≤2 live agents for a solo-founder
  project) and *sequential* author→verifier on the same slice (it already is — but not across slices).
- **Status-polling loops:** `gh pr checks --watch` and `until curl … ; do sleep` are tool-call-heavy
  and, on a classifier-gated Bash, *each iteration* is a classifier call. The v4.0 `merge-pr.mjs`
  already replaced watch-with-merge by a single bounded poll — **recommend** the same discipline for
  dev-server readiness (one `until`-style check in a *single* backgrounded command, not a foreground
  loop) and forbid foreground `--watch`.
- **"Continue" re-dispatch:** each founder "continue" tends to spawn the next agent immediately;
  recovery mode gates that when the platform is degraded.
- **Classifier dependency chain:** every Bash call consumes a classifier decision; high Bash volume
  *is* high classifier load. **Recommend:** batch git operations (stage+commit+push in one command,
  already mostly done), prefer Read/Grep/Glob over `cat`/`grep`/`find` in Bash (already a house rule —
  reinforce it as load-shedding, not just ergonomics).
- **Batching:** prefer one compound Bash command over several; prefer Write over Bash heredocs.

Net: verification *quality* is untouched (every gate stays); what drops is *redundant* tool-call and
agent volume that bought no information — exactly the founder's goal ("reduce platform-induced failures
without reducing verification quality").

## 5. Recommended Delivery OS changes (exact, for v4.1)

1. **NEW base skill `platform-degradation-recovery`** (hybrid format): the §3 trigger list +
   the 6-step recovery + the §4 efficiency rules; `earned_from` = the §2 table; red-flag row
   "retrying into a known-degraded platform state." Add to the scaffolder's always-on core pack.
2. **`core/OPERATING-LOOP.md`:** add recovery mode as a standing rule under the loop's failure-handling
   (it is a loop behavior, not a one-off): "platform-degradation signal ⇒ stop spawning/retrying,
   preserve, resume clean."
3. **`core/GOVERNANCE.md` §11 (panel/agent economics):** add the solo-founder soft concurrency cap
   and the "no foreground watch/poll loops; bounded single-poll only" rule.
4. **`skills/verification/SKILL.md`:** a red-flag row — "verifier died without an artifact = NO verdict;
   never infer PASS; re-run clean" (the merge gate + author≠verifier already enforce it; the skill
   should name it so a future orchestrator does not rationalize a fill-in).
5. **`templates/tools/merge-pr.mjs`:** already single-poll — add an explicit degraded-tier early-exit
   (on a rate-limit string from `gh`, print "platform degraded — re-run when recovered" and exit
   non-zero without looping).
6. **`case-studies/`:** add `2026-06-platform-degradation.md` with the §2 incident table as the worked
   example backing the skill's `earned_from`.

## 6. Routing

| Lesson | Layer | Destination |
|---|---|---|
| Platform-degradation recovery mode (stop/preserve/resume-clean) | Delivery OS | new skill + OPERATING-LOOP rule + case study (above) |
| Solo-founder concurrency cap; no foreground watch/poll | Delivery OS | GOVERNANCE §11 |
| Died-verifier = no verdict, never infer | Delivery OS | verification skill red flag |
| This session's incidents | project (PLOS) | friction-log defect #12 (category **P — platform**), cross-linked here |

**Not promoted:** nothing project-specific here — the whole lesson is noun-free and every future
project on any model-tier platform inherits it.
