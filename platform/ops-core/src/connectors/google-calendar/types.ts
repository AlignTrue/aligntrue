export interface CalendarAttendee {
  email: string;
  response_status?: string;
}

export interface CalendarEventRecord {
  provider: "google_calendar";
  calendar_id: string;
  event_id: string;
  updated: string;
  title: string;
  description?: string;
  start_time: string;
  end_time?: string;
  organizer?: string;
  location?: string;
  attendees?: CalendarAttendee[];
}

export interface CalendarCursorState {
  cursor: string | null;
  lastSyncedAt?: string;
}
