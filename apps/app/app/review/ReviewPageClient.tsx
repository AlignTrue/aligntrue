"use client";

import React from "react";
import type * as Projections from "@aligntrue/ops-core/projections";

interface NextEvent {
  title: string;
  start_time?: string;
  end_time?: string;
  attendees: number;
  event_id: string;
}

interface ReviewPageClientProps {
  conversations: Projections.ConversationSummary[];
  receiptsProjection: Projections.ReceiptsProjection;
  availability: {
    total_free_minutes: number;
    windows: Projections.FreeWindow[];
    next_events: NextEvent[];
  };
  calendarEnabled: boolean;
}

export function ReviewPageClient({
  conversations,
  receiptsProjection: _receiptsProjection,
  availability,
  calendarEnabled,
}: ReviewPageClientProps) {
  return (
    <div className="mx-auto max-w-5xl space-y-6 py-8">
      <h1 className="text-2xl font-bold px-4">Review Console</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 px-4">
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">
            Conversations ({conversations.length})
          </h2>
          {/* List conversations here */}
        </div>
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Availability</h2>
          {calendarEnabled ? (
            <p>Free minutes today: {availability.total_free_minutes}</p>
          ) : (
            <p>Calendar integration disabled.</p>
          )}
        </div>
      </div>
    </div>
  );
}
