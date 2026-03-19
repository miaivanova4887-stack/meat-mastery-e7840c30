import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ContentSection from "@/components/ContentSection";
import MotivationCTA from "@/components/MotivationCTA";
import { useTranslation } from "react-i18next";
import { useScrollToTop } from "@/hooks/useScrollToTop";

const Guide = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  useScrollToTop();

  return (
    <div className="min-h-screen bg-background" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 6.5rem)" }}>
      <div className="sticky top-0 z-40 bg-background/90 backdrop-blur-md border-b border-border px-4 pb-3 flex items-center gap-3"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}
      >
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-display font-bold">{t("guide.title")}</h1>
      </div>

      <div className="p-4 space-y-3">
        <p className="text-xs text-muted-foreground">{t("guide.subtitle")}</p>

        <ContentSection type="overview" title="What is the Carnivore Diet?" feedbackId="guide-what" feedbackQuestion="Was this a good introduction?">
          The carnivore diet is an elimination diet consisting exclusively of animal products. It removes all plant foods, focusing on meat, fish, eggs, and sometimes dairy. By stripping away potential irritants, it lets your body heal and reveals which foods your system truly tolerates.
        </ContentSection>

        <ContentSection type="key_points" title="Foods to Eat" feedbackId="guide-eat" feedbackQuestion="Is this list clear enough?" items={[
          "Beef: Steaks, roasts, ground beef, organs",
          "Pork: Chops, bacon, shoulder, belly",
          "Lamb: Chops, leg, ground lamb",
          "Poultry: Chicken, turkey, duck",
          "Fish: Salmon, sardines, mackerel",
          "Eggs: Any style, as many as desired",
          "Dairy: Butter, cheese, cream (if tolerated)",
          "Organs: Liver, heart, kidney — nature's multivitamins",
        ]} />

        <ContentSection type="key_points" title="Foods to Avoid" feedbackId="guide-avoid" feedbackQuestion="Helpful to know what to cut?" items={[
          "All vegetables and fruits",
          "Grains and legumes",
          "Nuts and seeds",
          "Vegetable and seed oils",
          "Sugar and sweeteners",
          "Processed foods of any kind",
        ]} />

        <ContentSection type="key_points" title="Why People Try It" feedbackId="guide-why" feedbackQuestion="Do any of these resonate with you?" items={[
          "Autoimmune conditions",
          "Digestive issues (IBS, bloating, SIBO)",
          "Weight loss and body recomposition",
          "Mental health and clarity",
          "Elimination diet approach",
          "Simplicity — no counting, no planning",
        ]} />

        <ContentSection type="key_points" title="Getting Started" feedbackId="guide-start" feedbackQuestion="Feel ready to begin?" items={[
          "1. Clear out non-carnivore foods from your kitchen",
          "2. Stock up on quality meats — prioritize ruminants",
          "3. Commit to 30 days minimum for a fair trial",
          "4. Track how you feel daily (energy, mood, digestion)",
          "5. Adjust fat-to-protein ratio based on your response",
        ]} />

        <ContentSection type="data" title="Electrolyte Management" feedbackId="guide-electrolytes" feedbackQuestion="Was this data useful?" dataRows={[
          { label: "Sodium", value: "5-7g daily" },
          { label: "Potassium", value: "From meat intake" },
          { label: "Magnesium", value: "Supplement if cramping" },
        ]} />

        <ContentSection type="important" title="Medical Disclaimer">
          Consult your healthcare provider before starting any new dietary approach, especially if you have pre-existing conditions or take medications. This guide is educational — not medical advice.
        </ContentSection>
      </div>

      <MotivationCTA />
    </div>
  );
};

export default Guide;
