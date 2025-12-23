export type EmailStatus = "inbox" | "ai_todo" | "needs_human" | "processed";

export type EmailResolution =
  | "archived"
  | "task_created"
  | "note_created"
  | "reply_draft_created"
  | "reply_sent"
  | "ignored"
  | "other";

export type TransitionTrigger = "human" | "auto_commit" | "system";

export type SliceKind = "snippet" | "enriched";

export function transitionKey(
  from: EmailStatus,
  to: EmailStatus,
): `${EmailStatus}->${EmailStatus}` {
  return `${from}->${to}`;
}

export const TRANSITION_PERMISSIONS = new Map<
  ReturnType<typeof transitionKey>,
  TransitionTrigger[]
>([
  [transitionKey("inbox", "processed"), ["auto_commit", "human"]],
  [transitionKey("inbox", "needs_human"), ["system"]],
  [transitionKey("inbox", "ai_todo"), ["human"]],
  [transitionKey("ai_todo", "needs_human"), ["system"]],
  [transitionKey("ai_todo", "processed"), ["human", "system"]],
  [transitionKey("needs_human", "ai_todo"), ["human"]],
  [transitionKey("needs_human", "processed"), ["human"]],
]);

export function isTransitionAllowed(
  from: EmailStatus,
  to: EmailStatus,
  trigger: TransitionTrigger,
): boolean {
  const key = transitionKey(from, to);
  const allowed = TRANSITION_PERMISSIONS.get(key);
  return allowed?.includes(trigger) ?? false;
}
