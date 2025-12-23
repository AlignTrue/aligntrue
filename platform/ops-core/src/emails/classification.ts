import type { EmailResolution, EmailStatus } from "./types.js";

export type EmailClassification =
  | "informational"
  | "simple_reply"
  | "complex_reply"
  | "task"
  | "ambiguous";

export const CLASSIFICATION_ACTIONS: Record<
  EmailClassification,
  {
    suggestedStatus: EmailStatus;
    suggestedResolution?: EmailResolution;
    canAutoCommit: boolean;
    canAutoDraft: boolean;
  }
> = {
  informational: {
    suggestedStatus: "processed",
    suggestedResolution: "archived",
    canAutoCommit: true,
    canAutoDraft: false,
  },
  simple_reply: {
    suggestedStatus: "ai_todo",
    canAutoCommit: false,
    canAutoDraft: true,
  },
  complex_reply: {
    suggestedStatus: "needs_human",
    canAutoCommit: false,
    canAutoDraft: false,
  },
  task: {
    suggestedStatus: "ai_todo",
    canAutoCommit: false,
    canAutoDraft: false,
  },
  ambiguous: {
    suggestedStatus: "needs_human",
    canAutoCommit: false,
    canAutoDraft: false,
  },
};
