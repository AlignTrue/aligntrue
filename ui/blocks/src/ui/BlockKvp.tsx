import type { PropsWithChildren } from "react";

export function BlockKvp({ children }: PropsWithChildren) {
  return (
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {children}
    </dl>
  );
}
