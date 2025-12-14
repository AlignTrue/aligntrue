export type AlignKind = "rule" | "skill" | "mcp" | "other" | "pack";

export type AlignPackFile = {
  path: string;
  size: number;
};

export type AlignPackInfo = {
  files: AlignPackFile[];
  totalBytes: number;
};

export type AlignRecord = {
  id: string; // 11-char base64url
  url: string; // original submitted URL
  normalizedUrl: string; // canonical GitHub blob URL
  provider: "github" | "unknown";
  source?: "github" | "catalog";
  kind: AlignKind;
  title: string | null;
  description: string | null;
  author?: string | null;
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
  memberOfPackIds?: string[];
  containsAlignIds?: string[];
};
