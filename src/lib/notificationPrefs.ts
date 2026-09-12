// Canonical server-side notification preference keys.
//
// profiles.notification_preferences is the single source of truth read by the
// scheduled-push functions (push-reconcile gates each campaign on one key).
// The consent sheet and the Profile settings screen use their own UI keys, so
// both funnel through the maps below to avoid divergent shapes.

export type ServerNotificationPrefs = {
  daily_meal_reminder: boolean;
  reminder_time: string; // "HH:MM" local wall clock
  streak_reminder: boolean;
  weekly_summary: boolean;
  recipe_ideas: boolean;
  fasting_updates: boolean;
  coaching_tips: boolean;
  marketing: boolean;
};

export const DEFAULT_SERVER_NOTIFICATION_PREFS: ServerNotificationPrefs = {
  daily_meal_reminder: true,
  reminder_time: "19:00",
  streak_reminder: true,
  weekly_summary: true,
  recipe_ideas: true,
  fasting_updates: true,
  coaching_tips: true,
  marketing: false,
};

/** Consent-sheet toggle keys → canonical server keys. */
export const SHEET_TO_SERVER_PREF_KEY: Record<string, keyof ServerNotificationPrefs> = {
  streaks: "streak_reminder",
  recipes: "recipe_ideas",
  fasting: "fasting_updates",
  coaching: "coaching_tips",
  marketing: "marketing",
};

/** Profile settings toggle keys → canonical server keys. */
export const PROFILE_TO_SERVER_PREF_KEY: Record<string, keyof ServerNotificationPrefs> = {
  dailyReminder: "daily_meal_reminder",
  reminderTime: "reminder_time",
  streakReminder: "streak_reminder",
  weeklySummary: "weekly_summary",
};

/**
 * Merge order: defaults ← already-saved server prefs ← incoming UI values.
 * Guarantees every campaign key exists so a user who never touched the
 * switches is still addressable by the scheduled senders.
 */
export function mergeServerPrefs(
  existing: Record<string, unknown> | null | undefined,
  incoming?: Record<string, unknown> | null,
): Record<string, unknown> {
  return {
    ...DEFAULT_SERVER_NOTIFICATION_PREFS,
    ...(existing ?? {}),
    ...(incoming ?? {}),
  };
}

/** Translate consent-sheet toggles into canonical server keys. */
export function sheetPrefsToServerPrefs(
  sheetPrefs: Record<string, boolean> | null | undefined,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [uiKey, value] of Object.entries(sheetPrefs ?? {})) {
    const serverKey = SHEET_TO_SERVER_PREF_KEY[uiKey];
    if (serverKey) out[serverKey] = value;
  }
  // The sheet has no daily-reminder switch; keep the default on so the 7pm
  // meal-log reminder works for users who only ever saw the sheet.
  return out;
}
