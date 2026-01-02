export type UIIntent = "list" | "detail" | "create" | "dashboard" | "triage";
export type UIScope = "today" | "week" | "all" | "search";
export type LayoutTemplate = "single" | "split" | "dashboard" | "inbox";
export type SectionId = "tasks" | "notes" | "inbox" | "calendar" | "contacts";
export type RequiredSurface =
  | "create_task_form"
  | "create_note_form"
  | "tasks_list"
  | "notes_list"
  | "inbox_focus";
export type Emphasis = "overdue" | "today" | "mits" | "unread" | "flagged";

// Hashable core (used for idempotency)
export interface LayoutIntentCore {
  readonly ui_intent: UIIntent;
  readonly scope: UIScope;
  readonly layout: LayoutTemplate;
  readonly sections: readonly SectionId[];
  readonly must_include?: readonly RequiredSurface[];
  readonly emphasis?: readonly Emphasis[];
}

// Full intent (correlation is envelope, not hashed)
export interface LayoutIntent extends LayoutIntentCore {
  readonly correlation_id: string;
}

export function toLayoutIntentCore(intent: LayoutIntent): LayoutIntentCore {
  const { correlation_id: _, ...core } = intent;
  return core;
}
