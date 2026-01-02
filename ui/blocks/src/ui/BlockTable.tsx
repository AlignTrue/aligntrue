import type { PropsWithChildren } from "react";

export function BlockTable({ children }: PropsWithChildren) {
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <table className="min-w-full divide-y divide-border text-sm">
        {children}
      </table>
    </div>
  );
}
