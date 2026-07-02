// =============================================================================
// MODEL ROUTER PROOF (ADR-reasoning-model-routing.md §"Router contract").
// =============================================================================
// Asserts the router's contract deterministically and for free (no model billed): primary resolution;
// DETERMINISTIC A/B (same requestId ⇒ same binding, and traffic fractions honored across many ids); fallback
// when the primary is unavailable; unknown class throws typed; malformed config fails closed; and the boot
// resolution map. Model ids here are opaque PLACEHOLDERS built in-memory — the real ids live only in the
// config registry (this test file lives under test/, outside the src/** the model-agnostic lint scans).

import { describe, it, expect, afterEach } from "vitest";
import { writeFileSync, rmSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ModelRouter,
  UnknownReasoningClassError,
  NoAvailableModelError,
  abBucket,
  type RouterTelemetry,
} from "../src/reasoning/model-router.js";
import {
  validateRoutingConfig,
  loadRoutingConfig,
  RoutingConfigError,
  type RoutingConfig,
} from "../src/reasoning/routing-config.js";
import { REASONING_CLASSES } from "../src/reasoning/reasoning-class.js";

// ── Fixture builders — a FULL, valid config (all ten classes) with targeted per-class overrides. ──

function classBinding(over: Record<string, unknown> = {}): Record<string, unknown> {
  return { primary: "m-primary", fallback: [], params: { thinking: "off" }, ...over };
}

function fullConfig(overrides: Partial<Record<string, unknown>> = {}): RoutingConfig {
  const classes: Record<string, unknown> = {};
  for (const c of REASONING_CLASSES) classes[c] = overrides[c] ?? classBinding();
  return validateRoutingConfig({ classes, defaults: { timeout_ms: 1000, max_retries: 1 } });
}

const tmpDirs: string[] = [];
afterEach(() => {
  while (tmpDirs.length) rmSync(tmpDirs.pop()!, { recursive: true, force: true });
});

describe("ModelRouter.resolve — primary resolution", () => {
  it("resolves a plain class to its primary with params + a primary bindingId", () => {
    const router = new ModelRouter(fullConfig());
    const b = router.resolve("CLASSIFY", { requestId: "req-1" });
    expect(b.model).toBe("m-primary");
    expect(b.bindingId).toBe("CLASSIFY:primary:m-primary");
    expect(b.params).toEqual({ thinking: "off" });
  });

  it("emits a telemetry record {class, model, bindingId} through the injected sink", () => {
    const seen: RouterTelemetry[] = [];
    const router = new ModelRouter(fullConfig(), { telemetry: (r) => seen.push(r) });
    router.resolve("CLASSIFY", { requestId: "req-1" });
    expect(seen).toEqual([{ class: "CLASSIFY", model: "m-primary", bindingId: "CLASSIFY:primary:m-primary" }]);
  });
});

describe("ModelRouter.resolve — deterministic A/B", () => {
  const cfg = fullConfig({
    PLAN: classBinding({
      primary: "m-primary",
      challengers: [{ model: "m-chal", traffic: 0.2 }],
      fallback: ["m-fb"],
      params: { thinking: "high" },
    }),
  });

  it("same requestId ⇒ same binding (reproducible; no Math.random)", () => {
    const router = new ModelRouter(cfg);
    const a = router.resolve("PLAN", { requestId: "stable-id-42" });
    const b = router.resolve("PLAN", { requestId: "stable-id-42" });
    expect(a).toEqual(b);
  });

  it("routes ~traffic fraction to the challenger across many ids (within tolerance)", () => {
    const router = new ModelRouter(cfg);
    const N = 4000;
    let chal = 0;
    for (let i = 0; i < N; i++) {
      const b = router.resolve("PLAN", { requestId: `request-${i}` });
      if (b.model === "m-chal") chal++;
    }
    const fraction = chal / N;
    // challenger traffic is 0.2 → expect ~20% ± 3pts (deterministic hash spread).
    expect(fraction).toBeGreaterThan(0.15);
    expect(fraction).toBeLessThan(0.25);
  });

  it("a bucket inside the challenger range resolves to the challenger with a challenger bindingId", () => {
    const router = new ModelRouter(cfg);
    // Find an id whose bucket lands in [0, 200) (challenger owns 0.2*1000 buckets).
    let id = "";
    for (let i = 0; i < 100000; i++) {
      if (abBucket(`x-${i}`) < 200) { id = `x-${i}`; break; }
    }
    expect(id).not.toBe("");
    const b = router.resolve("PLAN", { requestId: id });
    expect(b.model).toBe("m-chal");
    expect(b.bindingId).toBe("PLAN:challenger:m-chal");
  });
});

