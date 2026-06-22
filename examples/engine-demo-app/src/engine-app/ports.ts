// The demo app's OWN engine ports: the auth ScopeGuard + the HumanPrincipalPort.
// The engine OWNS the doctrine (the WORKFLOW_SCOPES vocabulary + the verified-human policy); the APP supplies
// the IMPL. A real app verifies a JWT here and maps its claims to a Principal; this demo uses a STUB principal
// (sufficient to exercise the route factories — the demo drives the engine directly, not over HTTP, so the
// guard is never actually exercised, but the runtime requires a ScopeGuard + HumanPrincipalPort to compose).

import type { MiddlewareHandler } from "hono";
import type { ScopeGuard } from "../../.claude/os/engine/index.js";
import {
  isVerifiedHuman,
  WORKFLOW_SCOPES,
  type HumanPrincipalPort,
  type Principal,
} from "../../.claude/os/engine/index.js";

// A STUB verified-human operator principal (the demo's "logged-in admin"). A real app derives this from a
// verified token. Carries all three engine scopes so the demo would pass any workflow:* gate.
const DEMO_PRINCIPAL: Principal = {
  sub: "demo-operator",
  role: "admin", // a human operator (NOT a machine role) — bypasses the per-scope check (human-principal.ts)
  scopes: [WORKFLOW_SCOPES.runtime, WORKFLOW_SCOPES.admin, WORKFLOW_SCOPES.observe],
  email: "operator@engine-demo.local",
};

// auth: the app's ScopeGuard factory. Maps the app's auth onto the engine's workflow:* scopes. The demo stub
// sets the principal and allows (a real app would 401 on a missing/invalid token or insufficient scope).
export const auth: ScopeGuard = (_requiredScope: string): MiddlewareHandler<{ Variables: { principal: Principal } }> =>
  async (c, next) => {
    c.set("principal", DEMO_PRINCIPAL);
    await next();
  };

// the HumanPrincipalPort impl: the verified-human gate the engine's approvals route consumes. The demo enforces
// the SAME doctrine (isVerifiedHuman: not a machine role + carries the scope) over its stub principal.
export const humanPrincipalPort: HumanPrincipalPort = {
  requireHuman(requiredScope = WORKFLOW_SCOPES.admin): MiddlewareHandler<{ Variables: { principal: Principal } }> {
    return async (c, next) => {
      const principal = DEMO_PRINCIPAL;
      if (!isVerifiedHuman(principal, requiredScope)) {
        return c.json({ error: { code: "forbidden", message: "verified human required" } }, 403);
      }
      c.set("principal", principal);
      await next();
    };
  },
};
