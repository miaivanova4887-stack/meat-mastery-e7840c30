import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { useMealPlan, DAYS, MEAL_SLOTS, SLOT_LABELS, type DayKey, type MealSlot, type PlannedMeal } from "@/hooks/useMealPlan";
import { toast } from "sonner";
import { CalendarPlus } from "lucide-react";

export interface AddToPlanRecipe {
  name: string;
  cal: string;
  protein: string;
  fat: string;
  time: string;
  serving: string;
}

interface AddToPlanSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipe: AddToPlanRecipe | null;
}

/** Build the next 7 calendar days starting from today, mapped to DayKey */
function buildNext7Days(): { key: DayKey; label: string; dateLabel: string }[] {
  const result: { key: DayKey; label: string; dateLabel: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    const jsDay = d.getDay(); // 0=Sun
    const idx = jsDay === 0 ? 6 : jsDay - 1;
    const dayKey = DAYS[idx];
    const month = d.toLocaleDateString("en-US", { month: "short" });
    const date = d.getDate();
    result.push({
      key: dayKey,
      label: i === 0 ? "Today" : dayKey,
      dateLabel: `${month} ${date}`,
    });
  }
  return result;
}

export default function AddToPlanSheet({ open, onOpenChange, recipe }: AddToPlanSheetProps) {
  const navigate = useNavigate();
  const { plan, assignMeal } = useMealPlan();
  const days = useMemo(buildNext7Days, []);

  const [selectedDay, setSelectedDay] = useState<DayKey>(days[0]?.key ?? "Mon");
  const [selectedSlot, setSelectedSlot] = useState<MealSlot | null>(null);

  const bothSelected = selectedDay && selectedSlot;

  // Check which slots are occupied for the selected day
  const occupiedSlots = useMemo(() => {
    const occ: Partial<Record<MealSlot, string>> = {};
    if (!selectedDay) return occ;
    for (const slot of MEAL_SLOTS) {
      const m = plan[selectedDay][slot];
      if (m) occ[slot] = m.recipeName;
    }
    return occ;
  }, [plan, selectedDay]);

  // Check which days have any meals
  const daysWithMeals = useMemo(() => {
    const set = new Set<DayKey>();
    for (const day of DAYS) {
      for (const slot of MEAL_SLOTS) {
        if (plan[day][slot]) { set.add(day); break; }
      }
    }
    return set;
  }, [plan]);

  const handleConfirm = () => {
    if (!recipe || !selectedSlot) return;
    const meal: PlannedMeal = {
      recipeName: recipe.name,
      cal: recipe.cal,
      protein: recipe.protein,
      fat: recipe.fat,
      time: recipe.time,
      serving: recipe.serving,
    };
    assignMeal(selectedDay, selectedSlot, meal);
    onOpenChange(false);

    const slotLabel = SLOT_LABELS[selectedSlot].replace(/^.*?\s/, ""); // strip emoji
    toast.success(`Added to ${slotLabel} on ${selectedDay}`, {
      action: {
        label: "View Plan",
        onClick: () => navigate("/meal-plan"),
      },
    });
  };

  // Dynamic CTA label
  const ctaLabel = bothSelected
    ? `Add to ${SLOT_LABELS[selectedSlot!].replace(/^.*?\s/, "")} on ${selectedDay}`
    : "Select day & meal";

  if (!recipe) return null;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="pb-2">
          <DrawerTitle className="text-base font-display">{recipe.name}</DrawerTitle>
          <DrawerDescription className="flex items-center gap-3 text-xs">
            <span>{recipe.cal} cal</span>
            <span className="font-semibold text-primary">{recipe.protein} P</span>
            <span>{recipe.fat} F</span>
            <span>· {recipe.time}</span>
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-4 pb-2 space-y-4">
          {/* Day selector */}
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Day</p>
            <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1">
              {days.map((d) => {
                const isActive = selectedDay === d.key;
                const hasMeals = daysWithMeals.has(d.key);
                return (
                  <button
                    key={d.key + d.dateLabel}
                    onClick={() => setSelectedDay(d.key)}
                    className={`flex flex-col items-center px-3 py-2 rounded-xl transition-all flex-shrink-0 min-w-[4rem] relative ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary/60 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {hasMeals && !isActive && (
                      <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-primary" />
                    )}
                    <span className="text-xs font-bold">{d.label}</span>
                    <span className={`text-[10px] mt-0.5 ${isActive ? "text-primary-foreground/70" : "text-muted-foreground/60"}`}>
                      {d.dateLabel}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Meal slot selector */}
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Meal</p>
            <div className="grid grid-cols-2 gap-2">
              {MEAL_SLOTS.map((slot) => {
                const isActive = selectedSlot === slot;
                const occupied = occupiedSlots[slot];
                return (
                  <button
                    key={slot}
                    onClick={() => setSelectedSlot(slot)}
                    className={`flex flex-col items-center gap-0.5 py-3 rounded-xl transition-all relative ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary/60 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span className="text-sm font-semibold">{SLOT_LABELS[slot]}</span>
                    {occupied && (
                      <span className={`text-[10px] truncate max-w-[90%] ${isActive ? "text-primary-foreground/70" : "text-muted-foreground/50"}`}>
                        {occupied}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sticky CTA */}
        <div className="px-4 pt-2" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }}>
          <button
            disabled={!bothSelected}
            onClick={handleConfirm}
            className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm transition-all active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2"
          >
            <CalendarPlus size={16} />
            {ctaLabel}
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
