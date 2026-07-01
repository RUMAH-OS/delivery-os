#!/usr/bin/env tsx
// =============================================================================
// The Founder Summon Delivery (C1) — CLI (RS-DOS-v1 C1 / §3.1 / §3.3 / F14). Sprint 3.5, first slice.
// =============================================================================
// SHADOW posture by default: it COMPOSES the would-deliver (the chosen channel + the full fail-over chain it
// WOULD walk + the FAP) and DRAFTS it — it pages NO real channel even if a `*_WEBHOOK` env var is set, and on
// escalation it persists the durable last-resort record to a founder-audit FILE sink (never a real channel).
//
//   --enforce  proves the real-send CAPABILITY against a LOCAL/TEST sink only (an in-process recording sink),
//              behind a loud banner: enforce = a FOUNDER ★ decision + PROVISIONED channels (Sprint 5.3). With
//              no real provider wired, even --enforce escalates DURABLY — it never reaches the real founder and
//              never drops the summon.
//
// USAGE:
//   tsx scripts/founder-summon-c1.ts --self-test                         # primary/fallback/escalation + invariants + the 3 FAP sources
//   tsx scripts/founder-summon-c1.ts --facts <fap.json> [--json]         # deliver a supplied common-shape FAP (SHADOW)
//   tsx scripts/founder-summon-c1.ts --facts <fap.json> --enforce        # prove real-send capability (local/test sink only)
// =============================================================================

import { readFileSync, writeFileSync } from "node:fs";
import {
  summon,
  defaultChannelChain,
  fapFromGoalSupervisorHalt,
  fapFromPreflightRefusal,
  fapFromCompletionReview,
  type SummonFap,
  type SummonResult,
  type SummonOptions,
  type ChannelSeam,
  type SendSeam,
} from "../src/founder-summon-c1.js";
import {
  evaluateGoalSupervision,
  composeHaltAndFap,
  DEFAULT_GRACE_FLOOR,
  DEFAULT_WINDOW,
  DEFAULT_EPSILON,
  type GoalSupervisionFacts,
} from "../src/goal-supervisor-c7.js";
import { evaluatePreflight, type PreflightGoal, type PreflightContext } from "../src/preflight-gate-c9.js";
import { reviewCompletion, type CompletionReviewContext } from "../src/completion-review-c6.js";
import type { GoalContractRow } from "../src/goal-contract.js";

// ── args ─────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const opts = { selfTest: false, enforce: false, facts: null as string | null, json: false };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--self-test") opts.selfTest = true;
  else if (a === "--enforce") opts.enforce = true;
  else if (a === "--facts") opts.facts = String(argv[++i]);
  else if (a === "--json") opts.json = true;
  else if (a === "-h" || a === "--help") { process.stdout.write(usage()); process.exit(0); }
  else { process.stderr.write(`founder-summon-c1: unknown flag "${a}" (try --help)\n`); process.exit(2); }
}

function usage(): string {
  return (
    "C1 Founder Summon Delivery (RS-DOS §3.1/§3.3). SHADOW/draft-don't-send by default. Pages nothing.\n\n" +
    "  tsx scripts/founder-summon-c1.ts --self-test\n" +
    "  tsx scripts/founder-summon-c1.ts --facts <fap.json> [--json]\n" +
    "  tsx scripts/founder-summon-c1.ts --facts <fap.json> --enforce   (founder ★ — proves real-send capability, local/test sink only)\n"
  );
}

function enforceBanner(): void {
  const L = (s = "") => process.stderr.write(s + "\n");
  L("");
  L("============================================================================");
  L("  !! --enforce — REAL-SEND CAPABILITY (NOT the default posture) !!");
  L("  The enforce-flip that actually PAGES the founder is a FOUNDER ★ decision");
  L("  and needs PROVISIONED channels (Slack + the non-SaaS provider, Sprint 5.3).");
  L("  This run proves the send CAPABILITY against a LOCAL/TEST sink only — NO real");
  L("  Slack/SMS/email is paged. With no provider wired it escalates DURABLY; a");
  L("  summon is never dropped.");
  L("============================================================================");
  L("");
}

