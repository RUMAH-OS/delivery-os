// =============================================================================
// THE BARE-OS SURVIVAL BATTERY (E-PH M1 scope) — PLATFORM-HOME-EXTRACTION.md §2.2 steps 1–3.
// =============================================================================
// Proves the platform-independence invariant (I-PI) at M1 scope against a LOCAL throwaway Postgres:
//   (a) the OS app BOOTS with ZERO tenant programs registered;
//   (b) the OS migrations apply CLEAN (and idempotently) on a bare platform DB — no tenant schema;
//   (c) the reconciler tick loop runs IDLE without error on an empty portfolio;
//   (d) a GoalContract is created + driven through its full legal lifecycle (CREATED→…→DONE) with ZERO tenant
//       packs, and EACH transition writes exactly one stamped goal_contract_event (the PR-#50 dual-write, I13).
// Plus: the illegal-edge dual-write atomicity, the fail-closed goal front door, and the vendor→consume FLIP
// (a capability registered at runtime becomes selectable — proving a tenant CONSUMES the OS without embedding).
//
// Requires a local Postgres via DATABASE_URL (see README bare-OS quickstart). Author≠verifier: this is the
// AUTHOR battery; the independent VERIFY doc (docs/VERIFY-platform-independence-M1.md) records the neutral run.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import postgres from "postgres";
import { databaseUrl } from "../src/env.js";
import { migrateUp } from "../src/db/migrate-core.js";
import { boot } from "../src/index.js";
import { sql } from "../src/db/client.js";
import {
  createContract,
  transition,
  readContract,
  GOAL_CONTRACT_TRANSITION_SCHEMA_ID,
  GOAL_CONTRACT_TRANSITION_SCHEMA_VERSION,
  DEFAULT_TRANSITION_ACTOR,
  type GoalState,
} from "../src/goal-contract.js";
import { reconcileTick, type ObservedState } from "../src/po-reconciler-c2.js";
import { reconcileSweep } from "../src/reconciler-loop.js";
import { beat, readHeartbeat } from "../src/heartbeat.js";
import type { CapabilityPack } from "../src/engine/capability-pack.js";
import type { OsEngineRuntime } from "../src/engine-runtime.js";
import type { Hono } from "hono";

let os: OsEngineRuntime;
let app: Hono<any>;
let stop: () => void;
let firstApplied = 0;
let discovered = 0;

beforeAll(async () => {
  // (b) MIGRATE on a bare DB via a dedicated connection, capturing the first-run apply count.
  const mig = postgres(databaseUrl(), { max: 1 });
  const r = await migrateUp(mig);
  await mig.end();
  firstApplied = r.applied;
  discovered = r.discovered;
  // (a) BOOT bare: construct the engine with zero tenant packs (migrate already done above; server/tick off).
  const booted = await boot({ migrate: false, serve: false, tick: false });
  os = booted.os;
  app = booted.app as Hono<any>;
  stop = booted.stop;
}, 60_000);

afterAll(async () => {
  stop?.();
  await sql.end({ timeout: 5 });
});

