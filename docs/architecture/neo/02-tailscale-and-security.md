---
artifact: NEO TAILSCALE + SECURITY MODEL (the tailnet design + the complete security model for the execution layer)
id: NTS-DOS-v1
date: 2026-06-29
status: DESIGN — READ-ONLY. Installs/changes NOTHING. Opinionated architecture for founder ratification. No node is joined, no ACL is applied, no secret is moved by this document.
extends:
  - docs/reviews/EXECUTION-INFRASTRUCTURE-BLUEPRINT-2026-06-29.md (EIB-DOS-v1 §3 topology, §8 Tailscale sketch, §17 risks — DEEPENED here)
  - docs/reviews/RUNTIME-SPECIFICATION-2026-06-28.md (RS-DOS-v1 §54 trust boundary / data_class, §57 config+secret registry)
  - rumah-admin/infra/config-secret-registry.json + infra/i-config.mjs (the no-tree-resident-secrets discipline)
  - rumah-admin/src/db/break-glass.ts (the founder-signed, single-use, scoped prod-write grant — EXTENDED here)
scope_guard: Designs the Tailscale fabric + the end-to-end security model for the two-node (soon N-node) execution layer with Neo as Execution Node 1. Concrete, opinionated, and honest about residual risk.
load_bearing_deliverable: §G — the complete security model + the honest go/no-go verdict for a solo-founder private-repo self-hosted execution layer.
---

# Neo — Tailscale Integration + The Complete Security Model (NTS-DOS-v1)

> **Why Tailscale is foundational, not bolted-on.** The EIB blueprint's whole thesis is an
> **execution-provider-independent Runtime**: today two nodes (Windows + Neo), tomorrow a Linux box, a
> Mac Studio, a cloud worker. *Adding a node must be a `join`, not a network project.* That is only true if
> the network fabric is an identity-addressed overlay that every node speaks from birth. We pick that fabric
> **once, now, at the foundation** — a WireGuard mesh (Tailscale) where each node has a stable identity, ACLs
> are code, and **nothing binds to a public port.** Bolting a VPN on after three nodes already talk over
> LAN IPs and opened ports is how you inherit a flat, un-segmented, un-auditable network. We refuse that.
>
> **The one-sentence model:** *Tailscale is the private transport + the identity gate; it carries no secrets,
> authorizes no writes, and trusts no node by default — it decides **who may reach what**, and everything
> else (secrets, prod writes, data-class) is gated **behind** that reachability by mechanisms that assume the
> network is already hostile.*

---

## 0. TL;DR (the decisions in one screen)

1. **Tailnet = the overlay every execution node joins.** Services bind to the **tailnet interface
   (`100.x` / the `tailscale0` device)**, never to `0.0.0.0`. No node has a public IP, no inbound port is
   opened on any home router. Vercel + Supabase are **SaaS — NOT on the tailnet**; nodes reach them as
   **outbound public-TLS egress with platform creds** (you cannot install `tailscaled` on managed serverless).
