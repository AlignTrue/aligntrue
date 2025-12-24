"use client";

import { useState } from "react";
import type { Projections } from "@aligntrue/ops-core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

type Conversation = Projections.ConversationSummary;

interface Props {
  conversations: Conversation[];
}

export function ConversationQueue({ conversations }: Props) {
  if (conversations.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          No conversations yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {conversations.map((conv) => (
        <ConversationRow key={conv.conversation_id} conversation={conv} />
      ))}
    </div>
  );
}

function ConversationRow({ conversation }: { conversation: Conversation }) {
  const [expanded, setExpanded] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const primary =
    conversation.status === "inbox"
      ? "archive"
      : conversation.status === "flagged"
        ? "reply"
        : "archive";

  const participant =
    conversation.participants.find(Boolean) ?? "recipient@example.com";

  async function doReply() {
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/conversations/${conversation.conversation_id}/reply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: participant,
            subject: conversation.subject ?? "(no subject)",
            message: replyText,
          }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Send failed");
      }
      setReplyText("");
      setMessage("Reply sent");
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  function mapToEmailStatus(
    status: Projections.ConversationStatus,
  ): "inbox" | "ai_todo" | "needs_human" | "processed" {
    switch (status) {
      case "flagged":
        return "needs_human";
      case "active":
        return "ai_todo";
      case "processed":
        return "processed";
      case "inbox":
      default:
        return "inbox";
    }
  }

  async function changeStatus(to_status: Projections.ConversationStatus) {
    setMessage(null);
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/conversations/${conversation.conversation_id}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            from_status: mapToEmailStatus(conversation.status),
            to_status: mapToEmailStatus(to_status),
            trigger: "human",
            resolution:
              mapToEmailStatus(to_status) === "processed"
                ? "archived"
                : undefined,
          }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Status change failed");
      }
      setMessage("Action recorded");
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function convertToTask() {
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/conversations/${conversation.conversation_id}/task`,
        { method: "POST" },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Task conversion failed");
      }
      const json = await res.json();
      setMessage(`Task created: ${json.task_id}`);
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-base">{conversation.subject}</CardTitle>
          <p className="text-xs text-muted-foreground">
            {participant} · {conversation.last_message_at}
          </p>
        </div>
        <Badge variant="secondary">{conversation.status}</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              changeStatus(primary === "archive" ? "processed" : "flagged")
            }
            disabled={submitting}
          >
            {primary === "archive" ? "Archive" : "Flag"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setExpanded((v) => !v)}
          >
            Reply
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={convertToTask}
            disabled={submitting}
          >
            → Task
          </Button>
        </div>
        {expanded ? (
          <div className="space-y-2">
            <Textarea
              placeholder="Reply (plain text)"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
            />
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={doReply}
                disabled={submitting || !replyText}
              >
                Send
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setExpanded(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
        {message ? (
          <p className="text-xs text-muted-foreground">{message}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
