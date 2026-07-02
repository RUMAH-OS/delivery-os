// =============================================================================
// THE NARRATE GOLDEN SUITE — the narrator organ's frozen gate (P2 slice 8, roadmap G-24).
// =============================================================================
// I17 — "intelligence measured, never assumed." This is the FROZEN golden set the eval harness replays to
// measure whichever model serves the NARRATE class. It is the organ's gate: a model is not adoptable for
// NARRATE until it is GREEN on these goldens (passesGate). Real-model scoring runs when a model is provisioned;
// the machinery + the goldens ship now so the organ is gated from day one.
//
// NARRATE emits FREE TEXT (not a JSON envelope), so each case is scored by `contains`: given an outcome to
// phrase, the reply MUST carry the load-bearing fact of that outcome (the goal name, the word "clarify" on a
// refusal, a blocker, a step target). This is the honesty bar for a narrator: it may vary the wording, but it
// must NOT drop the decided fact — a reply that omits the goal / the blocker / the ask is not an adoptable
// narration. The `input` is a compact description of the decided outcome; a real NARRATE model phrases it.
//
// A suite is model-agnostic: it names NO model. The runner forces each candidate model over every case.

import type { EvalSuite } from "../eval-case.js";

/** The frozen NARRATE goldens. Ids are stable (a report keys failures by id). Coverage spans every outcome
 *  kind the reasoning loop can reach — clarification / blocked / planned / reviewed / acknowledged — so the
 *  gate proves the model preserves the load-bearing fact of EACH kind, never only the easy (planned) one. */
export const NARRATOR_SUITE: EvalSuite = {
  class: "NARRATE",
  cases: [
    // ── clarification — the reply must ASK the founder to clarify (never silently proceed on ambiguity) ──────
    {
      id: "narrate-clarify-vague",
      class: "NARRATE",
      input: 'Outcome: clarification needed. The founder said "do the thing"; it was too ambiguous to act on.',
      expected: "clarify",
      scorerId: "contains",
    },
    // ── blocked — the reply must surface the goal is NOT reachable (the decided refusal survives) ────────────
    {
      id: "narrate-blocked-unreachable",
      class: "NARRATE",
      input:
        'Outcome: blocked. Goal "double revenue by tomorrow" is not reachable. Blocker: no lever available in the timebox.',
      expected: "not reachable",
      scorerId: "contains",
    },
    // ── planned — the reply must name the goal it planned (the decided plan is attributed to its goal) ───────
    {
      id: "narrate-planned-invoicing",
      class: "NARRATE",
      input: 'Outcome: planned. Goal "ship the invoicing feature" was decomposed into 3 steps.',
      expected: "invoicing",
      scorerId: "contains",
    },
    // ── reviewed — the reply must carry the completion verdict (done / needs work) verbatim ──────────────────
    {
      id: "narrate-reviewed-needs-work",
      class: "NARRATE",
      input: 'Outcome: completion review of goal "add health endpoint" returned needs_work (one lens unmet).',
      expected: "needs_work",
      scorerId: "contains",
    },
    // ── acknowledged — a non-consequential utterance was understood; the reply acknowledges it ───────────────
    {
      id: "narrate-acknowledged-status",
      class: "NARRATE",
      input: 'Outcome: acknowledged. The founder asked for a status digest (investigate lane); no plan warranted.',
      expected: "Understood",
      scorerId: "contains",
    },
  ],
};
