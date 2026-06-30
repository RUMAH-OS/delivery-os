// =============================================================================
// governance-engine — REFERENCE PLANE ADAPTERS · ConfigReadinessPort · NotifierPort · FounderBindingPort.
// =============================================================================
// The three NON-store ports a consumer must supply. These are PLANE concerns (config registry, webhook delivery,
// founder identity), not Postgres SQL — the blueprint (§1.4/§1.5) keeps the concrete impls consumer-side. This
// file ships FAITHFUL, generic reference impls so the adapter is a complete, runnable consumer surface:
//
//   * `makeEnvConfigReadiness()`    — a deterministic ConfigReadinessFn over `process.env` (PRESENT/MISSING). It
//                                     mirrors the VERDICT shape admin's `makeIConfigReadiness` returns from its
//                                     `i-config.mjs` oracle, without the admin-specific execFileSync shell-out (a
//                                     consumer with a real config registry swaps this for its own oracle).
//   * `makeWebhookNotifier()`       — the NotifierPort over an injected webhook map. `isConfigured` mirrors admin's
//                                     `defaultProbe` (a channel is configured iff its credential_ref resolves to a
//                                     URL; the credential-less durable terminal is always configured). `send` is
//                                     DRAFT-DON'T-SEND by default (no real POST) — honest-failure / §11: an
//                                     automation never performs an irreversible action unguarded.
//   * `makeFounderBinding()`        — the FounderBindingPort. Fail-closed by construction: a null/absent founder id
//                                     ⇒ nobody verifies as the founder ⇒ every submission/approval is rejected.
//                                     Mirrors admin's `resolveFounderBinding` (env RUNTIME_FOUNDER_ID) shape.
//
// NONE of these import the `postgres` driver — but they live under `adapters/` (the residency-excluded dir)
// alongside the store adapters so a consumer has ONE place that holds its whole plane.
// =============================================================================

import type {
  ConfigReadinessFn,
  KeyReadiness,
  NotifierPort,
  NotifierChannelRef,
  FounderBindingPort,
  FounderBinding,
} from "../../ports.js";

// ── ConfigReadinessPort — env-backed reference oracle ───────────────────────────────────────────────────────
export interface EnvConfigReadinessOptions {
  /** the env bag to read (default process.env). */
  env?: Record<string, string | undefined>;
  /** keys that are OPTIONAL — an absent optional key reports OPTIONAL-ABSENT (not MISSING / not a blocker). */
  optionalKeys?: string[];
}

/**
 * A deterministic ConfigReadinessFn over an env bag. PRESENT when the key has a non-empty value; MISSING when it is
 * absent/blank (an OPTIONAL key reports OPTIONAL-ABSENT instead). This is the generic reference; a consumer with a
 * real config/secret registry injects its own oracle (admin shells to `infra/i-config.mjs`).
 */
export function makeEnvConfigReadiness(opts: EnvConfigReadinessOptions = {}): ConfigReadinessFn {
  const env = opts.env ?? process.env;
  const optional = new Set(opts.optionalKeys ?? []);
  return async (_targetEnv: string, keys: string[]): Promise<KeyReadiness[]> =>
    keys.map((key): KeyReadiness => {
      const v = env[key];
      const present = typeof v === "string" && v.trim() !== "";
      if (present) return { key, state: "PRESENT" };
      if (optional.has(key)) return { key, state: "OPTIONAL-ABSENT", detail: "optional key not set" };
      return { key, state: "MISSING", detail: "required key absent from the environment" };
    });
}

// ── NotifierPort — webhook reference (draft-don't-send by default) ──────────────────────────────────────────
export interface WebhookNotifierOptions {
  /** credential_ref → webhook URL. A ref present here is "configured". */
  webhooks?: Record<string, string>;
  /** ENABLE the real POST. When false/absent the notifier DRAFTS (no real send) — the chain escalates to the
   *  durable last-resort (honest-failure default; never an unguarded irreversible action). */
  enableSend?: boolean;
  /** injected POST seam (so a test/consumer supplies its own transport). Default = global fetch. */
  post?: (url: string, body: string) => Promise<{ ok: boolean; status?: number }>;
}

/** Build a NotifierPort over an injected webhook map. `isConfigured` mirrors admin's defaultProbe. */
export function makeWebhookNotifier(opts: WebhookNotifierOptions = {}): NotifierPort {
  const webhooks = opts.webhooks ?? {};
  const post =
    opts.post ??
    (async (url: string, body: string) => {
      const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body });
      return { ok: res.ok, status: res.status };
    });

  return {
    isConfigured(credentialRef: string | null): boolean {
      // the credential-less durable last-resort is always configured (mirrors defaultProbe's durable terminal).
      if (credentialRef === null) return true;
      return Boolean(webhooks[credentialRef]);
    },
    // ENFORCE-only real send. Absent unless explicitly enabled ⇒ draft-don't-send ⇒ escalate to durable terminal.
    ...(opts.enableSend
      ? {
          async send(channel: NotifierChannelRef, payload: unknown) {
            const url = channel.credentialRef ? webhooks[channel.credentialRef] : undefined;
            if (!url) return { ok: false, note: `no webhook URL for channel ${channel.id}` };
            const r = await post(url, JSON.stringify(payload));
            return { ok: r.ok, ref: channel.credentialRef ?? undefined, note: r.ok ? "delivered" : `webhook HTTP ${r.status}` };
          },
        }
      : {}),
  };
}

// ── FounderBindingPort — fail-closed founder identity ───────────────────────────────────────────────────────
export interface FounderBindingOptions {
  /** explicit founder id (e.g. read from a config registry by the consumer). */
  founderId?: string | null;
  /** env var name to read when no explicit id is supplied (default RUNTIME_FOUNDER_ID — admin's key). */
  envKey?: string;
  /** the env bag (default process.env). */
  env?: Record<string, string | undefined>;
}

/**
 * Build a FounderBindingPort. Resolution order: explicit `founderId` → `env[envKey]` → null. A null id is the
 * fail-closed default — the intake organ then rejects every submission/approval (nobody verifies as the founder).
 * Mirrors admin's `resolveFounderBinding` (env RUNTIME_FOUNDER_ID) shape.
 */
export function makeFounderBinding(opts: FounderBindingOptions = {}): FounderBindingPort {
  const envKey = opts.envKey ?? "RUNTIME_FOUNDER_ID";
  const env = opts.env ?? process.env;
  const resolved = opts.founderId ?? env[envKey]?.trim() ?? null;
  const binding: FounderBinding = {
    founderId: resolved && resolved !== "" ? resolved : null,
    source:
      opts.founderId != null
        ? "injected FounderBindingPort"
        : resolved
          ? `env ${envKey}`
          : `env ${envKey} (UNSET — fail-closed: no founder configured)`,
  };
  return { resolveFounderBinding: () => binding };
}
