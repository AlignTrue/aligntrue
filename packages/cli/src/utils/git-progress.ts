export type GitProgressPhase =
  | "metadata"
  | "clone"
  | "fetch"
  | "checkout"
  | "cleanup";

export interface GitProgressUpdate {
  phase: GitProgressPhase;
  message: string;
  repo: string;
  ref?: string;
  stage?: string;
  percent?: number;
}
