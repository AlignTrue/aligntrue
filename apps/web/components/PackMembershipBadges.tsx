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
  const label =
    packs.length === 1 ? "Part of this pack" : "Part of these packs";
  return (
    <div className={className}>
      <p className="text-sm text-muted-foreground mb-2">{label}</p>
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
