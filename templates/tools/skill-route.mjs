// =============================================================================
// Delivery OS — deterministic skill-router (v6 capability #8). Zero-dep.
// =============================================================================
// "The system should know which skill to invoke. Founder recall should not be
// required." (v6 track 3.) Given a task description + the installed skills' machine-
// parseable frontmatter (#6: capabilities[]/triggers[]), this ranks the skills
// DETERMINISTICALLY (no randomness, no LLM, no Thompson-sampling — a single-writer-of-
// record never tolerates N wrong routes to learn). The top-ranked skill is the one to
// invoke; ties break by name (stable). It only RANKS already-earned skills — quality
// stays gated by author≠verifier + §11, never by the router.
//
//   import { routeTask, loadSkills } from "./skill-route.mjs"
//   node skill-route.mjs "<task>" [skillsDir]   # prints the ranked match
//
// Scoring (deterministic, explainable):
//   +10  a trigger PHRASE is a substring of the task (strongest signal)
//   +3   per task token that matches a trigger token
//   +1   per task token that matches a capability token
//   +0.5 per task token found in the skill name
// =============================================================================

import { readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { readSkillFrontmatter } from "./skill-frontmatter.mjs";

const STOP = new Set(["the", "a", "an", "to", "of", "for", "and", "or", "is", "it", "this", "that", "with", "on", "in", "my", "i", "we", "should", "do", "run", "how", "can", "be", "are", "need"]);
const toks = (s) => String(s || "").toLowerCase().match(/[a-z0-9]+/g)?.filter((t) => t.length > 2 && !STOP.has(t)) ?? [];

export function loadSkills(skillsDir) {
  return readdirSync(skillsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => {
      try {
        const fm = readSkillFrontmatter(join(skillsDir, e.name, "SKILL.md"));
        return { name: e.name, capabilities: fm.capabilities ?? [], triggers: fm.triggers ?? [], description: fm.description ?? "" };
      } catch { return { name: e.name, capabilities: [], triggers: [], description: "" }; }
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function scoreSkill(taskLower, taskTokens, skill) {
  let score = 0;
  const reasons = [];
  const taskSet = new Set(taskTokens);
  // 1. whole-phrase trigger match — the strongest signal (a real phrasing of the task).
  for (const trig of skill.triggers || []) {
    const tl = String(trig).toLowerCase();
    if (tl.length > 3 && taskLower.includes(tl)) { score += 10; reasons.push(`trigger~"${trig}"`); }
  }
  // 2. DISTINCT task-tokens that appear in ANY trigger token, deduped across triggers
  //    (a generic word repeated across N triggers counts ONCE — scattered repetition of
  //    one common token must NOT beat a genuine phrase match: defect v6-SKILLROUTER-01).
  const trigTokens = new Set();
  for (const trig of skill.triggers || []) for (const t of toks(trig)) trigTokens.add(t);
  const trigHits = [...taskSet].filter((t) => trigTokens.has(t));
  if (trigHits.length) { score += 3 * trigHits.length; reasons.push(`trig:${trigHits.join("/")}`); }
  // 3. DISTINCT task-tokens in ANY capability, deduped, not already counted via triggers.
  const capTokens = new Set();
  for (const cap of skill.capabilities || []) for (const t of toks(cap)) capTokens.add(t);
  const capHits = [...taskSet].filter((t) => capTokens.has(t) && !trigTokens.has(t));
  if (capHits.length) { score += capHits.length; reasons.push(`cap:${capHits.join("/")}`); }
  // 4. name tokens (weak tiebreak).
  for (const t of toks(skill.name)) if (taskSet.has(t)) score += 0.5;
  return { score, reasons };
}

// Deterministic ranking. Returns [{name, score, reasons}] sorted desc, ties by name.
export function routeTask(task, skills) {
  const taskLower = String(task || "").toLowerCase();
  const taskTokens = toks(task);
  return skills
    .map((s) => ({ name: s.name, ...scoreSkill(taskLower, taskTokens, s) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => (b.score - a.score) || a.name.localeCompare(b.name));
}

// --- CLI ---
function sameFile(p) { try { return p && p.startsWith("file:") ? fileURLToPath(p) : p; } catch { return p; } }
if (process.argv[1] && fileURLToPath(import.meta.url) === sameFile(process.argv[1])) {
  const task = process.argv[2];
  const dir = process.argv[3] || join(process.cwd(), ".claude", "skills");
  if (!task) { console.error('skill-route: usage: node skill-route.mjs "<task>" [skillsDir]'); process.exit(2); }
  const ranked = routeTask(task, loadSkills(dir));
  if (!ranked.length) { console.error(`skill-route: no skill matched "${task}" — no deterministic route (candidate for a new earned skill).`); process.exit(1); }
  console.error(`skill-route · ${ranked.length} match(es) for: "${task}"`);
  for (const r of ranked.slice(0, 3)) console.error(`  ${r.score.toFixed(1).padStart(5)}  ${r.name}  (${r.reasons.slice(0, 4).join(", ")})`);
  console.log(ranked[0].name); // stdout = the route (for scripting)
  process.exit(0);
}
