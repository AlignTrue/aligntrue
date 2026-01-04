import { hasKvEnv } from "../kv/factory.js";
import type { OgContent } from "./generate.js";
import { generateOgImage } from "./generate.js";
import { getOgMetadata, putOgImage, type OgMetadata } from "./storage.js";

function hasBlobEnv(): boolean {
  return Boolean(process.env["BLOB_READ_WRITE_TOKEN"]);
}

export async function ensureOgImage(options: {
  id: string;
  content: OgContent;
  /**
   * Optional hash representing the source content. When unchanged, the prior OG
   * image is reused.
   */
  dataHash?: string | null;
  force?: boolean;
}): Promise<OgMetadata | null> {
  const { id, content, dataHash, force } = options;
  if (!hasBlobEnv() || !hasKvEnv()) return null;

  const currentHash = dataHash ?? null;

  if (!force) {
    const existing = await getOgMetadata(id);
    const matchesContent =
      currentHash && existing?.dataHash && existing.dataHash === currentHash;
    if (existing && matchesContent) {
      return existing;
    }
  }

  const jpegBuffer = await generateOgImage({ content, id });
  const upload = await putOgImage({
    buffer: jpegBuffer,
    id,
    dataHash: currentHash,
  });

  return {
    contentHash: upload.contentHash,
    url: upload.url,
    generatedAt: new Date().toISOString(),
    ...(currentHash ? { dataHash: currentHash } : {}),
  };
}
