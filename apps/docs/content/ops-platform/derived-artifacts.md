---
description: Deterministic receipts for AI decisions with lineage
---

# Derived artifacts

Derived artifacts record **what the AI decided** and the lineage that produced it. They must point to existing query artifacts and include hashes of the inputs used.

## Envelope

- `artifact_id` – deterministic hash of canonicalized payload
- `artifact_type` – `"derived"`
- `input_query_ids` – required, sorted/deduped query artifact IDs
- `input_hashes` – required, sorted/deduped hashes of inputs
- `policy_version` – e.g. `stub@0.0.0`
- `output_type` – e.g. `dr_recommendations`
- `output_data` – structured decision payload
- Optional: `assumptions`, `confidence` (0–1), `explanation`
- `created_at`, `created_by`, `correlation_id`
- `content_hash`

Implementation: `core/src/artifacts/derived.ts`

## Example (TypeScript)

```ts
import { Artifacts } from "core";

const derived = Artifacts.buildDerivedArtifact({
  input_query_ids: ["qry-123"],
  input_hashes: ["qry-hash-123"],
  policy_version: "stub@0.0.0",
  output_type: "dr_recommendations",
  output_data: { recommendations: ["DR-010", "DR-011"] },
  created_at: "2024-01-04T00:00:00Z",
  created_by: { actor_id: "tester", actor_type: "human" },
  correlation_id: "corr-derived",
});
```

## Storage + validation

JSONL store enforces lineage: `JsonlArtifactStore.putDerivedArtifact` rejects writes unless every `input_query_id` already exists.

Reference test: `core/tests/artifacts.test.ts`

## Notes

- Arrays are normalized before hashing to avoid nondeterministic IDs.
- Store is idempotent: re-appending the same artifact is a no-op.
