// handleGoal — THE HANDLER. The real control-plane logic, fully testable with NO Slack SDK.
// This is what the proof drives directly (a simulated /goal event). The Slack shell (slack-app.ts) is a thin
// adapter that calls THIS with Slack's `say` + a GoalsClient.
//
// THE CHAIN, from the operator's seat:
//   /goal <text> -> submitGoal (route: capability selection)
//     -> (enqueued)  await the run to terminal -> say(...) a formatted report (selected capability + runId +
//                    COMPLETED/verdict pass, or FAILED, or still-running on timeout)
//     -> (no-match)  say(...) the honest no-match reply, NO run created
//     -> (ambiguous) say(...) the honest ambiguous reply + candidates, NO run created
//     -> (error)     say(...) the honest transport/auth error
//
// IDEMPOTENCY: the Slack command/event id is passed as `idempotencyKey` so a Slack retry returns the SAME run
// (no double-run) — honored by the engine's (definitionKey, idempotencyKey) idempotency.

import type { GoalsClient, Goal, Run } from "./goals-client.js";

// The injected `say` — Slack's say/respond reduced to its essence (post a string back to the channel/thread).
export type Say = (text: string) => Promise<unknown> | unknown;

// The dependencies the handler needs — both INJECTED (no Slack SDK, no HTTP infra baked in).
export interface HandleGoalDeps {
  goalsClient: GoalsClient;
  say: Say;
  // OPTIONAL await tuning (the proof passes a tight poll; prod uses defaults).
  awaitOpts?: { timeoutMs?: number; pollMs?: number };
}

// The inbound command — exactly what Bolt delivers for a `/goal` slash command (the free text), plus an
// optional structured intent/payload for non-Slack callers, and the idempotency key (the Slack event id).
export interface GoalCommand {
  text: string; // the raw `/goal <text>` body
  intent?: string; // OPTIONAL normalized intent label (Slack: derived/absent; programmatic callers may set it)
  payload?: Record<string, unknown>; // OPTIONAL structured inputs
  idempotencyKey: string; // the Slack command/event id (stable across a Slack retry) -> no double-run
}

// The handler's own outcome (returned for testability; the user-visible effect is the say()).
export type HandleGoalOutcome =
  | { kind: "completed"; runId: string; definitionKey: string; verdict: "pass" | "unknown" }
  | { kind: "failed"; runId: string; definitionKey: string }
  | { kind: "running"; runId: string; definitionKey: string } // enqueued but still draining at timeout
  | { kind: "no-match" }
  | { kind: "ambiguous"; candidates: string[] }
  | { kind: "error"; message: string };

// Derive a verdict for the report. PREFER the REAL verdict the engine now surfaces (G4: run.verify.verdict);
// fall back to deriving from the terminal run state on a pre-G4 mount that omits it. The engine completes a run
// ONLY when its verify step's stop condition (verdict == pass) is met, so run.state === 'completed' implies pass.
function deriveVerdict(run: Run): "pass" | "unknown" {
  // G4: the real, engine-surfaced verdict wins when present.
  if (run.verify && typeof run.verify.verdict === "string") {
    return run.verify.verdict === "pass" ? "pass" : "unknown";
  }
  // Fallback (pre-G4 mount): a completed run with a verify step is a clean pass.
  if (run.state !== "completed") return "unknown";
  const verifyStep = run.steps.find((s) => s.stepType === "verify");
  return verifyStep ? "pass" : "unknown";
}

// Render the G4 verify detail (rung + coded reasons) when the mount surfaces it — else an empty string so the
// report stays clean on pre-G4 mounts. PII-free (coded reasons only).
function fmtVerify(run: Run): string {
  const v = run.verify;
  if (!v || typeof v.verdict !== "string") return "";
  const rung = v.rung ? ` · rung ${v.rung}` : "";
  const reasons = v.reasons && v.reasons.length ? `\n  reasons    : ${v.reasons.join(", ")}` : "";
  return `\n  verifier   : ${v.verdict}${rung}${reasons}`;
}

