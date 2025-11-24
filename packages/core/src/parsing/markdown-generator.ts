/**
 * Generate markdown from AlignSections
 */

import type { AlignSection } from "@aligntrue/schema";

/**
 * Convert sections to natural markdown format
 *
 * @param rules - List of sections
 * @param title - Optional title for the markdown file
 */
export function sectionsToMarkdown(
  rules: AlignSection[],
  title?: string,
): string {
  let markdown = "";

  if (title) {
    markdown += `# ${title}\n\n`;
  }

  for (const section of rules) {
    const level = section.level || 2;
    const heading = "#".repeat(level);
    markdown += `${heading} ${section.heading}\n\n`;
    markdown += `${section.content}\n\n`;
  }

  return markdown;
}
