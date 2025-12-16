import type { CachedPackFile } from "./content-cache";
import type { AgentId } from "./convert";
import { agentOptions } from "./agents";

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

type WarningType = "none" | "mixed" | "transform";

export type FormatWarning = {
  type: WarningType;
  message: string | null;
};

function formatLabelsFromIds(ids: Set<AgentId>): string {
  const labels = Array.from(ids)
    .map((id) => agentOptions.find((a) => a.id === id)?.name)
    .filter(Boolean);
  return labels.join(", ");
}

function allFilesMatchFormat(
  detected: Set<AgentId>,
  selected: AgentId,
): boolean {
  if (detected.size === 0) return true;
  if (detected.size === 1 && detected.has(selected)) return true;
  return false;
}

export function getFormatWarning(
  packFiles: CachedPackFile[],
  selectedFormat: AgentId,
): FormatWarning {
  if (packFiles.length <= 1) {
    return { type: "none", message: null };
  }

  const detectedFormats = detectPackFormats(packFiles);

  // Mixed pack formats: surface a clear note for all users
  if (detectedFormats.size > 1) {
    const labels = formatLabelsFromIds(detectedFormats);
    const labelText = labels ? ` (${labels})` : "";
    return {
      type: "mixed",
      message:
        `This pack has multiple formats${labelText}, likely from a custom or symlinked config. ` +
        "AlignTrue simplifies this to a single edit source. All rules will work with any agent(s) you select. " +
        "After install, review source files in `.aligntrue/rules/` to meet your intent.",
    };
  }

  // If everything aligns with the selected format, no warning
  if (allFilesMatchFormat(detectedFormats, selectedFormat)) {
    return { type: "none", message: null };
  }

  // Mixed or differing formats -> warn about transformation
  const selectedLabel = agentOptions.find((a) => a.id === selectedFormat)?.name;
  const message = selectedLabel
    ? `Converts all files to ${selectedLabel} format. Review after importing to ensure compatibility.`
    : "Converts all files to the selected format. Review after importing to ensure compatibility.";

  return { type: "transform", message };
}
