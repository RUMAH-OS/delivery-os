// =============================================================================
// Delivery OS — agent .md frontmatter contract (v6 agent-orchestration). Zero-dep.
// =============================================================================
// Agents are the UNIT OF OUTCOME-OWNERSHIP (v6). For an agent to be ROUTED to a task
// (not merely described in a roster the founder must recall), its .md frontmatter must
// be a machine-parseable contract: what it DOES (`capabilities[]`) and the task phrases
// that should route to it (`triggers[]`). This module is the single source for parsing
// + validating that frontmatter — the exact mirror of skill-frontmatter (#6), consumed
// by the agent-router and the agents:check gate. Fail-closed: an agent that can't be
// matched to a task is an agent the founder must recall by hand — what v6 removes.
//
// Required: name (= .md filename stem) · kind ("agent") · capabilities[] · triggers[].
// Optional: description · tools · everything else the agent .md already carries.
// =============================================================================

import { readFileSync } from "node:fs";
import { basename } from "node:path";

export const AGENT_FRONTMATTER_VERSION = "v1";

// Minimal tolerant YAML-frontmatter reader: scalars, inline arrays `[a, b]`, block
// arrays (`- item` lines), and folded/literal scalars (`>`/`|`). Enough for an agent .md.
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

export function readAgentFrontmatter(agentMdPath) {
  return parseFrontmatter(readFileSync(agentMdPath, "utf8"));
}

const isNonEmptyStr = (v) => typeof v === "string" && v.trim().length > 0;
const isStrArray = (v) => Array.isArray(v) && v.length > 0 && v.every(isNonEmptyStr);

// Validate one agent's frontmatter against the contract. `dirOrFileName` is the .md
// path or filename — name must equal its stem (the router resolves by file).
export function validateAgentFrontmatter(fm, dirOrFileName) {
  const violations = [];
  if (!fm || typeof fm !== "object") return { ok: false, violations: ["frontmatter: missing or unparseable (no --- block?)"] };
  const stem = dirOrFileName ? basename(String(dirOrFileName)).replace(/\.md$/i, "") : undefined;
  if (!isNonEmptyStr(fm.name)) violations.push(`name: required non-empty string`);
  else if (stem && fm.name !== stem) violations.push(`name "${fm.name}" must match agent filename "${stem}" (router resolves by file)`);
  if (fm.kind !== "agent") violations.push(`kind: required and must be "agent" (got ${JSON.stringify(fm.kind)})`);
  if (!isStrArray(fm.capabilities)) violations.push(`capabilities[]: required non-empty list of what the agent DOES (verbs/nouns) — without it the router can't match this agent (founder would recall by hand)`);
  if (!isStrArray(fm.triggers)) violations.push(`triggers[]: required non-empty list of task phrases that should route here — without it the agent is invisible to deterministic routing`);
  return { ok: violations.length === 0, violations };
}
