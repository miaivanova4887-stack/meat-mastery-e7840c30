import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

const OFFSETS = [
  { value: 15, labelKey: "15 min before" },
  { value: 30, labelKey: "30 min before" },
  { value: 60, labelKey: "1 hour before" },
  { value: 120, labelKey: "2 hours before" },
  { value: 1440, labelKey: "1 day before" },
];

const OFFSETS_FR: Record<number, string> = {
  15: "15 min avant",
  30: "30 min avant",
  60: "1 heure avant",
  120: "2 heures avant",
  1440: "1 jour avant",
};

export const CoachingReminderSettings = () => {
  const { user } = useAuth();
  const { i18n } = useTranslation();
  const isFr = i18n.language?.startsWith("fr");
  const [enabled, setEnabled] = useState(true);
  const [offset, setOffset] = useState(60);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("reminders_enabled, reminder_offset_minutes")
        .eq("id", user.id)
        .maybeSingle();
      if (data) {
        setEnabled(data.reminders_enabled ?? true);
        setOffset(data.reminder_offset_minutes ?? 60);
      }
      setLoaded(true);
    })();
  }, [user]);

  const update = async (patch: { reminders_enabled?: boolean; reminder_offset_minutes?: number }) => {
    if (!user) return;
    const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
    if (error) {
      toast.error(isFr ? "Échec de la mise à jour" : "Update failed");
      return;
    }
    toast.success(isFr ? "Préférences mises à jour" : "Preferences updated");
  };

  return (
    <div className="ios-card p-4">
      <div className="flex items-center justify-between">
        <div className="flex-1 mr-4">
          <h3 className="font-display font-bold text-foreground text-[15px]">
            {isFr ? "Rappels d'appel de coaching" : "Coaching Call Reminders"}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isFr
              ? "Notification push avant votre appel planifié."
              : "Push notification before your scheduled call."}
          </p>
        </div>
        <Switch
          checked={enabled}
          disabled={!loaded}
          onCheckedChange={(v) => {
            setEnabled(v);
            void update({ reminders_enabled: v });
          }}
        />
      </div>
      {enabled && (
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/40">
          <span className="text-sm text-muted-foreground">
            {isFr ? "Délai" : "Remind me"}
          </span>
          <select
            value={offset}
            disabled={!loaded}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              setOffset(v);
              void update({ reminder_offset_minutes: v });
            }}
            className="bg-transparent text-primary text-sm font-semibold focus:outline-none"
          >
            {OFFSETS.map((o) => (
              <option key={o.value} value={o.value}>
                {isFr ? OFFSETS_FR[o.value] : o.labelKey}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
};

export default CoachingReminderSettings;
