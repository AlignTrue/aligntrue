#!/usr/bin/env node

/**
 * Migrate GitHub-origin packs (.align.yaml) to catalog-native packs.
 *
 * This converts existing pack records in Upstash Redis:
 * - source: "github" -> "catalog"
 * - url/normalizedUrl -> https://aligntrue.ai/a/<id>
 * - ensures containsAlignIds exists (keeps existing if present)
 *
 * Usage:
 *   export UPSTASH_REDIS_REST_URL="..."
 *   export UPSTASH_REDIS_REST_TOKEN="..."
 *   node apps/web/scripts/admin-migrate-github-packs-to-catalog.mjs [--yes]
 *
 * Flags:
 *   --yes | -y   Skip confirmation prompt
 */

import { Redis } from "@upstash/redis";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const ALIGN_KEY_PREFIX = "v1:align:";
const KIND_PACK_SET = "idx:kind:pack";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

function createRedis() {
  requireEnv("UPSTASH_REDIS_REST_URL");
  requireEnv("UPSTASH_REDIS_REST_TOKEN");
  return Redis.fromEnv();
}

function alignKey(id) {
  return `${ALIGN_KEY_PREFIX}${id}`;
}

async function fetchPackIds(redis) {
  const ids = await redis.smembers(KIND_PACK_SET);
  return Array.isArray(ids) ? ids : [];
}

function toCatalogUrls(id) {
  const url = `https://aligntrue.ai/a/${id}`;
  return { url, normalizedUrl: url };
}

function summarize(record) {
  return `title="${record.title ?? "n/a"}", author="${record.author ?? "n/a"}"`;
}

async function migratePack(redis, id) {
  const key = alignKey(id);
  const record = await redis.get(key);
  if (!record) {
    console.warn(`- ${id}: record missing; skipped`);
    return { migrated: false };
  }
  if (record.kind !== "pack") {
    console.warn(`- ${id}: kind=${record.kind} (expected pack); skipped`);
    return { migrated: false };
  }
  if (record.source === "catalog") {
    console.log(`- ${id}: already catalog; skipped`);
    return { migrated: false };
  }
  if (record.source && record.source !== "github") {
    console.warn(`- ${id}: source=${record.source}; skipped`);
    return { migrated: false };
  }

  const { url, normalizedUrl } = toCatalogUrls(id);
  const nextContains = Array.isArray(record.containsAlignIds)
    ? record.containsAlignIds
    : [];

  const updated = {
    ...record,
    source: "catalog",
    url,
    normalizedUrl,
    // keep pack.files and contentHash if present
    containsAlignIds: nextContains,
  };

  await redis.set(key, updated);
  console.log(`- ${id}: migrated -> catalog (${summarize(updated)})`);
  return { migrated: true };
}

async function confirmProceed(ids) {
  if (!input.isTTY) {
    console.error(
      "Confirmation required. Re-run with --yes to skip prompt in non-interactive environments.",
    );
    process.exit(1);
  }
  console.log("This will migrate the following pack(s):");
  ids.forEach((id) => console.log(`- ${id}`));
  const rl = readline.createInterface({ input, output });
  const answer = await rl.question("Proceed? [y/N]: ");
  rl.close();
  const normalized = answer.trim().toLowerCase();
  if (normalized !== "y" && normalized !== "yes") {
    console.log("Aborted.");
    process.exit(0);
  }
}

async function main() {
  const skipConfirm =
    process.argv.includes("--yes") || process.argv.includes("-y");

  const redis = createRedis();
  const packIds = await fetchPackIds(redis);
  const githubPackIds = [];

  for (const id of packIds) {
    const record = await redis.get(alignKey(id));
    if (record && record.kind === "pack" && record.source === "github") {
      githubPackIds.push(id);
    }
  }

  if (githubPackIds.length === 0) {
    console.log("No GitHub-origin packs found. Nothing to migrate.");
    return;
  }

  if (!skipConfirm) {
    await confirmProceed(githubPackIds);
  }

  let migrated = 0;
  let skipped = 0;
  for (const id of githubPackIds) {
    const result = await migratePack(redis, id);
    migrated += result.migrated ? 1 : 0;
    skipped += result.migrated ? 0 : 1;
  }

  console.log(
    `\nMigration complete. Migrated ${migrated}, skipped ${skipped}, total ${githubPackIds.length}.`,
  );
  console.log(
    "Note: Pack content cache is untouched; rerender will use catalog URLs. If needed, clear pack caches separately.",
  );
}

main().catch((error) => {
  console.error("Fatal error:", error instanceof Error ? error.message : error);
  process.exit(1);
});
