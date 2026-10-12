import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { addGuestEntry } from "@/lib/guestProgress";

const DIMENSIONS = [
  { key: "mood_score", label: "Mood", states: [["😖", "Very Low"], ["😟", "Low"], ["😐", "Neutral"], ["😊", "Good"], ["😄", "Great"]] },
  { key: "energy_level", label: "Energy", states: [["🔋", "Exhausted"], ["⚡", "Low"], ["⚡⚡", "Steady"], ["⚡⚡⚡", "High"], ["🔥", "Peak"]] },
  { key: "sleep_quality", label: "Sleep Quality", states: [["😴", "Terrible"], ["🥱", "Poor"], ["🛌", "Fair"], ["💤", "Good"], ["✨", "Deep / Restored"]] },
  { key: "mental_clarity", label: "Mental Clarity", states: [["🌫️", "Brain Fog"], ["😶‍🌫️", "Sluggish"], ["💡", "Normal"], ["🧠", "Clear"], ["🎯", "Laser Sharp"]] },
] as const;

const TAGS = ["Electrolytes taken", "Fasting", "Deep ketosis", "Heavy workout", "Keto / carnivore flu", "High stress", "Poor sleep", "Travelling"];

export function buildCheckInNotes(tags: string[], note: string): string {
  const parts: string[] = [];
  if (tags.length) parts.push(`[Tags: ${tags.join(", ")}]`);
  const n = note.trim().slice(0, 500);
  if (n) parts.push(n);
  return parts.join(" ");
}

interface Props { open: boolean; onOpenChange: (o: boolean) => void }

const WellnessCheckInDrawer = ({ open, onOpenChange }: Props) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [tags, setTags] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => { setRatings({}); setTags([]); setNote(""); };

  const save = async () => {
    const keys = Object.keys(ratings);
    if (!keys.length) return;
    setSaving(true);
    const recorded_at = new Date().toISOString();
    const notes = buildCheckInNotes(tags, note);
    if (!user) {
      keys.forEach((metric) => addGuestEntry({ category: "mood", metric, value: ratings[metric], unit: "0-4", notes, recorded_at }));
    } else {
      const { error } = await supabase.from("progress_entries").insert(
        keys.map((metric) => ({ user_id: user.id, category: "mood", metric, value: ratings[metric], unit: "0-4", notes, recorded_at }))
      );
      if (error) { setSaving(false); toast.error(error.message); return; }
    }
    setSaving(false);
    await qc.invalidateQueries({ queryKey: ["progress-entries"] });
    toast.success("Check-in saved");
    reset();
    onOpenChange(false);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader><DrawerTitle>Daily Check-In</DrawerTitle></DrawerHeader>
        <div className="px-4 pb-8 space-y-5 overflow-y-auto">
          {DIMENSIONS.map((d) => (
            <div key={d.key}>
              <p className="text-xs font-bold uppercase tracking-wider text-foreground mb-2">
                {d.label}{ratings[d.key] != null && <span className="ml-2 font-medium normal-case text-muted-foreground">{d.states[ratings[d.key]][1]}</span>}
              </p>
              <div className="grid grid-cols-5 gap-2">
                {d.states.map(([emoji, label], i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`${d.label}: ${label}`}
                    onClick={() => setRatings((r) => {
                      const next = { ...r };
                      if (next[d.key] === i) delete next[d.key]; else next[d.key] = i;
                      return next;
                    })}
                    className={`h-12 rounded-xl text-lg border transition-all ${ratings[d.key] === i ? "border-primary bg-primary/10" : "border-border bg-card"}`}
                  >{emoji}</button>
                ))}
              </div>
            </div>
          ))}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-foreground mb-2">Context</p>
            <div className="flex flex-wrap gap-2">
              {TAGS.map((t) => {
                const on = tags.includes(t);
                return (
                  <button key={t} type="button" onClick={() => setTags((p) => on ? p.filter((x) => x !== t) : [...p, t])}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border ${on ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground border-border"}`}>
                    {t}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-foreground mb-2">Reflection (optional)</p>
            <Textarea value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="How are you feeling today?" />
            <p className="text-[10px] text-muted-foreground text-right mt-1">{note.length}/500</p>
          </div>
          <Button className="w-full h-11" disabled={saving || !Object.keys(ratings).length} onClick={save}>
            {saving ? "Saving…" : "Save Check-In"}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default WellnessCheckInDrawer;
