// Guest (signed-out) progress storage. Entries/goals live on the device and
// are uploaded to the account automatically the first time the user signs in.
import { supabase } from "@/integrations/supabase/client";

const ENTRIES_KEY = "carnivore-guest-progress-entries";
const GOALS_KEY = "carnivore-guest-progress-goals";

export interface GuestEntry {
  id: string; user_id: string; category: string; metric: string; value: number;
  unit: string; notes: string; recorded_at: string; created_at: string;
}
export interface GuestGoal {
  id: string; user_id: string; category: string; metric: string; target_value: number;
  unit: string; created_at: string; updated_at: string;
}

function read<T>(key: string): T[] {
  try { const v = JSON.parse(localStorage.getItem(key) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
}
function write(key: string, v: unknown[]) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch {/* ignore */}
}

export const getGuestEntries = () => read<GuestEntry>(ENTRIES_KEY);
export const getGuestGoals = () => read<GuestGoal>(GOALS_KEY);

export function addGuestEntry(e: { category: string; metric: string; value: number; unit: string; notes?: string; recorded_at?: string }) {
  const now = new Date().toISOString();
  const list = getGuestEntries();
  list.push({ id: crypto.randomUUID(), user_id: "guest", category: e.category, metric: e.metric, value: e.value,
    unit: e.unit, notes: e.notes || "", recorded_at: e.recorded_at || now, created_at: now });
  write(ENTRIES_KEY, list);
}
export function deleteGuestEntry(id: string): boolean {
  const list = getGuestEntries();
  const next = list.filter((e) => e.id !== id);
  write(ENTRIES_KEY, next);
  return next.length !== list.length;
}
export function upsertGuestGoal(g: { category: string; metric: string; target_value: number; unit: string }) {
  const now = new Date().toISOString();
  const list = getGuestGoals().filter((x) => !(x.category === g.category && x.metric === g.metric));
  list.push({ id: crypto.randomUUID(), user_id: "guest", ...g, created_at: now, updated_at: now });
  write(GOALS_KEY, list);
}

let syncing = false;
/** Upload any device-only entries/goals into the signed-in account, then clear them. */
export async function syncGuestProgress(userId: string): Promise<boolean> {
  if (syncing) return false;
  const entries = getGuestEntries();
  const goals = getGuestGoals();
  if (!entries.length && !goals.length) return false;
  syncing = true;
  try {
    if (entries.length) {
      const { error } = await supabase.from("progress_entries").insert(
        entries.map((e) => ({ user_id: userId, category: e.category, metric: e.metric, value: e.value,
          unit: e.unit, notes: e.notes, recorded_at: e.recorded_at })),
      );
      if (error) throw error;
      write(ENTRIES_KEY, []);
    }
    if (goals.length) {
      const { error } = await supabase.from("progress_goals").upsert(
        goals.map((g) => ({ user_id: userId, category: g.category, metric: g.metric, target_value: g.target_value,
          unit: g.unit, updated_at: g.updated_at })),
        { onConflict: "user_id,category,metric" },
      );
      if (error) throw error;
      write(GOALS_KEY, []);
    }
    return true;
  } catch (e) {
    console.warn("[GuestProgress] sync failed, will retry", e);
    return false;
  } finally {
    syncing = false;
  }
}
