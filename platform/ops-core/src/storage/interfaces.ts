import type {
  CommandEnvelope,
  CommandOutcome,
  EventEnvelope,
} from "../envelopes/index.js";

export interface EventStore {
  append(event: EventEnvelope): Promise<void>;
  stream(opts?: {
    after?: string;
    limit?: number;
  }): AsyncIterable<EventEnvelope>;
  getById(eventId: string): Promise<EventEnvelope | null>;
}

export interface CommandLog {
  record(command: CommandEnvelope): Promise<void>;
  recordOutcome(outcome: CommandOutcome): Promise<void>;
  getByIdempotencyKey(commandId: string): Promise<CommandOutcome | null>;
}

export interface ArtifactStore<TQuery, TDerived> {
  putQueryArtifact(artifact: TQuery): Promise<void>;
  putDerivedArtifact(artifact: TDerived): Promise<void>;
  getQueryById(id: string): Promise<TQuery | null>;
  getDerivedById(id: string): Promise<TDerived | null>;
  listQueryArtifacts(): Promise<TQuery[]>;
  listDerivedArtifacts(): Promise<TDerived[]>;
}
