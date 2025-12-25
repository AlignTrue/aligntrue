"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Projections } from "@aligntrue/ops-core";
import { formatTimestamp } from "@/lib/format";

type Receipt = Projections.Receipt;

interface Props {
  sourceRef: string;
  receipts: Receipt[];
  onClose: () => void;
}

export function ReceiptsDrawer({ sourceRef, receipts, onClose }: Props) {
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(
    receipts[0] ?? null,
  );
  const drawerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside the drawer
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        drawerRef.current &&
        !drawerRef.current.contains(e.target as Node | null)
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  const getSafetyClassBadge = (safetyClass: string) => {
    switch (safetyClass) {
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
        return <Badge variant="outline">{safetyClass}</Badge>;
    }
  };

  return (
    <div
      ref={drawerRef}
      className="fixed inset-y-0 right-0 z-50 w-96 border-l bg-card shadow-lg"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h3 className="font-semibold">Receipts</h3>
          <p className="text-xs text-muted-foreground">{sourceRef}</p>
        </div>
        <Button size="sm" variant="ghost" onClick={onClose}>
          ✕
        </Button>
      </div>

      {/* Receipt List */}
      {receipts.length === 0 ? (
        <div className="p-4 text-sm text-muted-foreground">
          No receipts for this item.
        </div>
      ) : (
        <div className="flex h-[calc(100vh-60px)] flex-col">
          {/* Receipt selector (if multiple) */}
          {receipts.length > 1 && (
            <div className="border-b p-2">
              <div className="flex gap-1 overflow-x-auto">
                {receipts.map((r, idx) => (
                  <Button
                    key={r.receipt_id}
                    size="sm"
                    variant={
                      selectedReceipt?.receipt_id === r.receipt_id
                        ? "default"
                        : "ghost"
                    }
                    onClick={() => setSelectedReceipt(r)}
                    className="text-xs"
                  >
                    {r.kind} #{idx + 1}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Selected Receipt Details */}
          {selectedReceipt && (
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-4 text-sm">
                {/* What changed */}
                <section>
                  <h4 className="mb-2 font-medium text-foreground">
                    What changed
                  </h4>
                  <div className="space-y-1 rounded bg-muted/50 p-2">
                    {selectedReceipt.diff.map((d, idx) => (
                      <div key={idx} className="font-mono text-xs">
                        <span className="text-muted-foreground">
                          {d.field}:
                        </span>{" "}
                        {d.from && (
                          <>
                            <span className="text-red-600">{d.from}</span>
                            {" → "}
                          </>
                        )}
                        <span className="text-green-600">{d.to}</span>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Why */}
                {(selectedReceipt.rationale || selectedReceipt.confidence) && (
                  <section>
                    <h4 className="mb-2 font-medium text-foreground">Why</h4>
                    <div className="rounded bg-muted/50 p-2">
                      {selectedReceipt.rationale && (
                        <p className="text-muted-foreground">
                          "{selectedReceipt.rationale}"
                        </p>
                      )}
                      {selectedReceipt.confidence !== undefined && (
                        <p className="mt-1 text-xs">
                          Confidence:{" "}
                          <span className="font-medium">
                            {(selectedReceipt.confidence * 100).toFixed(0)}%
                          </span>
                        </p>
                      )}
                    </div>
                  </section>
                )}

                {/* What AI looked at */}
                {(selectedReceipt.query_artifact_id ||
                  selectedReceipt.context_refs?.length) && (
                  <section>
                    <h4 className="mb-2 font-medium text-foreground">
                      What AI looked at
                    </h4>
                    <div className="rounded bg-muted/50 p-2 text-xs">
                      {selectedReceipt.query_artifact_id && (
                        <p>
                          Query artifact:{" "}
                          <code className="rounded bg-muted px-1">
                            {selectedReceipt.query_artifact_id}
                          </code>
                        </p>
                      )}
                      {selectedReceipt.context_refs?.map((ref, idx) => (
                        <p key={idx}>• {ref}</p>
                      ))}
                    </div>
                  </section>
                )}

                {/* Who acted */}
                <section>
                  <h4 className="mb-2 font-medium text-foreground">
                    Who acted
                  </h4>
                  <div className="rounded bg-muted/50 p-2 text-xs">
                    <p>
                      Actor:{" "}
                      <code className="rounded bg-muted px-1">
                        {selectedReceipt.actor_type}:{selectedReceipt.actor_id}
                      </code>
                    </p>
                    {selectedReceipt.capability && (
                      <p>Capability: {selectedReceipt.capability}</p>
                    )}
                  </div>
                </section>

                {/* Safety class */}
                <section>
                  <h4 className="mb-2 font-medium text-foreground">
                    Safety class
                  </h4>
                  <div className="flex items-center gap-2">
                    {getSafetyClassBadge(selectedReceipt.safety_class)}
                    {selectedReceipt.operation && (
                      <span className="text-xs text-muted-foreground">
                        {selectedReceipt.operation}
                      </span>
                    )}
                  </div>
                </section>

                {/* Timing */}
                <section>
                  <h4 className="mb-2 font-medium text-foreground">Timing</h4>
                  <div className="space-y-1 rounded bg-muted/50 p-2 text-xs">
                    <p>
                      <span className="text-muted-foreground">
                        occurred_at:
                      </span>{" "}
                      {formatTimestamp(selectedReceipt.occurred_at)}
                    </p>
                    <p>
                      <span className="text-muted-foreground">
                        ingested_at:
                      </span>{" "}
                      {formatTimestamp(selectedReceipt.ingested_at)}
                    </p>
                    {selectedReceipt.processed_at && (
                      <p>
                        <span className="text-muted-foreground">
                          processed_at:
                        </span>{" "}
                        {formatTimestamp(selectedReceipt.processed_at)}
                      </p>
                    )}
                  </div>
                </section>

                {/* External action details */}
                {selectedReceipt.destination_ref && (
                  <section>
                    <h4 className="mb-2 font-medium text-foreground">
                      External action
                    </h4>
                    <div className="rounded bg-muted/50 p-2 text-xs">
                      <p>
                        Destination:{" "}
                        <code className="rounded bg-muted px-1">
                          {selectedReceipt.destination_ref}
                        </code>
                      </p>
                      {selectedReceipt.approved !== undefined && (
                        <p>
                          Status:{" "}
                          <span
                            className={
                              selectedReceipt.approved
                                ? "text-green-600"
                                : "text-red-600"
                            }
                          >
                            {selectedReceipt.approved ? "Approved" : "Rejected"}
                          </span>
                        </p>
                      )}
                      {selectedReceipt.reason && (
                        <p>Reason: {selectedReceipt.reason}</p>
                      )}
                    </div>
                  </section>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
