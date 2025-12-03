/**
 * Uninstall module for AlignTrue
 *
 * Provides functionality to cleanly remove AlignTrue from a project,
 * with options to convert exported files to editable or delete them.
 */

export { detectAlignTrueFiles } from "./detector.js";
export { previewUninstall, executeUninstall } from "./cleaner.js";
export type {
  UninstallOptions,
  UninstallResult,
  UninstallPreview,
  DetectedFile,
  DetectionResult,
  ExportHandling,
  SourceHandling,
} from "./types.js";
