// PROJECT OWNER — the conversational CORE of the Delivery OS Control Surface. CHANNEL-AGNOSTIC by construction:
// it imports NO @slack/bolt and touches NO transport. An adapter (adapters/slack/slack-app.ts today; Teams/Web/
// Voice tomorrow) translates its channel event -> a POInput and renders the POReply back. Reuse is free.
//
// THE LOOP, per founder message:
//   input (founder text + threadId + context)
//     -> CLASSIFY intent (keyword-first, LLM for the rest — intent.ts)
//     -> DISPATCH to a capability (real READ tools: gh, health; create_goal wired to the goals-client via
//        handleGoal; approve honestly stubbed — a human JWT is required and we NEVER fabricate an approval)
//     -> COMPOSE a founder-facing reply whose FACTS come verbatim from the tool output (the LLM may only add a
//        short phrasing lead-in; it never invents operational state — ops-truth-integration discipline)
//     -> record both turns in the conversation store (multi-turn memory; durable backend plugs in behind it)
//
// HONESTY (the load-bearing invariant, inherited from handleGoal.deriveVerdict): a response reflects real tool
// output or an honest "not wired / could not look" — never a plausible-sounding fabrication.

import { classifyIntent, type Classification, type Intent } from "./intent.js";
import type { LlmClient } from "./llm.js";
import { InMemoryConversationStore, type ConversationStore, type Turn } from "./conversation-store.js";
import * as gh from "./tools/gh-tools.js";
import * as health from "./tools/health-tools.js";
import { handleGoal } from "./handle-goal.js";
import type { GoalsClient } from "./goals-client.js";
import type { ApprovalsClient } from "./approvals-client.js";

export interface POInput {
  threadId: string; // opaque conversation id the adapter supplies (Slack thread_ts, web session id, ...)
  text: string; // the founder's raw message
  userId?: string; // opaque actor id (for auditing; PII-free ref)
  now?: number; // injectable clock (tests); defaults to Date.now()
}

export interface POReply {
  reply: string; // the founder-facing text the adapter renders
  intent: Intent; // what we routed to
  classification: Classification; // how we decided (keyword/llm/fallback + confidence)
  dispatched: "real" | "stub"; // did a REAL capability run, or an honest stub?
  facts: string; // the raw factual block (pre-phrasing) — the source of truth for the reply
}

// The read/act tools, injectable so a test can substitute — but the proof runs them REAL. Defaults = the real
// gh/health modules; create_goal + approve take the HTTP clients if the deployment wires them.
export interface ProjectOwnerDeps {
  llm?: LlmClient; // classification + optional phrasing. Absent -> keyword-only + deterministic composition.
  store?: ConversationStore; // multi-turn memory. Defaults to the in-memory v1 store.
  goalsClient?: GoalsClient; // wires create_goal (POST /v1/goals via handleGoal). Absent -> honest stub.
  approvalsClient?: ApprovalsClient; // enables the pending-approvals READ. Resolving still needs a human — stub.
  repos?: string[]; // the repo set to read. Absent -> resolved once from the org (gh repo list), cached.
  org?: string; // org for auto repo discovery (default RUMAH-OS).
  mounts?: health.MountConfig[]; // engine mounts to probe. Defaults to the live Admin + PLOS mounts.
  phrase?: boolean; // use the LLM for a phrasing lead-in (facts stay verbatim). Default false (deterministic).
  // seams for testing the read tools without shelling out (the proof leaves these as the REAL defaults).
  tools?: Partial<{
    listRepos: typeof gh.listRepos;
    listOpenPrs: typeof gh.listOpenPrs;
    listRecentMerges: typeof gh.listRecentMerges;
    probeMounts: typeof health.probeMounts;
  }>;
}

const OVERNIGHT_MS = 16 * 60 * 60 * 1000; // "overnight / recently" window = last 16h

export class ProjectOwner {
  private readonly llm?: LlmClient;
  private readonly store: ConversationStore;
  private readonly goalsClient?: GoalsClient;
  private readonly approvalsClient?: ApprovalsClient;
  private readonly org: string;
  private reposCache?: string[];
  private readonly mounts: health.MountConfig[];
  private readonly phrase: boolean;
  private readonly t: Required<NonNullable<ProjectOwnerDeps["tools"]>>;

