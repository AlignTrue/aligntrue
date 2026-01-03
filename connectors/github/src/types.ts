// Subset of GitHub webhook payloads the connector supports (v1).
export interface GitHubPullRequestEvent {
  action:
    | "opened"
    | "closed"
    | "merged"
    | "synchronize"
    | "review_requested"
    | "review_submitted";
  pull_request: {
    number: number;
    title: string;
    head: { sha: string; ref: string };
    base: { ref: string };
    user: { login: string };
    merged: boolean;
    merged_by?: { login: string };
  };
  repository: { full_name: string; owner: { login: string }; name: string };
  sender: { login: string };
}

export interface GitHubPullRequestReviewEvent {
  action: "submitted";
  review: {
    state: "approved" | "changes_requested" | "commented";
    user: { login: string };
    body?: string;
  };
  pull_request: GitHubPullRequestEvent["pull_request"];
  repository: GitHubPullRequestEvent["repository"];
  sender: { login: string };
}

export interface GitHubPushEvent {
  ref: string;
  before: string;
  after: string;
  commits: Array<{
    id: string;
    message: string;
    author: { username: string };
    added: string[];
    modified: string[];
    removed: string[];
  }>;
  repository: { full_name: string };
  sender: { login: string };
}

export interface GitHubWorkflowRunEvent {
  action: "completed" | "requested";
  workflow_run: {
    id: number;
    name: string;
    conclusion: "success" | "failure" | "cancelled" | null;
    head_sha: string;
    head_branch: string;
  };
  repository: { full_name: string };
}

export interface GitHubConnectorConfig {
  owner: string;
  repo: string;
  webhookSecret?: string;
}
