import type {
  CommandEnvelope,
  CommandOutcome,
  EventEnvelope,
} from "../envelopes/index.js";
import type { DedupeScope } from "../envelopes/command.js";

export interface EventStore {
  append(event: EventEnvelope): Promise<void>;
  stream(opts?: {
    after?: string;
    limit?: number;
  }): AsyncIterable<EventEnvelope>;
  getById(eventId: string): Promise<EventEnvelope | null>;
}

export interface CommandLogTryStartInput {
  command_id: string;
  idempotency_key: string;
  dedupe_scope: DedupeScope;
  scope_key: string;
}

export type CommandLogTryStartResult =
  | { status: "new" }
  | { status: "duplicate"; outcome: CommandOutcome }
  | { status: "in_flight" };

export interface CommandLog {
  /**
   * Legacy APIs (kept for compatibility).
   */
  record(command: CommandEnvelope): Promise<void>;
  recordOutcome(outcome: CommandOutcome): Promise<void>;
  getByIdempotencyKey(commandId: string): Promise<CommandOutcome | null>;

  /**
   * Substrate-level idempotency (preferred).
   */
  tryStart(input: CommandLogTryStartInput): Promise<CommandLogTryStartResult>;
  complete(commandId: string, outcome: CommandOutcome): Promise<void>;
}

export interface ArtifactStore<TQuery, TDerived> {
  putQueryArtifact(artifact: TQuery): Promise<void>;
  putDerivedArtifact(artifact: TDerived): Promise<void>;
  getQueryById(id: string): Promise<TQuery | null>;
  getDerivedById(id: string): Promise<TDerived | null>;
  listQueryArtifacts(): Promise<TQuery[]>;
  listDerivedArtifacts(): Promise<TDerived[]>;
}
