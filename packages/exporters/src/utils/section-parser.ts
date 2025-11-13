/**
 * Re-export section parser from @aligntrue/schema
 * Avoids circular dependency: core -> exporters -> core
 */

export {
  parseAgentsMd,
  parseCursorMdc,
  parseGenericMarkdown,
  type ParsedSection,
  type ParsedFile,
} from "@aligntrue/schema";
