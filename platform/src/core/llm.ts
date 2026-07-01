// LLM PORT — a tiny, swappable interface the CORE uses for (a) intent classification and (b) response
// phrasing. It is CHANNEL-AGNOSTIC (no Slack) and TRANSPORT-AGNOSTIC (no HTTP baked in). Two implementations
// ship here:
//   - ClaudeCliLlm  — the REAL one: a headless `claude -p <prompt> --output-format text` session, EXACTLY the
//                     launcher shape the engine's agent-runner uses (rumah-admin agent-runner-claude-executor.ts:
//                     `claude -p <instr> --output-format text`). This is how the repo already runs execution;
//                     we reuse the same discipline for the control surface's own reasoning.
//   - StubLlm       — a deterministic test double (like a fake `fetch`): drives the SAME interface without a
//                     billed session, so the proof can assert routing + composition for free. It is a double
//                     for the MODEL only — the read tools (gh, health) the CORE calls stay REAL.
//
// HONESTY: the CORE never lets the model INVENT operational state. The model is used to (1) map free text to a
// fixed intent enum and (2) phrase a lead-in; the FACTS in every response come from real tool output, appended
// verbatim (see project-owner.ts). A model that errors/goes missing degrades to a deterministic keyword path —
// it never fabricates.

import { spawnSync } from "node:child_process";

export interface LlmCompleteOptions {
  // hard per-call timeout (ms). Keeps a control-surface reply snappy and bounds any hung session.
  timeoutMs?: number;
  // an optional system-style preamble prepended to the prompt (kept simple: we concatenate; the CLI has no
  // separate system channel in -p text mode).
  system?: string;
}

// The port. One method: text in -> text out. Everything swappable behind this.
export interface LlmClient {
  complete(prompt: string, opts?: LlmCompleteOptions): Promise<string>;
}

const DEFAULT_LLM_TIMEOUT_MS = 60_000;

// ── ClaudeCliLlm — the REAL headless `claude -p` port (matches the engine executor's launcher shape). ──
export interface ClaudeCliLlmOptions {
  bin?: string; // the claude binary (default: resolve `claude` from PATH)
  timeoutMs?: number; // default per-call timeout
  log?: (line: string) => void; // optional evidence sink (argv/exit); PII-free
}

export class ClaudeCliLlm implements LlmClient {
  private readonly bin: string;
  private readonly timeoutMs: number;
  private readonly log: (line: string) => void;

  constructor(opts: ClaudeCliLlmOptions = {}) {
    this.bin = opts.bin ?? "claude";
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_LLM_TIMEOUT_MS;
    this.log = opts.log ?? (() => {});
  }

  async complete(prompt: string, opts?: LlmCompleteOptions): Promise<string> {
    const full = opts?.system ? `${opts.system}\n\n${prompt}` : prompt;
    // NON-INTERACTIVE headless session. No --dangerously-skip-permissions and no --add-dir: this is a PURE
    // text reasoning call (classify / phrase), it must NOT touch the filesystem or run tools.
    const args = ["-p", full, "--output-format", "text"];
    this.log(`    LLM claude -p (${full.length} chars prompt) argv=${JSON.stringify([this.bin, "-p", "<prompt>", "--output-format", "text"])}`);
    let res: ReturnType<typeof spawnSync>;
    try {
      res = spawnSync(this.bin, args, {
        encoding: "utf8",
        timeout: opts?.timeoutMs ?? this.timeoutMs,
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env },
        windowsHide: true,
      });
    } catch (e) {
      throw new Error(`llm_spawn_threw: ${e instanceof Error ? e.message : String(e)}`);
    }
    if (res.error) throw new Error(`llm_spawn_error: ${(res.error as Error).message}`);
    if (res.status !== 0) {
      const stderr = (res.stderr ?? "").toString().trim();
      throw new Error(`llm_nonzero_exit:${res.status}${stderr ? ` ${stderr.slice(0, 200)}` : ""}`);
    }
    return (res.stdout ?? "").toString().trim();
  }
}

// ── StubLlm — a deterministic double for the LLM interface (proof/tests only). Given a mapping from the caller,
// it returns a canned completion. It does NOT reach the network or a model. Used to assert the CORE's routing +
// composition deterministically and for free, exactly as a fake `fetch` doubles the HTTP client. ──
export class StubLlm implements LlmClient {
  // a function the test supplies: (prompt) -> the exact string a model would return for this call.
  constructor(private readonly responder: (prompt: string) => string) {}
  async complete(prompt: string): Promise<string> {
    return this.responder(prompt);
  }
}
