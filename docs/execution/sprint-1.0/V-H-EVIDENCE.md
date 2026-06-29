---
artifact: V-H [VALIDATE] EVIDENCE — Headless-Claude unattended spawn (the load-bearing autonomy unknown)
id: SPRINT-V-H-EVIDENCE
date: 2026-06-28
status: PO-VALIDATED build evidence → FOUNDER REVIEW (the go/no-go is a founder checkpoint). Read-mostly spike; no production code changed; two live probes ran in /tmp at ≈$0.13 total.
question (RA-DOS §17.4 / DRB-v1 risk #8): can the G9 spawner invoke Claude Code headlessly + unattended, run a bounded task to completion, return a machine-consumable result, and respect caps — in the REAL target host?
---

# V-H verdict: **GO-WITH-CONDITIONS**

**The core mechanism is PROVEN; the serverless/worker HOST is NOT.** The residual risk is host-portability + auth
+ cost-governance, not the spawn mechanism itself.

## What is proven (mechanism — on a host with the CLI + auth)
- **Admin executor (independently QA-signed):** `rumah-admin/src/engine-admin/agent-runner-claude-executor.ts`
  invokes `claude -p <instr> --add-dir <workdir> --dangerously-skip-permissions --output-format text`, spawned
  with **stdin closed (no TTY)**, parsed to a structured engine outcome; the workflow then **verifies the real
  on-disk/git artifact independently** (a lying exit-0 session still fails verification). `VERIFY-production-
  runner-slice-b.md` (PASS, author≠verifier, 2026-06-23): one runner autonomously claimed N=2 tasks, launched real
  `claude.exe` sessions (each a real git commit during the run), engine verified + claimed-once, **4 real sessions
  billed**, engine byte-unchanged.
- **Re-proven live this session (Windows dev host, `claude` v2.1.195):** `claude -p "…READY" --model haiku
  --output-format json --max-budget-usd 0.50 </dev/null` → **exit 0, ~3.2s, JSON `{result:"READY", num_turns:1,
  cost $0.016, terminal_reason:"completed"}`** — headless, no human, machine-consumable. The **budget cap fires**
  and is machine-readable: with inherited opus+1M-ctx the same trivial task hit `error_max_budget_usd` at $0.11.

## What is NOT proven (the real P3/P5 serverless/worker host) — concrete blockers
1. `@anthropic-ai/claude-code` is **not a `package.json` dependency** (resolved off `PATH`) → a Vercel function has
   no CLI → `ENOENT`.
2. `.vercelignore` excludes `scripts/`+`.claude` → **every proof harness is dev/CI-only by construction; never
   deployed.**
3. **No serverless auth** — today auth = interactive `~/.claude/.credentials.json`; no API-key path in code.
4. **Function wall-clock (10–300s) vs 180s sessions** → the spawner likely needs a **long-lived worker/queue host,
   not a request-scoped serverless function.**
5. Ephemeral FS + **no `git`** in the serverless image (the tasks `git commit` in the workdir).

## Cost / fleet observations
- **Model choice is a ~7× cost lever** on a trivial task (opus+1M $0.11 vs haiku $0.016); the executor **pins
  neither model nor budget** today → uncontrolled fleet cost. `--max-budget-usd` + pinned `--model` is the ready
  guard.
- ~1.5–3.2s spawn+API floor **per session** (a full OS process each); a global concurrency×budget cap is
  mandatory before any large N. Permission nuance: Claude-spawning-Claude with `bypassPermissions` is gated when
  the *spawner* is itself a sandboxed Claude session, but runs fine from a plain Node process (the executor's case).

## Conditions before V-H counts as PROVEN for Runtime autonomy (each a discrete follow-up VALIDATE)
1. Reproduce one bounded headless run **inside the actual target host** (worker/queue): CLI present, env-auth,
   spawn permitted, FS+git writable, structured return parsed — end to end. **(the load-bearing gap)**
2. **Decide the host topology** — a long-lived worker/queue, almost certainly NOT request-scoped serverless.
3. **Wire per-session cost governance** into the executor (`--max-budget-usd` + pinned `--model`).
4. **Resolve auth off interactive login** (`ANTHROPIC_API_KEY` / injected credential); decide subscription-vs-API
   billing for fleet volume.
5. **Bundle `claude-code`** into the deploy image / run the spawner where the CLI is provisioned.
6. **Repeat at N>2** to characterize cost/latency/error-rate at fleet scale.

## Migration implication (informational; not a Runtime change)
The Runtime already abstracts the execution environment via **I-Placement (§46)**; this evidence simply *decides*
the placement for the autonomy host — **a long-lived worker/queue, not Vercel request functions** — and connects
to the host question already open for jarvis (a long-running worker) and the P2.4 scheduler/host decision. No
architecture changes; this is a placement + cost-governance decision, gating P3's acting organs and P5 autonomy.

*Artifacts:* `agent-runner-claude-executor.ts` · `claude-bin.ts` · `agent-runner-real-workflow.ts` ·
`docs/verify/VERIFY-production-runner-slice-b.md` · `scripts/engine-agent-run-real.ts` · `.vercelignore` ·
`.claude/os/engine/agent-runner.ts`.
