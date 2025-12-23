import { describe, it, expect } from "vitest";
import {
  assessmentDedupeId,
  suggestionActiveId,
  type AssessmentDedupeKey,
  type SuggestionActiveKey,
} from "../src/emails/dedupe.js";
import {
  THREAD_SLICE_VERSION,
  buildThreadSlice,
  hashThreadSlice,
} from "../src/emails/thread-slice.js";
import {
  buildKnownSendersProjection,
  KnownSendersProjectionDef,
} from "../src/projections/known-senders.js";
import {
  ThreadsProjectionDef,
  buildThreadsProjectionFromState,
} from "../src/projections/threads.js";

describe("email dedupe keys", () => {
  it("produces stable assessment dedupe ids per slice_kind", () => {
    const key: AssessmentDedupeKey = {
      thread_id: "t-1",
      slice_kind: "snippet",
      input_hash: "hash-a",
      prompt_version: "v1",
      model_version: "m1",
    };
    const first = assessmentDedupeId(key);
    const second = assessmentDedupeId(key);
    expect(first).toBe(second);

    const enriched = assessmentDedupeId({ ...key, slice_kind: "enriched" });
    expect(enriched).not.toBe(first);
  });

  it("produces stable active suggestion ids per transition", () => {
    const key: SuggestionActiveKey = {
      thread_id: "t-1",
      from_status: "inbox",
      to_status: "needs_human",
    };
    expect(suggestionActiveId(key)).toBe(suggestionActiveId(key));
  });
});

describe("known senders projection", () => {
  it("tracks senders within lookback", async () => {
    let state = KnownSendersProjectionDef.init();
    const event = {
      event_type: "email_message_ingested",
      payload: {
        from: "Test <user@example.com>",
        source_ref: "src-1",
        message_id: "m-1",
        thread_id: "t-1",
        internal_date: "2024-01-01T00:00:00Z",
      },
      event_id: "e-1",
      occurred_at: "2024-01-01T00:00:00Z",
      ingested_at: "2024-01-01T00:00:00Z",
      actor: { actor_id: "a", actor_type: "service" },
      schema_version: 1,
      correlation_id: "c",
    } as any;
    state = KnownSendersProjectionDef.apply(state, event);
    const proj = buildKnownSendersProjection(state, "2024-02-01T00:00:00Z");
    expect(proj.senders.has("user@example.com")).toBe(true);
    expect(proj.domains.has("example.com")).toBe(true);
  });
});

describe("thread slice hashing", () => {
  it("changes hash when messages differ", () => {
    const threadState = ThreadsProjectionDef.init();
    // Build a simple projection state manually
    threadState.threads.set("t1", {
      thread_id: "t1",
      subject: "Subject",
      participants: [],
      has_attachments: false,
      message_count: 1,
      first_message_at: "2024-01-01T00:00:00Z",
      last_message_at: "2024-01-01T00:00:00Z",
      messages: [
        {
          source_ref: "src-1",
          message_id: "m-1",
          thread_id: "t1",
          internal_date: "2024-01-01T00:00:00Z",
          has_attachments: false,
          from: "a@example.com",
          snippet: "hello",
        },
      ],
    });
    const slice = buildThreadSlice(
      buildThreadsProjectionFromState(threadState).threads[0]!,
    );
    const hashA = hashThreadSlice(slice);

    const slice2 = {
      ...slice,
      recent_messages: [{ ...slice.recent_messages[0], snippet: "different" }],
    };
    const hashB = hashThreadSlice(slice2);
    expect(hashA).not.toBe(hashB);
    expect(slice.slice_version).toBe(THREAD_SLICE_VERSION);
  });
});
