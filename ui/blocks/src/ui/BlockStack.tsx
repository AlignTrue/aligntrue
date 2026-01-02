import type { PropsWithChildren } from "react";

export function BlockStack({ children }: PropsWithChildren) {
  return <div className="flex flex-col gap-3">{children}</div>;
}
