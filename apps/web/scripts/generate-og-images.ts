/**
 * OG backfill script. Requires BLOB_READ_WRITE_TOKEN and KV env vars.
 *
 * Run from apps/web:
 *   pnpm dlx vercel env pull --environment=production .env.local
 *   pnpm dlx dotenv-cli -e .env.local -- pnpm generate:og-images
 *   rm .env.local
 *
 * pnpm subprocesses do not inherit shell-sourced vars; dotenv-cli loads them.
 * Delete .env.local afterward because it contains secrets.
 */
import { Redis } from "@upstash/redis";
import { hasKvEnv } from "@/lib/aligns/storeFactory";
import type { AlignRecord } from "@/lib/aligns/types";
import { ensureOgImage } from "@/lib/og/service";
import { getOgMetadata } from "@/lib/og/storage";

const ALIGN_KEY_PREFIX = "v1:align:";
const CREATED_ZSET = "v1:align:by-created";

function requireEnv() {
  if (!hasKvEnv()) {
    throw new Error(
      "KV env vars missing (UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN or KV_REST_API_URL/KV_REST_API_TOKEN)",
    );
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN is required for OG generation");
  }
}

async function fetchAllAligns(redis: Redis): Promise<AlignRecord[]> {
  const ids = (await redis.zrange(CREATED_ZSET, 0, -1, {
    rev: true,
  })) as string[];
  if (!ids.length) return [];
  const records = (await redis.mget(
    ids.map((id) => `${ALIGN_KEY_PREFIX}${id}`),
  )) as AlignRecord[];
  return records.filter(Boolean) as AlignRecord[];
}

async function main() {
  requireEnv();
  const redis = Redis.fromEnv();

  const records = await fetchAllAligns(redis);
  console.log(`Found ${records.length} align(s) to check`);

  let generated = 0;
  let skipped = 0;

  for (const record of records) {
    const meta = await getOgMetadata(record.id);
    if (
      meta &&
      record.contentHash &&
      meta.alignContentHash === record.contentHash
    ) {
      skipped += 1;
      continue;
    }
    await ensureOgImage(record);
    generated += 1;
  }

  console.log(
    `Completed OG generation. generated=${generated}, skipped=${skipped}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
