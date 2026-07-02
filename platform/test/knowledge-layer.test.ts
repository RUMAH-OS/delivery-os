// =============================================================================
// KNOWLEDGE LAYER PROOF (reasoning slice 10, Frozen §10.5 — the PO's MEMORY faculty).
// =============================================================================
// Proves "retrieve what we already decided, don't rediscover it" END-TO-END, deterministic + DB-free + no
// network (a fixture markdown dir written to a temp path, cleaned up after):
//   (a) ingestMarkdownDir parses a fixture dir into CITED KnowledgeUnits (front-matter + heading + inferred kind);
//   (b) the retrieval ranker ranks the relevant KU top for an on-topic query, and returns [] for an off-topic one;
//   (c) an unparseable file is SKIPPED (logged, not fabricated) — count == valid files, and the bad id is absent;
//   (d) StoreKnowledgePort satisfies the slice-4 KnowledgePort contract and returns CITED items;
//   (e) the context-assembler, injected with the store-port, returns retrieved + cited knowledge (non-empty),
//       whereas the DEFAULT empty port yields the honest empty brief — the assembler default is untouched;
//   (f) createKnowledgePortFromEnv is empty by default and store-backed only when PLATFORM_KNOWLEDGE_DIR is set.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { KnowledgeStore } from "../src/reasoning/knowledge/knowledge-store.js";
import { ingestMarkdownDir, parseKnowledgeFile, type IngestSkip } from "../src/reasoning/knowledge/ingest.js";
import {
  StoreKnowledgePort,
  createKnowledgePortFromEnv,
} from "../src/reasoning/knowledge/store-knowledge-port.js";
import { assembleContext, EMPTY_KNOWLEDGE_PORT, type ContextSources } from "../src/reasoning/context/context-assembler.js";
import type { KnowledgePort } from "../src/reasoning/context/context-brief.js";
import type { ResolveContext } from "../src/reasoning/model-router.js";

const CTX: ResolveContext = { requestId: "knowledge-layer-test-req-1" };

// ── Fixture corpus: written to a temp dir, torn down after. ───────────────────────────────────────────────
let dir: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "dos-knowledge-"));

  // 1) An ADR with front-matter kind + tags. Body is about model routing / reasoning classes.
  writeFileSync(
    join(dir, "adr-0007-routing.md"),
    `---
kind: adr
tags: [routing, classes]
updatedAt: 2026-05-01
---
# Reason through classes, never model names

The router binds a reasoning CLASS to a model; organ code names the class, never a concrete model id.
Swapping a model is a config edit, not a code change.
`,
  );

  // 2) A Decision Record, no front-matter — claim comes from the `# ` heading, kind inferred from filename.
  writeFileSync(
    join(dir, "decision-invoicing.md"),
    `# Ship invoicing before reporting

We commit to shipping the invoicing and billing capability first; the reporting dashboard follows.
Invoicing is the revenue-critical path.
`,
  );

  // 3) A Charter clause — kind inferred from filename ("charter").
  writeFileSync(
    join(dir, "charter-honesty.md"),
    `# Honesty by construction

Every retrieved memory carries a citation. An uncited claim is dropped, never fabricated.
`,
  );

  // 4) A Lesson — front-matter claim overrides; kind inferred from "lesson".
  writeFileSync(
    join(dir, "lesson-pooler-host.md"),
    `---
claim: Use the aws-1 session pooler, not aws-0
kind: lesson
---
The durable Supabase pooler host is aws-1; a stale :8787 squatter must be killed first.
`,
  );

  // 5) An UNPARSEABLE file — empty/whitespace only ⇒ no derivable claim ⇒ must be SKIPPED, never fabricated.
  writeFileSync(join(dir, "broken-empty.md"), "   \n\n   \n");

  // 6) A non-markdown file — ignored by extension (not a skip, just not a knowledge doc).
  writeFileSync(join(dir, "notes.txt"), "not markdown; ignored");

  // 7) A subdirectory — must be ignored (ingest is a flat dir read, not a recursive fabrication).
  mkdirSync(join(dir, "subdir"));
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

// =============================================================================
describe("ingestMarkdownDir — real corpus, cited, fail-closed (§10.5)", () => {
  it("(a) parses the fixture dir into CITED KUs with the right kinds/claims/tags", () => {
    const units = ingestMarkdownDir(dir, { onSkip: () => {} });
    const byId = new Map(units.map((u) => [u.id, u]));

    // 4 valid docs (the 4 .md files that CAN produce a claim); the empty one is skipped, .txt/subdir ignored.
    expect(units).toHaveLength(4);

    const adr = byId.get("adr-0007-routing")!;
    expect(adr.kind).toBe("adr");
    expect(adr.claim).toBe("Reason through classes, never model names");
    expect(adr.tags).toEqual(["routing", "classes"]);
    expect(adr.updatedAt).toBe("2026-05-01");

    expect(byId.get("decision-invoicing")!.kind).toBe("decision");
    expect(byId.get("decision-invoicing")!.claim).toBe("Ship invoicing before reporting");
    expect(byId.get("charter-honesty")!.kind).toBe("charter");
    expect(byId.get("lesson-pooler-host")!.kind).toBe("lesson");
    // front-matter claim overrides the heading/paragraph.
    expect(byId.get("lesson-pooler-host")!.claim).toBe("Use the aws-1 session pooler, not aws-0");

    // Every KU is CITED — the source is the file path (I4).
    for (const u of units) expect(u.source).toContain(dir);
  });

  it("(c) SKIPS the unparseable file (logged, not fabricated)", () => {
    const skips: IngestSkip[] = [];
    const units = ingestMarkdownDir(dir, { onSkip: (s) => skips.push(s) });

    // The empty file is reported as a skip with a reason...
    expect(skips).toHaveLength(1);
    expect(skips[0]!.file).toContain("broken-empty.md");
    expect(skips[0]!.reason).toMatch(/no derivable claim/);
    // ...and NO KU was fabricated for it.
    expect(units.some((u) => u.id === "broken-empty")).toBe(false);
  });

  it("(c') a missing corpus dir is honestly empty (never a fabricated corpus)", () => {
    expect(ingestMarkdownDir(join(dir, "no", "such", "dir"), { onSkip: () => {} })).toEqual([]);
  });

  it("parseKnowledgeFile is pure and fail-closed on a claimless file", () => {
    const res = parseKnowledgeFile("/x/empty.md", "   \n");
    expect("skip" in res).toBe(true);
  });
});

