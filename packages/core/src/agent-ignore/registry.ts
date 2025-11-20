/**
 * Agent ignore file registry
 * Defines ignore file specifications for all supported agents
 */

export interface AgentIgnoreSpec {
  /** Agent identifier (matches exporter name) */
  agent: string;
  /** Ignore file name (e.g., ".cursorignore") */
  ignoreFile: string;
  /** Formats this agent can consume (exporter names) */
  consumableFormats: string[];
  /** Native format for this agent (preferred) */
  nativeFormat: string;
  /** Whether agent respects nested ignore files in subdirectories */
  supportsNested: boolean;
  /** Additional ignore file for indexing only (optional) */
  indexingIgnoreFile?: string;
  /** Description of ignore mechanism */
  description: string;
}

/**
 * Registry of all agents with ignore file support
 * Based on research from agent documentation and community feedback
 */
export const AGENT_IGNORE_REGISTRY: AgentIgnoreSpec[] = [
  {
    agent: "cursor",
    ignoreFile: ".cursorignore",
    consumableFormats: ["cursor", "agents"],
    nativeFormat: "cursor",
    supportsNested: true,
    indexingIgnoreFile: ".cursorindexingignore",
    description:
      "Cursor supports .cursorignore (blocks all access) and .cursorindexingignore (blocks indexing only)",
  },
  {
    agent: "aider",
    ignoreFile: ".aiderignore",
    consumableFormats: ["aider", "agents"],
    nativeFormat: "aider",
    supportsNested: true,
    description: "Aider uses .aiderignore with Git-style syntax",
  },
  {
    agent: "firebase-studio",
    ignoreFile: ".aiexclude",
    consumableFormats: ["firebase-studio", "agents"],
    nativeFormat: "firebase-studio",
    supportsNested: false,
    description:
      "Firebase Studio (Gemini Code Assist) uses .aiexclude with gitignore syntax minus negation",
  },
  {
    agent: "kilocode",
    ignoreFile: ".kilocodeignore",
    consumableFormats: ["kilocode", "agents"],
    nativeFormat: "kilocode",
    supportsNested: false,
    description: "KiloCode uses .kilocodeignore in .kilocode directory",
  },
  {
    agent: "gemini",
    ignoreFile: ".geminiignore",
    consumableFormats: ["gemini", "agents"],
    nativeFormat: "gemini",
    supportsNested: false,
    description: "Gemini CLI supports .geminiignore like gitignore",
  },
  {
    agent: "crush",
    ignoreFile: ".crushignore",
    consumableFormats: ["crush", "agents"],
    nativeFormat: "crush",
    supportsNested: true,
    description:
      "Crush uses .crushignore for extra exclusions beyond .gitignore",
  },
  {
    agent: "warp",
    ignoreFile: ".warpindexingignore",
    consumableFormats: ["warp", "agents"],
    nativeFormat: "warp",
    supportsNested: false,
    description: "Warp uses .warpindexingignore to exclude from indexing",
  },
  {
    agent: "cline",
    ignoreFile: ".clineignore",
    consumableFormats: ["cline", "agents"],
    nativeFormat: "cline",
    supportsNested: false,
    description: "Cline uses .clineignore with Git-like syntax",
  },
  {
    agent: "goose",
    ignoreFile: ".gooseignore",
    consumableFormats: ["goose", "agents"],
    nativeFormat: "goose",
    supportsNested: false,
    description: "Goose uses .gooseignore to exclude files from AI access",
  },
  {
    agent: "junie",
    ignoreFile: ".aiignore",
    consumableFormats: ["junie", "agents"],
    nativeFormat: "junie",
    supportsNested: false,
    description:
      "Junie (JetBrains) uses .aiignore at project root for approval requirements",
  },
  {
    agent: "augmentcode",
    ignoreFile: ".augmentignore",
    consumableFormats: ["augmentcode", "agents"],
    nativeFormat: "augmentcode",
    supportsNested: false,
    description:
      "Augment Code uses .augmentignore with Git-style patterns including negation",
  },
  {
    agent: "kiro",
    ignoreFile: ".kiroignore",
    consumableFormats: ["kiro", "agents"],
    nativeFormat: "kiro",
    supportsNested: false,
    description: "Kiro uses .kiroignore like gitignore",
  },
];

/**
 * Agents that can consume multiple formats but have no known ignore mechanism
 * These will trigger informational warnings
 */
export const AGENTS_WITHOUT_IGNORE: string[] = [
  "claude", // Uses .gitignore only, no dedicated ignore file
  "amazonq", // Uses .gitignore only
  "zed", // Uses .gitignore only
  "qwen-code", // Uses .gitignore only
  "opencode", // Uses .gitignore only
  "openhands", // No ignore file yet (planned)
  "trae-ai", // No documented ignore file
  "windsurf", // No documented ignore file
  "copilot", // No documented ignore file
  "jules", // No documented ignore file
  "amp", // No documented ignore file
  "roocode", // No documented ignore file
];

/**
 * Agents with ignore patterns in config files rather than dedicated ignore files
 */
export const CONFIG_BASED_IGNORE: Record<string, string> = {
  firebender: "firebender.json (ignore array)",
};

/**
 * Get ignore specification for an agent
 */
export function getAgentIgnoreSpec(agent: string): AgentIgnoreSpec | undefined {
  return AGENT_IGNORE_REGISTRY.find((spec) => spec.agent === agent);
}

/**
 * Check if agent has ignore file support
 */
export function hasIgnoreSupport(agent: string): boolean {
  return AGENT_IGNORE_REGISTRY.some((spec) => spec.agent === agent);
}

/**
 * Check if agent can consume multiple formats but lacks ignore support
 */
export function needsIgnoreWarning(
  agent: string,
  enabledExporters: string[],
): boolean {
  if (!AGENTS_WITHOUT_IGNORE.includes(agent)) {
    return false;
  }

  // Check if multiple exporters target formats this agent can consume
  // For agents without ignore support, we assume they can read common formats
  const commonFormats = ["agents", agent];
  const matchingExporters = enabledExporters.filter((exp) =>
    commonFormats.includes(exp),
  );

  return matchingExporters.length > 1;
}

/**
 * Get all agents that can consume a specific format
 */
export function getAgentsForFormat(format: string): string[] {
  return AGENT_IGNORE_REGISTRY.filter((spec) =>
    spec.consumableFormats.includes(format),
  ).map((spec) => spec.agent);
}

/**
 * Get exporters that output to formats consumable by this agent
 */
export function getConsumableExporters(
  agent: string,
  enabledExporters: string[],
): string[] {
  const spec = getAgentIgnoreSpec(agent);
  if (!spec) {
    return [];
  }

  return enabledExporters.filter((exp) => spec.consumableFormats.includes(exp));
}
