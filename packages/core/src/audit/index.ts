/**
 * Audit module
 *
 * Provides audit logging for rule lifecycle events.
 *
 * @module
 */

export {
  type AuditAction,
  type AuditEvent,
  type ImportEvent,
  type RenameEvent,
  type DeleteEvent,
  type AuditLogEvent,
  getHistoryPath,
  appendAuditEvent,
  logImport,
  logRename,
  logDelete,
  readAuditLog,
  getImportHistory,
} from "./history.js";
