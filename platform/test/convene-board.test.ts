// =============================================================================
// CONVENE-BOARD PROOF (reasoning slice 11, O7b; Frozen §10.4 — judgment under challenge).
// =============================================================================
// Proves the second judgment seam END-TO-END for free (no real model, no network, no DB):
//   (a) CONSEQUENTIALITY-GATED — a below-threshold question returns skipped:"below-threshold" and calls NO
//       reasoner (cheap thoughts stay cheap); a high-consequence question convenes.
//   (b) READ-ONLY, ROLE-SCOPED — each role reasons through a read-only class (VERIFY / ARCH_REVIEW); the seam
//       only ever names those classes (never the author class CODE), and its product has NO write path.
//   (c) BOUNDED CHALLENGE ROUND — each role opens, then sees the others and gives a final position (two rounds).
//   (d) DISSENT PRESERVED VERBATIM — a dissenting role's exact dissent survives into unresolvedDissent (not
//       dropped), and the synthesis references the disagreement explicitly (it is not smoothed away).

import { describe, it, expect, vi } from "vitest";
import {
  conveneBoard,
  shouldConvene,
  DEFAULT_BOARD_ROSTER,
  DEFAULT_BOARD_THRESHOLD,
  BOARD_SEAM_VERSION,
  type BoardReasoner,
  type BoardRole,
  type BoardReport,
} from "../src/reasoning/board/convene-board.js";
import type { ReasonWithContextRequest, ReasonWithContextResult } from "../src/reasoning/context/context-aware-port.js";

const CTX = { requestId: "board-test-req-1" };

// The exact dissent a role will hold through the challenge round — asserted preserved VERBATIM (byte-for-byte).
const RISK_DISSENT =
  "This ships an irreversible schema change with no rollback; I do NOT consent — the blast radius is the whole tenant table.";

/** A 3-lens test roster (each a distinct read-only class). Lens strings double as the reasoner's routing key. */
const TEST_ROSTER: readonly BoardRole[] = [
  { role: "correctness", lens: "LENS:correctness", class: "VERIFY" },
  { role: "risk", lens: "LENS:risk", class: "ARCH_REVIEW" },
  { role: "cost", lens: "LENS:cost", class: "ARCH_REVIEW" },
];

/**
 * A scripted BoardReasoner. Keys on the role's lens (passed as `system`) and whether the task is the challenge
 * round (its prompt names the others' opening positions). The `risk` role DISSENTS — verbatim RISK_DISSENT — and
 * holds that dissent through the challenge round; the others align. Records every class it was asked to reason
 * through (to prove role-scoping stays read-only).
 */
function scriptedBoard(seenClasses: string[]): BoardReasoner {
  return {
    async reasonWithContext(req: ReasonWithContextRequest): Promise<ReasonWithContextResult> {
      seenClasses.push(req.class);
      const role = (req.system ?? "").replace("LENS:", "");
      const isChallenge = req.task.includes("The OTHER board members opened");
      let body: Record<string, unknown>;
      if (role === "risk") {
        // The risk lens dissents from the outset and HOLDS it after seeing the others (not smoothed).
        body = { position: "I object on reversibility grounds.", dissent: RISK_DISSENT };
      } else if (role === "correctness") {
        body = { position: isChallenge ? "Correct after considering the others." : "Looks correct to me." };
      } else {
        body = { position: isChallenge ? "Cost is acceptable given the others' points." : "Cost seems fine." };
      }
      return {
        text: JSON.stringify(body),
        binding: { model: "stub", params: { thinking: "off" }, bindingId: `${req.class}:primary:stub` },
      };
    },
  };
}

// ── (gate) shouldConvene — pure consequentiality rule ────────────────────────────────────────────────────────

describe("shouldConvene — the consequentiality gate (cheap thoughts stay cheap)", () => {
  it("default floor is 'high' and the seam version is pinned", () => {
    expect(DEFAULT_BOARD_THRESHOLD).toBe("high");
    expect(BOARD_SEAM_VERSION).toBe("board/v1");
  });

  it("convenes at/above the floor, skips below it", () => {
    expect(shouldConvene("high")).toBe(true);
    expect(shouldConvene("medium")).toBe(false);
    expect(shouldConvene("low")).toBe(false);
    // a lowered floor lets medium convene
    expect(shouldConvene("medium", "medium")).toBe(true);
    expect(shouldConvene("low", "medium")).toBe(false);
  });
});

// ── (a) the gate — below threshold does NOT convene and calls NO reasoner ───────────────────────────────────

describe("conveneBoard — consequentiality-gated", () => {
  it("(a) a below-threshold (low) question is SKIPPED and NO reasoner is called", async () => {
    const spy = vi.fn();
    const reasoner: BoardReasoner = { reasonWithContext: spy };
    const report = await conveneBoard({ question: "rename a local variable", consequentiality: "low", ctx: CTX, reasoner, roster: TEST_ROSTER });

    expect(report.convened).toBe(false);
    expect(report.skipped).toBe("below-threshold");
    expect(report.positions).toEqual([]);
    expect(report.unresolvedDissent).toEqual([]);
    expect(spy).not.toHaveBeenCalled(); // cheap thoughts stay cheap — the model is never billed
  });

  it("a medium question is skipped by default, but convenes when the floor is lowered", async () => {
    const seen: string[] = [];
    const skipped = await conveneBoard({ question: "medium call", consequentiality: "medium", ctx: CTX, reasoner: scriptedBoard(seen), roster: TEST_ROSTER });
    expect(skipped.convened).toBe(false);
    expect(seen).toEqual([]);

    const convened = await conveneBoard({ question: "medium call", consequentiality: "medium", ctx: CTX, reasoner: scriptedBoard(seen), roster: TEST_ROSTER, minConsequentiality: "medium" });
    expect(convened.convened).toBe(true);
  });
});

