import { useEffect, useMemo, useState } from "react";
import { Loader2, Send, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import NotificationPreviewCard from "./NotificationPreviewCard";

export interface ScheduleConfig {
  kind: "daily" | "weekly";
  local_time: string;
  weekday?: number;
  preference_key: string;
  use_profile_reminder_time?: boolean;
}

export interface LocalizedStep {
  title: { en: string; fr: string };
  body: { en: string; fr: string };
  data?: Record<string, string>;
}

export interface CampaignRow {
  id: string;
  name: string;
  active: boolean;
  trigger_type: string;
  schedule: ScheduleConfig;
  steps: LocalizedStep[];
  updated_at?: string;
}

interface Props {
  campaign: CampaignRow;
  onClose: () => void;
  onSaved: (row: CampaignRow) => void;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function validate(draft: CampaignRow): string | null {
  const step = draft.steps[0];
  if (!step) return "Missing step content";
  if (!step.title.en.trim()) return "English title is required";
  if (!step.body.en.trim()) return "English body is required";
  if (!TIME_RE.test(draft.schedule.local_time)) return "Invalid local time (HH:MM)";
  if (draft.schedule.kind === "weekly") {
    const wd = draft.schedule.weekday;
    if (wd === undefined || wd < 0 || wd > 6) return "Pick a weekday for weekly schedules";
  }
  return null;
}

export default function ScheduledPushEditor({ campaign, onClose, onSaved }: Props) {
  const [draft, setDraft] = useState<CampaignRow>(() => normalize(campaign));
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<"en" | "fr" | null>(null);
  const [previewLocale, setPreviewLocale] = useState<"en" | "fr">("en");

  useEffect(() => setDraft(normalize(campaign)), [campaign]);

  const step = draft.steps[0];
  const validationError = useMemo(() => validate(draft), [draft]);

  const updateStep = (patch: Partial<LocalizedStep["title"]>, field: "title" | "body") => {
    setDraft((d) => ({
      ...d,
      steps: [{ ...d.steps[0], [field]: { ...d.steps[0][field], ...patch } }, ...d.steps.slice(1)],
    }));
  };

  const updateSchedule = (patch: Partial<ScheduleConfig>) => {
    setDraft((d) => ({ ...d, schedule: { ...d.schedule, ...patch } }));
  };

  const handleSave = async () => {
    if (draft.active && validationError) {
      toast.error(validationError);
      return;
    }
    if (!draft.active && validationError && !validationError.startsWith("English")) {
      // Allow saving inactive even with missing copy, but block schedule errors.
      toast.error(validationError);
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await (supabase as any)
        .from("push_campaigns")
        .update({
          name: draft.name.trim(),
          active: draft.active,
          schedule: draft.schedule,
          steps: draft.steps,
        })
        .eq("id", draft.id)
        .select("*")
        .single();
      if (error) throw error;
      toast.success("Campaign saved");
      onSaved(normalize(data));
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleTestSend = async (locale: "en" | "fr") => {
    setTesting(locale);
    try {
      const { data, error } = await supabase.functions.invoke("admin-test-push", {
        body: { campaignId: draft.id, locale, draftStep: draft.steps[0] },
      });
      if (error) throw error;
      const sent = data?.sent ?? 0;
      if (sent === 0) {
        toast.warning("No devices registered for this admin account");
      } else {
        toast.success(`Test sent to ${sent} device${sent > 1 ? "s" : ""}`);
      }
    } catch (e: any) {
      toast.error(e.message || "Test send failed");
    } finally {
      setTesting(null);
    }
  };

  const previewTitle = step[`title`][previewLocale] || step.title.en;
  const previewBody = step.body[previewLocale] || step.body.en;
  const frFallback =
    (!step.title.fr.trim() || !step.body.fr.trim()) && previewLocale === "fr";

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center">
      <div className="bg-card border border-border w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl shadow-xl">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-card/95 backdrop-blur border-b border-border px-4 py-3 flex items-center justify-between">
          <h2 className="text-base font-bold">Edit scheduled push</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-5">
          {/* Name + active */}
          <div className="space-y-3">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground block mb-1">
                Campaign name
              </label>
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className="w-full bg-secondary rounded-lg px-3 py-2 text-sm border border-border/40 focus:outline-none focus:ring-1 focus:ring-primary/30"
                maxLength={120}
              />
            </div>
            <div className="flex items-center justify-between bg-secondary/60 rounded-lg px-3 py-2.5">
              <div>
                <h3 className="text-sm font-semibold">Active</h3>
                <p className="text-[11px] text-muted-foreground">
                  When off, this campaign is not eligible in scheduling.
                </p>
              </div>
              <Switch
                checked={draft.active}
                onCheckedChange={(v) => {
                  if (v && validationError) {
                    toast.error(validationError);
                    return;
                  }
                  setDraft({ ...draft, active: v });
                }}
              />
            </div>
          </div>

          {/* Schedule */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Schedule
            </h3>
            <div className="flex gap-2">
              {(["daily", "weekly"] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => updateSchedule({ kind: k, weekday: k === "weekly" ? draft.schedule.weekday ?? 0 : undefined })}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                    draft.schedule.kind === k
                      ? "bg-foreground text-background"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {k === "daily" ? "Daily" : "Weekly"}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground block mb-1">
                  Local send time
                </label>
                <input
                  type="time"
                  value={draft.schedule.local_time}
                  onChange={(e) => updateSchedule({ local_time: e.target.value })}
                  className="w-full bg-secondary rounded-lg px-3 py-2 text-sm border border-border/40 focus:outline-none focus:ring-1 focus:ring-primary/30"
                  disabled={!!draft.schedule.use_profile_reminder_time && draft.schedule.kind === "daily"}
                />
              </div>
              {draft.schedule.kind === "weekly" && (
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground block mb-1">
                    Weekday
                  </label>
                  <select
                    value={draft.schedule.weekday ?? 0}
                    onChange={(e) => updateSchedule({ weekday: Number(e.target.value) })}
                    className="w-full bg-secondary rounded-lg px-3 py-2 text-sm border border-border/40 focus:outline-none focus:ring-1 focus:ring-primary/30"
                  >
                    {WEEKDAYS.map((d, i) => (
                      <option key={i} value={i}>{d}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {draft.schedule.kind === "daily" && (
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={!!draft.schedule.use_profile_reminder_time}
                  onChange={(e) => updateSchedule({ use_profile_reminder_time: e.target.checked })}
                />
                Use each user's profile reminder time instead of the fixed time above
              </label>
            )}

            <div className="text-[11px] text-muted-foreground bg-secondary/60 rounded-lg px-3 py-2">
              <span className="font-semibold text-foreground">Preference key:</span>{" "}
              <code className="text-[11px]">{draft.schedule.preference_key}</code>{" "}
              <span className="opacity-70">(read-only — users toggle this in Profile)</span>
            </div>
          </div>

          {/* Copy */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Copy
            </h3>
            {(["en", "fr"] as const).map((loc) => (
              <div key={loc} className="space-y-2 border border-border/40 rounded-lg p-3 bg-secondary/30">
                <div className="text-[11px] font-bold uppercase tracking-wide text-foreground">
                  {loc === "en" ? "English (required)" : "French (optional — falls back to EN)"}
                </div>
                <input
                  value={step.title[loc]}
                  onChange={(e) => updateStep({ [loc]: e.target.value } as any, "title")}
                  placeholder="Title"
                  className="w-full bg-background rounded-md px-2.5 py-2 text-sm border border-border/40 focus:outline-none focus:ring-1 focus:ring-primary/30"
                  maxLength={120}
                />
                <textarea
                  value={step.body[loc]}
                  onChange={(e) => updateStep({ [loc]: e.target.value } as any, "body")}
                  placeholder="Body"
                  rows={3}
                  className="w-full bg-background rounded-md px-2.5 py-2 text-sm border border-border/40 focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none"
                  maxLength={300}
                />
              </div>
            ))}
          </div>

          {/* Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Preview
              </h3>
              <div className="flex gap-1 bg-secondary rounded-md p-0.5">
                {(["en", "fr"] as const).map((loc) => (
                  <button
                    key={loc}
                    onClick={() => setPreviewLocale(loc)}
                    className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
                      previewLocale === loc
                        ? "bg-foreground text-background"
                        : "text-muted-foreground"
                    }`}
                  >
                    {loc.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <NotificationPreviewCard title={previewTitle} body={previewBody} />
            {frFallback && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400">
                FR is empty — will fall back to EN when sending.
              </p>
            )}
            <p className="text-[11px] text-muted-foreground">
              {scheduleSummary(draft.schedule)}
            </p>
          </div>

          {/* Test send */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Test send
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {(["en", "fr"] as const).map((loc) => (
                <button
                  key={loc}
                  onClick={() => handleTestSend(loc)}
                  disabled={testing !== null}
                  className="py-2 rounded-lg bg-secondary text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {testing === loc ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Send size={14} />
                  )}
                  Send {loc.toUpperCase()} to me
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Sends the current saved-or-draft copy to your admin device tokens only. Does not enqueue real campaign runs.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-card/95 backdrop-blur border-t border-border px-4 py-3 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg bg-secondary text-sm font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export function scheduleSummary(s: ScheduleConfig): string {
  if (!s) return "";
  if (s.kind === "weekly") {
    const wd = WEEKDAYS[s.weekday ?? 0];
    return `Weekly · ${wd} at ${s.local_time} (user's local time)`;
  }
  if (s.use_profile_reminder_time) {
    return `Daily · each user's profile reminder time (default ${s.local_time})`;
  }
  return `Daily at ${s.local_time} (user's local time)`;
}

function normalize(row: any): CampaignRow {
  const step = (row.steps?.[0] ?? {}) as any;
  const norm = (v: any) =>
    typeof v === "string" ? { en: v, fr: "" } : { en: v?.en ?? "", fr: v?.fr ?? "" };
  return {
    id: row.id,
    name: row.name ?? "",
    active: !!row.active,
    trigger_type: row.trigger_type ?? "scheduled",
    schedule: {
      kind: row.schedule?.kind ?? "daily",
      local_time: row.schedule?.local_time ?? "19:00",
      weekday: row.schedule?.weekday,
      preference_key: row.schedule?.preference_key ?? "",
      use_profile_reminder_time: !!row.schedule?.use_profile_reminder_time,
    },
    steps: [
      {
        title: norm(step.title),
        body: norm(step.body),
        data: step.data,
      },
      ...((row.steps ?? []).slice(1) as any[]),
    ],
    updated_at: row.updated_at,
  };
}
