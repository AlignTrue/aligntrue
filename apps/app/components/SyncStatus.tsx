"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import type { SyncStatus as SyncStatusType } from "@/app/api/sync/route";

interface Props {
  initialStatus?: SyncStatusType;
  onStatusChange?: (status: SyncStatusType) => void;
  onSyncComplete?: (status: SyncStatusType) => void;
  registerSync?: (fn: () => Promise<void>) => void;
}

const EMPTY_STATUS: SyncStatusType = {
  state: "idle",
  lastSyncAt: null,
  lastError: null,
  pendingItems: 0,
};

export function SyncStatus({
  initialStatus,
  onStatusChange,
  onSyncComplete,
  registerSync,
}: Props) {
  const [status, setStatus] = useState<SyncStatusType>(
    initialStatus ?? EMPTY_STATUS,
  );
  const [syncing, setSyncing] = useState(false);

  // Fetch current status on mount to reflect server state
  useEffect(() => {
    let cancelled = false;
    async function fetchStatus() {
      try {
        const res = await fetch("/api/sync", { method: "GET" });
        if (!res.ok) return;
        const data = (await res.json()) as SyncStatusType;
        if (!cancelled) {
          setStatus(data);
          onStatusChange?.(data);
        }
      } catch {
        // ignore
      }
    }
    fetchStatus();
    return () => {
      cancelled = true;
    };
  }, [onStatusChange]);

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
        const errText = await res.text().catch(() => "");
        throw new Error(errText || "Sync failed");
      }

      const data = (await res.json()) as SyncStatusType;
      setStatus(data);
      onStatusChange?.(data);
      onSyncComplete?.(data);
    } catch (err) {
      const next: SyncStatusType = {
        ...status,
        state: "error",
        lastError: err instanceof Error ? err.message : "Sync failed",
      };
      setStatus(next);
      onStatusChange?.(next);
    } finally {
      setSyncing(false);
    }
  }, [onStatusChange, onSyncComplete, status]);

  // Allow parent to trigger sync (e.g., for retry from empty state)
  useEffect(() => {
    if (registerSync) {
      registerSync(handleSync);
    }
  }, [handleSync, registerSync]);

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

  const renderStatusLabel = () => {
    const base =
      status.state === "idle"
        ? "Idle"
        : status.state === "syncing"
          ? "Syncing..."
          : status.state === "processing"
            ? "Processing"
            : "Error";
    if (status.lastError && status.state === "error") {
      return `${base}: ${status.lastError}`;
    }
    return base;
  };

  const isError = status.state === "error";

  return (
    <div
      className={`flex items-center gap-3 rounded-md px-2 py-1 ${isError ? "border border-destructive/50 bg-destructive/10" : ""}`}
    >
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
        {isError ? "Retry Sync" : "Sync Now"}
      </Button>

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span>Last: {formatLastSync(status.lastSyncAt)}</span>
        <span className="flex items-center gap-1">
          Status:
          <span
            className={
              isError
                ? "text-destructive"
                : status.state === "syncing"
                  ? "text-yellow-600"
                  : "text-green-600"
            }
          >
            {renderStatusLabel()}
          </span>
        </span>
        {status.pendingItems > 0 && <span>Backlog: {status.pendingItems}</span>}
      </div>
    </div>
  );
}
