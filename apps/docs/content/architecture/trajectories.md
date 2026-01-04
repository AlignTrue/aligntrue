# Trajectories (Ring B)

Trajectories capture how decisions unfold (also known as reasoning traces or context graphs, separate from the state clock).

## Contracts

- Hash-chained steps: `{ step_seq, step_id, prev_step_hash }` (similar to chain-of-thought traces).
- Step taxonomy: base (host-emitted) vs overlays (pack/derived/human).
- Refs carry provenance: observed | inferred | asserted.
- Outcomes share the same refs shape.

## Storage

- JSONL append-only logs for steps and outcomes.
- SQLite sidecar indexes for listing, filtering, pagination.
- Deterministic ordering and ids.

## Runtime capture

- `TrajectoryContext` with budgets and volume controls.
- Host `dispatchCommand` emits key steps: `trajectory_started`, `entity_written`, `trajectory_ended`.
- PackContext exposes trajectory access.
- Redaction/summarization helpers: summarize tool args/results, redact secrets/PII, truncate as needed.

## Projections

- Co-occurrence graphs (rolling window, top-K) (a form of context graph for entity relationships).
- Transition n-grams.
- WL-style structural signatures.
- Outcome correlation tables.

See also: [Simulation](./simulation) for how trajectories feed evidence-backed queries.
