import { promises as fsp } from "node:fs";
import { statSync } from "node:fs";
import { resolve, relative } from "node:path";
import crypto from "node:crypto";

export interface PackReference {
  readonly name: string;
  readonly version: string;
  readonly integrity?: string; // "sha256-BASE64..."
  readonly source?: "workspace" | "registry" | "git";
}

export interface AppManifest {
  readonly name: string;
  readonly version: string;
  readonly packs: PackReference[];
  readonly capabilities?: string[];
  readonly config?: Record<string, Record<string, unknown>>;
}

export interface ResolvedPack {
  readonly name: string;
  readonly requested_version: string;
  readonly resolved_version: string;
  readonly integrity: string;
  readonly source: "workspace" | "registry" | "git";
  readonly distPath?: string;
  readonly entryPath?: string;
}

export interface PackFileEntry {
  readonly absolutePath: string;
  readonly relativePath: string;
}

/**
 * INTEGRITY ALGORITHM (Phase 3):
 *
 * Deterministic hash of pack's dist/ directory:
 *
 * 1. List all files under dist/ recursively
 * 2. Sort by relative path (normalized to forward slashes)
 * 3. For each file: concatenate (relativePath + "\n" + fileBytes)
 * 4. SHA256 hash the concatenation
 * 5. Base64 encode: "sha256-" + base64(hash)
 *
 * Rules:
 * - File paths normalized (/ not \)
 * - No file metadata included (just path + content)
 * - Sourcemaps included if present (build must be deterministic)
 * - dist/ MUST exist - caller should surface a clear error if missing
 */
export async function computePackIntegrity(distPath: string): Promise<string> {
  const normalizedRoot = resolve(distPath);
  ensureExists(normalizedRoot);

  const files = await listFilesRecursive(normalizedRoot);
  files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

  const hasher = crypto.createHash("sha256");
  for (const file of files) {
    const normalizedPath = file.relativePath.replace(/\\/g, "/");
    hasher.update(normalizedPath + "\n");
    hasher.update(await fsp.readFile(file.absolutePath));
  }

  return "sha256-" + hasher.digest("base64");
}

function ensureExists(distPath: string): void {
  const stats = statSync(distPath, { throwIfNoEntry: false });
  if (!stats || !stats.isDirectory()) {
    throw new Error(`Pack dist/ not found: ${distPath}. Run pnpm build first.`);
  }
}

async function listFilesRecursive(root: string): Promise<PackFileEntry[]> {
  const entries: PackFileEntry[] = [];

  async function walk(dir: string): Promise<void> {
    const dirents = await fsp.readdir(dir, { withFileTypes: true });
    for (const dirent of dirents) {
      const absolutePath = resolve(dir, dirent.name);
      if (dirent.isDirectory()) {
        await walk(absolutePath);
      } else if (dirent.isFile()) {
        entries.push({
          absolutePath,
          relativePath: relative(root, absolutePath),
        });
      }
    }
  }

  await walk(root);
  return entries;
}
