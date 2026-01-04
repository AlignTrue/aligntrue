# Projections

Write truth is the event log; read truth is projections (similar to AI memory or a knowledge base). Projections must be rebuildable, versioned, and declare freshness/lag.

## Definition shape

```typescript
export interface ProjectionDefinition<TState> {
  readonly name: string;
  readonly version: string; // semver
  init(): TState;
  apply(state: TState, event: EventEnvelope): TState;
  getFreshness(state: TState): {
    last_event_id: string;
    last_ingested_at: string;
  };
}
```

## Determinism

- Canonical ordering: (occurred_at, source_ref, source_sequence?, event_id).
- Rebuild must match incremental application (hash-verified in tests).
- Freshness metadata is required.

## Tests

- Idempotency and rebuild determinism are mandatory for projections that own state.
- See `core/tests/*` for examples across contacts, timeline, runs, tasks, notes, trajectories.
