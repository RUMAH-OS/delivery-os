// =============================================================================
// The Founder Summon Delivery (C1 core) — GUARANTEED-REACHABILITY FAP delivery
// (RS-DOS-v1 C1 / §3.1 / §3.3 / §14 F14 / §20 J-summons). Sprint 3.5, first slice.
// =============================================================================
// THE LAST PHASE-3 ORGAN. The pre-flight gate (C9), the Goal Supervisor (C7), and the completion
// review (C6) all DRAFT a Founder Action Package (FAP) at a boundary; each currently writes it to a
// draft-don't-send founder-audit sink behind a `*_FAP_WEBHOOK`-style credential seam. THIS module is
// the DELIVERY behind those seams: given a FAP, it reaches the founder over a PRIORITIZED CHANNEL CHAIN
// with one load-bearing property —
//
//   ── A SUMMON IS NEVER SILENTLY DROPPED. ──
//   The chain is PRIMARY (Slack — §3 C1 surface, Sprint 5.3) → NON-SaaS FALLBACK (SMS/email — a channel
//   INDEPENDENT of the primary SaaS, so it survives Slack being down, §3.3) → LAST-RESORT ESCALATION (a
//   durably-recorded summon that CANNOT be lost). If the primary is unavailable/fails, the fallback fires;
//   if the fallback fails, it escalates to the durable last-resort. An undeliverable summon becomes a loud,
//   PERSISTED escalation — never a silent loss. The founder is reachable at EVERY boundary even if Slack /
//   the whole SaaS is down (F14: "a chat outage must never silently unleash *or* permanently stall the fleet").
//
//   This is enforced STRUCTURALLY, not by discipline: `summon` always appends a durable last-resort terminal
//   to the chain (ensureDurableTerminal), and that terminal is ALWAYS available (recording an audit row needs
//   no external SaaS — that is precisely why it is the guaranteed terminal). So `delivered_via` is never null
//   and the result type encodes `dropped: false` — there is no code path that returns a dropped summon.
//
// ── Each channel is a SEAM with a credential_ref — NEVER hardcoded ──
//   Slack → C1_SLACK_WEBHOOK · non-SaaS fallback → C1_NONSAAS_FALLBACK · durable last-resort → none (it needs
//   no creds — guaranteed). Absent creds in SHADOW → the channel reports "configured-but-shadowed / unavailable"
//   and the chain PROCEEDS to the next. (These refs should be REGISTERED in infra/config-secret-registry.json
//   when real paging is built — data_class SECRET, owner platform — mirroring the dead-man-switch
//   WATCHDOG_ALARM_WEBHOOK note. Not registered here: real paging is the panel-gated enforce-flip.)
//
// ── SHADOW posture (this slice — mirrors the C7 GS / C8 dead-man's-switch draft-don't-send seam) ──
//   DEFAULT = SHADOW: `summon` COMPOSES the would-deliver (the channel it WOULD pick, the full fail-over chain
//   it WOULD walk, the FAP content) and DRAFTS it — it does NOT POST to a real channel EVEN IF a `*_WEBHOOK`
//   env var is set (`send` is never invoked in SHADOW; every attempt carries `sent:false`). The durable
//   last-resort, when reached, produces a durable escalation record (an AUDIT persist, exactly like the
//   dead-man-switch writes its alarm artifact in SHADOW — not "paging a real external channel").
//   ENFORCE proves the real-send CAPABILITY against a LOCAL/TEST sink only (an injected `send` seam), behind a
//   "enforce = founder ★ + provisioned channels (Sprint 5.3)" banner. With no `send` seam wired, even ENFORCE
//   cannot really reach Slack, so it escalates DURABLY — never drops.
//
// ── This module is PURE ── no fs, no network, no DB. It computes the delivery PLAN + outcome and returns the
//   durable escalation record as DATA; the CLI (scripts/founder-summon-c1.ts) persists it to the founder-audit
//   sink. `send` (ENFORCE) is dependency-injected. So the rule is fully unit-testable offline AND the same code
//   runs for real once channels are provisioned.
//
// OUT OF SCOPE (named): the real Slack surface + the /goal command (Sprint 5.3); provisioning real channel
//   credentials; actually paging the founder (the enforce-flip + 5.3); the 8-question single-screen UX; summon-
//   storm triage (§3.3 / §13). Delivery mechanism + seam only.
// =============================================================================

