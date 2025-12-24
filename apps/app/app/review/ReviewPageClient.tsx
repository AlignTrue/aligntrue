"use client";

import { useState, useCallback, useMemo } from "react";
import type { Projections } from "@aligntrue/ops-core";
import { SyncStatus } from "@/components/SyncStatus";
import { ExternalHold } from "@/components/ExternalHold";
import { ReviewList } from "@/components/ReviewList";
import {
  DetailPanel,
  type ReviewItem,
  type ReviewItemType,
} from "@/components/DetailPanel";
import { ReceiptsDrawer } from "@/components/ReceiptsDrawer";
import { TimeAvailability } from "@/components/TimeAvailability";
import { Button } from "@/components/ui/button";

type ConversationSummary = Projections.ConversationSummary;
type ReceiptsProjection = Projections.ReceiptsProjection;

interface Props {
  conversations: ConversationSummary[];
  receiptsProjection: ReceiptsProjection;
  availability: {
    total_free_minutes: number;
    windows: { start: string; end: string; duration_minutes: number }[];
    next_events: {
      title: string;
      start_time?: string;
      end_time?: string;
      attendees?: number;
      event_id?: string;
    }[];
  };
  calendarEnabled: boolean;
}

export function ReviewPageClient({
  conversations,
  receiptsProjection,
  availability,
  calendarEnabled,
}: Props) {
  const [selectedItem, setSelectedItem] = useState<ReviewItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showReceiptsFor, setShowReceiptsFor] = useState<ReviewItem | null>(
    null,
  );
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Transform conversations into review items
  const reviewItems = useMemo((): ReviewItem[] => {
    return conversations.map((conv): ReviewItem => {
      const receipts = receiptsProjection.by_source_ref.get(
        conv.thread_id ?? conv.conversation_id,
      );

      // Determine item type based on status and other factors
      let type: ReviewItemType = "needs_review";
      if (conv.status === "processed") {
        type = "processed";
      } else if (conv.status === "flagged") {
        type = "needs_review";
      } else if (conv.status === "active") {
        type = "draft";
      }

      // Check if any receipt has external side effect
      const hasExternalAction = receipts?.some(
        (r) => r.safety_class === "WRITE_EXTERNAL_SIDE_EFFECT",
      );

      return {
        id: conv.conversation_id,
        type,
        title: conv.subject ?? "(no subject)",
        subtitle: conv.last_sender,
        timestamp: conv.last_message_at,
        conversation: conv,
        receipts,
        safetyClass: hasExternalAction
          ? "WRITE_EXTERNAL_SIDE_EFFECT"
          : "WRITE_INTERNAL",
        assessment:
          type === "needs_review"
            ? {
                rationale: "Requires human review based on conversation status",
                confidence: 0.75,
              }
            : undefined,
      };
    });
  }, [conversations, receiptsProjection]);

  // Group items into sections
  const sections = useMemo(() => {
    const needsReview: ReviewItem[] = [];
    const drafts: ReviewItem[] = [];
    const processed: ReviewItem[] = [];

    for (const item of reviewItems) {
      switch (item.type) {
        case "needs_review":
          needsReview.push(item);
          break;
        case "draft":
          drafts.push(item);
          break;
        case "processed":
          processed.push(item);
          break;
      }
    }

    return [
      {
        id: "needs_review" as const,
        title: "Needs Review",
        items: needsReview,
      },
      { id: "draft" as const, title: "Drafts Ready", items: drafts },
      {
        id: "processed" as const,
        title: `Auto-Processed (${processed.length})`,
        items: processed,
        collapsed: true,
      },
    ];
  }, [reviewItems]);

  const handleSelectItem = useCallback((item: ReviewItem) => {
    setSelectedItem(item);
  }, []);

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(
    (sectionId: ReviewItemType) => {
      const section = sections.find((s) => s.id === sectionId);
      if (!section) return;

      setSelectedIds((prev) => {
        const sectionIds = section.items.map((i) => i.id);
        const allSelected = sectionIds.every((id) => prev.has(id));

        const next = new Set(prev);
        if (allSelected) {
          // Deselect all in section
          for (const id of sectionIds) {
            next.delete(id);
          }
        } else {
          // Select all in section
          for (const id of sectionIds) {
            next.add(id);
          }
        }
        return next;
      });
    },
    [sections],
  );

  const handleAction = useCallback(
    async (
      action: "approve" | "reject" | "snooze" | "reply" | "task" | "receipts",
      item: ReviewItem,
      data?: unknown,
    ) => {
      setActionMessage(null);

      try {
        if (action === "receipts") {
          setShowReceiptsFor(item);
          return;
        }

        if (action === "reply" && data && item.conversation) {
          const { message } = data as { message: string };
          const participant =
            item.conversation.last_sender ??
            item.conversation.participants.find(Boolean) ??
            "recipient@example.com";

          const res = await fetch(
            `/api/conversations/${item.conversation.conversation_id}/reply`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                to: participant,
                subject: item.conversation.subject ?? "(no subject)",
                message,
              }),
            },
          );

          if (!res.ok) {
            throw new Error("Reply failed");
          }

          setActionMessage("Reply sent");
          return;
        }

        if (action === "task" && item.conversation) {
          const res = await fetch(
            `/api/conversations/${item.conversation.conversation_id}/task`,
            { method: "POST" },
          );

          if (!res.ok) {
            throw new Error("Task creation failed");
          }

          const json = await res.json();
          setActionMessage(`Task created: ${json.task_id}`);
          return;
        }

        if (
          (action === "approve" ||
            action === "reject" ||
            action === "snooze") &&
          item.conversation
        ) {
          const toStatus =
            action === "approve"
              ? "processed"
              : action === "reject"
                ? "needs_human"
                : "inbox";

          const res = await fetch(
            `/api/conversations/${item.conversation.conversation_id}/status`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                from_status: mapToEmailStatus(item.conversation.status),
                to_status: toStatus,
                trigger: "human",
                resolution: action === "approve" ? "archived" : undefined,
              }),
            },
          );

          if (!res.ok) {
            throw new Error("Status change failed");
          }

          setActionMessage(
            action === "approve"
              ? "Approved"
              : action === "reject"
                ? "Overridden"
                : "Snoozed",
          );
        }
      } catch (err) {
        setActionMessage(
          `Error: ${err instanceof Error ? err.message : "Action failed"}`,
        );
      }
    },
    [],
  );

  const handleShowReceipts = useCallback((item: ReviewItem) => {
    setShowReceiptsFor(item);
  }, []);

  const handleCloseReceipts = useCallback(() => {
    setShowReceiptsFor(null);
  }, []);

  // Batch actions
  const handleBatchArchive = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    setActionMessage(null);

    try {
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
          return { id, ok: res.ok };
        }),
      );

      const failed = results.filter((r) => !r.ok).length;
      if (failed === 0) {
        setActionMessage(`Archived ${ids.length} items`);
      } else {
        setActionMessage(`Archived ${ids.length - failed}, failed ${failed}`);
      }

      setSelectedIds(new Set());
    } catch (err) {
      setActionMessage(
        `Error: ${err instanceof Error ? err.message : "Batch action failed"}`,
      );
    }
  }, [selectedIds]);

  return (
    <div className="mx-auto max-w-6xl py-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Review</h1>
          <p className="text-sm text-muted-foreground">
            Supervisor console - review AI decisions
          </p>
        </div>
        <div className="flex items-center gap-4">
          <SyncStatus />
          <ExternalHold />
        </div>
      </div>

      {/* Action message */}
      {actionMessage && (
        <div className="mb-4 rounded-md bg-muted px-4 py-2 text-sm">
          {actionMessage}
        </div>
      )}

      {/* Batch action bar */}
      {selectedIds.size > 0 && (
        <div className="mb-4 flex items-center gap-4 rounded-md bg-accent px-4 py-2">
          <span className="text-sm font-medium">
            {selectedIds.size} selected
          </span>
          <Button size="sm" onClick={handleBatchArchive}>
            Archive Selected
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelectedIds(new Set())}
          >
            Clear Selection
          </Button>
        </div>
      )}

      {/* Main content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* List */}
        <div className="lg:col-span-2">
          <ReviewList
            sections={sections}
            selectedItem={selectedItem}
            onSelectItem={handleSelectItem}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onSelectAll={handleSelectAll}
          />
        </div>

        {/* Detail Panel + Sidebar */}
        <div className="space-y-4">
          {/* Detail Panel */}
          <div className="rounded-lg border bg-card">
            <DetailPanel
              item={selectedItem}
              onAction={handleAction}
              onShowReceipts={handleShowReceipts}
            />
          </div>

          {/* Time Availability */}
          <div>
            <h2 className="mb-2 text-sm font-medium">Time</h2>
            <TimeAvailability
              totalFreeMinutes={availability.total_free_minutes}
              windows={availability.windows}
              nextEvents={availability.next_events}
            />
            {!calendarEnabled && (
              <p className="mt-2 text-xs text-muted-foreground">
                Calendar connector disabled; availability may be empty.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Receipts Drawer */}
      {showReceiptsFor && (
        <ReceiptsDrawer
          sourceRef={
            showReceiptsFor.conversation?.thread_id ??
            showReceiptsFor.conversation?.conversation_id ??
            showReceiptsFor.id
          }
          receipts={showReceiptsFor.receipts ?? []}
          onClose={handleCloseReceipts}
        />
      )}
    </div>
  );
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