// ── report ───────────────────────────────────────────────────────────────────
function printResult(r: SummonResult, label?: string): void {
  const L = (s = "") => process.stdout.write(s + "\n");
  if (label) L(`── ${label} ──`);
  L(`posture:      ${r.posture}${r.posture === "SHADOW" ? " (draft-don't-send — pages nothing)" : " (real-send capability — local/test sink only)"}`);
  L(`goal:         ${r.goal_id}  ·  [${r.boundary_class}]  ·  source ${r.source}`);
  L(`delivered_via:${r.delivered_via} (${r.delivered_kind})${r.escalated ? "  ⚠ ESCALATED to the durable last-resort" : ""}`);
  L(`dropped:      ${r.dropped}  (a summon is never silently dropped)`);
  L(`chain walked:`);
  for (const a of r.attempts) {
    L(`   #${a.priority} ${a.channelId.padEnd(20)} ${a.outcome.padEnd(28)} sent=${a.sent} configured=${a.configured} available=${a.available}`);
    L(`        ${a.reason}`);
  }
  if (r.durable_record) {
    L(`durable record: cannot_be_lost=${r.durable_record.cannot_be_lost} · recorded_at ${r.durable_record.recorded_at}`);
  }
  L("");
}

// =============================================================================
// Build the three REAL FAP sources (offline) — proves the delivery is source-agnostic.
// =============================================================================
function gsHaltFap(): SummonFap {
  // A stalled goal (effort spent, flat dGoal) → the GS trips → composeHaltAndFap drafts a feasibility FAP.
  const budget = { max_turns: 100, max_cost_cents: 10000 };
  const stalled: GoalSupervisionFacts = {
    goalId: "gs-stalled-goal",
    window: DEFAULT_WINDOW,
    epsilon: DEFAULT_EPSILON,
    graceFloor: DEFAULT_GRACE_FLOOR,
    progressSeries: [
      { cycle: 0, value: 0.42, fixRef: "retry-discovery" },
      { cycle: 1, value: 0.42, fixRef: "retry-discovery" },
      { cycle: 2, value: 0.42, fixRef: "retry-discovery" },
      { cycle: 3, value: 0.42, fixRef: "retry-discovery" },
    ],
    externalReprobe: { ok: true, value: 0.42, cycle: 4 },
    effort: { attempts: 80, cumulativeCostCents: 9000, budgetCap: budget },
    acceptance: { op: ">=", target: 1.0, direction: "increase" },
    contractState: "EXECUTING",
    readable: { progress: true, effort: true },
  };
  const verdict = evaluateGoalSupervision(stalled);
  const halt = composeHaltAndFap(stalled, verdict, { cycle: 4 });
  return fapFromGoalSupervisorHalt(halt);
}

async function preflightRefuseFap(): Promise<SummonFap> {
  // A goal whose metric_source does NOT resolve (unregistered probe) → REFUSE at hour 0. The reachability
  // evaluator is DEFERRED (throws → fail-closed), so the gate refuses on unmeasurable-metric + statically-
  // unreachable. Fully offline (no DB; no required config keys).
  const goal: PreflightGoal = {
    goalId: "preflight-unreachable-goal",
    objective: "discover every off-market property in the city (unbounded, unmeasurable)",
    acceptanceMetric: "off_market_properties_found",
    metricSourceProbeId: "no-such-probe",
    metricSourceVersion: 1,
    budgetCap: { max_turns: 50 },
  };
  const ctx: PreflightContext = { targetEnv: "local" };
  const verdict = await evaluatePreflight(goal, ctx);
  return fapFromPreflightRefusal(verdict, goal);
}

