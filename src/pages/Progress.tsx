import { useState } from "react";
import { ArrowLeft, Watch, Footprints, Heart, Activity, CheckCircle2, Flame } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { CATEGORY_META, type ProgressCategory } from "@/hooks/useProgress";
import { useHealthConnect } from "@/hooks/useHealthConnect";
import CategoryView from "@/components/progress/CategoryView";
import NutrientBreakdown from "@/components/progress/NutrientBreakdown";
import PhotoRecognition from "@/components/progress/PhotoRecognition";
import BarcodeScanner from "@/components/progress/BarcodeScanner";
import VoiceRecognition from "@/components/progress/VoiceRecognition";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

const CATEGORIES = Object.keys(CATEGORY_META) as ProgressCategory[];

const Progress = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();
  const [category, setCategory] = useState<ProgressCategory>("diet_trends");
  const { healthData, isConnected: isHealthConnected } = useHealthConnect();

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 pb-24">
        <p className="text-foreground font-bold text-lg mb-2">{t("progress.signInToTrack")}</p>
        <p className="text-muted-foreground text-sm mb-4 text-center">
          {t("progress.signInDesc")}
        </p>
        <Button onClick={() => navigate("/auth")}>{t("common.signIn")}</Button>
      </div>
    );
  }

  const meta = CATEGORY_META[category];

  return (
    <div className="min-h-screen bg-background" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 6.5rem)" }}>
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-lg border-b border-border/40"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={() => navigate(-1)} className="text-foreground p-1">
            <ArrowLeft size={22} />
          </button>
          <h1 className="text-base font-bold text-foreground">{t("progress.title")}</h1>
          <button
            onClick={() => navigate("/progress/sync")}
            className={`relative p-1 transition-colors ${isHealthConnected ? "text-green-500" : "text-muted-foreground hover:text-foreground"}`}
            title={isHealthConnected ? "Health Connect synced" : "Sync with health devices"}
          >
            <Watch size={20} />
            {isHealthConnected && <CheckCircle2 size={10} className="absolute -bottom-0.5 -right-0.5 text-green-500 fill-green-500" />}
          </button>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-5">
        {/* Today's Nutrition Breakdown */}
        <NutrientBreakdown />

        {/* Photo Recognition */}
        <PhotoRecognition />

        {/* Barcode Scanner */}
        <BarcodeScanner />

        {/* Voice Recognition */}
        <VoiceRecognition />

        {/* Category dropdown */}
        <Select value={category} onValueChange={(v) => setCategory(v as ProgressCategory)}>
          <SelectTrigger className="w-full bg-card border-border h-12 text-base font-semibold">
            <SelectValue>
              <span className="flex items-center gap-2">
                <span>{meta.icon}</span> {meta.label}
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>
                <span className="flex items-center gap-2">
                  <span>{CATEGORY_META[cat].icon}</span> {CATEGORY_META[cat].label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Category content */}
        <CategoryView category={category} />

        {/* Health sync banner — changes based on connection status */}
        {isHealthConnected ? (
          <div className="relative overflow-hidden bg-card rounded-xl p-4 border border-green-500/30">
            <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 to-green-600/5" />
            <div className="relative flex items-center gap-2 mb-3">
              <CheckCircle2 size={16} className="text-green-500" />
              <p className="text-[13px] font-bold text-foreground">Health Connect Synced</p>
              <span className="text-[10px] text-muted-foreground ml-auto">Auto-refreshing</span>
            </div>
            <div className="relative grid grid-cols-3 gap-2">
              <div className="bg-muted rounded-lg p-3 text-center">
                <Footprints size={16} className="mx-auto text-primary mb-1" />
                <p className="text-lg font-bold text-foreground">{healthData.steps.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">Steps</p>
              </div>
              <div className="bg-muted rounded-lg p-3 text-center">
                <Heart size={16} className="mx-auto text-red-500 mb-1" />
                <p className="text-lg font-bold text-foreground">{healthData.heartRate || "—"}</p>
                <p className="text-[10px] text-muted-foreground">BPM</p>
              </div>
              <div className="bg-muted rounded-lg p-3 text-center">
                <Activity size={16} className="mx-auto text-blue-500 mb-1" />
                <p className="text-lg font-bold text-foreground">
                  {healthData.weight ? `${healthData.weight.toFixed(1)}` : "—"}
                </p>
                <p className="text-[10px] text-muted-foreground">kg</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="relative overflow-hidden bg-card rounded-xl p-4 border border-border flex items-center gap-3">
            <div className="absolute inset-0 bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--gold))] opacity-[0.04]" />
            <div className="relative w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Watch size={18} className="text-primary" />
            </div>
            <div className="flex-1 relative">
              <p className="text-[13px] font-bold text-foreground">{t("progress.syncDevices")}</p>
              <p className="text-[11px] text-muted-foreground">{t("progress.syncDesc")}</p>
            </div>
            <Button size="sm" variant="outline" className="shrink-0 text-xs relative" onClick={() => navigate("/progress/sync")}>
              {t("progress.setup")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Progress;
