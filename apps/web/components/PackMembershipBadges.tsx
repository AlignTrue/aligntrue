import Link from "next/link";
import type { AlignRecord } from "@/lib/aligns/types";
import { Badge } from "@/components/ui/badge";

type PackMembershipBadgesProps = {
  packs: AlignRecord[];
  className?: string;
};

export function PackMembershipBadges({
  packs,
  className,
}: PackMembershipBadgesProps) {
  if (!packs.length) return null;
  return (
    <div className={className}>
      <p className="text-sm text-muted-foreground mb-2">Part of these packs</p>
      <div className="flex flex-wrap gap-2">
        {packs.map((pack) => (
          <Badge key={pack.id} variant="secondary" className="text-xs">
            <Link href={`/a/${pack.id}`} className="hover:underline">
              {pack.title || pack.id}
            </Link>
          </Badge>
        ))}
      </div>
    </div>
  );
}
