import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { beforeEach, describe, expect, it, afterEach } from "vitest";
import { Projections, Storage } from "../src/index.js";
import * as GoogleGmail from "@aligntrue/ops-shared-google-gmail";

const baseEmail = {
  provider: "google_gmail" as const,
  message_id: "msg-1",
  thread_id: "thr-1",
  internal_date: "2024-02-01T00:00:00Z",
  from: "alice@example.com",
  to: ["bob@example.com"],
  subject: "Hello",
};

describe("gmail ingest + timeline projection", () => {
  let dir: string;
  let eventsPath: string;
  let store: Storage.JsonlEventStore;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "ops-core-gmail-"));
    eventsPath = join(dir, "events.jsonl");
    store = new Storage.JsonlEventStore(eventsPath);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("produces deterministic timeline projection hash", async () => {
    await GoogleGmail.ingestEmailMessages({
      eventStore: store,
      emails: [
        baseEmail,
        {
          ...baseEmail,
          message_id: "msg-2",
          thread_id: "thr-2",
          internal_date: "2024-02-02T00:00:00Z",
          subject: "Follow-up",
        },
      ],
      flagEnabled: true,
      now: () => "2024-02-05T00:00:00Z",
      correlation_id: "corr-gmail-1",
    });

    const first = await Projections.rebuildOne(
      Projections.TimelineProjectionDef,
      store,
    );
    const firstView = Projections.buildTimelineProjectionFromState(
      first.data as Projections.TimelineProjectionState,
    );
    const firstHash = Projections.hashTimelineProjection(firstView);

    const second = await Projections.rebuildOne(
      Projections.TimelineProjectionDef,
      store,
    );
    const secondView = Projections.buildTimelineProjectionFromState(
      second.data as Projections.TimelineProjectionState,
    );
    const secondHash = Projections.hashTimelineProjection(secondView);

    expect(firstHash).toBe(secondHash);
    expect(firstView.items.length).toBe(2);
  });

  it("deduplicates repeated ingestion by source_ref", async () => {
    const result1 = await GoogleGmail.ingestEmailMessages({
      eventStore: store,
      emails: [baseEmail],
      flagEnabled: true,
      now: () => "2024-02-05T00:00:00Z",
      correlation_id: "corr-gmail-2",
    });
    const result2 = await GoogleGmail.ingestEmailMessages({
      eventStore: store,
      emails: [baseEmail],
      flagEnabled: true,
      now: () => "2024-02-06T00:00:00Z",
      correlation_id: "corr-gmail-3",
    });

    expect(result1).toEqual({
      written: 1,
      skipped: 0,
      disabled: false,
      written_records: [baseEmail],
    });
    expect(result2).toEqual({
      written: 0,
      skipped: 1,
      disabled: false,
      written_records: [],
    });

    const projection = await Projections.rebuildOne(
      Projections.TimelineProjectionDef,
      store,
    );
    const view = Projections.buildTimelineProjectionFromState(
      projection.data as Projections.TimelineProjectionState,
    );
    expect(view.items.length).toBe(1);
  });

  it("respects connector kill switch and emits no events", async () => {
    const result = await GoogleGmail.ingestEmailMessages({
      eventStore: store,
      emails: [baseEmail],
      flagEnabled: false,
      now: () => "2024-02-05T00:00:00Z",
      correlation_id: "corr-gmail-4",
    });

    expect(result.disabled).toBe(true);
    expect(result.written).toBe(0);
    expect(result.written_records).toEqual([]);

    const projection = await Projections.rebuildOne(
      Projections.TimelineProjectionDef,
      store,
    );
    const view = Projections.buildTimelineProjectionFromState(
      projection.data as Projections.TimelineProjectionState,
    );
    expect(view.items.length).toBe(0);
  });

  it("creates DocRefs for attachments without fetching blobs", async () => {
    const attachments = [
      {
        attachment_id: "att-1",
        filename: "foo.pdf",
        mime_type: "application/pdf",
        size_bytes: 1234,
      },
      { attachment_id: "att-2", filename: "bar.txt" },
    ];

    await GoogleGmail.ingestEmailMessages({
      eventStore: store,
      emails: [
        {
          ...baseEmail,
          message_id: "msg-attachments",
          attachments,
        },
      ],
      flagEnabled: true,
      now: () => "2024-02-07T00:00:00Z",
      correlation_id: "corr-gmail-5",
    });

    const projection = await Projections.rebuildOne(
      Projections.TimelineProjectionDef,
      store,
    );
    const view = Projections.buildTimelineProjectionFromState(
      projection.data as Projections.TimelineProjectionState,
    );
    const item = view.items.find((i) => i.message_id === "msg-attachments");
    expect(item).toBeDefined();
    expect(item?.doc_refs?.length).toBe(2);
    expect(item?.doc_refs?.[0]?.provider_doc_id).toBe("att-1");
    expect(item?.doc_refs?.[0]?.provider).toBe("google_gmail");
    expect(item?.doc_refs?.[0]?.parent_ref).toBe(item?.source_ref);
  });
});
