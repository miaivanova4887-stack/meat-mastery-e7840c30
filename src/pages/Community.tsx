import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import CommunityFeed from "@/components/CommunityFeed";

const Community = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 6.5rem)" }}>
      {/* Header */}
      <div className="sticky top-0 z-40 bg-card/85 ios-blur border-b border-border/30 shadow-xs px-4 pb-3 flex items-center gap-3" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}>
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-display font-bold tracking-tight flex-1">Community</h1>
      </div>

      <div className="mx-auto w-full max-w-3xl lg:max-w-5xl px-4 pt-4">
        <CommunityFeed />
      </div>
    </div>
  );
};

export default Community;
