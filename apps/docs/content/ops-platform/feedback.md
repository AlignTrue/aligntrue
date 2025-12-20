---
description: Structured feedback receipts tied to derived artifacts
---

# Feedback receipts

Feedback events capture user responses to derived artifacts. Each event is an `EventEnvelope` with deterministic IDs and links back to the artifact being judged.

## Event types

- `accepted`
- `rejected`
- `edited`
- `overridden`
- `snoozed`

Schema: `platform/ops-core/src/feedback/events.ts`

## Fields

- `event_id` – deterministic via `Identity.generateEventId`
- `event_type` – one of the feedback types
- `payload.artifact_id` – derived artifact being judged
- Optional: `payload.comment`, `payload.tags[]`, `payload.edits`
- Envelope fields: `correlation_id`, `actor`, `capability_scope`, `occurred_at`, `ingested_at`, `schema_version`

## Example (TypeScript)

```ts
import { Feedback } from "platform/ops-core";

const feedback = Feedback.buildFeedbackEvent({
  artifact_id: "derived-123",
  feedback_type: Feedback.FEEDBACK_TYPES.Rejected,
  comment: "Needs clearer evidence",
  correlation_id: "corr-feedback",
  actor: { actor_id: "tester", actor_type: "human" },
  occurred_at: "2024-01-04T00:00:00Z",
});
```

`Feedback.feedbackByArtifactId()` filters an event stream to the matching artifact IDs. See `platform/ops-core/tests/feedback.test.ts`.

## Notes

- Tags are deduped; IDs are deterministic for the same logical feedback.
- Events can be stored in any `EventStore` implementation (e.g., JSONL).
