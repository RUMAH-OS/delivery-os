// =============================================================================
// THE CONVENE-BOARD SEAM (O7b) — judgment under challenge; the PO does NOT think alone on hard calls (§10.4).
// =============================================================================
// The second of the two judgment seams. When a call is CONSEQUENTIAL enough that a single line of reasoning is
// not trustworthy, the PO convenes a BOARD: a bounded roster of read-only, role-scoped lenses (correctness /
// risk / cost / user-impact), each reasoning the SAME question from its own vantage; then ONE bounded challenge
// round where every role sees the others' positions and may revise or DISSENT; then a synthesis that lists any
// unresolved dissent EXPLICITLY. The board's product is a DOCUMENT (a BoardReport), never a diff or a mutation.
//
// The load-bearing properties (Frozen §10.4):
//   (a) CONSEQUENTIALITY-GATED — the board convenes ONLY for high-consequence questions. A cheap question
//       returns a `skipped:"below-threshold"` report WITHOUT calling any reasoner: cheap thoughts stay cheap.
//   (b) READ-ONLY, ROLE-SCOPED — each role is a distinct persona/lens reasoning through a read-only reasoning
//       class (VERIFY / ARCH_REVIEW). No role, and the board itself, has any write path. propose ≠ execute ≠
//       judge: the board proposes a considered document; it never authors or mutates anything.
//   (c) BOUNDED CHALLENGE ROUND — exactly ONE round: each role sees the others' opening positions and may
//       revise or dissent. Not an unbounded debate; a single, cost-bounded confrontation.
//   (d) DISSENT PRESERVED VERBATIM — a dissenting role's dissent is copied into the report UNCHANGED. The
//       synthesis NEVER smooths disagreement away: unresolved dissent is listed verbatim and explicitly. The
//       synthesis is composed DETERMINISTICALLY from the positions, so smoothing is impossible by construction.
//
// It names CLASSES (VERIFY / ARCH_REVIEW), never a model. Which model serves each is config, resolved by the
// Model Router behind the (context-aware) ReasoningPort. Reasoner + roster are injectable (tests inject stubs).

import type {
  ReasonWithContextRequest,
  ReasonWithContextResult,
} from "../context/context-aware-port.js";
import type { ResolveContext } from "../model-router.js";
import type { ReasoningClass } from "../reasoning-class.js";
import { CONSEQUENTIALITIES, type Consequentiality } from "../organs/intake-classifier.js";

// ── The prompt-asset version (rollback provenance). ─────────────────────────────────────────────────────────
export const BOARD_SEAM_VERSION = "board/v1";

// ── The read-only reasoning classes a board role may reason through (judgment lenses, never a write path). ───
/** A board role reasons through a READ-ONLY reasoning class. VERIFY (adversarial completion judgment) and
 *  ARCH_REVIEW (deep approach reasoning) are both pure judgment — neither authors nor mutates. A role can name
 *  ONLY these; it can never reach CODE (the author class). This is role-scoping enforced in the type. */
export type BoardLensClass = Extract<ReasoningClass, "VERIFY" | "ARCH_REVIEW">;

/** One board seat: a named ROLE, its persona/LENS prompt, and the read-only class it reasons through. */
export interface BoardRole {
  /** The role's stable name (e.g. "correctness", "risk", "cost", "user-impact"). Keys its position. */
  readonly role: string;
  /** The persona/lens instruction — the vantage this seat reasons from. */
  readonly lens: string;
  /** The READ-ONLY reasoning class this seat reasons through (VERIFY / ARCH_REVIEW). */
  readonly class: BoardLensClass;
}

