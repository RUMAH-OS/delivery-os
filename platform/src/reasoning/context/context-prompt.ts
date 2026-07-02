// =============================================================================
// CONTEXT PROMPT INJECTION — render the ContextBrief into the reasoning prompt preamble (I17, §10.2).
// =============================================================================
// A pure, DETERMINISTIC, TOKEN-BOUNDED formatter: same brief in ⇒ same preamble out, every time (no clock, no
// randomness, no map-iteration surprises). It turns the assembled brief into two labelled, CITED sections —
// "What we already decided" (knowledge) and "What I observed, cited" (investigation) — so the model reasons
// FROM assembled context, not a cold prompt. Bounded so a large brief can never blow the prompt budget: a
// capped number of items, each claim truncated to a char budget (a rough token proxy — deterministic and
// dependency-free). Every rendered line keeps its citation, so provenance survives into the prompt (I4).

import type { ContextBrief } from "./context-brief.js";

/** Max items rendered per section (oldest-wins by array order; the source decides ordering/relevance). */
export const MAX_ITEMS_PER_SECTION = 12;
/** Max characters per rendered claim (~a token proxy). Longer claims are truncated with an ellipsis. */
export const MAX_CLAIM_CHARS = 240;

/** Truncate a claim to the char budget, collapsing internal whitespace so the preamble stays one-line-per-item. */
function clampClaim(claim: string): string {
  const flat = claim.replace(/\s+/g, " ").trim();
  return flat.length <= MAX_CLAIM_CHARS ? flat : `${flat.slice(0, MAX_CLAIM_CHARS - 1).trimEnd()}…`;
}

/** Render one cited bullet: `- [TAG] <claim>  (source: <source>)`. */
function bullet(tag: string, claim: string, source: string): string {
  return `- [${tag}] ${clampClaim(claim)}  (source: ${source})`;
}

/**
 * Render the brief into a prompt preamble. Pure + deterministic + bounded. An honestly-EMPTY brief renders an
 * explicit "no assembled context" marker rather than nothing — so a reader (and any downstream policy) can
 * SEE that assembly ran and found nothing, distinct from assembly never having happened.
 */
export function formatContextBrief(brief: ContextBrief): string {
  const lines: string[] = [
    "## Assembled context (I17 — context before cognition)",
    `Assembled for reasoning class: ${brief.assembledFor}.`,
  ];

  if (brief.empty) {
    lines.push(
      "(No assembled context available: knowledge-retrieve and investigate both returned nothing relevant. This is an honest empty, not a skipped step.)",
    );
    return lines.join("\n");
  }

  lines.push("", "### What we already decided");
  if (brief.retrieved.length === 0) {
    lines.push("- (nothing retrieved from the knowledge corpus)");
  } else {
    brief.retrieved
      .slice(0, MAX_ITEMS_PER_SECTION)
      .forEach((it, i) => lines.push(bullet(`K${i + 1}`, it.claim, it.source)));
  }

  lines.push("", "### What I observed, cited");
  if (brief.investigated.length === 0) {
    lines.push("- (nothing observed from the live truth domains)");
  } else {
    brief.investigated
      .slice(0, MAX_ITEMS_PER_SECTION)
      .forEach((it, i) => lines.push(bullet(`F${i + 1}`, it.claim, it.source)));
  }

  return lines.join("\n");
}

/**
 * Compose the final prompt for a reasoning call: the cited context preamble, a separator, then the task. Pure
 * — the single place the assembled brief is injected ahead of the task the model reasons about.
 */
export function injectContext(brief: ContextBrief, task: string): string {
  return `${formatContextBrief(brief)}\n\n---\n\n${task}`;
}
