# Envelopes

## Event envelope (A1)

```typescript
export interface EventEnvelope<T extends string = string, P = unknown> {
  readonly event_id: string; // deterministic (content hash)
  readonly event_type: T; // namespaced pack./shared./core.
  readonly payload: P;
  readonly occurred_at: string; // source time (ISO)
  readonly ingested_at: string; // system time (ISO)
  readonly effective_at?: string; // business time (ISO)
  readonly correlation_id: string;
  readonly causation_id?: string;
  readonly causation_type?: CommandCausationType;
  readonly source_ref?: string;
  readonly source_sequence?: number;
  readonly actor: ActorRef;
  readonly capability_id?: string;
  readonly envelope_version: number;
  readonly payload_schema_version: number;
}
```

## Command envelope (A2) + outcomes

```typescript
export interface CommandEnvelope<T extends string = string, P = unknown> {
  readonly command_id: string; // idempotency key
  readonly command_type: T; // namespaced pack./shared./core.
  readonly payload: P;
  readonly target_ref: string;
  readonly dedupe_scope: string;
  readonly expected_version?: number;
  readonly state_predicate?: string;
  readonly correlation_id: string;
  readonly causation_id?: string;
  readonly causation_type?: CommandCausationType;
  readonly actor: ActorRef;
  readonly requested_at: string; // ISO
  readonly capability_id?: string;
}

export interface CommandOutcome {
  readonly command_id: string;
  readonly status: "accepted" | "rejected" | "already_processed";
  readonly reason?: string;
  readonly produced_events: string[]; // event_ids
  readonly completed_at: string;
}
```

## Actor reference

```typescript
export interface ActorRef {
  readonly actor_id: string;
  readonly actor_type: "human" | "service" | "agent";
  readonly display_name?: string;
}
```

See also: [Invariants](./invariants) and `core/docs/CONSTITUTION.md`.