describe("step 1 — BARE BOOT (zero tenant packs) + migrations apply clean", () => {
  it("constructs the OS engine with ZERO registered tenant packs", () => {
    expect(os.registeredPackIds()).toEqual([]);
    expect(os.enqueueKeys()).toEqual([]);
    expect(os.selectors()).toEqual([]);
  });

  it("migrations applied clean on a bare DB (every OS migration, no tenant schema) and are idempotent", async () => {
    // First run applied every discovered file (fresh DB): 0000 role + 0001-0005 engine + 0006 outbox +
    // 0052/0053/0054/0055 platform spine = 11 forward migrations.
    expect(discovered).toBe(11);
    expect(firstApplied).toBe(discovered);
    // Idempotent re-run: nothing to apply.
    const mig = postgres(databaseUrl(), { max: 1 });
    const again = await migrateUp(mig);
    await mig.end();
    expect(again.applied).toBe(0);
    // The OS-owned tables exist; NO tenant domain table (invoice/property/contract) was created.
    const names = (await sql<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public'`).map((r) => r.tablename);
    expect(names).toContain("goal_contract");
    expect(names).toContain("goal_contract_event"); // PR #50
    expect(names).toContain("workflow_run");
    expect(names).toContain("engine_heartbeat");
    expect(names).not.toContain("invoice");
    expect(names).not.toContain("property");
    expect(names).not.toContain("contract");
  });

  it("the ledger recorded the OS migration set including 0053 + 0055 (PR #50)", async () => {
    const applied = (await sql<{ name: string }[]>`SELECT name FROM _migrations ORDER BY name`).map((r) => r.name);
    expect(applied).toContain("0000_platform_app_role.sql");
    expect(applied).toContain("0053_goal_contract.sql");
    expect(applied).toContain("0055_goalcontract_event_stream.sql");
  });

  it("GET /v1/health reports the bare OS (zeroTenants=true)", async () => {
    const res = await app.fetch(new Request("http://os/v1/health"));
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.zeroTenants).toBe(true);
    expect(body.tenantPackCount).toBe(0);
  });
});

describe("step 2 — BARE PO + RECONCILER idle on an empty portfolio", () => {
  it("a reconciler sweep over an EMPTY portfolio is a legal idle no-op (no error)", async () => {
    const sweep = await reconcileSweep();
    expect(sweep.swept).toBe(0);
    expect(sweep.transitions).toBe(0);
  });

  it("a full heartbeat beat (stamp → engine tick → reconciler sweep) runs idle and arms the dead-man switch", async () => {
    const b = await beat(os);
    expect(b.engineTick.advanced).toBe(false); // no runs enqueued on a bare OS → idle engine tick
    expect(b.reconciler.swept).toBe(0);
    const last = await readHeartbeat();
    expect(last).not.toBeNull(); // liveness armed
  });
});

describe("step 3 — BARE GOAL LIFECYCLE with stamped events (zero tenant packs)", () => {
  const PATH: GoalState[] = ["CREATED", "FEASIBILITY", "ACTIVE", "PLANNING", "EXECUTING", "REVIEWING", "DONE"];

  it("drives CREATED→…→DONE and stamps exactly one goal_contract_event per transition (dual-write)", async () => {
    const c = await createContract({
      objective: "run the OS health probe (platform self-goal — needs no tenant)",
      acceptanceMetric: "os.health_probe.ok",
      metricSourceProbeId: "os.health-probe",
      metricSourceVersion: 1,
      dataClass: "INTERNAL",
    });
    expect(c.state).toBe("CREATED");
    const goalId = c.goalId;

    // Drive the admission edges via the SOLE door transition() (C9 pre-flight lands in M2):
    //   CREATED→FEASIBILITY→ACTIVE→PLANNING→EXECUTING→REVIEWING.
    for (let i = 1; i <= 5; i++) {
      const row = await transition(goalId, PATH[i]!);
      expect(row.state).toBe(PATH[i]);
    }
    // Drive the FINAL edge REVIEWING→DONE through the RECONCILER (po-reconciler-c2), the frozen SOLE MUTATOR,
    // in ENFORCE — proving the sole-mutator organ drives a real legal edge on a bare OS (acceptance met).
    const observed: ObservedState = {
      progressSeries: [], attempts: 0, cumulativeCostCents: 0, gsVerdict: null,
      currentMetricValue: 1, acceptance: { op: ">=", target: 1 },
    };
    const { plan, execution } = await reconcileTick(goalId, observed, { enforce: true });
    expect(plan.decision).toBe("TRANSITION_DONE");
    expect(execution.executed).toBe(true);
    expect(execution.resulting_state).toBe("DONE");

    const final = await readContract(goalId);
    expect(final!.state).toBe("DONE");

    // The dual-write: exactly one stamped event per transition, seq monotonic 1..6, correct from/to + stamp.
    const events = await sql<any[]>`
      SELECT seq, from_state, to_state, actor, schema_id, schema_version, tenant_id, stream_id, payload
      FROM goal_contract_event WHERE goal_contract_id = ${goalId} ORDER BY seq`;
    expect(events.length).toBe(6);
    for (let i = 0; i < 6; i++) {
      expect(Number(events[i].seq)).toBe(i + 1); // seq is bigint (postgres.js returns it as a string)
      expect(events[i].from_state).toBe(PATH[i]);
      expect(events[i].to_state).toBe(PATH[i + 1]);
      expect(events[i].actor).toBe(DEFAULT_TRANSITION_ACTOR); // po-reconciler-c2 (the sole mutator identity)
      expect(events[i].schema_id).toBe(GOAL_CONTRACT_TRANSITION_SCHEMA_ID);
      expect(events[i].schema_version).toBe(GOAL_CONTRACT_TRANSITION_SCHEMA_VERSION);
      expect(events[i].tenant_id).toBe("RUMAH"); // the I11 partition default (0055), stamped bare
      expect(events[i].stream_id).toBe("default");
      expect(events[i].payload.state_machine_version).toBe(1); // I12 self-versioning
    }
    // ZERO tenant packs throughout the whole lifecycle.
    expect(os.registeredPackIds()).toEqual([]);
  });

  it("an ILLEGAL edge is DB-rejected and writes NO event (dual-write atomicity, property d)", async () => {
    const c = await createContract({
      objective: "illegal-edge probe", acceptanceMetric: "x", metricSourceProbeId: "p", metricSourceVersion: 1, dataClass: "INTERNAL",
    });
    // CREATED→DONE is illegal (0053 trigger). transition() must throw and leave no event + no state change.
    await expect(transition(c.goalId, "DONE")).rejects.toThrow();
    const after = await readContract(c.goalId);
    expect(after!.state).toBe("CREATED");
    const evs = await sql<any[]>`SELECT count(*)::int AS n FROM goal_contract_event WHERE goal_contract_id = ${c.goalId}`;
    expect(evs[0]!.n).toBe(0);
  });
});

