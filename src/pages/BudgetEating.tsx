import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ContentSection from "@/components/ContentSection";
import MotivationCTA from "@/components/MotivationCTA";
import { useTranslation } from "react-i18next";
import { useScrollToTop } from "@/hooks/useScrollToTop";
import BudgetPlanner from "@/components/budget/BudgetPlanner";

const BudgetEating = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  useScrollToTop();

  return (
    <div className="min-h-screen bg-background" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 6.5rem)" }}>
      <div className="sticky top-0 z-40 bg-background/90 backdrop-blur-md border-b border-border px-4 pb-3 flex items-center gap-3"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}
      >
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-display font-bold">{t("budget.title")}</h1>
      </div>

      <div className="p-4 space-y-3">
        <p className="text-xs text-muted-foreground">{t("budget.subtitle")}</p>

        <ContentSection type="key_points" title={t("budget.cuts.title")} feedbackId="budget-cuts" feedbackQuestion={t("budget.cuts.q")} items={t("budget.cuts.items", { returnObjects: true }) as string[]} />

        <ContentSection type="tips" title={t("budget.shopping.title")} feedbackId="budget-shopping" feedbackQuestion={t("budget.shopping.q")} items={t("budget.shopping.items", { returnObjects: true }) as string[]} />

        <ContentSection type="key_points" title={t("budget.bulk.title")} feedbackId="budget-bulk" feedbackQuestion={t("budget.bulk.q")} items={t("budget.bulk.items", { returnObjects: true }) as string[]} />

        <ContentSection type="tips" title={t("budget.free.title")} feedbackId="budget-free" feedbackQuestion={t("budget.free.q")} items={t("budget.free.items", { returnObjects: true }) as string[]} />

        <ContentSection type="key_points" title={t("budget.prep.title")} feedbackId="budget-prep" feedbackQuestion={t("budget.prep.q")} items={t("budget.prep.items", { returnObjects: true }) as string[]} />

        <BudgetPlanner />
      </div>

      <MotivationCTA />
    </div>
  );
};

export default BudgetEating;
