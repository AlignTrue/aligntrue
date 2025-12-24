import {
  OPS_CONNECTOR_GOOGLE_GMAIL_ENABLED,
  OPS_CONNECTOR_GOOGLE_CALENDAR_ENABLED,
  Projections,
} from "@aligntrue/ops-core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConversationQueue } from "@/components/ConversationQueue";
import { TriageView } from "@/components/TriageView";
import { BatchReview } from "@/components/BatchReview";
import { TimeAvailability } from "@/components/TimeAvailability";
import { getEventStore } from "@/lib/ops-services";

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

async function loadAvailability() {
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

  return {
    total_free_minutes: freeWindows.total_free_minutes,
    windows: freeWindows.windows,
    next_events: nextEvents,
  };
}

export default async function DashboardPage() {
  const [conversations, availability] = await Promise.all([
    loadConversations(),
    loadAvailability(),
  ]);

  if (!OPS_CONNECTOR_GOOGLE_GMAIL_ENABLED) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Gmail connector is disabled</CardTitle>
          </CardHeader>
          <CardContent>
            Set OPS_CONNECTOR_GOOGLE_GMAIL_ENABLED=1 to enable the dashboard.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 py-8">
      <h1 className="text-xl font-semibold">Dashboard</h1>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="md:col-span-2 space-y-4">
          <section className="space-y-2">
            <h2 className="text-lg font-medium">Queue</h2>
            <ConversationQueue conversations={conversations} />
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-medium">Triage</h2>
            <TriageView conversations={conversations.slice(0, 5)} />
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-medium">Batch Review</h2>
            <BatchReview conversations={conversations.slice(0, 10)} />
          </section>
        </div>
        <div className="space-y-4">
          <section className="space-y-2">
            <h2 className="text-lg font-medium">Time</h2>
            <TimeAvailability
              totalFreeMinutes={availability.total_free_minutes}
              windows={availability.windows}
              nextEvents={availability.next_events}
            />
          </section>
          {!OPS_CONNECTOR_GOOGLE_CALENDAR_ENABLED ? (
            <p className="text-xs text-muted-foreground">
              Calendar connector disabled; availability may be empty.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