import type { HaltAndFap, FounderActionPackage as GsFap } from "./goal-supervisor-c7.js";
import type { PreflightVerdict } from "./preflight-gate-c9.js";
import type { CompletionReview } from "./completion-review-c6.js";

// ── The §3.1 boundary classes (the summon envelope's class) ─────────────────────────────────────────────
export type BoundaryClass =
  | "feasibility/strategy"
  | "approval"
  | "merge-to-main"
  | "credentials"
  | "deploy-auth"
  | "manual-testing"
  | "legal"
  | "payment"
  | "cross-repo";

/** Which runtime organ drafted this FAP (provenance — the three Phase-3 sources this slice delivers). */
export type FapSource = "goal-supervisor-c7" | "preflight-gate-c9" | "completion-review-c6";

/** The COMMON FAP shape (§3.1: status · what-I-completed · what-remains · WHY-I-stopped · exactly-what-to-do ·
 *  rollback · the resume command). The GS's FounderActionPackage already has these fields; the pre-flight REFUSE
 *  and the completion-review verdict are adapted INTO this same shape so the delivery mechanism is source-agnostic
 *  (one envelope, three producers). */
export interface SummonFap {
  fap_version: 1;
  boundary_class: BoundaryClass;
  source: FapSource;
  goal_id: string;
  status: string;
  why_i_stopped: string;
  what_i_completed: string;
  what_remains: string;
  /** the zero-tech, numbered actions the founder owns (§3.1 / §15). */
  exactly_what_to_do: string[];
  /** the source's evidence block (the goal-delta series / blockers / re-probe — opaque to delivery). */
  evidence: Record<string, unknown>;
  rollback: string;
  resume_command: string;
}

// =============================================================================
// FAP SOURCE COMPOSITION — adapt each Phase-3 organ's output into the common SummonFap.
// (type-only imports above: zero runtime coupling — delivery does not pull the organs in.)
// =============================================================================

/** GS HALT_AND_SUMMON → SummonFap. The GS's HaltAndFap.fap is ALREADY the §3.1 shape; we tag the source. */
export function fapFromGoalSupervisorHalt(halt: HaltAndFap): SummonFap {
  const f: GsFap = halt.fap;
  return {
    fap_version: 1,
    boundary_class: f.boundary_class, // "feasibility/strategy"
    source: "goal-supervisor-c7",
    goal_id: f.goal_id,
    status: f.status,
    why_i_stopped: f.why_i_stopped,
    what_i_completed: f.what_i_completed,
    what_remains: f.what_remains,
    exactly_what_to_do: f.exactly_what_to_do,
    evidence: f.evidence as unknown as Record<string, unknown>,
    rollback: f.rollback,
    resume_command: f.resume_command,
  };
}

/** Pre-flight REFUSE (C9 §7.3 / S3) → a feasibility FAP. An unreachable goal is refused at hour 0; the founder
 *  decides redirect / accept-lower-bar / kill on the blocker evidence (§3.1 feasibility class). */
