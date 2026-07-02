// =============================================================================
// THE ENFORCE-FLIP ACTIVATION PROOF — the boot constructs the REAL bound organs + the on-switch arms IFF the flag.
// =============================================================================
// PR #55 built the seam + flag + driver; the sweep double-gates on `reasoningDrivesGoals() && reasoning !== undefined`
// but the boot never injected the `reasoning` dep. This slice wires it: `buildBootReasoning()` constructs the real
// bound organs (router + ClaudeCliLlm), and `armedReasoning()` is the boot GATE — it returns those deps IFF the flag
// is ON, else undefined (construct nothing, inert SHADOW). This test proves BOTH, DB-free and with NO model call:
//   (a) buildBootReasoning() returns a well-formed ReasoningSweepDeps — organs present + callable-shaped, ctx has a
//       real requestId, onFounderAction is callable (and logs the draft without throwing);
//   (b) the boot-path gate armedReasoning() hands the sweep the reasoning dep IFF the flag is on (env-stubbed) — off
//       ⇒ undefined (nothing constructed); on ⇒ the same well-formed deps.
// Constructing the stack spawns NO model and touches NO DB — the organs are lazy callables the sweep only invokes
// for a goal that exists; on a bare OS the portfolio is empty, so a model is never spawned here.

import { describe, it, expect, afterEach, vi } from "vitest";

// DB-FREE: the boot organ factory wires the REAL investigate sources (goal-contract + os-runtime), whose module
// graph reaches src/db/client.ts — which evaluates databaseUrl() at import time. Mock that single DB seam so the
// stack is importable WITHOUT a Postgres (and never connects): the sources' read fns are the only consumers of
// `sql`, and this test never invokes an organ, so `sql` is never called. This proves construction is DB-free.
vi.mock("../src/db/client.js", () => ({
  sql: () => {
    throw new Error("DB-free test: sql must not be called during boot-organ construction");
  },
  db: {},
}));

import { buildBootReasoning, armedReasoning } from "../src/reasoning/boot-organs.js";
import { REASONING_DRIVES_GOALS_FLAG } from "../src/env.js";
import type { FounderActionDraft } from "../src/reasoning/goal-driver.js";
import type { ResolveContext } from "../src/reasoning/model-router.js";

const CTX: ResolveContext = { requestId: "activation-test" };

/** Restore the flag to its prior value after each test (never leak env state across the suite). */
const priorFlag = process.env[REASONING_DRIVES_GOALS_FLAG];
afterEach(() => {
  if (priorFlag === undefined) delete process.env[REASONING_DRIVES_GOALS_FLAG];
  else process.env[REASONING_DRIVES_GOALS_FLAG] = priorFlag;
});

function draft(): FounderActionDraft {
  return {
    goalId: "g-activation",
    kind: "PREFLIGHT_HALT",
    reason: "not_reachable",
    summary: "the goal was not shown reachable on the available evidence",
    blockers: [{ claim: "no upstream service", source: "goal_contract:g-activation" }],
    traceStages: ["classify", "reachability", "narrate"],
  };
}

describe("enforce-flip activation — buildBootReasoning() constructs a well-formed ReasoningSweepDeps", () => {
  it("returns the bound organs (all four loop organs present as callables)", () => {
    const deps = buildBootReasoning();
    expect(deps.organs).toBeDefined();
    expect(typeof deps.organs.classify).toBe("function");
    expect(typeof deps.organs.evaluateReachability).toBe("function");
    expect(typeof deps.organs.plan).toBe("function");
    expect(typeof deps.organs.narrate).toBe("function");
  });

  it("carries a resolve ctx with a real, non-empty requestId (seeds the router's deterministic A/B)", () => {
    const deps = buildBootReasoning();
    expect(deps.ctx).toBeDefined();
    expect(typeof deps.ctx.requestId).toBe("string");
    expect(deps.ctx.requestId.trim().length).toBeGreaterThan(0);
    expect(deps.ctx.requestId.startsWith("boot:")).toBe(true);
  });

  it("gives every boot a DISTINCT per-boot requestId (a real id, not a fixed constant)", () => {
    expect(buildBootReasoning().ctx.requestId).not.toBe(buildBootReasoning().ctx.requestId);
  });

  it("exposes an onFounderAction sink that is callable and logs the draft without throwing (no model, no DB)", () => {
    const deps = buildBootReasoning();
    expect(typeof deps.onFounderAction).toBe("function");
    expect(() => deps.onFounderAction?.(draft())).not.toThrow();
  });

  it("constructs the stack WITHOUT spawning a model or touching the DB (pure construction)", () => {
    // buildBootReasoning is a constructor — the organs are lazy callables. Merely building them must not throw
    // (no model spawn, no DB read); the sweep only invokes them for a goal that exists (none here).
    expect(() => buildBootReasoning()).not.toThrow();
    void CTX; // the ctx shape the sweep forwards — asserted structurally above.
  });
});

describe("enforce-flip activation — armedReasoning() is the boot GATE (arms IFF the flag is on)", () => {
  it("flag OFF (unset) ⇒ undefined — the boot constructs NOTHING (inert SHADOW)", () => {
    delete process.env[REASONING_DRIVES_GOALS_FLAG];
    expect(armedReasoning()).toBeUndefined();
  });

  it('flag = "false" ⇒ undefined — fail-closed default (only exactly "true" arms)', () => {
    process.env[REASONING_DRIVES_GOALS_FLAG] = "false";
    expect(armedReasoning()).toBeUndefined();
  });

  it('flag = "true" ⇒ the sweep receives well-formed reasoning deps (the on-switch)', () => {
    process.env[REASONING_DRIVES_GOALS_FLAG] = "true";
    const deps = armedReasoning();
    expect(deps).toBeDefined();
    expect(deps!.organs).toBeDefined();
    expect(typeof deps!.organs.classify).toBe("function");
    expect(typeof deps!.ctx.requestId).toBe("string");
    expect(deps!.ctx.requestId.length).toBeGreaterThan(0);
    expect(typeof deps!.onFounderAction).toBe("function");
  });
});
