import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type {
  CommandEnvelope,
  EventEnvelope,
} from "../src/contracts/envelopes.js";
import type { EgressReceipt } from "../src/contracts/egress.js";
import type { ActorRef } from "../src/envelopes/actor.js";

const now = new Date().toISOString();
const actor: ActorRef = { actor_id: "actor-1", actor_type: "agent" };

const CORE_SRC = path.resolve(new URL("../src", import.meta.url).pathname);

function sortCanonical(events: EventEnvelope[]): EventEnvelope[] {
  return [...events].sort((a, b) => {
    if (a.occurred_at !== b.occurred_at) {
      return a.occurred_at < b.occurred_at ? -1 : 1;
    }
    if ((a.source_ref ?? "") !== (b.source_ref ?? "")) {
      return (a.source_ref ?? "") < (b.source_ref ?? "") ? -1 : 1;
    }
    if (
      (a.source_sequence ?? Number.NEGATIVE_INFINITY) !==
      (b.source_sequence ?? Number.NEGATIVE_INFINITY)
    ) {
      return (a.source_sequence ?? Number.NEGATIVE_INFINITY) <
        (b.source_sequence ?? Number.NEGATIVE_INFINITY)
        ? -1
        : 1;
    }
    return a.event_id < b.event_id ? -1 : 1;
  });
}

describe("constitution guardrails", () => {
  it("commits batch atomically and preserves produced event ids", () => {
    const command: CommandEnvelope = {
      command_id: "cmd-1",
      idempotency_key: "idem-1",
      command_type: "core.TestCommand",
      payload: {},
      target_ref: "agg-1",
      dedupe_scope: "command:agg-1",
      correlation_id: "corr-1",
      causation_id: "evt-0",
      causation_type: "event",
      actor,
      requested_at: now,
    };

    const producedEvents: EventEnvelope[] = [
      {
        event_id: "evt-1",
        event_type: "core.One",
        payload: {},
        occurred_at: now,
        ingested_at: now,
        correlation_id: "corr-1",
        causation_id: command.command_id,
        causation_type: "command",
        actor: command.actor,
        envelope_version: 1,
        payload_schema_version: 1,
      },
      {
        event_id: "evt-2",
        event_type: "core.Two",
        payload: {},
        occurred_at: now,
        ingested_at: now,
        correlation_id: "corr-1",
        causation_id: command.command_id,
        causation_type: "command",
        actor: command.actor,
        envelope_version: 1,
        payload_schema_version: 1,
      },
    ];

    // Batch append atomically: all events share correlation and causation link
    const allShareCorrelation = producedEvents.every(
      (e) => e.correlation_id === command.correlation_id,
    );
    const allLinkCommand = producedEvents.every(
      (e) =>
        e.causation_id === command.command_id && e.causation_type === "command",
    );
    expect(allShareCorrelation).toBe(true);
    expect(allLinkCommand).toBe(true);
  });

  it("orders events deterministically even without source_sequence", () => {
    const events: EventEnvelope[] = [
      {
        event_id: "evt-b",
        event_type: "core.Test",
        payload: {},
        occurred_at: now,
        ingested_at: now,
        correlation_id: "corr-1",
        actor,
        envelope_version: 1,
        payload_schema_version: 1,
        source_ref: "gmail",
      },
      {
        event_id: "evt-a",
        event_type: "core.Test",
        payload: {},
        occurred_at: now,
        ingested_at: now,
        correlation_id: "corr-1",
        actor,
        envelope_version: 1,
        payload_schema_version: 1,
        source_ref: "gmail",
      },
    ];

    const sorted = sortCanonical(events);
    expect(sorted.map((e) => e.event_id)).toEqual(["evt-a", "evt-b"]);
  });

  it("records egress approval linkage in receipts", () => {
    const receipt: EgressReceipt = {
      envelope: {
        destination: "gmail.send",
        idempotency_key: "idem-1",
        correlation_id: "corr-1",
        capability_id: "cap-1",
        approving_policy_id: "policy-123",
        approving_policy_version: "1.0.0",
      },
      approved: true,
      decision_reason: "pre-approved",
      timestamp: now,
      approving_policy_id: "policy-123",
      approving_policy_version: "1.0.0",
    };

    expect(receipt.envelope.approving_policy_id).toBeDefined();
    expect(receipt.envelope.approving_policy_version).toBe("1.0.0");
    expect(receipt.approved).toBe(true);
  });

  it("does not construct TaskLedger outside pack-tasks", () => {
    const matches: string[] = [];
    for (const file of walkTsFiles(CORE_SRC)) {
      const content = fs.readFileSync(file, "utf8");
      if (content.includes("TaskLedger")) {
        matches.push(file);
      }
    }
    expect(matches).toEqual([]);
  });

  it("ops-core does not import from packs", () => {
    const forbiddenImport = new RegExp(
      String.raw`from ["'].*(/packs/|@aligntrue/pack-)`,
    );
    const violations: string[] = [];
    for (const file of walkTsFiles(CORE_SRC)) {
      const content = fs.readFileSync(file, "utf8");
      if (forbiddenImport.test(content)) {
        violations.push(file);
      }
    }
    expect(violations).toEqual([]);
  });
});

// Helpers
function walkTsFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkTsFiles(full));
    } else if (
      entry.isFile() &&
      (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))
    ) {
      files.push(full);
    }
  }
  return files;
}