export function fapFromPreflightRefusal(
  verdict: PreflightVerdict,
  goal: { goalId?: string; objective?: string },
): SummonFap {
  const goalId = verdict.goalId ?? goal.goalId ?? "(unsubmitted-goal)";
  const blockerList = verdict.blockers.map((b) => `${b.code}: ${b.detail}`);
  return {
    fap_version: 1,
    boundary_class: "feasibility/strategy",
    source: "preflight-gate-c9",
    goal_id: goalId,
    status: "REFUSED at the pre-flight feasibility gate (hour 0 — before any effort was spent)",
    why_i_stopped:
      `the goal is statically unreachable as stated: ${verdict.blockers.length} blocker(s) — ` +
      blockerList.join("; ") +
      `. (Refusing at hour 0 is the PRIMARY incident fix — the Discovery incident class dies here.)`,
    what_i_completed: "ran the five static-feasibility checks; nothing was executed (no sprint was started).",
    what_remains: `${goal.objective ? `objective "${goal.objective}" — ` : ""}make the goal reachable or redirect it.`,
    exactly_what_to_do: [
      "REDIRECT — amend the objective / supply what's missing (e.g. a registered metric probe, a budget, ready config), then resubmit.",
      "ACCEPT-LOWER-BAR — relax the acceptance criterion to something the system can measure and reach.",
      "KILL — withdraw the goal (nothing was spent).",
    ],
    evidence: {
      env: verdict.env,
      admit: verdict.admit,
      blockers: verdict.blockers,
      checks: verdict.checks.map((c) => ({ check: c.check, pass: c.pass, detail: c.detail })),
    },
    rollback: "none required — the goal was refused before any effort; nothing to undo.",
    resume_command: `/goal resubmit ${goalId}`,
  };
}

/** Completion review (C6 §9.2) INCOMPLETE/unreachable verdict → a boundary FAP. The three-way review's
 *  summon branch (unreachable / insufficient) hands the founder the decision; an INCOMPLETE verdict that the
 *  reconciler cannot route forward summons with the re-probe evidence (§3.1 feasibility class). */
export function fapFromCompletionReview(review: CompletionReview): SummonFap {
  const e = review.evidence;
  return {
    fap_version: 1,
    boundary_class: "feasibility/strategy",
    source: "completion-review-c6",
    goal_id: review.goalId,
    status: `completion review verdict: ${review.verdict} (independent re-probe under the review's own identity)`,
    why_i_stopped: review.reasons.join(" "),
    what_i_completed:
      `independently re-probed the acceptance metric '${e.acceptanceMetric} ${e.op ?? "?"} ${e.target ?? "?"}' ` +
      `(value ${String(e.reprobe.value)}, ${e.reprobe.note}).`,
    what_remains: review.complete
      ? "nothing — the goal is independently confirmed done."
      : "the acceptance target is not independently confirmed met; the goal cannot self-certify done.",
    exactly_what_to_do: review.complete
      ? ["ACCEPT — the result is verified; nothing is required of you."]
      : [
          "REDIRECT — amend the objective / give a new lever, then resume (the contract returns to PLANNING).",
          "ACCEPT-LOWER-BAR — accept the current independently-measured value as good-enough (the contract returns to REVIEWING).",
          "KILL — stop spending on this goal (the contract closes).",
        ],
    evidence: {
      verdict: review.verdict,
      complete: review.complete,
      acceptance: e.acceptance,
      reprobe: e.reprobe,
      met: e.met,
      acceptanceWellFormed: e.acceptanceWellFormed,
      reprobeSound: e.reprobeSound,
      independent: e.independent,
    },
    rollback: "none required — the review mutates nothing; this is an adjudication summon only.",
    resume_command: `/goal resume ${review.goalId}`,
  };
}

// =============================================================================
// THE CHANNEL CHAIN — a prioritized list of delivery SEAMS.
// =============================================================================
export type ChannelKind = "slack-primary" | "nonsaas-fallback" | "durable-last-resort";

/** Availability of a channel right now: configured (creds present) AND reachable enough to attempt. The durable
 *  last-resort is ALWAYS available (it records an audit row — no external dependency). */
export interface ChannelAvailability {
  /** the credential_ref is present (env-gated) — or n/a (durable). */
  configured: boolean;
  /** the channel can be used to (would-)deliver right now. */
  available: boolean;
  reason: string;
}

export type ChannelProbe = (channel: ChannelSeam) => ChannelAvailability;

