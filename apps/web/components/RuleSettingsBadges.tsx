import { Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  hasNonDefaultSettings,
  type RuleSettings,
} from "@/lib/aligns/rule-settings";

type RuleSettingsBadgesProps = {
  settings: RuleSettings;
  className?: string;
};

type BadgeItem = {
  label: string;
  value: string;
};

export function RuleSettingsBadges({
  settings,
  className,
}: RuleSettingsBadgesProps) {
  if (!hasNonDefaultSettings(settings)) return null;

  const badges = [
    settings.appliesTo && { label: "Applies to", value: settings.appliesTo },
    settings.activation && { label: "Activation", value: settings.activation },
    settings.scope && { label: "Scope", value: settings.scope },
  ].filter((item): item is BadgeItem => Boolean(item));

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 text-sm text-foreground",
        className,
      )}
    >
      {badges.map((item) => (
        <Badge key={item.label} variant="secondary" className="text-xs">
          <span className="text-muted-foreground mr-1">{item.label}:</span>
          <span className="font-mono">{item.value}</span>
        </Badge>
      ))}
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/70 bg-muted/60 text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
            aria-label="How settings are applied"
          >
            <Info size={14} />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-80 text-sm space-y-2">
          <p className="leading-snug">
            These settings are interpreted from the rule and will be applied
            automatically based on your agent configuration during AlignTrue
            setup.
          </p>
        </PopoverContent>
      </Popover>
    </div>
  );
}
