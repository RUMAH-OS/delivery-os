// =============================================================================
// REASONING CLASSES — the stable interface the Company OS reasons through.
// =============================================================================
// Per ADR-reasoning-model-routing.md: "The Company OS reasons through reasoning CLASSES, not model
// names." Organ code depends ONLY on these constants; a model version string appears nowhere here (nor
// anywhere under platform/src/** — see test/no-model-id-literals.test.ts). Which concrete model serves a
// class is routine CONFIG (reasoning-routing.config.json), resolved at runtime by the Model Router.
//
// Adding a class is an ARCHITECTURE change (rare, reviewed). Changing which model serves a class is DATA.

/** The ten reasoning classes (ADR §"Reasoning classes"). Order matches the ADR table. */
export const REASONING_CLASSES = [
  "CONVERSE", // PO conversational mind — understand founder, decide, dialogue (inline, low-latency, tool-capable)
  "CLASSIFY", // C1 intent {intent, lane, consequentiality, reversibility} (inline, high-volume, cheap, structured)
  "REACHABILITY", // C9 fail-closed feasibility (θ=0.7) (inline, bounded judgment)
  "PLAN", // C2-MIND decomposition → DAG (inline, hard reasoning)
  "ARCH_REVIEW", // deep architecture reasoning/review (inline or session, max reasoning)
  "INVESTIGATE", // deep investigation ("why is CI slow") (spawned session; tools/FS)
  "REPO_ANALYSIS", // repository reading/analysis at breadth (spawned session, often fan-out)
  "CODE", // implementation / author (spawned session — Claude Code)
  "VERIFY", // C6 completion review / adversarial judge (inline or session; model-diverse from author)
  "NARRATE", // O12 compose the founder-facing reply (inline, cheap)
] as const;

/** A reasoning class — the ONLY thing organ code names when it reasons. */
export type ReasoningClass = (typeof REASONING_CLASSES)[number];

/** A readonly Set for O(1) membership checks. */
const REASONING_CLASS_SET: ReadonlySet<string> = new Set(REASONING_CLASSES);

/** Type guard: is `x` a known reasoning class? */
export function isReasoningClass(x: unknown): x is ReasoningClass {
  return typeof x === "string" && REASONING_CLASS_SET.has(x);
}
