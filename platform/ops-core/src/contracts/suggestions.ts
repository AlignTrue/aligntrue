/**
 * Suggestions domain contracts.
 * Command/event type strings only. No implementation here.
 */

export const SUGGESTION_COMMAND_TYPES = {
  Approve: "pack.suggestions.approve",
  Reject: "pack.suggestions.reject",
  Snooze: "pack.suggestions.snooze",
  BuildDailyPlan: "pack.suggestions.plan.build_daily",
  BuildWeeklyPlan: "pack.suggestions.plan.build_weekly",
} as const;

export type SuggestionCommandType =
  (typeof SUGGESTION_COMMAND_TYPES)[keyof typeof SUGGESTION_COMMAND_TYPES];

export const SUGGESTION_EVENT_TYPES = {
  Generated: "pack.suggestions.generated",
  FeedbackReceived: "pack.suggestions.feedback.received",
  DailyPlanBuilt: "pack.suggestions.plan.daily.built",
  WeeklyPlanBuilt: "pack.suggestions.plan.weekly.built",
} as const;

export type SuggestionEventType =
  (typeof SUGGESTION_EVENT_TYPES)[keyof typeof SUGGESTION_EVENT_TYPES];
