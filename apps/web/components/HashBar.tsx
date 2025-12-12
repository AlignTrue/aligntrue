"use client";

type Segment = { color: string; flex: number };

const BAR_COLORS = [
  "hsl(160 84% 45%)", // primary green
  "hsl(210 90% 60%)", // accent blue
  "#F5A623", // orange
  "hsl(160 84% 35%)", // darker green
  "hsl(210 90% 50%)", // deeper blue
  "hsl(45 93% 55%)", // warm yellow
];

function idToSeed(id: string): number {
  let hash = 0;
  for (const char of id) {
    hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  }
  return Math.abs(hash);
}

function generateSegments(seed: number, count = 5): Segment[] {
  const segments: Segment[] = [];
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

type HashBarProps = {
  id: string;
  height?: number;
  className?: string;
};

export function HashBar({ id, height = 16, className }: HashBarProps) {
  const segments = generateSegments(idToSeed(id));
  return (
    <div
      className={className}
      style={{ display: "flex", height, overflow: "hidden" }}
    >
      {segments.map((seg, i) => (
        <div
          key={i}
          style={{
            flex: seg.flex,
            backgroundColor: seg.color,
          }}
        />
      ))}
    </div>
  );
}