async function completionReviewFap(): Promise<SummonFap> {
  // An INCOMPLETE verdict: the independent re-probe reads a value BELOW the frozen target → not met → INCOMPLETE
  // → a feasibility summon. The re-probe is INJECTED (offline, no DB), proving C6's independence.
  const contract = {
    goalId: "completion-incomplete-goal",
    objective: "raise test coverage to 90%",
    acceptanceMetric: "coverage_ratio",
    metricSourceProbeId: "coverage-probe",
    metricSourceVersion: 1,
    dataClass: "INTERNAL",
    budgetCap: { max_turns: 100 },
    goalDeltaLedgerRef: "completion-incomplete-goal",
    state: "REVIEWING",
    prevState: "EXECUTING",
    createdAt: new Date(0),
    updatedAt: new Date(0),
  } as GoalContractRow;
  const ctx: CompletionReviewContext = {
    acceptance: { op: ">=", target: 0.9, direction: "increase" },
    reprobe: async () => ({ value: 0.71, note: "independent re-read (injected fixture)" }), // below target → not met
  };
  const review = await reviewCompletion(contract, ctx);
  return fapFromCompletionReview(review);
}

// =============================================================================
// Self-test — primary / fallback / escalation under each availability combo, the never-dropped invariant,
// the draft-don't-send (no-real-send) proof, the 3 FAP-source composition, and the ENFORCE capability proof.
// REAL output. No DB, no network.
// =============================================================================
async function selfTest(): Promise<void> {
  const L = (s = "") => process.stdout.write(s + "\n");
  const cases: Array<{ name: string; ok: boolean }> = [];
  const check = (name: string, ok: boolean) => cases.push({ name, ok });

  const fap = gsHaltFap(); // a real GS feasibility FAP as the payload for the channel-chain scenarios

  // ── (A) PRIMARY chosen (draft) — all channels available → Slack primary takes it, DRAFTED, not sent ──
  const rA = await summon(fap, defaultChannelChain(), { posture: "SHADOW", availability: { "slack-primary": true, "nonsaas-fallback": true } });
  printResult(rA, "(A) all available → PRIMARY (Slack) drafted");
  check("PRIMARY: all available → delivered_via slack-primary, drafted (not sent)", rA.delivered_via === "slack-primary" && rA.escalated === false && rA.attempts.every((a) => a.sent === false));
  check("PRIMARY: dropped is structurally false", rA.dropped === false);

  // ── (B) PRIMARY unavailable → NON-SaaS FALLBACK fires (draft) ──
  const rB = await summon(fap, defaultChannelChain(), { posture: "SHADOW", availability: { "slack-primary": false, "nonsaas-fallback": true } });
  printResult(rB, "(B) Slack down → NON-SaaS FALLBACK drafted");
  check("FALLBACK: primary down → delivered_via nonsaas-fallback (independent of Slack SaaS)", rB.delivered_via === "nonsaas-fallback" && rB.escalated === false);
  check("FALLBACK: the skipped primary is recorded as configured-but-shadowed / unavailable", rB.attempts[0]!.channelId === "slack-primary" && rB.attempts[0]!.outcome === "skipped-unavailable");
  check("FALLBACK: nothing sent (SHADOW draft)", rB.attempts.every((a) => a.sent === false));

  // ── (C) BOTH unavailable → ESCALATION (durable last-resort record, never dropped) ──
  const rC = await summon(fap, defaultChannelChain(), { posture: "SHADOW", availability: { "slack-primary": false, "nonsaas-fallback": false } });
  printResult(rC, "(C) Slack + non-SaaS down → ESCALATION (durable last-resort)");
  check("ESCALATION: both down → delivered_via durable-last-resort, escalated", rC.delivered_via === "durable-last-resort" && rC.escalated === true);
  check("ESCALATION: a durable record is produced and marked cannot_be_lost", rC.durable_record !== null && rC.durable_record!.cannot_be_lost === true);
  check("ESCALATION: the durable record carries the full prior fail-over chain (2 skipped channels)", rC.durable_record!.prior_attempts.length === 2);
  check("ESCALATION: the summon is NOT dropped (a loud, persisted escalation)", rC.dropped === false);

  // ── (D) THE INVARIANT TABLE — a summon is NEVER silently lost under ANY {primary,fallback} availability combo ──
  L("── (D) the never-dropped invariant — all 4 availability combos (durable terminal always on) ──");
  let tableFail = 0;
  const combos: Array<[boolean, boolean]> = [[true, true], [true, false], [false, true], [false, false]];
  for (const [p, f] of combos) {
    const r = await summon(fap, defaultChannelChain(), { posture: "SHADOW", availability: { "slack-primary": p, "nonsaas-fallback": f } });
    const ok = r.delivered_via.length > 0 && r.dropped === false && r.attempts.every((a) => a.sent === false);
    if (!ok) tableFail++;
    const expectVia = p ? "slack-primary" : f ? "nonsaas-fallback" : "durable-last-resort";
    const viaOk = r.delivered_via === expectVia;
    if (!viaOk) tableFail++;
    L(`   [${ok && viaOk ? "ok" : "XX"}] primary=${String(p).padEnd(5)} fallback=${String(f).padEnd(5)} → delivered_via=${r.delivered_via.padEnd(20)} escalated=${r.escalated} dropped=${r.dropped}`);
  }
  L("");
  check("INVARIANT: every {primary,fallback} availability combo delivers (never dropped, never sent in SHADOW)", tableFail === 0);

  // ── (E) DRAFT-DON'T-SEND — no real send EVEN with a webhook env var set ──
  // Set the real credential env vars AND inject a send seam that records any invocation; in SHADOW neither is
  // honored: the send seam must NEVER be called and every attempt must be sent:false.
  process.env.C1_SLACK_WEBHOOK = "https://hooks.example/THIS-MUST-NOT-BE-POSTED";
  process.env.C1_NONSAAS_FALLBACK = "sms://example/THIS-MUST-NOT-BE-POSTED";
  let sendCalls = 0;
  const tripwireSend: SendSeam = async () => { sendCalls++; return { ok: true, ref: "SHOULD-NEVER-HAPPEN" }; };
  const rE = await summon(fap, defaultChannelChain(), { posture: "SHADOW", send: tripwireSend }); // default-probe reads env → primary "configured"
  printResult(rE, "(E) webhook env SET + SHADOW → still DRAFTED, no real send");
  check("DRAFT-DON'T-SEND: the send seam is NEVER invoked in SHADOW (even with a webhook env set)", sendCalls === 0);
  check("DRAFT-DON'T-SEND: every attempt is sent:false despite configured credentials", rE.attempts.every((a) => a.sent === false));
  check("DRAFT-DON'T-SEND: the configured primary is DRAFTED (would-deliver), not sent", rE.delivered_via === "slack-primary" && rE.attempts[0]!.outcome === "drafted-would-deliver" && rE.attempts[0]!.configured === true);
  delete process.env.C1_SLACK_WEBHOOK;
  delete process.env.C1_NONSAAS_FALLBACK;

  // ── (F) FAP-SOURCE COMPOSITION — the GS HALT, the pre-flight REFUSE, the completion-review verdict ──
  // Each real source is adapted into the common SummonFap and delivered through the SAME chain.
  L("── (F) FAP-source composition — one delivery mechanism, three Phase-3 producers ──");
  const gs = fap; // already a GS halt FAP
  const pf = await preflightRefuseFap();
  const cr = await completionReviewFap();
  for (const [name, srcFap] of [["goal-supervisor-c7 HALT", gs], ["preflight-gate-c9 REFUSE", pf], ["completion-review-c6 INCOMPLETE", cr]] as Array<[string, SummonFap]>) {
    const r = await summon(srcFap, defaultChannelChain(), { posture: "SHADOW", availability: { "slack-primary": true, "nonsaas-fallback": true } });
    L(`   [${r.dropped === false && r.delivered_via === "slack-primary" ? "ok" : "XX"}] ${name.padEnd(34)} source=${r.source.padEnd(22)} [${r.boundary_class}] → delivered_via ${r.delivered_via} (drafted)`);
  }
  L("");
  check("COMPOSE: a GS HALT FAP is delivered (source goal-supervisor-c7, feasibility/strategy)", gs.source === "goal-supervisor-c7" && gs.boundary_class === "feasibility/strategy" && gs.exactly_what_to_do.length === 3);
  check("COMPOSE: a pre-flight REFUSE FAP is delivered (source preflight-gate-c9, blockers embedded)", pf.source === "preflight-gate-c9" && Array.isArray((pf.evidence as any).blockers) && (pf.evidence as any).blockers.length > 0);
  check("COMPOSE: a completion-review INCOMPLETE FAP is delivered (source completion-review-c6, re-probe embedded)", cr.source === "completion-review-c6" && (cr.evidence as any).complete === false && (cr.evidence as any).reprobe != null);
  const rGs = await summon(gs, defaultChannelChain(), { posture: "SHADOW", availability: { "slack-primary": true } });
  const rPf = await summon(pf, defaultChannelChain(), { posture: "SHADOW", availability: { "slack-primary": true } });
  const rCr = await summon(cr, defaultChannelChain(), { posture: "SHADOW", availability: { "slack-primary": true } });
  check("COMPOSE: all three sources deliver through the same chain, never dropped", rGs.dropped === false && rPf.dropped === false && rCr.dropped === false);

  // ── (G) ENFORCE capability — real-send proven against a LOCAL/TEST sink only ──
  // A recording in-process sink stands in for a provisioned channel. ENFORCE + an available channel + the sink
  // → really "delivered" (sent:true) to the LOCAL sink (no real Slack/SMS). This proves the capability the
  // enforce-flip (Sprint 5.3) will wire to a real provider.
  const localSink: Array<{ channelId: string; goalId: string }> = [];
  const testSink: SendSeam = async (channel, f) => { localSink.push({ channelId: channel.id, goalId: f.goal_id }); return { ok: true, ref: `local-sink#${localSink.length}`, note: "recorded to the in-process test sink" }; };
  const rG = await summon(fap, defaultChannelChain(), { posture: "ENFORCE", availability: { "slack-primary": true, "nonsaas-fallback": true }, send: testSink });
  printResult(rG, "(G) ENFORCE + available primary + test sink → really DELIVERED (local sink only)");
  check("ENFORCE: an available channel with a test sink really delivers (sent:true) to the LOCAL sink", rG.delivered_via === "slack-primary" && rG.attempts[0]!.outcome === "delivered" && rG.attempts[0]!.sent === true);
  check("ENFORCE: exactly one local-sink delivery happened (no real channel paged)", localSink.length === 1 && localSink[0]!.channelId === "slack-primary");

  // ── (H) ENFORCE without a provisioned provider → escalates DURABLY (never reaches a real channel, never drops) ──
  const rH = await summon(fap, defaultChannelChain(), { posture: "ENFORCE", availability: { "slack-primary": true, "nonsaas-fallback": true } /* no send seam */ });
  printResult(rH, "(H) ENFORCE, channels 'configured' but no provider wired → DURABLE escalation");
  check("ENFORCE-NO-PROVIDER: configured-but-unsendable channels fail over (available-unsendable-no-seam)", rH.attempts.some((a) => a.outcome === "available-unsendable-no-seam"));
  check("ENFORCE-NO-PROVIDER: escalates to the durable last-resort — never reaches a real channel, never drops", rH.escalated === true && rH.dropped === false && rH.attempts.every((a) => a.sent === false));

  // ── (I) ENFORCE fail-over — primary send FAILS → fallback send SUCCEEDS (real fail-over, local sink) ──
  let primaryAttempted = false;
  const flakyPrimarySink: SendSeam = async (channel, f) => {
    if (channel.id === "slack-primary") { primaryAttempted = true; return { ok: false, note: "simulated Slack outage" }; }
    return { ok: true, ref: `fallback-sink`, note: "delivered via the non-SaaS fallback sink" };
  };
  const rI = await summon(fap, defaultChannelChain(), { posture: "ENFORCE", availability: { "slack-primary": true, "nonsaas-fallback": true }, send: flakyPrimarySink });
  check("ENFORCE-FAILOVER: primary send fails → fallback delivers (delivered_via nonsaas-fallback)", primaryAttempted && rI.delivered_via === "nonsaas-fallback" && rI.attempts.find((a) => a.channelId === "slack-primary")!.outcome === "send-failed");

  // ── tally ──
  const failed = cases.filter((c) => !c.ok);
  for (const c of cases) L(`${c.ok ? "PASS" : "FAIL"}  ${c.name}`);
  L(`\nC1 founder-summon self-test: ${cases.length - failed.length}/${cases.length} passed.`);
  process.exit(failed.length === 0 ? 0 : 1);
}

