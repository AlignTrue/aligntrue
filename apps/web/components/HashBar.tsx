"use client";

import { generateBarSegments, idToSeed } from "@/lib/aligns/hash-bar-utils";

type HashBarProps = {
  id: string;
  height?: number;
  className?: string;
};

export function HashBar({ id, height = 16, className }: HashBarProps) {
  const segments = generateBarSegments(idToSeed(id));
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
