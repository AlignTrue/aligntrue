#!/usr/bin/env node

/**
 * Admin utility to delete aligns directly from Upstash Redis.
 *
 * Usage:
 *   export UPSTASH_REDIS_REST_URL="..."
 *   export UPSTASH_REDIS_REST_TOKEN="..."
 *   node scripts/admin-delete-aligns.mjs <align-id> [align-id-2 ...]
 *
 * Flags:
 *   --yes | -y   Skip confirmation prompt
 */

import { Redis } from "@upstash/redis";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const ALIGN_KEY_PREFIX = "v1:align:";
const CREATED_ZSET = "v1:align:by-created";
const INSTALLS_ZSET = "v1:align:by-installs";
const KIND_RULE_SET = "idx:kind:rule";
const KIND_PACK_SET = "idx:kind:pack";
const CONTENT_PREFIX = "v1:content:";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

function createRedis() {
  // Validate env before constructing the client to give clearer errors.
  requireEnv("UPSTASH_REDIS_REST_URL");
  requireEnv("UPSTASH_REDIS_REST_TOKEN");
  return Redis.fromEnv();
}

function alignKey(id) {
  return `${ALIGN_KEY_PREFIX}${id}`;
}

function contentKey(id) {
  return `${CONTENT_PREFIX}${id}`;
}

async function deleteAlign(redis, id) {
  console.log(`\nDeleting align: ${id}`);

  // Fetch once to report state and to know the kind if present.
  const existing = await redis.get(alignKey(id));
  const kind = existing?.kind;

  const ops = [
    redis.del(alignKey(id)),
    redis.zrem(CREATED_ZSET, id),
    redis.zrem(INSTALLS_ZSET, id),
    // Remove from both kind sets to be safe; if kind is known, this is still cheap.
    redis.srem(KIND_RULE_SET, id),
    redis.srem(KIND_PACK_SET, id),
    redis.del(contentKey(id)),
  ];

  await Promise.all(ops);

  if (existing) {
    console.log(
      `Deleted record (kind: ${kind ?? "unknown"}, title: ${
        existing.title ?? "n/a"
      })`,
    );
  } else {
    console.log("Record not found; cleaned up indexes and caches anyway.");
  }
}

async function main() {
  const rawArgs = process.argv.slice(2).filter(Boolean);
  const skipConfirm = rawArgs.includes("--yes") || rawArgs.includes("-y");
  const ids = rawArgs.filter((arg) => arg !== "--yes" && arg !== "-y");

  if (ids.length === 0) {
    console.error(
      "Usage: node scripts/admin-delete-aligns.mjs <align-id> [align-id-2 ...]",
    );
    console.error("Add --yes to skip confirmation.");
    process.exit(1);
  }

  if (!skipConfirm) {
    if (!input.isTTY) {
      console.error(
        "Confirmation required. Re-run with --yes to skip prompt in non-interactive environments.",
      );
      process.exit(1);
    }

    console.log("This will delete the following align(s):");
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

  const redis = createRedis();
  let failures = 0;

  for (const id of ids) {
    try {
      await deleteAlign(redis, id);
    } catch (error) {
      failures += 1;
      console.error(
        `Failed to delete ${id}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  if (failures > 0) {
    console.error(`\nCompleted with ${failures} failure(s).`);
    process.exit(1);
  }

  console.log("\nAll requested aligns processed successfully.");
}

main().catch((error) => {
  console.error("Fatal error:", error instanceof Error ? error.message : error);
  process.exit(1);
});