/** The DEFAULT board: four distinct lenses, each a read-only class. Injectable — a caller may pass its own. */
export const DEFAULT_BOARD_ROSTER: readonly BoardRole[] = Object.freeze([
  {
    role: "correctness",
    lens: "You are the CORRECTNESS lens. Judge whether the proposed answer is actually right — sound, complete, and free of logic errors. Cite the context that supports or undermines it.",
    class: "VERIFY",
  },
  {
    role: "risk",
    lens: "You are the RISK lens. Judge what could go wrong — failure modes, blast radius, irreversibility. Name the risks the others may be glossing over.",
    class: "ARCH_REVIEW",
  },
  {
    role: "cost",
    lens: "You are the COST lens. Judge the cost — effort, time, operational and maintenance burden — versus the value. Flag anything disproportionately expensive.",
    class: "ARCH_REVIEW",
  },
  {
    role: "user-impact",
    lens: "You are the USER-IMPACT lens. Judge the effect on the people who use the product — clarity, disruption, trust. Speak for the user the others are not.",
    class: "ARCH_REVIEW",
  },
]);

// ── The report — a DOCUMENT the board produces (never a diff/mutation). ─────────────────────────────────────

/** One role's recorded stance. `dissent`, when present, is the role's disagreement PRESERVED VERBATIM. */
export interface BoardPosition {
  /** The role that holds this position. */
  readonly role: string;
  /** The role's stance on the question (its final position after the challenge round). */
  readonly position: string;
  /** The role's dissent, VERBATIM — present iff the role disagreed and was not reconciled. Never rewritten. */
  readonly dissent?: string;
}

/**
 * The board's product: a DOCUMENT, never a diff/mutation. It has NO write path — no method mutates anything.
 *   · convened=false + skipped="below-threshold" ⇒ the gate declined to convene (cheap question); positions
 *     empty, no reasoner was called.
 *   · convened=true ⇒ each role's position is recorded, unresolvedDissent lists every dissent VERBATIM, and
 *     synthesis references any disagreement explicitly (never smoothed).
 */
export interface BoardReport {
  /** The question the board was convened on. */
  readonly question: string;
  /** Each role's final position (empty when the board was not convened). */
  readonly positions: readonly BoardPosition[];
  /** The composed document. Lists unresolved dissent explicitly — it NEVER smooths disagreement away. */
  readonly synthesis: string;
  /** Every unresolved dissent, VERBATIM (the exact dissent strings). Empty when the board aligned or skipped. */
  readonly unresolvedDissent: readonly string[];
  /** TRUE iff the board actually convened (false when gated out below threshold). */
  readonly convened: boolean;
  /** Present iff the board did NOT convene — why it was skipped (audit). */
  readonly skipped?: "below-threshold";
  /** The prompt-asset version that produced this report (rollback provenance). */
  readonly seamVersion: string;
}

// ── The consequentiality gate — cheap thoughts stay cheap. ──────────────────────────────────────────────────
/** Rank the (low < medium < high) scale so the gate can compare an ask against a floor. */
const CONSEQUENTIALITY_RANK: Readonly<Record<Consequentiality, number>> = Object.freeze(
  CONSEQUENTIALITIES.reduce(
    (acc, c, i) => ({ ...acc, [c]: i }),
    {} as Record<Consequentiality, number>,
  ),
);

/** The default floor: the board convenes ONLY for HIGH-consequence questions (§10.4). Below it, skip. */
export const DEFAULT_BOARD_THRESHOLD: Consequentiality = "high";

/** Would a question of this consequentiality convene the board (at the given floor)? Pure — the gate rule. */
export function shouldConvene(
  consequentiality: Consequentiality,
  minConsequentiality: Consequentiality = DEFAULT_BOARD_THRESHOLD,
): boolean {
  return CONSEQUENTIALITY_RANK[consequentiality] >= CONSEQUENTIALITY_RANK[minConsequentiality];
}

// ── The reasoning seam + the request. ───────────────────────────────────────────────────────────────────────

/** The narrow reasoning seam the board depends on — `reasonWithContext` with a CLASS. The real
 *  ContextAwareReasoningPort satisfies this structurally; tests inject a lightweight double. */
export interface BoardReasoner {
  reasonWithContext(req: ReasonWithContextRequest): Promise<ReasonWithContextResult>;
}

