import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, BatteryCharging, BarChart3, BookHeart, Brain, Calendar,
  Clock, Coffee, Droplets, Eye, Flame, Heart, Leaf, Lightbulb, Moon,
  RefreshCw, Scale, Shield, ShieldCheck, Sparkles, Star, Target,
  TrendingDown, Users, Utensils, Zap, ChevronRight,
} from "lucide-react";
import ContentSection from "@/components/ContentSection";
import DismissibleCard from "@/components/DismissibleCard";
import ArticleFeedback from "@/components/ArticleFeedback";
import type { ArticleCorpusItem } from "@/data/articleCorpus";

const ICONS: Record<string, typeof Flame> = {
  Flame, Sparkles, Brain, Scale, Shield, BatteryCharging, Heart, Zap, Leaf,
  Eye, Utensils, Droplets, Coffee, Moon, ShieldCheck, Target, Calendar,
  RefreshCw, Users, BarChart3, BookHeart, Lightbulb, Clock, Star, TrendingDown,
  ArrowLeft, ChevronRight,
};

interface Props {
  item: ArticleCorpusItem;
  onDismiss?: (id: string) => void;
  /** Animation delay for fade-in entrance. */
  index?: number;
}

const CorpusItemRenderer = ({ item, onDismiss, index = 0 }: Props) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const c = item.content;

  if (c.kind === "section") {
    const title = `${c.titlePrefix ?? ""}${t(c.titleKey)}`;
    return (
      <ContentSection
        type={c.sectionType}
        title={title}
        feedbackId={item.id}
        feedbackQuestion={c.questionKey ? (t(c.questionKey) as string) : undefined}
        theme={item.theme}
        onDismiss={onDismiss}
        items={c.itemsKey ? (t(c.itemsKey, { returnObjects: true }) as string[]) : undefined}
        dataRows={
          c.dataRowsKey
            ? (t(c.dataRowsKey, { returnObjects: true }) as Array<{ label: string; value: string }>)
            : undefined
        }
      >
        {c.bodyKey ? (t(c.bodyKey) as string) : undefined}
      </ContentSection>
    );
  }

  if (c.kind === "iconCard") {
    const Icon = ICONS[c.iconName] ?? Flame;
    const base = `${c.ns}.items.${c.itemKey}`;
    const isAccent = c.ns === "cravings" || c.ns === "sustain";
    const linkable = !!c.link;

    return (
      <DismissibleCard
        articleId={item.id}
        className={`bg-card border border-border rounded-lg p-4 animate-fade-in-up ${
          linkable ? "cursor-pointer hover:border-primary/40 active:scale-[0.98] transition-all" : ""
        }`}
        style={{ animationDelay: `${index * 0.05}s` }}
      >
        <div
          onClick={linkable ? () => navigate(c.link!) : undefined}
        >
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-md ${isAccent ? "bg-accent" : "bg-primary/10"}`}>
              <Icon size={isAccent ? 18 : 20} className={isAccent ? "text-accent-foreground" : "text-primary"} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground text-sm">{t(`${base}.title`)}</h3>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{t(`${base}.desc`)}</p>
            </div>
            {linkable && <ChevronRight size={16} className="text-muted-foreground shrink-0 mt-1" />}
          </div>
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <ArticleFeedback
            articleId={item.id}
            question={t(`${base}.q`) as string}
            theme={item.theme}
            onDismiss={onDismiss}
          />
        </div>
      </DismissibleCard>
    );
  }

  if (c.kind === "story") {
    const s = c.story;
    return (
      <DismissibleCard
        articleId={item.id}
        className="bg-card border border-border rounded-lg p-4 animate-fade-in-up"
        style={{ animationDelay: `${index * 0.06}s` }}
      >
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-display font-bold text-foreground">{s.name}</h3>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">{s.highlight}</span>
        </div>
        <div className="flex gap-3 text-xs text-muted-foreground mb-2">
          <span className="flex items-center gap-1"><Clock size={12} /> {s.duration}</span>
          <span className="flex items-center gap-1"><TrendingDown size={12} /> -{s.lost}</span>
          <span className="flex items-center gap-1"><Star size={12} className="text-accent-foreground" /></span>
        </div>
        <p className="text-xs text-secondary-foreground/80 italic leading-relaxed">"{s.quote}"</p>
        <ArticleFeedback articleId={item.id} question={s.q} theme={item.theme} onDismiss={onDismiss} />
      </DismissibleCard>
    );
  }

  return null;
};

export default CorpusItemRenderer;
