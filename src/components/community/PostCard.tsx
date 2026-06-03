import { useState } from "react";
import { Heart, MessageSquare } from "lucide-react";

export interface PostCardData {
  id: string;
  user_id: string;
  title: string | null;
  body: string;
  image_url: string | null;
  likes_count: number;
  created_at: string;
  profile?: { display_name: string | null; avatar_url: string | null };
}

interface Props {
  post: PostCardData;
  liked: boolean;
  onToggleLike: () => void;
}

const PostCard = ({ post: p, liked, onToggleLike }: Props) => {
  const [expanded, setExpanded] = useState(false);
  // ~3 lines is roughly 220 chars in a card; offer Read more past that.
  const isLong = p.body.length > 220;

  return (
    <article className="ios-card p-4">
      {/* Header row: author + type badge */}
      <div className="flex items-center gap-2 mb-2.5">
        <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center text-[10px] font-bold text-accent-foreground">
          {(p.profile?.display_name || "?")[0].toUpperCase()}
        </div>
        <span className="text-[11px] font-medium text-muted-foreground">
          {p.profile?.display_name || "Anonymous"}
        </span>
        <span className="text-[10px] text-muted-foreground/60">
          · {new Date(p.created_at).toLocaleDateString()}
        </span>
        <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent text-accent-foreground text-[10px] font-semibold">
          <MessageSquare size={10} /> Post
        </span>
      </div>

      {p.title && (
        <h3 className="font-display font-bold text-foreground text-[15px] leading-tight mb-1.5">
          {p.title}
        </h3>
      )}

      <p
        className={`text-[13px] text-foreground/85 leading-relaxed whitespace-pre-wrap ${
          !expanded && isLong ? "line-clamp-3" : ""
        }`}
      >
        {p.body}
      </p>
      {isLong && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-[11px] font-semibold text-primary"
        >
          {expanded ? "Read less" : "Read more"}
        </button>
      )}

      {p.image_url && (
        <div className="mt-3 rounded-xl overflow-hidden border border-border/40">
          <img
            src={p.image_url}
            alt=""
            loading="lazy"
            className="w-full h-auto object-cover max-h-[420px]"
          />
        </div>
      )}

      <div className="flex items-center justify-end mt-3 pt-2.5 border-t border-border/30">
        <button
          onClick={onToggleLike}
          className="flex items-center gap-1 text-xs transition-colors"
          aria-label={liked ? "Unlike post" : "Like post"}
        >
          <Heart
            size={14}
            className={liked ? "fill-destructive text-destructive" : "text-muted-foreground"}
          />
          <span className={liked ? "text-destructive font-semibold" : "text-muted-foreground"}>
            {p.likes_count}
          </span>
        </button>
      </div>
    </article>
  );
};

export default PostCard;
