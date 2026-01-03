import {
  type TrajectoryEvent,
  type OutcomeRecorded,
  type TrajectoryRefs,
  buildTrajectoryEvent,
  buildOutcome,
} from "@aligntrue/core";

import {
  ghActorRef,
  ghCommitRef,
  ghFileRef,
  ghPrRef,
  ghRepoRef,
  ghWorkflowRef,
} from "./entity-refs.js";
import type {
  GitHubPullRequestEvent,
  GitHubPullRequestReviewEvent,
  GitHubPushEvent,
  GitHubWorkflowRunEvent,
} from "./types.js";

type Step = TrajectoryEvent;

function baseRefs(refs: string[]): TrajectoryRefs {
  return {
    entity_refs: refs.map((ref) => ({ ref, link: "observed" as const })),
    artifact_refs: [],
    external_refs: [],
  };
}

export function transformPrOpened(
  event: GitHubPullRequestEvent,
  trajectoryId: string,
  correlationId: string,
): Step {
  const repoRef = ghRepoRef(
    event.repository.owner.login,
    event.repository.name,
  );
  const prRef = ghPrRef(
    event.repository.owner.login,
    event.repository.name,
    event.pull_request.number,
  );
  return buildTrajectoryEvent({
    trajectory_id: trajectoryId,
    step_seq: 0,
    prev_step_hash: null,
    step_type: "trajectory_started",
    producer: "host",
    timestamp: new Date().toISOString(),
    causation: {},
    correlation_id: correlationId,
    payload: {
      trigger: "pr_opened",
      context: {
        title: event.pull_request.title,
        head: event.pull_request.head.ref,
        base: event.pull_request.base.ref,
      },
    },
    refs: baseRefs([
      repoRef,
      prRef,
      ghActorRef(event.pull_request.user.login),
      ghActorRef(event.sender.login),
    ]),
  });
}

export function transformPush(
  event: GitHubPushEvent,
  trajectoryId: string,
  correlationId: string,
  startSeq: number,
  startPrevHash: string | null = null,
): Step[] {
  const repo = event.repository.full_name;
  const parts = repo.split("/");
  const owner = parts[0]!;
  const name = parts[1]!;
  const steps: Step[] = [];
  let seq = startSeq;
  let prev: string | null = startPrevHash;

  for (const commit of event.commits) {
    const paths = [...commit.added, ...commit.modified, ...commit.removed];
    for (const path of paths) {
      const step = buildTrajectoryEvent({
        trajectory_id: trajectoryId,
        step_seq: seq,
        prev_step_hash: prev,
        step_type: "entity_written",
        producer: "host",
        timestamp: new Date().toISOString(),
        causation: { related_command_id: commit.id },
        correlation_id: correlationId,
        payload: {
          entity_ref: ghFileRef(owner, name, path, event.after),
          command_id: commit.id,
        },
        refs: baseRefs([
          ghRepoRef(owner, name),
          ghCommitRef(owner, name, commit.id),
          ghActorRef(commit.author.username),
        ]),
      });
      steps.push(step);
      prev = step.step_id;
      seq += 1;
    }
  }

  return steps;
}

export function transformWorkflowRun(
  event: GitHubWorkflowRunEvent,
  trajectoryId: string,
  correlationId: string,
  stepSeq: number,
  prevStepHash: string | null,
): Step {
  const parts = event.repository.full_name.split("/");
  const owner = parts[0]!;
  const name = parts[1]!;
  return buildTrajectoryEvent({
    trajectory_id: trajectoryId,
    step_seq: stepSeq,
    prev_step_hash: prevStepHash,
    step_type: "tool_called",
    producer: "host",
    timestamp: new Date().toISOString(),
    causation: {},
    correlation_id: correlationId,
    payload: {
      tool_name: event.workflow_run.name,
      args_summary: `branch=${event.workflow_run.head_branch}`,
      result_summary: event.workflow_run.conclusion ?? "unknown",
    },
    refs: baseRefs([
      ghRepoRef(owner, name),
      ghWorkflowRef(owner, name, event.workflow_run.id),
      ghCommitRef(owner, name, event.workflow_run.head_sha),
    ]),
  });
}

export function transformPrMerged(
  event: GitHubPullRequestEvent,
  trajectoryId: string,
  correlationId: string,
  startSeq: number,
  prevStepHash: string | null,
): [Step, Step] {
  const repoRef = ghRepoRef(
    event.repository.owner.login,
    event.repository.name,
  );
  const prRef = ghPrRef(
    event.repository.owner.login,
    event.repository.name,
    event.pull_request.number,
  );

  const write = buildTrajectoryEvent({
    trajectory_id: trajectoryId,
    step_seq: startSeq,
    prev_step_hash: prevStepHash,
    step_type: "entity_written",
    producer: "host",
    timestamp: new Date().toISOString(),
    causation: { related_command_id: event.pull_request.head.sha },
    correlation_id: correlationId,
    payload: {
      entity_ref: prRef,
      command_id: event.pull_request.head.sha,
    },
    refs: baseRefs([
      repoRef,
      prRef,
      ghActorRef(event.pull_request.merged_by?.login ?? event.sender.login),
    ]),
  });

  const end = buildTrajectoryEvent({
    trajectory_id: trajectoryId,
    step_seq: startSeq + 1,
    prev_step_hash: write.step_id,
    step_type: "trajectory_ended",
    producer: "host",
    timestamp: new Date().toISOString(),
    causation: {},
    correlation_id: correlationId,
    payload: { outcome_summary: "pr_merged" },
    refs: baseRefs([repoRef, prRef]),
  });

  return [write, end];
}

export function transformReview(
  event: GitHubPullRequestReviewEvent,
  trajectoryId: string,
  correlationId: string,
  stepSeq: number,
  prevStepHash: string | null,
): Step {
  const prRef = ghPrRef(
    event.repository.owner.login,
    event.repository.name,
    event.pull_request.number,
  );
  const repoRef = ghRepoRef(
    event.repository.owner.login,
    event.repository.name,
  );
  return buildTrajectoryEvent({
    trajectory_id: trajectoryId,
    step_seq: stepSeq,
    prev_step_hash: prevStepHash,
    step_type: "decision_rationale",
    producer: "human",
    timestamp: new Date().toISOString(),
    causation: {},
    correlation_id: correlationId,
    payload: {
      decision: event.review.state,
      factors: event.review.body ? [event.review.body] : [],
    },
    refs: baseRefs([prRef, repoRef, ghActorRef(event.review.user.login)]),
  });
}

export function transformRevertOutcome(
  pushEvent: GitHubPushEvent,
  trajectoryId: string,
  _correlationId: string,
): OutcomeRecorded {
  const parts = pushEvent.repository.full_name.split("/");
  const owner = parts[0]!;
  const name = parts[1]!;
  const notes = pushEvent.commits[0]?.message;
  return buildOutcome({
    outcome_id: `revert-${pushEvent.after}`,
    attaches_to: { trajectory_id: trajectoryId },
    kind: "rollback",
    severity: 1,
    metrics: {},
    ...(notes ? { notes } : {}),
    refs: baseRefs([
      ghRepoRef(owner, name),
      ghCommitRef(owner, name, pushEvent.after),
    ]),
    timestamp: new Date().toISOString(),
  });
}
