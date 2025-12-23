import type { TokenSet } from "../connectors/google-common/token.js";
import type { CalendarEventRecord } from "../connectors/google-calendar/types.js";

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
