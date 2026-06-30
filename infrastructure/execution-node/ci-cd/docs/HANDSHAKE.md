# The runner-as-CI-compute handshake — GitHub is the plane, Neo is the compute

> The signal-level contract between GitHub and Neo (NEO-ARCH-01 §B.1/§B.2, NEO-EXEC-07 §7.2).
> **The principle: never leave GitHub; stop renting GitHub's CPU.** GitHub stays the system of record
> and the gate; Neo provides a faithful compute substrate that produces byte-identical gate verdicts.

## The division of labor

| Concern | Owner | Why it stays there |
|---|---|---|
| PRs, commits, the merge event | **GitHub** | the system of record; we never leave GitHub |
| Required-check **status API** | **GitHub** | branch protection reads it; the gate *verdict* is GitHub's |
| **Branch protection + CODEOWNERS** | **GitHub** | author≠verifier is a platform invariant enforced at the PR |
| The `verify-coverage` binding status | **GitHub** | D9: the *gate* is GitHub's; the *compute* is Neo's |
| **Secrets store** (CI/deploy) | **GitHub Actions Secrets** | injected to the runner the same way hosted got them |
| **Compute** for every check/build/deploy | **Neo** | we stop renting GitHub's CPU; we keep its event + gate plane |
| The independent VERIFY / `machine_probe` | **Neo** | a node the author (Windows) does NOT control → physical author≠verifier |

## The handshake (the signal flow)

```
  Windows (dev) ──git push──▶  GitHub (plane)  ──HTTPS long-poll──▶  Neo (compute)
                               PR opened/synchronized                 ephemeral runner picks
                               job: runs-on [self-hosted, neo]        up ONE job, job-scoped token
                                      │ enqueue (long-poll)           runs: ci / verify / migrate /
       check-run status ◀── status API ──────────────────────────────┤ gitleaks  (colima pg up)
       (pending → success/failure)                                    runner EXITS, de-registers
       branch protection reads required checks                        (ephemeral — clean per job)
              │ all green + CODEOWNERS review
              ▼
       founder approves → merge to main (Class-C ★) ──poll──▶ deploy job: vercel --prebuilt --prod
       deployment_status ◀────────────────────────◀── token ──┤ + supabase migrate (pooler)
              │ → BINDING post-deploy verify
```

## The key handshake fact (and the security property)

**The runner long-polls *outbound* to GitHub for work. GitHub never connects *in* to Neo.**

- **No inbound port is opened; no public IP is exposed.** A self-hosted runner is reachable from a
  laptop behind NAT with zero network configuration. The Tailscale ACL for `tag:ci-runner` is
  inbound-deny (`funnel:deny`); only the founder + the health monitor reach it.
- The job receives a **job-scoped `GITHUB_TOKEN`** that auto-expires when the job ends. No long-lived
  god token lives on Neo.

## Physical author≠verifier (the net security upgrade)

The build runs interactively on **Windows (node 1)**. The PR's required checks and the independent
**VERIFY + `machine_probe`** run on **Neo (node 2)** — a node the author's machine does not control.
This makes author≠verifier *physical* (neutral hardware, D9), not just an identity convention.

- The `machine_probe` log records **`node: neo-node2`** to *prove* the verify ran off the author's
  box (the M3 proof, NEO-ARCH-01 §B.6).
- Verify evidence returns on the **durable Supabase bus** as `ExecutionOutcome.evidenceRef`, so it
  survives the ephemeral runner's de-registration — it is not a perishable CI artifact.

## The runner-isolation posture (the decided controls — NEO-ARCH-01 §B.5, ADR-003)

1. **Ephemeral runners (`--ephemeral`)** — every job gets a fresh runner that de-registers after one
   job. No secret, checkout, or artifact persists to the next job. The highest-leverage control.
2. **A dedicated non-admin macOS user `ci-runner`** — no admin, no sudoers, no access to the founder's
   login Keychain, browser profiles, SSH keys, or iCloud. A job compromise is boxed in a sandbox user.
3. **Never `pull_request_target`** on the self-hosted runner. That trigger runs base-repo secrets
   against fork code and is the documented exfiltration path. Required checks trigger on
   `pull_request` only. **An absolute rule, enforced by review of every workflow change.**
4. **Least-scope, short-lived tokens** — job `GITHUB_TOKEN` auto-expires; `VERCEL_TOKEN` is
   deploy-scoped; the supervisor's metric identity is read-only. No standing god token on Neo.
5. **Tailscale ACLs** — `tag:ci-runner` is outbound-only to GitHub + Vercel + Supabase; no inbound
   except the founder + health monitor.
6. **Pinned action SHAs + lockfile-only installs** — `npm ci` against the committed lockfile;
   gitleaks guards committed secrets; Dependabot/`npm audit` guard the dependency vector.

**The honest residual (ADR-003):** for a *solo private repo* the exposure is **low but not zero** — a
compromised dependency could run in-job and reach injected secrets before teardown. The mitigations
shrink the blast radius; they do not eliminate it. **Re-evaluate the instant a second contributor or a
public fork appears** — at that point the posture hardens, or untrusted-PR checks move back to
GitHub-hosted (one cleared `vars.CI_RUNNER` away).

## The off-plane half (not part of the GitHub handshake)

The autonomy **worker daemon** on Neo drains the durable bus on its **own clock** (engine-tick ·
reconciler · goal-supervisor) — it is **not triggered by GitHub at all**. It is watched by an
**off-Neo** monitor (Healthchecks.io) that pages the founder on silence. That daemon is P3.x worker
scope, named here only to draw the line: the GitHub↔Neo handshake covers *event-driven CI/deploy*; the
worker is *continuous autonomy* and shares none of this signal path.
