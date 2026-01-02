import {
  GoogleApiError,
  TokenExpiredError,
} from "@aligntrue/connector-google-common";

export interface FetchCalendarOptions {
  accessToken: string;
  calendarId?: string;
  timeMin?: string;
  timeMax?: string;
  maxResults?: number;
  pageToken?: string | undefined;
}

export interface GoogleCalendarEvent {
  id: string;
  updated: string;
  summary?: string;
  description?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  organizer?: { email?: string; displayName?: string };
  location?: string;
  attendees?: Array<{
    email?: string;
    displayName?: string;
    responseStatus?: string;
  }>;
}

export interface FetchCalendarResult {
  events: GoogleCalendarEvent[];
  nextPageToken?: string | undefined;
}

const CALENDAR_BASE = "https://www.googleapis.com/calendar/v3";

export async function fetchCalendarPage(
  opts: FetchCalendarOptions,
): Promise<FetchCalendarResult> {
  const calendarId = encodeURIComponent(opts.calendarId ?? "primary");
  const maxResults = opts.maxResults ?? 250;
  const params = new URLSearchParams({
    maxResults: String(maxResults),
    singleEvents: "true",
    orderBy: "startTime",
  });

  const nowIso = new Date().toISOString();
  const defaultMin = daysAgoIso(30);
  params.set("timeMin", opts.timeMin ?? defaultMin);
  params.set("timeMax", opts.timeMax ?? nowIso);
  if (opts.pageToken) params.set("pageToken", opts.pageToken);

  const url = `${CALENDAR_BASE}/calendars/${calendarId}/events?${params.toString()}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${opts.accessToken}` },
  });

  if (res.status === 401) {
    throw new TokenExpiredError(url);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "unknown");
    throw new GoogleApiError(res.status, url, text);
  }

  const json = (await res.json()) as {
    items?: GoogleCalendarEvent[];
    nextPageToken?: string;
  };

  return {
    events: json.items ?? [],
    ...(json.nextPageToken !== undefined && {
      nextPageToken: json.nextPageToken,
    }),
  };
}

export async function fetchAllCalendarEvents(
  opts: FetchCalendarOptions,
): Promise<GoogleCalendarEvent[]> {
  const events: GoogleCalendarEvent[] = [];
  let pageToken: string | undefined = opts.pageToken;

  do {
    const page = await fetchCalendarPage({ ...opts, pageToken });
    events.push(...page.events);
    pageToken = page.nextPageToken;
  } while (pageToken);

  return events;
}

function daysAgoIso(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString();
}
