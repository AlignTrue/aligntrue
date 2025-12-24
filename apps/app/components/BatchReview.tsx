"use client";

import { useEffect, useMemo, useState } from "react";
import type { Projections } from "@aligntrue/ops-core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

type Conversation = Projections.ConversationSummary;

interface Props {
  conversations: Conversation[];
}

export function BatchReview({ conversations }: Props) {
  const archivable = useMemo(
    () => conversations.filter((c) => c.status === "inbox"),
    [conversations],
  );
  const archivableIds = useMemo(
    () => new Set(archivable.map((c) => c.conversation_id)),
    [archivable],
  );
  const [selected, setSelected] = useState(
    () => new Set(archivable.map((c) => c.conversation_id)),
  );

  // Keep selection in sync when the archivable list changes (e.g., after refresh)
  useEffect(() => {
    setSelected((prev) => {
      // Drop items no longer archivable but keep manual deselections intact.
      const next = new Set<string>();
      for (const id of prev) {
        if (archivableIds.has(id)) next.add(id);
      }
      return next;
    });
  }, [archivableIds]);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (archivable.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          No archivable items.
        </CardContent>
      </Card>
    );
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function archiveSelected() {
    setSubmitting(true);
    setMessage(null);
    try {
      const ids = Array.from(selected);
      const results = await Promise.all(
        ids.map(async (id) => {
          const res = await fetch(`/api/conversations/${id}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              from_status: "inbox",
              to_status: "processed",
              trigger: "human",
              resolution: "archived",
            }),
          });
          return { id, ok: res.ok, status: res.status };
        }),
      );

      const failed = results.filter((r) => !r.ok);
      if (failed.length === 0) {
        setMessage(`Archived ${ids.length} conversations`);
      } else if (failed.length === ids.length) {
        setMessage(
          `Archive failed for ${failed.length} conversation(s); check server logs.`,
        );
      } else {
        setMessage(
          `Archived ${ids.length - failed.length}, failed ${failed.length}; check server logs.`,
        );
      }
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Batch Review</CardTitle>
          <p className="text-xs text-muted-foreground">
            AI-confident items (inbox → archive)
          </p>
        </div>
        <span className="text-xs text-muted-foreground">
          {selected.size} selected
        </span>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          {archivable.map((c) => (
            <label
              key={c.conversation_id}
              className="flex items-center gap-2 text-sm"
            >
              <Checkbox
                checked={selected.has(c.conversation_id)}
                onCheckedChange={() => toggle(c.conversation_id)}
              />
              <span className="flex-1">
                {c.subject} — {c.last_message_snippet ?? ""}
              </span>
            </label>
          ))}
        </div>
        <Button
          size="sm"
          onClick={archiveSelected}
          disabled={submitting || selected.size === 0}
        >
          Archive {selected.size} Selected
        </Button>
        {message ? (
          <p className="text-xs text-muted-foreground">{message}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
