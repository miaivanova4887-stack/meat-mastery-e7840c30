import { useState } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { toast } from "sonner";

interface ArticleFeedbackProps {
  /** Unique key for this article, used for localStorage persistence */
  articleId: string;
  /** Custom question text */
  question?: string;
}

function getFeedbackStore(): Record<string, "yes" | "no"> {
  try {
    const stored = localStorage.getItem("carnivore-article-feedback");
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function saveFeedback(id: string, value: "yes" | "no") {
  const store = getFeedbackStore();
  store[id] = value;
  localStorage.setItem("carnivore-article-feedback", JSON.stringify(store));
}

const ArticleFeedback = ({ articleId, question = "Was this helpful?" }: ArticleFeedbackProps) => {
  const [feedback, setFeedback] = useState<"yes" | "no" | null>(() => {
    return getFeedbackStore()[articleId] ?? null;
  });

  const handleFeedback = (value: "yes" | "no") => {
    setFeedback(value);
    saveFeedback(articleId, value);
    toast.success(value === "yes" ? "Glad you found it useful!" : "Noted — we'll improve this");
  };

  if (feedback) {
    return (
      <div className="mt-3 pt-3 border-t border-border/40">
        <span className="text-[11px] text-primary font-medium">
          {feedback === "yes" ? "👍 Thanks for the feedback!" : "👌 Got it — thanks for letting us know."}
        </span>
      </div>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t border-border/40">
      <p className="text-[11px] text-muted-foreground mb-2">{question}</p>
      <div className="flex gap-2">
        <button
          onClick={(e) => { e.stopPropagation(); handleFeedback("yes"); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-semibold transition-all active:scale-95"
        >
          <ThumbsUp size={12} />
          Yes
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleFeedback("no"); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary text-muted-foreground text-[11px] font-semibold transition-all active:scale-95"
        >
          <ThumbsDown size={12} />
          Not really
        </button>
      </div>
    </div>
  );
};

export default ArticleFeedback;
