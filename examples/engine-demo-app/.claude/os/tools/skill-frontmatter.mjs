// =============================================================================
// Delivery OS — SKILL.md frontmatter contract (v6 capability #6). Zero-dep.
// =============================================================================
// Skills are the UNIT OF CAPABILITY (v6 track 1). For a skill to be EXECUTED and
// ROUTED (not merely described), its SKILL.md frontmatter must be a machine-parseable
// contract: what it DOES (`capabilities[]`) and the task phrases that should route to
// it (`triggers[]`). This module is the single source for parsing + validating that
// frontmatter — consumed by the skill-router (#8), the frontmatter gate, and
// render-kernel (§5 derivation). Fail-closed: a skill that can't be matched to a task
// is a skill the founder must recall by hand — exactly what v6 removes.
//
// Required: name · description · capabilities[] · triggers[].
// Optional: version · kind (review|execution) · earned_from · inputs[] · outputs[].
// =============================================================================

import { readFileSync } from "node:fs";

export const SKILL_FRONTMATTER_VERSION = "v1";

// Minimal tolerant YAML-frontmatter reader: scalars, inline arrays `[a, b]`, block
// arrays (`- item` lines), and folded/literal scalars (`>`/`|`). Enough for SKILL.md.
export function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const o = {};
  if (!m) return o;
  const lines = m[1].split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const kv = lines[i].match(/^([a-z_]+):\s*(.*)$/i);
    if (!kv) continue;
    const key = kv[1].toLowerCase();
    let val = kv[2].trim();
    if (val === "" && i + 1 < lines.length && /^\s*-\s+/.test(lines[i + 1])) {
      // block array
      const arr = [];
      while (i + 1 < lines.length && /^\s*-\s+/.test(lines[i + 1])) arr.push(lines[++i].replace(/^\s*-\s+/, "").trim().replace(/^["']|["']$/g, ""));
      o[key] = arr;
    } else if (val === ">" || val === "|" || val === ">-" || val === "|-") {
      const buf = [];
      while (i + 1 < lines.length && /^\s+\S/.test(lines[i + 1])) buf.push(lines[++i].trim());
      o[key] = buf.join(" ");
    } else if (/^\[.*\]$/.test(val)) {
      // inline array [a, b, c]
      o[key] = val.slice(1, -1).split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
    } else {
      o[key] = val.replace(/^["']|["']$/g, "");
    }
  }
  return o;
}

export function readSkillFrontmatter(skillMdPath) {
  return parseFrontmatter(readFileSync(skillMdPath, "utf8"));
}

const isNonEmptyStr = (v) => typeof v === "string" && v.trim().length > 0;
const isStrArray = (v) => Array.isArray(v) && v.length > 0 && v.every(isNonEmptyStr);

// Validate one skill's frontmatter against the contract. `name` optionally checked
// against the directory name (routing depends on them matching).
export function validateSkillFrontmatter(fm, dirName) {
  const violations = [];
  if (!fm || typeof fm !== "object") return { ok: false, violations: ["frontmatter: missing or unparseable (no --- block?)"] };
  if (!isNonEmptyStr(fm.name)) violations.push(`name: required non-empty string`);
  else if (dirName && fm.name !== dirName) violations.push(`name "${fm.name}" must match skill directory "${dirName}" (router resolves by dir)`);
  if (!isNonEmptyStr(fm.description)) violations.push(`description: required non-empty string`);
  if (!isStrArray(fm.capabilities)) violations.push(`capabilities[]: required non-empty list of what the skill DOES (verbs/nouns) — without it the router can't match this skill (founder would recall by hand)`);
  if (!isStrArray(fm.triggers)) violations.push(`triggers[]: required non-empty list of task phrases that should route here — without it the skill is invisible to deterministic routing`);
  if (fm.kind !== undefined && fm.kind !== "review" && fm.kind !== "execution") violations.push(`kind: if present must be "review" or "execution" (got ${JSON.stringify(fm.kind)})`);
  return { ok: violations.length === 0, violations };
}