function fmtSteps(run: Run): string {
  return run.steps
    .map((s) => `      seq ${s.seq} ${s.stepType} -> ${s.state}`)
    .join("\n");
}

export async function handleGoal(cmd: GoalCommand, deps: HandleGoalDeps): Promise<HandleGoalOutcome> {
  const { goalsClient, say } = deps;
  const text = (cmd.text ?? "").trim();

  if (!text && !cmd.intent && !cmd.payload) {
    await say("Give me a goal: `/goal <what you want done>`");
    return { kind: "error", message: "empty goal" };
  }

  const goal: Goal = {
    ...(text ? { text } : {}),
    ...(cmd.intent ? { intent: cmd.intent } : {}),
    ...(cmd.payload ? { payload: cmd.payload } : {}),
    idempotencyKey: cmd.idempotencyKey,
  };

  // ── ROUTE: submit the goal (capability selection, fail-closed). ──
  const submit = await goalsClient.submitGoal(goal);

  if (submit.kind === "no-match") {
    await say(
      `No capability matched that goal — nothing was run (fail-closed).\n` +
        `> ${text || "(structured goal)"}\n` +
        `Try a goal an installed capability serves (e.g. an exec-task with a workdir + token).`,
    );
    return { kind: "no-match" };
  }

  if (submit.kind === "ambiguous") {
    await say(
      `That goal matched more than one capability, so nothing was run (fail-closed — I never pick arbitrarily).\n` +
        `Candidates: ${submit.candidates.join(", ")}\n` +
        `Narrow the goal so exactly one matches.`,
    );
    return { kind: "ambiguous", candidates: submit.candidates };
  }

  if (submit.kind === "error") {
    await say(`Could not submit that goal (HTTP ${submit.status}): ${submit.message}`);
    return { kind: "error", message: `submit failed: ${submit.message}` };
  }

  // ── ENQUEUED: a run was created. Observe it to a terminal state, then report back. ──
  const { runId, definitionKey } = submit;
  const created = submit.created;
  await say(
    `Goal accepted.\n` +
      `  capability : *${definitionKey}*\n` +
      `  runId      : \`${runId}\`${created ? "" : "  (idempotent — existing run for this command)"}\n` +
      `  Running... I'll report when it reaches a terminal state.`,
  );

  const awaited = await goalsClient.awaitRun(runId, deps.awaitOpts);

  if (awaited.kind === "error") {
    await say(`Lost track of run \`${runId}\` (HTTP ${awaited.status}): ${awaited.message}`);
    return { kind: "error", message: `await failed: ${awaited.message}` };
  }

  if (awaited.kind === "timeout") {
    const state = awaited.run?.state ?? "unknown";
    await say(
      `Run \`${runId}\` (*${definitionKey}*) is still running (state: ${state}) — it did not reach a terminal ` +
        `state within the wait window. It will keep draining; re-query later.`,
    );
    return { kind: "running", runId, definitionKey };
  }

  // terminal.
  const run = awaited.run;
  if (run.state === "completed") {
    const verdict = deriveVerdict(run);
    await say(
      `Goal COMPLETED.\n` +
        `  capability : *${definitionKey}*\n` +
        `  runId      : \`${runId}\`\n` +
        `  state      : completed\n` +
        `  verdict    : ${verdict === "pass" ? "PASS" : "completed (verdict not independently surfaced)"}` +
        `${fmtVerify(run)}\n` +
        `  steps:\n${fmtSteps(run)}`,
    );
    return { kind: "completed", runId, definitionKey, verdict };
  }

  // any non-completed terminal state -> honest failure (no false "done").
  await say(
    `Goal did NOT complete — run \`${runId}\` (*${definitionKey}*) ended in state *${run.state}*` +
      `${run.blockedReason ? ` (reason: ${run.blockedReason})` : ""}.\n` +
      `  steps:\n${fmtSteps(run)}`,
  );
  return { kind: "failed", runId, definitionKey };
}

export { deriveVerdict };
