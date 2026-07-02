// =============================================================================
// CONTEXT-ASSEMBLY PROOF (P1 slice 4, roadmap G-15; invariant I17 "context before cognition", Frozen §10.2).
// =============================================================================
// Proves the #1 intelligence lever END-TO-END, deterministic + DB-free (fake ports + StubLlm, no network):
//   (a) assembleContext runs the TWO PAIRED MOVES — knowledge-retrieve + C0-INVESTIGATE — and returns CITED
//       findings from a fake goal/runtime source; every item carries a source (I4);
//   (b) it is honestly EMPTY (empty:true, [] retrieved) when the knowledge corpus has nothing — the seam is
//       real, the corpus is whatever exists; and uncited items are DROPPED, never fabricated;
//   (c) the REAL file-backed KnowledgePort returns [] with no corpus dir configured (honest, not a fake);
//   (d) requiresContext splits correctly — consequential TRUE, cheap FALSE;
//   (e) reasonWithContext, driven through a REAL ReasoningPort (real Model Router over a StubLlm), ASSEMBLES
//       then reasons for a consequential class — the CITED brief provably reached the model's prompt;
//   (f) it FAILS CLOSED (ContextRequiredError) when a consequential class would reason with an empty brief;
//   (g) a cheap class SKIPS assembly (no source is ever queried) and reasons on the bare task.

import { describe, it, expect } from "vitest";
import { StubLlm } from "../src/core/llm.js";
import { ReasoningPort } from "../src/reasoning/reasoning-port.js";
import { ModelRouter } from "../src/reasoning/model-router.js";
import { loadRoutingConfig } from "../src/reasoning/routing-config.js";
import type { ResolveContext } from "../src/reasoning/model-router.js";
import {
  assembleContext,
  EMPTY_KNOWLEDGE_PORT,
  type ContextSources,
} from "../src/reasoning/context/context-assembler.js";
import type {
  Finding,
  InvestigateSource,
  KnowledgeItem,
  KnowledgePort,
} from "../src/reasoning/context/context-brief.js";
import { requiresContext, ContextRequiredError } from "../src/reasoning/context/context-policy.js";
import { formatContextBrief, injectContext } from "../src/reasoning/context/context-prompt.js";
import { ContextAwareReasoningPort } from "../src/reasoning/context/context-aware-port.js";
import { FileKnowledgePort } from "../src/reasoning/context/knowledge/file-knowledge-port.js";
import { REASONING_CLASSES } from "../src/reasoning/context/../reasoning-class.js";

const CTX: ResolveContext = { requestId: "ctx-assembly-test-req-1" };

// ── Fake ports (deterministic, DB-free) ──────────────────────────────────────────────────────────────────

/** A fake goal-contract investigate source: emits cited findings for a scoped goal. */
function fakeGoalSource(goalId: string): InvestigateSource {
  return {
    id: "fake-goal",
    async investigate(q) {
      if (q.goalId !== goalId) return [];
      return [
        { id: "goal.state", claim: `Goal ${goalId} is in state EXECUTING.`, source: `goal_contract:${goalId}` },
        { id: "goal.objective", claim: "Objective: ship invoicing.", source: `goal_contract:${goalId}` },
      ];
    },
  };
}

/** A fake OS-runtime investigate source: one cited liveness finding. */
const fakeRuntimeSource: InvestigateSource = {
  id: "fake-runtime",
  async investigate() {
    return [{ id: "runtime.heartbeat", claim: "OS node beat 3s ago (FRESH).", source: "os_runtime:test-node" }];
  },
};

/** A fake knowledge port scripted with a fixed corpus. */
function fakeKnowledge(items: KnowledgeItem[]): KnowledgePort {
  return { async retrieve() { return items; } };
}

/** A source that records whether it was ever queried (to prove cheap classes SKIP assembly). */
function spySource(): InvestigateSource & { queried: boolean } {
  const s = {
    id: "spy",
    queried: false,
    async investigate() {
      s.queried = true;
      return [{ id: "spy.f", claim: "spy observed something.", source: "spy:1" }] as Finding[];
    },
  };
  return s;
}

