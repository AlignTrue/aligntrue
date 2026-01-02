import { NextResponse } from "next/server";
import {
  Identity,
  Storage,
  OPS_CONNECTOR_GOOGLE_GMAIL_ENABLED,
  OPS_CONNECTOR_GOOGLE_CALENDAR_ENABLED,
} from "@aligntrue/core";
import * as GoogleGmail from "@aligntrue/connector-google-gmail";
import * as GoogleCalendar from "@aligntrue/connector-google-calendar";
import {
  loadTokenSet,
  withTokenRefresh,
  type TokenSet,
} from "@aligntrue/connector-google-common";

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

    let tokenSet: TokenSet | null = null;
    const getTokens = async () => {
      tokenSet ??= await loadTokenSet();
      return tokenSet;
    };

    const results: SyncStatus["results"] = {};
    const eventStore = new Storage.JsonlEventStore();

    // Sync Gmail if enabled
    if (OPS_CONNECTOR_GOOGLE_GMAIL_ENABLED) {
      try {
        const tokens = await getTokens();
        const query = `newer_than:${days}d`;
        const rawMessages = await withTokenRefresh(
          (accessToken) =>
            GoogleGmail.fetchAllGmailMessages({
              accessToken,
              query,
              maxResults: 100,
            }),
          tokens,
        );

        const records = GoogleGmail.transformGmailMessages(rawMessages);

        const ingestResult = await GoogleGmail.ingestEmailMessages({
          eventStore,
          emails: records,
          correlation_id: Identity.randomId(),
        });

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
    }

    // Sync Calendar if enabled
    if (OPS_CONNECTOR_GOOGLE_CALENDAR_ENABLED) {
      try {
        const tokens = await getTokens();
        const now = new Date();
        const timeMin = new Date(
          now.getTime() - days * 24 * 60 * 60 * 1000,
        ).toISOString();
        const timeMax = new Date(
          now.getTime() + 30 * 24 * 60 * 60 * 1000,
        ).toISOString();

        const calendarId = "primary";
        const rawEvents = await withTokenRefresh(
          (accessToken) =>
            GoogleCalendar.fetchAllCalendarEvents({
              accessToken,
              calendarId,
              timeMin,
              timeMax,
              maxResults: 250,
            }),
          tokens,
        );

        const records = GoogleCalendar.transformCalendarEvents(rawEvents);

        const ingestResult = await GoogleCalendar.ingestCalendarEvents({
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
