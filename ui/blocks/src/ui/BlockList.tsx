import type { PropsWithChildren } from "react";

export function BlockList({ children }: PropsWithChildren) {
  return (
    <ul className="divide-y divide-border rounded-md border border-border bg-card">
      {children}
    </ul>
  );
}