// =============================================================================
describe("assembleContext — the two paired moves, cited + honest (§10.2, I4)", () => {
  it("(a) returns CITED findings from goal + runtime sources and CITED knowledge; empty:false", async () => {
    const sources: ContextSources = {
      knowledge: fakeKnowledge([
        { id: "ADR-0007.md", claim: "Reason through classes, never model names.", source: "/decisions/ADR-0007.md" },
      ]),
      investigators: [fakeGoalSource("g-1"), fakeRuntimeSource],
    };
    const brief = await assembleContext({ class: "PLAN", task: "plan the invoicing goal", goalId: "g-1", ctx: CTX }, sources);

    expect(brief.empty).toBe(false);
    expect(brief.assembledFor).toBe("PLAN");
    expect(brief.retrieved).toHaveLength(1);
    expect(brief.investigated).toHaveLength(3); // 2 goal findings + 1 runtime finding
    // Every item/finding is CITED (non-empty source) — I4.
    for (const it of brief.retrieved) expect(it.source.length).toBeGreaterThan(0);
    for (const f of brief.investigated) expect(f.source.length).toBeGreaterThan(0);
    // The citations index flattens every source, tagged by move.
    expect(brief.citations).toHaveLength(4);
    expect(brief.citations.filter((c) => c.kind === "knowledge")).toHaveLength(1);
    expect(brief.citations.filter((c) => c.kind === "investigation")).toHaveLength(3);
  });

  it("(b) is honestly EMPTY when knowledge corpus + investigate both yield nothing", async () => {
    const brief = await assembleContext(
      { class: "PLAN", task: "nothing known yet", ctx: CTX },
      { knowledge: EMPTY_KNOWLEDGE_PORT, investigators: [fakeGoalSource("other-goal")] },
    );
    expect(brief.empty).toBe(true);
    expect(brief.retrieved).toEqual([]);
    expect(brief.investigated).toEqual([]);
    expect(brief.citations).toEqual([]);
  });

  it("(b') DROPS uncited items — never reasons from an unattributable claim (I4)", async () => {
    const sources: ContextSources = {
      knowledge: fakeKnowledge([
        { id: "good.md", claim: "a decided thing", source: "/d/good.md" },
        { id: "", claim: "no id", source: "/d/x.md" }, // dropped: no id
        { id: "bad.md", claim: "no source", source: "" }, // dropped: no source
      ]),
      investigators: [
        { id: "s", async investigate() { return [
          { id: "f.ok", claim: "observed", source: "src:1" },
          { id: "f.bad", claim: "uncited", source: "" }, // dropped
        ]; } },
      ],
    };
    const brief = await assembleContext({ class: "VERIFY", task: "t", ctx: CTX }, sources);
    expect(brief.retrieved).toHaveLength(1);
    expect(brief.retrieved[0]!.id).toBe("good.md");
    expect(brief.investigated).toHaveLength(1);
    expect(brief.investigated[0]!.id).toBe("f.ok");
  });

  it("(c) the REAL FileKnowledgePort returns [] with no corpus dir (honest, not a fake)", async () => {
    const port = new FileKnowledgePort(); // no dir configured
    expect(await port.retrieve("anything")).toEqual([]);
    // A configured-but-missing dir is also honest-empty, never a fabricated hit.
    expect(await new FileKnowledgePort({ dir: "/no/such/dir/ever" }).retrieve("x")).toEqual([]);
  });
});

// =============================================================================
describe("requiresContext — the I17 split (§10.2)", () => {
  it("(d) TRUE for consequential classes, FALSE for cheap/high-volume", () => {
    for (const c of ["CONVERSE", "PLAN", "ARCH_REVIEW", "REACHABILITY", "VERIFY", "INVESTIGATE", "REPO_ANALYSIS"] as const) {
      expect(requiresContext(c)).toBe(true);
    }
    for (const c of ["CLASSIFY", "NARRATE", "CODE"] as const) {
      expect(requiresContext(c)).toBe(false);
    }
    // Split is total over the ten classes — no class is unclassified.
    for (const c of REASONING_CLASSES) expect(typeof requiresContext(c)).toBe("boolean");
  });
});

