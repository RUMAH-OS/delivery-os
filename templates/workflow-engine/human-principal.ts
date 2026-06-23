// Workflow Engine — the HumanPrincipalPort + the human-gate doctrine (the verified-human policy).
// The engine OWNS the doctrine (who may resolve an irreversible human gate); the app OWNS the token IMPL.
//
// The human gate is the unbypassable floor on every irreversible action (S1/S3): it must be opened by a
// VERIFIED HUMAN, never by a service/agent credential. The engine declares the PORT the app must supply
// (requireHuman) + the machine-role policy (NON_HUMAN_ROLES) + the engine scope vocabulary
// (WORKFLOW_SCOPES). The HS256/JWT verification + scope MINTING/grants stay in the app's auth impl.
//
// The engine does NOT know what any specific app is — it knows only "a verified human Principal vs a
// machine role" and the three workflow scopes it gates its own routes by.

import type { MiddlewareHandler } from "hono";

// ── The engine scope vocabulary (the engine OWNS these; apps MINT/grant them). ────────────────────
//   workflow:runtime — tick / enqueue / callbacks (drive execution)
//   workflow:admin   — management surfaces (resolve human gates, operate runs)
//   workflow:observe — reads (run/step projections)
export const WORKFLOW_SCOPES = {
  runtime: "workflow:runtime",
  admin: "workflow:admin",
  observe: "workflow:observe",
} as const;
export type WorkflowScope = (typeof WORKFLOW_SCOPES)[keyof typeof WORKFLOW_SCOPES];

// ── The Principal shape the engine reasons over. The app maps its own token claims to this. ───────
export interface Principal {
  sub: string;
  role: string; // 'admin' is a human operator and bypasses scope checks
  scopes: string[];
  email?: string;
}

// ── NON_HUMAN_ROLES — the GENERIC machine-role policy (engine doctrine, S2). A service / agent / system /
// integration token is a MACHINE, never a verified human principal. These roles may NEVER resolve a human
// gate even if the scope leaked onto them. This is the trust-boundary the presence-only gate-theater defect
// missed. The engine is DOMAIN-FREE: this base names NO specific app/seam role. An APP supplies its OWN
// additional machine roles (e.g. a seam role like a consumer's service identity) via `extraNonHumanRoles`
// on isVerifiedHuman / its requireHuman impl; the effective policy is BASE ∪ APP-EXTRA.
export const NON_HUMAN_ROLES: ReadonlySet<string> = new Set(
  ["service", "agent", "system", "integration"].map((r) => r.toLowerCase()),
);

// isNonHumanRole — the engine's machine-role predicate over BASE ∪ APP-EXTRA (case-insensitive). The app
// passes its own extra machine roles; the engine never knows what they ARE, only that they are non-human.
export function isNonHumanRole(role: string, extraNonHumanRoles: readonly string[] = []): boolean {
  const r = role.toLowerCase();
  if (NON_HUMAN_ROLES.has(r)) return true;
  for (const x of extraNonHumanRoles) if (x.toLowerCase() === r) return true;
  return false;
}

// returns true iff the principal is a VERIFIED HUMAN allowed to resolve a human gate carrying `requiredScope`:
// (1) NOT a machine role — BASE ∪ APP-EXTRA — rejected by construction even if the scope leaked, AND
// (2) carries the required scope (the 'admin' role — a human operator — bypasses the scope check).
// `extraNonHumanRoles` is the app's additional machine-role list (keeps the engine domain-free).
export function isVerifiedHuman(principal: Principal, requiredScope: string, extraNonHumanRoles: readonly string[] = []): boolean {
  if (isNonHumanRole(principal.role, extraNonHumanRoles)) return false;
  if (principal.role !== "admin" && !principal.scopes.includes(requiredScope)) return false;
  return true;
}

// ── The HumanPrincipalPort the app supplies. requireHuman is a Hono middleware that VERIFIES the request's
// token (HS256/JWT — the app's impl), enforces the verified-human policy above, and sets c.var.principal.
// The engine's approvals-route factory consumes this port; it never imports the app's token verifier. ──
export interface HumanPrincipalPort {
  requireHuman(requiredScope?: string): MiddlewareHandler<{ Variables: { principal: Principal } }>;
}
