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
      className="block relative overflow-hidden bg-gradient-to-r from-primary/10 via-primary/5 to-accent/10 border border-primary/20 rounded-xl p-4 mx-4 mb-4 mt-6 transition-all hover:border-primary/40 hover:shadow-md active:scale-[0.98] group"
    >
      <div className="absolute -top-4 -right-4 w-24 h-24 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors" />
      <div className="absolute top-2 right-3 opacity-10 group-hover:opacity-20 transition-opacity">
        <Sparkles size={36} className="text-primary" />
      </div>
      <div className="flex items-center gap-3.5 relative z-10">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary via-primary to-primary/60 flex items-center justify-center shrink-0 shadow-md ring-1 ring-primary/20">
          <Zap size={22} className="text-primary-foreground drop-shadow-sm" fill="currentColor" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-foreground tracking-tight">{t("home.motivationTitle")}</p>
          <p className="text-[11px] text-muted-foreground">{t("home.motivationDesc")}</p>
        </div>
        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
          <ChevronRight size={13} className="text-primary" />
        </div>
      </div>
    </a>
  );
};

export default MotivationCTA;
