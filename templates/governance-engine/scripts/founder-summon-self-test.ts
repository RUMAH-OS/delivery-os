// Governance Engine — Founder Summon Delivery (C1) REGRESSION self-test, ported VERBATIM from the VERIFIED admin
// harness (`rumah-admin/scripts/founder-summon-c1.ts --self-test`) and run against the INVERTED organ.
//
// THE PROOF THIS FILE EXISTS TO MAKE: the never-silently-dropped guarantee + the draft-don't-send seam are
// BYTE-FOR-BYTE preserved after `process.env[credential_ref]` was re-pointed onto the injected `NotifierPort`.
// Cases (A)-(D), (F)-(I) are copied verbatim from the admin harness (availability is injected via `opts.availability`,
// so they never depended on the env read). The ONLY adaptation is (E) DRAFT-DON'T-SEND: admin SET `process.env.
// C1_SLACK_WEBHOOK` so the default-probe read it as "configured"; the package has NO `process.env` read, so (E)
// injects a `NotifierPort` whose `isConfigured`→true (the residency-clean analogue) + a tripwire `send`, then
// proves the send seam is NEVER invoked in SHADOW. Same inputs ⇒ same verdicts / the same never-dropped property.
//
// Run:  tsx founder-summon-self-test.ts   ·   exit 0 = the inverted logic matches the verified logic · 1 = drift.

import {
  summon,
  defaultChannelChain,
  fapFromGoalSupervisorHalt,
  fapFromPreflightRefusal,
  fapFromCompletionReview,
  type SummonFap,
  type SummonResult,
  type SendSeam,
} from "../founder-summon.js";
import type { NotifierPort } from "../ports.js";
import {
  evaluateGoalSupervision,
  composeHaltAndFap,
  DEFAULT_GRACE_FLOOR,
  DEFAULT_WINDOW,
  DEFAULT_EPSILON,
  type GoalSupervisionFacts,
} from "../goal-supervisor.js";
import { evaluatePreflight, type PreflightGoal, type PreflightContext } from "../preflight.js";
import { reviewCompletion, type CompletionReviewContext } from "../completion-review.js";
import type { GoalContractRow } from "../ports.js";

const cases: Array<{ name: string; ok: boolean }> = [];
const check = (name: string, ok: boolean) => cases.push({ name, ok });
const L = (s = "") => process.stdout.write(s + "\n");

