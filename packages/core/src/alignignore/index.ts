/**
 * .alignignore support
 * Prevents AlignTrue from modifying specified files or patterns
 */

export {
  parseAlignignore,
  shouldIgnorePath,
  readAlignignore,
  isIgnoredByAlignignore,
} from "./parser.js";
export type { AlignignorePattern } from "./parser.js";