// =============================================================================
describe("KnowledgeStore.retrieve — deterministic BM25-lite ranker (§10.5)", () => {
  function loadedStore(): KnowledgeStore {
    const store = new KnowledgeStore();
    store.addAll(ingestMarkdownDir(dir, { onSkip: () => {} }));
    return store;
  }

  it("(b) ranks the relevant KU top for an on-topic query, keeping it CITED", () => {
    const store = loadedStore();
    const hits = store.retrieve("invoicing billing revenue");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]!.unit.id).toBe("decision-invoicing");
    expect(hits[0]!.matchedOn).toContain("invoicing");
    expect(hits[0]!.score).toBeGreaterThan(0);
    // The winning hit still carries its citation (I4).
    expect(hits[0]!.unit.source).toContain("decision-invoicing.md");
  });

  it("(b) ranks the ADR top for a routing/model-class query", () => {
    const store = loadedStore();
    const hits = store.retrieve("routing model classes");
    expect(hits[0]!.unit.id).toBe("adr-0007-routing");
  });

  it("(b) returns [] for an off-topic query — honest, not a low-confidence fabrication", () => {
    const store = loadedStore();
    expect(store.retrieve("quantum zebra photosynthesis")).toEqual([]);
    expect(store.retrieve("")).toEqual([]); // empty query ⇒ nothing ranked
  });

  it("is deterministic — identical corpus + query ⇒ identical ranking", () => {
    const a = loadedStore().retrieve("invoicing reporting");
    const b = loadedStore().retrieve("invoicing reporting");
    expect(a.map((h) => [h.unit.id, h.score])).toEqual(b.map((h) => [h.unit.id, h.score]));
  });

  it("respects k and last-write-wins on a re-added id", () => {
    const store = loadedStore();
    expect(store.retrieve("the", { k: 1 }).length).toBeLessThanOrEqual(1);
    const before = store.size;
    store.add({ id: "decision-invoicing", claim: "superseded", body: "", source: "/x", kind: "decision", tags: [] });
    expect(store.size).toBe(before); // replaced, not duplicated
  });
});

// =============================================================================
describe("StoreKnowledgePort — drops into the context-assembler by injection (§10.2/§10.5)", () => {
  function port(): StoreKnowledgePort {
    const store = new KnowledgeStore();
    store.addAll(ingestMarkdownDir(dir, { onSkip: () => {} }));
    return new StoreKnowledgePort(store);
  }

  it("(d) satisfies the KnowledgePort contract and returns CITED items", async () => {
    const knowledge: KnowledgePort = port(); // structural contract check
    const items = await knowledge.retrieve("invoicing billing");
    expect(items.length).toBeGreaterThan(0);
    for (const it of items) {
      expect(it.id.length).toBeGreaterThan(0);
      expect(it.claim.length).toBeGreaterThan(0);
      expect(it.source.length).toBeGreaterThan(0); // every returned item is CITED (I4)
    }
    expect(await knowledge.retrieve("quantum zebra")).toEqual([]);
  });

  it("(e) the assembler with the store-port returns retrieved+cited knowledge (non-empty)", async () => {
    const sources: ContextSources = { knowledge: port(), investigators: [] };
    const brief = await assembleContext(
      { class: "PLAN", task: "plan the invoicing rollout", ctx: CTX },
      sources,
    );
    expect(brief.empty).toBe(false);
    expect(brief.retrieved.length).toBeGreaterThan(0);
    expect(brief.retrieved[0]!.id).toBe("decision-invoicing");
    // The citation flows into the assembled brief's citations index.
    expect(brief.citations.some((c) => c.kind === "knowledge" && c.source.includes("decision-invoicing.md"))).toBe(true);
  });

  it("(e) the DEFAULT empty port yields the honest empty brief — assembler default untouched", async () => {
    const sources: ContextSources = { knowledge: EMPTY_KNOWLEDGE_PORT, investigators: [] };
    const brief = await assembleContext(
      { class: "PLAN", task: "plan the invoicing rollout", ctx: CTX },
      sources,
    );
    expect(brief.empty).toBe(true);
    expect(brief.retrieved).toEqual([]);
  });
});

// =============================================================================
describe("createKnowledgePortFromEnv — optional boot path (honest default)", () => {
  it("(f) returns the empty default when PLATFORM_KNOWLEDGE_DIR is unset/blank", async () => {
    expect(await createKnowledgePortFromEnv({}).retrieve("invoicing")).toEqual([]);
    expect(await createKnowledgePortFromEnv({ PLATFORM_KNOWLEDGE_DIR: "   " }).retrieve("invoicing")).toEqual([]);
  });

  it("(f) returns a store-backed port when PLATFORM_KNOWLEDGE_DIR points at a corpus", async () => {
    const knowledge = createKnowledgePortFromEnv({ PLATFORM_KNOWLEDGE_DIR: dir });
    const items = await knowledge.retrieve("invoicing billing");
    expect(items.length).toBeGreaterThan(0);
    expect(items[0]!.source).toContain(dir); // real corpus, cited
  });
});
