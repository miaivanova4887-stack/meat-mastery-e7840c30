import { Heart, Clock, Flame, ChefHat } from "lucide-react";

export interface RecipeCardData {
  id: string;
  user_id: string;
  name: string;
  time: string;
  cal: string;
  protein: string;
  fat: string;
  serving: string;
  description: string;
  tags: string[];
  diet_tiers: string[];
  likes_count: number;
  created_at: string;
  profile?: { display_name: string | null; avatar_url: string | null };
}

const TIER_EMOJI: Record<string, string> = {
  lion: "🦁",
  strict: "🥩",
  animal_based: "🍳",
};

interface Props {
  recipe: RecipeCardData;
  liked: boolean;
  onToggleLike: () => void;
}

const RecipeCard = ({ recipe: r, liked, onToggleLike }: Props) => {
  return (
    <article className="ios-card p-4">
      {/* Header row: author + type badge */}
      <div className="flex items-center gap-2 mb-2.5">
        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
          {(r.profile?.display_name || "?")[0].toUpperCase()}
        </div>
        <span className="text-[11px] font-medium text-muted-foreground">
          {r.profile?.display_name || "Anonymous"}
        </span>
        <span className="text-[10px] text-muted-foreground/60">
          · {new Date(r.created_at).toLocaleDateString()}
        </span>
        <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold">
          <ChefHat size={10} /> Recipe
        </span>
      </div>

      <h3 className="font-display font-bold text-foreground text-[15px] leading-tight">
        {r.name}
      </h3>
      <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock size={11} /> {r.time}
        </span>
        <span className="flex items-center gap-1">
          <Flame size={11} /> {r.cal} cal
        </span>
        {r.serving && <span className="text-[11px]">· {r.serving}</span>}
      </div>

      <div className="flex items-center justify-between mt-2">
        <div className="flex gap-1">
          {r.diet_tiers.map((t) => (
            <span key={t} className="text-[10px]">
              {TIER_EMOJI[t] || t}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold text-primary">{r.protein} P</span>
          <span className="text-[11px] text-muted-foreground">{r.fat} F</span>
        </div>
      </div>

      {r.description && (
        <p className="text-xs text-secondary-foreground/70 mt-2 leading-relaxed line-clamp-2">
          {r.description}
        </p>
      )}

      <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-border/30">
        <div className="flex gap-1.5 flex-wrap">
          {r.tags.slice(0, 3).map((t) => (
            <span
              key={t}
              className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium"
            >
              {t}
            </span>
          ))}
        </div>
        <button
          onClick={onToggleLike}
          className="flex items-center gap-1 text-xs transition-colors"
          aria-label={liked ? "Unlike recipe" : "Like recipe"}
        >
          <Heart
            size={14}
            className={liked ? "fill-destructive text-destructive" : "text-muted-foreground"}
          />
          <span
            className={liked ? "text-destructive font-semibold" : "text-muted-foreground"}
          >
            {r.likes_count}
          </span>
        </button>
      </div>
    </article>
  );
};

export default RecipeCard;
