import type { CalendarEventRecord } from "../calendar/google-contracts.js";

export interface TokenSet {
  accessToken: string;
  refreshToken?: string | undefined;
  expiresAt?: number | undefined;
}

export interface CalendarFetchOpts {
  accessToken: string;
  calendarId?: string;
  timeMin?: string;
  timeMax?: string;
  maxResults?: number;
}

export interface CalendarProvider {
  readonly name: string;
  fetchEvents(opts: CalendarFetchOpts): Promise<CalendarEventRecord[]>;
  refreshToken?(token: TokenSet): Promise<TokenSet>;
}
