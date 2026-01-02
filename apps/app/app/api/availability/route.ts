import { NextResponse } from "next/server";
import { Projections } from "@aligntrue/core";
import { getEventStore, getHost } from "@/lib/ops-services";

export async function GET() {
  await getHost();
  const rebuilt = await Projections.rebuildOne(
    Projections.TimelineProjectionDef,
    getEventStore(),
  );
  const timeline = Projections.buildTimelineProjectionFromState(
    rebuilt.data as Projections.TimelineProjectionState,
  );

  const nowMs = Date.now();
  const todayIso = new Date().toISOString().slice(0, 10);
  const calendarItems = timeline.items.filter(
    (item) => item.type === "calendar_event",
  );

  const nextEvents = calendarItems
    .map((item) => ({
      ...item,
      start_ms: toMs(item.start_time),
    }))
    .filter((item) => item.start_ms !== null && item.start_ms >= nowMs)
    .sort((a, b) => (a.start_ms ?? 0) - (b.start_ms ?? 0))
    .slice(0, 3)
    .map((item) => ({
      title: item.title,
      start_time: item.start_time,
      end_time: item.end_time,
      attendees: item.attendees?.length ?? 0,
      event_id: item.event_id ?? item.source_ref,
    }));

  const freeWindows = Projections.computeFreeWindows(
    calendarItems.map((item) => ({
      start_time: item.start_time ?? todayIso,
      end_time: item.end_time ?? item.start_time ?? todayIso,
      title: item.title,
      updated: item.raw_updated_at ?? item.start_time ?? todayIso,
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

function toMs(value?: string | null): number | null {
  if (!value) return null;
  // If date-only (YYYY-MM-DD), treat as start of day UTC
  const normalized = value.length === 10 ? `${value}T00:00:00Z` : value;
  const ms = Date.parse(normalized);
  return Number.isNaN(ms) ? null : ms;
}
