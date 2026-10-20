import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { getGuestEntries, getGuestGoals } from "./guestProgress";
import { aggregateWeeklyProgress, nextMondayMorning, weeklyProgressCopy } from "../../supabase/functions/_shared/weeklyProgress";

export const WEEKLY_REMINDER_ID = 740901;

/** One-shot notification; counts are refreshed from local logs, never uploaded. */
export async function refreshGuestWeeklyReminder(options: {
  signedIn: boolean; consent: string; enabled: boolean; timezone: string; locale: string;
}, now = new Date()): Promise<string | null> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return null;
  const permission = await LocalNotifications.checkPermissions();
  if (options.signedIn || options.consent !== "granted" || !options.enabled || permission.display !== "granted") {
    await LocalNotifications.cancel({ notifications: [{ id: WEEKLY_REMINDER_ID }] });
    return null;
  }
  const occurrence = nextMondayMorning(now, options.timezone);
  const goal = getGuestGoals().find(g => g.category === "diet_trends" && g.metric === "protein" && g.unit === "g");
  const stats = aggregateWeeklyProgress(getGuestEntries(), goal?.target_value ?? null, occurrence, options.timezone, now);
  const copy = weeklyProgressCopy(stats, options.locale);
  await LocalNotifications.schedule({ notifications: [{
    id: WEEKLY_REMINDER_ID, ...copy, schedule: { at: occurrence },
    extra: { path: "/progress", type: "weekly_summary" },
  }] });
  const pending = await LocalNotifications.getPending();
  return pending.notifications.some(n => n.id === WEEKLY_REMINDER_ID) ? occurrence.toISOString() : null;
}