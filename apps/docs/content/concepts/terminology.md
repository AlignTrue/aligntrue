# AI Terminology Mapping

How common AI/ML terms map to AlignTrue concepts:

| Common AI Term                       | AlignTrue Equivalent                                         | Learn More                                                                     |
| ------------------------------------ | ------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| Context graph                        | Trajectories + co-occurrence projections                     | [Trajectories](../architecture/trajectories)                                   |
| Knowledge graph                      | Co-occurrence graphs, transition n-grams                     | [Trajectories](../architecture/trajectories)                                   |
| RAG (Retrieval Augmented Generation) | Query artifacts (retrieval) + Derived artifacts (generation) | [Query artifacts](./query-artifacts), [Derived artifacts](./derived-artifacts) |
| Memory / Long-term memory            | Projections                                                  | [Projections](../architecture/projections)                                     |
| Reasoning trace / Chain of thought   | Trajectories (hash-chained steps)                            | [Trajectories](../architecture/trajectories)                                   |
| Audit trail / Receipts               | Events + egress receipts                                     | [Envelopes](../architecture/envelopes)                                         |
| Embeddings                           | Deferred in v1 (structure-first approach)                    | [Simulation](../architecture/simulation)                                       |
| Provenance                           | Query/Derived artifact lineage                               | [Derived artifacts](./derived-artifacts)                                       |

## Why different names?

AlignTrue prioritizes **determinism and auditability**. Traditional AI terms like "memory" or "context" are fuzzy. AlignTrue concepts are explicit:

- **Trajectories** are hash-chained, tamper-evident reasoning logs.
- **Query artifacts** prove what the AI saw (with hashes).
- **Derived artifacts** prove what it decided (with lineage).