// =============================================================================
// Deliver a supplied common-shape FAP in SHADOW (or prove the capability with --enforce, local sink only).
// =============================================================================
function normalizeFap(raw: any): SummonFap {
  if (!raw || typeof raw !== "object") throw new Error("--facts must be a JSON object (a common-shape SummonFap)");
  return {
    fap_version: 1,
    boundary_class: raw.boundary_class ?? "feasibility/strategy",
    source: raw.source ?? "goal-supervisor-c7",
    goal_id: String(raw.goal_id ?? "fixture-goal"),
    status: String(raw.status ?? ""),
    why_i_stopped: String(raw.why_i_stopped ?? ""),
    what_i_completed: String(raw.what_i_completed ?? ""),
    what_remains: String(raw.what_remains ?? ""),
    exactly_what_to_do: Array.isArray(raw.exactly_what_to_do) ? raw.exactly_what_to_do.map(String) : [],
    evidence: raw.evidence ?? {},
    rollback: String(raw.rollback ?? ""),
    resume_command: String(raw.resume_command ?? ""),
  };
}

async function runFacts(path: string): Promise<void> {
  if (opts.enforce) enforceBanner();
  const fap = normalizeFap(JSON.parse(readFileSync(path, "utf8")));

  // ENFORCE here uses a FILE-backed local/test sink only (never a real channel) — proving the capability without
  // a provisioned provider. SHADOW never sends.
  const deliveredLog: Array<{ channelId: string; goalId: string }> = [];
  const fileSink: SendSeam = async (channel, f) => {
    deliveredLog.push({ channelId: channel.id, goalId: f.goal_id });
    return { ok: true, ref: `local-test-sink#${deliveredLog.length}`, note: "recorded to the local/test sink (NOT a real channel)" };
  };
  const summonOpts: SummonOptions = opts.enforce ? { posture: "ENFORCE", send: fileSink } : { posture: "SHADOW" };
  const r = await summon(fap, defaultChannelChain(), summonOpts);

  if (opts.json) {
    process.stdout.write(JSON.stringify(r, null, 2) + "\n");
  } else {
    printResult(r);
  }

  // Persist the durable escalation record (if any) to the founder-audit FILE sink — never a real channel.
  if (r.durable_record) {
    const logPath = process.env.C1_SUMMON_LOG || "./founder-summon-escalation.json";
    try {
      writeFileSync(logPath, JSON.stringify(r.durable_record, null, 2) + "\n");
      process.stderr.write(`founder-summon-c1: durable escalation record written to ${logPath} (SHADOW founder-audit sink — cannot be lost, not delivered to a real channel).\n`);
    } catch (e) {
      process.stderr.write(`founder-summon-c1: WARN could not write the durable record ${logPath}: ${(e as Error).message}\n`);
    }
  }

  if (!opts.enforce) {
    process.exit(0); // SHADOW: report-only, always exit 0 — pages nothing.
  }
  // ENFORCE (local sink only): exit non-zero iff the summon had to ESCALATE (no real channel reached) — a loud
  // signal that the founder was reachable ONLY via the durable last-resort. A clean local-sink delivery → 0.
  process.exit(r.escalated ? 1 : 0);
}

// ── entrypoint ─────────────────────────────────────────────────────────────────
if (opts.selfTest) {
  selfTest().catch((e) => { process.stderr.write(`founder-summon-c1: ${e?.stack ?? e}\n`); process.exit(2); });
} else if (opts.facts) {
  runFacts(opts.facts).catch((e) => { process.stderr.write(`founder-summon-c1: ${e?.stack ?? e}\n`); process.exit(2); });
} else {
  process.stdout.write(usage());
  process.exit(0);
}
