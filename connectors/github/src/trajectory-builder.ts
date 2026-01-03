import type { OutcomeRecorded, TrajectoryEvent } from "@aligntrue/core";

import {
  transformPrOpened,
  transformPush,
  transformWorkflowRun,
  transformPrMerged,
  transformReview,
  transformRevertOutcome,
} from "./transform.js";
import {
  type GitHubPullRequestEvent,
  type GitHubPullRequestReviewEvent,
  type GitHubPushEvent,
  type GitHubWorkflowRunEvent,
} from "./types.js";
import { ghPrRef } from "./entity-refs.js";

export interface GitHubTrajectoryBuilder {
  trajectoryId: string;
  correlationId: string;
  prRef: string;
  steps: TrajectoryEvent[];
  outcome?: OutcomeRecorded | undefined;

  addPrOpened(event: GitHubPullRequestEvent): void;
  addPush(event: GitHubPushEvent): void;
  addWorkflowRun(event: GitHubWorkflowRunEvent): void;
  addReview(event: GitHubPullRequestReviewEvent): void;
  addMerge(event: GitHubPullRequestEvent): void;
  addRevert(event: GitHubPushEvent): void;

  build(): { steps: TrajectoryEvent[]; outcome?: OutcomeRecorded | undefined };
}

export function createTrajectoryBuilder(
  prEvent: GitHubPullRequestEvent,
): GitHubTrajectoryBuilder {
  const trajectoryId = `gh_pr_traj:${prEvent.repository.owner.login}/${prEvent.repository.name}#${prEvent.pull_request.number}`;
  const prRef = ghPrRef(
    prEvent.repository.owner.login,
    prEvent.repository.name,
    prEvent.pull_request.number,
  );
  const correlationId = prEvent.pull_request.head.sha;

  let steps: TrajectoryEvent[] = [];
  let outcome: OutcomeRecorded | undefined;
  let seq = 0;
  let prev: string | null = null;

  function addPrOpened(event: GitHubPullRequestEvent) {
    const start = transformPrOpened(event, trajectoryId, correlationId);
    steps.push(start);
    seq = start.step_seq + 1;
    prev = start.step_id;
  }

  function addPush(event: GitHubPushEvent) {
    const pushSteps = transformPush(
      event,
      trajectoryId,
      correlationId,
      seq,
      prev,
    );
    if (pushSteps.length > 0) {
      steps.push(...pushSteps);
      const last = pushSteps[pushSteps.length - 1]!;
      seq = last.step_seq + 1;
      prev = last.step_id;
    }
  }

  function addWorkflowRun(event: GitHubWorkflowRunEvent) {
    const step = transformWorkflowRun(
      event,
      trajectoryId,
      correlationId,
      seq,
      prev,
    );
    steps.push(step);
    seq = step.step_seq + 1;
    prev = step.step_id;
  }

  function addReview(event: GitHubPullRequestReviewEvent) {
    const step = transformReview(event, trajectoryId, correlationId, seq, prev);
    steps.push(step);
    seq = step.step_seq + 1;
    prev = step.step_id;
  }

  function addMerge(event: GitHubPullRequestEvent) {
    const [write, end] = transformPrMerged(
      event,
      trajectoryId,
      correlationId,
      seq,
      prev,
    );
    steps.push(write, end);
    seq = end.step_seq + 1;
    prev = end.step_id;
  }

  function addRevert(event: GitHubPushEvent) {
    outcome = transformRevertOutcome(event, trajectoryId, correlationId);
  }

  function build(): {
    steps: TrajectoryEvent[];
    outcome?: OutcomeRecorded | undefined;
  } {
    return { steps, outcome };
  }

  return {
    trajectoryId,
    correlationId,
    prRef,
    steps,
    get outcome() {
      return outcome;
    },
    addPrOpened,
    addPush,
    addWorkflowRun,
    addReview,
    addMerge,
    addRevert,
    build,
  };
}
