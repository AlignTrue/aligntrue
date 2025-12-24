"use client";

import { useMemo, useState } from "react";
import type { Projections } from "@aligntrue/ops-core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Conversation = Projections.ConversationSummary;

interface Props {
  conversations: Conversation[];
}

export function TriageView({ conversations }: Props) {
  const [index, setIndex] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const safeIndex = useMemo(
    () => Math.min(Math.max(index, 0), Math.max(0, conversations.length - 1)),
    [conversations.length, index],
  );

  const current = useMemo(
    () => conversations.at(safeIndex),
    [conversations, safeIndex],
  );
  if (!current) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          Nothing to triage.
        </CardContent>
      </Card>
    );
  }

  const participant =
    current.participants.find(Boolean) ?? "recipient@example.com";

  async function doAction(
    action: "reply" | "archive" | "flag" | "task",
  ): Promise<void> {
    setSubmitting(true);
    setMessage(null);
    try {
      if (action === "reply") {
        const res = await fetch(
          `/api/conversations/${current.conversation_id}/reply`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: participant,
              subject: current.subject ?? "(no subject)",
              message: replyText,
            }),
          },
        );
        if (!res.ok) throw new Error("Send failed");
        setReplyText("");
      } else if (action === "archive") {
        const res = await fetch(
          `/api/conversations/${current.conversation_id}/status`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              from_status: current.status,
              to_status: "processed",
              trigger: "human",
              resolution: "archived",
            }),
          },
        );
        if (!res.ok) throw new Error("Archive failed");
      } else if (action === "flag") {
        const res = await fetch(
          `/api/conversations/${current.conversation_id}/status`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              from_status: current.status,
              to_status: "flagged",
              trigger: "human",
            }),
          },
        );
        if (!res.ok) throw new Error("Flag failed");
      } else if (action === "task") {
        const res = await fetch(
          `/api/conversations/${current.conversation_id}/task`,
          {
            method: "POST",
          },
        );
        if (!res.ok) throw new Error("Task creation failed");
      }
      setMessage("Recorded");
      setIndex((i) => Math.min(conversations.length - 1, i + 1));
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
          <CardTitle className="text-base">
            {current.subject ?? "(no subject)"}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {participant} · {current.last_message_at}
          </p>
        </div>
        <span className="text-xs text-muted-foreground">
          {index + 1} of {conversations.length}
        </span>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => doAction("reply")}
            disabled={submitting || !replyText}
          >
            Reply
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => doAction("archive")}
            disabled={submitting}
          >
            Archive
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => doAction("flag")}
            disabled={submitting}
          >
            Flag
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => doAction("task")}
            disabled={submitting}
          >
            → Task
          </Button>
        </div>
        <Textarea
          placeholder="Reply (plain text)"
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
        />
        {message ? (
          <p className="text-xs text-muted-foreground">{message}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
