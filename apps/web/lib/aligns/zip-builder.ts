import JSZip from "jszip";
import type { CachedPackFile } from "./content-cache";

export async function buildPackZip(files: CachedPackFile[]): Promise<Blob> {
  const zip = new JSZip();

  for (const file of files) {
    zip.file(file.path, file.content);
  }

  return await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}

export function buildZipFilename(baseName: string): string {
  const safe = baseName.replace(/[^a-zA-Z0-9-_]+/g, "-").replace(/-+/g, "-");
  const name = safe || "align-pack";
  return `${name}.zip`;
}