export interface ChannelSeam {
  id: string;
  kind: ChannelKind;
  /** lower = tried first. */
  priority: number;
  /** the env-gated secret seam (NEVER hardcoded). null only for the durable last-resort (needs none). */
  credential_ref: string | null;
  /** does this channel survive the PRIMARY SaaS (Slack) being down? The fallback's whole point. */
  independent_of_primary_saas: boolean;
  /** human label. */
  label: string;
  /** availability resolver (default = isEnvConfigured(credential_ref); durable = always available). */
  probe: ChannelProbe;
}

/** Default probe: a real channel is available iff its credential_ref env var is set; the durable last-resort is
 *  always available. (Pure-ish: reads process.env only when no override is supplied — tests inject availability.) */
function defaultProbe(channel: ChannelSeam): ChannelAvailability {
  if (channel.kind === "durable-last-resort") {
    return { configured: true, available: true, reason: "durable last-resort — records a persisted audit row; needs no external SaaS (guaranteed terminal)." };
  }
  const ref = channel.credential_ref;
  const configured = Boolean(ref && process.env[ref]);
  return configured
    ? { configured: true, available: true, reason: `credential_ref ${ref} is configured.` }
    : { configured: false, available: false, reason: `credential_ref ${ref ?? "(none)"} not configured — configured-but-shadowed / unavailable; chain proceeds to the next channel.` };
}

/** The canonical 3-tier chain: Slack PRIMARY → non-SaaS FALLBACK → durable LAST-RESORT. */
export function defaultChannelChain(): ChannelSeam[] {
  return [
    {
      id: "slack-primary",
      kind: "slack-primary",
      priority: 0,
      credential_ref: "C1_SLACK_WEBHOOK",
      independent_of_primary_saas: false,
      label: "Slack (the C1 founder surface — Sprint 5.3)",
      probe: defaultProbe,
    },
    {
      id: "nonsaas-fallback",
      kind: "nonsaas-fallback",
      priority: 1,
      credential_ref: "C1_NONSAAS_FALLBACK",
      independent_of_primary_saas: true,
      label: "non-SaaS fallback (SMS/email — independent of Slack; survives the SaaS being down)",
      probe: defaultProbe,
    },
    {
      id: "durable-last-resort",
      kind: "durable-last-resort",
      priority: 2,
      credential_ref: null,
      independent_of_primary_saas: true,
      label: "durable last-resort (a persisted summon that cannot be lost)",
      probe: defaultProbe,
    },
  ];
}

/** Guarantee the chain ENDS in a durable last-resort terminal. This is the structural anti-drop: no matter what
 *  channels are supplied, summon can always reach a guaranteed-available terminal, so a summon is never dropped. */
export function ensureDurableTerminal(channels: ChannelSeam[]): ChannelSeam[] {
  const sorted = [...channels].sort((a, b) => a.priority - b.priority);
  if (sorted.some((c) => c.kind === "durable-last-resort")) return sorted;
  const maxPriority = sorted.reduce((m, c) => Math.max(m, c.priority), -1);
  return [
    ...sorted,
    {
      id: "durable-last-resort",
      kind: "durable-last-resort",
      priority: maxPriority + 1,
      credential_ref: null,
      independent_of_primary_saas: true,
      label: "durable last-resort (auto-appended — the guaranteed terminal; a summon is never dropped)",
      probe: defaultProbe,
    },
  ];
}

// =============================================================================
// THE SUMMON RESULT
// =============================================================================
export type AttemptOutcome =
  | "skipped-unavailable" // configured-but-shadowed / down → fail over to the next channel
  | "drafted-would-deliver" // SHADOW: this channel WOULD take the summon (not sent)
  | "delivered" // ENFORCE: really delivered to the (local/test) sink
  | "send-failed" // ENFORCE: the send seam reported failure → fail over
  | "available-unsendable-no-seam" // ENFORCE but no `send` seam wired → cannot really reach → fail over
  | "escalated-durable"; // the durable last-resort recorded the summon (cannot be lost)

export interface SummonAttempt {
  channelId: string;
  kind: ChannelKind;
  priority: number;
  credential_ref: string | null;
  configured: boolean;
  available: boolean;
  outcome: AttemptOutcome;
  /** NEVER true in SHADOW — proof no real send happens. */
  sent: boolean;
  posture: Posture;
  reason: string;
  /** the send seam's note/ref on a real (ENFORCE) delivery. */
  delivery_ref?: string;
}

