import { NextResponse } from "next/server";
import {
  Connectors,
  Identity,
  Storage,
  OPS_CONNECTOR_GOOGLE_GMAIL_ENABLED,
  OPS_CONNECTOR_GOOGLE_CALENDAR_ENABLED,
} from "@aligntrue/ops-core";

export const dynamic = "force-dynamic";

export interface SyncStatus {
  state: "idle" | "syncing" | "processing" | "error";
  lastSyncAt: string | null;
  lastError: string | null;
  pendingItems: number;
  results?: {
    gmail?: {
      fetched: number;
      written: number;
      skipped: number;
      disabled: boolean;
    };
    calendar?: {
      fetched: number;
      written: number;
      skipped: number;
      disabled: boolean;
    };
  };
}

// In-memory sync state (would be persisted in production)
let lastSyncAt: string | null = null;
let lastError: string | null = null;

export async function GET() {
  const status: SyncStatus = {
    state: lastError ? "error" : "idle",
    lastSyncAt,
    lastError,
    pendingItems: 0,
  };
  return NextResponse.json(status);
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const days = typeof body.days === "number" ? body.days : 7;

    // Reset prior error state; this run will overwrite if any errors occur.
    lastError = null;

    const results: SyncStatus["results"] = {};
    const eventStore = new Storage.JsonlEventStore();

    // Sync Gmail if enabled
    if (OPS_CONNECTOR_GOOGLE_GMAIL_ENABLED) {
      const accessToken = process.env["GOOGLE_ACCESS_TOKEN"];
      if (accessToken) {
        try {
          const query = `newer_than:${days}d`;
          const rawMessages =
            await Connectors.GoogleGmail.fetchAllGmailMessages({
              accessToken,
              query,
              maxResults: 100,
            });

          const records =
            Connectors.GoogleGmail.transformGmailMessages(rawMessages);

          const ingestResult = await Connectors.GoogleGmail.ingestEmailMessages(
            {
              eventStore,
              emails: records,
              correlation_id: Identity.randomId(),
            },
          );

          results.gmail = {
            fetched: records.length,
            written: ingestResult.written,
            skipped: ingestResult.skipped,
            disabled: ingestResult.disabled,
          };
        } catch (err) {
          results.gmail = {
            fetched: 0,
            written: 0,
            skipped: 0,
            disabled: true,
          };
          lastError = lastError
            ? `${lastError}; Gmail sync failed: ${err instanceof Error ? err.message : "unknown"}`
            : `Gmail sync failed: ${err instanceof Error ? err.message : "unknown"}`;
        }
      } else {
        results.gmail = {
          fetched: 0,
          written: 0,
          skipped: 0,
          disabled: true,
        };
      }
    }

    // Sync Calendar if enabled
    if (OPS_CONNECTOR_GOOGLE_CALENDAR_ENABLED) {
      const accessToken = process.env["GOOGLE_ACCESS_TOKEN"];
      if (accessToken) {
        try {
          const now = new Date();
          const timeMin = new Date(
            now.getTime() - days * 24 * 60 * 60 * 1000,
          ).toISOString();
          const timeMax = new Date(
            now.getTime() + 30 * 24 * 60 * 60 * 1000,
          ).toISOString();

          const calendarId = "primary";
          const rawEvents =
            await Connectors.GoogleCalendar.fetchAllCalendarEvents({
              accessToken,
              calendarId,
              timeMin,
              timeMax,
              maxResults: 250,
            });

          const records =
            Connectors.GoogleCalendar.transformCalendarEvents(rawEvents);

          const ingestResult =
            await Connectors.GoogleCalendar.ingestCalendarEvents({
              eventStore,
              events: records,
              correlation_id: Identity.randomId(),
            });

          results.calendar = {
            fetched: records.length,
            written: ingestResult.written,
            skipped: ingestResult.skipped,
            disabled: ingestResult.disabled,
          };
        } catch (err) {
          results.calendar = {
            fetched: 0,
            written: 0,
            skipped: 0,
            disabled: true,
          };
          lastError = lastError
            ? `${lastError}; Calendar sync failed: ${err instanceof Error ? err.message : "unknown"}`
            : `Calendar sync failed: ${err instanceof Error ? err.message : "unknown"}`;
        }
      } else {
        results.calendar = {
          fetched: 0,
          written: 0,
          skipped: 0,
          disabled: true,
        };
      }
    }

    lastSyncAt = new Date().toISOString();

    const status: SyncStatus = {
      state: lastError ? "error" : "idle",
      lastSyncAt,
      lastError,
      pendingItems: 0,
      results,
    };

    return NextResponse.json(status);
  } catch (err) {
    // Record when this sync attempt failed
    lastSyncAt = new Date().toISOString();
    lastError = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json(
      {
        state: "error",
        lastSyncAt,
        lastError,
        pendingItems: 0,
      } satisfies SyncStatus,
      { status: 500 },
    );
  }
}
