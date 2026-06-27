// Type surface for the vendored platform-health.mjs (Infrastructure Runtime-Health &
// Diagnostics layer). App code (TypeScript) imports the pure helpers from the vendored
// `infra/platform-health.mjs`; this declaration keeps that import typed. Runtime is the
// .mjs — this file is types only.

export type SubsystemStatus = "ok" | "degraded" | "down" | "unknown";
export type Verdict = "ok" | "degraded" | "down";

export interface SubsystemInput {
  name: string;
  status: SubsystemStatus | string;
  critical?: boolean;
  detail?: string;
  latencyMs?: number;
  actionable?: string;
}

export interface Subsystem {
  name: string;
  status: SubsystemStatus;
  critical: boolean;
  detail: string;
  latencyMs?: number;
  actionable?: string;
}

export interface HealthReport {
  service: string;
  verdict: Verdict;
  ok: boolean;
  checkedAt: string;
  subsystems: Subsystem[];
  summary: { total: number; ok: number; degraded: number; down: number; unknown: number };
}

export interface Probe {
  name: string;
  critical?: boolean;
  timeoutMs?: number;
  run: () => Promise<{ status: SubsystemStatus | string; detail?: string; latencyMs?: number; actionable?: string }>;
}

export type Cause =
  | "DB_UNREACHABLE"
  | "CONFIG_KEY_MISSING"
  | "POOL_EXHAUSTION"
  | "STUCK_CONSUMER_CURSOR"
  | "HEARTBEAT_STALE"
  | "EXTERNAL_API_ERROR"
  | "UNKNOWN";

export interface Symptom {
  subsystem?: string;
  error?: unknown;
  message?: string;
  code?: string | number;
  status?: string | number;
  httpStatus?: number;
  lagSeconds?: number;
  ageSeconds?: number;
  context?: { cursorStaleSeconds?: number; heartbeatStaleSeconds?: number; [k: string]: unknown };
}

export interface Diagnosis {
  cause: Cause;
  detail: string;
  actionable: string;
}

export const STATUS: Readonly<Record<"DOWN" | "DEGRADED" | "UNKNOWN" | "OK", SubsystemStatus>>;
export const VERDICT: Readonly<Record<"OK" | "DEGRADED" | "DOWN", Verdict>>;
export const CAUSE: Readonly<Record<Cause, Cause>>;
export const CANONICAL_SHAPE: Readonly<Record<string, unknown>>;

export function normalizeStatus(s: unknown): SubsystemStatus;
export function computeVerdict(subsystems: Array<{ status: unknown; critical?: boolean }>): Verdict;
export function buildReport(service: string, subsystems: SubsystemInput[], now?: Date): HealthReport;
export function httpStatusForVerdict(verdict: Verdict): number;
export function runHealth(service: string, probes: Probe[], now?: Date): Promise<HealthReport>;
export function classifyFailure(symptom?: Symptom): Diagnosis;
export function validateReport(report: unknown): { valid: boolean; errors: string[] };
