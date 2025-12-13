export type AlignKind = "rule" | "skill" | "mcp" | "other" | "pack";

export type AlignPackFile = {
  path: string;
  size: number;
};

export type AlignPackInfo = {
  manifestPath: string;
  manifestId: string;
  manifestVersion: string;
  manifestSummary?: string | null;
  manifestAuthor?: string | null;
  manifestDescription?: string | null;
  ref: string;
  files: AlignPackFile[];
  totalBytes: number;
};

export type AlignRecord = {
  schemaVersion: 1;
  id: string; // 11-char base64url
  url: string; // original submitted URL
  normalizedUrl: string; // canonical GitHub blob URL
  provider: "github" | "unknown";
  kind: AlignKind;
  title: string | null;
  description: string | null;
  fileType: "markdown" | "yaml" | "xml" | "unknown";
  contentHash?: string;
  contentHashUpdatedAt?: string;
  contentHashMismatch?: boolean;
  createdAt: string; // ISO timestamp
  lastViewedAt: string;
  viewCount: number;
  installClickCount: number;
  pack?: AlignPackInfo;
  sourceRemoved?: boolean;
  sourceRemovedAt?: string;
  fetchFailCount?: number;
};
