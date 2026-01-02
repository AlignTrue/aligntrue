export interface CalendarAttendee {
  email?: string;
  display_name?: string;
  response_status?: string;
}

export interface CalendarEventRecord {
  provider: string;
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
