// The demo app's engine tables for EngineContext.tables — IMPORTED from the engine's SHIPPED drizzle schema,
// NOT hand-typed. This is the platform-debt closure (Item B): the engine ships its DDL AND its drizzle table
// objects, so an installer (this demo = the PLOS install path) no longer re-types workflow_run/workflow_step/
// outbox/workflow_approval_audit (+ the await/runner/agent columns). The app imports them from the vendored
// engine barrel and owns only the DDL application (migrations/) + the instance rows.
//
// The app imports ONLY the vendored engine (.claude/os/engine) — zero rumah-admin coupling. An installer with
// a richer outbox (extra business columns) would define its own outbox and pass that instead; this demo reuses
// the engine's minimal shipped outbox shape.

export {
  workflowRun,
  workflowStep,
  outbox,
  workflowApprovalAudit,
} from "../../.claude/os/engine/index.js";
