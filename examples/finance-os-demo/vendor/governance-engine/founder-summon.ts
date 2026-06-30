// =============================================================================
// The Founder Summon Delivery (C1 core) — GUARANTEED-REACHABILITY FAP delivery
// (RS-DOS-v1 C1 / §3.1 / §3.3 / §14 F14 / §20 J-summons).
// =============================================================================
// PLATFORM EXTRACTION SLICE 4 — the port-injected mirror of `rumah-admin/src/founder-summon-c1.ts`. The DELIVERY
// behind the FAP draft-don't-send seams: given a FAP, it reaches the founder over a PRIORITIZED CHANNEL CHAIN
// with one load-bearing property —
//
//   ── A SUMMON IS NEVER SILENTLY DROPPED. ──
//   The chain is PRIMARY (Slack) → NON-SaaS FALLBACK (SMS/email — independent of the primary SaaS) →
//   LAST-RESORT ESCALATION (a durably-recorded summon that CANNOT be lost). This is enforced STRUCTURALLY, not
//   by discipline: `summon` always appends a durable last-resort terminal (`ensureDurableTerminal`), that
//   terminal is ALWAYS available (recording an audit row needs no external SaaS), and `if (!delivered) throw`
//   makes a dropped summon un-returnable. `dropped` is typed `false`. (F14.)
//
// WHAT CHANGED vs admin (and ONLY this): the `process.env` RESIDENCY. Admin's `defaultProbe` read a channel's
// availability straight from `process.env[credential_ref]` (the residency coupling), and the real-send seam was a
// loose `SendSeam`. THIS module reads NO `process.env` — channel availability resolves through the INJECTED
// `NotifierPort` (`isConfigured(credential_ref)`), and the real send crosses `NotifierPort.send` (the `SendSeam`
// remains accepted verbatim for offline tests). The package's `defaultProbe` is residency-clean: with NO notifier
// a real channel is "configured-but-shadowed / unavailable" (so the chain escalates DURABLY — never drops). The
// chain walk, `ensureDurableTerminal`, the `if (!delivered) throw` anti-drop, and the three FAP-source adapters
// are BYTE-FOR-BYTE the verified admin logic. Residency is enforced by `residency-guard.mjs`.
//
// ── SHADOW posture (unchanged) ──
//   DEFAULT = SHADOW: `summon` COMPOSES the would-deliver (chosen channel + the full fail-over chain + the FAP)
//   and DRAFTS it — it does NOT POST to a real channel even if a channel reports configured (`send` is never
//   invoked in SHADOW; every attempt carries `sent:false`). ENFORCE proves the real-send CAPABILITY against an
//   injected (local/test) send seam only. With no send seam wired, even ENFORCE escalates DURABLY — never drops.
//
// This module is PURE — no fs, no network, no DB, no `process.env`. It computes the delivery PLAN + outcome and
// returns the durable escalation record as DATA.
// =============================================================================

import type { HaltAndFap, FounderActionPackage as GsFap } from "./goal-supervisor.js";
import type { PreflightVerdict } from "./preflight.js";
import type { CompletionReview } from "./completion-review.js";
import type { NotifierPort } from "./ports.js";

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

/** Which runtime organ drafted this FAP (provenance — the three boundary sources this delivery serves). */
export type FapSource = "goal-supervisor-c7" | "preflight-gate-c9" | "completion-review-c6";

/** The COMMON FAP shape (§3.1: status · what-I-completed · what-remains · WHY-I-stopped · exactly-what-to-do ·
 *  rollback · the resume command). One envelope, three producers. */
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
// FAP SOURCE COMPOSITION — adapt each organ's output into the common SummonFap. (type-only imports above.)
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

/** Completion review (C6 §9.2) INCOMPLETE/unreachable verdict → a boundary FAP. The summon branch hands the
 *  founder the decision with the re-probe evidence (§3.1 feasibility class). */
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
  /** availability resolver (default = the residency-clean defaultProbe; durable = always available). */
  probe: ChannelProbe;
}

/** Default probe (RESIDENCY-CLEAN — reads NO `process.env`): the durable last-resort is always available; a
 *  real channel is "configured-but-shadowed / unavailable" UNLESS the injected NotifierPort (`opts.notifier`)
 *  reports it configured. (Admin read `process.env[credential_ref]` here — the one residency coupling extraction
 *  closes.) With no notifier, real channels are unavailable and the chain escalates DURABLY — never drops. */
