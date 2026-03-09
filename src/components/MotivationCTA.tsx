import { Zap, ChevronRight, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";

const CALENDLY_URL = "https://calendly.com";

const MotivationCTA = () => {
  const { t } = useTranslation();
  return (
    <a
      href={CALENDLY_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="block mx-4 mb-4 mt-6 relative overflow-hidden rounded-2xl p-[1px] bg-gradient-to-br from-primary/40 via-primary/20 to-primary/5 active:scale-[0.98] transition-all group"
    >
      <div className="relative overflow-hidden rounded-[15px] bg-card p-4 flex items-center gap-3.5">
        <div className="absolute -top-6 -right-6 w-32 h-32 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-colors" />
        <div className="absolute top-3 right-4 opacity-[0.07] group-hover:opacity-15 transition-opacity">
          <Sparkles size={44} className="text-primary" />
        </div>
        <div className="w-13 h-13 min-w-[52px] min-h-[52px] rounded-2xl bg-gradient-to-br from-primary via-primary to-primary/50 flex items-center justify-center shrink-0 shadow-lg ring-1 ring-white/10">
          <Zap size={24} className="text-primary-foreground drop-shadow-md" fill="currentColor" />
        </div>
        <div className="flex-1 relative z-10">
          <p className="text-sm font-bold text-foreground tracking-tight">{t("home.motivationTitle")}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{t("home.motivationDesc")}</p>
        </div>
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center group-hover:from-primary/25 group-hover:to-primary/10 transition-all shrink-0">
          <ChevronRight size={14} className="text-primary group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>
    </a>
  );
};

export default MotivationCTA;