  constructor(deps: ProjectOwnerDeps = {}) {
    this.llm = deps.llm;
    this.store = deps.store ?? new InMemoryConversationStore();
    this.goalsClient = deps.goalsClient;
    this.approvalsClient = deps.approvalsClient;
    this.org = deps.org ?? "RUMAH-OS";
    this.reposCache = deps.repos;
    this.mounts = deps.mounts ?? health.DEFAULT_MOUNTS;
    this.phrase = deps.phrase ?? false;
    this.t = {
      listRepos: deps.tools?.listRepos ?? gh.listRepos,
      listOpenPrs: deps.tools?.listOpenPrs ?? gh.listOpenPrs,
      listRecentMerges: deps.tools?.listRecentMerges ?? gh.listRecentMerges,
      probeMounts: deps.tools?.probeMounts ?? health.probeMounts,
    };
  }

  // Resolve the repo set once (explicit list > org discovery). On discovery failure, return an honest error.
  private async repos(): Promise<{ ok: true; repos: string[] } | { ok: false; error: string }> {
    if (this.reposCache) return { ok: true, repos: this.reposCache };
    const r = await this.t.listRepos(this.org);
    if (!r.ok) return { ok: false, error: r.error };
    this.reposCache = r.repos;
    return { ok: true, repos: r.repos };
  }

  // THE entrypoint the adapter calls. Classifies, dispatches, composes, records, returns.
  async handle(input: POInput): Promise<POReply> {
    const now = input.now ?? Date.now();
    const text = (input.text ?? "").trim();
    await this.store.append(input.threadId, { role: "founder", text, at: now });

    const classification = await classifyIntent(text, this.llm);
    const { facts, dispatched } = await this.dispatch(classification.intent, text, input, now);

    const reply = await this.compose(classification.intent, facts);
    await this.store.append(input.threadId, { role: "owner", text: reply, at: now, intent: classification.intent });

    return { reply, intent: classification.intent, classification, dispatched, facts };
  }

  // ── DISPATCH: intent -> a factual block (from REAL tools) + whether a real capability or a stub ran. ──
  private async dispatch(
    intent: Intent,
    text: string,
    input: POInput,
    now: number,
  ): Promise<{ facts: string; dispatched: "real" | "stub" }> {
    switch (intent) {
      case "review_open_prs":
        return { facts: await this.factOpenPrs(), dispatched: "real" };
      case "show_blockers":
        return { facts: await this.factBlockers(now), dispatched: "real" };
      case "company_health":
        return { facts: await this.factCompanyHealth(now), dispatched: "real" };
      case "morning_digest":
        return { facts: await this.factMorningDigest(now), dispatched: "real" };
      case "create_goal":
        return this.factCreateGoal(text, input);
      case "approve":
        return this.factApprove(text);
      case "unknown":
      default:
        return { facts: this.factUnknown(text), dispatched: "stub" };
    }
  }

  // ── REAL read: open PRs across the org. ──
  private async factOpenPrs(): Promise<string> {
    const rr = await this.repos();
    if (!rr.ok) return `Could not read the repo list from ${this.org} (gh): ${rr.error}`;
    const { prs, errors } = await this.t.listOpenPrs(rr.repos);
    const lines: string[] = [`OPEN PULL REQUESTS across ${rr.repos.length} ${this.org} repos: ${prs.length} open`];
    if (prs.length === 0) lines.push("  (none open right now)");
    for (const p of prs) {
      const draft = p.isDraft ? " [draft]" : "";
      const chk =
        p.checks.failed > 0
          ? `checks: ${p.checks.failed} FAILING (${p.checks.failingNames.slice(0, 3).join(", ")})`
          : p.checks.pending > 0
            ? `checks: ${p.checks.pending} pending`
            : `checks: green`;
      lines.push(`  • ${p.repo}#${p.number}${draft} — ${p.title}  (@${p.author}; ${chk})`);
    }
    for (const e of errors) lines.push(`  ! ${e.repo}: could not read (${e.error})`);
    return lines.join("\n");
  }

  // ── REAL read: blockers = open non-draft PRs with failing checks, + what merged recently. ──
  private async factBlockers(now: number): Promise<string> {
    const rr = await this.repos();
    if (!rr.ok) return `Could not read the repo list from ${this.org} (gh): ${rr.error}`;
    const { prs, errors } = await this.t.listOpenPrs(rr.repos);
    const blockers = gh.blockersFrom(prs);
    const sinceIso = new Date(now - OVERNIGHT_MS).toISOString();
    const { merges } = await this.t.listRecentMerges(rr.repos, sinceIso);
    const mounts = await this.t.probeMounts(this.mounts);

    const lines: string[] = [`BLOCKERS / RECENT CHANGE (window: since ${sinceIso})`];
    lines.push(`  Blocked PRs (open, non-draft, ≥1 failing check): ${blockers.length}`);
    if (blockers.length === 0) lines.push("    (no PR is blocked on a failing check)");
    for (const b of blockers) {
      lines.push(`    ✗ ${b.repo}#${b.number} — ${b.title}  (@${b.author}; failing: ${b.checks.failingNames.slice(0, 3).join(", ")})`);
    }
    lines.push(`  Merged in window: ${merges.length}`);
    for (const m of merges.slice(0, 10)) lines.push(`    ✓ ${m.repo}#${m.number} — ${m.title}  (@${m.author})`);
    lines.push(`  Engine mounts: ${mounts.map((h) => `${h.name} ${h.reachable ? `up(${h.status})` : "DOWN"}`).join(", ")}`);
    for (const e of errors) lines.push(`  ! ${e.repo}: could not read (${e.error})`);
    return lines.join("\n");
  }

