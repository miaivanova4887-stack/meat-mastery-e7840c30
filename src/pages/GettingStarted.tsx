import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ContentSection from "@/components/ContentSection";
import MotivationCTA from "@/components/MotivationCTA";
import { useTranslation } from "react-i18next";
import { useScrollToTop } from "@/hooks/useScrollToTop";

const GettingStarted = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  useScrollToTop();

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-40 bg-background/90 backdrop-blur-md border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-display font-bold">{t("gettingStarted.title")}</h1>
      </div>

      <div className="p-4 space-y-3">
        <p className="text-xs text-muted-foreground">{t("gettingStarted.subtitle")}</p>

        <ContentSection type="key_points" title="Week 1: The Clean Slate" feedbackId="started-w1" feedbackQuestion="Are you ready to start?" items={[
          "Empty your pantry of all non-animal foods",
          "Stock up on beef, salt, butter, and eggs",
          "Eat until satisfied — no calorie counting yet",
          "Expect headaches and low energy (totally normal)",
          "Drink plenty of water with a pinch of salt",
        ]} />

        <ContentSection type="key_points" title="Week 2: Riding the Wave" feedbackId="started-w2" feedbackQuestion="Can you relate to this?" items={[
          "Energy levels may swing up and down",
          "Bump up salt intake if you feel foggy or tired",
          "Sleep might be lighter — it settles soon",
          "Cravings hit their peak, then start fading",
          "Keep meals simple: steak, eggs, repeat",
        ]} />

        <ContentSection type="key_points" title="Week 3: Finding Your Groove" feedbackId="started-w3" feedbackQuestion="Feeling the groove yet?" items={[
          "Energy starts to stabilize noticeably",
          "Digestion settles into a new rhythm",
          "Appetite begins to self-regulate naturally",
          "Many report improved mental focus here",
          "Skin and joint improvements may appear",
        ]} />

        <ContentSection type="key_points" title="Week 4: Optimization Mode" feedbackId="started-w4" feedbackQuestion="Ready to optimize?" items={[
          "Try different cuts and animal sources",
          "Introduce organ meats for nutrient density",
          "Dial in your ideal fat-to-protein ratio",
          "Reflect on how your body and mind feel overall",
          "Decide your path forward: strict or relaxed",
        ]} />

        <ContentSection type="tips" title="Survival Tips" feedbackId="started-tips" feedbackQuestion="Will you try any of these?" items={[
          "Keep electrolytes handy — salt, magnesium, potassium",
          "Embrace the fat — it's your new fuel source",
          "Simplicity wins: don't overcomplicate meals early on",
          "Journal your symptoms, energy, and mood daily",
          "Commit to the full 30 days before judging results",
        ]} />

        <ContentSection type="important" title="Adaptation Warning">
          The first 1–2 weeks can feel rough as your body switches fuel sources. This is temporary. Flu-like symptoms, digestive changes, and fatigue are common during adaptation and not a sign something is wrong.
        </ContentSection>
      </div>

      <MotivationCTA />
    </div>
  );
};

export default GettingStarted;
