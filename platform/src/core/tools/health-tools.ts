// HEALTH TOOLS — REAL, READ-ONLY reachability probes of the Delivery-OS engine mounts. CHANNEL-AGNOSTIC.
//
// SCOPE / HONESTY: this is a SHALLOW reachability probe (does the mount's HTTP server answer?), NOT a deep
// health check. We do a plain GET on the mount base and report the HTTP status. A response — even a 404 (Vercel
// returns 404 at `/` when there is no root route) — proves the server is UP and serving; only a network
// failure / timeout means DOWN. We label it exactly that so the founder is never misled into thinking a 404
// means broken. A deeper check (a dedicated /health route, engine tick freshness, runner lease age) is a noted
// gap that needs an engine-side read endpoint — we do NOT fabricate those signals.

export interface MountHealth {
  name: string;
  url: string;
  reachable: boolean; // did the server answer at all (any HTTP status) within the timeout?
  status: number | null; // the HTTP status if it answered, else null
  detail: string;
}

export interface MountConfig {
  name: string;
  url: string;
}

// Bare OS knows zero tenants (I-PI). Mounts are populated from tenant registration in M4 (dynamic
// probeMounts); no tenant URL is baked into OS source. Override via ProjectOwner config / env.
export const DEFAULT_MOUNTS: MountConfig[] = [];

const PROBE_TIMEOUT_MS = 8_000;

// Probe one mount: GET base, report whether the server answered + the status. A network error = DOWN.
export async function probeMount(m: MountConfig, fetchImpl: typeof fetch = fetch): Promise<MountHealth> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetchImpl(m.url, { method: "GET", signal: controller.signal });
    return {
      name: m.name,
      url: m.url,
      reachable: true,
      status: res.status,
      detail: `server answered HTTP ${res.status}`,
    };
  } catch (e) {
    return {
      name: m.name,
      url: m.url,
      reachable: false,
      status: null,
      detail: `unreachable: ${e instanceof Error ? e.message : String(e)}`,
    };
  } finally {
    clearTimeout(timer);
  }
}

// Probe all configured mounts concurrently.
export async function probeMounts(
  mounts: MountConfig[] = DEFAULT_MOUNTS,
  fetchImpl: typeof fetch = fetch,
): Promise<MountHealth[]> {
  return Promise.all(mounts.map((m) => probeMount(m, fetchImpl)));
}
