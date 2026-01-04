# Architecture

AlignTrue is the system of record for AI. The platform captures:

- what AI saw (query artifacts + snapshot semantics)
- why it decided (derived artifacts + lineage)
- how the decision unfolded (trajectories + outcomes)
- what it did (events + receipts + egress logs)

## Rings of Trust

AlignTrue uses a ring-based architecture:

- **Ring A (Kernel):** Non-negotiable core invariants—Events, Commands, Projections. These are "one-way doors" ensuring determinism and auditability.
- **Ring B (Platform):** Additive contracts built on Ring A, such as Trajectories and Simulation. These provide reasoning context without altering the core state clock.

## Planes and clocks

- Truth plane: events → projections (rebuildable, versioned, freshness declared).
- Authority plane: actors → capabilities → approvals/holds → audit.
- Execution plane: commands → handlers → outbox/egress with safety classes.
- State clock: what happened (events/projections).
- Decision clock: how reasoning unfolded (trajectories + outcomes).

## Read next

- [Invariants (Ring A)](./invariants)
- [Envelopes (Ring A)](./envelopes)
- [Projections (Ring A)](./projections)
- [Trajectories (Ring B)](./trajectories)
- [Simulation (Ring B)](./simulation)
