export const BAR_COLORS = [
  "hsl(160 84% 45%)", // primary green
  "hsl(210 90% 60%)", // accent blue
  "#F5A623", // orange
  "hsl(160 84% 35%)", // darker green
  "hsl(210 90% 50%)", // deeper blue
  "hsl(45 93% 55%)", // warm yellow
];

export type BarSegment = { color: string; flex: number };

export function idToSeed(id: string): number {
  let hash = 0;
  for (const char of id) {
    hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  }
  return Math.abs(hash);
}

export function generateBarSegments(seed: number, count = 5): BarSegment[] {
  const segments: BarSegment[] = [];
  let s = seed;
  for (let i = 0; i < count; i++) {
    s = ((s * 1103515245 + 12345) >>> 0) % 2147483648;
    segments.push({
      color: BAR_COLORS[s % BAR_COLORS.length],
      flex: 1 + (s % 8),
    });
  }
  return segments;
}
