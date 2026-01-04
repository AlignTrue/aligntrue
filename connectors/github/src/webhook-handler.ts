import type { TrajectoryStore } from "@aligntrue/core";

import { transformPush, transformWorkflowRun } from "./transform.js";
import {
  createTrajectoryBuilder,
  type GitHubTrajectoryBuilder,
} from "./trajectory-builder.js";
import type {
  GitHubPullRequestEvent,
  GitHubPushEvent,
  GitHubWorkflowRunEvent,
} from "./types.js";

export interface WebhookHandlerOptions {
  trajectoryStore: TrajectoryStore;
  secret?: string;
}

export interface WebhookResult {
  trajectory_id?: string;
  steps_emitted: number;
  outcome_emitted: boolean;
}

export async function handleWebhook(
  eventType: string,
  payload: unknown,
  opts: WebhookHandlerOptions,
): Promise<WebhookResult> {
  switch (eventType) {
    case "pull_request":
      return handlePullRequest(payload as GitHubPullRequestEvent, opts);
    case "push":
      return handlePush(payload as GitHubPushEvent, opts);
    case "workflow_run":
      return handleWorkflowRun(payload as GitHubWorkflowRunEvent, opts);
    default:
      return { steps_emitted: 0, outcome_emitted: false };
  }
}

async function handlePullRequest(
  event: GitHubPullRequestEvent,
  opts: WebhookHandlerOptions,
): Promise<WebhookResult> {
  const builder: GitHubTrajectoryBuilder = createTrajectoryBuilder(event);

  if (event.action === "opened") {
    builder.addPrOpened(event);
  }

  if (
    event.action === "merged" ||
    (event.action === "closed" && event.pull_request.merged)
  ) {
    builder.addMerge(event);
  }

  const built = builder.build();
  for (const step of built.steps) {
    await opts.trajectoryStore.appendStep(step);
  }
  if (built.outcome) {
    await opts.trajectoryStore.appendOutcome(built.outcome);
  }

  return {
    trajectory_id: builder.trajectoryId,
    steps_emitted: built.steps.length,
    outcome_emitted: Boolean(built.outcome),
  };
}

async function handlePush(
  event: GitHubPushEvent,
  opts: WebhookHandlerOptions,
): Promise<WebhookResult> {
  const trajectory_id = `gh_commit_traj:${event.after}`;
  const correlation_id = event.after;
  const steps = transformPush(event, trajectory_id, correlation_id, 0, null);
  for (const step of steps) {
    await opts.trajectoryStore.appendStep(step);
  }
  return {
    trajectory_id,
    steps_emitted: steps.length,
    outcome_emitted: false,
  };
}

async function handleWorkflowRun(
  event: GitHubWorkflowRunEvent,
  opts: WebhookHandlerOptions,
): Promise<WebhookResult> {
  const trajectory_id = `gh_commit_traj:${event.workflow_run.head_sha}`;
  const correlation_id = event.workflow_run.head_sha;
  const step = transformWorkflowRun(
    event,
    trajectory_id,
    correlation_id,
    0,
    null,
  );
  await opts.trajectoryStore.appendStep(step);
  return {
    trajectory_id,
    steps_emitted: 1,
    outcome_emitted: false,
  };
}
