import {
  transformPrOpened,
  transformPush,
  transformWorkflowRun,
} from "../src/transform.js";
import { createTrajectoryBuilder } from "../src/trajectory-builder.js";

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

describe("transform", () => {
  it("creates trajectory_started for PR opened", () => {
    const step = transformPrOpened(basePr as any, "traj-1", "corr-1");
    expect(step.step_type).toBe("trajectory_started");
    expect(step.trajectory_id).toBe("traj-1");
  });

  it("creates entity_written for push commits", () => {
    const push = {
      ref: "refs/heads/main",
      before: "0000",
      after: "1111",
      commits: [
        {
          id: "c1",
          message: "Update",
          author: { username: "alice" },
          added: ["a.txt"],
          modified: [],
          removed: [],
        },
      ],
      repository: { full_name: "owner/repo" },
      sender: { login: "alice" },
    };
    const steps = transformPush(push as any, "traj-2", "corr-2", 0, null);
    expect(steps.length).toBe(1);
    expect(steps[0].step_type).toBe("entity_written");
  });

  it("creates tool_called for workflow run", () => {
    const wf = {
      action: "completed",
      workflow_run: {
        id: 10,
        name: "CI",
        conclusion: "success",
        head_sha: "abc",
        head_branch: "main",
      },
      repository: { full_name: "owner/repo" },
    };
    const step = transformWorkflowRun(wf as any, "traj-3", "corr-3", 0, null);
    expect(step.step_type).toBe("tool_called");
  });

  it("builder accumulates and emits merge end step", () => {
    const pr = { ...basePr, action: "opened" } as any;
    const builder = createTrajectoryBuilder(pr);
    builder.addPrOpened(pr);
    builder.addMerge({
      ...pr,
      action: "merged",
      pull_request: { ...pr.pull_request, merged: true },
    });
    const built = builder.build();
    const types = built.steps.map((s) => s.step_type);
    expect(types).toContain("trajectory_started");
    expect(types).toContain("trajectory_ended");
  });
});
