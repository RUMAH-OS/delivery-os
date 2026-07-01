// INTENT — the CORE's founder-utterance -> capability classifier. CHANNEL-AGNOSTIC (no Slack, no HTTP).
//
// TWO LAYERS, honest by construction:
//   1. A deterministic keyword pre-classifier (free, instant) that catches the UNAMBIGUOUS founder phrases.
//      A control surface should not burn a model session to recognise "review all open PRs".
//   2. The LLM (via the swappable LlmClient) for everything the keywords do not confidently catch — it maps
//      free text to the SAME fixed enum, returning JSON {intent, confidence}. If the model errors, is absent,
//      or returns something off-enum, we FALL BACK to the keyword result, else `unknown`. The model can only
//      pick FROM the enum — it never invents a capability, and it never touches operational state (that is the
//      tools' job; see project-owner.ts).

import type { LlmClient } from "./llm.js";

// The fixed capability enum the Project Owner can route to. Add a capability here + a dispatch arm in
// project-owner.ts + a keyword rule below. `unknown` is the honest fail-closed sink (menu, nothing run).
export const INTENTS = [
  "review_open_prs", // "review all open PRs"
  "show_blockers", // "show blockers" / "what changed overnight"
  "company_health", // "summarize company health"
  "create_goal", // "create a goal / sprint ..."
  "approve", // "approve ..."
  "morning_digest", // "good morning" / "what should I work on"
  "unknown", // fail-closed: nothing matched -> honest menu, nothing run
] as const;
export type Intent = (typeof INTENTS)[number];

export interface Classification {
  intent: Intent;
  confidence: number; // 0..1 (keyword hits = 1; LLM carries its own; unknown = 0)
  via: "keyword" | "llm" | "fallback"; // how we decided (surfaced for the proof + honest logging)
}

// ── Layer 1: deterministic keyword rules. Order matters: earlier, more-specific rules win. ──
// Each rule: a test over the lowercased text -> an intent. Kept explicit and readable (no clever regex soup).
function keywordClassify(textRaw: string): Intent | null {
  const t = textRaw.toLowerCase().trim();
  if (!t) return null;

  // approvals: an explicit approve/reject verb (guard: not "approved" in a status question).
  if (/\b(approve|reject|resolve)\b/.test(t) && !/\bapproved\b/.test(t)) return "approve";

  // create a goal / sprint / kick off work.
  if (/\b(create|start|kick ?off|launch|open|submit)\b.*\b(goal|sprint|task|milestone|workstream)\b/.test(t))
    return "create_goal";
  if (/^\/?goal\b/.test(t)) return "create_goal"; // a raw `/goal ...` body

  // review open PRs.
  if (/\b(review|show|list|open)\b.*\b(prs?|pull requests?)\b/.test(t)) return "review_open_prs";
  if (/\bopen prs?\b/.test(t)) return "review_open_prs";

  // blockers / overnight changes.
  if (/\bblockers?\b/.test(t)) return "show_blockers";
  if (/\b(what|anything)\b.*\b(changed|happened|broke|merged)\b.*\b(overnight|last night|since yesterday|today)\b/.test(t))
    return "show_blockers";
  if (/\bovernight\b/.test(t)) return "show_blockers";

  // company / system health.
  if (/\b(company|system|overall|org|platform)\b.*\bhealth\b/.test(t)) return "company_health";
  if (/\bhealth (check|status|report)\b/.test(t)) return "company_health";
  if (/\bhow('?s| is| are)\b.*\b(we|things|everything|the (company|system|platform))\b.*\b(doing|going)\b/.test(t))
    return "company_health";

  // morning digest / what should I work on.
  if (/\b(good ?morning|morning|gm)\b/.test(t)) return "morning_digest";
  if (/\bwhat (should|do) i\b.*\b(work on|do|focus)\b/.test(t)) return "morning_digest";
  if (/\bwhere (should|do) i (start|begin|focus)\b/.test(t)) return "morning_digest";

  return null;
}

function isIntent(x: unknown): x is Intent {
  return typeof x === "string" && (INTENTS as readonly string[]).includes(x);
}

// The LLM classification prompt. Constrains the model to the enum + a strict JSON envelope. It classifies text
// ONLY — it is explicitly told it has no access to live state and must not invent any.
function buildClassifyPrompt(text: string): string {
  return [
    "You are the intent classifier for a software company's Project Owner control surface.",
    "Map the founder's message to EXACTLY ONE intent from this list (return the id string verbatim):",
    "- review_open_prs : they want to see / review open pull requests across the repos",
    "- show_blockers   : they want current blockers — failing checks, stuck PRs, what changed overnight",
    "- company_health  : they want an overall company / system health summary",
    "- create_goal     : they want to start/create a goal, sprint, task, or workstream",
    "- approve         : they want to approve or reject a pending approval/gate",
    "- morning_digest  : a greeting or 'what should I work on' — they want a status digest to start the day",
    "- unknown         : none of the above clearly applies",
    "",
    "You are ONLY classifying text. You have NO access to live data; do not invent any.",
    'Respond with STRICT JSON on ONE line, no prose: {"intent":"<id>","confidence":<0..1>}',
    "",
    `Founder message: ${JSON.stringify(text)}`,
  ].join("\n");
}

// Parse the model's JSON envelope leniently (it may wrap it in prose despite instructions).
function parseClassification(out: string): { intent: Intent; confidence: number } | null {
  const m = out.match(/\{[\s\S]*?\}/);
  if (!m) return null;
  try {
    const obj = JSON.parse(m[0]) as { intent?: unknown; confidence?: unknown };
    if (!isIntent(obj.intent)) return null;
    const confidence = typeof obj.confidence === "number" ? Math.max(0, Math.min(1, obj.confidence)) : 0.5;
    return { intent: obj.intent, confidence };
  } catch {
    return null;
  }
}

// Classify a founder utterance. Keyword-first (free/deterministic); LLM for the rest; honest fallback to
// `unknown`. `llm` is optional so the CORE degrades cleanly when no model is wired.
export async function classifyIntent(text: string, llm?: LlmClient): Promise<Classification> {
  const kw = keywordClassify(text);
  if (kw) return { intent: kw, confidence: 1, via: "keyword" };

  if (llm) {
    try {
      const out = await llm.complete(buildClassifyPrompt(text), { timeoutMs: 30_000 });
      const parsed = parseClassification(out);
      if (parsed) return { intent: parsed.intent, confidence: parsed.confidence, via: "llm" };
    } catch {
      // model errored/absent -> fall through to the honest fallback (never fabricate an intent).
    }
  }
  return { intent: "unknown", confidence: 0, via: "fallback" };
}

export { keywordClassify };
