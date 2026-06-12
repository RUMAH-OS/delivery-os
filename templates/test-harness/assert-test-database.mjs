// Delivery OS test-harness guard (scaffolder-installed into tests/helpers/; QA-owned thereafter).
// EVERY test entrypoint that touches a database calls this FIRST. Tests may only ever run against a
// database whose name ends in `_test` — the live/review store is never writable from a test run.
// Earned: a shared live store was destroyed by a test run during a shared-resource race; the guarded
// `*_test` convention has been cited in every independent verification since.
export function assertTestDatabase(connectionString) {
  const url = String(connectionString || process.env.DATABASE_URL || "");
  const dbName = (url.split("/").pop() || "").split("?")[0];
  if (!/_test$/.test(dbName)) {
    throw new Error(
      `REFUSED: tests must run against a *_test database (got "${dbName || "<empty>"}"). ` +
      `Point DATABASE_URL at <name>_test. This guard exists because a live store was once ` +
      `destroyed by a test run — it does not have an override flag on purpose.`
    );
  }
  return url;
}
