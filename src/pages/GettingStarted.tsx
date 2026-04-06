import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ContentSection from "@/components/ContentSection";
import MotivationCTA from "@/components/MotivationCTA";
import { useTranslation } from "react-i18next";
import { useScrollToTop } from "@/hooks/useScrollToTop";

const GettingStarted = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  useScrollToTop();

  return (
    <div className="min-h-screen bg-background" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 6.5rem)" }}>
      <div className="sticky top-0 z-40 bg-background/90 backdrop-blur-md border-b border-border px-4 pb-3 flex items-center gap-3"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}
      >
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-display font-bold">{t("gettingStarted.title")}</h1>
      </div>

      <div className="p-4 space-y-3">
        <p className="text-xs text-muted-foreground">{t("gettingStarted.subtitle")}</p>

        <ContentSection type="key_points" title={t("gettingStarted.week1.title")} feedbackId="started-w1" feedbackQuestion={t("gettingStarted.week1.q")} items={t("gettingStarted.week1.items", { returnObjects: true }) as string[]} />

        <ContentSection type="key_points" title={t("gettingStarted.week2.title")} feedbackId="started-w2" feedbackQuestion={t("gettingStarted.week2.q")} items={t("gettingStarted.week2.items", { returnObjects: true }) as string[]} />

        <ContentSection type="key_points" title={t("gettingStarted.week3.title")} feedbackId="started-w3" feedbackQuestion={t("gettingStarted.week3.q")} items={t("gettingStarted.week3.items", { returnObjects: true }) as string[]} />

        <ContentSection type="key_points" title={t("gettingStarted.week4.title")} feedbackId="started-w4" feedbackQuestion={t("gettingStarted.week4.q")} items={t("gettingStarted.week4.items", { returnObjects: true }) as string[]} />

        <ContentSection type="tips" title={t("gettingStarted.tips.title")} feedbackId="started-tips" feedbackQuestion={t("gettingStarted.tips.q")} items={t("gettingStarted.tips.items", { returnObjects: true }) as string[]} />

        <ContentSection type="important" title={t("gettingStarted.warning.title")}>
          {t("gettingStarted.warning.content")}
        </ContentSection>
      </div>

      <MotivationCTA />
    </div>
  );
};

export default GettingStarted;
