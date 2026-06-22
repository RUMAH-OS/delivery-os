// The demo app's OWN CapabilityPack — its capability CONTENT (definitions / verifiers / handlers).
// This is NOT copied from rumah-admin: it is the demo app's trivial "demo-ping" workflow, declared against
// the SAME app-agnostic contract Admin uses (CapabilityPack). The engine registers it uniformly via
// createCapabilityRuntime — no bespoke wiring, no per-app register*() side-effects.
//
// demo-ping — 2 steps, the minimum that exercises register -> enqueue -> step -> verify -> complete:
//   seq 0  say-hello   (effect: emit-only)  -> emits a `demo.ping` event + writes { pinged: true, nonce } to
//                                              its checkpoint (the candidate the verifier reads).
//   seq 1  verify-ping (handler engine.verify, T1 verifier) -> reads seq-0's checkpoint, returns pass when
//                                              pinged === true; the engine stores the verdict, evaluates the
//                                              declarative stopCondition (verdict-equals pass) -> loop stops ->
//                                              run completes.

import type { CapabilityPack } from "../../.claude/os/engine/index.js";

export const DEMO_PING_PACK: CapabilityPack = {
  id: "demo-ping",

  definitions: [
    {
      key: "demo-ping",
      description: "N=2 platform proof: emit a ping, then a T1 verifier confirms it. Completes green.",
      steps: [
        // seq 0 — the ACT step (emit-only). Emits demo.ping + records the candidate in its checkpoint.
        {
          stepType: "demo.say-hello",
          owner: "engine-demo-app",
          effect: "emit-only",
          maxAttempts: 1,
          handler: "demo.say-hello",
        },
        // seq 1 — the VERIFY step. The engine runs verifierId in-process, stores the verdict, and evaluates
        // stopCondition over it. retryBackToSeq=0 means: on fail, re-ready seq 0 (the loop back-edge); here the
        // verifier passes first try, so the loop stops immediately and the run completes.
        {
          stepType: "demo.verify-ping",
          owner: "engine-demo-app",
          effect: "emit-only",
          maxAttempts: 1,
          handler: "engine.verify",
          verifierId: "demo.ping-verifier",
          stopCondition: { kind: "verdict-equals", value: "pass" },
          retryBackToSeq: 0,
        },
      ],
    },
  ],

  handlers: [
    {
      // emit-only act handler: emits the demo.ping event to the outbox (in-txn) + returns the candidate as its
      // checkpoint (PII-free refs). The engine writes result+checkpoint in the same txn as the state advance.
      key: "demo.say-hello",
      run: async (ctx) => {
        const nonce = `ping-${ctx.runId.slice(0, 8)}-${ctx.attempt}`;
        await ctx.emit("demo.ping", { runId: ctx.runId, seq: ctx.seq, nonce });
        return {
          ok: true,
          result: { said: "hello" },
          checkpoint: { pinged: true, nonce }, // the candidate the verifier reads (opaque to the engine)
        };
      },
    },
  ],

  verifiers: [
    {
      // T1 deterministic verifier: a rule is pass|fail (no score/confidence faked). Reads the act step's
      // checkpoint (the engine passes it as the opaque `candidate`) and confirms the ping was recorded.
      id: "demo.ping-verifier",
      verify: async (input) => {
        const pinged = (input.candidate as { pinged?: unknown }).pinged === true;
        return pinged
          ? { verdict: "pass", reasons: ["ping_recorded"] }
          : { verdict: "fail", reasons: ["ping_missing"] };
      },
    },
  ],
};
