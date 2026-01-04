import { createHash } from "node:crypto";
import { Redis } from "@upstash/redis";
import { put } from "@vercel/blob";

import { getRedis, hasKvEnv } from "../kv/factory.js";

const OG_META_PREFIX = "v1:og:meta:";
const OG_PATH_PREFIX = "og/";

type UploadResult = Awaited<ReturnType<typeof put>>;

export type OgImageResult = {
  url: string;
  contentHash: string;
  size: number;
  key: string;
};

export type OgMetadata = {
  contentHash: string;
  url: string;
  generatedAt: string;
  dataHash?: string;
};

let redisClient: Redis | null = null;

function ensureRedis(): Redis {
  if (!redisClient) {
    redisClient = getRedis();
  }
  return redisClient;
}

function metaKey(id: string) {
  return `${OG_META_PREFIX}${id}`;
}

function computeContentHash(buffer: Buffer) {
  const hex = createHash("sha256").update(buffer).digest("hex");
  return {
    contentHash: `sha256:${hex}`,
    objectKey: `${OG_PATH_PREFIX}${hex}.jpg`,
  };
}

async function uploadToBlob(
  buffer: Buffer,
  objectKey: string,
): Promise<UploadResult> {
  return put(objectKey, buffer, {
    access: "public",
    contentType: "image/jpeg",
    cacheControlMaxAge: 31536000,
    addRandomSuffix: false,
    // Content-hash key is deterministic; allow overwrite so force regeneration succeeds.
    allowOverwrite: true,
  });
}

export async function putOgImage(options: {
  buffer: Buffer;
  id: string;
  dataHash?: string | null;
}): Promise<OgImageResult> {
  const { buffer, id, dataHash } = options;
  const { contentHash, objectKey } = computeContentHash(buffer);
  const upload = await uploadToBlob(buffer, objectKey);

  const metadata: OgMetadata = {
    contentHash,
    url: upload.url,
    generatedAt: new Date().toISOString(),
    ...(dataHash ? { dataHash } : {}),
  };
  if (hasKvEnv()) {
    await ensureRedis().set(metaKey(id), metadata);
  } else {
    console.warn(
      "[og] KV env not configured; skipping OG metadata persistence",
    );
  }

  return {
    url: upload.url,
    contentHash,
    size: buffer.byteLength,
    key: objectKey,
  };
}

export async function getOgMetadata(id: string): Promise<OgMetadata | null> {
  if (!hasKvEnv()) return null;
  try {
    return (await ensureRedis().get<OgMetadata>(metaKey(id))) ?? null;
  } catch (error) {
    console.error("failed to read OG metadata", error);
    return null;
  }
}

export async function getOgUrl(id: string): Promise<string | null> {
  const meta = await getOgMetadata(id);
  return meta?.url ?? null;
}
