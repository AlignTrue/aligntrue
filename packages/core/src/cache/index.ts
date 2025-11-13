/**
 * Cache module exports
 */

export {
  CacheManager,
  gitCacheKey,
  validationCacheKey,
  estimateSize,
} from "./manager.js";

export type { CacheEntry, CacheOptions, CacheStats } from "./manager.js";

export { loadDetectionCache, saveDetectionCache } from "./agent-detection.js";

export type { DetectionCache } from "./agent-detection.js";
