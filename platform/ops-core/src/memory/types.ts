export interface MemoryReference {
  readonly entity_type: "task" | "note" | "contact" | "timeline_item";
  readonly entity_id: string;
  readonly score?: number;
}

export interface QueryContext {
  readonly week_start: string;
  readonly task_ids?: readonly string[];
  readonly limit?: number;
}

export interface MemoryProvider {
  query(context: QueryContext): Promise<MemoryReference[]>;
  enabled(): boolean;
}
