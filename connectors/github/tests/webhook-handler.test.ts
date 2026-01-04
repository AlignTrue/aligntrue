import { describe, expect, it, vi } from "vitest";
import { handleWebhook } from "../src/webhook-handler.js";
import type { TrajectoryStore } from "@aligntrue/core";

const mockStore: TrajectoryStore = {
  appendStep: vi.fn(),
  appendOutcome: vi.fn(),
  readTrajectory: vi.fn(),
  listTrajectories: vi.fn(),
  listOutcomes: vi.fn(),
};

const basePr = {
  action: "opened",
  pull_request: {
    number: 1,
    title: "Add feature",
    head: { sha: "sha-head", ref: "feature-branch" },
    base: { ref: "main" },
    user: { login: "alice" },
    merged: false,
  },
  repository: {
    full_name: "owner/repo",
    owner: { login: "owner" },
    name: "repo",
  },
  sender: { login: "alice" },
};

describe("webhook-handler", () => {
  it("only adds PrOpened when action is opened", async () => {
    vi.clearAllMocks();

    // Test 'synchronize' action
    const syncEvent = { ...basePr, action: "synchronize" };
    await handleWebhook("pull_request", syncEvent, {
      trajectoryStore: mockStore,
    });

    // Should NOT have trajectory_started step
    const syncSteps = (mockStore.appendStep as any).mock.calls.map(
      (call: any) => call[0].step_type,
    );
    expect(syncSteps).not.toContain("trajectory_started");

    vi.clearAllMocks();

    // Test 'opened' action
    const openedEvent = { ...basePr, action: "opened" };
    await handleWebhook("pull_request", openedEvent, {
      trajectoryStore: mockStore,
    });

    // SHOULD have trajectory_started step
    const openedSteps = (mockStore.appendStep as any).mock.calls.map(
      (call: any) => call[0].step_type,
    );
    expect(openedSteps).toContain("trajectory_started");
  });
});
