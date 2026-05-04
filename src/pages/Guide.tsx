import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ContentSection from "@/components/ContentSection";
import MotivationCTA from "@/components/MotivationCTA";
import { useTranslation } from "react-i18next";
import { useScrollToTop } from "@/hooks/useScrollToTop";

const Guide = () => {
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
        <h1 className="text-lg font-display font-bold">{t("guide.title")}</h1>
      </div>

      <div className="mx-auto w-full max-w-3xl lg:max-w-5xl p-4 space-y-3">
        <p className="text-xs text-muted-foreground">{t("guide.subtitle")}</p>

        <ContentSection type="overview" title={t("guide.whatIs.title")} feedbackId="guide-what" feedbackQuestion={t("guide.whatIs.q")}>
          {t("guide.whatIs.content")}
        </ContentSection>

        <ContentSection type="key_points" title={t("guide.foodsToEat.title")} feedbackId="guide-eat" feedbackQuestion={t("guide.foodsToEat.q")} items={t("guide.foodsToEat.items", { returnObjects: true }) as string[]} />

        <ContentSection type="key_points" title={t("guide.foodsToAvoid.title")} feedbackId="guide-avoid" feedbackQuestion={t("guide.foodsToAvoid.q")} items={t("guide.foodsToAvoid.items", { returnObjects: true }) as string[]} />

        <ContentSection type="key_points" title={t("guide.whyTry.title")} feedbackId="guide-why" feedbackQuestion={t("guide.whyTry.q")} items={t("guide.whyTry.items", { returnObjects: true }) as string[]} />

        <ContentSection type="key_points" title={t("guide.gettingStarted.title")} feedbackId="guide-start" feedbackQuestion={t("guide.gettingStarted.q")} items={t("guide.gettingStarted.items", { returnObjects: true }) as string[]} />

        <ContentSection type="data" title={t("guide.electrolytes.title")} feedbackId="guide-electrolytes" feedbackQuestion={t("guide.electrolytes.q")} dataRows={t("guide.electrolytes.rows", { returnObjects: true }) as Array<{ label: string; value: string }>} />

        <ContentSection type="important" title={t("guide.disclaimer.title")}>
          {t("guide.disclaimer.content")}
        </ContentSection>
      </div>

      <MotivationCTA />
    </div>
  );
};

export default Guide;
