# Delivery OS — Repository & Dependency Principle

**Status:** Ratified 2026-06-30 (founder). Supersedes any prior "infrastructure must be a separate repository" framing.
**Recommended:** elevate the one-line invariant into the Delivery OS North Star invariants (CLAUDE.md §3 / `core/`).

## The principle

Delivery OS is the **single source of truth** for the entire platform. All platform-level capabilities live in the **one repository** — Runtime, Governance Engine, Workflow Engine, Capability Framework, Contracts, SDKs, Templates, Execution Infrastructure, Slack Surface, Monitoring, Documentation, and future subsystems.

**The repository boundary is NOT the architectural boundary.** One repository gives cohesion (one version, one roadmap, one documentation tree, atomic cross-cutting change, and — decisively — *no cross-repo version drift*). The architecture is preserved not by splitting repositories but by **explicit, enforced dependency rules** between subsystems.

## The complete model — two boundaries, two mechanisms

Delivery OS has **two** architectural boundaries, enforced by **different** mechanisms. Conflating them is the error this principle exists to prevent.

**1. Platform ⇄ consumer — a REPOSITORY boundary.** Consumers (RUMAH/rumah-admin, PLOS, Finance OS, …) are **separate repositories**. They are not part of Delivery OS; they **consume** it (vendoring the Templates / calling the contracts). They evolve as **independent products** — their own domains, lifecycles, deploy cadences. The separation is a *repo* boundary because the relationship is **independence**.

**2. Subsystem ⇄ subsystem (within Delivery OS) — a DEPENDENCY boundary.** The platform's own subsystems (Runtime, Workflow Engine, Governance Engine, Slack Surface, Execution Infrastructure, SDKs, Templates, Monitoring, Documentation) all live in the **one** Delivery OS repository and **co-evolve** (one version, one roadmap). They are separated not by repos but by the inward-only dependency rules below. The cohesion is a *single* repo because the relationship is **co-evolution**.

**The discriminator — inside Delivery OS, or a consumer?** *"Could two different consumers share it?"*
- **Generic / domain-agnostic ⇒ platform (inside):** the Runtime, the engines, the execution infrastructure, the SDKs, the Slack surface, monitoring.
- **Bound to one business domain ⇒ consumer (outside):** property/invoicing (rumah-admin), lead-gen (PLOS), finance (Finance OS).

This is exactly the line the platform extraction proved: the governance Runtime is generic (multiple consumers run on it) ⇒ inside; a consumer's invoicing/lead logic is domain-specific ⇒ outside (`docs/reviews/CONSUMER-INDEPENDENCE-PROOF-2026-06-29.md`).

## The architectural shape — the Dependency Rule (Clean / Hexagonal)

Dependencies point **inward**, toward a stable, infrastructure-agnostic core.

| Layer | Members | Depends on |
|---|---|---|
| **Core (the Runtime)** | Governance Runtime · Workflow Engine · Capability Framework | only itself + the contracts it defines. **Infrastructure-agnostic, portable, reusable.** Knows nothing of any concrete environment. |
| **Contracts / Ports** | `ExecutionProviderPort` · the health-emission contract · the store ports · the SDKs | defined by Core; the **only** legal cross-layer surface |
| **Adapters (outer)** | Execution Infrastructure (Neo · Docker · Tailscale · GitHub Runner · CI/CD) · Slack Surface · Monitoring | consume the Runtime **only** via the contracts; depend strictly inward; **never depended-upon by Core** |
| **Templates** | the vendorable slice of Core+Contracts | installed into domain consumers (rumah-admin, PLOS, …) |
| **Documentation** | spans all layers | — |

## The dependency rules (invariant)

1. **Core imports nothing outward.** The Runtime (Governance / Workflow / Capability Framework) imports nothing from any adapter subsystem (Execution Infrastructure, Slack, Monitoring) and nothing infrastructure-specific (Neo, Docker, Tailscale, GitHub Runner SDKs, Slack SDKs, or any concrete execution environment).
2. **Adapters consume only contracts.** Adapter subsystems import the Runtime only through its published contracts — never its internals.
3. **Contracts are platform-owned.** The `ExecutionProviderPort` and related interfaces live on the Core/contract side; adapters consume them.
4. **Dependencies flow strictly inward:** adapter → contract → core. Never outward.

## Enforcement — *operationally enforced, not remembered*

A principle that lives only in a document decays. Per the Delivery OS North Star ("verification is operationally enforced, not remembered"), this principle is real only when two checks make it structural:

- **Dependency-direction gate** (the `residency-guard`, generalized): a CI / pre-push gate asserting no Core file imports an adapter subsystem or an infra-specific SDK. Fails loudly the instant the boundary is crossed.
- **The Delete Test, standing:** a CI job that removes the Execution-Infrastructure folder (and, in turn, each adapter subsystem) and asserts Core still builds and the contracts still resolve. Green = the boundary held *by construction* — the execution-layer twin of the consumer-independence proof already shipped (`docs/reviews/CONSUMER-INDEPENDENCE-PROOF-2026-06-29.md`).

Together these convert the boundary from "true by discipline" to "guaranteed by construction."

## Why this topology (the trade, recorded)

One repository + enforced boundaries beats separate repositories *for a solo founder*: identical clean architecture, **plus** one version / one CI / one documentation tree / atomic cross-cutting change, **and** it eliminates cross-repo version-skew — the class of failure already observed live as the vendored-engine `engine-check` drift between `delivery-os` and `property-lead-os`. The enterprise reasons to split repositories (independent team ownership, independent release cadence, independent scaling) do not apply to one founder; their costs do. A boundary enforced by a check you control fails *loudly in CI*; a boundary enforced by a repo split you must keep in sync fails *silently as drift*.

## Concrete implications for the build (when implementation resumes)

- Build the real **`ExecutionProviderPort`** (and a **health-emission contract**) as platform-owned contracts — today only the narrower Sprint-Engine `SprintExecutor`/`runSprint` hook exists (`templates/governance-engine/po-autoloop.ts`).
- Place Execution Infrastructure in its **own top-level folder** (not under `templates/`, which is the vendorable Runtime — a different kind of artifact).
- Ship the **dependency-direction gate** + the **standing Delete Test** as the enforcement of this principle.