export function defaultProbe(channel: ChannelSeam): ChannelAvailability {
  if (channel.kind === "durable-last-resort") {
    return { configured: true, available: true, reason: "durable last-resort — records a persisted audit row; needs no external SaaS (guaranteed terminal)." };
  }
  const ref = channel.credential_ref;
  return {
    configured: false,
    available: false,
    reason: `credential_ref ${ref ?? "(none)"} availability is resolved by the injected NotifierPort — none supplied → configured-but-shadowed / unavailable; chain proceeds to the next channel.`,
  };
}

/** Resolve a real channel's availability from the injected NotifierPort (`isConfigured`). The durable last-resort
 *  is always available (the structural anti-drop terminal). Replaces admin's `process.env[ref]` read. */
function notifierAvailability(channel: ChannelSeam, notifier: NotifierPort): ChannelAvailability {
  if (channel.kind === "durable-last-resort") {
    return { configured: true, available: true, reason: "durable last-resort — records a persisted audit row; needs no external SaaS (guaranteed terminal)." };
  }
  const ref = channel.credential_ref;
  const configured = notifier.isConfigured(ref);
  return configured
    ? { configured: true, available: true, reason: `credential_ref ${ref} is configured (NotifierPort.isConfigured).` }
    : { configured: false, available: false, reason: `credential_ref ${ref ?? "(none)"} not configured (NotifierPort) — configured-but-shadowed / unavailable; chain proceeds to the next channel.` };
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
      label: "Slack (the C1 founder surface)",
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

/** The durable last-resort record — the guaranteed-reachability terminal. Persisted by the consumer to the
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
  /** present iff escalated — the durable record the consumer persists. */
  durable_record: DurableEscalationRecord | null;
  fap: SummonFap;
}

export type Posture = "SHADOW" | "ENFORCE";

/** The real-send seam (ENFORCE only). Default: NONE. In ENFORCE, a non-durable channel can really deliver ONLY
 *  if a `send` seam is injected (directly or via `NotifierPort.send`) — proving the capability against a
 *  LOCAL/TEST sink. NEVER invoked in SHADOW. */
export type SendSeam = (channel: ChannelSeam, fap: SummonFap) => Promise<{ ok: boolean; ref?: string; note?: string }>;

export interface SummonOptions {
  posture?: Posture; // default SHADOW
  /** per-channel availability override (test injection): id → boolean | full ChannelAvailability. */
  availability?: Record<string, boolean | ChannelAvailability>;
  /** the INJECTED NotifierPort — resolves channel availability (`isConfigured`) and supplies the real-send seam
   *  (`send`). Replaces admin's `process.env` read. Absent → real channels are unavailable (escalate durably). */
  notifier?: NotifierPort;
  /** the real-send seam (ENFORCE). Takes precedence over `notifier.send`. Absent (and no notifier.send) →
   *  ENFORCE cannot really reach a real channel → escalates durably. */
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
  // No override: resolve through the injected NotifierPort (the residency-clean availability seam); with no
  // notifier, fall back to the channel's own (residency-clean) probe — real channels unavailable, durable on.
  if (opts.notifier) return notifierAvailability(channel, opts.notifier);
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

  // The effective real-send seam: an explicit `send` (verbatim test path) takes precedence; else the injected
  // NotifierPort.send (the port real-send seam) adapted to the SendSeam shape; else NONE (escalate durably).
  const send: SendSeam | undefined =
    opts.send ??
    (opts.notifier?.send
      ? (channel, f) => opts.notifier!.send!({ id: channel.id, credentialRef: channel.credential_ref }, f) as Promise<{ ok: boolean; ref?: string; note?: string }>
      : undefined);

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
    // an audit persist, not a real-external-channel POST (so it is SHADOW-safe).
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
      // invoked. Even if the channel reports configured, NO real POST happens (sent:false).
      attempts.push({
        ...base,
        outcome: "drafted-would-deliver",
        sent: false,
        reason: `SHADOW: would deliver the FAP via ${channel.label} (${avail.reason}) — DRAFTED, not sent (real send is the enforce-flip).`,
      });
      delivered = channel;
      break;
    }

    // ENFORCE: prove the real-send capability against the injected (local/test) sink only.
    if (!send) {
      // No send seam wired → ENFORCE cannot really reach this channel (real Slack/SMS providers are a later step).
      attempts.push({
        ...base,
        outcome: "available-unsendable-no-seam",
        sent: false,
        reason: `ENFORCE but no send seam wired — ${channel.label} is configured but no provisioned provider; cannot really deliver → fail over.`,
      });
      continue;
    }
    let res: { ok: boolean; ref?: string; note?: string };
    try {
      res = await send(channel, fap);
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
    throw new Error("founder-summon: INVARIANT VIOLATION — the chain produced no durable terminal; a summon must never be droppable. Check ensureDurableTerminal.");
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
