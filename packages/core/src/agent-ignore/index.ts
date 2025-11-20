/**
 * Agent ignore file management
 * Public API for detecting and resolving agent format conflicts
 */

export {
  type AgentIgnoreSpec,
  AGENT_IGNORE_REGISTRY,
  AGENTS_WITHOUT_IGNORE,
  CONFIG_BASED_IGNORE,
  getAgentIgnoreSpec,
  hasIgnoreSupport,
  needsIgnoreWarning,
  getAgentsForFormat,
  getConsumableExporters,
} from "./registry.js";

export {
  type AgentConflict,
  type AgentWarning,
  type ConflictDetectionResult,
  detectConflicts,
  getIgnorePatterns,
  getNestedIgnorePatterns,
  formatConflictMessage,
  formatWarningMessage,
} from "./detector.js";

export {
  type IgnoreFileUpdate,
  readIgnoreFile,
  parseIgnoreFile,
  hasPattern,
  hasAlignTrueSection,
  extractAlignTruePatterns,
  removeAlignTrueSection,
  buildAlignTrueSection,
  updateIgnoreFile,
  applyConflictResolution,
  applyNestedConflictResolution,
  removeAlignTruePatterns,
} from "./manager.js";
