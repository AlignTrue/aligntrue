import { Card, CardContent } from "@aligntrue/ui-base";
import { cn } from "@/lib/utils";

type SkeletonCardProps = {
  className?: string;
};

export function SkeletonCard({ className }: SkeletonCardProps) {
  return (
    <Card className={cn("h-full", className)}>
      <CardContent className="p-4 space-y-3 animate-pulse">
        <div className="flex items-center justify-between gap-2">
          <div className="h-3 w-20 bg-muted rounded" />
          <div className="h-5 w-12 bg-muted rounded-full" />
        </div>
        <div className="h-4 w-40 bg-muted rounded" />
        <div className="h-3 w-24 bg-muted rounded" />
      </CardContent>
    </Card>
  );
}
