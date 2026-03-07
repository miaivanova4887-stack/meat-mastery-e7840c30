import { ArrowLeft, Star, TrendingDown, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import MotivationCTA from "@/components/MotivationCTA";

const stories = [
  { name: "Mike, 42", duration: "8 months", lost: "65 lbs", quote: "I reversed my pre-diabetes and got off blood pressure medication. My doctor couldn't believe the blood work. Energy through the roof.", highlight: "Reversed pre-diabetes" },
  { name: "Sarah, 35", duration: "6 months", lost: "40 lbs", quote: "Lifelong eczema — gone in 3 weeks. I'd tried every cream and diet. Turns out it was plants causing the inflammation all along.", highlight: "Cleared chronic eczema" },
  { name: "James, 28", duration: "1 year", lost: "30 lbs", quote: "I was skinny-fat with zero energy. Now I deadlift 405 lbs and have visible abs for the first time. Carnivore changed my body composition completely.", highlight: "Gained muscle, lost fat" },
  { name: "Linda, 55", duration: "4 months", lost: "25 lbs", quote: "Joint pain from rheumatoid arthritis made daily life miserable. Two weeks into carnivore, the pain started fading. Now I walk 5 miles daily.", highlight: "Joint pain eliminated" },
  { name: "Carlos, 38", duration: "10 months", lost: "80 lbs", quote: "I was 310 lbs and felt hopeless. Carnivore was the first 'diet' that didn't feel like a diet. I eat until full and the weight melts off.", highlight: "Lost 80 lbs effortlessly" },
  { name: "Emma, 31", duration: "5 months", lost: "20 lbs", quote: "Chronic bloating, IBS, and anxiety — all resolved. I sleep better, think clearer, and my mood is stable for the first time in my adult life.", highlight: "IBS & anxiety resolved" },
];

const Stories = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-40 bg-background/90 backdrop-blur-md border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground"><ArrowLeft size={20} /></button>
        <h1 className="text-lg font-display font-bold">Success Stories</h1>
      </div>
      <div className="p-4 space-y-4">
        {stories.map((s, i) => (
          <div key={i} className="bg-card border border-border rounded-lg p-4 animate-fade-in-up" style={{ animationDelay: `${i * 0.06}s` }}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-display font-bold text-foreground">{s.name}</h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">{s.highlight}</span>
            </div>
            <div className="flex gap-3 text-xs text-muted-foreground mb-2">
              <span className="flex items-center gap-1"><Clock size={12} /> {s.duration}</span>
              <span className="flex items-center gap-1"><TrendingDown size={12} /> -{s.lost}</span>
              <span className="flex items-center gap-1"><Star size={12} className="text-gold" /></span>
            </div>
            <p className="text-xs text-secondary-foreground/80 italic leading-relaxed">"{s.quote}"</p>
          </div>
        ))}
      </div>
      <MotivationCTA />
    </div>
  );
};

export default Stories;
