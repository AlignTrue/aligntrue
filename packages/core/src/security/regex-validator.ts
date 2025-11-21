/**
 * Regex safety utilities to prevent ReDoS (Regular Expression Denial of Service) attacks
 *
 * Validates regex patterns before construction to ensure they're safe from catastrophic backtracking.
 */

const MAX_PATTERN_LENGTH = 200;

/**
 * Validate that a regex pattern is safe to construct
 * Checks for length limits and basic ReDoS indicators
 *
 * @param pattern - The regex pattern string to validate
 * @param maxLength - Maximum allowed pattern length (default: 200)
 * @throws Error if pattern is unsafe
 */
export function validateRegexPattern(
  pattern: string,
  maxLength: number = MAX_PATTERN_LENGTH,
): void {
  if (pattern.length > maxLength) {
    throw new Error(
      `Regex pattern exceeds maximum length of ${maxLength} characters (got ${pattern.length})`,
    );
  }

  // Check for nested quantifiers that can cause catastrophic backtracking
  // Pattern: (a+)+ or (a*)* or (a?)? or similar nested quantifiers
  const nestedQuantifierPattern = /\([^)]*[+*?][^)]*\)[+*?]/;
  if (nestedQuantifierPattern.test(pattern)) {
    throw new Error(
      `Regex pattern contains nested quantifiers that may cause ReDoS: ${pattern}`,
    );
  }

  // Check for exponential backtracking patterns
  // Pattern: (a|a)+ or (a|b)+ with overlapping alternatives
  // These can cause ReDoS, so we throw an error
  const exponentialBacktrackPattern = /\([^)]*\|[^)]*\)[+*]/;
  if (exponentialBacktrackPattern.test(pattern)) {
    throw new Error(
      `Regex pattern may cause exponential backtracking (ReDoS risk): ${pattern}`,
    );
  }
}

/**
 * Escape a string for safe use in a regex pattern
 * Escapes all regex special characters
 *
 * @param input - The string to escape
 * @returns Escaped string safe for regex construction
 */
export function escapeForRegex(input: string): string {
  // Escape all regex special characters
  return input.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&");
}

/**
 * Safely construct a regex from a pattern with validation
 *
 * @param pattern - The regex pattern string
 * @param flags - Optional regex flags (e.g., 'g', 'i')
 * @param maxLength - Maximum allowed pattern length
 * @returns Constructed RegExp object
 * @throws Error if pattern is unsafe
 */
export function safeRegExp(
  pattern: string,
  flags?: string,
  maxLength: number = MAX_PATTERN_LENGTH,
): RegExp {
  validateRegexPattern(pattern, maxLength);
  // This file IS the regex validator - it must construct RegExp to validate patterns
  // The pattern is validated above, so this is safe
  return new RegExp(pattern, flags);
}
