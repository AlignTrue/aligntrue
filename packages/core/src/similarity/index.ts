/**
 * Similarity detection module for identifying content overlap
 */

export {
  normalizeTokens,
  jaccardSimilarity,
  findSimilarContent,
  DEFAULT_SIMILARITY_THRESHOLD,
  type FileWithContent,
  type SimilarityGroup,
  type SimilarityResult,
} from "./jaccard.js";
