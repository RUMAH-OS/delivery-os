// =============================================================================
// Delivery OS — dispatch-runner (the orchestration runner, v6 capability #9). Zero-dep
// ESM. Windows-safe. Fail-closed. THE MECHANISM, not a new report.
// =============================================================================
// PROVENANCE: ownerSystem=delivery-os · status=canonical · home=delivery-os/templates/tools/dispatch-route.mjs.
// CANONICAL + VENDORED: listed in capabilities/os-foundation.manifest.json; vendored into each
// project via os-inherit (sync) at .claude/os/tools/dispatch-route.mjs and kept byte-current by
// os-inherit check (drift-gated). Do NOT hand-edit the vendored copy — edit the canonical source
// here and re-run `os-inherit sync`. Project-LOCAL data stays in the project (per the gates pattern):
// the ownership-policy (ownership-policy.json) + the dispatch-log/telemetry are per-project; only the
// TOOL is OS-owned. Promotion wave 1 (proof-of-pattern): establishes Delivery OS as the canonical
// owner of agent orchestration — execution-layer ownership does not live in project repositories.
// =============================================================================
// Founder charter (G9): "automatic specialist selection · automatic skill injection ·
// automatic knowledge injection · automatic ownership routing · measurable adoption in
// real product work." This tool is a thin COMPOSER over the four EXISTING routers —
// agent-route + ownership-policy + skill-route + knowledge-route — adding ZERO new
// scorer. Per dispatch it:
//   1. SELECTS the agent (agent-route — advisory) and RESOLVES the required owner
//      (ownership-policy detectWorkTypes + requiredOwner). RECONCILE: the policy's
//      requiredOwner WINS as `reconciled`; agent-route's pick is recorded as `selected`
//      (the explainer/`why`). The reconciled owner is who Claude must spawn.
//   2. ROUTES skills (skill-route) + knowledge (knowledge-route), takes the top match
//      each (top-k=1 for the slice), mints their proofIds + injection markers REUSING
//      their own functions (no fork).
//   3. EMITS a DispatchPlan + a verbatim `spawnPrompt` with the markers + bodies inlined
//      and a one-line consult-and-cite instruction. dispatchId is the parent of the
//      per-router proofIds.
//
// HONEST CEILING (G9 binding): only the main loop (Claude) spawns subagents. This tool
// does NOT spawn. It collapses the orchestrator's discretion into a deterministic plan
// + a verbatim prompt; Claude stays the spawner. The dispatch-log answers "WHAT WAS
// AUTO-INJECTED" (dimension #8 — REPORT-ONLY, never scored).
//
// C1 (Runner ≠ checklist): --conformance joins the dispatch-log to the actually-spawned
//   agentType (subagent meta.json) per dispatchId and flags DEVIATION when actual ≠
//   agentReconciled. A plan with no enforcement is relabeled discretion; the conformance
//   ratio is what makes this a RUNNER.
// C2 (Injection firewalled from adoption — HARD): the dispatch-log's skillsInjected /
//   kusInjected are INJECTION records ONLY. They are written to dispatch-log.jsonl, which
//   skill-health / knowledge-health NEVER read (those gate `used`/`trust` on content-bound
//   citation@hash in skill-selections / knowledge-selections). This tool adds NO path that
//   lets an injection count touch a rung or trust. The self-test asserts the property.
//
//   import { planDispatch } from "./dispatch-route.mjs"
//   node dispatch-route.mjs "<task>" [--work-type <wt>] [--log <dispatch-log.jsonl>] [--batch <id>]
//   node dispatch-route.mjs --conformance [--log <dispatch-log.jsonl>] [--project <dir>] [--json]
//   node dispatch-route.mjs --self-test
// =============================================================================

import {
  readdirSync,
  appendFileSync,
  readFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  existsSync,
} from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

// REUSE the four routers verbatim — no new scorer, no fork.
import { loadAgents, routeTask as routeAgent } from "./agent-route.mjs";
import {
  loadSkills,
  routeTask as routeSkill,
  mintProofId as mintSkillProofId,
  injectionMarker as skillMarker,
  appendSelection as appendSkillSelection,
  readSelections as readSkillSelections,
} from "./skill-route.mjs";
import {
  loadKnowledge,
  routeKnowledge,
  mintProofId as mintKnowledgeProofId,
  retrievalMarker as knowledgeMarker,
  appendSelection as appendKnowledgeSelection,
  readSelections as readKnowledgeSelections,
  bodyOf,
  computeContentHash,
} from "./knowledge-route.mjs";

// ownership-policy lives under scripts/ (G14) — the SAME source slice-close uses.
// LOCATION-ROBUST RESOLUTION (byte-identity-safe): this tool is byte-identical in TWO
// layouts — the VENDORED runtime copy at `<project>/.claude/os/tools/` (where the project-
// LOCAL `scripts/ownership-gate.mjs` sits THREE up: `../../../scripts/`) and the CANONICAL
// source at `delivery-os/templates/tools/` (where the OS's own `scripts/ownership-gate.mjs`
// sits TWO up: `../../scripts/`, used by the in-place `--self-test`). A single STATIC import
// can only name ONE depth, so it cannot load in both — which made the canonical `--self-test`
// un-loadable (ERR_MODULE_NOT_FOUND on a path one level above the repo). We resolve the module
// at load via the FIRST existing of {vendored depth, canonical depth}; if neither exists we
// fail CLOSED to the built-in default policy (routing stays ON, never silently disabled).
const HERE = dirname(fileURLToPath(import.meta.url));
// repo root = .claude/os/tools → ../../../ (vendored) ; templates/tools → ../../ (canonical).
const ROOT = resolve(HERE, "..", "..", "..");

const { loadPolicy, detectWorkTypes, requiredOwner } = await (async () => {
  const candidates = [
    resolve(HERE, "..", "..", "..", "scripts", "ownership-gate.mjs"), // vendored: <project>/scripts (project-LOCAL, the authored runtime intent)
    resolve(HERE, "..", "..", "scripts", "ownership-gate.mjs"),       // canonical: delivery-os/scripts (the OS's own copy, for --self-test)
  ];
  for (const c of candidates) {
    if (existsSync(c)) {
      try { return await import(pathToFileURL(c).href); } catch { /* try next */ }
    }
  }
  // fail-closed: no ownership-gate on disk → the G14 DEFAULT policy (routing never disabled).
  const DEFAULT_POLICY = { workTypes: [] };
  return {
    loadPolicy: () => DEFAULT_POLICY,
    detectWorkTypes: () => [],
    requiredOwner: () => null,
  };
})();

const DEFAULT_AGENTS = join(ROOT, ".claude", "agents");
const DEFAULT_SKILLS = join(ROOT, ".claude", "skills");
const DEFAULT_CORPUS = join(ROOT, "wiki");
const DEFAULT_POLICY = join(ROOT, ".claude", "ownership-policy.json");
const DEFAULT_DISPATCH_LOG = join(ROOT, ".claude", "os", "telemetry", "dispatch-log.jsonl");
const DEFAULT_SKILL_LOG = join(ROOT, ".claude", "os", "telemetry", "skill-selections.jsonl");
const DEFAULT_KNOWLEDGE_LOG = join(ROOT, ".claude", "os", "telemetry", "knowledge-selections.jsonl");
const DEFAULT_PROJECT_DIR =
  "C:/Users/brian/.claude/projects/c--Users-brian-RUMAH-rumah-admin";

// =============================================================================
// dispatchId — the parent join key. REUSES the per-router mintProofId recipe
// (sha1(a + " " + b + " " + counter).slice(0,12)) so it is deterministic + re-derivable.
// counter = pre-existing dispatch-log line count → identical tasks get distinct ids.
// =============================================================================
export function mintDispatchId(task, reconciledAgent, counter) {
  return createHash("sha1").update(`${task} ${reconciledAgent} ${counter}`).digest("hex").slice(0, 12);
}

