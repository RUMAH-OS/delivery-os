// GH TOOLS — REAL, READ-ONLY reads of the RUMAH-OS org via the `gh` CLI. CHANNEL-AGNOSTIC. These are the
// operational-truth sources the Project Owner narrates; the model NEVER invents any of this (ops-truth-integration
// discipline: models narrate tool results, they do not fabricate operational state).
//
// SAFETY: every call here is a READ (`gh pr list`, `gh repo list`). Nothing mutates. Honest failure: a gh error
// (not logged in, network, rate limit) surfaces as { ok:false, error } — never a silent empty success that would
// read as "no PRs" when we simply could not look.

import { execFile } from "node:child_process";

const DEFAULT_ORG = "RUMAH-OS";
const GH_TIMEOUT_MS = 30_000;

// run `gh <args>` and parse stdout as JSON. Honest typed result.
async function ghJson<T>(args: string[]): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  return new Promise((resolve) => {
    execFile("gh", args, { timeout: GH_TIMEOUT_MS, maxBuffer: 8 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        const msg = (stderr || "").toString().trim() || (err as Error).message;
        resolve({ ok: false, error: `gh ${args[0]} failed: ${msg.slice(0, 300)}` });
        return;
      }
      try {
        resolve({ ok: true, data: JSON.parse(stdout.toString() || "null") as T });
      } catch (e) {
        resolve({ ok: false, error: `gh ${args[0]} returned non-JSON: ${e instanceof Error ? e.message : String(e)}` });
      }
    });
  });
}

export interface CheckSummary {
  passed: number;
  failed: number;
  pending: number;
  failingNames: string[]; // names of the FAILED checks (for the blocker view)
}

export interface PrSummary {
  repo: string;
  number: number;
  title: string;
  author: string;
  isDraft: boolean;
  headRefName: string;
  updatedAt: string;
  url: string;
  checks: CheckSummary;
}

export interface MergedPrSummary {
  repo: string;
  number: number;
  title: string;
  author: string;
  mergedAt: string;
  url: string;
}

type RawRollup = { __typename?: string; conclusion?: string; status?: string; name?: string };
type RawPr = {
  number: number;
  title: string;
  author?: { login?: string };
  isDraft?: boolean;
  headRefName?: string;
  updatedAt?: string;
  url?: string;
  mergedAt?: string;
  statusCheckRollup?: RawRollup[] | null;
};

function summarizeChecks(rollup: RawRollup[] | null | undefined): CheckSummary {
  const out: CheckSummary = { passed: 0, failed: 0, pending: 0, failingNames: [] };
  for (const c of rollup ?? []) {
    // CheckRun uses `conclusion` (SUCCESS/FAILURE/...) once `status` is COMPLETED; StatusContext uses `state`.
    const status = (c.status ?? "").toUpperCase();
    const conclusion = (c.conclusion ?? "").toUpperCase();
    if (status && status !== "COMPLETED") {
      out.pending++;
      continue;
    }
    if (conclusion === "SUCCESS" || conclusion === "NEUTRAL" || conclusion === "SKIPPED") out.passed++;
    else if (conclusion === "FAILURE" || conclusion === "TIMED_OUT" || conclusion === "CANCELLED" || conclusion === "ACTION_REQUIRED" || conclusion === "STARTUP_FAILURE") {
      out.failed++;
      if (c.name) out.failingNames.push(c.name);
    } else if (!conclusion) out.pending++;
    else out.passed++;
  }
  return out;
}

// List the org's non-archived repos (the surface the founder cares about). READ-only.
export async function listRepos(org = DEFAULT_ORG): Promise<{ ok: true; repos: string[] } | { ok: false; error: string }> {
  const r = await ghJson<Array<{ name: string; isArchived?: boolean }>>([
    "repo", "list", org, "--no-archived", "--limit", "100", "--json", "name,isArchived",
  ]);
  if (!r.ok) return r;
  const repos = (r.data ?? []).filter((x) => !x.isArchived).map((x) => `${org}/${x.name}`);
  return { ok: true, repos };
}

// List OPEN PRs across a set of repos, each with a rolled-up check summary. Partial-failure aware: a repo that
// errors is reported in `errors` (never silently dropped) while the rest still return.
export async function listOpenPrs(
  repos: string[],
): Promise<{ prs: PrSummary[]; errors: Array<{ repo: string; error: string }> }> {
  const prs: PrSummary[] = [];
  const errors: Array<{ repo: string; error: string }> = [];
  const results = await Promise.all(
    repos.map(async (repo) => ({
      repo,
      res: await ghJson<RawPr[]>([
        "pr", "list", "--repo", repo, "--state", "open", "--limit", "50",
        "--json", "number,title,author,isDraft,headRefName,updatedAt,url,statusCheckRollup",
      ]),
    })),
  );
  for (const { repo, res } of results) {
    if (!res.ok) {
      errors.push({ repo, error: res.error });
      continue;
    }
    for (const p of res.data ?? []) {
      prs.push({
        repo,
        number: p.number,
        title: p.title,
        author: p.author?.login ?? "unknown",
        isDraft: Boolean(p.isDraft),
        headRefName: p.headRefName ?? "",
        updatedAt: p.updatedAt ?? "",
        url: p.url ?? "",
        checks: summarizeChecks(p.statusCheckRollup),
      });
    }
  }
  prs.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)); // most-recently-updated first
  return { prs, errors };
}

// List PRs MERGED since an ISO timestamp across repos (the "what changed overnight / recent merges" read).
export async function listRecentMerges(
  repos: string[],
  sinceIso: string,
): Promise<{ merges: MergedPrSummary[]; errors: Array<{ repo: string; error: string }> }> {
  const merges: MergedPrSummary[] = [];
  const errors: Array<{ repo: string; error: string }> = [];
  const results = await Promise.all(
    repos.map(async (repo) => ({
      repo,
      res: await ghJson<RawPr[]>([
        "pr", "list", "--repo", repo, "--state", "merged", "--limit", "30",
        "--search", `merged:>=${sinceIso}`,
        "--json", "number,title,author,mergedAt,url",
      ]),
    })),
  );
  for (const { repo, res } of results) {
    if (!res.ok) {
      errors.push({ repo, error: res.error });
      continue;
    }
    for (const p of res.data ?? []) {
      merges.push({
        repo,
        number: p.number,
        title: p.title,
        author: p.author?.login ?? "unknown",
        mergedAt: p.mergedAt ?? "",
        url: p.url ?? "",
      });
    }
  }
  merges.sort((a, b) => (a.mergedAt < b.mergedAt ? 1 : -1));
  return { merges, errors };
}

// A blocker is: an OPEN, non-draft PR carrying at least one FAILED check. Derived from listOpenPrs (one read).
export function blockersFrom(prs: PrSummary[]): PrSummary[] {
  return prs.filter((p) => !p.isDraft && p.checks.failed > 0);
}
