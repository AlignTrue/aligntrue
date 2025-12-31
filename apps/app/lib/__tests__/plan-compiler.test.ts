import { describe, expect, test } from "vitest";
import { hashCanonical } from "@aligntrue/ops-core";
import {
  type LayoutIntent,
  type LayoutIntentCore,
  toLayoutIntentCore,
} from "@aligntrue/ui-contracts";
import {
  compilePlan,
  CompilerError,
  type CompilerPolicy,
} from "../plan-compiler";
import { computeIdempotencyKey } from "../plan-receipt-builder";
import type { UIContext } from "../ui-context";

function buildTestContext(): UIContext {
  return {
    tasks: { items: [], counts: {} },
    notes: { items: [] },
    intent: "list",
    scope: "today",
    context_hash: "test-context-hash",
  };
}

function buildTestPolicy(): CompilerPolicy {
  return {
    policy_id: "test-policy",
    version: "0.0.1",
    policy_hash: "test-policy-hash",
    required_surfaces_by_intent: {
      list: ["tasks_list", "notes_list"],
    },
    default_layout: "single",
    surface_to_block: {
      tasks_list: {
        block_type: "block.TaskList",
        version: "0.0.1",
        manifest_hash: "tasklist-hash",
        slot: "main",
        default_props: { title: "Tasks" },
      },
      notes_list: {
        block_type: "block.NoteList",
        version: "0.0.1",
        manifest_hash: "notelist-hash",
        slot: "main",
        default_props: { title: "Notes" },
      },
    },
  };
}

function buildAllowlists() {
  return {
    allowed_manifest_hashes: new Set(["tasklist-hash", "notelist-hash"]),
    allowed_block_types: new Set(["block.TaskList", "block.NoteList"]),
  };
}

function buildPolicyWithInvalidSlot(): CompilerPolicy {
  return {
    policy_id: "policy-invalid-slot",
    version: "0.0.1",
    policy_hash: "policy-invalid-slot-hash",
    required_surfaces_by_intent: {
      list: ["tasks_list"],
    },
    default_layout: "single",
    surface_to_block: {
      tasks_list: {
        block_type: "block.TaskList",
        version: "0.0.1",
        manifest_hash: "tasklist-hash",
        // Invalid slot on purpose
        slot: "invalid" as "main",
        default_props: { title: "Tasks" },
      },
    },
  };
}

function buildPolicyWithMissingSurface(): CompilerPolicy {
  return {
    policy_id: "policy-missing-surface",
    version: "0.0.1",
    policy_hash: "policy-missing-surface-hash",
    required_surfaces_by_intent: {
      list: ["tasks_list", "notes_list"],
    },
    default_layout: "single",
    surface_to_block: {
      // notes_list mapping intentionally omitted
      tasks_list: {
        block_type: "block.TaskList",
        version: "0.0.1",
        manifest_hash: "tasklist-hash",
        slot: "main",
        default_props: { title: "Tasks" },
      },
    },
  };
}

describe("compilePlan determinism", () => {
  test("same context + policy produce same request_id", () => {
    const context = buildTestContext();
    const policy = buildTestPolicy();
    const allowlists = buildAllowlists();

    const result1 = compilePlan({ context, policy, ...allowlists });
    const result2 = compilePlan({ context, policy, ...allowlists });

    expect(result1.request_id).toBe(result2.request_id);
  });

  test("same inputs produce same idempotency_key", () => {
    const params = {
      context_hash: "test-hash",
      policy_id: "ui-default",
      policy_version: "0.0.1",
      policy_hash: "policy-hash",
      layout_intent_core_hash: null,
      mode: "deterministic" as const,
    };

    const key1 = computeIdempotencyKey(params);
    const key2 = computeIdempotencyKey(params);

    expect(key1).toBe(key2);
  });

  test("different correlation_id does not affect request_id", () => {
    const intentCore: LayoutIntentCore = {
      ui_intent: "list",
      scope: "today",
      layout: "single",
      sections: ["tasks"],
    };
    const intent1: LayoutIntent = { ...intentCore, correlation_id: "AAA" };
    const intent2: LayoutIntent = { ...intentCore, correlation_id: "BBB" };

    const core1 = toLayoutIntentCore(intent1);
    const core2 = toLayoutIntentCore(intent2);

    expect(hashCanonical(core1)).toBe(hashCanonical(core2));
  });

  test("block_instance_id is deterministic", () => {
    const context = buildTestContext();
    const policy = buildTestPolicy();
    const allowlists = buildAllowlists();

    const result1 = compilePlan({ context, policy, ...allowlists });
    const result2 = compilePlan({ context, policy, ...allowlists });

    expect(result1.blocks.map((b) => b.block_instance_id)).toEqual(
      result2.blocks.map((b) => b.block_instance_id),
    );
  });
});

describe("compilePlan validation", () => {
  test("throws CompilerError for unknown manifest_hash", () => {
    const context = buildTestContext();
    const policy = buildTestPolicy();
    const allowlists = {
      allowed_manifest_hashes: new Set<string>(),
      allowed_block_types: new Set(["block.TaskList"]),
    };

    expect(() => compilePlan({ context, policy, ...allowlists })).toThrow(
      CompilerError,
    );
  });

  test("throws CompilerError for unknown block_type", () => {
    const context = buildTestContext();
    const policy = buildTestPolicy();
    const allowlists = {
      allowed_manifest_hashes: new Set(["tasklist-hash", "notelist-hash"]),
      allowed_block_types: new Set<string>(), // Empty
    };

    expect(() => compilePlan({ context, policy, ...allowlists })).toThrow(
      CompilerError,
    );
  });

  test("throws CompilerError for invalid slot", () => {
    const context = buildTestContext();
    const policy = buildPolicyWithInvalidSlot();
    const allowlists = buildAllowlists();

    expect(() => compilePlan({ context, policy, ...allowlists })).toThrow(
      CompilerError,
    );
  });

  test("throws CompilerError for missing surface mapping", () => {
    const context = buildTestContext();
    const policy = buildPolicyWithMissingSurface();
    const allowlists = buildAllowlists();

    expect(() => compilePlan({ context, policy, ...allowlists })).toThrow(
      CompilerError,
    );
  });

  test("dedupes surfaces before building blocks", () => {
    const context = buildTestContext();
    const policy = buildTestPolicy();
    const allowlists = buildAllowlists();
    const layoutIntentCore: LayoutIntentCore = {
      ui_intent: "list",
      scope: "today",
      layout: "single",
      sections: ["tasks"],
      must_include: ["tasks_list", "tasks_list", "notes_list"],
    };

    const result = compilePlan({
      context,
      policy,
      layoutIntentCore,
      ...allowlists,
    });

    expect(result.blocks.length).toBe(2); // duplicate removed
  });
});