/** A request to convene the board. Reasoner + roster are injectable; consequentiality gates the call. */
export interface ConveneBoardRequest {
  /** The hard question the board must weigh. */
  readonly question: string;
  /** The blast radius of acting on the answer — the gate consults this (only high convenes by default). */
  readonly consequentiality: Consequentiality;
  /** The resolve context (request id) forwarded to the router. */
  readonly ctx: ResolveContext;
  /** The reasoning seam (ContextAwareReasoningPort satisfies it structurally). Injectable for tests. */
  readonly reasoner: BoardReasoner;
  /** The board roster — defaults to DEFAULT_BOARD_ROSTER (correctness / risk / cost / user-impact). */
  readonly roster?: readonly BoardRole[];
  /** Optional goal in scope — lets the investigate sources pull THAT GoalContract's live state. */
  readonly goalId?: string;
  /** Optional consequentiality floor override (default "high"). Below it the board is skipped. */
  readonly minConsequentiality?: Consequentiality;
}

// ── Per-role prompt building + parsing (pure). ──────────────────────────────────────────────────────────────

/** Build the OPENING task for a role: the lens + the question, asking for a JSON position (+ optional dissent). */
function buildOpeningTask(role: BoardRole, question: string): string {
  return [
    role.lens,
    "",
    "Weigh the QUESTION below from your vantage, reasoning from the assembled context above.",
    "  position : your stance on the question, in your own words (one clear paragraph).",
    "  dissent  : if you fundamentally disagree with the likely consensus, state your disagreement here; else omit it.",
    "",
    "Respond with STRICT JSON on ONE line, no prose:",
    '{"position":"<your stance>","dissent":"<your disagreement, or omit>"}',
    "",
    `Question: <<<${question}>>>`,
  ].join("\n");
}

/** Build the CHALLENGE task for a role: it now sees the OTHER roles' opening positions and may revise or dissent. */
function buildChallengeTask(role: BoardRole, question: string, others: readonly BoardPosition[]): string {
  const othersBlock = others.length
    ? others.map((p) => `  - [${p.role}] ${p.position}${p.dissent ? ` (dissent: ${p.dissent})` : ""}`).join("\n")
    : "  (no other positions)";
  return [
    role.lens,
    "",
    "The OTHER board members opened with these positions:",
    othersBlock,
    "",
    "You may REVISE your position in light of theirs, or hold it and DISSENT. Do not defer to consensus if you",
    "still disagree — a preserved dissent is more valuable than a smoothed-over agreement.",
    "  position : your FINAL stance (revised or held).",
    "  dissent  : if you still fundamentally disagree, state it here VERBATIM; else omit it.",
    "",
    "Respond with STRICT JSON on ONE line, no prose:",
    '{"position":"<final stance>","dissent":"<disagreement, or omit>"}',
    "",
    `Question: <<<${question}>>>`,
  ].join("\n");
}

