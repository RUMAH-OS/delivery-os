// =============================================================================
// SPAWN PORT — the P4 deep-reasoning worker seam (Frozen §10.3, roadmap G-60 realWorkerQueueSpawn).
// =============================================================================
// The three "spawned session" reasoning classes — INVESTIGATE, REPO_ANALYSIS, CODE — are not answered inline.
// They are answered by SPAWNING a sandboxed Claude session that reads/writes REAL files in an isolated git
// worktree ("feels like Claude Code"). This module defines the port organs reason through and its two
// implementations:
//   · ClaudeCliSpawnPort — the REAL launcher: a headless `claude -p … --output-format json` session run inside
//     a throwaway git worktree, with the ROUTED model id passed as DATA (never named here) and the executor's
//     budget/timeout applied. The worktree is created before the session and destroyed in a `finally` — a
//     failed job leaks nothing. GATED on `claude` + git + a model being provisioned; NEVER run in tests.
//   · StubSpawnPort — a deterministic test double. Records the jobs it was handed and returns canned results
//     from a supplied behavior fn. It NEVER launches a process, touches git, or reaches the network.
//
// MODEL-AGNOSTIC (ADR-reasoning-model-routing.md): NO model id string ever appears here. `WorkerJob.model`
// carries the id the Model Router already resolved from CLASS → config; the port passes it through verbatim.
// HONESTY (I4): on ANY failure the port returns `{ ok:false, error }` — it NEVER fabricates `output`.

import { spawnSync } from "node:child_process";
import { GitWorktreeManager, type WorktreeHandle, type WorktreeManager } from "./worktree.js";

/** The three spawned-session reasoning classes this tier serves (a subset of ReasoningClass — no model ids). */
export type WorkerClass = "INVESTIGATE" | "REPO_ANALYSIS" | "CODE";

/**
 * One unit of deep-reasoning work handed to a spawned session. Everything the session needs is DATA on the
 * job; the port itself decides nothing about models or budgets.
 */
export interface WorkerJob {
  /** Which spawned-session class this is (drives prompt framing + whether FS writes are expected). */
  readonly class: WorkerClass;
  /** The task in natural language — what the spawned session is asked to investigate / analyze / implement. */
  readonly task: string;
  /** Optional assembled, cited context brief (rendered text) the session should reason FROM (I17). */
  readonly contextBrief?: string;
  /** Optional path to the repo the session operates on. When set, the real port sandboxes it in a worktree. */
  readonly repoPath?: string;
  /** The concrete model id the Model Router resolved for this job's class. DATA — never chosen by the port. */
  readonly model?: string;
  /** The token budget this job is allowed; the executor refuses a job that would exceed the remaining budget. */
  readonly budgetTokens: number;
  /** Hard wall-clock cap (ms) for the spawned session; the executor also enforces it so nothing hangs. */
  readonly timeoutMs: number;
  /** Idempotency key — the stable identity of this job (dedup + worktree naming + audit). */
  readonly workerId: string;
}

/** The structured outcome of a spawned session. `ok:false` ALWAYS carries `error` and never carries `output`. */
export interface WorkerResult {
  readonly ok: boolean;
  /** The session's primary text result (present only on success). */
  readonly output?: string;
  /** Optional machine-readable payload the session emitted (e.g. parsed JSON), when available. */
  readonly structured?: unknown;
  /** Tokens the session consumed (from the CLI's usage report; 0 when unknown). Charged against the budget. */
  readonly tokensUsed: number;
  /** Wall-clock the job took (ms). */
  readonly ms: number;
  /** Failure reason (present only when `ok:false`). Fail-closed: never a fabricated success masquerading. */
  readonly error?: string;
}

/** The port organs reason through for the P4 tier. One method: a job in, a structured result out. */
export interface SpawnPort {
  spawn(job: WorkerJob): Promise<WorkerResult>;
}

// ── ClaudeCliSpawnPort — the REAL headless `claude -p` launcher in a sandboxed worktree. ──────────────────