// ── Build the three REAL FAP sources (offline) — proves the delivery is source-agnostic. ──
function gsHaltFap(): SummonFap {
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

async function main() {
  L("governance-engine C1 founder-summon self-test — never-dropped + draft-don't-send over the NotifierPort\n");

  const fap = gsHaltFap(); // a real GS feasibility FAP as the payload for the channel-chain scenarios

  // ── (A) PRIMARY chosen (draft) — all channels available → Slack primary takes it, DRAFTED, not sent ──
  const rA = await summon(fap, defaultChannelChain(), { posture: "SHADOW", availability: { "slack-primary": true, "nonsaas-fallback": true } });
  check("PRIMARY: all available → delivered_via slack-primary, drafted (not sent)", rA.delivered_via === "slack-primary" && rA.escalated === false && rA.attempts.every((a) => a.sent === false));
  check("PRIMARY: dropped is structurally false", rA.dropped === false);

  // ── (B) PRIMARY unavailable → NON-SaaS FALLBACK fires (draft) ──
  const rB = await summon(fap, defaultChannelChain(), { posture: "SHADOW", availability: { "slack-primary": false, "nonsaas-fallback": true } });
  check("FALLBACK: primary down → delivered_via nonsaas-fallback (independent of Slack SaaS)", rB.delivered_via === "nonsaas-fallback" && rB.escalated === false);
  check("FALLBACK: the skipped primary is recorded as configured-but-shadowed / unavailable", rB.attempts[0]!.channelId === "slack-primary" && rB.attempts[0]!.outcome === "skipped-unavailable");
  check("FALLBACK: nothing sent (SHADOW draft)", rB.attempts.every((a) => a.sent === false));

  // ── (C) BOTH unavailable → ESCALATION (durable last-resort record, never dropped) ──
  const rC = await summon(fap, defaultChannelChain(), { posture: "SHADOW", availability: { "slack-primary": false, "nonsaas-fallback": false } });
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

  // ── (E) DRAFT-DON'T-SEND — no real send EVEN with a channel reported configured (NotifierPort-driven) ──
  // EXTRACTION-ADAPTED: admin SET process.env to make the default-probe read "configured"; the package reads NO
  // env, so we inject a NotifierPort whose isConfigured→true AND a tripwire send. In SHADOW neither is honored:
  // the send seam must NEVER be called and every attempt must be sent:false.
  let sendCalls = 0;
  const tripwireNotifier: NotifierPort = {
    isConfigured: () => true, // every channel reports configured (the residency-clean analogue of a set webhook env)
    send: async () => { sendCalls++; return { ok: true, ref: "SHOULD-NEVER-HAPPEN" }; },
  };
  const rE = await summon(fap, defaultChannelChain(), { posture: "SHADOW", notifier: tripwireNotifier });
  check("DRAFT-DON'T-SEND: the send seam is NEVER invoked in SHADOW (even with a configured NotifierPort)", sendCalls === 0);
  check("DRAFT-DON'T-SEND: every attempt is sent:false despite configured credentials", rE.attempts.every((a) => a.sent === false));
  check("DRAFT-DON'T-SEND: the configured primary is DRAFTED (would-deliver), not sent", rE.delivered_via === "slack-primary" && rE.attempts[0]!.outcome === "drafted-would-deliver" && rE.attempts[0]!.configured === true);

  // ── (E') RESIDENCY: with NO notifier, real channels are unavailable (no process.env read) → escalates durably ──
  const rEr = await summon(fap, defaultChannelChain(), { posture: "SHADOW" /* no notifier, no availability */ });
  check("RESIDENCY: no NotifierPort + no env read → real channels unavailable → escalates durably (never dropped)", rEr.escalated === true && rEr.dropped === false && rEr.attempts.every((a) => a.sent === false));

  // ── (F) FAP-SOURCE COMPOSITION — the GS HALT, the pre-flight REFUSE, the completion-review verdict ──
  L("── (F) FAP-source composition — one delivery mechanism, three boundary producers ──");
  const gs = fap; // already a GS halt FAP
  const pf = await preflightRefuseFap();
  const cr = await completionReviewFap();
  for (const [name, srcFap] of [["goal-supervisor HALT", gs], ["preflight-gate REFUSE", pf], ["completion-review INCOMPLETE", cr]] as Array<[string, SummonFap]>) {
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
  const localSink: Array<{ channelId: string; goalId: string }> = [];
  const testSink: SendSeam = async (channel, f) => { localSink.push({ channelId: channel.id, goalId: f.goal_id }); return { ok: true, ref: `local-sink#${localSink.length}`, note: "recorded to the in-process test sink" }; };
  const rG = await summon(fap, defaultChannelChain(), { posture: "ENFORCE", availability: { "slack-primary": true, "nonsaas-fallback": true }, send: testSink });
  check("ENFORCE: an available channel with a test sink really delivers (sent:true) to the LOCAL sink", rG.delivered_via === "slack-primary" && rG.attempts[0]!.outcome === "delivered" && rG.attempts[0]!.sent === true);
  check("ENFORCE: exactly one local-sink delivery happened (no real channel paged)", localSink.length === 1 && localSink[0]!.channelId === "slack-primary");

  // ── (G') ENFORCE via NotifierPort.send — the port's real-send seam delivers to the LOCAL sink ──
  const portSink: Array<{ id: string }> = [];
  const portNotifier: NotifierPort = { isConfigured: () => true, send: async (ch) => { portSink.push({ id: ch.id }); return { ok: true, ref: `port-sink#${portSink.length}` }; } };
  const rGp = await summon(fap, defaultChannelChain(), { posture: "ENFORCE", notifier: portNotifier });
  check("ENFORCE(port): NotifierPort.send delivers to the LOCAL sink (sent:true, slack-primary)", rGp.delivered_via === "slack-primary" && rGp.attempts[0]!.sent === true && portSink.length === 1);

  // ── (H) ENFORCE without a provisioned provider → escalates DURABLY (never reaches a real channel, never drops) ──
  const rH = await summon(fap, defaultChannelChain(), { posture: "ENFORCE", availability: { "slack-primary": true, "nonsaas-fallback": true } /* no send seam */ });
  check("ENFORCE-NO-PROVIDER: configured-but-unsendable channels fail over (available-unsendable-no-seam)", rH.attempts.some((a) => a.outcome === "available-unsendable-no-seam"));
  check("ENFORCE-NO-PROVIDER: escalates to the durable last-resort — never reaches a real channel, never drops", rH.escalated === true && rH.dropped === false && rH.attempts.every((a) => a.sent === false));

  // ── (I) ENFORCE fail-over — primary send FAILS → fallback send SUCCEEDS (real fail-over, local sink) ──
  let primaryAttempted = false;
  const flakyPrimarySink: SendSeam = async (channel, _f) => {
    if (channel.id === "slack-primary") { primaryAttempted = true; return { ok: false, note: "simulated Slack outage" }; }
    return { ok: true, ref: `fallback-sink`, note: "delivered via the non-SaaS fallback sink" };
  };
  const rI = await summon(fap, defaultChannelChain(), { posture: "ENFORCE", availability: { "slack-primary": true, "nonsaas-fallback": true }, send: flakyPrimarySink });
  check("ENFORCE-FAILOVER: primary send fails → fallback delivers (delivered_via nonsaas-fallback)", primaryAttempted && rI.delivered_via === "nonsaas-fallback" && rI.attempts.find((a) => a.channelId === "slack-primary")!.outcome === "send-failed");

  // ── tally ──
  const failed = cases.filter((c) => !c.ok);
  for (const c of cases) L(`${c.ok ? "PASS" : "FAIL"}  ${c.name}`);
  L(`\ngovernance-engine C1 founder-summon self-test (verbatim chain table + NotifierPort residency): ${cases.length - failed.length}/${cases.length} passed.`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
