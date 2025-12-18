import { hasKvEnv } from "@/lib/aligns/storeFactory";
import type { AlignRecord } from "@/lib/aligns/types";
import { generateOgImage } from "./generate";
import { getOgMetadata, putOgImage } from "./storage";

function hasBlobEnv(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export async function ensureOgImage(
  align: AlignRecord,
  options?: { force?: boolean },
) {
  if (!hasBlobEnv() || !hasKvEnv()) return null;

  const currentContentHash = align.contentHash ?? null;

  if (!options?.force) {
    const existing = await getOgMetadata(align.id);

    if (existing) {
      const matchesContentHash =
        currentContentHash &&
        existing.alignContentHash &&
        existing.alignContentHash === currentContentHash;
      if (matchesContentHash) {
        return existing;
      }
    }
  }

  const jpegBuffer = await generateOgImage({ align, id: align.id });
  return putOgImage({
    buffer: jpegBuffer,
    alignId: align.id,
    alignContentHash: currentContentHash,
  });
}