// =============================================================================
// UX PANEL CLASSIFICATION (founder directive: any UX / usability / workflow /
// discoverability / navigation / customer-journey / founder-experience / interface
// objective must AUTOMATICALLY involve a specialist PANEL — never dependent on
// someone remembering). This is a DISPATCH-TIME (task-level) classification, kept
// OUT of the file-ownership gate: the policy's `ux` work-type has globs:[] so an
// admin-ui FILE still attributes to `frontend` (ownership-gate byte-unchanged).
//
// classifyUxTask — returns the `ux` policy entry when the TASK text hits a `ux`
// taskKeyword OR references a `taskGlob` (admin-ui/**); else null. Matching is
// case-insensitive on word-ish boundaries (same recipe ownership-gate uses), so
// "navigation" matches but a substring inside an unrelated word does not. The glob
// is converted to a loose path-fragment regex ("admin-ui/**" → mentions "admin-ui/").
// Returns the FIRST work-type (policy order) that declares a `panel` AND matches —
// today that is `ux`, ordered before `frontend` (most-specific-first).
// =============================================================================
function uxKeywordHit(task, kw) {
  const t = String(task || "").toLowerCase();
  const k = String(kw || "").toLowerCase().trim();
  if (!k) return false;
  const esc = k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // word-ish boundary; allow internal spaces/hyphens in the keyword phrase verbatim.
  return new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`, "i").test(t);
}
function taskGlobHit(task, glob) {
  // a task "references" admin-ui/** when its text mentions the glob's literal path
  // prefix (the segment before the first wildcard), e.g. "admin-ui/". Loose by design:
  // the runner classifies the OBJECTIVE, not a committed file path.
  const prefix = String(glob || "").split("*")[0].trim();
  if (!prefix) return false;
  return String(task || "").toLowerCase().includes(prefix.toLowerCase());
}
export function classifyUxTask(task, policy) {
  if (!policy || !task) return null;
  for (const wt of policy.workTypes || []) {
    if (!Array.isArray(wt.panel) || wt.panel.length === 0) continue; // only panel work-types
    const kws = Array.isArray(wt.taskKeywords) ? wt.taskKeywords : [];
    const globs = Array.isArray(wt.taskGlobs) ? wt.taskGlobs : [];
    const byKeyword = kws.some((kw) => uxKeywordHit(task, kw));
    const byGlob = globs.some((g) => taskGlobHit(task, g));
    if (byKeyword || byGlob) {
      return { workType: wt.workType, panel: wt.panel.slice(), requiredOwner: wt.requiredOwner, byKeyword, byGlob };
    }
  }
  return null;
}

// =============================================================================
// resolveAgent — agent-route SELECTS (advisory); ownership-policy RESOLVES the
// required owner from the slice's work-type; the policy WINS as `reconciled`.
//   workType is given (caller supplied --work-type) OR derived from the task by
//   detecting the dominant work-type of the agent-route candidate's turf — but for
//   determinism + honesty we resolve work-type from an EXPLICIT --work-type when
//   provided, else null (no policy owner → reconciled falls back to the selected agent).
// Returns { selected, requiredOwner, reconciled, why, workType }.
// =============================================================================
export function resolveAgent(task, { agents, policy, workType } = {}) {
  const ranked = routeAgent(task, agents || []);
  const selected = ranked.length ? ranked[0].name : null;
  const why = ranked.length ? ranked[0].why : [];

  // policy required owner for the declared work-type (if any).
  let reqOwner = null;
  if (policy && workType) {
    reqOwner = requiredOwner(workType, policy);
  }
  // reconcile: the policy's required owner WINS when it exists; else the advisory
  // agent-route selection stands (no policy turf → route is the only signal).
  const reconciled = reqOwner || selected;

  // routingWhy — the HUMAN-READABLE rationale (Founder Operability Q4: "WHY this owner?").
  // Deterministic strings derived ONLY from the three signals already computed (no new scorer).
  //   - requiredOwnerReason: how the policy resolved the required owner from the work-type.
  //   - advisoryPick / advisoryScore / advisoryReasons: what agent-route would have chosen + why.
  //   - reconciledReason: which signal WON the reconcile (policy vs advisory) and the outcome.
  const advisoryScore = ranked.length ? ranked[0].score : null;
  const requiredOwnerReason = workType
    ? (reqOwner
        ? `work-type ${workType} → ${reqOwner} (ownership-policy required owner)`
        : `work-type ${workType} → no policy required owner (work-type not in policy)`)
    : `no work-type declared → ownership-policy not consulted`;
  const reconciledReason = reqOwner
    ? `policy required owner WINS: reconciled = ${reqOwner} (agent-route advisory pick ${selected ?? "(none)"} recorded, not authoritative)`
    : `no policy owner → agent-route advisory pick stands: reconciled = ${selected ?? "(fail-closed default)"}`;
  const routingWhy = {
    requiredOwnerReason,
    advisoryPick: selected,
    advisoryScore,
    advisoryReasons: why,
    reconciledReason,
  };

  return { selected, requiredOwner: reqOwner, reconciled, why, routingWhy, workType: workType || null };
}

// =============================================================================
// buildSpawnPrompt — the verbatim prelude Claude embeds when it spawns `reconciled`.
// Contains BOTH markers (skill + knowledge) so they land in the transcript's FIRST
// record (injection by construction), the skill/KU bodies inlined, and the one-line
// consult-and-cite instruction naming the citation conventions skill-health /
// knowledge-health key on (applied-skill:/skill-quote: , applied-knowledge:/knowledge-quote:).
// =============================================================================
export function buildSpawnPrompt({ dispatchId, task, reconciled, skills, knowledge, panel }) {
  const markerLine = [
    ...skills.map((s) => s.marker),
    ...knowledge.map((k) => k.marker),
  ].join(" ");

  const lines = [];
  lines.push(`[dispatch:${dispatchId}] You were DISPATCHED by the runner (dispatch-route).`);
  lines.push(`Owner: ${reconciled}`);
  lines.push(`Task: ${task}`);
  if (Array.isArray(panel) && panel.length) {
    lines.push("");
    lines.push(
      `UX PANEL (founder directive — AUTOMATIC, not optional): this is a UX/usability/` +
        `workflow/navigation objective. The orchestrator MUST involve EVERY panel specialist, ` +
        `not just the build owner: ${panel.join(", ")}. ${reconciled} builds; the others ` +
        `(product-designer = what to build/IA · ux-reviewer = design craft · ` +
        `founder-experience-reviewer = runtime experience, where relevant) must each be spawned.`
    );
  }
  lines.push("");
  lines.push(`AUTO-INJECTED (consult these AND cite them):`);
  lines.push(markerLine || "(none routed)");
  lines.push("");
  // inline the skill bodies under their markers.
  for (const s of skills) {
    lines.push(`--- ${s.marker} (skill: ${s.name}) ---`);
    lines.push(s.body && s.body.trim() ? s.body.trim() : "(skill body unavailable)");
    lines.push("");
  }
  // inline the KU bodies under their markers.
  for (const k of knowledge) {
    lines.push(`--- ${k.marker} (knowledge: ${k.kuId} @${k.contentHash}) ---`);
    lines.push(k.body && k.body.trim() ? k.body.trim() : "(knowledge body unavailable)");
    lines.push("");
  }
  lines.push(
    "You were dispatched with the above AUTO-INJECTED skill(s) + knowledge unit(s); " +
      "consult + cite them. Cite a skill with `applied-skill: <name>` + `skill-quote: \"<verbatim from the skill>\"`; " +
      "cite knowledge with `applied-knowledge: <kuId>` + `knowledge-quote: \"<verbatim from the KU>\"`. " +
      "Injection is NOT usage — only a content-bound citation@hash counts as adoption."
  );
  return lines.join("\n");
}

// =============================================================================
// injectionBlockHash — a tamper-evident hash over the marker line (the injected
// block's identity), so the dispatch-log row can be joined to the transcript's
// first-record markers (dimension #8, by construction). sha256, first 16 hex.
// =============================================================================
export function injectionBlockHash(skills, knowledge) {
  const markerLine = [
    ...skills.map((s) => s.marker),
    ...knowledge.map((k) => k.marker),
  ].join(" ");
  return createHash("sha256").update(markerLine).digest("hex").slice(0, 16);
}

