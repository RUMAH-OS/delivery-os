// Test helper — set a well-formed but UNUSED DATABASE_URL before the db/client singleton module evaluates.
// The M3a adapter-callback proof is DB-FREE: it exercises only the HTTP registration surface + the synthesized
// proxy handler + the cross-process callback executor, none of which touch the DB. But importing the OS runtime
// / server pulls src/db/client.ts, which constructs a postgres-js client at module load and REQUIRES a
// DATABASE_URL to be present. postgres-js connects LAZILY (only on the first query), and this proof never issues
// a query (never enqueues/ticks/hits a DB-backed endpoint), so a bogus URL is never dialed. Importing THIS file
// first (before any src import) guarantees the env var is set in time.
//
// Only sets the var when unset, so a verifier running with a real ambient DATABASE_URL is unaffected (the proof
// still never queries it).
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgres://os:os@127.0.0.1:5433/os_m3a_fake_never_dialed";
}
