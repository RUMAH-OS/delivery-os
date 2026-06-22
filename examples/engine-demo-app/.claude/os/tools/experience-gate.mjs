// =============================================================================
// Delivery OS — experience-gate (v6 Track B: FOUNDER EXPERIENCE is the judge). Zero-dep.
// =============================================================================
// The correctness gates (seam/lifecycle/workflow) prove a thing is RIGHT. They do NOT
// prove it is USABLE. The failures the founder actually hit were experience failures:
// the Room offline, the mailbox taking 60s, the Advisor offline, frontend state not
// matching backend reality, a "feature that works yet feels broken". A 60s mailbox with
// perfect architecture STILL FAILS. This gate judges a founder-facing surface by the
// only standard that matters — "would I enjoy using this every day?" — reduced to the
// HARD, measurable part: it must be AVAILABLE, FAST (within a hard latency budget,
// regardless of why), STATE-CONSISTENT (UI state matches backend reality), and COMPLETE
// (usable data, not an empty/partial shell). Subjective "does it feel like Jarvis?" is
// the founder-experience-reviewer agent's layer ON TOP of this floor.
//
// earned_from: mailbox 50-60s load · Room unavailable · Advisor offline · ASK reporting
//   offline while exposing an active input (FV-2 state mismatch). All "technically work".
//
// A measurement: { surface, latencyMs, available, stateConsistent, complete, budgetMs? }
//   budgetMs defaults per `tier` (founder-facing surfaces are held to the strictest).
// =============================================================================

export const EXPERIENCE_GATE_VERSION = "v1";

// Hard budgets (ms) by tier. Founder-facing = the daily operating surfaces (Floor, Room,
// Mailbox, Company Health). Over budget => the experience is degraded/broken, PERIOD —
// the gate does not care about the architecture behind it.
export const BUDGETS = {
  "founder-facing": { good: 1500, acceptable: 4000 }, // > acceptable => BROKEN (the 60s lesson)
  "interactive": { good: 1000, acceptable: 2500 },
  "background": { good: 5000, acceptable: 15000 },
};

const isBool = (v) => typeof v === "boolean";

export function judgeSurface(m) {
  const reasons = [];
  const tier = m.tier || "founder-facing";
  const b = BUDGETS[tier] || BUDGETS["founder-facing"];
  const budget = typeof m.budgetMs === "number" ? m.budgetMs : b.acceptable;

  let verdict = "good";
  // availability + state-consistency + completeness are HARD booleans — any false => broken.
  if (m.available === false) { verdict = "broken"; reasons.push(`UNAVAILABLE — a founder who opens this gets nothing (Room-offline class)`); }
  if (m.stateConsistent === false) { verdict = "broken"; reasons.push(`STATE MISMATCH — UI state does not match backend reality (ASK-offline-but-input-enabled class)`); }
  if (m.complete === false) { verdict = verdict === "broken" ? "broken" : "degraded"; reasons.push(`INCOMPLETE — surface returned an empty/partial shell, not usable data`); }
  // latency vs the hard budget — over budget is a real experience failure regardless of cause.
  if (typeof m.latencyMs === "number") {
    if (m.latencyMs > budget) { verdict = "broken"; reasons.push(`TOO SLOW — ${m.latencyMs}ms > ${budget}ms budget (${tier}); a founder will not wait this every day (the 60s-mailbox lesson)`); }
    else if (m.latencyMs > b.good) { if (verdict === "good") verdict = "degraded"; reasons.push(`sluggish — ${m.latencyMs}ms > ${b.good}ms 'good' bar (acceptable but not delightful)`); }
  }
  return { surface: m.surface, verdict, latencyMs: m.latencyMs, budgetMs: budget, reasons };
}

// Fail-closed: ANY broken surface fails the gate. Degraded surfaces pass but are reported
// (so "acceptable but not delightful" stays visible — the bar is enjoyment, not mere "works").
export function judgeExperience(measurements) {
  const violations = [];
  const verdicts = [];
  if (!Array.isArray(measurements)) return { ok: false, verdicts, violations: ["input is not an array of surface measurements"] };
  for (const m of measurements) {
    if (!m || !m.surface) { violations.push(`measurement missing 'surface'`); continue; }
    if (!isBool(m.available)) violations.push(`${m.surface}: 'available' must be measured (boolean)`);
    const v = judgeSurface(m);
    verdicts.push(v);
    if (v.verdict === "broken") for (const r of v.reasons) violations.push(`${m.surface}: ${r}`);
  }
  const degraded = verdicts.filter((v) => v.verdict === "degraded").map((v) => v.surface);
  return { ok: violations.length === 0, verdicts, violations, degraded };
}

// --- CLI: node experience-gate.mjs [measurements.json] | piped stdin ---
import { fileURLToPath } from "node:url";
async function readStdin() { const c = []; for await (const x of process.stdin) c.push(x); return Buffer.concat(c).toString("utf8"); }
function sameFile(p) { try { return p && p.startsWith("file:") ? fileURLToPath(p) : p; } catch { return p; } }
if (process.argv[1] && fileURLToPath(import.meta.url) === sameFile(process.argv[1])) {
  const file = process.argv[2];
  const { readFileSync } = await import("node:fs");
  const raw = file ? readFileSync(file, "utf8") : await readStdin();
  let ms; try { ms = JSON.parse(raw); } catch (e) { console.error(`experience-gate: invalid JSON (${e.message})`); process.exit(2); }
  const r = judgeExperience(ms);
  console.error(`experience-gate · ${EXPERIENCE_GATE_VERSION} · ${Array.isArray(ms) ? ms.length : 0} surface(s)`);
  for (const v of r.verdicts) console.error(`  [${v.verdict.toUpperCase().padEnd(8)}] ${v.surface} ${v.latencyMs != null ? `${v.latencyMs}ms/${v.budgetMs}ms` : ""}${v.reasons.length ? " — " + v.reasons[0] : ""}`);
  if (r.degraded.length) console.error(`degraded (works, not delightful): ${r.degraded.join(", ")}`);
  if (r.ok) { console.error(`PASS: no broken founder-facing surface.`); process.exit(0); }
  console.error(`FAIL: ${r.violations.length} experience violation(s) — a founder would not enjoy this:`);
  for (const v of r.violations) console.error(`  - ${v}`);
  process.exit(1);
}
