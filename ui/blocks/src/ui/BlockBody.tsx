import type { PropsWithChildren } from "react";

export function BlockBody({ children }: PropsWithChildren) {
  return <div className="space-y-3">{children}</div>;
}