  // ── REAL read: company health = mount reachability + open-PR / blocker counts. ──
  private async factCompanyHealth(now: number): Promise<string> {
    const rr = await this.repos();
    const mounts = await this.t.probeMounts(this.mounts);
    const mountLine = `  Engine mounts: ${mounts.map((h) => `${h.name} ${h.reachable ? `reachable (HTTP ${h.status})` : "UNREACHABLE"}`).join(", ")}`;
    if (!rr.ok) {
      return [`COMPANY HEALTH (read-only)`, mountLine, `  Repos: could not read (${rr.error})`].join("\n");
    }
    const { prs, errors } = await this.t.listOpenPrs(rr.repos);
    const blockers = gh.blockersFrom(prs);
    const sinceIso = new Date(now - OVERNIGHT_MS).toISOString();
    const { merges } = await this.t.listRecentMerges(rr.repos, sinceIso);
    const lines = [
      `COMPANY HEALTH (read-only)`,
      mountLine,
      `  Repos watched: ${rr.repos.length} (${this.org})`,
      `  Open PRs: ${prs.length}  |  Blocked (failing checks): ${blockers.length}  |  Drafts: ${prs.filter((p) => p.isDraft).length}`,
      `  Merged in last 16h: ${merges.length}`,
    ];
    const anyDown = mounts.some((m) => !m.reachable);
    lines.push(
      `  Assessment: ${anyDown ? "a mount is UNREACHABLE — investigate" : blockers.length > 0 ? `${blockers.length} PR(s) blocked on failing checks` : "no blockers detected in the watched surface"} (shallow probe; deep engine/runner health is a noted gap).`,
    );
    for (const e of errors) lines.push(`  ! ${e.repo}: could not read (${e.error})`);
    return lines.join("\n");
  }

  // ── REAL read: the morning digest — health + blockers + overnight merges, founder-framed. ──
  private async factMorningDigest(now: number): Promise<string> {
    const healthBlock = await this.factCompanyHealth(now);
    const blockers = await this.factBlockers(now);
    return [`GOOD MORNING — here is where things stand.`, "", healthBlock, "", blockers, "", `Suggested focus: clear any blocked PRs above, then review the open PRs (ask me "review all open PRs").`].join("\n");
  }

  // ── create_goal: wire to the goals-client via handleGoal (POST /v1/goals). Honest stub if not configured. ──
  private async factCreateGoal(text: string, input: POInput): Promise<{ facts: string; dispatched: "real" | "stub" }> {
    const goalText = stripGoalPrefix(text);
    if (!this.goalsClient) {
      return {
        dispatched: "stub",
        facts:
          `GOAL CAPTURED (not wired in this deployment).\n` +
          `  goal: ${goalText || "(empty)"}\n` +
          `  When a goals-client is configured (GOALS_API_URL + a workflow:runtime+observe token), this will\n` +
          `  POST /v1/goals via handleGoal: deterministic capability selection (fail-closed), then observe the\n` +
          `  run to a terminal state and report the verified outcome back. Nothing was submitted.`,
      };
    }
    // REAL: run the existing, proven handler; collect its say() lines as the factual block.
    const lines: string[] = [];
    const say = (s: string) => {
      lines.push(s);
    };
    const idempotencyKey = `po-${input.threadId}-${hash(goalText)}`;
    await handleGoal(
      { text: goalText, idempotencyKey },
      { goalsClient: this.goalsClient, say, awaitOpts: { timeoutMs: 20_000, pollMs: 1_000 } },
    );
    return { dispatched: "real", facts: `CREATE GOAL -> /v1/goals\n${lines.join("\n")}` };
  }

