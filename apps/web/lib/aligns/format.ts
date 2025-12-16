export type TargetFormat = "align-md" | "cursor-mdc" | "original";

export function convertAlignContentForFormat(
  content: string,
  format: TargetFormat,
): { filename: string; text: string } {
  const base = "align";
  if (format === "align-md") {
    return { filename: `${base}.md`, text: content };
  }
  if (format === "cursor-mdc") {
    return { filename: `${base}.mdc`, text: content };
  }
  // "original" falls back to markdown; callers handling original should prefer the real filename
  return { filename: `${base}.md`, text: content };
}
