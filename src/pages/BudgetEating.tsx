import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ContentSection from "@/components/ContentSection";
import MotivationCTA from "@/components/MotivationCTA";
import { useTranslation } from "react-i18next";

const BudgetEating = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-40 bg-background/90 backdrop-blur-md border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-display font-bold">{t("budget.title")}</h1>
      </div>

      <div className="p-4 space-y-3">
        <p className="text-xs text-muted-foreground">{t("budget.subtitle")}</p>

        <ContentSection type="key_points" title="Affordable Cuts That Deliver" feedbackId="budget-cuts" feedbackQuestion="Will you try any of these cuts?" items={[
          "Ground beef: The ultimate budget staple — versatile and nutrient-dense",
          "Chuck roast: Perfect for slow cooking, falls apart tender",
          "Chicken thighs: Cheaper than breast, far more flavorful",
          "Pork shoulder: Incredible value with high fat content",
          "Beef heart: One of the cheapest organs, packed with CoQ10",
          "Canned sardines: Dirt cheap, loaded with omega-3s",
        ]} />

        <ContentSection type="tips" title="Shopping Smarter" feedbackId="budget-shopping" feedbackQuestion="Do you already use any of these strategies?" items={[
          "Buy in bulk when sales hit and freeze portions",
          "Check clearance sections for marked-down meat",
          "Warehouse clubs often have the best per-pound prices",
          "Build a relationship with your local butcher for deals",
          "Buy whole chickens instead of individual parts",
        ]} />

        <ContentSection type="key_points" title="Buying in Bulk" feedbackId="budget-bulk" feedbackQuestion="Would you consider a bulk buy?" items={[
          "Look into quarter or half cow shares from local farms",
          "Split large orders with friends or family to reduce cost",
          "A chest freezer pays for itself within months",
          "Cost per pound drops dramatically with bulk purchases",
          "Many farms offer payment plans for large orders",
        ]} />

        <ContentSection type="tips" title="Free & Nearly Free Food" feedbackId="budget-free" feedbackQuestion="Have you tried any of these?" items={[
          "Hunting and fishing — invest once, eat for months",
          "Ask butchers for bones, fat trimmings, and scraps",
          "Organ meats are often given away or sold cheaply",
          "Render your own tallow from beef fat (often free)",
          "Make rich bone broth from leftover bones",
        ]} />

        <ContentSection type="key_points" title="Weekly Meal Prep on a Budget" feedbackId="budget-prep" feedbackQuestion="Would this work for your schedule?" items={[
          "Batch cook 5 lbs of ground beef on Sunday",
          "Slow-cook tough, cheap cuts into tender meals",
          "Hard-boil a dozen eggs for grab-and-go protein",
          "Render tallow once a month for cooking fat supply",
          "Freeze individual portions for zero-waste weeks",
        ]} />

        <ContentSection type="data" title="Cost Comparison" feedbackId="budget-cost" feedbackQuestion="Is this within your budget?" dataRows={[
          { label: "Ground beef (5 lbs)", value: "~$25/week" },
          { label: "Eggs (3 dozen)", value: "~$9/week" },
          { label: "Butter (2 lbs)", value: "~$8/week" },
          { label: "Estimated weekly total", value: "~$42–60" },
        ]} />
      </div>

      <MotivationCTA />
    </div>
  );
};

export default BudgetEating;
