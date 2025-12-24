"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import type { SyncStatus as SyncStatusType } from "@/app/api/sync/route";

interface Props {
  initialStatus?: SyncStatusType;
}

export function SyncStatus({ initialStatus }: Props) {
  const [status, setStatus] = useState<SyncStatusType>(
    initialStatus ?? {
      state: "idle",
      lastSyncAt: null,
      lastError: null,
      pendingItems: 0,
    },
  );
  const [syncing, setSyncing] = useState(false);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    setStatus((s) => ({ ...s, state: "syncing" }));

    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: 7 }),
      });

      if (!res.ok) {
        throw new Error("Sync failed");
      }

      const data = (await res.json()) as SyncStatusType;
      setStatus(data);
    } catch (err) {
      setStatus((s) => ({
        ...s,
        state: "error",
        lastError: err instanceof Error ? err.message : "Sync failed",
      }));
    } finally {
      setSyncing(false);
    }
  }, []);

  const formatLastSync = (timestamp: string | null) => {
    if (!timestamp) return "Never";
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="flex items-center gap-3">
      <Button
        size="sm"
        variant="outline"
        onClick={handleSync}
        disabled={syncing}
        className="gap-2"
      >
        {syncing ? (
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          <svg
            className="h-3 w-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        )}
        Sync Now
      </Button>

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span>Last: {formatLastSync(status.lastSyncAt)}</span>
        <span className="flex items-center gap-1">
          Status:{" "}
          <span
            className={
              status.state === "error"
                ? "text-destructive"
                : status.state === "syncing"
                  ? "text-yellow-600"
                  : "text-green-600"
            }
          >
            {status.state === "idle"
              ? "Idle"
              : status.state === "syncing"
                ? "Syncing..."
                : status.state === "error"
                  ? "Error"
                  : status.state}
          </span>
        </span>
        {status.pendingItems > 0 && <span>Backlog: {status.pendingItems}</span>}
        {status.lastError && (
          <span className="text-destructive" title={status.lastError}>
            Error
          </span>
        )}
      </div>
    </div>
  );
}
