import type {
  CalendarFetchOpts,
  CalendarProvider,
} from "../../providers/calendar.js";
import { registerCalendarProvider } from "../../providers/registry.js";
import { refreshAccessToken, type TokenSet } from "../google-common/token.js";
import { fetchAllCalendarEvents } from "./fetch.js";
import { transformCalendarEvents } from "./transform.js";

export class GoogleCalendarProvider implements CalendarProvider {
  readonly name = "google_calendar";

  async fetchEvents(opts: CalendarFetchOpts) {
    const raw = await fetchAllCalendarEvents(opts);
    return transformCalendarEvents(raw);
  }

  async refreshToken(token: TokenSet) {
    if (!token.refreshToken) {
      throw new Error("No refresh token provided for Google Calendar");
    }
    return refreshAccessToken({
      refreshToken: token.refreshToken,
      clientId: process.env["GOOGLE_CLIENT_ID"] ?? "",
      clientSecret: process.env["GOOGLE_CLIENT_SECRET"] ?? "",
    });
  }
}

// Auto-register on import
registerCalendarProvider("google_calendar", new GoogleCalendarProvider());