// ── (b)+(c)+(d) a HIGH-consequence question convenes: positions recorded, dissent preserved verbatim ────────

describe("conveneBoard — convenes above threshold; preserves dissent VERBATIM (never smoothed)", () => {
  it("(b) reasons ONLY through read-only classes (VERIFY / ARCH_REVIEW) — never the author class CODE", async () => {
    const seen: string[] = [];
    await conveneBoard({ question: "drop and recreate the tenant table", consequentiality: "high", ctx: CTX, reasoner: scriptedBoard(seen), roster: TEST_ROSTER });
    // opening round + challenge round = 2 calls per role of 3 = 6 calls, all read-only.
    expect(seen).toHaveLength(6);
    expect(seen.every((c) => c === "VERIFY" || c === "ARCH_REVIEW")).toBe(true);
    expect(seen).not.toContain("CODE");
  });

  it("(c) records EACH role's final position after the bounded challenge round", async () => {
    const seen: string[] = [];
    const report = await conveneBoard({ question: "drop and recreate the tenant table", consequentiality: "high", ctx: CTX, reasoner: scriptedBoard(seen), roster: TEST_ROSTER });

    expect(report.convened).toBe(true);
    expect(report.positions.map((p) => p.role)).toEqual(["correctness", "risk", "cost"]);
    // aligning roles revised their stance in the challenge round (proving they saw the others)
    expect(report.positions.find((p) => p.role === "correctness")!.position).toContain("after considering the others");
  });

  it("(d) preserves a dissenting role's dissent VERBATIM in unresolvedDissent (not dropped, not rewritten)", async () => {
    const seen: string[] = [];
    const report = await conveneBoard({ question: "drop and recreate the tenant table", consequentiality: "high", ctx: CTX, reasoner: scriptedBoard(seen), roster: TEST_ROSTER });

    // The dissent survives BYTE-FOR-BYTE — exact-string membership, not a paraphrase.
    expect(report.unresolvedDissent).toContain(RISK_DISSENT);
    // It is attached to the dissenting role's position too, verbatim.
    expect(report.positions.find((p) => p.role === "risk")!.dissent).toBe(RISK_DISSENT);
    // The aligning roles contributed NO dissent — only the genuine disagreement is carried.
    expect(report.unresolvedDissent).toHaveLength(1);
  });

  it("(d) the synthesis REFERENCES the disagreement explicitly — it does not smooth it away", async () => {
    const seen: string[] = [];
    const report = await conveneBoard({ question: "drop and recreate the tenant table", consequentiality: "high", ctx: CTX, reasoner: scriptedBoard(seen), roster: TEST_ROSTER });

    expect(report.synthesis).toContain("UNRESOLVED DISSENT");
    expect(report.synthesis).toContain(RISK_DISSENT); // the exact dissent appears in the document
    expect(report.synthesis).not.toContain("aligned after the challenge round"); // it did NOT declare false consensus
  });

  it("a fully-aligned board reports NO unresolved dissent (and says so honestly)", async () => {
    const seen: string[] = [];
    // A roster with no dissenting role.
    const roster: readonly BoardRole[] = [
      { role: "correctness", lens: "LENS:correctness", class: "VERIFY" },
      { role: "cost", lens: "LENS:cost", class: "ARCH_REVIEW" },
    ];
    const report = await conveneBoard({ question: "rename a public API field with a deprecation window", consequentiality: "high", ctx: CTX, reasoner: scriptedBoard(seen), roster });
    expect(report.unresolvedDissent).toEqual([]);
    expect(report.synthesis).toContain("No unresolved dissent");
  });

  it("propagates a role's model INVOCATION error (a step failure is not a fabricated position)", async () => {
    const failing: BoardReasoner = { async reasonWithContext() { throw new Error("model_down"); } };
    await expect(conveneBoard({ question: "high stakes", consequentiality: "high", ctx: CTX, reasoner: failing, roster: TEST_ROSTER })).rejects.toThrow("model_down");
  });
});

// ── (b) the board is a DOCUMENT — it exposes NO mutation / write path ───────────────────────────────────────

describe("BoardReport — a document, never a diff (no write path)", () => {
  it("the report exposes NO mutation method (propose ≠ execute ≠ judge)", async () => {
    const seen: string[] = [];
    const report: BoardReport = await conveneBoard({ question: "drop and recreate the tenant table", consequentiality: "high", ctx: CTX, reasoner: scriptedBoard(seen), roster: TEST_ROSTER });

    // A plain data document: every property is data (string / array), never a callable that could mutate.
    const bag = report as unknown as Record<string, unknown>;
    for (const key of Object.keys(report)) {
      expect(typeof bag[key]).not.toBe("function");
    }
    // None of the write-shaped method names exist on the report.
    for (const m of ["apply", "execute", "commit", "mutate", "write", "merge", "author"]) {
      expect(bag[m]).toBeUndefined();
    }
  });

  it("the DEFAULT roster is all read-only lenses (VERIFY / ARCH_REVIEW), 3-4 seats", () => {
    expect(DEFAULT_BOARD_ROSTER.length).toBeGreaterThanOrEqual(3);
    expect(DEFAULT_BOARD_ROSTER.length).toBeLessThanOrEqual(4);
    expect(DEFAULT_BOARD_ROSTER.every((r) => r.class === "VERIFY" || r.class === "ARCH_REVIEW")).toBe(true);
    // distinct role names (each a distinct lens)
    expect(new Set(DEFAULT_BOARD_ROSTER.map((r) => r.role)).size).toBe(DEFAULT_BOARD_ROSTER.length);
  });
});