// =============================================================================
describe("prompt injection — deterministic, cited, bounded", () => {
  it("renders both labelled sections with citations; injectContext puts the brief AHEAD of the task", async () => {
    const brief = await assembleContext(
      { class: "PLAN", task: "T", goalId: "g-1", ctx: CTX },
      { knowledge: fakeKnowledge([{ id: "ADR.md", claim: "decided X", source: "/d/ADR.md" }]), investigators: [fakeGoalSource("g-1")] },
    );
    const preamble = formatContextBrief(brief);
    expect(preamble).toContain("What we already decided");
    expect(preamble).toContain("What I observed, cited");
    expect(preamble).toContain("/d/ADR.md"); // the citation survives into the prompt
    expect(preamble).toContain("goal_contract:g-1");
    // Deterministic: same brief ⇒ identical render.
    expect(formatContextBrief(brief)).toBe(preamble);
    const full = injectContext(brief, "THE_TASK_MARKER");
    expect(full.indexOf("Assembled context")).toBeLessThan(full.indexOf("THE_TASK_MARKER"));
  });
});

// =============================================================================
describe("reasonWithContext — I17 enforced on the reasoning path (§10.2)", () => {
  const router = new ModelRouter(loadRoutingConfig()); // real routing, default availability
  const ctxSources = (extra: InvestigateSource[] = []): ContextSources => ({
    knowledge: fakeKnowledge([{ id: "ADR.md", claim: "reason through classes", source: "/d/ADR.md" }]),
    investigators: [fakeGoalSource("g-1"), fakeRuntimeSource, ...extra],
  });

  it("(e) assembles-then-reasons for a consequential class — the cited brief reaches the prompt", async () => {
    let seenPrompt = "";
    const llm = new StubLlm((prompt) => { seenPrompt = prompt; return "PLANNED"; });
    const port = new ContextAwareReasoningPort(new ReasoningPort(router, llm), ctxSources());

    const result = await port.reasonWithContext({ class: "PLAN", task: "decompose the invoicing goal", goalId: "g-1", ctx: CTX });

    expect(result.text).toBe("PLANNED");
    expect(result.brief?.empty).toBe(false);
    // The assembled, CITED brief provably reached the model's prompt.
    expect(seenPrompt).toContain("Assembled context");
    expect(seenPrompt).toContain("goal_contract:g-1");
    expect(seenPrompt).toContain("/d/ADR.md");
    expect(seenPrompt).toContain("decompose the invoicing goal"); // the task is still there, after the context
  });

  it("(f) FAILS CLOSED (ContextRequiredError) when a consequential class has an empty brief", async () => {
    // Empty knowledge + a goal source scoped to a DIFFERENT goal ⇒ nothing assembled ⇒ empty brief.
    const emptySources: ContextSources = { knowledge: EMPTY_KNOWLEDGE_PORT, investigators: [fakeGoalSource("other")] };
    const llm = new StubLlm(() => { throw new Error("model must NOT be called on empty context"); });
    const port = new ContextAwareReasoningPort(new ReasoningPort(router, llm), emptySources);

    await expect(port.reasonWithContext({ class: "PLAN", task: "plan with no context", ctx: CTX })).rejects.toBeInstanceOf(
      ContextRequiredError,
    );
  });

  it("(g) a CHEAP class SKIPS assembly (no source queried) and reasons on the bare task", async () => {
    const spy = spySource();
    let seenPrompt = "";
    const llm = new StubLlm((prompt) => { seenPrompt = prompt; return "labelled"; });
    const port = new ContextAwareReasoningPort(new ReasoningPort(router, llm), {
      knowledge: EMPTY_KNOWLEDGE_PORT,
      investigators: [spy],
    });

    const result = await port.reasonWithContext({ class: "CLASSIFY", task: "good morning", ctx: CTX });

    expect(result.text).toBe("labelled");
    expect(result.brief).toBeUndefined(); // cheap classes assemble nothing
    expect(spy.queried).toBe(false); // assembly was SKIPPED — the source was never touched
    expect(seenPrompt).toBe("good morning"); // bare task, no injected preamble
  });
});
