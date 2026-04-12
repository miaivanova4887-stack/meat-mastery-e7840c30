import { useState } from "react";
import { Zap, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import CoachingBooking from "@/components/CoachingBooking";

interface MotivationCTAProps {
  onClick?: () => void;
}

const MotivationCTA = ({ onClick }: MotivationCTAProps) => {
  const { t } = useTranslation();
  const [coachingOpen, setCoachingOpen] = useState(false);

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      setCoachingOpen(true);
    }
  };

  return (
    <>
      <button
        onClick={handleClick}
        className="motivation-cta block w-full text-left relative overflow-hidden rounded-2xl border border-border/30 dark:border-white/10 bg-card/40 dark:bg-white/5 backdrop-blur-xl backdrop-saturate-150 shadow-[0_8px_32px_-8px_hsl(var(--primary)/0.15)] p-4 active:scale-[0.98] transition-all group hover:shadow-[0_8px_32px_-4px_hsl(var(--primary)/0.25)] hover:border-primary/20"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.04] via-transparent to-primary/[0.02] pointer-events-none rounded-2xl" />
        <div className="flex items-center gap-3.5">
           <div className="w-[52px] h-[52px] rounded-2xl bg-gradient-to-br from-primary via-primary to-primary/50 flex items-center justify-center shrink-0 shadow-lg shadow-primary/25 ring-1 ring-white/20">
             <Zap size={24} className="text-primary-foreground drop-shadow-md" fill="currentColor" />
          </div>
          <div className="flex-1 relative z-10">
            <p className="text-sm font-bold text-foreground tracking-tight">{t("home.motivationTitle")}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{t("home.motivationDesc")}</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-white/30 dark:bg-white/10 backdrop-blur-sm flex items-center justify-center group-hover:bg-white/50 dark:group-hover:bg-white/15 transition-all shrink-0 ring-1 ring-white/20">
            <ChevronRight size={14} className="text-primary group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>
      </button>
      <CoachingBooking open={coachingOpen} onOpenChange={setCoachingOpen} />
    </>
  );
};

export default MotivationCTA;
