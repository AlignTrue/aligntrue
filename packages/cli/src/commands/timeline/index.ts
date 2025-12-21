import {
  OPS_CONNECTOR_GOOGLE_CALENDAR_ENABLED,
  OPS_CONNECTOR_GOOGLE_GMAIL_ENABLED,
  Projections,
  Storage,
} from "@aligntrue/ops-core";
import { exitWithError } from "../../utils/command-utilities.js";

const HELP_TEXT = `
Usage: aligntrue timeline list [--since YYYY-MM-DD] [--limit N] [--type calendar_event|email]

List timeline items (calendar events, email metadata). Output is stable and receipt-oriented.
`;

type TimelineItem = Projections.TimelineProjection["items"][number];

export async function timeline(args: string[]): Promise<void> {
  const sub = args[0] ?? "list";
  const rest = args.slice(1);

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
  const projection = await Projections.rebuildOne(
    Projections.TimelineProjectionDef,
    store,
  );
  const view = Projections.buildTimelineProjectionFromState(
    projection.data as Projections.TimelineProjectionState,
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
    if (!arg) continue;
    switch (arg) {
      case "--since":
        if (args[i + 1]) {
          since = args[i + 1];
          i += 1;
        } else {
          exitWithError(2, "--since requires a value");
        }
        break;
      case "--limit":
        if (!args[i + 1]) {
          exitWithError(2, "--limit requires a value");
        }
        {
          const parsed = Number(args[i + 1]);
          if (Number.isNaN(parsed) || parsed < 1) {
            exitWithError(2, "limit must be a positive integer");
          }
          limit = parsed;
          i += 1;
        }
        break;
      case "--type":
        if (args[i + 1]) {
          type = args[i + 1];
          i += 1;
        } else {
          exitWithError(2, "--type requires a value");
        }
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
    if (type === "email") {
      result.type = "email_message";
    } else if (type === "calendar_event" || type === "email_message") {
      result.type = type;
    } else {
      exitWithError(2, `Unsupported type filter: ${type}`, {
        hint: "Use 'calendar_event' or 'email'",
      });
    }
  }
  return result;
}
