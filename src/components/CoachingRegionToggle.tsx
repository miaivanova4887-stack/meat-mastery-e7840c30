import { COACHING_PRICING, type CoachingCountry } from "@/lib/coachingRegion";
import { cn } from "@/lib/utils";

interface CoachingRegionToggleProps {
  country: CoachingCountry;
  onChange: (country: CoachingCountry) => void;
  className?: string;
}

/**
 * Compact US/Canada region switch for the web/Android coaching-call price.
 * Lets travelers/VPN users correct an incorrect auto-detected currency.
 */
export function CoachingRegionToggle({
  country,
  onChange,
  className,
}: CoachingRegionToggleProps) {
  return (
    <div className={cn("flex flex-col items-center gap-1.5", className)}>
      <span className="text-[11px] text-muted-foreground">Showing prices for</span>
      <div className="inline-flex rounded-full bg-muted p-0.5">
        {(Object.keys(COACHING_PRICING) as CoachingCountry[]).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            className={cn(
              "px-3 py-1 text-xs font-medium rounded-full transition-colors",
              country === c
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {COACHING_PRICING[c].label}
          </button>
        ))}
      </div>
    </div>
  );
}
