import {
  OPS_CONNECTOR_GOOGLE_CALENDAR_ENABLED,
  OPS_CONNECTOR_GOOGLE_GMAIL_ENABLED,
  Projections,
} from "@aligntrue/ops-core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getEventStore, getHost } from "@/lib/ops-services";
import { formatTimestamp } from "@/lib/format";

type TimelineItem = Projections.TimelineProjection["items"][number];

async function getTimeline(): Promise<Projections.TimelineProjection> {
  await getHost();
  const rebuilt = await Projections.rebuildOne(
    Projections.TimelineProjectionDef,
    getEventStore(),
  );
  return Projections.buildTimelineProjectionFromState(
    rebuilt.data as Projections.TimelineProjectionState,
  );
}

export default async function TimelinePage() {
  if (
    !OPS_CONNECTOR_GOOGLE_CALENDAR_ENABLED &&
    !OPS_CONNECTOR_GOOGLE_GMAIL_ENABLED
  ) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Timeline connectors are disabled</CardTitle>
          </CardHeader>
          <CardContent>
            Set OPS_CONNECTOR_GOOGLE_CALENDAR_ENABLED=1 or
            OPS_CONNECTOR_GOOGLE_GMAIL_ENABLED=1.
          </CardContent>
        </Card>
      </div>
    );
  }

  const timeline = await getTimeline();

  return (
    <div className="mx-auto max-w-4xl space-y-4 py-8">
      <h1 className="text-xl font-semibold">Timeline</h1>
      {timeline.items.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            No timeline items yet. Run sync to ingest calendar or email data.
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-3">
        {timeline.items.map((item) => (
          <Card key={item.id}>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">{item.title}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {formatTimestamp(item.occurred_at) || item.occurred_at} ·{" "}
                  {item.id}
                </p>
              </div>
              <Badge
                variant={
                  item.type === "calendar_event" ? "secondary" : "outline"
                }
              >
                {item.type === "calendar_event" ? "Calendar" : "Email"}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              {item.summary ? <p>{item.summary}</p> : null}
              <Meta item={item} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Meta({ item }: { item: TimelineItem }) {
  if (item.type === "calendar_event") {
    return (
      <div className="flex flex-wrap gap-3">
        {item.start_time ? <span>Start: {item.start_time}</span> : null}
        {item.end_time ? <span>End: {item.end_time}</span> : null}
        {item.organizer ? <span>Organizer: {item.organizer}</span> : null}
        {item.location ? <span>Location: {item.location}</span> : null}
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-3">
      {item.from ? <span>From: {item.from}</span> : null}
      {item.to?.length ? <span>To: {item.to.join(", ")}</span> : null}
      {item.cc?.length ? <span>Cc: {item.cc.join(", ")}</span> : null}
      {item.label_ids?.length ? (
        <span>Labels: {item.label_ids.join(", ")}</span>
      ) : null}
    </div>
  );
}
