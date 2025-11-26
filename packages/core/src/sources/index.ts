/**
 * Source management utilities
 */

export {
  isAlignManifest,
  loadManifest,
  getFileCustomizations,
  applyCustomizations,
  applyPlugCustomizations,
  parseAlignUrl,
  type ManifestLoadResult,
  type ManifestLoadOptions,
  type ParsedAlignUrl,
} from "./manifest-loader.js";

export { parseSourceURL, type ParsedSourceURL } from "./url-parser.js";