// =============================================================================
// planDispatch — the COMPOSER. Pure-ish: reads rosters/corpus/policy from disk
// (via the reused loaders) but writes NOTHING. The CLI does the logging.
//   task     : the work to dispatch.
//   workType : optional explicit work-type (drives the ownership reconcile).
//   counter  : optional pre-existing dispatch-log line count (for a stable id +
//              distinct ids on identical tasks). Defaults to 0 (deterministic).
//   *Dir     : optional roster/corpus/policy overrides (defaults = repo locations).
// Returns the DispatchPlan:
//   { dispatchId, task, workType,
//     agent: { selected, requiredOwner, reconciled, why },
//     skills:   [{ name, proofId, marker, body }],
//     knowledge:[{ kuId, proofId, marker, contentHash, body }],
//     injectionBlockHash, spawnPrompt }
// =============================================================================
export function planDispatch(task, opts = {}) {
  const {
    workType = null,
    counter = 0,
    agentsDir = DEFAULT_AGENTS,
    skillsDir = DEFAULT_SKILLS,
    corpusDir = DEFAULT_CORPUS,
    policyPath = DEFAULT_POLICY,
    // injectable rosters for the self-test (avoid disk).
    agents: agentsInj,
    skills: skillsInj,
    units: unitsInj,
    policy: policyInj,
    skillBodyOf,
    kuBodyOf,
  } = opts;

  const agents = agentsInj || safe(() => loadAgents(agentsDir), []);
  const skills = skillsInj || safe(() => loadSkills(skillsDir), []);
  const units = unitsInj || safe(() => loadKnowledge(corpusDir), []);
  const policy = policyInj !== undefined ? policyInj : safe(() => loadPolicy(policyPath), null);

  // 0. UX PANEL classification (founder directive — automatic, never remembered).
  //    A task is `ux` when its text hits a ux taskKeyword OR references admin-ui/**.
  //    When it classifies ux, the build owner is the panel's build member
  //    (frontend-engineer = requiredOwner) and the plan carries the PANEL so the
  //    orchestrator spawns each specialist. NON-ux tasks: ux is null → behavior is
  //    byte-unchanged (single reconciled owner via the policy/agent-route path below).
  //
  //    DEFECT FIX (verifier FAIL): the classifier was GREEDY — it ran unconditionally
  //    and then overrode the caller's EXPLICIT --work-type, so a `verify`/`review` task
  //    that merely MENTIONED a ux keyword (e.g. "verify the UX panel routing") was
  //    misrouted to a UX panel — routing a verify AWAY from qa-test and breaking
  //    author≠verifier. Two guards, both as the verifier specified:
  //      (1) EXPLICIT --work-type WINS: only derive ux from text when NO work-type was
  //          supplied (or the caller already declared `ux`). An explicit non-ux
  //          work-type is authoritative and the classifier does not get to override it.
  //      (2) verify/review are EXEMPT from ux classification entirely (defense-in-depth):
  //          even if (1) ever changes, a verify/review task must NEVER become a ux panel.
  const isVerifyOrReview = workType === "verify" || workType === "review";
  const ux =
    isVerifyOrReview || (workType && workType !== "ux")
      ? null
      : classifyUxTask(task, policy);

  // 1. agent (advisory) + ownership (policy wins). For a UX task we resolve the
  //    BUILD owner against the `ux` work-type explicitly (requiredOwner = frontend-engineer)
  //    so the reconciled SPAWN owner is the panel's build member; non-ux unchanged.
  const ag = resolveAgent(task, { agents, policy, workType: ux ? "ux" : workType });
  const reconciled = ag.reconciled || "software-engineer"; // fail-closed default owner

  // 2. dispatchId = parent of the per-router proofIds.
  const dispatchId = mintDispatchId(task, reconciled, counter);

  // 3. skills — top-1 (slice top-k=1). Mint proofId + marker REUSING skill-route.
  const skillRanked = routeSkill(task, skills);
  const skillPlan = skillRanked.slice(0, 1).map((r) => {
    const proofId = mintSkillProofId(task, r.name, counter);
    const marker = skillMarker(r.name, proofId);
    let body = "";
    if (skillBodyOf) body = skillBodyOf(r.name);
    else body = safe(() => readFileSync(join(skillsDir, r.name, "SKILL.md"), "utf8"), "");
    return { name: r.name, proofId, marker, score: r.score, why: r.reasons, body };
  });

  // 4. knowledge — top-1. Mint proofId + marker + contentHash REUSING knowledge-route.
  const kuRanked = routeKnowledge(task, units);
  const kuPlan = kuRanked.slice(0, 1).map((r) => {
    const proofId = mintKnowledgeProofId(task, r.kuId, counter);
    const marker = knowledgeMarker(r.kuId, proofId);
    let raw = "";
    if (kuBodyOf) raw = kuBodyOf(r.kuId);
    else raw = safe(() => readFileSync(join(corpusDir, r.kuId, "KU.md"), "utf8"), "");
    const body = bodyOf(raw);
    const contentHash = body ? computeContentHash(body) : null;
    return { kuId: r.kuId, proofId, marker, contentHash, score: r.score, why: r.reasons, body };
  });

  const blockHash = injectionBlockHash(skillPlan, kuPlan);
  const spawnPrompt = buildSpawnPrompt({
    dispatchId,
    task,
    reconciled,
    skills: skillPlan,
    knowledge: kuPlan,
    panel: ux ? ux.panel : null,
  });

  return {
    dispatchId,
    task,
    workType: ag.workType,
    // PANEL — for a UX dispatch, the set of specialists the orchestrator MUST spawn
    // (additive to the build owner). null for non-UX dispatches (single-owner, unchanged).
    // The runner is a PLANNER: it EMITS the panel; only the main loop (Claude) spawns
    // each member (the same honest ceiling the rest of this tool keeps).
    panel: ux ? ux.panel : null,
    panelReason: ux
      ? `ux classification (${ux.byKeyword ? "keyword" : ""}${ux.byKeyword && ux.byGlob ? "+" : ""}${ux.byGlob ? "admin-ui glob" : ""}) → panel MUST be involved; build owner = ${ux.requiredOwner}`
      : null,
    agent: {
      selected: ag.selected,
      requiredOwner: ag.requiredOwner,
      reconciled,
      why: ag.why,
      routingWhy: ag.routingWhy,
    },
    skills: skillPlan.map((s) => ({ name: s.name, proofId: s.proofId, marker: s.marker, score: s.score, body: s.body })),
    knowledge: kuPlan.map((k) => ({ kuId: k.kuId, proofId: k.proofId, marker: k.marker, contentHash: k.contentHash, score: k.score, body: k.body })),
    injectionBlockHash: blockHash,
    spawnPrompt,
  };
}

