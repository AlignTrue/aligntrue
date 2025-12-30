import React from "react";
import { approvalGateManifest } from "./manifest.js";

export interface ApprovalGateProps {
  request_id: string;
  status: "pending" | "approved" | "rejected";
  reason?: string;
}

export function ApprovalGate({
  request_id,
  status,
  reason,
}: ApprovalGateProps) {
  return (
    <div data-block="approval-gate">
      <strong>Request</strong>: {request_id} — <em>{status}</em>
      {reason ? <div>Reason: {reason}</div> : null}
    </div>
  );
}

export { approvalGateManifest };
