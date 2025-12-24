import {
  OPS_CONNECTOR_GOOGLE_GMAIL_ENABLED,
  OPS_CONNECTOR_GOOGLE_CALENDAR_ENABLED,
  Projections,
} from "@aligntrue/ops-core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getEventStore } from "@/lib/ops-services";
import { ReviewPageClient } from "./ReviewPageClient";

export const dynamic = "force-dynamic";

async function loadConversations() {
  const rebuilt = await Projections.rebuildOne(
    Projections.ConversationsProjectionDef,
    getEventStore(),
  );
  const projection = Projections.buildConversationsProjectionFromState(
    rebuilt.data as Projections.ConversationsProjectionState,
  );
  return projection.conversations;
}

async function loadReceipts() {
  const rebuilt = await Projections.rebuildOne(
    Projections.ReceiptsProjectionDef,
    getEventStore(),
  );
  return Projections.buildReceiptsProjectionFromState(
    rebuilt.data as Projections.ReceiptsProjectionState,
  );
}

async function loadAvailability() {
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

  return {
    total_free_minutes: freeWindows.total_free_minutes,
    windows: freeWindows.windows,
    next_events: nextEvents,
  };
}

function toMs(value?: string | null): number | null {
  if (!value) return null;
  const normalized = value.length === 10 ? `${value}T00:00:00Z` : value;
  const ms = Date.parse(normalized);
  return Number.isNaN(ms) ? null : ms;
}

export default async function ReviewPage() {
  if (!OPS_CONNECTOR_GOOGLE_GMAIL_ENABLED) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Gmail connector is disabled</CardTitle>
          </CardHeader>
          <CardContent>
            Set OPS_CONNECTOR_GOOGLE_GMAIL_ENABLED=1 to enable the Review
            console.
          </CardContent>
        </Card>
      </div>
    );
  }

  const [conversations, receiptsProjection, availability] = await Promise.all([
    loadConversations(),
    loadReceipts(),
    loadAvailability(),
  ]);

  return (
    <ReviewPageClient
      conversations={conversations}
      receiptsProjection={receiptsProjection}
      availability={availability}
      calendarEnabled={OPS_CONNECTOR_GOOGLE_CALENDAR_ENABLED}
    />
  );
}
