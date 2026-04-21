import { useState } from "react";
import { format } from "date-fns";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerClose } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAddEntry, METRICS, type ProgressCategory } from "@/hooks/useProgress";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: ProgressCategory;
  metricKey?: string;
}

const MOOD_LABELS = ["Very Bad", "Bad", "Neutral", "Good", "Very Good"];
const MOOD_EMOJIS = ["😖", "😟", "😐", "😊", "😄"];
const MOOD_COLORS = [
  "bg-red-400/20 border-red-400 text-red-400",
  "bg-orange-400/20 border-orange-400 text-orange-400",
  "bg-yellow-400/20 border-yellow-400 text-yellow-400",
  "bg-green-400/20 border-green-400 text-green-400",
  "bg-teal-400/20 border-teal-400 text-teal-400",
];

const AddEntryDrawer = ({ open, onOpenChange, category, metricKey }: Props) => {
  const metrics = METRICS[category];
  const defaultMetric = metricKey || metrics[0]?.key || "";
  const [selectedMetric, setSelectedMetric] = useState(defaultMetric);
  const [value, setValue] = useState("");
  const [notes, setNotes] = useState("");
  const [dateTime, setDateTime] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const addEntry = useAddEntry();

  const currentMeta = metrics.find((m) => m.key === selectedMetric) || metrics[0];
  if (!currentMeta) return null;
  const isScale = currentMeta.unit === "0-4";

  const handleSave = () => {
    const numVal = parseFloat(value);
    if (isNaN(numVal)) return;
    addEntry.mutate(
      { category, metric: selectedMetric, value: numVal, unit: currentMeta.unit, notes, recorded_at: new Date(dateTime).toISOString() },
      { onSuccess: () => { onOpenChange(false); setValue(""); setNotes(""); } }
    );
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle>Add Entry</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 space-y-4 pb-2">
          {/* Date/time */}
          <div className="flex justify-center">
            <div className="bg-muted rounded-full px-4 py-2 text-sm text-muted-foreground flex items-center gap-2">
              <span>🕐</span>
              <input
                type="datetime-local"
                value={dateTime}
                onChange={(e) => setDateTime(e.target.value)}
                className="bg-transparent border-none outline-none text-foreground text-sm"
              />
            </div>
          </div>

          {/* Metric selector if multiple */}
          {!metricKey && (
            // Grid (not flex-wrap) so 4 nutrition macros — calories / protein /
            // fat / carbs — stay on one line across every iPhone width (SE,
            // mini, Pro, Pro Max). For categories with 2–3 metrics the grid
            // collapses naturally.
            <div
              className="grid gap-1.5"
              style={{ gridTemplateColumns: `repeat(${metrics.length}, minmax(0, 1fr))` }}
            >
              {metrics.map((m) => (
                <button
                  key={m.key}
                  onClick={() => { setSelectedMetric(m.key); setValue(""); }}
                  className={`px-2 py-1.5 rounded-full text-[11px] font-medium transition-all truncate ${
                    selectedMetric === m.key
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <span className="mr-0.5">{m.icon}</span>
                  {m.label}
                </button>
              ))}
            </div>
          )}

          {/* Value input */}
          <div>
            <p className="text-sm font-bold text-foreground mb-2">
              {currentMeta.icon} {currentMeta.label}:
            </p>
            {isScale ? (
              <div className="flex gap-2 justify-center">
                {[0, 1, 2, 3, 4].map((v) => (
                  <button
                    key={v}
                    onClick={() => setValue(String(v))}
                    className={`w-14 h-14 rounded-xl border-2 flex flex-col items-center justify-center text-lg transition-all ${
                      value === String(v) ? MOOD_COLORS[v] + " scale-110" : "border-border bg-card text-muted-foreground"
                    }`}
                  >
                    <span className="text-xl">{MOOD_EMOJIS[v]}</span>
                    <span className="text-[9px] mt-0.5">{MOOD_LABELS[v]}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  step="any"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="0"
                  className="text-2xl font-bold text-center h-14"
                />
                <span className="text-sm text-muted-foreground font-medium">{currentMeta.unit}</span>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <p className="text-sm text-muted-foreground mb-1">Notes:</p>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add your notes here..."
              className="resize-none"
              maxLength={500}
            />
            <p className="text-[10px] text-muted-foreground text-right mt-0.5">{notes.length}/500</p>
          </div>
        </div>
        <DrawerFooter className="flex-row gap-3" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }}>
          <DrawerClose asChild>
            <Button variant="outline" className="flex-1">Cancel</Button>
          </DrawerClose>
          <Button className="flex-1" onClick={handleSave} disabled={!value || addEntry.isPending}>
            {addEntry.isPending ? "Saving..." : "Save"}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};

export default AddEntryDrawer;
