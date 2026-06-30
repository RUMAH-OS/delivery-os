// =============================================================================
// governance-engine — REFERENCE POSTGRES ADAPTER · barrel.
// =============================================================================
// The single import surface a consumer copies/adapts to wire `createGovernanceRuntime` onto Postgres. It
// implements all 6 ports the engine declares:
//   * RuntimeStoresPort        ← createPostgresRuntimeStores(sql)   (verbatim admin runtime-stores.ts SQL)
//   * GoalContractStorePort    ← createPostgresGoalContractStore(sql) (verbatim admin goal-contract.ts SQL)
//   * ProbeReaderPort + CredentialResolver ← makeReadOnlySqlReader / sqlCredentialResolver (verbatim)
//   * ConfigReadinessPort      ← makeEnvConfigReadiness()           (generic reference oracle)
//   * NotifierPort             ← makeWebhookNotifier()              (draft-don't-send by default)
//   * FounderBindingPort       ← makeFounderBinding()               (fail-closed)
//
// Plus the connection + template-migration helpers (`openPostgres`, `applyTemplateMigrations`,
// `dropTemplateMigrations`). This whole directory is OUTSIDE the residency-guarded organ surface (it MAY import
// the `postgres` driver) — it is the consumer plane, not the engine.
//
// Composition sketch (a consumer):
//   const sql = openPostgres(process.env.DATABASE_URL!);
//   const runtime = createGovernanceRuntime({
//     runtimeStores:     createPostgresRuntimeStores(sql),
//     goalContractStore: createPostgresGoalContractStore(sql),
//     credentialResolver: sqlCredentialResolver({ PROBE_RO_URL: process.env.PROBE_RO_URL! }),
//     configReadiness:   makeEnvConfigReadiness(),
//     notifier:          makeWebhookNotifier({ webhooks: { C1_SLACK_WEBHOOK: process.env.C1_SLACK_WEBHOOK! } }),
//     founderBinding:    makeFounderBinding(),
//   });
// =============================================================================

export { createPostgresRuntimeStores } from "./runtime-stores.js";
export { createPostgresGoalContractStore } from "./goal-contract.js";
export { makeReadOnlySqlReader, sqlCredentialResolver } from "./probe-reader.js";
export { makeEnvConfigReadiness, makeWebhookNotifier, makeFounderBinding } from "./plane.js";
export type {
  EnvConfigReadinessOptions,
  WebhookNotifierOptions,
  FounderBindingOptions,
} from "./plane.js";
export {
  openPostgres,
  applyTemplateMigrations,
  dropTemplateMigrations,
  deAdmin,
} from "./connection.js";
export type { Sql, OpenPostgresOptions, ApplyMigrationsOptions } from "./connection.js";