/** Extract the first JSON object from possibly-noisy model text. */
function extractJsonObject(raw: string): Record<string, unknown> | null {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const parsed = JSON.parse(m[0]);
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/**
 * Parse one role's raw output into a position. Honest + non-fabricating: a parseable JSON envelope yields
 * {position, dissent?}; a non-empty `dissent` field is preserved VERBATIM (never rewritten). If the output is
 * not parseable JSON, the raw text (trimmed) is taken as the position with no dissent — a lens that answered in
 * prose still has a recorded stance; nothing is invented.
 */
function parseRolePosition(role: BoardRole, raw: string): BoardPosition {
  const obj = extractJsonObject(raw);
  if (obj === null) {
    return { role: role.role, position: raw.trim() };
  }
  const position = typeof obj.position === "string" ? obj.position.trim() : "";
  const dissentRaw = typeof obj.dissent === "string" ? obj.dissent.trim() : "";
  const base: BoardPosition = { role: role.role, position };
  // Preserve dissent VERBATIM (from the original field, not a normalized copy) when it is non-empty.
  return dissentRaw.length > 0 ? { ...base, dissent: (obj.dissent as string).trim() } : base;
}

// ── Deterministic synthesis — composes the document; CANNOT smooth dissent away (it lists it verbatim). ──────

/**
 * Compose the synthesis DETERMINISTICALLY from the final positions. Because it is a pure composition (no model
 * call), it can never "smooth" disagreement: every unresolved dissent is embedded VERBATIM and called out
 * explicitly. This is the §10.4 guarantee made structural — dissent survives to the document unchanged.
 */
function composeSynthesis(
  question: string,
  positions: readonly BoardPosition[],
  unresolvedDissent: readonly string[],
): string {
  const lines: string[] = [];
  lines.push(`Board report on: ${question}`);
  lines.push("");
  lines.push("Positions:");
  for (const p of positions) {
    lines.push(`- [${p.role}] ${p.position}${p.dissent ? ` (DISSENT: ${p.dissent})` : ""}`);
  }
  lines.push("");
  if (unresolvedDissent.length > 0) {
    lines.push("UNRESOLVED DISSENT (preserved verbatim, NOT smoothed):");
    for (const d of unresolvedDissent) lines.push(`- ${d}`);
  } else {
    lines.push("No unresolved dissent — the board aligned after the challenge round.");
  }
  return lines.join("\n");
}

// ── The seam entrypoint. ────────────────────────────────────────────────────────────────────────────────────

/**
 * Convene the board on `question`. CONSEQUENTIALITY-GATED: below the floor it returns a skipped report WITHOUT
 * calling any reasoner (cheap thoughts stay cheap). Above it: runs each role's opening read-only reasoning, then
 * ONE bounded challenge round where each role sees the others' positions, records each final position, preserves
 * every dissent VERBATIM in `unresolvedDissent`, and composes a synthesis that lists that dissent explicitly.
 *
 * The board produces a DOCUMENT (BoardReport) — it has NO write path; propose ≠ execute ≠ judge.
 *
 * @throws ReasoningInvocationError / ContextRequiredError / UnknownReasoningClassError / NoAvailableModelError —
 *   a role's model/router/context failure PROPAGATES (a step failure is not a fabricated position).
 */
export async function conveneBoard(req: ConveneBoardRequest): Promise<BoardReport> {
  const floor = req.minConsequentiality ?? DEFAULT_BOARD_THRESHOLD;

  // (a) The gate — a below-threshold question does not convene the board (and calls NO reasoner).
  if (!shouldConvene(req.consequentiality, floor)) {
    return {
      question: req.question,
      positions: [],
      synthesis: `Board not convened — question is below the ${floor} consequentiality threshold.`,
      unresolvedDissent: [],
      convened: false,
      skipped: "below-threshold",
      seamVersion: BOARD_SEAM_VERSION,
    };
  }

  const roster = req.roster ?? DEFAULT_BOARD_ROSTER;

  // Round 1 — each role opens, reasoning read-only from its lens.
  const opening: BoardPosition[] = [];
  for (const role of roster) {
    const result = await req.reasoner.reasonWithContext({
      class: role.class,
      task: buildOpeningTask(role, req.question),
      goalId: req.goalId,
      ctx: req.ctx,
      system: role.lens,
    });
    opening.push(parseRolePosition(role, result.text));
  }

  // (c) ONE bounded challenge round — each role sees the OTHERS' opening positions and may revise or dissent.
  const finalPositions: BoardPosition[] = [];
  for (const role of roster) {
    const others = opening.filter((p) => p.role !== role.role);
    const result = await req.reasoner.reasonWithContext({
      class: role.class,
      task: buildChallengeTask(role, req.question, others),
      goalId: req.goalId,
      ctx: req.ctx,
      system: role.lens,
    });
    finalPositions.push(parseRolePosition(role, result.text));
  }

  // (d) Preserve every dissent VERBATIM; compose a synthesis that lists it explicitly (never smoothed).
  const unresolvedDissent = finalPositions
    .filter((p): p is BoardPosition & { dissent: string } => typeof p.dissent === "string" && p.dissent.length > 0)
    .map((p) => p.dissent);

  return {
    question: req.question,
    positions: finalPositions,
    synthesis: composeSynthesis(req.question, finalPositions, unresolvedDissent),
    unresolvedDissent,
    convened: true,
    seamVersion: BOARD_SEAM_VERSION,
  };
}
