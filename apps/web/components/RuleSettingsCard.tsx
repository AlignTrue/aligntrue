import { Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { RuleSettings } from "@/lib/aligns/rule-settings";

type RuleSettingsCardProps = {
  settings: RuleSettings;
  className?: string;
};

export function RuleSettingsCard({
  settings,
  className,
}: RuleSettingsCardProps) {
  const items = [
    { label: "Applies to", value: settings.appliesTo ?? "All files" },
    {
      label: "Activation",
      value: settings.activation ?? "Configured during setup",
    },
    { label: "Scope", value: settings.scope ?? "Repository root" },
  ];

  return (
    <div
      className={cn(
        "rounded-xl border bg-muted/40 text-sm text-foreground",
        className,
      )}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/60">
        <div className="font-semibold text-foreground">Rule settings</div>
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
      <div className="divide-y divide-border/60">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex items-start justify-between px-3 py-2 gap-3"
          >
            <span className="text-muted-foreground">{item.label}</span>
            <Badge
              variant="secondary"
              className="font-mono text-xs max-w-[240px] truncate"
            >
              {item.value}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
