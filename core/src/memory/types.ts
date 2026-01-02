export interface MemoryReference {
  readonly entity_type: "task" | "note" | "contact" | "timeline_item";
  readonly entity_id: string;
  readonly score?: number;
}

export interface IndexableItem {
  readonly entity_type: MemoryReference["entity_type"];
  readonly entity_id: string;
  readonly content: string;
  readonly metadata?: Record<string, unknown>;
}

export interface IndexResult {
  readonly indexed: number;
  readonly skipped: number;
}

export interface QueryContext {
  readonly week_start: string;
  readonly task_ids?: readonly string[];
  readonly limit?: number;
}

export interface MemoryProvider {
  index(items: IndexableItem[]): Promise<IndexResult>;
  query(context: QueryContext): Promise<MemoryReference[]>;
  enabled(): boolean;
}
