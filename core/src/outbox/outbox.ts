import { randomId } from "../identity/id.js";
import type { EventEnvelope } from "../envelopes/index.js";
import type { Dispatcher, OutboxEntry } from "./interfaces.js";

export class InMemoryOutbox {
  private entries: OutboxEntry[] = [];

  constructor(private readonly dispatcher: Dispatcher = new NoopDispatcher()) {}

  enqueue(event: EventEnvelope): OutboxEntry {
    const entry: OutboxEntry = {
      entry_id: randomId(),
      event_id: event.event_id,
      created_at: new Date().toISOString(),
    };
    this.entries.push(entry);
    return entry;
  }

  async dispatchPending(): Promise<void> {
    for (const entry of this.entries) {
      if (entry.dispatched_at || entry.dispatch_error) continue;
      try {
        await this.dispatcher.dispatch({
          ...entry,
        } as unknown as EventEnvelope);
        entry.dispatched_at = new Date().toISOString();
      } catch (err) {
        entry.dispatch_error = err instanceof Error ? err.message : String(err);
      }
    }
  }

  markDispatched(entryId: string): void {
    const entry = this.entries.find((e) => e.entry_id === entryId);
    if (entry && !entry.dispatched_at) {
      entry.dispatched_at = new Date().toISOString();
    }
  }

  list(): OutboxEntry[] {
    return [...this.entries];
  }
}

class NoopDispatcher implements Dispatcher {
  async dispatch(): Promise<void> {
    // no-op
  }
}
