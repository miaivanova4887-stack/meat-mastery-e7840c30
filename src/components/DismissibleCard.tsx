import { useEffect, useState } from "react";
import { useDismissedArticles } from "@/hooks/useDismissedArticles";

interface DismissibleCardProps {
  articleId: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

/**
 * Wrapper used for custom article-style cards (Cravings, Stories, etc.) that
 * render `ArticleFeedback` directly. Listens for global dismissal of `articleId`
 * and fades + collapses itself when triggered.
 */
const DismissibleCard = ({ articleId, className, style, children }: DismissibleCardProps) => {
  const { isDismissed } = useDismissedArticles();
  const [phase, setPhase] = useState<"visible" | "fading" | "gone">("visible");
  const [hiddenFromStart] = useState(() => isDismissed(articleId));

  useEffect(() => {
    if (phase !== "visible") return;
    if (isDismissed(articleId) && !hiddenFromStart) {
      setPhase("fading");
      const t = window.setTimeout(() => setPhase("gone"), 320);
      return () => window.clearTimeout(t);
    }
  }, [articleId, isDismissed, phase, hiddenFromStart]);

  if (hiddenFromStart || phase === "gone") return null;

  return (
    <div
      className={`${className ?? ""} transition-all duration-300 ease-out overflow-hidden ${
        phase === "fading" ? "opacity-0 max-h-0 my-0 p-0 border-0" : "opacity-100"
      }`}
      style={phase === "fading" ? { ...style, maxHeight: 0, paddingTop: 0, paddingBottom: 0 } : style}
    >
      {children}
    </div>
  );
};

export default DismissibleCard;
