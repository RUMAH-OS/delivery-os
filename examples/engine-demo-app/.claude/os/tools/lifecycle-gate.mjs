// =============================================================================
// Delivery OS — lifecycle-gate (v6 capability #16). Pure, zero-dependency.
// =============================================================================
// The seam-gate (#2) proves every EVENT correct; it cannot prove a LIFECYCLE
// correct. A founder thinks in business reality (a contract is active ->
// terminated -> reinstated), not events — the system must stay correct across the
// WHOLE reversible lifecycle, not only at individual event boundaries.
//
// This validator takes DECLARED business lifecycles (each transition + the event
// types it MUST emit, including inverse/undo transitions) plus the types ACTUALLY
// emitted when each transition was DRIVEN against the real running app, and proves
// the implementation faithfully realizes the declared lifecycle. It is the
// executable counterpart of "validate workflows, not just components".
//
// earned_from: LC-1 — `contract.terminated` existed, `contract.reinstated` did
//   not. Each event was individually correct (seam-gate green); the reversible
//   lifecycle was incorrect end-to-end. A missing inverse transition is invisible
//   to per-event validation — only a lifecycle-level check catches it.
//
// Rules per step:
//   1. faithfulness — every type in `expected[]` MUST appear in `emitted[]` (the
//      types actually drained when the step ran). A declared transition that stops
//      emitting its event (the LC-1 regression) FAILS here.
//   2. completeness — a state-mutating step (mutating !== false) MUST declare at
//      least one expected event, OR be explicitly `noEvent: "<reason>"`. A mutating
//      transition that produces NO fact is the LC-1 smell.
//   3. no-leak — no type in `forbidden[]` may appear in `emitted[]` (e.g. reinstate
//      must NOT re-emit contract.terminated).
//
// Zero deps on purpose: any repo's CI imports it without installing anything.
// =============================================================================

export const LIFECYCLE_GATE_VERSION = "v1";

const isArr = (v) => Array.isArray(v);

export function validateLifecycle(lc) {
  const violations = [];
  if (!lc || typeof lc !== "object" || !isArr(lc.steps)) {
    return { ok: false, violations: [`lifecycle "${(lc && lc.name) || "?"}": malformed (needs { name, steps:[] })`] };
  }
  for (const s of lc.steps) {
    const where = `${lc.name}/${s && s.name ? s.name : "?"}`;
    if (!s || typeof s !== "object") { violations.push(`${where}: malformed step`); continue; }
    const expected = isArr(s.expected) ? s.expected : [];
    const forbidden = isArr(s.forbidden) ? s.forbidden : [];
    const emitted = isArr(s.emitted) ? s.emitted : [];
    const mutating = s.mutating !== false; // default: a transition mutates state

    // 2. completeness — a mutating step must declare an event (or be explicitly noEvent).
    if (mutating && expected.length === 0 && !s.noEvent) {
      violations.push(`${where}: mutating transition declares NO expected event (LC-1 smell — declare its event, or set noEvent:"<reason>")`);
    }
    // 1. faithfulness — declared events must actually have been emitted.
    for (const t of expected) {
      if (!emitted.includes(t)) {
        violations.push(`${where}: declared lifecycle event "${t}" was NOT emitted when the transition ran (incomplete lifecycle — a real operator/founder/customer would experience a broken workflow)`);
      }
    }
    // 3. no-leak — forbidden events must not appear.
    for (const t of forbidden) {
      if (emitted.includes(t)) {
        violations.push(`${where}: forbidden event "${t}" WAS emitted (lifecycle leak — this transition must not produce it)`);
      }
    }
  }
  return { ok: violations.length === 0, violations };
}

export function validateLifecycles(lifecycles) {
  const violations = [];
  if (!isArr(lifecycles)) return { ok: false, violations: ["input is not an array of lifecycles"] };
  for (const lc of lifecycles) {
    const r = validateLifecycle(lc);
    for (const v of r.violations) violations.push(`[${(lc && lc.name) || "?"}] ${v}`);
  }
  return { ok: violations.length === 0, violations };
}

// =============================================================================
// CLI runner — `node lifecycle-gate.mjs [lifecycles.json]` or piped stdin.
// Exit: 0 = every declared transition faithfully realized · 1 = lifecycle
// violation(s) · 2 = usage/IO error. The producer repo drives the real lifecycles,
// fills each step's emitted[], and pipes the array here (the fail-closed gate).
// =============================================================================
import { fileURLToPath } from "node:url";

async function readStdin() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString("utf8");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolveArg(process.argv[1])) {
  const file = process.argv[2];
  const { readFileSync } = await import("node:fs");
  const raw = file ? readFileSync(file, "utf8") : await readStdin();
  let lifecycles;
  try { lifecycles = JSON.parse(raw); } catch (e) { console.error(`lifecycle-gate: input is not valid JSON (${e.message})`); process.exit(2); }
  const total = isArr(lifecycles) ? lifecycles.reduce((n, lc) => n + (isArr(lc.steps) ? lc.steps.length : 0), 0) : 0;
  const r = validateLifecycles(lifecycles);
  const names = isArr(lifecycles) ? lifecycles.map((lc) => lc && lc.name).filter(Boolean).join(", ") : "?";
  console.error(`lifecycle-gate · ${LIFECYCLE_GATE_VERSION} · ${isArr(lifecycles) ? lifecycles.length : 0} lifecycle(s) [${names}] · ${total} transition(s)`);
  if (r.ok) {
    console.error(`PASS: every declared transition (incl. inverses) faithfully realized.`);
    process.exit(0);
  }
  console.error(`FAIL: ${r.violations.length} lifecycle violation(s):`);
  for (const v of r.violations) console.error(`  - ${v}`);
  process.exit(1);
}

function resolveArg(p) {
  // argv[1] may be a plain path; normalize to a file URL path for comparison.
  try { return p.startsWith("file:") ? fileURLToPath(p) : p; } catch { return p; }
}
