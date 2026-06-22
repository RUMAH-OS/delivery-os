// The demo app's OWN Drizzle client (its db plane). Supplied to the engine as EngineContext.db.
// A real 2nd app uses its own connection config; this reads DATABASE_URL (the throwaway demo Postgres).
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

export const DATABASE_URL =
  process.env.DATABASE_URL ??
  // throwaway demo default: a DISTINCT port (55433) + db-name from Admin's test DB. NEVER prod.
  "postgres://postgres:postgres@localhost:55433/engine_demo";

// max:1 keeps the demo deterministic (one connection, sequential ticks). A real app tunes this.
export const sql = postgres(DATABASE_URL, { max: 1 });
export const db = drizzle(sql);
