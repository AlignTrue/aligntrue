/**
 * Audit History Log
 *
 * Append-only JSONL audit log for tracking rule lifecycle events.
 * Events are written to `.aligntrue/.history` and gitignored by default.
 *
 * @module
 */

import { existsSync, appendFileSync, mkdirSync, readFileSync } from "fs";
import { dirname, join } from "path";

/**
 * Audit event types
 */
export type AuditAction = "import" | "rename" | "delete";

/**
 * Base audit event structure
 */
export interface AuditEvent {
  /** ISO timestamp */
  ts: string;
  /** Event type */
  action: AuditAction;
}

/**
 * Import event - rule imported from external source
 */
export interface ImportEvent extends AuditEvent {
  action: "import";
  /** Target filename in .aligntrue/rules/ */
  file: string;
  /** Source path or URL */
  from: string;
}

/**
 * Rename event - rule file renamed
 */
export interface RenameEvent extends AuditEvent {
  action: "rename";
  /** Original filename */
  old: string;
  /** New filename */
  new: string;
}

/**
 * Delete event - rule file deleted
 */
export interface DeleteEvent extends AuditEvent {
  action: "delete";
  /** Deleted filename */
  file: string;
}

export type AuditLogEvent = ImportEvent | RenameEvent | DeleteEvent;

/**
 * Get the path to the audit history file
 */
export function getHistoryPath(workspaceRoot: string): string {
  return join(workspaceRoot, ".aligntrue", ".history");
}

/**
 * Event without timestamp (for input to appendAuditEvent)
 */
type AuditEventInput =
  | Omit<ImportEvent, "ts">
  | Omit<RenameEvent, "ts">
  | Omit<DeleteEvent, "ts">;

/**
 * Append an event to the audit log
 *
 * Creates the file and parent directory if they don't exist.
 * Each event is written as a single JSON line (JSONL format).
 *
 * @param workspaceRoot - Workspace root directory
 * @param event - Event to log (without timestamp - will be added)
 */
export function appendAuditEvent(
  workspaceRoot: string,
  event: AuditEventInput,
): void {
  const historyPath = getHistoryPath(workspaceRoot);
  const dir = dirname(historyPath);

  // Ensure directory exists (recursive: true is safe if dir already exists)
  mkdirSync(dir, { recursive: true });

  // Add timestamp
  const fullEvent = {
    ...event,
    ts: new Date().toISOString(),
  };

  // Append as JSONL (one JSON object per line)
  const line = JSON.stringify(fullEvent) + "\n";
  appendFileSync(historyPath, line, "utf-8");
}

/**
 * Log an import event
 *
 * @param workspaceRoot - Workspace root directory
 * @param file - Target filename in .aligntrue/rules/
 * @param from - Source path or URL
 */
export function logImport(
  workspaceRoot: string,
  file: string,
  from: string,
): void {
  const event: Omit<ImportEvent, "ts"> = {
    action: "import",
    file,
    from,
  };
  appendAuditEvent(workspaceRoot, event);
}

/**
 * Log a rename event
 *
 * @param workspaceRoot - Workspace root directory
 * @param oldName - Original filename
 * @param newName - New filename
 */
export function logRename(
  workspaceRoot: string,
  oldName: string,
  newName: string,
): void {
  const event: Omit<RenameEvent, "ts"> = {
    action: "rename",
    old: oldName,
    new: newName,
  };
  appendAuditEvent(workspaceRoot, event);
}

/**
 * Log a delete event
 *
 * @param workspaceRoot - Workspace root directory
 * @param file - Deleted filename
 */
export function logDelete(workspaceRoot: string, file: string): void {
  const event: Omit<DeleteEvent, "ts"> = {
    action: "delete",
    file,
  };
  appendAuditEvent(workspaceRoot, event);
}

/**
 * Read all events from the audit log
 *
 * @param workspaceRoot - Workspace root directory
 * @returns Array of audit events, or empty array if file doesn't exist
 */
export function readAuditLog(workspaceRoot: string): AuditLogEvent[] {
  const historyPath = getHistoryPath(workspaceRoot);

  if (!existsSync(historyPath)) {
    return [];
  }

  const content = readFileSync(historyPath, "utf-8");
  const lines = content.split("\n").filter((line) => line.trim());

  return lines.map((line) => JSON.parse(line) as AuditLogEvent);
}

/**
 * Get import history for a specific file
 *
 * @param workspaceRoot - Workspace root directory
 * @param file - Filename to look up
 * @returns Import event if found, undefined otherwise
 */
export function getImportHistory(
  workspaceRoot: string,
  file: string,
): ImportEvent | undefined {
  const events = readAuditLog(workspaceRoot);

  // Find the most recent import event for this file
  // (accounting for renames)
  let currentName = file;

  // Walk backwards through events to find the original import
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    if (!event) continue;

    if (event.action === "rename" && event.new === currentName) {
      // Track renames backwards
      currentName = event.old;
    } else if (event.action === "import" && event.file === currentName) {
      return event;
    }
  }

  return undefined;
}