2. **Four tags, least-privilege by default-deny:** `tag:dev` (Windows, founder's build host — broad),
   `tag:exec-node` + `tag:ci-runner` (Neo — *outbound-mostly, inbound only from founder + the on-tailnet
   watchdog*), `tag:watchdog` (the liveness puller), `tag:external` (future cloud node — *quarantined*; the
   network enforcement of the `data_class` trust boundary). MagicDNS names: `windows-node1`, `neo`,
   `linux-node3`, `studio-node4`, `cloud-node5`.
3. **SSH: Tailscale SSH (keyless, ACL-governed, identity-tied, optionally session-recorded) — YES**, as the
   *primary* ops path. Keep a **local-console fallback** for the tailnet-down case. **No public `sshd`, ever.**
4. **Secrets bootstrap = the platform-store model extended to owned hardware.** GH-Actions jobs get secrets
   the way a hosted runner does (injected into the job env over GitHub's TLS long-poll — Tailscale plays no
   part). The **worker daemon** gets its secrets from the **macOS Keychain** under a dedicated non-admin
   `ci-runner` user, seeded **once** by the founder (over Tailscale SSH) from the platform stores, rotated via
   the config platform. **No secret is ever tree-resident** (the gitleaks floor + the registry's metadata-only
   invariant hold unchanged). **Break-glass extends cleanly** — and we recommend an **Ed25519 upgrade** so the
   *signing* capability never lives on the execution node (ADR-3).
5. **Funnel: NO. Serve: yes, internally.** Nothing in this architecture needs a public ingress — the GH runner
   **long-polls outbound**, so there is no inbound webhook to expose. Tailscale **Funnel** (public exposure)
   would discard the entire value of the overlay; **avoid it**. Tailscale **Serve** (tailnet-only HTTPS with a
   MagicDNS cert) is the right way to expose the health endpoint *to the watchdog* without a raw bound port.
6. **Tailnet lock: NOT yet (honest cost/benefit).** Device-approval (manual authorization) + key-expiry policy
   covers N=2–3 owned nodes. **Tailnet lock earns its operational weight at the FIRST of:** a cloud/external
   node, a second human, or any node holding the prod break-glass key. Named trigger, not "someday."
7. **Security verdict (§G):** **GO — safe enough for a solo founder on private repos**, *conditional on six
   hard preconditions* (ephemeral runner · non-admin `ci-runner` · ACL outbound-only for `tag:ci-runner` ·
   off-Neo push-watchdog · no Funnel · never `pull_request_target` on self-hosted). **Re-evaluate the instant**
   a second contributor, a public fork, or an external node appears — at which point ephemeral-per-job
   isolation and tailnet lock stop being optional.

---

## A. Tailnet Design

### A.1 What is *on* the tailnet vs *reached over the public internet*

This distinction is the spine of the whole model. Get it wrong and you either try to VPN a SaaS you can't
install an agent on, or you leave an execution node addressable on the public internet.

| Entity | On the tailnet? | How it is reached | Why |
|---|---|---|---|
| **Windows dev PC** (`windows-node1`) | **YES** — `tailscaled` member, `tag:dev` | by MagicDNS name | owned hardware; founder's build host |
| **Neo** (MacBook, `neo`) | **YES** — `tailscaled` member, `tag:exec-node,tag:ci-runner` | by MagicDNS name | owned hardware; the execution node |
| Future **Linux node** (`linux-node3`) | **YES** | by MagicDNS name | owned hardware |
| Future **Mac Studio** (`studio-node4`) | **YES** | by MagicDNS name | owned hardware |
| Future **cloud worker** (`cloud-node5`) | **YES** — but `tag:external` (quarantined) | by MagicDNS name, ACL-fenced | rented hardware; **untrusted trust-domain** |
| Founder **laptop / phone** | **YES** — personal devices, `group:founder` | by MagicDNS name | the admin + observability surface |
| The **watchdog** (push target) — Healthchecks.io | **NO** | Neo pushes heartbeats *out* over public TLS | SaaS; we cannot agent it, and we *want* it off-domain (§B.4) |
| **Vercel** (deploy + prod runtime) | **NO** — SaaS | nodes call `api.vercel.com` outbound over TLS with `VERCEL_TOKEN` | managed serverless; no agent installable; identity travels with the **token**, not the host (EIB §1.2) |
| **Supabase Postgres** (the durable bus + prod DB) | **NO** — SaaS | nodes connect to `*.pooler.supabase.com:6543/5432` outbound over TLS with pooler creds | managed Postgres; reached over the public pooler with TLS (EIB §5.3) |
| **GitHub** (system of record, runner control) | **NO** — SaaS | the runner **long-polls outbound** to `api.github.com`; git over HTTPS | managed; the runner is a client, never a server |

**The load-bearing consequence:** the tailnet carries **node↔node ops + health + (future) inter-node job
dispatch**. The *heavy* data paths — the durable Postgres bus, the deploy, the git pulls — are **outbound
public-TLS egress to SaaS**, and are therefore **unaffected by a tailnet outage** (EIB §11: "nodes still reach
Supabase/GitHub/Vercel over public TLS; only founder ops-SSH degrades"). Tailscale is the **control/ops plane**,
not the data plane. This is deliberate: it keeps the blast radius of a Tailscale failure small.

> **Why isn't the durable bus on the tailnet?** Because Supabase is the bus, and Supabase is SaaS you reach
> over its pooler. We do **not** invent a self-hosted bus to put it on the tailnet — that would trade a managed,
> backed-up, RLS-enforced Postgres for a box the founder must keep alive. The bus stays on Supabase; the tailnet
> is for the *nodes*, not for the *system of record*. (If a future self-hosted bus ever appears, it binds to
> `tailscale0` and this table gains a row — no architectural change.)

### A.2 Where Tailscale physically sits

```
   PUBLIC INTERNET (TLS + platform creds — NOT the tailnet)
   ┌──────────────┐   ┌───────────────────────┐   ┌──────────────────────┐   ┌────────────────────┐
   │   GitHub     │   │  Vercel (deploy+prod)  │   │  Supabase (bus+DB)   │   │  Healthchecks.io   │
   │ (runner ctl, │   │  api.vercel.com        │   │  *.pooler.supabase   │   │  (push watchdog)   │
   │  git, checks)│   │  (VERCEL_TOKEN)        │   │  :6543/:5432 (TLS)   │   │  (Neo pings OUT)   │
   └──────▲───────┘   └──────────▲────────────┘   └──────────▲───────────┘   └─────────▲──────────┘
          │ outbound long-poll   │ outbound TLS              │ outbound TLS            │ outbound TLS
          │                      │                           │                         │
  ════════╪══════════════════════╪═══════════ TAILNET (WireGuard mesh, 100.x, MagicDNS) ═══════════════
          │                      │                           │                         │
  ┌───────┴──────────────────────┴───────────────────────────┴─────────────────────────┴────────────┐
  │                                                                                                    │
  │   windows-node1            neo (exec)                  [linux-node3]        founder laptop/phone   │
  │   tag:dev                  tag:exec-node,ci-runner      tag:exec-node       group:founder          │
  │   • build / Claude         • GH self-hosted runner      (future)            • admin + observe      │
  │   • git push (gate)        • worker daemon (launchd)                        • Tailscale SSH in     │
  │   • tailnet WATCHDOG ──────▶ • health endpoint (Serve, tailnet-only) ◀──────── (read health only)  │
  │     (pulls Neo health)     • test Postgres (colima, 127.0.0.1 only)                                │
  │                            • deploy executor (VERCEL_TOKEN, outbound)        [cloud-node5]          │
  │                                                                              tag:external          │
  │                                                                              (QUARANTINED)          │
  └────────────────────────────────────────────────────────────────────────────────────────────────────┘
        services bind to the tailnet interface (or 127.0.0.1), NEVER to 0.0.0.0 / a public IP
```

**The rule that makes it secure: bind to the tailnet, not the world.** The Neo worker daemon's health
endpoint, any inter-node dispatch listener, and SSH all bind to the `tailscale0` interface (or are exposed via
Tailscale Serve). The **test Postgres binds to `127.0.0.1` only** — it is never reachable even on the tailnet
(no node but Neo's own jobs need it). The deploy executor and the bus connection are **outbound** and bind
nothing. Net inbound listening surface on Neo = **SSH (Tailscale SSH) + the health endpoint (Serve), both
tailnet-only.**

### A.3 MagicDNS naming scheme

- Enable **MagicDNS** — nodes address each other by name, never by `100.x` IP (which can change) or LAN IP
  (which is meaningless across networks). Stable names are what let the `ExecutionProviderPort` registry
  (EIB §9) reference `nodeId: "neo"` and have it resolve everywhere.
- Names map 1:1 to the EIB node IDs: `windows-node1`, `neo`, `linux-node3`, `studio-node4`, `cloud-node5`.
  (The blueprint sketched `neo-node2`; we shorten the hostname to **`neo`** for ergonomics — the *role* is
  Execution Node 1, the *hostname* is `neo`, the *port nodeId* can stay `neo-node2` if the registry prefers.)
- The tailnet's MagicDNS suffix (`*.ts.net`) gives each a fully-qualified name + a valid HTTPS cert via
  Tailscale Serve — so the health endpoint is `https://neo.<tailnet>.ts.net/...` with a real cert, no
  self-signed-cert warnings, no DNS to manage.

### A.4 Subnet routers — **NOT needed** (and why that's good)

A subnet router advertises a *non-Tailscale* CIDR (e.g. a whole LAN) into the tailnet so tailnet members can
reach un-agented devices. **We have none of that need:** every node we care about runs `tailscaled` directly,
and the SaaS we reach is public, not LAN-local. **Do not deploy a subnet router** — it is a standing
de-segmentation risk (it punches a hole from the tailnet to a flat LAN). The clean-mesh property ("every host
is individually addressed and individually ACL'd") is worth preserving. *Re-evaluate only if* a future device
genuinely cannot run `tailscaled` (e.g. a NAS or a printer you must reach) — and even then, scope the advertised
route as tightly as possible and ACL it hard.

### A.5 Exit node — **NOT needed** (do not route node traffic through one)

An exit node routes a device's *entire* internet egress through another tailnet node. **Neo and the dev PC
should reach Vercel/Supabase/GitHub over their own local internet, directly** — routing that through an exit
node would add latency, a dependency, and a bottleneck for zero security gain (the traffic is already TLS). The
**only** legitimate exit-node use here would be the founder's *phone on hostile Wi-Fi* wanting a trusted egress
— a personal-device convenience, **never** part of the execution path. Default: **no exit node** in the
execution architecture.

---

## B. Secure Connectivity + Service-to-Service

How each pair actually talks, and on which plane.

### B.1 The GH self-hosted runner ↔ GitHub (control + secrets)
- **Outbound only**, over the public internet, TLS, to `*.github.com`. The runner **registers** with a
  short-lived registration token, then **long-polls** for jobs. **No inbound port** — GitHub never connects
  *to* Neo. **Tailscale is not on this path at all.** This is why we need no Funnel/webhook ingress.
- Secrets for a job (`VERCEL_TOKEN`, pooler creds, `CRON_SECRET`) are **injected by GitHub into the job's
  process env** over that same TLS channel, exactly as for a hosted runner — never written to disk, never
  tree-resident.

### B.2 The worker daemon ↔ the durable bus (Supabase)
- **Outbound** to `*.pooler.supabase.com:6543` (transaction pooler, `prepare:false`) for app work and `:5432`
  (session pooler) for migrations, TLS, with pooler creds from the Keychain (§F). Neo is IPv4 — it **must** use
  the pooler, never the IPv6-only direct host (EIB §5.3). **Tailscale is not on this path.** A tailnet outage
  does not stop the worker from draining the bus — that is the resilience property we designed for.

### B.3 Node ↔ node (the tailnet's actual job)
- **Founder ops:** founder laptop/phone → `neo` via **Tailscale SSH** (§C) and → the health endpoint.
- **The watchdog (pull side):** `windows-node1` → `neo` health endpoint over the tailnet (Tailscale Serve,
  tailnet-only HTTPS). This is the *active* liveness check on owned hardware.
- **Future inter-node dispatch:** when the `ExecutionProviderPort` routes a `build`-kind job from
  `windows-node1` to `neo`, or a `verify`-kind job the other way, that control traffic rides the tailnet
  (MagicDNS + ACL). Today this is mostly latent — the bus mediates most work — but the fabric is *ready* for it,
  which is the whole point of choosing the overlay at the foundation.
- **What does NOT cross the tailnet:** the heavy data (bus, git, deploy). Keep it that way.

### B.4 The off-Node watchdog reaching in (the failure-domain rule)
The dead-man's-switch must live on a **different failure domain** than the supervisor it watches (EIB §4.4) —
a Neo outage must not silence its own alarm. Two complementary patterns, both designed to avoid any public
ingress on Neo:
1. **Push (primary):** the Neo worker daemon **pings *out*** to **Healthchecks.io** every interval over public
   TLS. If the pings stop (Neo down, daemon crashed, network gone), Healthchecks alarms the founder by
   email/SMS. **No inbound to Neo, no tailnet dependency, genuinely independent domain.** This is the cleanest
   answer to "how does an external SaaS monitor reach a node with no public port" — *it doesn't; the node
   reaches it.*
2. **Pull (secondary, on-tailnet):** `windows-node1` runs a Scheduled Task that pulls Neo's health endpoint
   over the tailnet (Tailscale Serve). This catches the "daemon is up enough to ping Healthchecks but actually
   wedged" class, and gives a second independent alarmer. Windows + Neo are independent power/hardware domains.

> **Do NOT** expose Neo's health endpoint to the public internet via Funnel just so an external monitor can
> pull it. The **push** model removes that need entirely. (Funnel verdict: avoid — §H.)

### B.5 Founder devices (laptop/phone) reaching services
- **Laptop:** `group:founder`, full ops (Tailscale SSH to all owned nodes, health, admin). This is the device
  from which the founder issues break-glass grants and approves new nodes.
- **Phone:** `group:founder` but **observability-scoped by ACL** — it can reach **health/observe endpoints**,
  not SSH-admin and not the secrets bootstrap. A phone is the most-likely-lost device; it should be able to
  *see* that the fleet is alive, not *administer* it. (Enforced in the ACL, §D.)

---

## C. SSH — Tailscale SSH vs Traditional Keys

**Recommendation: Tailscale SSH as the primary ops path. No public `sshd`. Keep a local-console fallback.**

### C.1 Why Tailscale SSH
- **Keyless + identity-tied.** Access is governed by the **tailnet identity + the ACL `ssh` block**, not by a
  pile of `~/.ssh/authorized_keys` files you must distribute, rotate, and audit by hand. The question "who can
  SSH to Neo?" is answered by **one block of policy-as-code**, reviewable in git, not by spelunking key files
  on five hosts.
- **ACL-governed, least-privilege.** You grant `group:founder → tag:exec-node` as `root`/`ci-runner` and that's
  the whole grant. `tag:ci-runner` cannot SSH anywhere. The dev PC cannot be SSH'd *into* by Neo.
- **Auditable + optionally recorded.** Tailscale SSH supports **session recording** (stream to a recorder node)
  and a **`check` mode** (re-authenticate via the browser/`tailscale up` for high-value sessions). For a node
  holding a prod deploy token, turning on `check` for `root` sessions is a cheap, strong control.
- **No exposed attack surface.** There is **no `sshd` on a public port** to be scanned, brute-forced, or hit by
  a `sshd` CVE from the internet. SSH is reachable *only* from inside the tailnet, *only* by ACL-permitted
  identities. This is a categorical reduction in attack surface vs a port-forwarded `sshd`.

### C.2 The trade-off (stated honestly)
- **Dependency on `tailscaled` + the coordination server.** If the tailnet control plane is unreachable *and*
  the local node has no cached state, Tailscale SSH can fail. Mitigation: Tailscale caches ACL/identity state
  locally so brief control-plane outages don't lock you out; and the **local-console fallback** covers the
  worst case.
- **The break-glass case.** When you most need to SSH in is often when something is broken. Therefore: keep a
  **standard local macOS user account with a strong password / physical access** as the ultimate fallback — but
  **do not** enable the public `sshd` daemon for it. Physical/console access (or screen-sharing over the
  tailnet) is the recovery path, not an internet-facing `sshd`.
- **Traditional keys are not eliminated where a third party requires them** — e.g. `git` over SSH to GitHub
  uses a deploy key / the `gh` token; that is unrelated to host SSH and stays as-is.

### C.3 The decision
Tailscale SSH **primary** (ACL-governed, `check`-mode on `root` for the prod-token node, optional session
recording) + **local-console fallback** + **zero public `sshd`**. Traditional host SSH keys are **retired** as
the inter-node ops mechanism. (ADR-2.)

---

## D. ACL Strategy — Concrete Starter Policy

Principle: **default-deny, tag-based, least-privilege.** Untagged/implicit access does not exist; every allowed
flow is an explicit grant. The CI runner can reach what it needs to *do its job* and **nothing else** — not the
dev PC's other ports, not laterally into the tailnet. The dev PC (founder's host) is broad. The watchdog can
reach **only** health. `tag:external` is quarantined to enforce the `data_class` boundary at the network layer.

This is the Tailscale policy file (HuJSON). It is a **starter** — opinionated, deployable, and annotated.

```jsonc
{
  // ---- WHO owns which tags (only these identities may assign a tag to a device) -------------------
  "tagOwners": {
    "tag:dev":        ["group:founder"],
    "tag:exec-node":  ["group:founder"],
    "tag:ci-runner":  ["group:founder"],
    "tag:watchdog":   ["group:founder"],
    "tag:external":   ["group:founder"]   // a cloud node is still founder-owned, but trust-fenced below
  },

  "groups": {
    // The only human. A second contributor is a NAMED re-evaluation trigger (§G), not a silent group add.
    "group:founder": ["brian.kasanwiredjo@gmail.com"]
  },

  // MagicDNS convenience aliases for ports referenced below (documentation; not required).
  "hosts": {
    "neo": "neo"   // resolved via MagicDNS; pinning a 100.x here is optional and discouraged (IPs drift)
  },

  // ---- THE ACCESS MATRIX (default-deny; every line is an explicit allow) --------------------------
  "acls": [
    // 1) The founder's own devices reach everything. The keys-to-the-kingdom device class.
    {
      "action": "accept",
      "src": ["group:founder"],
      "dst": ["*:*"]
    },

    // 2) The DEV PC (founder's build host) reaches the exec nodes' OPS surface:
    //    SSH (governed separately in the ssh block) + the health endpoint. It does NOT get a blanket *:*
    //    — even a trusted dev host is scoped to the ports it actually uses, so a dev-host compromise
    //    cannot freely pivot across every port on the exec node.
    {
      "action": "accept",
      "src": ["tag:dev"],
      "dst": ["tag:exec-node:22", "tag:exec-node:443", "tag:exec-node:8787"]  // ssh, serve-https, health
    },

    // 3) The WATCHDOG reaches ONLY the health endpoint on exec nodes. Not SSH, not anything else.
    //    (This is the on-tailnet pull watchdog of §B.4; the push watchdog needs no inbound rule at all.)
    {
      "action": "accept",
      "src": ["tag:watchdog"],
      "dst": ["tag:exec-node:8787"]   // health only
    },

    // 4) EXEC NODES reach each other on the inter-node DISPATCH port only (future ExecutionProviderPort
    //    job hand-off). No blanket node-to-node *:*. Latent today, fenced for when it lights up.
    {
      "action": "accept",
      "src": ["tag:exec-node"],
      "dst": ["tag:exec-node:9443"]   // inter-node dispatch (mutually-authenticated)
    }

    // 5) tag:ci-runner: NO inbound acl line exists. A ci-runner device is reachable by NOTHING on the
    //    tailnet (default-deny). Its OUTBOUND internet egress (GitHub/Vercel/Supabase) is NOT a tailnet
    //    flow and is therefore NOT governed here — it is the host firewall's job (§E.5). The ci-runner is
    //    deliberately a tailnet SINK: it can be reached by the founder (rule 1) for ops, and otherwise it
    //    only talks OUT to SaaS over public TLS.

    // 6) tag:external (cloud node): NO acl line grants it any inbound, and NO line lets it reach
    //    tag:exec-node, tag:dev, or anything else. It is QUARANTINED — reachable only by group:founder
    //    (rule 1) for ops. It cannot pivot to a trusted node. This is the NETWORK enforcement of the
    //    data_class trust boundary (RS-DOS §54.2): an external-trust node is physically unable to reach
    //    a trusted node's services, which backstops the selector's refusal to place PII/SECRET on it.
  ],

  // ---- TAILSCALE SSH (keyless, identity-tied; §C) -------------------------------------------------
  "ssh": [
    {
      // The founder may SSH to any owned exec node, as root or the ci-runner user.
      // "check" forces periodic re-auth (browser/tailscale up) for high-value sessions on the prod-token node.
      "action": "check",
      "src": ["group:founder"],
      "dst": ["tag:exec-node"],
      "users": ["root", "ci-runner"]
    },
    {
      // The dev host may SSH to exec nodes as the NON-privileged ci-runner user only (ops automation),
      // never root. "accept" (no interactive re-auth) since it's a machine-to-machine path.
      "action": "accept",
      "src": ["tag:dev"],
      "dst": ["tag:exec-node"],
      "users": ["ci-runner"]
    }
    // No ssh rule mentions tag:ci-runner or tag:external as a SOURCE → they can SSH to nothing.
    // No ssh rule lists tag:dev as a DESTINATION → nothing can SSH INTO the dev PC over Tailscale.
  ],

  // ---- DEVICE POSTURE / ATTRIBUTES (optional hardening hooks) -------------------------------------
  "nodeAttrs": [
    {
      // Disable inbound connections to ci-runner from the wider tailnet at the node level too
      // (belt-and-suspenders with the default-deny acls above).
      "target": ["tag:ci-runner"],
      "attr": ["funnel:deny"]   // a ci-runner may NEVER be Funnel-exposed to the public internet
    }
  ],

  // ---- KEY EXPIRY / DEVICE LIFECYCLE is set in the admin console + auth-key flags, not this file ---
  // (see §E). Tagged server nodes (neo) have key-expiry handled per §E.2; ephemeral CI nodes per §E.3.

  // ---- TESTS: assert the policy says what we think (Tailscale supports acl tests) -----------------
  "tests": [
    { "src": "tag:watchdog",  "accept": ["tag:exec-node:8787"], "deny": ["tag:exec-node:22", "tag:exec-node:9443"] },
    { "src": "tag:ci-runner", "deny":   ["tag:dev:22", "tag:exec-node:22", "tag:exec-node:8787"] },
    { "src": "tag:external",  "deny":   ["tag:exec-node:8787", "tag:exec-node:9443", "tag:dev:22"] },
    { "src": "tag:dev",       "accept": ["tag:exec-node:8787"], "deny": ["tag:exec-node:9443"] }
  ]
}
```

**What the policy enforces, in words:**
- The **founder's devices** are the only thing with broad reach (rule 1). Everything else is scoped.
- The **CI runner is a tailnet sink** — nothing on the tailnet can reach it, and the policy file's `tests`
  prove it can't reach the dev PC or the exec node's other ports. Its job-secrets exposure is bounded to its
  *outbound* SaaS calls.
- The **watchdog** can hit **only** `:8787` (health). The `tests` block fails the policy if that ever silently
  widens.
- **`tag:external` is quarantined** — the network *physically* cannot carry PII/SECRET to it, which is the
  defense-in-depth partner to the `ExecutionProviderPort` selector's fail-closed `data_class` refusal (EIB
  §9.4). Two independent layers say "no" before an external node ever touches sensitive data.
- **The dev PC is never an SSH destination** and the ci-runner/external tags are never an SSH source — lateral
  movement paths are closed by omission under default-deny.

> Ship the `tests[]` block **with** the policy. An ACL without tests is an assertion; an ACL with tests is a
> gate. This mirrors the framework's own "validate-the-validator" discipline (the i-config self-test, the
> gitleaks planted-secret).

---

## E. Device Trust, Authorization & Key Rotation

### E.1 Device authorization — manual approval ON
Turn on **manual device approval** in the admin console. A new device does **not** get tailnet access on auth
alone — the founder must approve it. At N=2–3 owned nodes this is near-zero friction and closes the "someone
got an auth key and joined" hole. (This is the cheap 80% of what tailnet lock does; see E.6.)

### E.2 Key expiry — the owned-server policy
- **Personal devices** (laptop/phone): **key expiry ON** (default ~180 days) — they re-auth periodically, which
  is healthy for the most-likely-lost devices.
- **Neo / owned server nodes:** Tailscale **disables key expiry on tagged devices by default** (a tagged node
  is a "server," not a user). That is the right call for an always-on execution node (you don't want Neo
  silently dropping off the tailnet at 3am because a key expired). **But** disabled expiry means the node's
  authorization is durable — which is exactly why **device-approval (E.1) + tailnet lock at the trigger (E.6)**
  matter for these nodes. Document this trade-off; don't let "expiry off" be silent.

### E.3 Ephemeral + pre-authorized keys for transient nodes
- The EIB calls for **ephemeral GitHub Actions runners** (clean per job). If a *job* needs to be a distinct
  tailnet node (it generally won't — Neo itself is the tailnet member and jobs run on it), use an **ephemeral
  auth key**: the node auto-removes from the tailnet shortly after it goes offline, so the device list doesn't
  fill with dead job-runners.
- **Pre-authorized keys** (a key that joins without manual approval) are appropriate **only** for fully
  automated, ephemeral, tagged nodes provisioned by a script (e.g. a future autoscaled `cloud-node5` fleet).
  For the two persistent owned nodes, **prefer manual approval** — they're set up once, by hand, by the founder.
- **Auth-key hygiene:** ephemeral + tagged + short-lived + single-use where possible. Never a long-lived,
  reusable, untagged auth key sitting in a script or a repo (that *is* a tree-resident secret — the gitleaks
  floor would catch it, and rightly).

### E.4 Compromised / lost device — the runbook
| Device | Immediate action | Residual exposure | What protects you |
|---|---|---|---|
| **Phone lost** | Admin console → **remove device** (+ revoke its key). Wipe remotely (MDM/Find My). | Phone could reach **health endpoints only** (ACL-scoped) until removed. No SSH, no secrets. | The phone was never granted SSH/secrets. Removal is instant. |
| **Laptop stolen** | Remove device + revoke key; **rotate any secret the laptop could fetch**; re-issue from a clean device. | Laptop is `group:founder` (broad) — high reach until removed. | Disk encryption (FileVault/BitLocker) on the laptop; fast removal; tailnet lock (when on) prevents re-add. |
| **Neo compromised** | Remove device; **rotate every Neo-resident secret** (deploy token, pooler creds, break-glass key) via the config platform; rebuild the OS user. | The crown-jewel case — see §G blast radius. | Non-admin `ci-runner`, ephemeral jobs, ACL sink, no service-role DB creds, immutable prod ledgers, Ed25519 break-glass (ADR-3). |
| **An auth key leaks** | Revoke the key in the console; it cannot mint new nodes. | If it was reusable/long-lived: any node it joined. | Ephemeral/single-use keys mean a leaked key is near-worthless. |

The universal property: **removal is centralized and instant** (one console action / one `tailscale logout`),
and **no node holds essential state** (EIB §11) so re-provisioning is a `join`, not a recovery project.

### E.5 The host firewall still matters (Tailscale is not the whole story)
Tailscale ACLs govern *tailnet* traffic. They do **not** govern Neo's **local LAN** or its **outbound internet**.
So:
- **Enable the macOS application firewall**; ensure no service binds `0.0.0.0`. The worker daemon's health
  endpoint and any dispatch listener bind to the **tailnet interface** (or are Tailscale Serve), and the test
  Postgres binds **`127.0.0.1`**. Verify with `lsof -iTCP -sTCP:LISTEN` that nothing listens on a routable LAN
  address. This closes the "someone on Neo's home Wi-Fi reaches the runner directly, bypassing the tailnet"
  gap that ACLs alone don't cover.
- **Outbound egress** (ci-runner → GitHub/Vercel/Supabase) is intentionally open over public TLS. If you later
  want to constrain it (egress allow-listing as exfiltration defense), that's a host-firewall / `pf` rule, not
  a Tailscale ACL — named as a future hardening, not built now.

### E.6 Tailnet lock — deferred, with a NAMED trigger
**Tailnet lock** cryptographically requires that new nodes be **co-signed by trusted signing keys you hold**, so
that *even a compromised Tailscale coordination server* cannot inject a rogue node into your tailnet. It is a
strong control — and it has real operational weight (you manage signing keys; adding a node needs a signing
device present).

**Verdict: not yet.** At N=2–3 owned nodes with device-approval on, the marginal risk tailnet lock closes
(a compromised Tailscale control plane silently adding a node) is **lower** than the marginal risk it *adds*
(founder locks himself out by mishandling signing keys, solo, with no second admin). **Enable tailnet lock at
the FIRST of these triggers:**
1. A **cloud/external node** (`cloud-node5`) joins — now a node lives on hardware you don't physically control.
2. A **second human** joins the tailnet — the "one founder, one device class" simplification ends.
3. Neo (or any node) becomes the **sole holder of a high-value signing key** that a rogue-node injection could
   abuse — e.g. once the prod break-glass key is Neo-resident *and* asymmetric migration (ADR-3) is deferred.

Until then: **device-approval + key-expiry policy + the ACL** are the proportionate control set.

---

## F. Secrets — How Nodes Get Them Without Secrets in the Tree

**The invariant is unchanged and non-negotiable:** *zero secret values in any repo* (gitleaks floor, RS-DOS
§30) and *the registry records metadata, never a value* (i-config invariant #1/#2). A self-hosted node does not
relax this — it only changes **where the platform store hands a secret to the compute.** Tailscale **carries no
secret**; it gates **who can reach the place a secret is fetched/used.**

### F.1 The two distinct secret-consumers on Neo (do not conflate)
1. **GitHub Actions jobs** (the required checks + deploy). Secrets are **injected by GitHub into the job env**
   over GitHub's TLS channel — the *same path as a hosted runner*. They live in the job process for the job's
   lifetime and **vanish with the ephemeral runner**. Nothing is written to disk; nothing is tree-resident.
   **Tailscale is not involved.**
2. **The worker daemon** (the launchd cron-killer — *not* a GH job). It needs `DATABASE_URL` (pooler),
   `CRON_SECRET`, the break-glass signing material, etc., at process start. These come from the **macOS
   Keychain** under the dedicated **non-admin `ci-runner` user**, read at start, **never** from a dotfile or
   the repo.

### F.2 The secrets bootstrap (the chicken-and-egg, solved honestly)
The hard question: Neo needs `DATABASE_URL`/`VERCEL_TOKEN`/signing-key, but no secret is in the tree and we
don't want a long-lived god-token sitting on disk. The bootstrap:

```
  ONE-TIME, founder-driven, over Tailscale SSH (identity-gated, no public port):
  ┌───────────────────────────────────────────────────────────────────────────────────────┐
  │ 1. Founder SSHes to neo as `ci-runner` via Tailscale SSH (ACL rule, §D). No password    │
  │    in the clear, no exposed sshd.                                                        │
  │ 2. Founder pulls each value from its AUTHORITATIVE platform store, on the fly:           │
  │      • VERCEL_TOKEN, pooler DATABASE_URL  ← `vercel env pull` / Vercel dashboard         │
  │      • CRON_SECRET, PROD_SMOKE_TOKEN      ← `gh secret` is write-only; pull from the      │
  │                                             source-of-record (the founder's vault)        │
  │      • BREAK_GLASS_SIGNING_KEY            ← the founder's vault (see ADR-3 re: Ed25519)    │
  │ 3. Founder writes each into the ci-runner Keychain:                                      │
  │      security add-generic-password -a ci-runner -s DATABASE_URL -w '<value>' -U           │
  │    (interactive; the value is typed/pasted into the SSH session, never echoed to a file) │
  │ 4. The worker daemon reads them at start via `security find-generic-password ... -w`,    │
  │    loads them into its OWN process env, and NEVER writes them down.                       │
  └───────────────────────────────────────────────────────────────────────────────────────┘
```

- **Why this is acceptable:** the bootstrap is **manual, rare, identity-gated (Tailscale SSH), and leaves no
  tree-resident artifact.** The Keychain is OS-encrypted, scoped to the `ci-runner` user (the founder's
  *personal* Keychain is untouched and unreachable by the runner), and the values are **rotatable** via the
  config platform. The fail-closed `config-doctor` / `i-config --enforce` gate refuses to let the daemon run
  with an incomplete/invalid secret set — so a half-bootstrapped node fails loud, not silent.
- **Tailscale's exact role here:** it is **how the founder reaches Neo to do the bootstrap** (keyless,
  ACL-governed) and **how the founder reaches Neo to rotate** — it gates *access to the act of provisioning*. It
  **never** transports the secret value as data-at-rest and **never** stores it. Transport + identity gate, full
  stop.

### F.3 The verification path uses the SAME oracle (no new mechanism)
`i-config.mjs` already does **presence-only** checks on remote planes and **value-read-but-never-emit** on the
local/trusted plane. On Neo (a trusted, §54.2-inside node), running `i-config --include-local --enforce` against
the registry is the **readiness gate before the daemon starts** — it confirms every required key is PRESENT and
valid *without ever printing a value*. The self-hosted node reuses the platform's existing oracle; it invents no
new secrets tooling.

### F.4 Least privilege per credential (no god-token on Neo)
- **Deploy:** `VERCEL_TOKEN` is **deploy-scoped** to the team scope (`team_1CST…`), and identity travels with
  the token (EIB §1.2) — the runner deploys *as the founder* without the founder click-deploying. A leaked
  deploy token can deploy; it cannot read the DB or mint a prod write.
- **Bus:** the `DATABASE_URL` uses a **non-service-role** Postgres principal so **RLS (ADR-004) still applies** —
  a leaked pooler cred is bounded by row-level security, not a god connection.
- **Runner job token:** GitHub's `GITHUB_TOKEN` is **job-scoped and auto-expires** — no standing CI god-token.
- **Break-glass signing material:** the highest-value secret on Neo. See §F.5 + ADR-3.

### F.5 Break-glass, extended to the self-hosted node
The audited break-glass (`src/db/break-glass.ts`) is the *only* path a write reaches prod, and it already
assumes neutral hardware: `consumeGrant` is "called by the migration-runner on neutral hardware, never by an
agent pasting a token." Neo **is** that neutral hardware now. The extension:
- The **founder issues** a grant (`issueGrant`) from a **trusted founder device** (laptop, `group:founder`) —
  HMAC-signed, single-use, short-TTL (≤10 min default, ≤1 h ceiling), scoped to one `(table, op)`, **bound to
  the prod `DATABASE_URL` fingerprint**.
- The **Neo migration-runner consumes** it (`consumeGrant`), with `BREAK_GLASS_ACTION_ID`/`BREAK_GLASS_TOKEN`
  injected from the platform store — **not** pasted by an agent. The grant is spent atomically (single-use
  partial-unique index) and every issue/consume/deny is **immutably logged** (0054).
- **Tailscale's role:** it gates that the founder *issuing* the grant and the runner *consuming* it are on
  **ACL-trusted nodes** — a quarantined `tag:external` node can never be the consumer. It is the *who-may-reach*
  fence around the break-glass act; the cryptographic grant is the *who-may-write* proof. Two independent gates.

> **The honest weakness, surfaced not smoothed (Invariant §11):** break-glass today is **HMAC (symmetric)** —
> `consumeGrant` calls `resolveSigningKey` to *verify*, which means **the verifying node (Neo) holds the key
> that can also *sign*.** A fully-compromised Neo could therefore *self-issue* a grant. The grant is still
> single-use, short-TTL, target-bound, and immutably logged, and **no grant can disable the DB-level
> immutability triggers** (invoice/audit ledgers keep firing regardless) — so the blast radius is "a scoped,
> logged, non-ledger-tampering prod write," not "silent data forgery." **But this is the strongest argument for
> ADR-3 (migrate to Ed25519 asymmetric):** put the **private signing key only on the founder's device**, ship
> Neo the **public key** to verify — then a compromised execution node **cannot mint a grant at all.** This is
> the single highest-leverage hardening in this whole document.

---

## G. The Complete Security Model (the load-bearing deliverable)

### G.1 Trust boundaries (concentric, named)
1. **The tailnet membership boundary.** Inside = nodes that authenticated + were approved + carry a tag.
   Outside = the public internet. *Crossing in* requires WireGuard identity. **But membership ≠ trust** — a
   member still gets only what its tag's ACL grants (default-deny).
2. **The tag/trust-domain boundary** (RS-DOS §54.2). `group:founder` (full) ⊃ `tag:dev` (broad-but-scoped) ⊃
   `tag:exec-node`/`tag:ci-runner` (sink, outbound-mostly) ⊃ `tag:external` (quarantined). The ACL is the
   *enforcement* of `data_class` placement: PII/SECRET physically cannot traverse to `tag:external`.
3. **The OS-user boundary on Neo.** `ci-runner` (non-admin, no founder-Keychain access) vs the founder's
   personal account. A runner-job compromise is boxed inside `ci-runner`.
4. **The secret-store boundary.** Secrets live in platform stores (Vercel/GitHub) + the `ci-runner` Keychain —
   never the tree, never a dotfile. Crossing this boundary to *use* a secret requires being the right OS user on
   the right (ACL-reachable) node.
5. **The write boundary (prod).** Default-DENY prod writes; the *only* crossing is a founder-signed, single-use,
   scoped, target-bound, immutably-logged break-glass grant — and even a valid grant **cannot** disable the
   ledger immutability triggers.

### G.2 The headline threat: a self-hosted runner runs untrusted code
This is the classic self-hosted-runner foot-gun: **a runner that executes PR code executes attacker code if the
PR is hostile**, and that code runs on *your* hardware with access to whatever the job can reach. Decomposed for
*this* setup:

| Sub-threat | Applicable here? | Bound by |
|---|---|---|
| Malicious PR from an external fork | **Not today** (private repos, solo, no external contributors) | Private repo; **and** `pull_request_target` is **banned** on self-hosted (the rule that turns a fork PR into a secret-stealer). Branch protection requires approval before a fork PR runs on self-hosted. |
| Compromised dependency in the build (supply chain) | **Yes — the real residual** | **Ephemeral runner** (clean checkout per job, no secret persists between jobs); **non-admin `ci-runner`** (can't touch the founder's Keychain/OS); **ACL sink** (the runner can't pivot laterally — it can only reach SaaS outbound); **least-scope job token** (auto-expiring `GITHUB_TOKEN`); **RLS-bounded DB cred**. |
| Secret exfiltration from a job | Bounded | Job secrets are deploy-scoped/RLS-bounded/auto-expiring; the runner's *outbound* is open (TLS to SaaS) so a determined exfil of an in-job secret is possible — **but the secret it can steal is itself least-privilege** (a deploy token, not a god key). Egress allow-listing (§E.5) is the named next hardening if the threat grows. |
| Persistence / implanting on the runner host | Bounded | **Ephemeral**: the runner is recreated per job; an implant in the workspace dies. OS-level persistence requires escaping `ci-runner` to admin — a separate privilege-escalation, not a given. |
| Lateral movement to the dev PC or prod | **Closed by the ACL** | `tag:ci-runner` is a tailnet **sink** — the `tests[]` block *proves* it cannot reach `tag:dev:22` or the exec node's other ports. The dev PC is never an SSH destination. |

**Net:** for **solo, private, founder-authored (or founder-supervised-Claude) code**, the untrusted-code
exposure is **low but not zero** (the supply-chain path is real). The five bounds above
(ephemeral · non-admin · ACL sink · least-scope token · no `pull_request_target`) shrink the blast radius from
"arbitrary code with your secrets on your network" to "ephemeral code, boxed in a non-admin user, that can reach
SaaS outbound with a least-privilege token and pivot nowhere." That is an **acceptable** residual for this
profile — and a **re-evaluate-now** residual the moment the code stops being founder-controlled.

### G.3 Attack surface (what an external attacker can even touch)
- **Public-facing inbound on owned nodes: effectively zero.** No public IP, no opened port, no public `sshd`,
  **no Funnel.** The only way to *reach* a node is to be inside the tailnet (WireGuard identity + approval +
  ACL). This is the single biggest security win of the design — the external attack surface of the execution
  layer is **the SaaS providers' surfaces (GitHub/Vercel/Supabase), not the founder's machines.**
- **Tailnet-internal surface:** SSH (Tailscale SSH, ACL-gated, optional `check`/recording) + the health
  endpoint (Serve, tailnet-only) + the latent dispatch port. All default-deny except the explicit grants.
- **Outbound surface:** open TLS to GitHub/Vercel/Supabase/Healthchecks — the intended egress, and the one
  exfil path a compromised job has (bounded by least-privilege secrets).
- **The Tailscale coordination server itself** is a trusted third party (it brokers keys/ACLs). Tailnet lock
  (deferred, §E.6) is the control that removes that trust — which is why a cloud node / second human flips it on.

### G.4 Device-compromise blast radius (per device, honestly)
| Compromised | Attacker gains | Hard limits | Crown-jewel risk |
|---|---|---|---|
| **Founder laptop** | `group:founder` (full tailnet), ability to issue break-glass grants, git push | Branch protection + author≠verifier-on-Neo + pre-push gate gate code; FileVault on the laptop; instant device removal | **Highest** — this is the keys-to-the-kingdom device. Protect it hardest (disk encryption, screen lock, no standing root SSH sessions). |
| **Neo (exec node)** | deploy token, pooler cred (RLS-bounded), **break-glass signing key (HMAC → can self-issue, §F.5)** | non-admin `ci-runner`; ephemeral jobs; ACL sink; immutable prod ledgers survive any grant; DB cred is non-service-role | **High** — the HMAC key is the worst item. **ADR-3 (Ed25519) removes this** by keeping the signing key off Neo. |
| **Phone** | health/observe view only (ACL-scoped) | no SSH, no secrets, no grant issuance; instant removal | **Low** — deliberately the least-privileged device, because it's the most-likely-lost. |
| **`cloud-node5`** (future) | only what `tag:external` grants = **nothing trusted** | quarantined by ACL; `data_class` selector refuses PII/SECRET; no lateral reach | **Low by construction** — the whole reason `tag:external` exists. |

**The structural mitigation across all rows:** **no node holds essential state** (durable bus = Supabase),
**removal is instant + centralized**, and **re-provisioning is a `join`.** Compromise → remove → rotate →
re-join. The one truly irreplaceable asset is the **Supabase database itself** — *back it up* (EIB §11); that
loss is the only one a node re-join doesn't fix.

### G.5 The honest verdict

**GO. This is safe enough for a solo founder operating private repos — conditional on six hard preconditions,
and with two named upgrades on the horizon.**

**Why it's safe *for this profile*:**
- The external attack surface of the execution layer is **near-zero** (no public ingress, no Funnel, WireGuard
  + ACL + approval to even reach a node).
- The untrusted-code threat is **bounded to a low residual** by ephemeral + non-admin + ACL-sink + least-scope
  + no-`pull_request_target` — and the code is currently **founder-controlled**, which is the assumption the
  whole risk rests on.
- Every secret is **least-privilege, non-tree-resident, rotatable**, and the prod-write path stays **default-
  deny behind a signed, logged, ledger-immutable grant.**
- **Reversibility** (EIB §12: flip one `runs-on` line back to GitHub-hosted) keeps the blast radius of *any*
  failure small — the property that makes self-hosting acceptable for a solo operator with no on-call.

**The six hard preconditions (each is load-bearing — drop one and the verdict weakens):**
1. **Ephemeral runner** (clean per job; no secret persists).
2. **Dedicated non-admin `ci-runner` user** (no founder-Keychain/OS access).
3. **ACL outbound-only for `tag:ci-runner`** (tailnet sink; the `tests[]` block proves it).
4. **Off-Neo push-watchdog** (Healthchecks.io, independent failure domain) — the thing that converts silent rot
   into a ping.
5. **No Funnel** anywhere in the execution layer (no public ingress, ever).
6. **Never `pull_request_target` on a self-hosted runner** (the fork-PR secret-theft vector).

**The two named upgrades (do these proactively, not reactively):**
- **ADR-3: migrate break-glass to Ed25519** so the signing key never lives on the execution node. Highest
  single-control leverage; do it before Neo becomes the long-term prod-write consumer.
- **Tailnet lock** at its named trigger (§E.6: cloud node / second human / Neo-resident high-value key).

**The re-evaluate triggers — when "safe for now" expires (any one of these flips the risk model):**
1. **A second human contributor** — "one founder, one trust simplification" ends; ephemeral-per-job and
   author-trust assumptions need re-deriving; tailnet lock + tighter ACLs become mandatory.
2. **A public repo or any external fork PR** — the untrusted-code threat goes from "supply-chain residual" to
   "primary"; self-hosted runners executing fork code is a **no** without much stronger isolation (dedicated
   VM-per-job, not just a non-admin user).
3. **An external/cloud execution node** (`tag:external`) — hardware you don't physically control joins; tailnet
   lock turns on; the `data_class` quarantine gets exercised for real.
4. **Neo holding the prod break-glass signing key under HMAC** for the long term — do ADR-3 first.
5. **A second tenant's PII flowing through Neo** — the trusted-node assumption needs re-confirming per data_class.

Until one of those fires, the architecture above is proportionate, honest, and reversible. **It does not pretend
the residual is zero** (supply-chain exfil, the HMAC self-issue gap, the solo-founder-is-the-SRE reality from
EIB §13 all remain) — it bounds each one and names the trigger that demands the next control.

---

## H. Recommended Tailscale Feature Set (use / avoid)

| Feature | Verdict | Why |
|---|---|---|
| **WireGuard mesh (core)** | **USE** | The whole foundation: identity-addressed, NAT-traversing, no public ports. |
| **MagicDNS** | **USE** | Stable node names = the `ExecutionProviderPort` registry can reference `neo` and have it resolve everywhere; valid HTTPS certs via Serve. |
| **ACLs (policy-as-code + `tests[]`)** | **USE** | Default-deny least-privilege; the `tests` block makes the policy a *gate*, not an assertion. The core security control. |
| **Tags** | **USE** | `tag:dev`/`exec-node`/`ci-runner`/`watchdog`/`external` — the trust-domain vocabulary the ACL + `data_class` boundary are built on. |
| **Tailscale SSH** | **USE** | Keyless, identity-tied, ACL-governed, `check`-mode + optional session recording; **no public `sshd`.** (ADR-2) |
| **Device approval** | **USE** | Cheap 80% of tailnet lock; closes "auth key → silent join" at N=2–3. |
| **Serve** (tailnet-only HTTPS) | **USE (internal)** | Expose the health endpoint to the watchdog with a real cert and **no raw bound port** — better than binding `:8787` directly. |
| **Ephemeral / pre-auth keys** | **USE (transient nodes only)** | Keep the device list clean for any future autoscaled/ephemeral node; **manual approval for the 2 persistent owned nodes.** |
| **Tailnet lock** | **DEFER (named trigger)** | Strong, but real solo-lockout risk now; earns its weight at cloud-node / 2nd-human / Neo-high-value-key (§E.6). |
| **Exit node** | **AVOID (in the exec path)** | Adds latency + a dependency for zero gain; SaaS traffic is already TLS. (Phone-on-hostile-WiFi is the only personal-convenience exception.) |
| **Subnet router** | **AVOID** | Nothing here needs it; it's a standing de-segmentation risk. Re-evaluate only for a genuinely un-agentable device. |
| **Funnel** (public ingress) | **AVOID — hard no** | Would discard the entire overlay value by re-exposing a node to the public internet. The runner long-polls outbound + the watchdog is push, so **no inbound is ever needed.** `funnel:deny` is pinned on `tag:ci-runner` in the ACL. |

---

## I. ADRs (the load-bearing security choices)

### ADR-1 — Tailscale (WireGuard mesh) is the FOUNDATIONAL execution-layer fabric
- **Status:** Proposed (founder pre-authorized the intent).
- **Context:** The Runtime must be execution-provider-independent (EIB §9); adding a node must be a `join`. We
  must pick the network fabric once, at the foundation, before three nodes talk over LAN IPs + opened ports.
- **Decision:** Adopt Tailscale as the overlay every execution node joins. Services bind to the tailnet
  interface (or `127.0.0.1`), never to a public IP. SaaS (Vercel/Supabase/GitHub) stays **off** the tailnet,
  reached as outbound public-TLS egress. Tailscale is the **control/ops plane**, not the data plane.
- **Consequences:** (+) zero public inbound surface; adding a node is a join + a tag; ACLs are code. (−) a
  dependency on the Tailscale coordination server (mitigated by tailnet-lock at its trigger); founder must keep
  `tailscaled` healthy on owned nodes.
- **Alternatives rejected:** raw WireGuard (no ACL-as-code, manual key mgmt), port-forwarding + a bastion
  (public attack surface — the thing we're eliminating), a cloud VPC (the nodes are home hardware).

### ADR-2 — Tailscale SSH (keyless, ACL-governed) replaces host SSH keys; NO public `sshd`
- **Status:** Proposed.
- **Context:** Inter-node + founder ops need SSH; a public `sshd` is the most-scanned attack surface on the
  internet; managing `authorized_keys` across N nodes is error-prone and unauditable.
- **Decision:** Tailscale SSH as the primary path — identity-tied, ACL-governed (§D `ssh` block), `check`-mode
  on `root` for the prod-token node, optional session recording. A **local-console fallback** for the
  tailnet-down case. **Zero public `sshd`.**
- **Consequences:** (+) one policy-as-code answer to "who can SSH where," no key sprawl, no internet-facing
  `sshd`. (−) dependency on `tailscaled`/control-plane (mitigated by local-state caching + console fallback).
- **Alternatives rejected:** traditional keys + a fail2ban'd public `sshd` (keeps the public surface), no
  remote SSH at all (un-operable for a headless node).

### ADR-3 — Migrate break-glass from HMAC to Ed25519 so the SIGNING key never lives on the execution node
- **Status:** Proposed — **recommended hardening, the highest-leverage in this document.**
- **Context:** `break-glass.ts` is HMAC-symmetric: `consumeGrant` must `resolveSigningKey` to *verify*, so the
  consuming node (Neo) holds the key that can also *sign*. A fully-compromised Neo could self-issue a (still
  single-use, short-TTL, logged, ledger-immutable) prod-write grant. This is the worst item in Neo's
  compromise blast radius (§G.4).
- **Decision:** Move to asymmetric signing (Ed25519): the **founder's device holds the private signing key**;
  Neo ships only the **public key** and verifies with it. A compromised execution node then **cannot mint a
  grant at all.** Preserve every other property (single-use index, TTL, scope, url-fingerprint binding,
  immutable ledger, no-trigger-disable).
- **Consequences:** (+) removes the symmetric-key self-issue gap; the signing capability is physically absent
  from the execution layer. (−) a focused refactor of the sign/verify functions + a key-distribution step
  (public key to Neo, private key stays on the founder device). Backward-compatible migration (dual-verify
  during cutover).
- **Trigger to do it:** before Neo becomes the long-term prod-write consumer (i.e. before EIB M5/M3 land on
  Neo as the standing path), or immediately if Neo is to hold any HMAC prod key beyond a short pilot.

### ADR-4 — `tag:external` is the network enforcement of the `data_class` trust boundary
- **Status:** Proposed (vacuous today, built-now so the cloud node is safe later — mirrors EIB §9.7).
- **Context:** RS-DOS §54.2 requires PII/SECRET work to be pinned to trusted nodes; the `ExecutionProviderPort`
  selector refuses to place it on an external-trust node. Defense-in-depth wants a *second*, independent layer.
- **Decision:** A future cloud/rented node joins as `tag:external`, **quarantined by ACL** — it can reach no
  trusted node's services, and nothing trusted is reachable from it. The network *physically* cannot carry
  PII/SECRET to it, backstopping the selector's fail-closed refusal.
- **Consequences:** (+) two independent layers (network ACL + placement selector) both say "no" before
  sensitive data reaches untrusted hardware. (−) none today (the tag has no member yet); a small ACL discipline
  when the cloud node arrives.

---

## J. Risks + Trade-offs (consolidated, honest)

1. **Single point of failure = Neo + the founder** (inherited from EIB §17.1). Tailscale doesn't change this;
   it *bounds* it — instant centralized device removal, no essential node state, a one-line `runs-on` rollback.
   *Mitigated, not removed.* The off-Neo push-watchdog is the hard precondition that makes it survivable.
2. **The HMAC break-glass self-issue gap** (§F.5) — surfaced, not smoothed. The strongest argument for ADR-3.
   Until ADR-3, the residual is "a compromised Neo can mint a *scoped, logged, ledger-non-tampering* prod
   write" — bad, but bounded; not "silent data forgery."
3. **Dependency on the Tailscale coordination server** — a trusted third party brokering keys/ACLs. **Tailnet
   lock** removes that trust but is deferred (§E.6) on an honest solo-lockout cost/benefit; the named triggers
   flip it on before the dependency becomes load-bearing (cloud node / second human / Neo high-value key).
4. **Supply-chain exfil through a self-hosted job** (§G.2) — the real untrusted-code residual. Bounded by
   ephemeral + non-admin + least-privilege secrets + ACL-sink; the named escalation (egress allow-listing,
   VM-per-job) waits for the trigger (a contributor / a public fork).
5. **Operational rot** (EIB §17.3) — the runner goes offline, macOS updates break colima, a rotated token isn't
   picked up. Tailscale's device list is a cheap "is the node even up" signal, and the push-watchdog +
   config-doctor fail-closed gate convert silence into a ping. **The honest residual: a solo founder is now the
   SRE + the network admin.** The reversibility lever is what keeps that acceptable.
6. **Founder-device compromise is the true crown-jewel risk** (§G.4) — `group:founder` is broad by design. The
   trade-off (operability vs least-privilege-even-for-the-founder) is accepted at solo scale; disk encryption +
   fast removal + tailnet-lock-at-trigger are the bounds. Re-derive when a second admin exists.

---

## K. What this document does NOT do (scope honesty)

- It **installs nothing** — no node joined, no ACL applied, no secret moved, no key generated. It is a design
  for founder ratification.
- It does **not** build the `ExecutionProviderPort` (EIB §9 owns that) — it provides the **network + security
  substrate** that port runs on.
- It defers, with **named triggers**, everything that is not proportionate at solo/private/N=2–3 scale: tailnet
  lock, egress allow-listing, VM-per-job isolation, the Ed25519 cutover's timing, a global multi-node scheduler.
  Each is *admitted* by this design and *built when the first real driver appears* (Waterline §8) — never
  speculatively.
```
