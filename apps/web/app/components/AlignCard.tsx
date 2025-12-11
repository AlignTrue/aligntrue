import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { filenameFromUrl, parseGitHubUrl } from "@/lib/aligns/urlUtils";
import { formatBytes } from "@/lib/utils";
import type { AlignRecord } from "@/lib/aligns/types";

export type AlignSummary = Pick<
  AlignRecord,
  | "id"
  | "title"
  | "description"
  | "provider"
  | "normalizedUrl"
  | "kind"
  | "url"
  | "pack"
>;

type AlignCardProps = {
  align: AlignSummary;
};

export function AlignCard({ align }: AlignCardProps) {
  const { owner } = parseGitHubUrl(align.normalizedUrl);
  const isPack = align.kind === "pack";
  const filename = filenameFromUrl(align.normalizedUrl || align.url);
  const fileCount = isPack ? (align.pack?.files?.length ?? 0) : 0;
  const sizeLabel =
    isPack && align.pack?.totalBytes
      ? formatBytes(align.pack.totalBytes)
      : null;
  const packMetaLabel =
    isPack && fileCount
      ? `${fileCount} file${fileCount === 1 ? "" : "s"}${
          sizeLabel ? ` · ${sizeLabel}` : ""
        }`
      : sizeLabel;

  return (
    <Link href={`/a/${align.id}`} className="block h-full">
      <Card className="h-full transition hover:shadow-md hover:-translate-y-0.5">
        <CardContent className="p-4 space-y-3 text-left">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs sm:text-[11px] text-muted-foreground truncate">
              <span className="font-medium text-foreground/80">{filename}</span>
              <span className="mx-1 text-border">•</span>
              <span className="font-semibold text-foreground">{owner}</span>
            </span>
            <div className="flex items-center gap-2">
              <Badge
                variant={isPack ? "default" : "secondary"}
                className="text-[11px] py-1"
              >
                {isPack ? "Pack" : "Rule"}
              </Badge>
              {packMetaLabel && (
                <Badge
                  variant="outline"
                  className="font-semibold text-[11px] py-1"
                >
                  {packMetaLabel}
                </Badge>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-semibold text-foreground line-clamp-2 text-left">
              {align.title || "Untitled align"}
            </h3>
            {align.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 leading-6 text-left">
                {align.description}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
