import React from "react";
import Link from "next/link";

export function Nav() {
  return (
    <nav className="border-b bg-background px-4 py-2">
      <div className="mx-auto flex max-w-4xl items-center justify-between">
        <Link href="/" className="font-bold">
          AlignTrue App
        </Link>
        <div className="flex gap-4 text-sm">
          <Link href="/tasks">Tasks</Link>
          <Link href="/notes">Notes</Link>
          <Link href="/review">Review</Link>
          <Link href="/timeline">Timeline</Link>
        </div>
      </div>
    </nav>
  );
}
