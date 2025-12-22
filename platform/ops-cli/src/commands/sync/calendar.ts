import {
  Connectors,
  Identity,
  OPS_MEMORY_PROVIDER_ENABLED,
  Storage,
} from "@aligntrue/ops-core";
import { Mem0Adapter } from "../../memory/index.js";
import { loadTokenSet, logKV, logSection, parseDaysArg } from "./shared.js";

export async function syncCalendar(args: string[]): Promise<void> {
  const days = parseDaysArg(args, 30);

  logSection(`Syncing calendar (last ${days} days)...`);

  const tokens = await loadTokenSet({ allowRefresh: true });
  const now = new Date();
  const timeMax = now.toISOString();
  const timeMin = daysAgoIso(days);

  const rawEvents = await Connectors.GoogleCalendar.fetchAllCalendarEvents({
    accessToken: tokens.accessToken,
    timeMin,
    timeMax,
  });

  const records = Connectors.GoogleCalendar.transformCalendarEvents(rawEvents);

  const eventStore = new Storage.JsonlEventStore();
  const result = await Connectors.GoogleCalendar.ingestCalendarEvents({
    eventStore,
    events: records,
    correlation_id: Identity.randomId(),
  });

  logKV("Fetched", records.length);
  logKV("Written", result.written);
  logKV("Skipped", result.skipped);

  if (OPS_MEMORY_PROVIDER_ENABLED && result.written > 0) {
    const provider = new Mem0Adapter();
    const toIndex = records.map((r) => ({
      entity_type: "timeline_item" as const,
      entity_id: `${r.calendar_id}:${r.event_id}`,
      content: buildCalendarContent(r),
    }));
    const indexResult = await provider.index(toIndex);
    logKV("Indexed", indexResult.indexed);
  }

  logKV("Done (ms)", Date.now() - now.getTime());
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

function buildCalendarContent(
  record: Connectors.GoogleCalendar.CalendarEventRecord,
) {
  const parts = [
    record.title,
    record.description,
    record.location,
    record.organizer,
    record.attendees?.map((a) => a.display_name ?? a.email)?.join(" "),
  ];
  return parts.filter(Boolean).join(" ");
}
