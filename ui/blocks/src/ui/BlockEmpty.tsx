import type { PropsWithChildren } from "react";

export function BlockEmpty({ children }: PropsWithChildren) {
  return (
    <div className="rounded-md border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
      {children ?? "No content"}
    </div>
  );
}