export interface ClaudeCliSpawnPortOptions {
  /** The claude binary (default: resolve `claude` from PATH). Mirrors ClaudeCliLlm's launcher shape. */
  readonly bin?: string;
  /** The worktree isolation manager (default: real GitWorktreeManager). Injectable for wiring/ops. */
  readonly worktree?: WorktreeManager;
  /** PII-free evidence sink (argv/exit). */
  readonly log?: (line: string) => void;
  /**
   * Whether to pass --dangerously-skip-permissions to the sandboxed session. It runs inside a THROWAWAY
   * worktree the executor destroys, which is precisely why unattended tool use is acceptable there. Default
   * true for the P4 tier; flip off for a read-only posture. This is a LIVE-OPS knob, never hit in tests.
   */
  readonly skipPermissions?: boolean;
}

/**
 * The real spawn port. For a job with `repoPath`, it: (1) creates an isolated git worktree; (2) runs
 * `claude -p <prompt> --output-format json [--model <routed-id>]` with cwd = the worktree, the job's timeout,
 * and (for the sandbox) tool permissions; (3) parses the JSON envelope into a WorkerResult with usage tokens;
 * (4) ALWAYS destroys the worktree in a `finally`. On any spawn/parse failure it returns `{ ok:false, error }`.
 *
 * This class is complete but GATED: it only does real work when `claude`, git, and a provisioned model are
 * present. The test suite exercises ONLY StubSpawnPort — live spawning is a wiring/ops step, by design.
 */
export class ClaudeCliSpawnPort implements SpawnPort {
  private readonly bin: string;
  private readonly worktree: WorktreeManager;
  private readonly log: (line: string) => void;
  private readonly skipPermissions: boolean;

  constructor(opts: ClaudeCliSpawnPortOptions = {}) {
    this.bin = opts.bin ?? "claude";
    this.worktree = opts.worktree ?? new GitWorktreeManager({ log: opts.log });
    this.log = opts.log ?? (() => {});
    this.skipPermissions = opts.skipPermissions ?? true;
  }

  async spawn(job: WorkerJob): Promise<WorkerResult> {
    const started = Date.now();
    let handle: WorktreeHandle | undefined;
    try {
      const cwd = job.repoPath ? (handle = await this.worktree.create(job.repoPath, job.workerId)).path : process.cwd();
      const prompt = buildWorkerPrompt(job);
      // The sandboxed session. --add-dir grants the throwaway worktree; --model carries the ROUTED id (DATA).
      const args = [
        "-p",
        prompt,
        "--output-format",
        "json",
        ...(job.model ? ["--model", job.model] : []),
        ...(job.repoPath ? ["--add-dir", cwd] : []),
        ...(this.skipPermissions ? ["--dangerously-skip-permissions"] : []),
      ];
      this.log(
        `    SPAWN ${job.class} worker=${job.workerId} argv=${JSON.stringify([
          this.bin,
          "-p",
          "<prompt>",
          "--output-format",
          "json",
          ...(job.model ? ["--model", job.model] : []),
        ])}`,
      );
      let res: ReturnType<typeof spawnSync>;
      try {
        res = spawnSync(this.bin, args, {
          cwd,
          encoding: "utf8",
          timeout: job.timeoutMs,
          stdio: ["ignore", "pipe", "pipe"],
          env: { ...process.env },
          windowsHide: true,
          maxBuffer: 64 * 1024 * 1024,
        });
      } catch (e) {
        return fail(`spawn_threw: ${msg(e)}`, Date.now() - started);
      }
      if (res.error) {
        // spawnSync sets .error to an ETIMEDOUT-like error when it kills a session that overran its timeout.
        return fail(`spawn_error: ${(res.error as Error).message}`, Date.now() - started);
      }
      if (res.status !== 0) {
        const stderr = (res.stderr ?? "").toString().trim();
        return fail(`spawn_nonzero_exit:${res.status}${stderr ? ` ${stderr.slice(0, 200)}` : ""}`, Date.now() - started);
      }
      return parseClaudeJson((res.stdout ?? "").toString(), Date.now() - started);
    } catch (e) {
      return fail(`worker_failed: ${msg(e)}`, Date.now() - started);
    } finally {
      // Isolation guarantee: a failed / timed-out job leaves NO worktree behind.
      if (handle) await this.worktree.cleanup(handle).catch((e) => this.log(`    cleanup failed: ${msg(e)}`));
    }
  }
}

