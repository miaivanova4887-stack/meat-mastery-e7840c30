import { useEffect, useRef, useState } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { toast } from "sonner";
import { useDismissedArticles } from "@/hooks/useDismissedArticles";
import { inferTheme } from "@/lib/articleThemes";



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
  // Benefits — per benefit personalized
  "benefits-inflammation": {
    yes: "That's a powerful sign your body is healing. Reduced inflammation is one of the earliest and most impactful benefits — it tends to snowball into better sleep, joints, and energy.",
    no: "Inflammation reduction can take 4-8 weeks depending on your baseline. We're tracking the latest research on this — stay with us, the data is encouraging.",
  },
  "benefits-autophagy": {
    yes: "Autophagy is one of the most exciting areas of nutritional science right now. We'll keep bringing you the latest findings as research evolves.",
    no: "This is cutting-edge science and there's more emerging every month. We'll keep you updated with new insights as the research develops.",
  },
  "benefits-clarity": {
    yes: "Mental clarity is one of the most consistently reported benefits. Your brain is running on clean fuel now — and it tends to keep improving over months.",
    no: "Brain fog can take 2-4 weeks to fully clear as your brain adapts to ketones. We're gathering more data on this — hang tight, clarity is coming.",
  },
  "benefits-fatloss": {
    yes: "Effortless fat loss is the hallmark of a well-adapted carnivore. Your body is finally accessing its preferred fuel source.",
    no: "Fat loss timelines vary — hormones, stress, and sleep all play a role. We're continuously refining our guidance as new studies come in.",
  },
  "benefits-gut": {
    yes: "Gut healing is foundational — when digestion improves, everything else follows. This is your body rebuilding from the inside out.",
    no: "Gut adaptation can take 2-6 weeks. Some temporary changes are normal as your microbiome shifts. We'll keep sharing the latest gut health research.",
  },
  "benefits-energy": {
    yes: "Steady, crash-free energy is what fat adaptation feels like. No more riding the blood sugar rollercoaster.",
    no: "The energy shift typically happens around week 3-4 of consistent carnivore eating. We're here to support you through the adaptation phase.",
  },
  "benefits-hormones-f": {
    yes: "Hormonal balance through nutrition is incredibly powerful. Many women see progressive improvements cycle after cycle.",
    no: "Hormonal changes can take 2-3 cycles to become noticeable. We're following the latest women's health research closely and will keep you informed.",
  },
  "benefits-testosterone": {
    yes: "Optimized testosterone from whole-animal nutrition is a game changer. The combination of cholesterol, zinc, and saturated fat is nature's formula.",
    no: "Hormonal optimization is a gradual process — typically 4-8 weeks for noticeable changes. We're tracking emerging research and will share new findings.",
  },
  "benefits-lean-muscle": {
    yes: "The bioavailable protein from animal sources is unmatched for body composition. Your muscles are getting exactly what they need.",
    no: "Body composition shifts can be subtle at first — measurements often change before the scale does. We'll continue bringing you the latest performance data.",
  },
  "benefits-clean": {
    yes: "Eating this clean is a radical act of self-care. Zero processed ingredients means your body can focus on what it does best — healing and thriving.",
    no: "Clean eating is a journey. Even small steps toward eliminating processed foods make a difference. We'll keep sharing practical tips.",
  },
  "benefits-glow": {
    yes: "The external glow reflects deep internal health. Skin, hair, and nails are the body's way of showing you it's thriving.",
    no: "Skin and hair changes can take 6-12 weeks as cells regenerate. We're compiling more data on this — the results people report are remarkable.",
  },
  "benefits-no-counting": {
    yes: "Freedom from calorie counting is one of carnivore's greatest gifts. Your appetite hormones are finally working as designed.",
    no: "Trust in natural appetite regulation builds over time. We're gathering more insights on satiety science and will keep you updated.",
  },
  "benefits-sports": {
    yes: "Fat-adapted athletes are rewriting the playbook on performance. Endurance, recovery, and explosive power all benefit.",
    no: "Athletic performance during adaptation can temporarily dip — this is normal. We're following the latest sports science and will share new protocols.",
  },
  "benefits-stress": {
    yes: "Stress resilience through metabolic stability is a profound benefit. Stable blood sugar literally changes how your nervous system responds to pressure.",
    no: "Stress resilience builds gradually as hormones and blood sugar stabilize. We'll continue sharing strategies as new research emerges.",
  },
  // Cravings
  "cravings-fat": {
    yes: "Great — increasing animal fat is the #1 way to eliminate cravings. Try adding butter or tallow to every meal.",
    no: "Cravings are your body's signal, not a failure. We're constantly learning more about the fat-craving connection — try adding just a bit more fat this week and see how it shifts.",
  },
  "cravings-hydrate": {
    yes: "Perfect! Keep aiming for 5g+ sodium daily. Bone broth between meals is a game-changer.",
    no: "Electrolyte needs are very individual. We're refining our recommendations as more data comes in — start with ¼ tsp salt in water 3x/day and adjust from there.",
  },
  "cravings-coffee": {
    yes: "Black coffee can be a great appetite bridge. Just avoid it after 2pm to protect your sleep quality.",
    no: "Everyone's caffeine relationship is different. We're exploring more about how different beverages interact with carnivore — bone broth is a great alternative worth trying.",
  },
  "cravings-sleep": {
    yes: "Excellent — sleep is the most underrated tool against cravings. Keep prioritizing 7-9 hours.",
    no: "Sleep optimization is a journey. We're compiling the latest sleep science for carnivore dieters — even small improvements compound over time.",
  },
  "cravings-withdrawal": {
    yes: "You're through the hardest part! The neural pathways are rewiring — it only gets easier from here.",
    no: "Withdrawal is real and it's tough — but it's also temporary. We're gathering more strategies from the community and will keep sharing what works.",
  },
  "cravings-temptation": {
    yes: "Smart move. Environment design beats willpower every time. Keep your kitchen carnivore-only.",
    no: "Changing your environment is a process, not a switch. We're collecting more practical tips from successful long-term carnivores — small changes add up.",
  },
  // Sustain
  "sustain-goals": {
    yes: "Track 3 non-scale wins weekly — energy, sleep, and mood. These compound into unstoppable motivation.",
    no: "Finding the right metrics takes experimentation. We're developing better tracking approaches and will share them as they evolve — your journey data matters.",
  },
  "sustain-prep": {
    yes: "Batch cooking is the secret weapon. Try cooking 5 lbs of ground beef on Sunday — it saves hours mid-week.",
    no: "Meal prep looks different for everyone. We're gathering more real-world strategies from the community — even small prep wins make a big difference.",
  },
  "sustain-rotate": {
    yes: "Variety is key to long-term sustainability. Try one new protein source each week to keep things fresh.",
    no: "Finding your protein rotation takes time. We're curating more accessible options and will keep expanding our ingredient guides for you.",
  },
  "sustain-community": {
    yes: "Community is a force multiplier. Share your wins and struggles — accountability changes everything.",
    no: "Connection happens at your own pace. We're building more community features — stay tuned for ways to connect that feel right for you.",
  },
  "sustain-track": {
    yes: "Data is motivation fuel. Monthly progress photos and measurements reveal changes you can't see in the mirror.",
    no: "Not everyone needs data to stay motivated. We're exploring different approaches to track progress — we'll keep sharing options that might click for you.",
  },
  "sustain-lifestyle": {
    yes: "That identity shift is everything. You're not 'on a diet' — this is how you eat. The sustainability follows naturally.",
    no: "Mindset shifts are gradual and personal. We're continually learning from long-term carnivores about what makes it stick — we'll keep sharing those insights.",
  },
  // Athletic Performance
  "athletic-adapt": {
    yes: "Hang tight — once fat-adapted, your endurance will surpass your carb-fueled baseline. Most athletes see the shift around week 4.",
    no: "The adaptation dip is well-documented and temporary. We're tracking the latest athletic performance research on carnivore — more insights coming soon.",
  },
  "athletic-pre": {
    yes: "Excellent! Timing your main meal 2-3 hours pre-training is the sweet spot. Eggs and ground beef digest fastest for most athletes.",
    no: "Pre-workout nutrition is highly individual. We're compiling more protocols from fat-adapted athletes — experiment and we'll share what the data shows.",
  },
  "athletic-post": {
    yes: "Your recovery game is dialed in. Ribeye + generous salt within 2 hours post-training is the gold standard for hormone and muscle recovery.",
    no: "Recovery nutrition is an evolving field. We're gathering more data on optimal post-workout protocols for carnivore athletes — stay tuned for updates.",
  },
  "athletic-endurance": {
    yes: "Fat adaptation is a superpower for endurance — no more bonking, no more gels. Your body has 40,000+ calories of fat fuel available at all times.",
    no: "Endurance benefits unfold over weeks of adaptation. We're following the latest research on fat-fueled performance — more data is coming that may change your perspective.",
  },
  "athletic-strength": {
    yes: "Creatine from red meat + 0.8-1.2g protein per lb bodyweight is the carnivore strength formula. Most lifters see PRs within 6 weeks of full adaptation.",
    no: "Strength gains on carnivore are well-documented but take patience. We're tracking new performance data and will keep you posted on protocols that work.",
  },
  "athletic-benefits": {
    yes: "Reduced inflammation and faster recovery are the most reported benefits. Many athletes drop an entire rest day from their schedule on carnivore.",
    no: "Athletic benefits can take 4-6 weeks to manifest. We're continuously gathering performance data from the carnivore athlete community — more insights on the way.",
  },
  // Myths — reassuring, forward-looking
  "myths-0": {
    yes: "Glad this resonated! The science is evolving rapidly in this area — we'll keep you updated as new research strengthens the evidence.",
    no: "Healthy scepticism is valuable. The research in this area is still developing — we'll keep bringing you the latest data so you can form your own view.",
  },
  "myths-1": {
    yes: "Great to see this clicked! Nutritional science is full of surprises — we'll continue sharing evidence-based insights as they emerge.",
    no: "This is a nuanced topic with ongoing research. We'll keep you informed as new studies shed more light on it.",
  },
  "myths-2": {
    yes: "Glad this was eye-opening! Digestive science is being re-examined — we'll bring you new findings as they come.",
    no: "Digestive health is deeply personal and the science is still evolving. We'll keep sharing new perspectives and research as they become available.",
  },
  "myths-3": {
    yes: "Good to know this helped! We'll keep tracking the latest kidney and protein research to keep you well-informed.",
    no: "This is an important topic worth following closely. New research keeps emerging — we'll make sure you stay up to date.",
  },
  "myths-4": {
    yes: "Fat adaptation is fascinating science! We'll continue bringing you the latest metabolic research as our understanding deepens.",
    no: "Energy metabolism is complex and the science is still unfolding. We'll keep you posted as more clarity emerges from ongoing research.",
  },
  "myths-5": {
    yes: "Cholesterol science has come a long way! We'll keep sharing updated research so you can stay confidently informed.",
    no: "Cholesterol is one of the most actively researched topics in nutrition. We're following it closely and will keep you updated with new findings.",
  },
  "myths-6": {
    yes: "Bioavailability is a game-changer in understanding nutrition. We'll continue highlighting emerging research in this area.",
    no: "Plant vs animal nutrition is a hot debate in science right now. We'll keep bringing you balanced, evidence-based updates as they come.",
  },
  "myths-7": {
    yes: "Evolutionary nutrition is a powerful lens! We'll keep connecting you with the latest ancestral health research.",
    no: "The evolutionary perspective is one of many frameworks. We're following the latest anthropological and nutritional research — more insights coming soon.",
  },
  // Guide sections
  "guide-what": {
    yes: "Great foundation! We'll keep expanding this guide with the latest nutritional science and practical tips.",
    no: "Introductions can always be improved. We're continually refining our content — your perspective helps us make it better.",
  },
  "guide-eat": {
    yes: "Having a clear food list is half the battle. We'll keep updating this as seasonal availability and sourcing tips evolve.",
    no: "Everyone's food list looks slightly different. We're gathering more guidance on customizing your approach — stay tuned for updates.",
  },
  "guide-avoid": {
    yes: "Clarity on what to cut is powerful. We'll keep this list evidence-based and updated as new research comes in.",
    no: "Elimination can feel overwhelming at first. We're developing more gradual transition guides — your feedback helps shape them.",
  },
  "guide-why": {
    yes: "Knowing your 'why' is the strongest motivator. We'll keep sharing success stories and research that reinforces your reasons.",
    no: "Finding your personal motivation takes time. We're curating more diverse reasons and stories — something might click when you least expect it.",
  },
  "guide-start": {
    yes: "You're ready! We'll keep refining this roadmap with tips from experienced carnivores in the community.",
    no: "Starting is the hardest part. We're building more step-by-step support — we'll keep making the first steps easier and clearer.",
  },
  "guide-electrolytes": {
    yes: "Electrolyte data is crucial for success. We'll keep updating these recommendations as more clinical data becomes available.",
    no: "Electrolyte needs vary widely. We're gathering more personalized recommendations — more detailed guidance is on its way.",
  },
  // Budget sections
  "budget-cuts": {
    yes: "Smart choices! We'll keep updating our budget picks as market prices and availability change.",
    no: "Budget-friendly options vary by region. We're expanding our database with more local alternatives — stay tuned for more options.",
  },
  "budget-shopping": {
    yes: "Shopping smart makes carnivore surprisingly affordable. We'll keep adding new strategies as our community discovers them.",
    no: "Not every strategy works for everyone. We're gathering more region-specific tips — we'll keep sharing what works in different situations.",
  },
  "budget-bulk": {
    yes: "Bulk buying is a game-changer for cost per meal. We'll keep expanding our sourcing guide with new options.",
    no: "Bulk buying isn't for everyone and that's okay. We're developing more flexible budgeting approaches — more options coming soon.",
  },
  "budget-free": {
    yes: "Free and low-cost protein sources are carnivore's best-kept secret. We'll keep adding to this list.",
    no: "These options aren't available everywhere. We're researching more accessible alternatives — we'll keep expanding the list for you.",
  },
  "budget-prep": {
    yes: "Meal prep on a budget is the ultimate efficiency hack. We'll keep sharing new prep workflows from the community.",
    no: "Prep schedules are personal. We're developing more flexible prep guides — your feedback helps us create something that fits real life.",
  },
};

// Default responses — reassuring, forward-looking
const defaultResponses = {
  yes: "Thanks for sharing! We're continually deepening our research in this area — more insights and updates are on the way.",
  no: "We appreciate your honesty. We're always refining our content based on the latest research — we'll keep you updated as new evidence emerges.",
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
    toast.success(value === "yes" ? "Glad you found it useful!" : "Thanks for your feedback!");
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
