import { hashCanonical } from "../identity/hash.js";

export function contentHash(body_md: string): string {
  return hashCanonical(body_md);
}

export function toggleCheckboxAtLine(
  body_md: string,
  lineIndex: number,
): {
  nextBody: string;
  beforeLine: string;
  afterLine: string;
} {
  const lines = body_md.split("\n");
  if (lineIndex < 0 || lineIndex >= lines.length) {
    throw new Error("Line index out of range for checkbox toggle");
  }
  const line = lines[lineIndex] ?? "";
  const match = line.match(/^(\s*-\s*\[)( |x|X)(\]\s*)(.*)$/);
  if (!match) {
    throw new Error("Selected line is not a checkbox item");
  }
  const [, prefix, checked, suffix, rest] = match;
  const effectiveChecked = checked ?? " ";
  const nextChecked = effectiveChecked.toLowerCase() === "x" ? " " : "x";
  const nextLine = `${prefix}${nextChecked}${suffix}${rest}`;
  const nextLines = [...lines];
  nextLines[lineIndex] = nextLine;
  return {
    nextBody: nextLines.join("\n"),
    beforeLine: line,
    afterLine: nextLine,
  };
}
