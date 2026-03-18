import { useState } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { toast } from "sonner";

interface ArticleFeedbackProps {
  articleId: string;
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

// Context-aware personalized responses based on the article ID
const personalizedResponses: Record<string, { yes: string; no: string }> = {
  // Cravings
  "cravings-fat": {
    yes: "Great — increasing animal fat is the #1 way to eliminate cravings. Try adding butter or tallow to every meal.",
    no: "Try adding 1–2 tbsp of butter to your next meal. Most cravings vanish when you eat enough fat.",
  },
  "cravings-hydrate": {
    yes: "Perfect! Keep aiming for 5g+ sodium daily. Bone broth between meals is a game-changer.",
    no: "Start with ¼ tsp salt in water 3x/day. Most 'hunger' on carnivore is actually low electrolytes.",
  },
  "cravings-coffee": {
    yes: "Black coffee can be a great appetite bridge. Just avoid it after 2pm to protect your sleep quality.",
    no: "That's fine — try herbal tea or warm bone broth as an alternative. The key is having a go-to comfort drink.",
  },
  "cravings-sleep": {
    yes: "Excellent — sleep is the most underrated tool against cravings. Keep prioritizing 7-9 hours.",
    no: "Try setting a wind-down alarm 1 hour before bed. Even 30 extra minutes of sleep reduces next-day cravings significantly.",
  },
  "cravings-withdrawal": {
    yes: "You're through the hardest part! The neural pathways are rewiring — it only gets easier from here.",
    no: "Hang in there — days 3-5 are the peak. Sugar withdrawal is real but temporary. Most people feel dramatically better by week 2.",
  },
  "cravings-temptation": {
    yes: "Smart move. Environment design beats willpower every time. Keep your kitchen carnivore-only.",
    no: "This is the single most impactful change you can make. Consider removing just one trigger food this week.",
  },
  // Sustain
  "sustain-goals": {
    yes: "Track 3 non-scale wins weekly — energy, sleep, and mood. These compound into unstoppable motivation.",
    no: "Start by rating your energy 1-10 each morning. After 2 weeks you'll see a pattern that keeps you going.",
  },
  "sustain-prep": {
    yes: "Batch cooking is the secret weapon. Try cooking 5 lbs of ground beef on Sunday — it saves hours mid-week.",
    no: "Start small: cook double at dinner and save leftovers. Even that eliminates half your cooking stress.",
  },
  "sustain-rotate": {
    yes: "Variety is key to long-term sustainability. Try one new protein source each week to keep things fresh.",
    no: "Try adding just lamb or pork to your rotation. Even 2 different proteins prevent flavor fatigue.",
  },
  "sustain-community": {
    yes: "Community is a force multiplier. Share your wins and struggles — accountability changes everything.",
    no: "Even lurking in a carnivore group helps. Seeing others' results keeps your motivation alive on tough days.",
  },
  "sustain-track": {
    yes: "Data is motivation fuel. Monthly progress photos and measurements reveal changes you can't see in the mirror.",
    no: "Try just one metric for 30 days — weight or a body measurement. Simple tracking creates powerful momentum.",
  },
  "sustain-lifestyle": {
    yes: "That identity shift is everything. You're not 'on a diet' — this is how you eat. The sustainability follows naturally.",
    no: "Reframe it: instead of 'I can't eat that,' try 'I don't eat that.' Small language shifts change your identity over time.",
  },
};

// Default responses for articles without specific personalization
const defaultResponses = {
  yes: "Great to hear! Keep applying this to your carnivore journey — consistency compounds.",
  no: "That's valuable feedback. Try implementing just one small change from this section this week.",
};

const getResponse = (articleId: string, value: "yes" | "no"): string => {
  const specific = personalizedResponses[articleId];
  if (specific) return specific[value];
  return defaultResponses[value];
};

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
        <p className="text-[11px] text-primary font-medium leading-relaxed">
          {feedback === "yes" ? "👍 " : "👌 "}{getResponse(articleId, feedback)}
        </p>
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
