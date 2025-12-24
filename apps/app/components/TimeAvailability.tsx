"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  totalFreeMinutes: number;
  windows: { start: string; end: string; duration_minutes: number }[];
  nextEvents: {
    title: string;
    start_time?: string;
    end_time?: string;
    attendees?: number;
    event_id?: string;
  }[];
}

export function TimeAvailability({
  totalFreeMinutes,
  windows,
  nextEvents,
}: Props) {
  const freeHours = Math.floor(totalFreeMinutes / 60);
  const freeMinutes = totalFreeMinutes % 60;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Free: {freeHours}h {freeMinutes}m
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <div className="space-y-1">
          <p className="font-medium text-foreground">Next events</p>
          {nextEvents.length === 0 ? (
            <p>No upcoming events</p>
          ) : (
            nextEvents.map((ev) => (
              <div key={ev.event_id ?? `${ev.title}-${ev.start_time ?? ""}`}>
                <span className="font-medium">{ev.start_time ?? "TBD"}</span>{" "}
                {ev.title}{" "}
                {ev.attendees !== undefined ? `(${ev.attendees})` : null}
              </div>
            ))
          )}
        </div>
        <div className="space-y-1">
          <p className="font-medium text-foreground">Free windows</p>
          {windows.length === 0 ? (
            <p>No free time today</p>
          ) : (
            windows.map((w) => (
              <div key={`${w.start}-${w.end}`}>
                {w.start} → {w.end} ({w.duration_minutes}m)
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
