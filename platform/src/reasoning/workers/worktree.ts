// =============================================================================
// WORKTREE ISOLATION — a throwaway, sandboxed git worktree per deep-reasoning worker job.
// =============================================================================
// The P4 worker tier "reasons over reality" (Frozen §10.3): a spawned session that READS and (for CODE)
// WRITES a repository. It must never mutate the caller's live tree. The isolation primitive is a git
// WORKTREE — a detached checkout in a scratch dir the job owns and the executor destroys afterwards, so a
// failed or timed-out job leaves ZERO residue on the source tree.
//
// This module is the seam BOTH the real spawn port (ClaudeCliSpawnPort) and the WorkerExecutor lean on:
//   · create(repoPath, workerId) → an isolated WorktreeHandle (a fresh detached worktree at HEAD).
//   · cleanup(handle)            → removes the worktree (force) and the scratch dir; idempotent, best-effort.
// The interface is injectable so tests use an in-memory fake (never touching real git); production uses
// GitWorktreeManager (real `git worktree add/remove`). LIVE git ops are therefore NEVER exercised in tests.

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** A live, isolated worktree a worker job runs inside. `path` is the cwd the spawned session sees. */
export interface WorktreeHandle {
  /** Absolute path of the isolated worktree checkout — the sandbox cwd for the spawned session. */
  readonly path: string;
  /** The source repository this worktree was branched from (for audit / cleanup). */
  readonly repoPath: string;
  /** The owning job's idempotency key (audit: which worker owns this sandbox). */
  readonly workerId: string;
  /** The scratch parent dir to delete on cleanup (implementation detail carried for the manager). */
  readonly scratchDir: string;
}

/**
 * The worktree lifecycle seam. Two operations, both async. Implementations MUST make cleanup safe to call
 * exactly once per handle and tolerant of a partially-created worktree (fail-closed: never throw out of a
 * finally in a way that masks the original error — callers await cleanup in a finally).
 */
export interface WorktreeManager {
  create(repoPath: string, workerId: string): Promise<WorktreeHandle>;
  cleanup(handle: WorktreeHandle): Promise<void>;
}

/** Options for the real git manager. */
export interface GitWorktreeManagerOptions {
  /** The git binary (default: resolve `git` from PATH). */
  readonly gitBin?: string;
  /** Per git-op timeout (ms); keeps a stuck git from hanging the job. Default 30s. */
  readonly timeoutMs?: number;
  /** Optional PII-free evidence sink (argv/exit). */
  readonly log?: (line: string) => void;
}

const DEFAULT_GIT_TIMEOUT_MS = 30_000;

/**
 * The REAL worktree manager: `git worktree add --detach <scratch> HEAD` for isolation, `git worktree remove
 * --force` + scratch-dir delete for cleanup. This class shells real git and is GATED on git + a real repo
 * being present; it is NEVER exercised in the test suite (tests inject an in-memory fake). It exists so the
 * live P4 spawn path is complete, not so tests spawn git.
 */
export class GitWorktreeManager implements WorktreeManager {
  private readonly gitBin: string;
  private readonly timeoutMs: number;
  private readonly log: (line: string) => void;

  constructor(opts: GitWorktreeManagerOptions = {}) {
    this.gitBin = opts.gitBin ?? "git";
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_GIT_TIMEOUT_MS;
    this.log = opts.log ?? (() => {});
  }

  async create(repoPath: string, workerId: string): Promise<WorktreeHandle> {
    // A unique scratch parent so parallel workers never collide; the worktree itself is a child of it (git
    // requires the target path not already exist).
    const scratchDir = mkdtempSync(join(tmpdir(), `dos-worker-${sanitize(workerId)}-`));
    const path = join(scratchDir, "wt");
    this.git(repoPath, ["worktree", "add", "--detach", path, "HEAD"]);
    return { path, repoPath, workerId, scratchDir };
  }

  async cleanup(handle: WorktreeHandle): Promise<void> {
    // Best-effort, idempotent: remove the registered worktree (force, since the job may have dirtied it),
    // prune the admin entry, then delete the scratch dir. Never throws — a failed cleanup is logged, not
    // fatal, so it can run safely in a finally without masking the job's own error.
    try {
      this.git(handle.repoPath, ["worktree", "remove", "--force", handle.path]);
    } catch (e) {
      this.log(`    worktree remove failed (continuing): ${msg(e)}`);
    }
    try {
      this.git(handle.repoPath, ["worktree", "prune"]);
    } catch {
      /* prune is advisory */
    }
    try {
      rmSync(handle.scratchDir, { recursive: true, force: true });
    } catch (e) {
      this.log(`    scratch rm failed (continuing): ${msg(e)}`);
    }
  }

  private git(cwd: string, args: readonly string[]): void {
    this.log(`    git ${args.join(" ")} (cwd=${cwd})`);
    const res = spawnSync(this.gitBin, args as string[], {
      cwd,
      encoding: "utf8",
      timeout: this.timeoutMs,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    if (res.error) throw new Error(`git_spawn_error: ${(res.error as Error).message}`);
    if (res.status !== 0) {
      const stderr = (res.stderr ?? "").toString().trim();
      throw new Error(`git_nonzero_exit:${res.status}${stderr ? ` ${stderr.slice(0, 200)}` : ""}`);
    }
  }
}

/** Keep a workerId safe as a filesystem path segment. */
function sanitize(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40) || "job";
}

function msg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
