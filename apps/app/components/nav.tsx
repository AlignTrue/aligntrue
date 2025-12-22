import Link from "next/link";
import type { Route } from "next";

const links = [
  { href: "/inbox", label: "Inbox" },
  { href: "/tasks", label: "Tasks" },
  { href: "/notes", label: "Notes" },
  { href: "/timeline", label: "Timeline" },
  { href: "/contacts", label: "Contacts" },
  { href: "/plans", label: "Plans" },
] satisfies { href: Route; label: string }[];

export function Nav() {
  return (
    <nav className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 text-sm">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="text-muted-foreground hover:text-foreground"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
