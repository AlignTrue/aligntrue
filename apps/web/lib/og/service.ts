import { hasKvEnv } from "@/lib/aligns/storeFactory";
import type { AlignRecord } from "@/lib/aligns/types";
import { generateOgImage } from "./generate";
import { getOgMetadata, putOgImage } from "./storage";

function hasBlobEnv(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export async function ensureOgImage(align: AlignRecord) {
  // #region agent log
  fetch("http://127.0.0.1:7242/ingest/049136b8-eab0-4d42-9a7f-d42000639197", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "service.ts:ensureOgImage",
      message: "ensureOgImage called",
      data: { alignId: align.id, title: align.title },
      timestamp: Date.now(),
      sessionId: "debug-session",
      hypothesisId: "H1-H5",
    }),
  }).catch(() => {});
  // #endregion
  if (!hasBlobEnv() || !hasKvEnv()) return null;

  const currentContentHash = align.contentHash ?? null;
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

  // #region agent log
  fetch("http://127.0.0.1:7242/ingest/049136b8-eab0-4d42-9a7f-d42000639197", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "service.ts:beforeGenerate",
      message: "about to call generateOgImage",
      data: { alignId: align.id },
      timestamp: Date.now(),
      sessionId: "debug-session",
      hypothesisId: "H2",
    }),
  }).catch(() => {});
  // #endregion
  const jpegBuffer = await generateOgImage({ align, id: align.id });
  return putOgImage({
    buffer: jpegBuffer,
    alignId: align.id,
    alignContentHash: currentContentHash,
  });
}
