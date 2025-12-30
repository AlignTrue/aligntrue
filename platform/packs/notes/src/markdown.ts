export function toggleCheckboxAtLine(
  body_md: string,
  lineIndex: number,
): {
  nextBody: string;
  beforeLine: string;
  afterLine: string;
} {
  const lines = body_md.split("\n");
  const idx = Math.floor(lineIndex);
  if (idx < 0 || idx >= lines.length) {
    throw new Error("Line index out of range for checkbox toggle");
  }
  // eslint-disable-next-line security/detect-object-injection
  const line = lines[idx];
  if (line === undefined) {
    throw new Error("Line index out of range for checkbox toggle");
  }
  const match = line.match(/^(\s*-\s*\[)( |x|X)(\]\s*)(.*)$/);
  if (!match) {
    throw new Error("Selected line is not a checkbox item");
  }
  const [, prefix, checked, suffix, rest] = match;
  const effectiveChecked = checked ?? " ";
  const nextChecked = effectiveChecked.toLowerCase() === "x" ? " " : "x";
  const nextLine = `${prefix}${nextChecked}${suffix}${rest}`;
  const nextLines = [...lines];
  nextLines.splice(idx, 1, nextLine);
  return {
    nextBody: nextLines.join("\n"),
    beforeLine: line,
    afterLine: nextLine,
  };
}
