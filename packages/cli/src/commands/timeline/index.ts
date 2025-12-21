import {
  OPS_CONNECTOR_GOOGLE_CALENDAR_ENABLED,
  Projections,
  Storage,
} from "@aligntrue/ops-core";
import { exitWithError } from "../../utils/command-utilities.js";

const HELP_TEXT = `
Usage: aligntrue timeline list [--since YYYY-MM-DD] [--limit N] [--type calendar_event]

List timeline items (currently calendar events). Output is stable and receipt-oriented.
`;

type TimelineItem = Projections.TimelineProjection["items"][number];

export async function timeline(args: string[]): Promise<void> {
  const sub = args[0] ?? "list";
  const rest = sub === "list" ? args.slice(1) : args.slice(1);

  if (sub === "--help" || sub === "-h" || sub === "help") {
    console.log(HELP_TEXT.trim());
    return;
  }

  if (sub !== "list") {
    exitWithError(2, `Unknown subcommand: ${sub}`, {
      hint: "Run aligntrue timeline --help",
    });
    return;
  }

  const { since, limit, type } = parseListArgs(rest);

  if (!OPS_CONNECTOR_GOOGLE_CALENDAR_ENABLED) {
    console.warn(
      "timeline: OPS_CONNECTOR_GOOGLE_CALENDAR_ENABLED=0 (connector disabled; showing any existing data)",
    );
  }

  const store = new Storage.JsonlEventStore();
  const projection = await Projections.rebuildOne(
    Projections.TimelineProjectionDef,
    store,
  );
  const view = Projections.buildTimelineProjectionFromState(
    projection.data as Projections.TimelineProjectionState,
  );

  let items = view.items;

  if (type && type !== "calendar_event") {
    exitWithError(2, `Unsupported type filter: ${type}`, {
      hint: "Only 'calendar_event' is supported in this milestone",
    });
    return;
  }

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
  }
}

function parseListArgs(args: string[]): {
  since?: string;
  limit?: number;
  type?: string;
} {
  let since: string | undefined;
  let limit: number | undefined;
  let type: string | undefined;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    switch (arg) {
      case "--since":
        since = args[i + 1];
        i += 1;
        break;
      case "--limit":
        limit = Number(args[i + 1]);
        if (Number.isNaN(limit) || limit < 1) {
          exitWithError(2, "limit must be a positive integer");
        }
        i += 1;
        break;
      case "--type":
        type = args[i + 1];
        i += 1;
        break;
      case "--help":
      case "-h":
        console.log(HELP_TEXT.trim());
        process.exit(0);
        break;
      default:
        exitWithError(2, `Unknown option: ${arg}`, {
          hint: "Run aligntrue timeline --help",
        });
    }
  }

  const result: { since?: string; limit?: number; type?: string } = {};
  if (since !== undefined) {
    result.since = since;
  }
  if (limit !== undefined) {
    result.limit = limit;
  }
  if (type !== undefined) {
    result.type = type;
  }
  return result;
}
