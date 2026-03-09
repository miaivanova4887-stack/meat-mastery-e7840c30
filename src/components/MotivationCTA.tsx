import { Phone, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

const CALENDLY_URL = "https://calendly.com";

const MotivationCTA = () => {
  const { t } = useTranslation();
  return (
    <a
      href={CALENDLY_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-card border border-border rounded-lg p-4 mx-4 mb-4 mt-6 transition-all hover:border-primary/30 active:scale-[0.98]"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Phone size={18} className="text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-[13px] font-bold text-foreground">{t("home.motivationTitle")}</p>
          <p className="text-[11px] text-muted-foreground">{t("home.motivationDesc")}</p>
        </div>
        <ChevronRight size={16} className="text-muted-foreground shrink-0" />
      </div>
    </a>
  );
};

export default MotivationCTA;
