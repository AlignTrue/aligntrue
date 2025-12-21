import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { beforeEach, describe, expect, it, afterEach } from "vitest";
import { Connectors, Projections, Storage } from "../src/index.js";

const baseEvent = {
  provider: "google_calendar" as const,
  calendar_id: "primary",
  event_id: "evt-1",
  updated: "2024-01-01T00:00:00Z",
  title: "Kickoff",
  start_time: "2024-01-02T10:00:00Z",
};

describe("timeline projection (calendar ingest v0)", () => {
  let dir: string;
  let eventsPath: string;
  let store: Storage.JsonlEventStore;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "ops-core-timeline-"));
    eventsPath = join(dir, "events.jsonl");
    store = new Storage.JsonlEventStore(eventsPath);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("produces deterministic timeline projection hash", async () => {
    await Connectors.GoogleCalendar.ingestCalendarEvents({
      eventStore: store,
      events: [
        baseEvent,
        {
          ...baseEvent,
          event_id: "evt-2",
          updated: "2024-01-02T00:00:00Z",
          title: "Follow-up",
          start_time: "2024-01-03T11:00:00Z",
        },
      ],
      flagEnabled: true,
      now: () => "2024-01-05T00:00:00Z",
      correlation_id: "corr-1",
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
    const result1 = await Connectors.GoogleCalendar.ingestCalendarEvents({
      eventStore: store,
      events: [baseEvent],
      flagEnabled: true,
      now: () => "2024-01-05T00:00:00Z",
      correlation_id: "corr-2",
    });
    const result2 = await Connectors.GoogleCalendar.ingestCalendarEvents({
      eventStore: store,
      events: [baseEvent],
      flagEnabled: true,
      now: () => "2024-01-06T00:00:00Z",
      correlation_id: "corr-3",
    });

    expect(result1).toEqual({ written: 1, skipped: 0, disabled: false });
    expect(result2).toEqual({ written: 0, skipped: 1, disabled: false });

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
    const result = await Connectors.GoogleCalendar.ingestCalendarEvents({
      eventStore: store,
      events: [baseEvent],
      flagEnabled: false,
      now: () => "2024-01-05T00:00:00Z",
      correlation_id: "corr-4",
    });

    expect(result.disabled).toBe(true);
    expect(result.written).toBe(0);

    const projection = await Projections.rebuildOne(
      Projections.TimelineProjectionDef,
      store,
    );
    const view = Projections.buildTimelineProjectionFromState(
      projection.data as Projections.TimelineProjectionState,
    );
    expect(view.items.length).toBe(0);
  });
});
