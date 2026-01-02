---
description: Deterministic receipts for what the AI looked at
---

# Query artifacts

Query artifacts capture the structured view of **what the AI inspected**. They are deterministic, hashable envelopes that reference projections, entities, and fields without storing raw result sets by default.

## Envelope

- `artifact_id` – deterministic hash of the canonicalized payload
- `artifact_type` – `"query"`
- `referenced_entities` – sorted, deduped entity names
- `referenced_fields` – sorted, deduped field names
- `filters` – optional filter object
- `projection_version` – e.g. `ready_queue@1.0.0`
- `snapshot_id` – optional point-in-time marker
- `created_at`, `created_by`, `correlation_id`
- `content_hash` – matches `artifact_id`

Implementation: `core/src/artifacts/query.ts`

## Example (TypeScript)

```ts
import { Artifacts } from "core";

const query = Artifacts.buildQueryArtifact({
  referenced_entities: ["work_item"],
  referenced_fields: ["id", "status"],
  filters: { readiness: "ready" },
  projection_version: "ready_queue@1.0.0",
  snapshot_id: "evt-123",
  created_at: "2024-01-04T00:00:00Z",
  created_by: { actor_id: "tester", actor_type: "human" },
  correlation_id: "corr-query",
});
```

## Storage

JSONL-backed store: `core/src/storage/jsonl-artifact-store.ts`

- Append-only, idempotent writes
- Used by tests in `core/tests/artifacts.test.ts`

## Notes

- Designed for minimum viable receipts: references + hashes, not raw data.
- Arrays are normalized (sorted/deduped) before hashing to keep IDs stable.\*\*\*
