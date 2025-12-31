"use client";

import { useState } from "react";

export function ActionTester({
  planId,
  actorId: _actorId,
}: {
  planId: string;
  actorId: string;
}) {
  const [status, setStatus] = useState<string | null>(null);

  // Generate stable IDs to support deduplication testing across multiple clicks/retries
  const [actionId] = useState(() => crypto.randomUUID());
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [correlationId] = useState(() => crypto.randomUUID());

  const sendAction = async () => {
    setStatus("sending");
    const stateRes = await fetch("/api/ui/state?plan_id=" + planId, {
      cache: "no-store",
    });
    const stateJson = await stateRes.json();
    const latestVersion = stateJson.state?.version ?? 0;

    const action = {
      action_id: actionId,
      idempotency_key: idempotencyKey,
      action_type: "entity_table.row_selected",
      block_instance_id: "entity-table-main",
      block_type: "block.EntityTable",
      payload: { row_id: "1" },
      plan_id: planId,
      client_sequence: Date.now(),
      expected_state_version: latestVersion,
      correlation_id: correlationId,
    };

    const res = await fetch("/api/ui/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(action),
    });
    const json = await res.json();
    setStatus(
      `${json.status ?? res.status} (state_version=${json.state_version ?? "-"})`,
    );
  };

  return (
    <div className="my-4">
      <button
        type="button"
        className="rounded border px-3 py-1 text-sm"
        onClick={sendAction}
      >
        Select first row (action test)
      </button>
      {status ? (
        <div className="text-xs text-muted-foreground mt-1">
          Status: {status}
        </div>
      ) : null}
    </div>
  );
}
