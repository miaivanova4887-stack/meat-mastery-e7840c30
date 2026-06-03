import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerClose } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUpsertGoal, useProgressGoals, METRICS, type ProgressCategory } from "@/hooks/useProgress";
import { Crosshair } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: ProgressCategory;
}

const SetGoalDrawer = ({ open, onOpenChange, category }: Props) => {
  const { t } = useTranslation();
  const metrics = METRICS[category];
  const { data: existingGoals } = useProgressGoals(category);
  const upsertGoal = useUpsertGoal();
  const [goals, setGoals] = useState<Record<string, string>>({});

  useEffect(() => {
    if (existingGoals) {
      const map: Record<string, string> = {};
      existingGoals.forEach((g) => { map[g.metric] = String(g.target_value); });
      setGoals(map);
    }
  }, [existingGoals]);

  const handleSave = () => {
    const promises = Object.entries(goals)
      .filter(([, v]) => v && !isNaN(parseFloat(v)))
      .map(([metric, val]) => {
        const meta = metrics.find((m) => m.key === metric)!;
        return upsertGoal.mutateAsync({ category, metric, target_value: parseFloat(val), unit: meta.unit });
      });
    Promise.all(promises).then(() => onOpenChange(false));
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Crosshair size={18} className="text-primary" />
            </div>
            <div>
              <DrawerTitle>{t("progress.setGoals")}</DrawerTitle>
              <p className="text-xs text-muted-foreground">{t("progress.setGoalsDesc")}</p>
            </div>
          </div>
        </DrawerHeader>
        <div className="px-4 space-y-3 pb-2">
          {metrics.filter((m) => m.unit !== "0-4").map((m) => (
            <div key={m.key} className="bg-card rounded-lg p-3 border border-border">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">{m.icon} {m.label}</p>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  step="any"
                  value={goals[m.key] || ""}
                  onChange={(e) => setGoals((prev) => ({ ...prev, [m.key]: e.target.value }))}
                  placeholder={t("progress.target")}
                  className="text-xl font-bold text-center h-12"
                />
                <span className="text-sm text-muted-foreground">{m.unit}</span>
              </div>
            </div>
          ))}
        </div>
        <DrawerFooter className="flex-row gap-3">
          <DrawerClose asChild>
            <Button variant="outline" className="flex-1">Cancel</Button>
          </DrawerClose>
          <Button className="flex-1" onClick={handleSave} disabled={upsertGoal.isPending}>
            {upsertGoal.isPending ? "Saving..." : "✓ Set Goals"}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};

export default SetGoalDrawer;
