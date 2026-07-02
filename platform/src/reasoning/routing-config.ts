// =============================================================================
// ROUTING CONFIG LOADER — reads + validates reasoning-routing.config.json (fail-closed).
// =============================================================================
// This is the ONE code path that touches the config registry (the single home of model IDs). It validates
// the file with zod at load time; a malformed config throws (fail-closed) rather than booting the OS onto an
// undefined routing table. NO model-ID literals live here — only the SHAPE is asserted. The values (model IDs)
// come exclusively from the JSON data file.
//
// Allowlisted for the model-agnostic lint ONLY as the loader PATH; it deliberately contains zero model strings.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { z } from "zod";
import { REASONING_CLASSES, type ReasoningClass } from "./reasoning-class.js";

// ── The zod schema: the structural contract of the config registry (ADR §"Config registry"). ──

const thinkingSchema = z.enum(["off", "low", "medium", "high", "max"]);

/** Per-class tunable params passed through to the model. Extensible; `thinking` is the one the ADR names. */
export const paramsSchema = z
  .object({ thinking: thinkingSchema })
  .catchall(z.union([z.string(), z.number(), z.boolean()]));
export type RoutingParams = z.infer<typeof paramsSchema>;

const challengerSchema = z.object({
  model: z.string().min(1),
  // A/B traffic fraction for this challenger, in (0, 1]. Validated so the sum-of-challengers cannot exceed 1.
  traffic: z.number().gt(0).lte(1),
});
export type ChallengerBinding = z.infer<typeof challengerSchema>;

const classBindingSchema = z
  .object({
    primary: z.string().min(1),
    challengers: z.array(challengerSchema).optional().default([]),
    fallback: z.array(z.string().min(1)).optional().default([]),
    params: paramsSchema,
    constraint: z.string().min(1).optional(),
  })
  .strict()
  .superRefine((b, ctx) => {
    const sum = b.challengers.reduce((acc, c) => acc + c.traffic, 0);
    if (sum > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `challenger traffic sums to ${sum} (> 1); no traffic would remain for primary`,
        path: ["challengers"],
      });
    }
  });
export type ClassBinding = z.infer<typeof classBindingSchema>;

const defaultsSchema = z
  .object({
    timeout_ms: z.number().int().positive(),
    max_retries: z.number().int().nonnegative(),
  })
  .strict();
export type RoutingDefaults = z.infer<typeof defaultsSchema>;

// The full registry: EVERY reasoning class must have a binding (exhaustive). `_comment` is tolerated (docs).
const classesShape = Object.fromEntries(
  REASONING_CLASSES.map((c) => [c, classBindingSchema]),
) as Record<ReasoningClass, typeof classBindingSchema>;

export const routingConfigSchema = z
  .object({
    _comment: z.string().optional(),
    classes: z.object(classesShape).strict(),
    defaults: defaultsSchema,
  })
  .strict();
export type RoutingConfig = z.infer<typeof routingConfigSchema>;

/** The default on-disk location of the config registry (platform/reasoning-routing.config.json). */
export function defaultConfigPath(): string {
  // this file: platform/src/reasoning/routing-config.ts → up two dirs → platform/
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "..", "..", "reasoning-routing.config.json");
}

/** Typed, fail-closed load error so callers (boot) can distinguish a config fault from a routing fault. */
export class RoutingConfigError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "RoutingConfigError";
  }
}

/**
 * Load + validate the routing config. FAIL-CLOSED: any read/parse/validation fault throws RoutingConfigError.
 * @param path optional override (tests pass a fixture path); defaults to the on-disk registry.
 */
export function loadRoutingConfig(path: string = defaultConfigPath()): RoutingConfig {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (e) {
    throw new RoutingConfigError(`routing_config_unreadable: ${path}`, e);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new RoutingConfigError(`routing_config_not_json: ${path}`, e);
  }
  const result = routingConfigSchema.safeParse(parsed);
  if (!result.success) {
    throw new RoutingConfigError(
      `routing_config_invalid: ${result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
      result.error,
    );
  }
  return result.data;
}

/** Validate an already-parsed object (used by tests that build in-memory configs). Fail-closed. */
export function validateRoutingConfig(obj: unknown): RoutingConfig {
  const result = routingConfigSchema.safeParse(obj);
  if (!result.success) {
    throw new RoutingConfigError(
      `routing_config_invalid: ${result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
      result.error,
    );
  }
  return result.data;
}
