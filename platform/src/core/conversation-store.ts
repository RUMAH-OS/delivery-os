// CONVERSATION STORE — the Project Owner's multi-turn memory. CHANNEL-AGNOSTIC: keyed by an opaque
// `threadId` the adapter supplies (Slack thread_ts, a Teams conversation id, a web session id — the CORE does
// not care). v1 is a bounded in-memory ring per thread; the interface is deliberately small so DURABLE MEMORY
// (Postgres/Redis/the Delivery-OS event store) can be dropped in behind `ConversationStore` unchanged.
//
// DURABLE-MEMORY PLUG POINT: implement `ConversationStore` against a real backing store (e.g. an `outbox`-style
// table or the Admin events API) and inject it into the ProjectOwner. Nothing else in the CORE changes — the
// orchestrator only ever calls append() + recent(). This is where founder-facing long-term memory lands.

import type { Intent } from "./intent.js";

export type TurnRole = "founder" | "owner"; // who spoke: the founder, or the Project Owner
export interface Turn {
  role: TurnRole;
  text: string;
  at: number; // epoch ms
  intent?: Intent; // set on founder turns once classified (for context + auditing)
}

export interface ConversationStore {
  append(threadId: string, turn: Turn): void | Promise<void>;
  recent(threadId: string, limit?: number): Turn[] | Promise<Turn[]>;
}

// ── v1 in-memory implementation: a Map<threadId, Turn[]> with a per-thread cap (drop oldest). ──
export class InMemoryConversationStore implements ConversationStore {
  private readonly threads = new Map<string, Turn[]>();
  constructor(private readonly maxTurnsPerThread = 50) {}

  append(threadId: string, turn: Turn): void {
    const arr = this.threads.get(threadId) ?? [];
    arr.push(turn);
    // bound memory: keep only the most recent N turns.
    if (arr.length > this.maxTurnsPerThread) arr.splice(0, arr.length - this.maxTurnsPerThread);
    this.threads.set(threadId, arr);
  }

  recent(threadId: string, limit = 10): Turn[] {
    const arr = this.threads.get(threadId) ?? [];
    return limit >= arr.length ? [...arr] : arr.slice(arr.length - limit);
  }

  // test/introspection helper (not part of the durable interface).
  threadCount(): number {
    return this.threads.size;
  }
}
