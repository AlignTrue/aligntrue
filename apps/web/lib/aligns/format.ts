export type TargetFormat = "align-md" | "cursor-mdc";

export function convertAlignContentForFormat(
  content: string,
  format: TargetFormat,
): { filename: string; text: string } {
  const base = "align";
  if (format === "cursor-mdc") {
    return { filename: `${base}.mdc`, text: content };
  }
  return { filename: `${base}.md`, text: content };
}
