import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ContentSection from "@/components/ContentSection";
import MotivationCTA from "@/components/MotivationCTA";

const Guide = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-40 bg-background/90 backdrop-blur-md border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-display font-bold">Complete Guide</h1>
      </div>

      <div className="p-4 space-y-3">
        <p className="text-xs text-muted-foreground">A comprehensive guide to carnivore eating · 7 sections</p>

        <ContentSection type="overview" title="What is the Carnivore Diet?">
          The carnivore diet is an elimination diet consisting exclusively of animal products. It removes all plant foods, focusing on meat, fish, eggs, and sometimes dairy. By stripping away potential irritants, it lets your body heal and reveals which foods your system truly tolerates.
        </ContentSection>

        <ContentSection
          type="key_points"
          title="Foods to Eat"
          items={[
            "Beef: Steaks, roasts, ground beef, organs",
            "Pork: Chops, bacon, shoulder, belly",
            "Lamb: Chops, leg, ground lamb",
            "Poultry: Chicken, turkey, duck",
            "Fish: Salmon, sardines, mackerel",
            "Eggs: Any style, as many as desired",
            "Dairy: Butter, cheese, cream (if tolerated)",
            "Organs: Liver, heart, kidney — nature's multivitamins",
          ]}
        />

        <ContentSection
          type="key_points"
          title="Foods to Avoid"
          items={[
            "All vegetables and fruits",
            "Grains and legumes",
            "Nuts and seeds",
            "Vegetable and seed oils",
            "Sugar and sweeteners",
            "Processed foods of any kind",
          ]}
        />

        <ContentSection
          type="key_points"
          title="Why People Try It"
          items={[
            "Autoimmune conditions",
            "Digestive issues (IBS, bloating, SIBO)",
            "Weight loss and body recomposition",
            "Mental health and clarity",
            "Elimination diet approach",
            "Simplicity — no counting, no planning",
          ]}
        />

        <ContentSection
          type="key_points"
          title="Getting Started"
          items={[
            "1. Clear out non-carnivore foods from your kitchen",
            "2. Stock up on quality meats — prioritize ruminants",
            "3. Commit to 30 days minimum for a fair trial",
            "4. Track how you feel daily (energy, mood, digestion)",
            "5. Adjust fat-to-protein ratio based on your response",
          ]}
        />

        <ContentSection
          type="data"
          title="Electrolyte Management"
          dataRows={[
            { label: "Sodium", value: "5-7g daily" },
            { label: "Potassium", value: "From meat intake" },
            { label: "Magnesium", value: "Supplement if cramping" },
          ]}
        />

        <ContentSection type="important" title="Medical Disclaimer">
          Consult your healthcare provider before starting any new dietary approach, especially if you have pre-existing conditions or take medications. This guide is educational — not medical advice.
        </ContentSection>
      </div>

      <MotivationCTA />
    </div>
  );
};

export default Guide;