describe("ModelRouter.resolve — fallback chain (runtime availability)", () => {
  const cfg = fullConfig({
    CONVERSE: classBinding({ primary: "m-primary", fallback: ["m-fb1", "m-fb2"], params: { thinking: "medium" } }),
  });

  it("walks to the first available fallback when the primary is unavailable", () => {
    const router = new ModelRouter(cfg, { isAvailable: (m) => m !== "m-primary" });
    const b = router.resolve("CONVERSE", { requestId: "req-1" });
    expect(b.model).toBe("m-fb1");
    expect(b.bindingId).toBe("CONVERSE:fallback:m-fb1");
  });

  it("skips an unavailable fallback and takes the next available one", () => {
    const router = new ModelRouter(cfg, { isAvailable: (m) => m === "m-fb2" });
    const b = router.resolve("CONVERSE", { requestId: "req-1" });
    expect(b.model).toBe("m-fb2");
  });

  it("a challenger that is unavailable falls back to the primary before the fallback chain", () => {
    const abCfg = fullConfig({
      PLAN: classBinding({ primary: "m-primary", challengers: [{ model: "m-chal", traffic: 1 }], fallback: ["m-fb"], params: { thinking: "high" } }),
    });
    // traffic:1 ⇒ every id prefers the challenger; make the challenger unavailable.
    const router = new ModelRouter(abCfg, { isAvailable: (m) => m !== "m-chal" });
    const b = router.resolve("PLAN", { requestId: "any" });
    expect(b.model).toBe("m-primary");
    expect(b.bindingId).toBe("PLAN:primary:m-primary");
  });

  it("throws NoAvailableModelError (fail-closed) when nothing resolves", () => {
    const router = new ModelRouter(cfg, { isAvailable: () => false });
    expect(() => router.resolve("CONVERSE", { requestId: "req-1" })).toThrow(NoAvailableModelError);
  });
});

describe("ModelRouter.resolve — unknown class throws typed", () => {
  it("throws UnknownReasoningClassError for a class not in the enum", () => {
    const router = new ModelRouter(fullConfig());
    expect(() => router.resolve("NOT_A_CLASS", { requestId: "req-1" })).toThrow(UnknownReasoningClassError);
  });
});

describe("routing config — malformed fails closed", () => {
  it("validateRoutingConfig throws RoutingConfigError on a missing class", () => {
    expect(() => validateRoutingConfig({ classes: { CONVERSE: classBinding() }, defaults: { timeout_ms: 1, max_retries: 0 } })).toThrow(RoutingConfigError);
  });

  it("validateRoutingConfig throws on challenger traffic summing above 1", () => {
    const bad = { classes: {} as Record<string, unknown>, defaults: { timeout_ms: 1, max_retries: 0 } };
    for (const c of REASONING_CLASSES) bad.classes[c] = classBinding();
    bad.classes.PLAN = classBinding({ challengers: [{ model: "a", traffic: 0.7 }, { model: "b", traffic: 0.7 }] });
    expect(() => validateRoutingConfig(bad)).toThrow(RoutingConfigError);
  });

  it("loadRoutingConfig throws on a non-JSON file (fail-closed)", () => {
    const dir = mkdtempSync(join(tmpdir(), "routing-cfg-"));
    tmpDirs.push(dir);
    const p = join(dir, "bad.json");
    writeFileSync(p, "{ this is not json ");
    expect(() => loadRoutingConfig(p)).toThrow(RoutingConfigError);
  });

  it("loadRoutingConfig throws on an unreadable path (fail-closed)", () => {
    expect(() => loadRoutingConfig("/nonexistent/does-not-exist.json")).toThrow(RoutingConfigError);
  });

  it("the SHIPPED config registry loads + validates (sanity)", () => {
    const cfg = loadRoutingConfig();
    expect(Object.keys(cfg.classes).sort()).toEqual([...REASONING_CLASSES].sort());
  });
});

describe("ModelRouter.resolveAll — boot resolution map", () => {
  const cfg = fullConfig({
    PLAN: classBinding({ primary: "m-primary", challengers: [{ model: "m-chal", traffic: 0.2 }], fallback: ["m-fb"], params: { thinking: "high" } }),
  });

  it("lists every class → its referenced models with resolve flags; never throws on unavailability", () => {
    const router = new ModelRouter(cfg);
    const map = router.resolveAll(new Set(["m-primary"])); // only the primary is available
    expect(Object.keys(map).sort()).toEqual([...REASONING_CLASSES].sort());
    const plan = map.PLAN;
    expect(plan.candidates.map((c) => c.model)).toEqual(["m-primary", "m-chal", "m-fb"]);
    expect(plan.candidates.find((c) => c.model === "m-primary")!.resolves).toBe(true);
    expect(plan.candidates.find((c) => c.model === "m-chal")!.resolves).toBe(false);
    expect(plan.resolvable).toBe(true);
  });

  it("reports resolvable=false for a class whose every model is unavailable (does not crash)", () => {
    const router = new ModelRouter(cfg);
    const map = router.resolveAll(new Set()); // nothing available
    expect(map.CLASSIFY.resolvable).toBe(false);
    expect(map.PLAN.resolvable).toBe(false);
  });
});