/** Build the spawned session's prompt: the task, its class framing, and the cited context brief (I17). */
export function buildWorkerPrompt(job: WorkerJob): string {
  const framing: Record<WorkerClass, string> = {
    INVESTIGATE: "Investigate the following and report findings, each with a citation to real evidence.",
    REPO_ANALYSIS: "Analyze the repository to answer the following. Cite files/paths for every claim.",
    CODE: "Implement the following in this worktree. Make the change; do not fabricate results.",
  };
  const parts = [framing[job.class], "", `TASK: ${job.task}`];
  if (job.contextBrief && job.contextBrief.trim()) parts.push("", "CONTEXT (cited; reason from this):", job.contextBrief.trim());
  return parts.join("\n");
}

/**
 * Parse the `claude -p --output-format json` envelope. The CLI emits a JSON object with a `result`/`text`
 * field and a `usage` block. We parse defensively: any shape we cannot read → a fail-closed result (never a
 * fabricated success). Usage tokens sum input+output when present.
 */
export function parseClaudeJson(stdout: string, ms: number): WorkerResult {
  const trimmed = stdout.trim();
  if (!trimmed) return fail("empty_output", ms);
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return fail("unparseable_json_output", ms);
  }
  if (parsed === null || typeof parsed !== "object") return fail("non_object_output", ms);
  const obj = parsed as Record<string, unknown>;
  // The CLI marks an error turn with is_error / subtype; honor it fail-closed.
  if (obj["is_error"] === true) return fail(`session_error: ${String(obj["subtype"] ?? "unknown")}`, ms);
  const output = typeof obj["result"] === "string" ? (obj["result"] as string) : typeof obj["text"] === "string" ? (obj["text"] as string) : undefined;
  if (output === undefined) return fail("no_result_field", ms);
  return { ok: true, output, structured: obj, tokensUsed: readUsageTokens(obj), ms };
}

function readUsageTokens(obj: Record<string, unknown>): number {
  const usage = obj["usage"];
  if (usage && typeof usage === "object") {
    const u = usage as Record<string, unknown>;
    const inTok = numOr0(u["input_tokens"]);
    const outTok = numOr0(u["output_tokens"]);
    if (inTok + outTok > 0) return inTok + outTok;
  }
  return numOr0(obj["total_tokens"]);
}

function numOr0(x: unknown): number {
  return typeof x === "number" && Number.isFinite(x) ? x : 0;
}

function fail(error: string, ms: number): WorkerResult {
  return { ok: false, tokensUsed: 0, ms, error };
}

function msg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

// ── StubSpawnPort — deterministic test double. NEVER launches a process. ──────────────────────────────────

/** A behavior a test supplies: given the job, return (or async-return) the canned result the session would. */
export type StubSpawnBehavior = (job: WorkerJob) => WorkerResult | Promise<WorkerResult>;

/**
 * The spawn-port test double. Records every job it is handed (`calls`) and delegates to the supplied behavior.
 * It launches NOTHING. Tests use it to drive success / failure / hang (a never-resolving promise) / usage
 * paths through the executor deterministically and for free.
 */
export class StubSpawnPort implements SpawnPort {
  readonly calls: WorkerJob[] = [];
  constructor(private readonly behavior: StubSpawnBehavior) {}
  async spawn(job: WorkerJob): Promise<WorkerResult> {
    this.calls.push(job);
    return this.behavior(job);
  }
}

/** Convenience: a stub that always returns a canned success with the given output + token cost. */
export function cannedOk(output: string, tokensUsed = 0, ms = 1): StubSpawnBehavior {
  return () => ({ ok: true, output, tokensUsed, ms });
}