/** The durable last-resort record — the guaranteed-reachability terminal. Persisted by the CLI to the
 *  founder-audit sink; "cannot be lost" because it is a durable audit row, not an ephemeral channel POST. */
export interface DurableEscalationRecord {
  kind: "durable-last-resort";
  goal_id: string;
  boundary_class: BoundaryClass;
  source: FapSource;
  posture: Posture;
  recorded_at: string;
  reason: string;
  fap: SummonFap;
  /** the full fail-over chain that was walked before escalating (every prior channel + why it failed over). */
  prior_attempts: SummonAttempt[];
  cannot_be_lost: true;
  note: string;
}

export interface SummonResult {
  goal_id: string;
  boundary_class: BoundaryClass;
  source: FapSource;
  posture: Posture;
  /** the channel that (would-)take the summon — NEVER null (the durable terminal guarantees it). */
  delivered_via: string;
  delivered_kind: ChannelKind;
  /** true iff delivery fell through to the durable last-resort (a loud, persisted escalation). */
  escalated: boolean;
  /** STRUCTURALLY false — there is no code path that drops a summon. The type encodes the invariant. */
  dropped: false;
  /** the ordered fail-over chain it walked, each annotated with availability + outcome. */
  attempts: SummonAttempt[];
  /** present iff escalated — the durable record the CLI persists. */
  durable_record: DurableEscalationRecord | null;
  fap: SummonFap;
}

export type Posture = "SHADOW" | "ENFORCE";

/** The real-send seam (ENFORCE only). Default: NONE. In ENFORCE, a non-durable channel can really deliver ONLY
 *  if a `send` seam is injected — proving the capability against a LOCAL/TEST sink. NEVER invoked in SHADOW. */
export type SendSeam = (channel: ChannelSeam, fap: SummonFap) => Promise<{ ok: boolean; ref?: string; note?: string }>;

export interface SummonOptions {
  posture?: Posture; // default SHADOW
  /** per-channel availability override (test injection): id → boolean | full ChannelAvailability. */
  availability?: Record<string, boolean | ChannelAvailability>;
  /** the real-send seam (ENFORCE). Absent → ENFORCE cannot really reach a real channel → escalates durably. */
  send?: SendSeam;
  /** clock for the durable record timestamp (deterministic tests). */
  now?: number;
}

function resolveAvailability(channel: ChannelSeam, opts: SummonOptions): ChannelAvailability {
  const override = opts.availability?.[channel.id];
  if (override !== undefined) {
    if (typeof override === "boolean") {
      // The durable terminal is never forced unavailable — that would re-open the drop hole.
      if (channel.kind === "durable-last-resort") return { configured: true, available: true, reason: "durable last-resort — always available (guaranteed terminal)." };
      return {
        configured: override,
        available: override,
        reason: override ? `(injected) ${channel.id} available.` : `(injected) ${channel.id} unavailable — chain proceeds to the next channel.`,
      };
    }
    if (channel.kind === "durable-last-resort") return { ...override, available: true };
    return override;
  }
  return channel.probe(channel);
}

