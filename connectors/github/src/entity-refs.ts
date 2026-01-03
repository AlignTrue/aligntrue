import { entityRef } from "@aligntrue/core";

export function ghRepoRef(owner: string, repo: string): string {
  return entityRef("gh_repo", `${owner}/${repo}`);
}

export function ghPrRef(owner: string, repo: string, number: number): string {
  return entityRef("gh_pr", `${owner}/${repo}#${number}`);
}

export function ghIssueRef(
  owner: string,
  repo: string,
  number: number,
): string {
  return entityRef("gh_issue", `${owner}/${repo}#${number}`);
}

export function ghCommitRef(owner: string, repo: string, sha: string): string {
  return entityRef("gh_commit", `${owner}/${repo}@${sha}`);
}

export function ghFileRef(
  owner: string,
  repo: string,
  path: string,
  ref?: string,
): string {
  const suffix = ref ? `@${ref}` : "";
  return entityRef("gh_file", `${owner}/${repo}:${path}${suffix}`);
}

export function ghWorkflowRef(
  owner: string,
  repo: string,
  workflowId: string | number,
): string {
  return entityRef("gh_workflow", `${owner}/${repo}:${workflowId}`);
}

export function ghActorRef(username: string): string {
  return entityRef("gh_actor", `github:${username}`);
}
