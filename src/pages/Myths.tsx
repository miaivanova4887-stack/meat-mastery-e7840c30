import { ArrowLeft, Clock, Layers } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ContentSection from "@/components/ContentSection";
import MotivationCTA from "@/components/MotivationCTA";

const myths = [
  {
    type: "overview" as const,
    title: "\"Red meat causes heart disease\"",
    content: "This claim is based on outdated epidemiological studies that conflated processed meats with fresh cuts. Modern meta-analyses show no significant link between unprocessed red meat and cardiovascular disease. Saturated fat from whole foods raises large, buoyant LDL — the harmless kind.",
  },
  {
    type: "overview" as const,
    title: "\"You'll get scurvy without fruit\"",
    content: "Fresh meat contains enough vitamin C to prevent scurvy. The requirement drops dramatically on a low-carb diet because glucose and vitamin C compete for the same cellular transporters. Inuit populations thrived for millennia on meat-only diets without deficiency.",
  },
  {
    type: "overview" as const,
    title: "\"Fiber is essential for digestion\"",
    content: "Multiple studies show that reducing or eliminating fiber can improve constipation, bloating, and IBS symptoms. The gut doesn't require fiber — it adapts to an all-meat diet by producing less bulk and absorbing nutrients more efficiently.",
  },
  {
    type: "overview" as const,
    title: "\"Too much protein damages kidneys\"",
    content: "In healthy individuals, high protein intake does not impair kidney function. This myth originated from studies on people with pre-existing kidney disease. Your kidneys are designed to filter protein — that's literally their job.",
  },
  {
    type: "overview" as const,
    title: "\"You need carbs for energy\"",
    content: "The body can produce all the glucose it needs through gluconeogenesis. Fat-adapted individuals run on ketones — a cleaner, more stable fuel source. Many elite athletes perform at peak levels on zero-carb diets.",
  },
  {
    type: "overview" as const,
    title: "\"Cholesterol from meat is dangerous\"",
    content: "Dietary cholesterol has minimal impact on blood cholesterol for most people. The liver produces 80% of your cholesterol regardless of diet. Cholesterol is essential for hormone production, cell membranes, and brain function.",
  },
  {
    type: "overview" as const,
    title: "\"Plants are the healthiest foods\"",
    content: "Plants contain anti-nutrients (oxalates, lectins, phytates) that can impair mineral absorption and trigger inflammation. Animal foods provide the most bioavailable forms of iron, zinc, B12, and essential amino acids with zero anti-nutrients.",
  },
  {
    type: "overview" as const,
    title: "\"Carnivore is just a fad diet\"",
    content: "Humans have been primarily carnivorous for 2+ million years. The agricultural revolution (grains, sugar) is only 10,000 years old. Carnivore isn't new — it's a return to how our species evolved to eat.",
  },
];

const Myths = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-40 bg-background/90 backdrop-blur-md border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-display font-bold">Myths Busted</h1>
      </div>

      <div className="p-4 space-y-4">
        {/* Header card */}
        <div className="bg-card border border-border rounded-lg p-5">
          <h2 className="text-2xl font-display font-black text-foreground">
            {myths.length} Myths Exposed
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Science-backed rebuttals to common carnivore criticisms
          </p>
          <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Clock size={12} /> 10 min read</span>
            <span className="flex items-center gap-1"><Layers size={12} /> {myths.length} sections</span>
          </div>
        </div>

        {/* Myth sections */}
        {myths.map((myth, i) => (
          <ContentSection key={i} type={myth.type} title={`${i + 1}. ${myth.title}`}>
            {myth.content}
          </ContentSection>
        ))}
      </div>
      <MotivationCTA />
    </div>
  );
};

export default Myths;
