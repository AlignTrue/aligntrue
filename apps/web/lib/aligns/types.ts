export type AlignKind = "rule" | "rule_group" | "skill" | "mcp" | "other";

export type AlignRecord = {
  schemaVersion: 1;
  id: string; // 11-char base64url
  url: string; // original submitted URL
  normalizedUrl: string; // canonical GitHub blob URL
  provider: "github" | "unknown";
  kind: AlignKind;
  title: string | null;
  description: string | null;
  fileType: "markdown" | "yaml" | "unknown";
  createdAt: string; // ISO timestamp
  lastViewedAt: string;
  viewCount: number;
  installClickCount: number;
};
