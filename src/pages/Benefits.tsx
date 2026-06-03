import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useUserProfile } from "@/contexts/UserProfileContext";
import MotivationCTA from "@/components/MotivationCTA";
import CorpusItemRenderer from "@/components/CorpusItemRenderer";
import { useArticleSlots } from "@/hooks/useArticleSlots";
import { getCorpusItem, getPageItems } from "@/data/articleCorpus";
import { useTranslation } from "react-i18next";
import { useMemo } from "react";

const Benefits = () => {
  const navigate = useNavigate();
  const profile = useUserProfile();
  const { t } = useTranslation();
  const sex = profile.body.sex; // "male" | "female" | undefined

  const { initialIds, excluded } = useMemo(() => {
    const all = getPageItems("benefits");
    const include: string[] = [];
    const exclude = new Set<string>();
    for (const it of all) {
      if (it.sex && it.sex !== sex) {
        exclude.add(it.id);
      } else {
        include.push(it.id);
      }
    }
    return { initialIds: include, excluded: exclude };
  }, [sex]);

  const { slots, onDismiss } = useArticleSlots(initialIds, { extraExcluded: excluded });

  return (
    <div className="min-h-screen bg-background" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 6.5rem)" }}>
      <div className="sticky top-0 z-40 bg-background/90 backdrop-blur-md border-b border-border px-4 pb-3 flex items-center gap-3"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}
      >
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground"><ArrowLeft size={20} /></button>
        <h1 className="text-lg font-display font-bold">{t("benefits.title")}</h1>
      </div>
      <div className="mx-auto w-full max-w-3xl lg:max-w-5xl p-4 space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
        {slots.map((id, i) => {
          const item = getCorpusItem(id);
          if (!item) return null;
          return <CorpusItemRenderer key={id} item={item} onDismiss={onDismiss} index={i} />;
        })}
      </div>
      <MotivationCTA />
    </div>
  );
};

export default Benefits;
