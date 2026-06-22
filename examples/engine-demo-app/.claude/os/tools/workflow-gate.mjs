// =============================================================================
// Delivery OS — workflow-gate (v6 capability #16, cross-repo layer). Zero-dep.
// =============================================================================
// component-correctness  (seam-gate #2)      — each EVENT's shape is valid.
// lifecycle-completeness (lifecycle-gate #16) — each single-repo LIFECYCLE is whole.
// workflow-completeness  (THIS, #16 cross-repo) — an end-to-end BUSINESS WORKFLOW
//   that crosses the seam is proven end-to-end: the handoffs LINK (the id emitted on
//   the way out is the id referenced on the way back), every driven step succeeds,
//   and any step owned by a PEER repo is an EXPLICIT, tracked obligation — never a
//   silently-skipped gap and never faked green.
//
// The biggest v5 failures lived BETWEEN repos (Admin->PLOS, PLOS->Floor, Invoice->
// Delivery->Outcome). A per-repo gate cannot see them. This gate takes a workflow
// whose steps the producer repo DROVE (filling ok/link verdicts) and asserts:
//   1. driven steps (repo !== "peer") succeeded (ok === true).
//   2. cross-step LINKAGE holds — a step may assert link:{to, field, a, b} meaning
//      "the <field> I carry must equal the one step <to> produced" (the round-trip
//      identity, e.g. delivery.eventId === send.eventId). a !== b => broken seam.
//   3. completeness — every step is driven-ok OR a declared peer `obligation`. A
//      step that is neither is a silent gap (FAIL).
//
// A workflow with unmet peer obligations is reported `ok:true` but
// `fullyProven:false` (proven up to the seam boundary; the peer repo must
// conformance-prove its steps). HONEST scope — not a green fake.
// =============================================================================

export const WORKFLOW_GATE_VERSION = "v1";
const isArr = (v) => Array.isArray(v);

export function validateWorkflow(wf) {
  const violations = [];
  const obligations = [];
  if (!wf || typeof wf !== "object" || !isArr(wf.steps)) {
    return { ok: false, fullyProven: false, violations: [`workflow "${(wf && wf.name) || "?"}": malformed (needs { name, steps:[] })`], obligations };
  }
  for (const s of wf.steps) {
    const where = `${wf.name}/${s && s.name ? s.name : "?"}`;
    if (!s || typeof s !== "object") { violations.push(`${where}: malformed step`); continue; }
    const isPeer = s.repo === "peer" || typeof s.obligation === "string";
    if (isPeer) {
      if (!s.obligation) violations.push(`${where}: peer step must name its obligation (what the peer repo must conformance-prove)`);
      else obligations.push(`${where} [${s.repo || "peer"}]: ${s.obligation}`);
      continue; // a peer step is not driven here
    }
    // 1. driven step must have succeeded
    if (s.ok !== true) violations.push(`${where}: driven step did not succeed (ok=${JSON.stringify(s.ok)}${s.note ? `, ${s.note}` : ""})`);
    // 2. cross-step linkage (the seam round-trip identity)
    if (s.link) {
      const { to, field, a, b } = s.link;
      if (a === undefined || b === undefined) violations.push(`${where}: link to "${to}" missing values (a/b) for field "${field}"`);
      else if (a !== b) violations.push(`${where}: BROKEN seam linkage — ${field} (${JSON.stringify(a)}) != step "${to}".${field} (${JSON.stringify(b)}) — the handoff does not round-trip`);
    }
    // 3. completeness — a non-peer step that neither succeeded nor linked nor is marked noop
    if (s.ok === undefined && !s.link && !s.noop) {
      violations.push(`${where}: step has no verdict (no ok / link / obligation) — silent gap in the workflow`);
    }
  }
  return { ok: violations.length === 0, fullyProven: violations.length === 0 && obligations.length === 0, violations, obligations };
}

export function validateWorkflows(workflows) {
  const violations = [];
  const obligations = [];
  if (!isArr(workflows)) return { ok: false, fullyProven: false, violations: ["input is not an array of workflows"], obligations };
  let fully = true;
  for (const wf of workflows) {
    const r = validateWorkflow(wf);
    for (const v of r.violations) violations.push(`[${(wf && wf.name) || "?"}] ${v}`);
    for (const o of r.obligations) obligations.push(o);
    if (!r.fullyProven) fully = false;
  }
  return { ok: violations.length === 0, fullyProven: violations.length === 0 && fully, violations, obligations };
}

// --- CLI runner: `node workflow-gate.mjs [workflows.json]` or piped stdin ---
import { fileURLToPath } from "node:url";
async function readStdin() { const c = []; for await (const x of process.stdin) c.push(x); return Buffer.concat(c).toString("utf8"); }
function sameFile(p) { try { return p && p.startsWith("file:") ? fileURLToPath(p) : p; } catch { return p; } }

if (process.argv[1] && fileURLToPath(import.meta.url) === sameFile(process.argv[1])) {
  const file = process.argv[2];
  const { readFileSync } = await import("node:fs");
  const raw = file ? readFileSync(file, "utf8") : await readStdin();
  let workflows;
  try { workflows = JSON.parse(raw); } catch (e) { console.error(`workflow-gate: input is not valid JSON (${e.message})`); process.exit(2); }
  const r = validateWorkflows(workflows);
  const names = isArr(workflows) ? workflows.map((w) => w && w.name).filter(Boolean).join(", ") : "?";
  console.error(`workflow-gate · ${WORKFLOW_GATE_VERSION} · ${isArr(workflows) ? workflows.length : 0} workflow(s) [${names}]`);
  if (r.obligations.length) { console.error(`obligations (peer-repo conformance still required):`); for (const o of r.obligations) console.error(`  · ${o}`); }
  if (r.ok) {
    console.error(r.fullyProven ? `PASS: workflow(s) proven end-to-end (no open obligations).` : `PASS (partial): driven steps + seam linkage proven; ${r.obligations.length} peer obligation(s) remain — NOT fully proven until the peer repo conforms.`);
    process.exit(0);
  }
  console.error(`FAIL: ${r.violations.length} workflow violation(s):`);
  for (const v of r.violations) console.error(`  - ${v}`);
  process.exit(1);
}
