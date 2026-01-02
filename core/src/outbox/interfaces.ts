import type { EventEnvelope } from "../envelopes/index.js";

export interface OutboxEntry {
  readonly entry_id: string;
  readonly event_id: string;
  readonly created_at: string;
  dispatched_at?: string;
  dispatch_error?: string;
}

export interface Dispatcher {
  dispatch(event: EventEnvelope): Promise<void>;
}
