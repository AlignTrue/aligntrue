"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import type { Projections } from "@aligntrue/ops-core";

type ConversationSummary = Projections.ConversationSummary;
type Receipt = Projections.Receipt;

export type ReviewItemType =
  | "exception"
  | "needs_review"
  | "draft"
  | "processed";

export interface ReviewItem {
  id: string;
  type: ReviewItemType;
  title: string;
  subtitle?: string;
  timestamp: string;
  conversation?: ConversationSummary;
  receipts?: Receipt[];
  assessment?: {
    rationale: string;
    confidence: number;
  };
  draft?: {
    to: string;
    subject: string;
    body: string;
  };
  exception?: {
    error: string;
    canRetry: boolean;
  };
  safetyClass?: "READ" | "WRITE_INTERNAL" | "WRITE_EXTERNAL_SIDE_EFFECT";
}

interface Props {
  item: ReviewItem | null;
  onAction: (
    action: "approve" | "reject" | "snooze" | "reply" | "task" | "receipts",
    item: ReviewItem,
    data?: unknown,
  ) => void;
  onShowReceipts: (item: ReviewItem) => void;
}

export function DetailPanel({ item, onAction, onShowReceipts }: Props) {
  const [replyText, setReplyText] = useState("");
  const [showReplyInput, setShowReplyInput] = useState(false);

  if (!item) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Select an item to view details
      </div>
    );
  }

  const getSafetyBadge = () => {
    if (!item.safetyClass) return null;
    switch (item.safetyClass) {
      case "WRITE_EXTERNAL_SIDE_EFFECT":
        return (
          <Badge className="bg-amber-100 text-amber-800">
            ⚠️ WRITE_EXTERNAL
          </Badge>
        );
      case "WRITE_INTERNAL":
        return <Badge variant="secondary">WRITE_INTERNAL</Badge>;
      case "READ":
        return <Badge variant="outline">READ</Badge>;
      default:
        return null;
    }
  };

  const getTypeBadge = () => {
    switch (item.type) {
      case "exception":
        return <Badge variant="destructive">Exception</Badge>;
      case "needs_review":
        return <Badge variant="secondary">Needs Review</Badge>;
      case "draft":
        return <Badge className="bg-blue-100 text-blue-800">Draft Ready</Badge>;
      case "processed":
        return <Badge variant="outline">Processed</Badge>;
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h3 className="font-semibold">{item.title}</h3>
            {item.subtitle && (
              <p className="text-sm text-muted-foreground">{item.subtitle}</p>
            )}
            <p className="text-xs text-muted-foreground">{item.timestamp}</p>
          </div>
          <div className="flex gap-2">
            {getTypeBadge()}
            {getSafetyBadge()}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Assessment (for needs_review items) */}
        {item.assessment && (
          <div className="mb-4 rounded-lg bg-muted/50 p-3">
            <p className="text-sm font-medium">AI Assessment</p>
            <p className="mt-1 text-sm text-muted-foreground">
              "{item.assessment.rationale}"
            </p>
            <p className="mt-1 text-xs">
              Confidence:{" "}
              <span className="font-medium">
                {(item.assessment.confidence * 100).toFixed(0)}%
              </span>
            </p>
          </div>
        )}

        {/* Exception details */}
        {item.exception && (
          <div className="mb-4 rounded-lg bg-destructive/10 p-3">
            <p className="text-sm font-medium text-destructive">Error</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {item.exception.error}
            </p>
          </div>
        )}

        {/* Draft preview */}
        {item.draft && (
          <div className="mb-4 space-y-2">
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">
                To: {item.draft.to}
              </p>
              <p className="text-xs text-muted-foreground">
                Subject: {item.draft.subject}
              </p>
              <div className="mt-2 whitespace-pre-wrap text-sm">
                {item.draft.body}
              </div>
            </div>
          </div>
        )}

        {/* Conversation snippet */}
        {item.conversation?.last_message_snippet && (
          <div className="mb-4">
            <p className="text-sm text-muted-foreground">
              {item.conversation.last_message_snippet}
            </p>
          </div>
        )}

        {/* Reply input */}
        {showReplyInput && (
          <div className="mb-4 space-y-2">
            <Textarea
              placeholder="Type your reply..."
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              rows={4}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  onAction("reply", item, { message: replyText });
                  setReplyText("");
                  setShowReplyInput(false);
                }}
                disabled={!replyText.trim()}
              >
                Send
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setShowReplyInput(false);
                  setReplyText("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Actions Footer */}
      <div className="border-t p-4">
        <div className="flex flex-wrap gap-2">
          {/* Primary actions based on type */}
          {item.type === "exception" && item.exception?.canRetry && (
            <Button size="sm" onClick={() => onAction("approve", item)}>
              Retry
            </Button>
          )}

          {item.type === "needs_review" && (
            <>
              <Button size="sm" onClick={() => onAction("approve", item)}>
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onAction("reject", item)}
              >
                Override
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onAction("snooze", item)}
              >
                Snooze
              </Button>
            </>
          )}

          {item.type === "draft" && (
            <>
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700"
                onClick={() => onAction("approve", item)}
              >
                Send
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowReplyInput(true)}
              >
                Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onAction("reject", item)}
              >
                Discard
              </Button>
            </>
          )}

          {item.type === "processed" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onAction("reject", item)}
            >
              Undo
            </Button>
          )}

          {/* Common actions */}
          {!showReplyInput && item.type !== "draft" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowReplyInput(true)}
            >
              Reply
            </Button>
          )}

          <Button
            size="sm"
            variant="ghost"
            onClick={() => onAction("task", item)}
          >
            → Task
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => onShowReceipts(item)}
          >
            Receipts
          </Button>
        </div>
      </div>
    </div>
  );
}
