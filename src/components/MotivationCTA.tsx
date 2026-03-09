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
      <div className="absolute top-1 right-2 opacity-10 group-hover:opacity-20 transition-opacity">
        <Sparkles size={40} className="text-primary" />
      </div>
      <div className="flex items-center gap-3 relative z-10">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shrink-0 shadow-sm">
          <Zap size={20} className="text-primary-foreground" fill="currentColor" />
        </div>
        <div className="flex-1">
          <p className="text-[13px] font-bold text-foreground">{t("home.motivationTitle")}</p>
          <p className="text-[11px] text-muted-foreground">{t("home.motivationDesc")}</p>
        </div>
        <ChevronRight size={16} className="text-primary/60 shrink-0 group-hover:translate-x-0.5 transition-transform" />
      </div>
    </a>
  );
};

export default MotivationCTA;
