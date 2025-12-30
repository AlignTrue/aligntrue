import React from "react";
import { receiptTimelineManifest } from "./manifest.js";

export interface ReceiptItem {
  id: string;
  occurred_at: string;
  summary: string;
}

export interface ReceiptTimelineProps {
  receipts: ReceiptItem[];
}

export function ReceiptTimeline({ receipts }: ReceiptTimelineProps) {
  return (
    <div data-block="receipt-timeline">
      <ul>
        {receipts.map((r) => (
          <li key={r.id}>
            {r.occurred_at}: {r.summary}
          </li>
        ))}
      </ul>
    </div>
  );
}

export { receiptTimelineManifest };
