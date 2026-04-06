import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ContentSection from "@/components/ContentSection";
import MotivationCTA from "@/components/MotivationCTA";
import { useTranslation } from "react-i18next";
import { useScrollToTop } from "@/hooks/useScrollToTop";

const AthleticPerformance = () => {
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
        <h1 className="text-lg font-display font-bold">{t("athletic.title")}</h1>
      </div>

      <div className="p-4 space-y-3">
        <p className="text-xs text-muted-foreground">{t("athletic.subtitle")}</p>

        <ContentSection type="key_points" title={t("athletic.adapt.title")} feedbackId="athletic-adapt" feedbackQuestion={t("athletic.adapt.q")} items={t("athletic.adapt.items", { returnObjects: true }) as string[]} />

        <ContentSection type="tips" title={t("athletic.pre.title")} feedbackId="athletic-pre" feedbackQuestion={t("athletic.pre.q")} items={t("athletic.pre.items", { returnObjects: true }) as string[]} />

        <ContentSection type="key_points" title={t("athletic.post.title")} feedbackId="athletic-post" feedbackQuestion={t("athletic.post.q")} items={t("athletic.post.items", { returnObjects: true }) as string[]} />

        <ContentSection type="key_points" title={t("athletic.endurance.title")} feedbackId="athletic-endurance" feedbackQuestion={t("athletic.endurance.q")} items={t("athletic.endurance.items", { returnObjects: true }) as string[]} />

        <ContentSection type="data" title={t("athletic.strength.title")} feedbackId="athletic-strength" feedbackQuestion={t("athletic.strength.q")} dataRows={t("athletic.strength.rows", { returnObjects: true }) as Array<{ label: string; value: string }>} />

        <ContentSection type="key_points" title={t("athletic.benefits.title")} feedbackId="athletic-benefits" feedbackQuestion={t("athletic.benefits.q")} items={t("athletic.benefits.items", { returnObjects: true }) as string[]} />

        <ContentSection type="important" title={t("athletic.note.title")}>
          {t("athletic.note.content")}
        </ContentSection>
      </div>

      <MotivationCTA />
    </div>
  );
};

export default AthleticPerformance;
