import type { CachedPackFile } from "./content-cache";
import type { AgentId } from "./convert";

const exactFilenameMap = new Map<string, AgentId>([
  ["claude.md", "claude"],
  ["claude.mdx", "claude"],
  ["agents.md", "all"],
  ["gemini.md", "gemini"],
  ["zed.md", "zed"],
  ["warp.md", "warp"],
  ["windsurf.md", "windsurf"],
  ["claude.md.txt", "claude"], // defensive, in case of appended extensions
  ["kiro.md", "kiro"],
  ["amazonq.md", "amazonq"],
  ["augmentcode.md", "augmentcode"],
  ["antigravity.md", "antigravity"],
]);

const legacyFilenameMap = new Map<string, AgentId>([
  [".cursorrules", "cursor"],
  [".clinerules", "cline"],
  [".goosehints", "all"], // treated as generic markdown-compatible
]);

const pathPrefixMap: { prefix: string; agent: AgentId }[] = [
  { prefix: ".cursor/rules/", agent: "cursor" },
  { prefix: ".clinerules/", agent: "cline" },
  { prefix: ".augment/rules/", agent: "augmentcode" },
  { prefix: ".amazonq/rules/", agent: "amazonq" },
  { prefix: ".openhands/", agent: "openhands" },
  { prefix: ".agent/rules/", agent: "antigravity" },
  { prefix: ".kiro/steering/", agent: "kiro" },
];

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").toLowerCase();
}

export function detectFileFormat(path: string): AgentId {
  const lower = normalizePath(path);
  const filename = lower.split("/").pop() ?? lower;

  // 1) Exact filenames
  const exact = exactFilenameMap.get(filename);
  if (exact) return exact;

  // 2) Legacy special filenames
  const legacy = legacyFilenameMap.get(filename);
  if (legacy) return legacy;

  // 3) Extension-based detection
  if (lower.endsWith(".mdc")) return "cursor";

  // 4) Path prefix detection
  for (const { prefix, agent } of pathPrefixMap) {
    if (lower.includes(prefix)) return agent;
  }

  // 5) Fallback: generic markdown works with AGENTS.md compatible agents
  return "all";
}

export function detectPackFormats(files: CachedPackFile[]): Set<AgentId> {
  const formats = new Set<AgentId>();
  files.forEach((file) => {
    formats.add(detectFileFormat(file.path));
  });
  return formats;
}

export function isMixedPack(packFiles: CachedPackFile[]): boolean {
  if (!packFiles.length) return false;
  const detectedFormats = detectPackFormats(packFiles);
  return detectedFormats.size > 1;
}
