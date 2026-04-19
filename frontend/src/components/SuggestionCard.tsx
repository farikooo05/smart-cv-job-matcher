import { cn } from "../lib/utils";
import { Lightbulb, AlertTriangle, CheckCircle2, ArrowUpRight } from "lucide-react";
import type { SuggestionsProps } from "../types/GeminiResponseProps";

export function SuggestionCard({ type, title, description, actionLabel, actionUrl }: SuggestionsProps) {
  const config = {
    improvement: {
      icon: Lightbulb,
      bg: "bg-primary/10",
      border: "border-primary/20",
      iconColor: "text-primary",
    },
    warning: {
      icon: AlertTriangle,
      bg: "bg-warning/10",
      border: "border-warning/20",
      iconColor: "text-warning",
    },
    positive: {
      icon: CheckCircle2,
      bg: "bg-success/10",
      border: "border-success/20",
      iconColor: "text-success",
    },
  };

  const { icon: Icon, bg, border, iconColor } = config[type];

  return (
    <div
      className={cn(
        "group rounded-xl border p-4 transition-all hover:shadow-md",
        bg,
        border
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn("mt-0.5 rounded-lg p-2", bg)}>
          <Icon className={cn("h-5 w-5", iconColor)} />
        </div>
        <div className="flex-1">
          <h4 className="mb-1 font-semibold text-foreground">{title}</h4>
          <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
          {actionLabel && (
            <button className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary transition-colors hover:underline">
              <a href={actionUrl}>{actionLabel}</a>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
