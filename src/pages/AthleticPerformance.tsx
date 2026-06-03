import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ContentSection from "@/components/ContentSection";
import MotivationCTA from "@/components/MotivationCTA";
import CorpusItemRenderer from "@/components/CorpusItemRenderer";
import { useArticleSlots } from "@/hooks/useArticleSlots";
import { getCorpusItem, getPageItems } from "@/data/articleCorpus";
import { useTranslation } from "react-i18next";
import { useScrollToTop } from "@/hooks/useScrollToTop";
import { useMemo } from "react";

const AthleticPerformance = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  useScrollToTop();

  const initialIds = useMemo(() => getPageItems("athletic").map((i) => i.id), []);
  const { slots, onDismiss } = useArticleSlots(initialIds);

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

      <div className="mx-auto w-full max-w-3xl lg:max-w-5xl p-4 space-y-3">
        <p className="text-xs text-muted-foreground">{t("athletic.subtitle")}</p>

        {slots.map((id, i) => {
          const item = getCorpusItem(id);
          if (!item) return null;
          return <CorpusItemRenderer key={id} item={item} onDismiss={onDismiss} index={i} />;
        })}

        <ContentSection type="important" title={t("athletic.note.title")}>
          {t("athletic.note.content")}
        </ContentSection>
      </div>

      <MotivationCTA />
    </div>
  );
};

export default AthleticPerformance;
