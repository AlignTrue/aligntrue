import {
  OPS_CONNECTOR_GOOGLE_CALENDAR_ENABLED,
  OPS_CONNECTOR_GOOGLE_GMAIL_ENABLED,
  Projections,
  Storage,
} from "@aligntrue/core";
import { exitWithError } from "../../utils/command-utilities.js";
import { defineCommand } from "../../utils/command-router.js";
import { parseArgs, type ArgDefinition } from "../../utils/args.js";

type TimelineItem = Projections.TimelineProjection["items"][number];

export const timeline = defineCommand({
  name: "timeline",
  subcommands: {
    list: {
      handler: listTimeline,
      description: "List timeline items (calendar events, email metadata)",
    },
  },
});

async function listTimeline(args: string[]): Promise<void> {
  const spec: ArgDefinition[] = [
    { flag: "since", type: "string" },
    { flag: "limit", type: "string" },
    { flag: "type", type: "string", choices: ["calendar_event", "email"] },
  ];

  const parsed = parseArgs(args, spec);
  if (parsed.errors.length > 0) {
    exitWithError(2, parsed.errors.join("; "), {
      hint: "Usage: aligntrue timeline list [--since YYYY-MM-DD] [--limit N] [--type calendar_event|email]",
    });
  }

  const since = parsed.flags.since as string | undefined;
  const limitStr = parsed.flags.limit as string | undefined;
  const limit = limitStr ? Number.parseInt(limitStr, 10) : undefined;
  const rawType = parsed.flags.type as string | undefined;
  const type = rawType === "email" ? "email_message" : rawType;

  if (limit !== undefined && (Number.isNaN(limit) || limit < 1)) {
    exitWithError(2, "limit must be a positive integer");
  }

  if (
    !OPS_CONNECTOR_GOOGLE_CALENDAR_ENABLED &&
    !OPS_CONNECTOR_GOOGLE_GMAIL_ENABLED
  ) {
    console.warn(
      "timeline: all connectors disabled; showing any existing data",
    );
  } else if (
    type === "calendar_event" &&
    !OPS_CONNECTOR_GOOGLE_CALENDAR_ENABLED
  ) {
    console.warn(
      "timeline: OPS_CONNECTOR_GOOGLE_CALENDAR_ENABLED=0 (calendar disabled; showing any existing data)",
    );
  } else if (type === "email_message" && !OPS_CONNECTOR_GOOGLE_GMAIL_ENABLED) {
    console.warn(
      "timeline: OPS_CONNECTOR_GOOGLE_GMAIL_ENABLED=0 (gmail disabled; showing any existing data)",
    );
  }

  const store = new Storage.JsonlEventStore();
  const rebuilt = await Projections.rebuildOne(
    Projections.TimelineProjectionDef,
    store,
  );
  const view = Projections.buildTimelineProjectionFromState(
    rebuilt.data as Projections.TimelineProjectionState,
  );

  let items = view.items;

  if (type) {
    items = items.filter((item: TimelineItem) => item.type === type);
  }

  if (since) {
    items = items.filter((item: TimelineItem) => item.occurred_at >= since);
  }

  if (limit !== undefined) {
    items = items.slice(0, limit);
  }

  if (items.length === 0) {
    console.log("No timeline items.");
    return;
  }

  for (const item of items) {
    if (item.type === "calendar_event") {
      console.log(
        `- [${item.type}] ${item.title} @ ${item.start_time} (${item.source_ref})`,
      );
      console.log(
        `  freshness: last_ingested_at=${item.last_ingested_at}, raw_updated_at=${item.raw_updated_at}`,
      );
      if (item.location) {
        console.log(`  location: ${item.location}`);
      }
      if (item.organizer) {
        console.log(`  organizer: ${item.organizer}`);
      }
      if (item.attendees?.length) {
        const attendeeLabels = item.attendees
          .map(
            (a: NonNullable<TimelineItem["attendees"]>[number]) =>
              a.email ?? a.display_name,
          )
          .filter((v): v is string => Boolean(v && v.trim()));
        if (attendeeLabels.length) {
          console.log(`  attendees: ${attendeeLabels.join(", ")}`);
        }
      }
      continue;
    }

    // email_message
    console.log(
      `- [${item.type}] ${item.title} @ ${item.occurred_at} (${item.source_ref})`,
    );
    console.log(
      `  freshness: last_ingested_at=${item.last_ingested_at}, raw_updated_at=${item.raw_updated_at}`,
    );
    if (item.from) {
      console.log(`  from: ${item.from}`);
    }
    if (item.to?.length) {
      console.log(`  to: ${item.to.join(", ")}`);
    }
    if (item.cc?.length) {
      console.log(`  cc: ${item.cc.join(", ")}`);
    }
    if (item.label_ids?.length) {
      console.log(`  labels: ${item.label_ids.join(", ")}`);
    }
    if (item.doc_refs?.length) {
      console.log(`  doc_refs: ${item.doc_refs.length} attachment(s)`);
    }
  }
}