  // ── approve: STUB by construction. Resolving a gate needs a VERIFIED-HUMAN JWT; we NEVER fabricate an
  //    approval. If an approvals-client is wired we may READ the pending inbox (a safe read), but we do not
  //    resolve. ──
  private async factApprove(text: string): Promise<{ facts: string; dispatched: "real" | "stub" }> {
    if (this.approvalsClient) {
      const r = await this.approvalsClient.listPending();
      if (r.kind === "ok") {
        const lines = [`PENDING APPROVALS (read-only): ${r.count}`];
        for (const p of r.pending) lines.push(`  • run ${p.runId} seq ${p.seq} (awaiting ${p.awaitingEventId ?? "?"})`);
        lines.push(
          `\nTo APPROVE/REJECT: a verified-human action is required — the engine rejects machine roles at the gate\n` +
            `by construction (human-principal). Resolving is NOT wired to this control surface yet (Slice: approvals);\n` +
            `it needs a per-operator human JWT with workflow:admin. I will not fabricate an approval.`,
        );
        return { dispatched: "stub", facts: lines.join("\n") };
      }
      return {
        dispatched: "stub",
        facts:
          `APPROVE requested. Could not read the pending inbox (${r.message}). Resolving a gate requires a\n` +
          `verified-human JWT (workflow:admin) — not wired here. No approval was made.`,
      };
    }
    return {
      dispatched: "stub",
      facts:
        `APPROVE requested: "${text}".\n` +
        `  Approvals are NOT wired to this control surface yet. Resolving a human gate calls the ApprovalsClient\n` +
        `  (POST /v1/approvals with runId, seq, awaitingEventId, actionId, decision) and REQUIRES a verified-human\n` +
        `  JWT carrying workflow:admin — the engine rejects machine roles at the gate by construction. I will not\n` +
        `  fabricate an approval. (Wiring: Slice — approvals; needs a Slack-user -> human-JWT mapping.)`,
    };
  }

  private factUnknown(text: string): string {
    return [
      `I did not recognise that as one of my capabilities, so I did nothing (fail-closed).`,
      text ? `> ${text}` : ``,
      `I can:`,
      `  • "review all open PRs"          — open PRs across the org, with check status`,
      `  • "show blockers" / "what changed overnight" — failing checks, stuck PRs, recent merges, mount health`,
      `  • "summarize company health"     — mounts + open-PR/blocker counts (read-only)`,
      `  • "create a goal: <what>"        — submit a goal to Delivery OS (routed, executed, verified)`,
      `  • "approve <...>"                — (stub) needs a verified-human JWT; I never fabricate approvals`,
      `  • "good morning" / "what should I work on" — a status digest`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  // ── COMPOSE: the FACTS are always the tool block, verbatim. If phrasing is enabled AND a model is present,
  //    prepend a short natural-language lead-in — the model is told to add NO facts; on any failure we return
  //    the facts alone. This is where "the LLM phrases the response" lives WITHOUT letting it invent state. ──
  private async compose(intent: Intent, facts: string): Promise<string> {
    if (!this.phrase || !this.llm || intent === "unknown") return facts;
    try {
      const lead = await this.llm.complete(
        [
          "You are a software company's Project Owner speaking to the founder in a chat.",
          "Write ONE short sentence (max 20 words) introducing the status below, in a calm, factual voice.",
          "Do NOT add, infer, or embellish ANY facts, numbers, names, or judgements — only the report below is truth.",
          "Return only that one sentence, no preamble.",
          "",
          "STATUS:",
          facts,
        ].join("\n"),
        { timeoutMs: 30_000 },
      );
      const lead1 = lead.split("\n").map((s) => s.trim()).filter(Boolean)[0] ?? "";
      return lead1 ? `${lead1}\n\n${facts}` : facts;
    } catch {
      return facts; // model unavailable -> the facts stand alone. Never blocks a truthful reply.
    }
  }

  // introspection for adapters/tests.
  recentTurns(threadId: string, limit?: number): Turn[] | Promise<Turn[]> {
    return this.store.recent(threadId, limit);
  }
}

// strip a leading "create a goal:" / "start a sprint to" style prefix so the goal text is clean.
function stripGoalPrefix(text: string): string {
  return text
    .replace(/^\s*\/?goal[:\s]+/i, "")
    .replace(/^\s*(please\s+)?(create|start|kick ?off|launch|open|submit)\s+(a|an|the)?\s*(new\s+)?(goal|sprint|task|milestone|workstream)\s*(to|:|that|for|-)?\s*/i, "")
    .trim();
}

// a tiny stable hash (djb2) for idempotency keys — deterministic across retries of the same goal text.
function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

export { stripGoalPrefix };
