/**
 * Generate stable fingerprints for markdown sections
 * Used for change tracking and deduplication
 */

import { computeHash } from "@aligntrue/schema";

/**
 * Generate a stable fingerprint from section heading and content
 *
 * Format: {kebab-case-heading}-{6-char-content-hash}
 * Example: "testing-instructions-a3f5b2"
 *
 * @param heading - Section heading (e.g., "Testing Instructions")
 * @param content - Section content (markdown prose)
 * @returns Stable fingerprint string
 */
export function generateFingerprint(heading: string, content: string): string {
  // Normalize heading to kebab-case
  const normalizedHeading = heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // Replace non-alphanumeric with dashes
    .replace(/^-|-$/g, "") // Remove leading/trailing dashes
    .slice(0, 50); // Limit to 50 chars for readability

  // Hash content for uniqueness (normalized to handle whitespace changes)
  const normalizedContent = normalizeContent(content);
  const contentHash = computeHash(normalizedContent).slice(0, 6); // First 6 chars sufficient for uniqueness

  return `${normalizedHeading}-${contentHash}`;
}

/**
 * Normalize content for stable hashing
 * Removes insignificant whitespace differences
 */
export function normalizeContent(content: string): string {
  return (
    content
      .replace(/\r\n/g, "\n") // Normalize line endings
      .replace(/\r/g, "\n") // Handle Mac classic line endings
      // Normalize multiple spaces to single space for consistent hashing
      .replace(/\s+/g, " ")
      .trim()
  );
}

/**
 * Extract explicit ID from content if present
 * Users can specify <!-- aligntrue-id: custom-id --> in content
 */
export function extractExplicitId(content: string): string | undefined {
  const match = content.match(/<!--\s*aligntrue-id:\s*([a-z0-9.-]+)\s*-->/);
  return match?.[1];
}

/**
 * Validate fingerprint format
 */
export function isValidFingerprint(fingerprint: string): boolean {
  // Format: lowercase-kebab-case-abc123
  // Static regex pattern with bounded quantifiers - safe from ReDoS
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?-[a-f0-9]{6}$/.test(fingerprint);
}

/**
 * Compare two fingerprints to determine if they represent the same section
 * Handles both exact matches and heading-only matches (for renamed sections)
 */
export function isSameSection(fp1: string, fp2: string): boolean {
  if (fp1 === fp2) {
    return true; // Exact match
  }

  // Check if headings match (content changed)
  const heading1 = fp1.substring(0, fp1.lastIndexOf("-"));
  const heading2 = fp2.substring(0, fp2.lastIndexOf("-"));

  return heading1 === heading2;
}
