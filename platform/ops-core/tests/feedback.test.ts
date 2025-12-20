import { describe, expect, it } from "vitest";
import { Feedback } from "../src/index.js";

const actor = { actor_id: "tester", actor_type: "human" } as const;

describe("feedback events", () => {
  it("builds deterministic feedback events and dedupes tags", async () => {
    const occurred_at = "2024-01-03T00:00:00Z";
    const first = Feedback.buildFeedbackEvent({
      artifact_id: "artifact-1",
      feedback_type: Feedback.FEEDBACK_TYPES.Rejected,
      comment: "needs more detail",
      tags: ["tag-a", "tag-a", "tag-b"],
      correlation_id: "corr-fb-1",
      actor,
      occurred_at,
    });

    const second = Feedback.buildFeedbackEvent({
      artifact_id: "artifact-1",
      feedback_type: Feedback.FEEDBACK_TYPES.Rejected,
      comment: "needs more detail",
      tags: ["tag-b", "tag-a"],
      correlation_id: "corr-fb-1",
      actor,
      occurred_at,
    });

    expect(first.event_id).toBe(second.event_id);
    expect(first.payload.tags).toEqual(["tag-a", "tag-b"]);
  });

  it("filters feedback by artifact id", async () => {
    const events = [
      Feedback.buildFeedbackEvent({
        artifact_id: "artifact-x",
        feedback_type: Feedback.FEEDBACK_TYPES.Accepted,
        correlation_id: "corr-fb-2",
        actor,
        occurred_at: "2024-01-03T01:00:00Z",
      }),
      Feedback.buildFeedbackEvent({
        artifact_id: "artifact-y",
        feedback_type: Feedback.FEEDBACK_TYPES.Rejected,
        correlation_id: "corr-fb-3",
        actor,
        occurred_at: "2024-01-03T02:00:00Z",
      }),
    ];

    async function* asIterable() {
      for (const event of events) {
        yield event;
      }
    }

    const matches = await Feedback.feedbackByArtifactId(
      asIterable(),
      "artifact-x",
    );

    expect(matches).toHaveLength(1);
    expect(matches[0].payload.feedback_type).toBe(
      Feedback.FEEDBACK_TYPES.Accepted,
    );
  });
});