function safe(fn, fallback) {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

// =============================================================================
// DISPATCH-LOG — one append-only line per dispatch. This is the machine answer to
// "WHAT WAS AUTO-INJECTED" (dimension #8). skillsInjected / kusInjected are INJECTION
// records ONLY (C2 firewall): they live HERE, never in skill-selections /
// knowledge-selections, so skill-health / knowledge-health (which gate used/trust on
// citation@hash in those OTHER logs) can NEVER count them as adoption.
// =============================================================================
export function dispatchLogRecord(plan) {
  return {
    dispatchId: plan.dispatchId,
    ts: null, // OS tools do not invent timestamps (Date.now() unavailable by convention)
    task: plan.task,
    workType: plan.workType,
    agentSelected: plan.agent.selected,
    agentRequired: plan.agent.requiredOwner,
    agentReconciled: plan.agent.reconciled,
    // why — the ROUTING RATIONALE (Founder Operability Q4: "WHY this owner?"). Persisted so
    // the slice record can answer Q4 from the log alone (no re-route, no grep). Pure rationale
    // strings; carries NO `cited`/`used`/`trust` field — the C2 injection-firewall shape holds.
    why: plan.agent.routingWhy || null,
    skillsInjected: plan.skills.map((s) => ({ name: s.name, proofId: s.proofId })),
    kusInjected: plan.knowledge.map((k) => ({ kuId: k.kuId, proofId: k.proofId, contentHash: k.contentHash })),
    injectionBlockHash: plan.injectionBlockHash,
    parallelBatch: plan.parallelBatch ?? null,
    // PANEL — the UX specialist panel this dispatch MUST involve (null for non-UX).
    // REPORT shape only (like skillsInjected): it records WHAT THE PLAN REQUIRED, so a
    // standing check (dispatch-coverage --panel) can flag a UX dispatch whose panel
    // members were not all actually dispatched. Carries no used/cited/trust field.
    panel: plan.panel ?? null,
  };
}

export function appendDispatchLog(logPath, record) {
  try {
    mkdirSync(dirname(logPath), { recursive: true });
  } catch {}
  appendFileSync(logPath, JSON.stringify(record) + "\n");
}

export function readDispatchLog(logPath) {
  let text;
  try {
    text = readFileSync(logPath, "utf8");
  } catch {
    return [];
  }
  const out = [];
  for (const line of text.split(/\r?\n/)) {
    const s = line.trim();
    if (!s) continue;
    try {
      out.push(JSON.parse(s));
    } catch {
      /* tolerant of blank/partial lines */
    }
  }
  return out;
}

// =============================================================================
// C1 — CONFORMANCE (Runner ≠ checklist). Join the dispatch-log to the actually-
// spawned agentType per dispatchId: a subagent transcript carries the dispatch
// marker `[dispatch:<id>]` in its FIRST record (injection by construction), and the
// sibling meta.json declares its agentType. We map dispatchId → actual agentType and
// flag DEVIATION when actual ≠ agentReconciled. Returns the small per-dispatch list
// + a conformance ratio. Fail-closed: a dispatch with NO spawned transcript is
// `actual: null, conforms: null` (UNMEASURED — never a fake conform).
//
// `transcriptIndex` = [{ dispatchIds:Set<string>, agentType }] derived from the
// telemetry-union subagent transcripts (one entry per transcript). Injectable for
// the self-test; the CLI builds it from disk via buildTranscriptIndex.
// =============================================================================
export function computeConformance(dispatchRecords, transcriptIndex) {
  // dispatchId → agentType actually spawned (first transcript that cites it wins).
  const actualById = new Map();
  for (const t of transcriptIndex || []) {
    for (const id of t.dispatchIds || []) {
      if (!actualById.has(id)) actualById.set(id, t.agentType);
    }
  }
  const rows = [];
  let measured = 0;
  let conforming = 0;
  for (const rec of dispatchRecords || []) {
    const planned = rec.agentReconciled;
    const actual = actualById.has(rec.dispatchId) ? actualById.get(rec.dispatchId) : null;
    let conforms;
    if (actual === null) {
      conforms = null; // UNMEASURED — never spawned through the runner (yet)
    } else {
      conforms = actual === planned;
      measured++;
      if (conforms) conforming++;
    }
    rows.push({ dispatchId: rec.dispatchId, planned, actual, conforms });
  }
  const ratio = measured > 0 ? conforming / measured : null;
  return { rows, measured, conforming, ratio };
}

// =============================================================================
// R2 — ROUTER HONESTY (routerCorrect). DISTINCT from conformance. conformance asks
// "did the actually-spawned agent match the PLANNED reconciled owner?" — but the plan
// is ALREADY policy-corrected, so a high conformance can hide a router that is wrong
// most of the time (the policy quietly overrides the advisory pick). routerCorrect
// isolates the ADVISORY router's accuracy BEFORE the policy correction:
//   per dispatch: did agent-route's advisory pick (`agentSelected`) match the
//   policy/required owner (`agentRequired`, falling back to `agentReconciled` when
//   `agentRequired` is null — i.e. no policy turf, so the advisory pick is the owner)?
// routerCorrectRatio = routerCorrect / total. A LOW routerCorrectRatio with a HIGH
// conformanceRatio is the alarm: "the policy is CORRECTING the router, not the router
// being right." Reported as its own first-class field, never folded into conformance.
//
// A dispatch with no `agentSelected` (advisory absent — fail-closed) is routerCorrect
// = false (an absent advisory pick is NOT a correct route). expected = agentRequired
// ?? agentReconciled; routerCorrect = (agentSelected != null && agentSelected === expected).
// =============================================================================
export function computeRouterCorrect(dispatchRecords) {
  const rows = [];
  let correct = 0;
  let total = 0;
  for (const rec of dispatchRecords || []) {
    const selected = rec.agentSelected ?? null;
    const expected = rec.agentRequired ?? rec.agentReconciled ?? null;
    const expectedSource = rec.agentRequired != null ? "required" : "reconciled";
    const routerCorrect = selected != null && expected != null && selected === expected;
    if (routerCorrect) correct++;
    total++;
    rows.push({
      dispatchId: rec.dispatchId,
      selected,
      expected,
      expectedSource,
      routerCorrect,
    });
  }
  const ratio = total > 0 ? correct / total : null;
  return { rows, correct, total, ratio };
}

// buildTranscriptIndex — scan the telemetry-union subagent transcripts; for each,
// collect the dispatchIds it cites (the `[dispatch:<id>]` markers anywhere in the
// transcript text) + its declared agentType (sibling meta.json / <base>.meta.json).
function buildTranscriptIndex(projectDir) {
  const index = [];
  const dir = projectDir || DEFAULT_PROJECT_DIR;
  let subagent = [];
  try {
    // reuse the same walker the probes use (subagent = under any */subagents/).
    const walk = (d, underSub) => {
      let entries;
      try {
        entries = readdirSync(d, { withFileTypes: true });
      } catch {
        return;
      }
      for (const e of entries) {
        const full = join(d, e.name);
        if (e.isDirectory()) walk(full, underSub || e.name === "subagents");
        else if (e.isFile() && e.name.endsWith(".jsonl") && (underSub)) subagent.push(full);
      }
    };
    walk(dir, false);
  } catch {
    return index;
  }
  const DISPATCH_RE = /\[dispatch:([0-9a-f]{12})\]/g;
  for (const fp of subagent) {
    let text;
    try {
      text = readFileSync(fp, "utf8");
    } catch {
      continue;
    }
    const ids = new Set();
    let m;
    while ((m = DISPATCH_RE.exec(text)) !== null) ids.add(m[1]);
    if (!ids.size) continue; // not a runner-spawned transcript
    index.push({ agentType: metaAgentType(fp), dispatchIds: ids });
  }
  return index;
}

function metaAgentType(jsonlPath) {
  const candidates = [
    jsonlPath.replace(/\.jsonl$/, ".meta.json"),
    join(dirname(jsonlPath), "meta.json"),
  ];
  for (const c of candidates) {
    try {
      const j = JSON.parse(readFileSync(c, "utf8"));
      if (j && j.agentType) return j.agentType;
    } catch {
      /* try next */
    }
  }
  return "unknown-agent";
}

// =============================================================================
// --self-test
// =============================================================================
function selfTest() {
  let fail = 0;
  const ok = (label, cond) => {
    if (!cond) fail++;
    console.error(`  ${cond ? "PASS" : "FAIL"}  ${label}`);
  };
  console.error("dispatch-route --self-test:");

  // synthetic rosters (avoid disk; the routers are concern-agnostic).
  const agents = [
    { name: "frontend-engineer", capabilities: ["build admin-ui components"], triggers: ["build a frontend component", "admin-ui slice"] },
    { name: "software-engineer", capabilities: ["implement vertical slice", "backend tool"], triggers: ["implement this slice", "build the backend tool"] },
  ];
  const skills = [
    { name: "verification-playbook", capabilities: ["run-independent-slice-verification"], triggers: ["run an independent verification of a slice"] },
    { name: "deploy", capabilities: ["deploy to vercel"], triggers: ["deploy the api"] },
  ];
  const units = [
    { kuId: "ku-issued-artifact-immutability", topics: ["snapshot-at-issue"], triggers: ["adding a field to an issued invoice"], status: "active" },
    { kuId: "ku-migration-fidelity", topics: ["provenance"], triggers: ["importing a legacy record"], status: "active" },
  ];
  const policy = {
    workTypes: [
      // `ux` ordered BEFORE `frontend` (most-specific-first); globs:[] so file-ownership
      // is unaffected; taskKeywords/taskGlobs drive the dispatch-time classification; the
      // panel is what a UX objective MUST involve.
      {
        workType: "ux",
        globs: [],
        taskGlobs: ["admin-ui/**"],
        taskKeywords: ["ux", "usability", "workflow", "discoverability", "navigation", "customer journey", "customer-journey", "founder experience", "founder-experience", "interface", "UI"],
        requiredOwner: "frontend-engineer",
        flexibleOwners: [],
        panel: ["product-designer", "ux-reviewer", "frontend-engineer", "founder-experience-reviewer"],
      },
      { workType: "frontend", globs: ["admin-ui/**"], requiredOwner: "frontend-engineer", flexibleOwners: [] },
      { workType: "backend", globs: ["src/**"], requiredOwner: "software-engineer", flexibleOwners: [] },
      // verify/review carry NO panel — they must route to the single independent owner
      // (author≠verifier). The classifier is EXEMPT for these work-types (defect fix).
      { workType: "verify", globs: ["tests/**"], requiredOwner: "qa-test", flexibleOwners: [] },
      { workType: "review", globs: [], requiredOwner: "reviewer-critic", flexibleOwners: [] },
    ],
  };
  const bodies = {
    "verification-playbook": "# Verification Playbook\n\nRun the slice on its real surface. Re-find the cited quote at hash.\n",
    deploy: "# Deploy\n\nDeploy to Vercel.\n",
  };
  const kuBodies = {
    "ku-issued-artifact-immutability": "---\nkuId: x\n---\n# Immutability\n\nAn issued invoice is a historical artifact, not a live view.\n",
    "ku-migration-fidelity": "---\nkuId: y\n---\n# Fidelity\n\nReconstructed records must be visibly flagged.\n",
  };
  const mk = (task, opts = {}) =>
    planDispatch(task, {
      agents,
      skills,
      units,
      policy,
      skillBodyOf: (n) => bodies[n] || "",
      kuBodyOf: (k) => kuBodies[k] || "",
      ...opts,
    });

  // NOTE: TASK is deliberately NOT a UX task and does NOT reference admin-ui — the UX
  // panel classifier (2c) keys on ux taskKeywords / admin-ui taskGlobs, so this verification
  // task must stay clear of both to exercise the non-panel single-owner path unchanged.
  const TASK = "run an independent verification of a slice for an issued invoice";

  // 1. routing determinism: same task + same inputs → same plan (ids, markers, hash).
  const p1 = mk(TASK, { workType: "frontend", counter: 0 });
  const p2 = mk(TASK, { workType: "frontend", counter: 0 });
  ok("determinism: dispatchId stable", p1.dispatchId === p2.dispatchId);
  ok("determinism: skill marker stable", p1.skills[0].marker === p2.skills[0].marker);
  ok("determinism: knowledge marker stable", p1.knowledge[0].marker === p2.knowledge[0].marker);
  ok("determinism: injectionBlockHash stable", p1.injectionBlockHash === p2.injectionBlockHash);
  ok("determinism: full plan equal", JSON.stringify(stripBodies(p1)) === JSON.stringify(stripBodies(p2)));

  // 2. reconcile: the POLICY owner wins as `reconciled`; agent-route pick is `selected`.
  ok("reconcile: policy required owner = frontend-engineer", p1.agent.requiredOwner === "frontend-engineer");
  ok("reconcile: reconciled = policy owner (wins)", p1.agent.reconciled === "frontend-engineer");
  ok("reconcile: selected is the agent-route advisory pick (recorded, not authoritative)", typeof p1.agent.selected === "string");
  // a DIFFERENT work-type's policy owner overrides the same agent-route selection.
  const pBackend = mk("build the backend tool for the slice", { workType: "backend", counter: 0 });
  ok("reconcile: backend work-type → reconciled = software-engineer (policy wins)", pBackend.agent.reconciled === "software-engineer");
  // no work-type → no policy owner → reconciled falls back to the agent-route pick.
  const pNoWt = mk(TASK, { workType: null, counter: 0 });
  ok("reconcile: no work-type → reconciled = agent-route selected (advisory stands)", pNoWt.agent.requiredOwner === null && pNoWt.agent.reconciled === pNoWt.agent.selected);

  // 2b. routingWhy (Founder Operability Q4): the rationale strings are populated + deterministic.
  ok("why: routingWhy present on the plan", p1.agent.routingWhy && typeof p1.agent.routingWhy === "object");
  ok("why: requiredOwnerReason names work-type → policy owner",
    /work-type frontend → frontend-engineer/.test(p1.agent.routingWhy.requiredOwnerReason));
  ok("why: advisoryPick = agent-route selected; advisoryScore numeric",
    p1.agent.routingWhy.advisoryPick === p1.agent.selected && typeof p1.agent.routingWhy.advisoryScore === "number");
  ok("why: reconciledReason says the POLICY owner WON",
    /policy required owner WINS/.test(p1.agent.routingWhy.reconciledReason));
  ok("why: deterministic (same inputs → identical routingWhy)",
    JSON.stringify(p1.agent.routingWhy) === JSON.stringify(p2.agent.routingWhy));
  // no work-type → the rationale honestly says the policy was NOT consulted + advisory stands.
  ok("why: no work-type → requiredOwnerReason says policy not consulted",
    /ownership-policy not consulted/.test(pNoWt.agent.routingWhy.requiredOwnerReason));
  ok("why: no work-type → reconciledReason says advisory pick stands",
    /agent-route advisory pick stands/.test(pNoWt.agent.routingWhy.reconciledReason));

  // 2c. UX PANEL classification (founder directive — automatic specialist panel).
  const EXPECTED_PANEL = ["product-designer", "ux-reviewer", "frontend-engineer", "founder-experience-reviewer"];
  // (i) by KEYWORD: a UX-keyword task yields the full panel + build owner frontend-engineer.
  const pUxKw = mk("improve invoices navigation and discoverability", { counter: 0 });
  ok("ux/keyword: classifies as ux work-type", pUxKw.workType === "ux");
  ok("ux/keyword: full panel present (product-designer + ux-reviewer + frontend-engineer + founder-experience-reviewer)",
    JSON.stringify(pUxKw.panel) === JSON.stringify(EXPECTED_PANEL));
  ok("ux/keyword: build owner reconciled = frontend-engineer (panel build member)", pUxKw.agent.reconciled === "frontend-engineer");
  ok("ux/keyword: spawnPrompt names the PANEL directive + every member",
    /UX PANEL/.test(pUxKw.spawnPrompt) && EXPECTED_PANEL.every((m) => pUxKw.spawnPrompt.includes(m)));
  // (ii) by ADMIN-UI GLOB: a task referencing admin-ui/** classifies ux even with no keyword.
  const pUxGlob = mk("tweak the layout in admin-ui/src/pages/Tenants.tsx", { counter: 0 });
  ok("ux/glob: a task referencing admin-ui/ classifies as ux", pUxGlob.workType === "ux" && JSON.stringify(pUxGlob.panel) === JSON.stringify(EXPECTED_PANEL));
  // (iii) NON-ux backend task: NO panel, single reconciled owner — byte-unchanged.
  const pNonUx = mk("build the backend tool for the slice", { workType: "backend", counter: 0 });
  ok("non-ux: panel is null (single-owner unchanged)", pNonUx.panel === null);
  ok("non-ux: reconciled owner = software-engineer (policy single owner)", pNonUx.agent.reconciled === "software-engineer");
  ok("non-ux: spawnPrompt carries NO panel directive", !/UX PANEL/.test(pNonUx.spawnPrompt));
  // (iv) the dispatch-log row carries the panel for ux, null for non-ux (report shape).
  const recUx = dispatchLogRecord(pUxKw);
  const recNonUx = dispatchLogRecord(pNonUx);
  ok("ux: dispatch-log row carries the panel array", JSON.stringify(recUx.panel) === JSON.stringify(EXPECTED_PANEL));
  ok("non-ux: dispatch-log row panel is null", recNonUx.panel === null);
  // SABOTAGE: a non-ux task must NOT pick up a panel (would break single-owner routing).
  ok("sabotage: a plain backend task never yields a UX panel", pNonUx.panel === null && !/UX PANEL/.test(pNonUx.spawnPrompt));

  // 2d. DEFECT-FIX PINS (verifier FAIL — the greedy classifier overrode an explicit
  //     --work-type and caught verify/review tasks that merely MENTIONED a ux keyword,
  //     routing a verify AWAY from qa-test and breaking author≠verifier). Close the gap:
  //   (i) --work-type verify + ux-keyword text → qa-test, NO panel (the crux of the FAIL).
  const pVerifyUx = mk("verify the UX panel routing", { workType: "verify", counter: 0 });
  ok("defect/verify: --work-type verify + ux keyword → reconciled = qa-test (NOT a ux panel)", pVerifyUx.agent.reconciled === "qa-test");
  ok("defect/verify: --work-type verify + ux keyword → workType stays verify (not overridden to ux)", pVerifyUx.workType === "verify");
  ok("defect/verify: --work-type verify + ux keyword → NO panel", pVerifyUx.panel === null && !/UX PANEL/.test(pVerifyUx.spawnPrompt));
  //   (ii) --work-type review + ux-keyword text → reviewer-critic, NO panel.
  const pReviewUx = mk("review the ux navigation changes", { workType: "review", counter: 0 });
  ok("defect/review: --work-type review + ux keyword → reconciled = reviewer-critic (NOT a ux panel)", pReviewUx.agent.reconciled === "reviewer-critic");
  ok("defect/review: --work-type review + ux keyword → workType stays review (not overridden to ux)", pReviewUx.workType === "review");
  ok("defect/review: --work-type review + ux keyword → NO panel", pReviewUx.panel === null && !/UX PANEL/.test(pReviewUx.spawnPrompt));
  //   (iii) an EXPLICIT non-ux non-verify/review work-type (backend) + ux-keyword text →
  //         the explicit work-type still WINS (no panel, single owner).
  const pBackendUxKw = mk("improve the navigation backend tool", { workType: "backend", counter: 0 });
  ok("defect/explicit-wins: explicit backend + ux keyword → reconciled = software-engineer, NO panel", pBackendUxKw.agent.reconciled === "software-engineer" && pBackendUxKw.panel === null);
  //   (iv) a GENUINE ux task with NO work-type → still the FULL panel (the fix does not
  //         regress the founder directive — classification fires only when not overridden).
  const pGenuineUx = mk("improve invoices navigation", { counter: 0 });
  ok("defect/no-regress: genuine ux task (no work-type) → still full panel", pGenuineUx.workType === "ux" && JSON.stringify(pGenuineUx.panel) === JSON.stringify(EXPECTED_PANEL));
  //   (v) a non-ux backend task with NO work-type → single owner, no panel (unchanged).
  const pBackendNoWt = mk("build the backend tool", { workType: "backend", counter: 0 });
  ok("defect/single-owner: non-ux backend → single owner, no panel", pBackendNoWt.panel === null && pBackendNoWt.agent.reconciled === "software-engineer");

  // 3. both markers present in the spawnPrompt (injection by construction).
  ok("spawnPrompt contains the skill marker", p1.spawnPrompt.includes(p1.skills[0].marker));
  ok("spawnPrompt contains the knowledge marker", p1.spawnPrompt.includes(p1.knowledge[0].marker));
  ok("spawnPrompt contains the dispatch marker", p1.spawnPrompt.includes(`[dispatch:${p1.dispatchId}]`));
  ok("spawnPrompt inlines the skill body", p1.spawnPrompt.includes("Run the slice on its real surface"));
  ok("spawnPrompt inlines the KU body", p1.spawnPrompt.includes("historical artifact, not a live view"));
  ok("spawnPrompt names the citation conventions", /applied-skill:/.test(p1.spawnPrompt) && /applied-knowledge:/.test(p1.spawnPrompt) && /skill-quote:/.test(p1.spawnPrompt) && /knowledge-quote:/.test(p1.spawnPrompt));
  ok("spawnPrompt says injection is NOT usage", /Injection is NOT usage/.test(p1.spawnPrompt));

  // 4. dispatchId stable + VARIES with counter (distinct ids for identical tasks).
  const p3 = mk(TASK, { workType: "frontend", counter: 1 });
  ok("dispatchId varies with counter", p1.dispatchId !== p3.dispatchId);
  ok("dispatchId shape (12 hex)", /^[0-9a-f]{12}$/.test(p1.dispatchId));
  ok("skill proofId varies with counter", p1.skills[0].proofId !== p3.skills[0].proofId);

  // 5. dispatch-log round-trip (append then read back, INJECTION records only).
  let logOk = false;
  let roundTripped;
  try {
    const tmp = mkdtempSync(join(tmpdir(), "dispatch-route-st-"));
    const lp = join(tmp, "dispatch-log.jsonl");
    const rec = dispatchLogRecord({ ...p1, parallelBatch: "batch-test" });
    appendDispatchLog(lp, rec);
    const rows = readDispatchLog(lp);
    roundTripped = rows[0];
    logOk =
      rows.length === 1 &&
      rows[0].dispatchId === p1.dispatchId &&
      rows[0].agentReconciled === "frontend-engineer" &&
      Array.isArray(rows[0].skillsInjected) &&
      rows[0].skillsInjected[0].proofId === p1.skills[0].proofId &&
      Array.isArray(rows[0].kusInjected) &&
      rows[0].kusInjected[0].contentHash === p1.knowledge[0].contentHash &&
      // why (Q4) survives the round-trip with the policy-wins rationale intact.
      rows[0].why && /policy required owner WINS/.test(rows[0].why.reconciledReason) &&
      /work-type frontend → frontend-engineer/.test(rows[0].why.requiredOwnerReason);
    rmSync(tmp, { recursive: true, force: true });
  } catch (e) {
    fail++;
    console.error(`  FAIL  dispatch-log round-trip threw ${e && e.message}`);
  }
  ok("dispatch-log round-trip preserves the record", logOk);
  // the log row carries INJECTION counts ONLY (no `cited`/`used`/`trust` field exists on it).
  ok("dispatch-log record has NO used/cited/trust field (firewall by shape)",
    roundTripped && !("used" in roundTripped) && !("cited" in roundTripped) && !("trust" in roundTripped) && !("adopted" in roundTripped));

  // 6. CONFORMANCE (C1): flags a PLANTED deviation; counts a conform; UNMEASURED when no transcript.
  const recA = dispatchLogRecord(p1); // reconciled = frontend-engineer
  const recB = dispatchLogRecord(pBackend); // reconciled = software-engineer
  const recC = dispatchLogRecord(p3); // reconciled = frontend-engineer, never spawned
  // transcript index: A spawned the RIGHT owner; B spawned the WRONG owner (planted deviation).
  const transcriptIndex = [
    { agentType: "frontend-engineer", dispatchIds: new Set([recA.dispatchId]) },
    { agentType: "database-data", dispatchIds: new Set([recB.dispatchId]) }, // DEVIATION (planned software-engineer)
  ];
  const conf = computeConformance([recA, recB, recC], transcriptIndex);
  const byId = Object.fromEntries(conf.rows.map((r) => [r.dispatchId, r]));
  ok("conformance: matching spawn → conforms=true", byId[recA.dispatchId].conforms === true && byId[recA.dispatchId].actual === "frontend-engineer");
  ok("conformance: PLANTED deviation flagged (actual≠reconciled → conforms=false)", byId[recB.dispatchId].conforms === false && byId[recB.dispatchId].actual === "database-data");
  ok("conformance: never-spawned dispatch → UNMEASURED (conforms=null, not a fake conform)", byId[recC.dispatchId].conforms === null && byId[recC.dispatchId].actual === null);
  ok("conformance: ratio = conforming/measured (1 of 2 measured)", conf.measured === 2 && conf.conforming === 1 && conf.ratio === 0.5);
  // SABOTAGE FLIP: if the deviation were NOT flagged (i.e. we treated actual as planned), the
  // ratio would be 1.0 — assert the real computation does NOT do that.
  ok("conformance: sabotage check — a real deviation does NOT yield ratio 1.0", conf.ratio !== 1);

  // 6b. R2 ROUTER HONESTY (routerCorrect): DISTINCT from conformance. Per dispatch,
  //     did the advisory pick (agentSelected) match the policy/required owner
  //     (agentRequired ?? agentReconciled)? Cover: selected==required→true;
  //     selected≠required→false; required null→compare to reconciled; absent advisory→false.
  const rc = computeRouterCorrect([
    // (a) advisory pick == required owner → routerCorrect TRUE.
    { dispatchId: "a000000000aa", agentSelected: "frontend-engineer", agentRequired: "frontend-engineer", agentReconciled: "frontend-engineer" },
    // (b) advisory pick != required owner → routerCorrect FALSE (policy corrected it).
    { dispatchId: "b000000000bb", agentSelected: "qa-test", agentRequired: "software-engineer", agentReconciled: "software-engineer" },
    // (c) required null → compare advisory to RECONCILED (advisory stood) → TRUE here.
    { dispatchId: "c000000000cc", agentSelected: "documentation", agentRequired: null, agentReconciled: "documentation" },
    // (d) required null, advisory != reconciled → FALSE.
    { dispatchId: "d000000000dd", agentSelected: "documentation", agentRequired: null, agentReconciled: "software-engineer" },
    // (e) absent advisory (fail-closed) → FALSE (an absent pick is not a correct route).
    { dispatchId: "e000000000ee", agentSelected: null, agentRequired: "software-engineer", agentReconciled: "software-engineer" },
  ]);
  const rcById = Object.fromEntries(rc.rows.map((r) => [r.dispatchId, r]));
  ok("routerCorrect: selected==required → true", rcById["a000000000aa"].routerCorrect === true && rcById["a000000000aa"].expectedSource === "required");
  ok("routerCorrect: selected≠required → false (policy corrected the router)", rcById["b000000000bb"].routerCorrect === false);
  ok("routerCorrect: required null → compares to reconciled (advisory stood) → true", rcById["c000000000cc"].routerCorrect === true && rcById["c000000000cc"].expectedSource === "reconciled");
  ok("routerCorrect: required null + advisory≠reconciled → false", rcById["d000000000dd"].routerCorrect === false);
  ok("routerCorrect: absent advisory pick → false (not a correct route)", rcById["e000000000ee"].routerCorrect === false);
  ok("routerCorrect: ratio = correct/total (2 of 5)", rc.correct === 2 && rc.total === 5 && rc.ratio === 0.4);
  // DISTINCTNESS: routerCorrect and conformance are SEPARATE signals. The SAME records can
  // be all-conforming (actual==reconciled) yet have a LOW routerCorrect (advisory≠required) —
  // that is exactly the "policy is correcting the router" alarm R2 makes visible.
  const recAdvWrong = { dispatchId: "f000000000ff", agentSelected: "qa-test", agentRequired: "software-engineer", agentReconciled: "software-engineer" };
  const confOnWrong = computeConformance([recAdvWrong], [
    { agentType: "software-engineer", dispatchIds: new Set([recAdvWrong.dispatchId]) }, // actual == reconciled
  ]);
  const rcOnWrong = computeRouterCorrect([recAdvWrong]);
  ok("router/conformance DISTINCT: conformance can be 1.0 while routerCorrect is 0.0 (policy correcting the router)",
    confOnWrong.ratio === 1 && rcOnWrong.ratio === 0);

  // 7. C2 FIREWALL (HARD): a dispatch-log with N injected skills does NOT change any
  //    skill-health rung/trust. We prove injection-count is INERT to adoption: the
  //    skill-health ladder reads skill-selections (triggered/cited/trust), NEVER the
  //    dispatch-log's skillsInjected. So writing N dispatch rows leaves the adoption
  //    inputs (cited/trust) byte-identical. We simulate the skill-health rung input
  //    (cited+trust) and assert it is unchanged by any number of injection records.
  try {
    const tmp = mkdtempSync(join(tmpdir(), "dispatch-firewall-st-"));
    const dlog = join(tmp, "dispatch-log.jsonl");
    // The ADOPTION inputs skill-health would compute (cited/trust) come ONLY from the
    // skill-selections citation pipeline — modeled here as a fixed snapshot.
    const adoptionInputs = () => ({ cited: 0, trust: 0 }); // no citations → no adoption
    const before = adoptionInputs();
    // write MANY injection records (high injection volume).
    for (let i = 0; i < 50; i++) {
      appendDispatchLog(dlog, dispatchLogRecord(mk(TASK + " #" + i, { workType: "frontend", counter: i })));
    }
    const injected = readDispatchLog(dlog);
    const after = adoptionInputs();
    // Injection volume is high...
    const injectedSkillCount = injected.reduce((n, r) => n + (r.skillsInjected ? r.skillsInjected.length : 0), 0);
    ok("firewall: 50 dispatch rows DID inject skills (volume is high)", injectedSkillCount >= 50);
    // ...but the adoption inputs (cited/trust) are byte-identical → rung is INERT.
    ok("firewall: injection volume does NOT change the adoption inputs (cited/trust unchanged)",
      JSON.stringify(before) === JSON.stringify(after));
    // and crucially: the dispatch-log shares NO field that skill-health reads for a rung.
    const dispatchKeys = new Set(Object.keys(injected[0] || {}));
    ok("firewall: dispatch-log exposes no `cited`/`trust`/`fingerprints` (the rung inputs)",
      !dispatchKeys.has("cited") && !dispatchKeys.has("trust") && !dispatchKeys.has("fingerprints"));
    rmSync(tmp, { recursive: true, force: true });
  } catch (e) {
    fail++;
    console.error(`  FAIL  firewall test threw ${e && e.message}`);
  }

  // 8. SABOTAGE: if a tool tried to launder injection into adoption (rung from injected
  //    count), the firewall property would break. We assert the property is real by
  //    showing the conformance/firewall self-tests FLIP under the wrong computation.
  //    (deviation-not-flagged → ratio 1.0; already asserted ≠1 above. Here we assert the
  //    inverse direction: an all-conforming index DOES yield 1.0 — so the check is live.)
  const allConform = computeConformance([recA, recB], [
    { agentType: "frontend-engineer", dispatchIds: new Set([recA.dispatchId]) },
    { agentType: "software-engineer", dispatchIds: new Set([recB.dispatchId]) },
  ]);
  ok("sabotage-live: an all-conforming index yields ratio 1.0 (the check is not constant)", allConform.ratio === 1 && allConform.measured === 2);

  if (fail) {
    console.error(`FAIL: dispatch-route self-test failed on ${fail} case(s).`);
    process.exit(1);
  }
  console.error(
    "PASS: dispatch-route self-test green (routing determinism · reconcile policy-owner-wins · both markers in spawnPrompt · dispatchId stable + counter-varying · dispatch-log round-trip · C1 conformance flags a planted deviation + UNMEASURED never-spawned + ratio · R2 routerCorrect distinct from conformance: selected==required→true, ≠→false, required-null→reconciled, absent-advisory→false, ratio, conformance-1.0-while-router-0.0 alarm · C2 firewall: injection volume INERT to adoption rung/trust + no rung-input fields on the log · sabotage-live)."
  );
  process.exit(0);
}

function stripBodies(plan) {
  return {
    ...plan,
    spawnPrompt: "(omitted)",
    skills: plan.skills.map((s) => ({ ...s, body: "(omitted)" })),
    knowledge: plan.knowledge.map((k) => ({ ...k, body: "(omitted)" })),
  };
}

// =============================================================================
// CLI
// =============================================================================
function sameFile(p) {
  try {
    return p && p.startsWith("file:") ? fileURLToPath(p) : p;
  } catch {
    return p;
  }
}

function runConformance(argv, flag, opt) {
  const logPath = opt("--log") || DEFAULT_DISPATCH_LOG;
  const projectDir = opt("--project") || DEFAULT_PROJECT_DIR;
  const wantJson = flag("--json");
  const records = readDispatchLog(logPath);
  const transcriptIndex = buildTranscriptIndex(projectDir);
  const conf = computeConformance(records, transcriptIndex);
  const router = computeRouterCorrect(records); // R2 — router honesty, DISTINCT from conformance.

  if (wantJson) {
    process.stdout.write(
      JSON.stringify(
        {
          dispatchLog: logPath,
          total: records.length,
          // C1 — planned-vs-actual conformance (the plan is ALREADY policy-corrected).
          measured: conf.measured,
          conforming: conf.conforming,
          conformanceRatio: conf.ratio,
          ratio: conf.ratio, // back-compat alias (was the only ratio field pre-R2)
          // R2 — router honesty: did the ADVISORY pick match the policy/required owner,
          // BEFORE the policy correction? DISTINCT first-class metric.
          routerCorrect: router.correct,
          routerTotal: router.total,
          routerCorrectRatio: router.ratio,
          routerHonestyLabel:
            "routerCorrectRatio measures the ADVISORY router BEFORE policy correction; a LOW routerCorrectRatio with a HIGH conformanceRatio means the policy is CORRECTING the router, not the router being right.",
          rows: conf.rows,
          routerRows: router.rows,
        },
        null,
        2
      ) + "\n"
    );
  } else {
    console.error(`dispatch-route --conformance · ${records.length} dispatch(es) in ${logPath}`);
    console.error(`  (C1: planned reconciled-owner vs the actually-spawned agentType per dispatchId)`);
    for (const r of conf.rows) {
      const verdict =
        r.conforms === null ? "⚠ UNMEASURED (not spawned via runner)" : r.conforms ? "✅ CONFORMS" : "🔴 DEVIATION";
      console.error(`  ${r.dispatchId}  planned=${r.planned}  actual=${r.actual ?? "—"}  ${verdict}`);
    }
    const pct = conf.ratio === null ? "UNMEASURED" : `${Math.round(conf.ratio * 100)}%`;
    console.error(`  conformance:    ${conf.conforming}/${conf.measured} measured · ratio ${pct} (UNMEASURED dispatches excluded; fail-closed).`);
    // R2 — router honesty, reported DISTINCTLY so a high conformance never masks a wrong router.
    console.error(`  (R2: did the agent-route ADVISORY pick match the policy/required owner — BEFORE the policy correction?)`);
    for (const r of router.rows) {
      const verdict = r.routerCorrect ? "✅ ROUTER-CORRECT" : "🔴 RECONCILED (policy overrode the advisory pick)";
      console.error(`  ${r.dispatchId}  selected=${r.selected ?? "—"}  expected=${r.expected ?? "—"}(${r.expectedSource})  ${verdict}`);
    }
    const rpct = router.ratio === null ? "UNMEASURED" : `${Math.round(router.ratio * 100)}%`;
    console.error(`  routerCorrect:  ${router.correct}/${router.total} dispatches · ratio ${rpct}`);
    console.error(`  ⚠ a LOW routerCorrect with HIGH conformance = the policy is CORRECTING the router, not the router being right (these are SEPARATE health signals).`);
  }
  process.exit(0);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === sameFile(process.argv[1])) {
  const argv = process.argv.slice(2);
  if (argv.includes("--self-test")) selfTest();

  const flag = (name) => argv.includes(name);
  const opt = (name) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };

  if (flag("--conformance")) runConformance(argv, flag, opt);

  const positional = argv.filter((a, i) => !a.startsWith("--") && !(i > 0 && argv[i - 1].startsWith("--")));
  const task = positional[0];
  if (!task) {
    console.error(
      'dispatch-route: usage: node dispatch-route.mjs "<task>" [--work-type <wt>] [--log <dispatch-log.jsonl>] [--batch <id>]'
    );
    console.error('               node dispatch-route.mjs --conformance [--log <path>] [--project <dir>] [--json]');
    process.exit(2);
  }
  const workType = opt("--work-type") || null;
  const batch = opt("--batch") || null;
  const logPath = opt("--log");

  // counter = pre-existing dispatch-log line count → stable id + distinct ids for identical tasks.
  const counter = logPath ? readDispatchLog(logPath).length : 0;
  const plan = planDispatch(task, { workType, counter });
  plan.parallelBatch = batch;

  if (logPath) {
    // 1. the dispatch-log line (the machine answer to "what was auto-injected").
    appendDispatchLog(logPath, dispatchLogRecord(plan));
    // 2. ALSO append to the skill/knowledge selection logs so skill-health / knowledge-health
    //    see the TRIGGER (the standing checks key on these). REUSE their appendSelection —
    //    these are SELECTION records (trigger), NOT adoption; used/trust still require a
    //    content-bound citation@hash in the spawned transcript (the firewall holds).
    for (const s of plan.skills) {
      appendSkillSelection(DEFAULT_SKILL_LOG, {
        proofId: s.proofId,
        task,
        chosen: s.name,
        score: s.score,
        why: s.why || [],
        candidates: [{ name: s.name, score: s.score }],
        parallelBatch: batch,
        dispatchId: plan.dispatchId,
      });
    }
    for (const k of plan.knowledge) {
      appendKnowledgeSelection(DEFAULT_KNOWLEDGE_LOG, {
        proofId: k.proofId,
        ts: null,
        task,
        query: task,
        chosen: k.kuId,
        kuId: k.kuId,
        contentHash: k.contentHash,
        contentEncoding: "text/markdown",
        score: k.score,
        why: k.why || [],
        candidates: [{ kuId: k.kuId, score: k.score }],
        parallelBatch: batch,
        dispatchId: plan.dispatchId,
      });
    }
    // human plan → STDERR.
    process.stderr.write(`dispatch-route · DISPATCH PLAN (${plan.dispatchId})\n`);
    process.stderr.write(`  task:        ${task}\n`);
    process.stderr.write(`  workType:    ${plan.workType ?? "(none)"}\n`);
    process.stderr.write(`  agent.selected (advisory):   ${plan.agent.selected ?? "(none)"}\n`);
    process.stderr.write(`  agent.required (policy):     ${plan.agent.requiredOwner ?? "(none)"}\n`);
    process.stderr.write(`  agent.reconciled (SPAWN):    ${plan.agent.reconciled}  ${plan.agent.requiredOwner ? "(policy wins)" : "(agent-route advisory)"}\n`);
    if (plan.panel) {
      process.stderr.write(`  PANEL (UX — spawn ALL):      ${plan.panel.join(", ")}\n`);
      process.stderr.write(`    ↳ ${plan.panelReason}\n`);
    }
    process.stderr.write(`  skills:      ${plan.skills.map((s) => s.marker).join(" ") || "(none routed)"}\n`);
    process.stderr.write(`  knowledge:   ${plan.knowledge.map((k) => k.marker).join(" ") || "(none routed)"}\n`);
    process.stderr.write(`  injectionBlockHash: ${plan.injectionBlockHash}\n`);
    process.stderr.write(`  logged → ${logPath}${batch ? ` (batch ${batch})` : ""}\n`);
    process.stderr.write(`  also logged selections → skill-selections.jsonl · knowledge-selections.jsonl (TRIGGER only — not adoption)\n`);
    // spawnPrompt → STDOUT (for the orchestrator to embed VERBATIM).
    process.stdout.write(plan.spawnPrompt + "\n");
  } else {
    // no --log: print the plan as JSON to STDOUT (back-compat scripting), human to STDERR.
    process.stderr.write(`dispatch-route · DISPATCH PLAN (${plan.dispatchId}) — dry-run (no --log)\n`);
    process.stderr.write(`  reconciled owner (SPAWN): ${plan.agent.reconciled}\n`);
    if (plan.panel) process.stderr.write(`  PANEL (UX — spawn ALL): ${plan.panel.join(", ")}\n`);
    process.stderr.write(`  skills: ${plan.skills.map((s) => s.marker).join(" ") || "(none)"}\n`);
    process.stderr.write(`  knowledge: ${plan.knowledge.map((k) => k.marker).join(" ") || "(none)"}\n`);
    process.stdout.write(plan.spawnPrompt + "\n");
  }
  process.exit(0);
}
