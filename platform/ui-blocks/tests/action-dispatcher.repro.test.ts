import { describe, it, expect } from "vitest";
import { ActionDispatcher } from "../src/action-dispatcher.js";
import type { BlockAction, BlockManifest } from "@aligntrue/ui-contracts";

describe("ActionDispatcher Reproduction", () => {
  const manifest: BlockManifest = {
    block_id: "test-block",
    block_type: "test.block",
    manifest_hash: "hash",
    actions: [
      {
        action_type: "test.action",
        payload_schema: {
          type: "object",
          properties: {
            command_type: { type: "string" },
          },
        },
      },
    ],
    ui: {
      component: "TestComponent",
      label: "Test",
    },
  };

  it("should return ok: false if the last handler returns command_envelope: null", async () => {
    const dispatcher = new ActionDispatcher();

    // Register two handlers for the same action type
    dispatcher.registerFromManifest(manifest, "test.action", async (action) => {
      if ((action.payload as any).command_type !== "type1") {
        return { command_envelope: null };
      }
      return { command_envelope: { id: "cmd1" } };
    });

    dispatcher.registerFromManifest(manifest, "test.action", async (action) => {
      if ((action.payload as any).command_type !== "type2") {
        return { command_envelope: null };
      }
      return { command_envelope: { id: "cmd2" } };
    });

    const action: BlockAction = {
      action_id: "act1",
      action_type: "test.action",
      block_instance_id: "inst1",
      block_type: "test.block",
      plan_id: "plan1",
      actor: { actor_id: "actor1" },
      client_sequence: 1,
      idempotency_key: "idem1",
      payload: { command_type: "unmatched" },
    };

    const result = await dispatcher.dispatch(action);

    // This is expected to fail currently based on the bug report
    expect(result.ok).toBe(false);
  });
});