// =============================================================================
// summon — walk the chain, deliver (or DRAFT) the FAP, never drop it.
// =============================================================================
export async function summon(fap: SummonFap, channels: ChannelSeam[] = defaultChannelChain(), opts: SummonOptions = {}): Promise<SummonResult> {
  const posture: Posture = opts.posture ?? "SHADOW";
  const chain = ensureDurableTerminal(channels);
  const attempts: SummonAttempt[] = [];
  const now = opts.now ?? Date.now();

  let delivered: ChannelSeam | null = null;
  let durableRecord: DurableEscalationRecord | null = null;

  for (const channel of chain) {
    const avail = resolveAvailability(channel, opts);
    const base = {
      channelId: channel.id,
      kind: channel.kind,
      priority: channel.priority,
      credential_ref: channel.credential_ref,
      configured: avail.configured,
      available: avail.available,
      posture,
    };

    // The durable last-resort terminal: ALWAYS records (both postures). This is the guaranteed reachability —
    // an audit persist, not a real-external-channel POST (so it is SHADOW-safe, like the dead-man-switch artifact).
    if (channel.kind === "durable-last-resort") {
      durableRecord = {
        kind: "durable-last-resort",
        goal_id: fap.goal_id,
        boundary_class: fap.boundary_class,
        source: fap.source,
        posture,
        recorded_at: new Date(now).toISOString(),
        reason:
          attempts.length === 0
            ? "no primary/fallback channel was available — escalated directly to the durable last-resort."
            : `all ${attempts.length} prior channel(s) were unavailable or could not deliver — escalated to the durable last-resort.`,
        fap,
        prior_attempts: [...attempts],
        cannot_be_lost: true,
        note: "a persisted summon that cannot be lost — the founder is reachable at this boundary even with Slack and the whole SaaS down.",
      };
      attempts.push({ ...base, outcome: "escalated-durable", sent: false, reason: durableRecord.reason });
      delivered = channel;
      break;
    }

    // A real channel that is unavailable (creds absent / down) → fail over to the next.
    if (!avail.available) {
      attempts.push({ ...base, outcome: "skipped-unavailable", sent: false, reason: avail.reason });
      continue;
    }

    // Available real channel.
    if (posture === "SHADOW") {
      // DRAFT-DON'T-SEND: stop at the first available channel and COMPOSE the would-deliver. `send` is NEVER
      // invoked. Even if the credential_ref env var is set, NO real POST happens (sent:false).
      attempts.push({
        ...base,
        outcome: "drafted-would-deliver",
        sent: false,
        reason: `SHADOW: would deliver the FAP via ${channel.label} (${avail.reason}) — DRAFTED, not sent (real send is the enforce-flip + Sprint 5.3).`,
      });
      delivered = channel;
      break;
    }

    // ENFORCE: prove the real-send capability against the injected (local/test) sink only.
    if (!opts.send) {
      // No send seam wired → ENFORCE cannot really reach this channel (real Slack/SMS providers are 5.3).
      attempts.push({
        ...base,
        outcome: "available-unsendable-no-seam",
        sent: false,
        reason: `ENFORCE but no send seam wired — ${channel.label} is configured but no provisioned provider (Sprint 5.3); cannot really deliver → fail over.`,
      });
      continue;
    }
    let res: { ok: boolean; ref?: string; note?: string };
    try {
      res = await opts.send(channel, fap);
    } catch (e) {
      res = { ok: false, note: `send threw: ${(e as Error).message}` };
    }
    if (res.ok) {
      attempts.push({
        ...base,
        outcome: "delivered",
        sent: true,
        delivery_ref: res.ref,
        reason: `ENFORCE: delivered to the ${channel.label} sink (${res.note ?? "ok"}).`,
      });
      delivered = channel;
      break;
    }
    attempts.push({
      ...base,
      outcome: "send-failed",
      sent: false,
      reason: `ENFORCE: send to ${channel.label} FAILED (${res.note ?? "no detail"}) → fail over to the next channel.`,
    });
  }

  // STRUCTURAL anti-drop: the durable terminal guarantees `delivered` is set. If — impossibly — it is not, this
  // is a programming error, not a dropped summon; surface it loudly rather than return a silent loss.
  if (!delivered) {
    throw new Error("founder-summon-c1: INVARIANT VIOLATION — the chain produced no durable terminal; a summon must never be droppable. Check ensureDurableTerminal.");
  }

  return {
    goal_id: fap.goal_id,
    boundary_class: fap.boundary_class,
    source: fap.source,
    posture,
    delivered_via: delivered.id,
    delivered_kind: delivered.kind,
    escalated: delivered.kind === "durable-last-resort",
    dropped: false,
    attempts,
    durable_record: durableRecord,
    fap,
  };
}
