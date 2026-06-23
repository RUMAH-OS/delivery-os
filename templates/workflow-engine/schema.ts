// Workflow Engine — the SHIPPED Drizzle table objects (CANONICAL). The engine ships its DDL (migrations/) AND
// — from here — the matching Drizzle table objects, so an installer does NOT re-type the engine's tables to
// build EngineContext.tables. These definitions match the canonical engine migration set EXACTLY:
//   workflow_run            <- 0001_engine_core.sql
//   workflow_step           <- 0001 + 0002 (await/loop) + 0003 (runner claim/lease) + 0004 (agent requirement/id)
//   workflow_approval_audit <- 0002_engine_await_loop.sql
//
// DOMAIN-FREE by construction: these are the engine's own tables only — no app/business tables, no app names.
//
// OUTBOX OWNERSHIP: the engine EMITS to an outbox but does NOT own that table (it is app/installer infra — see
// 0001_engine_core.sql C5 + the per-installer outbox migration). The engine ships a MINIMAL outbox table object
// matching the shape the engine writes ({ type, aggregateType, aggregateId, payload }) for convenience, so a
// trivial installer can reuse it; an installer that owns a richer outbox (extra columns, retention/ack) defines
// its own and passes that as EngineContext.tables.outbox instead. The engine only ever reads/writes the four
// columns it inserts.
//
// USAGE (installer):
//   import { workflowRun, workflowStep, outbox, workflowApprovalAudit } from "<vendored-engine>/schema.js";
//   const ctx: EngineContext = { db, tables: { workflowRun, workflowStep, outbox } };
//   // (workflowApprovalAudit is wired into the approvals route via createCapabilityRuntime's context.)

import { pgTable, uuid, text, integer, boolean, jsonb, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";

// workflow_run — the live current-truth row backing the 7-state machine (0001).
export const workflowRun = pgTable(
  "workflow_run",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    definitionKey: text("definition_key").notNull(),
    state: text("state").notNull().default("queued"),
    input: jsonb("input"),
    idempotencyKey: text("idempotency_key"),
    attempt: integer("attempt").notNull().default(0),
    wasInterrupted: boolean("was_interrupted").notNull().default(false),
    blockedReason: text("blocked_reason"),
    nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
    terminalAt: timestamp("terminal_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idemUq: uniqueIndex("workflow_run_idem_uniq").on(t.definitionKey, t.idempotencyKey),
    activeIdx: index("workflow_run_active_idx").on(t.state),
  }),
);

// workflow_step — the leasable unit (0001) + await/verified-loop columns (0002) + runner claim/lease (0003)
// + per-step agent requirement/resolved id (0004).
export const workflowStep = pgTable(
  "workflow_step",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id").notNull().references(() => workflowRun.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
    state: text("state").notNull().default("ready"),
    stepType: text("step_type").notNull(),
    owner: text("owner").notNull(),
    skill: text("skill"),
    ku: text("ku"),
    handler: text("handler").notNull(),
    effect: text("effect").notNull().default("emit-only"),
    leaseUntil: timestamp("lease_until", { withTimezone: true }),
    leaseToken: uuid("lease_token"),
    attempt: integer("attempt").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
    checkpoint: jsonb("checkpoint"),
    result: jsonb("result"),
    error: jsonb("error"),
    // ── await primitive + verified-loop declarative columns (0002) ──
    awaitSource: text("await_source"),
    awaitingEventId: uuid("awaiting_event_id"),
    stopCondition: jsonb("stop_condition"),
    verdict: jsonb("verdict"),
    // ── agent-runner claim/lease (0003) ──
    runnerId: text("runner_id"),
    runnerClaimedAt: timestamp("runner_claimed_at", { withTimezone: true }),
    runnerLeaseExpiresAt: timestamp("runner_lease_expires_at", { withTimezone: true }),
    // ── multi-agent: declared requirement + resolved agent id (0004) ──
    agentRequirement: jsonb("agent_requirement"),
    agentId: text("agent_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    runSeqUq: uniqueIndex("workflow_step_run_seq_uniq").on(t.runId, t.seq),
    runIdx: index("workflow_step_run_idx").on(t.runId),
    awaitingEventUq: uniqueIndex("workflow_step_awaiting_event_uniq").on(t.awaitingEventId),
    agentIdIdx: index("workflow_step_agent_id_idx").on(t.agentId),
  }),
);

// outbox — INSTALLER-OWNED infra (the engine emits to it transactionally). Shipped here as the MINIMAL shape
// the engine writes; an installer with a richer outbox defines its own and passes that instead.
export const outbox = pgTable("outbox", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: text("type").notNull(),
  aggregateType: text("aggregate_type").notNull(),
  aggregateId: uuid("aggregate_id").notNull(),
  payload: jsonb("payload"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
});

// workflow_approval_audit — the append-only human-gate audit (0002). Wired into the approvals route.
export const workflowApprovalAudit = pgTable(
  "workflow_approval_audit",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id").notNull().references(() => workflowRun.id, { onDelete: "cascade" }),
    stepSeq: integer("step_seq").notNull(),
    awaitingEventId: uuid("awaiting_event_id").notNull(),
    actionId: text("action_id").notNull(),
    decision: text("decision").notNull(),
    actorSub: text("actor_sub").notNull(),
    actorEmail: text("actor_email"),
    actorRole: text("actor_role"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    runIdx: index("workflow_approval_audit_run_idx").on(t.runId, t.stepSeq),
    actionUq: uniqueIndex("workflow_approval_audit_action_uniq").on(t.actionId),
  }),
);
