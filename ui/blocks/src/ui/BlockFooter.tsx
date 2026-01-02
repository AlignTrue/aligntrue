import type { PropsWithChildren } from "react";

export function BlockFooter({ children }: PropsWithChildren) {
  return (
    <div className="mt-4 flex items-center justify-end gap-2 border-t border-border pt-3">
      {children}
    </div>
  );
}
