import { NextResponse } from "next/server";
import { Projections } from "@aligntrue/ops-core";
import { getEventStore } from "@/lib/ops-services";

export async function GET() {
  const rebuilt = await Projections.rebuildOne(
    Projections.TimelineProjectionDef,
    getEventStore(),
  );
  const timeline = Projections.buildTimelineProjectionFromState(
    rebuilt.data as Projections.TimelineProjectionState,
  );

  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);
  const calendarItems = timeline.items.filter(
    (item) => item.type === "calendar_event",
  );

  const nextEvents = calendarItems
    .filter((item) => (item.start_time ?? "") > now.toISOString())
    .sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? ""))
    .slice(0, 3)
    .map((item) => ({
      title: item.title,
      start_time: item.start_time,
      end_time: item.end_time,
      attendees: item.attendees?.length ?? 0,
    }));

  const freeWindows = Projections.computeFreeWindows(
    calendarItems.map((item) => ({
      start_time: item.start_time ?? todayIso,
      end_time: item.end_time ?? item.start_time ?? todayIso,
      title: item.title,
      provider: item.provider,
      source_ref: item.source_ref,
      raw_updated_at: item.raw_updated_at,
      calendar_id: item.calendar_id ?? "",
      event_id: item.event_id ?? item.source_ref,
    })),
    todayIso,
  );

  return NextResponse.json({
    date: freeWindows.date,
    total_free_minutes: freeWindows.total_free_minutes,
    windows: freeWindows.windows,
    next_events: nextEvents,
  });
}