describe("step 3 (cont.) — fail-closed front door + the vendor→consume FLIP", () => {
  it("POST /v1/goals fail-closes to 422 no-match on a bare OS (no crash — the deleted-tenant degradation)", async () => {
    const res = await app.fetch(
      new Request("http://os/v1/goals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ intent: "tenant.capability.that.is.not.registered" }),
      }),
    );
    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.data.kind).toBe("no-match");
  });

  it("THE FLIP: a capability registered at RUNTIME (os.registerCapabilityPacks) becomes selectable — a tenant CONSUMES the OS without embedding it", async () => {
    const pack: CapabilityPack = {
      id: "os.selftest.pack",
      definitions: [
        {
          key: "os.health-probe",
          description: "OS self-goal (no tenant needed)",
          steps: [{ stepType: "probe", owner: "os", effect: "emit-only", maxAttempts: 1, handler: "os.health-probe.run" }],
        },
      ],
      handlers: [
        { key: "os.health-probe.run", run: async () => ({ ok: true as const, result: { ok: true }, checkpoint: {} }) },
      ],
      selectors: [{ definitionKey: "os.health-probe", selector: { intent: "os.health-probe" } }],
    };
    const snap = os.registerCapabilityPacks([pack]);
    expect(snap.registeredPackIds).toContain("os.selftest.pack");
    expect(snap.enqueueKeys).toContain("os.health-probe");
    expect(os.selectors().map((s) => s.definitionKey)).toContain("os.health-probe");

    // The SAME front door now routes the matching goal to a real run (201 enqueued) — with zero engine change.
    const res = await app.fetch(
      new Request("http://os/v1/goals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ intent: "os.health-probe" }),
      }),
    );
    expect([200, 201]).toContain(res.status);
    const body = await res.json() as any;
    expect(body.data.kind).toBe("enqueued");
    expect(body.data.definitionKey).toBe("os.health-probe");
    expect(body.data.runId).toBeTruthy();
  });
});
