import { beforeEach, describe, expect, it, vi } from "vitest";
const native = vi.hoisted(() => ({
  checkPermissions: vi.fn(), cancel: vi.fn(), schedule: vi.fn(), getPending: vi.fn(),
}));
vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: () => true, getPlatform: () => "android" } }));
vi.mock("@capacitor/local-notifications", () => ({ LocalNotifications: native }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { addGuestEntry, deleteGuestEntry, upsertGuestGoal } from "./guestProgress";
import { refreshGuestWeeklyReminder, WEEKLY_REMINDER_ID } from "./weeklyGuestReminder";

const options = { signedIn: false, consent: "granted", enabled: true, timezone: "America/Toronto", locale: "en" };
const now = new Date("2026-10-19T12:00:00Z");
describe("guest weekly delivery lifecycle", () => {
  beforeEach(() => {
    localStorage.clear(); vi.clearAllMocks();
    native.checkPermissions.mockResolvedValue({ display: "granted" });
    native.getPending.mockResolvedValue({ notifications: [{ id: WEEKLY_REMINDER_ID }] });
    native.schedule.mockResolvedValue({}); native.cancel.mockResolvedValue({});
  });
  it.each([{ consent: "denied" }, { enabled: false }, { signedIn: true }])("cancels when consent/preference/session disallows guest delivery: %j", async patch => {
    expect(await refreshGuestWeeklyReminder({ ...options, ...patch }, now)).toBeNull();
    expect(native.schedule).not.toHaveBeenCalled();
    expect(native.cancel).toHaveBeenCalledWith({ notifications: [{ id: WEEKLY_REMINDER_ID }] });
  });
  it("does not schedule without OS notification permission", async () => {
    native.checkPermissions.mockResolvedValue({ display: "denied" });
    expect(await refreshGuestWeeklyReminder(options, now)).toBeNull();
    expect(native.schedule).not.toHaveBeenCalled();
  });
  it("reads actual guest entries, groups nutrients/ratings, then refreshes after deletion", async () => {
    const recorded_at = "2026-10-18T16:00:00Z";
    for (const metric of ["calories", "protein", "fat"]) addGuestEntry({ category: "diet_trends", metric, value: 100, unit: "g", recorded_at });
    for (const metric of ["mood_score", "energy_level", "sleep_quality", "mental_clarity"]) addGuestEntry({ category: "mood", metric, value: 3, unit: "0-4", recorded_at });
    upsertGuestGoal({ category: "diet_trends", metric: "protein", target_value: 100, unit: "g" });
    expect(await refreshGuestWeeklyReminder(options, now)).toBe("2026-10-19T13:00:00.000Z");
    const scheduled = native.schedule.mock.calls[0][0].notifications[0];
    expect(scheduled.id).toBe(WEEKLY_REMINDER_ID);
    expect(scheduled.extra.path).toBe("/progress");
    // Count calculations are tested separately; verify the actual scheduling payload
    // uses those calculations, without asserting marketing copy.
    expect(scheduled.schedule.at.toISOString()).toBe("2026-10-19T13:00:00.000Z");
    const entries = JSON.parse(localStorage.getItem("carnivore-guest-progress-entries") || "[]");
    entries.forEach((e: { id: string }) => deleteGuestEntry(e.id));
    await refreshGuestWeeklyReminder(options, now);
    expect(native.schedule).toHaveBeenCalledTimes(2);
    expect(native.schedule.mock.calls[1][0].notifications[0].body).not.toBe(scheduled.body);
  });
  it("does not claim local delivery if scheduling fails or pending notification is missing", async () => {
    native.getPending.mockResolvedValue({ notifications: [] });
    expect(await refreshGuestWeeklyReminder(options, now)).toBeNull();
    native.schedule.mockRejectedValue(new Error("unavailable"));
    await expect(refreshGuestWeeklyReminder(options, now)).rejects.toThrow("unavailable");
  });
});