// The demo app's OWN Drizzle table objects for the engine's EngineContext.tables.
// The engine declares the SHAPE it needs (EngineTables = { workflowRun, workflowStep, outbox }); the APP owns
// the concrete instance + the column-level types. These definitions MATCH the canonical engine DDL applied in
// migrations/0001_engine_core.sql + 0002_engine_await_loop.sql.
//
// FLAG (candidate future polish): redefining the engine tables here is BOILERPLATE every installer repeats
// (Admin has the identical block in its src/db/schema.ts). The engine ships the DDL but NOT a drizzle schema,
// so each app re-types it. A future engine could ship its drizzle table objects (typed) for apps to import,
// leaving the app to own only the DDL application + instance rows. Proceeding with the hand-rolled definitions.

import { pgTable, uuid, text, integer, boolean, jsonb, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";

// workflow_run — the live current-truth row backing the 7-state machine.
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

// workflow_step — the leasable unit (lease_until/lease_token, checkpoint, the Slice-1 await + verified-loop cols).
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
    awaitSource: text("await_source"),
    awaitingEventId: uuid("awaiting_event_id"),
    stopCondition: jsonb("stop_condition"),
    verdict: jsonb("verdict"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    runSeqUq: uniqueIndex("workflow_step_run_seq_uniq").on(t.runId, t.seq),
    runIdx: index("workflow_step_run_idx").on(t.runId),
    awaitingEventUq: uniqueIndex("workflow_step_awaiting_event_uniq").on(t.awaitingEventId),
  }),
);

// outbox — APP-owned infra (the engine EMITS to it transactionally; it does not own the table). The engine
// inserts { type, aggregateType, aggregateId, payload } in the SAME txn as each state write (transactional outbox).
export const outbox = pgTable("outbox", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: text("type").notNull(),
  aggregateType: text("aggregate_type").notNull(),
  aggregateId: uuid("aggregate_id").notNull(),
  payload: jsonb("payload"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
});

// workflow_approval_audit — the human-gate audit (engine approvals route needs this in tables). The demo's
// trivial workflow never opens a human gate, but createCapabilityRuntime wires the approvals route, which
// references this table shape — so the app supplies it for completeness.
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
