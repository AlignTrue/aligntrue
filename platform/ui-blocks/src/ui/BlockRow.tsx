import type { PropsWithChildren } from "react";

export function BlockRow({ children }: PropsWithChildren) {
  return <div className="flex flex-row items-center gap-3">{children}</div>;
}
