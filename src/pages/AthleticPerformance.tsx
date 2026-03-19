import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ContentSection from "@/components/ContentSection";
import MotivationCTA from "@/components/MotivationCTA";
import { useTranslation } from "react-i18next";
import { useScrollToTop } from "@/hooks/useScrollToTop";

const AthleticPerformance = () => {
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
        <h1 className="text-lg font-display font-bold">{t("athletic.title")}</h1>
      </div>

      <div className="p-4 space-y-3">
        <p className="text-xs text-muted-foreground">{t("athletic.subtitle")}</p>

        <ContentSection type="key_points" title="The Adaptation Phase" feedbackId="athletic-adapt" feedbackQuestion="Are you in the adaptation phase?" items={[
          "Allow 2–6 weeks for full fat adaptation",
          "Initial performance may dip — this is temporary",
          "Endurance typically rebounds and often exceeds baseline",
          "Strength athletes may need slightly higher protein",
          "Don't judge performance during the transition period",
        ]} />

        <ContentSection type="tips" title="Pre-Training Fueling" feedbackId="athletic-pre" feedbackQuestion="Will you try this approach?" items={[
          "Eat your main meal 2–3 hours before training",
          "Focus on easily digestible proteins like eggs or ground beef",
          "Some athletes thrive training completely fasted",
          "Avoid heavy fatty cuts right before intense sessions",
          "Experiment to find your personal sweet spot",
        ]} />

        <ContentSection type="key_points" title="Post-Workout Recovery" feedbackId="athletic-post" feedbackQuestion="Is your recovery on point?" items={[
          "Prioritize a protein-rich meal within 2 hours",
          "Ribeye or strip steak is an excellent recovery meal",
          "Don't skimp on fat — it supports hormone recovery",
          "Salt your food generously to replenish electrolytes",
          "Bone broth is a great recovery drink alternative",
        ]} />

        <ContentSection type="key_points" title="Endurance Sports" feedbackId="athletic-endurance" feedbackQuestion="Are you into endurance training?" items={[
          "Fat adaptation provides a near-unlimited fuel tank",
          "No more bonking from glycogen depletion mid-race",
          "Steady energy without the sugar crash roller coaster",
          "Ultra-endurance athletes report best results on carnivore",
          "Some elite competitors add targeted carbs for peak events",
        ]} />

        <ContentSection type="data" title="Strength & Muscle Building" feedbackId="athletic-strength" feedbackQuestion="Is this data useful for your training?" dataRows={[
          { label: "Protein target", value: "0.8–1.2g per lb bodyweight" },
          { label: "Creatine", value: "Naturally present in red meat" },
          { label: "Recovery window", value: "Within 2 hours post-training" },
          { label: "Top recovery food", value: "Ribeye steak + eggs" },
        ]} />

        <ContentSection type="key_points" title="Strength Training Benefits" feedbackId="athletic-benefits" feedbackQuestion="Have you noticed these benefits?" items={[
          "Recovery time often shortens on carnivore",
          "Joint pain and inflammation frequently decrease",
          "Better sleep quality supports muscle growth",
          "Reduced bloating means better body composition visibility",
          "Stable blood sugar eliminates energy crashes mid-session",
        ]} />

        <ContentSection type="important" title="Performance Note">
          If you compete at an elite level, work with a sports-aware practitioner familiar with low-carb athletics. Individual needs vary significantly based on sport type, intensity, and training volume.
        </ContentSection>
      </div>

      <MotivationCTA />
    </div>
  );
};

export default AthleticPerformance;
