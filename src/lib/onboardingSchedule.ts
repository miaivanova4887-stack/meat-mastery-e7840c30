/**
 * Skippable onboarding with re-prompts on Day 1, 3 and 7 after install.
 *
 * - First launch: onboarding shows; user may skip.
 * - Each milestone (0, 1, 3, 7 days since first launch) shows onboarding
 *   at most once while it's still incomplete.
 * - After Day 7 is skipped, onboarding never interrupts again.
 */
const INSTALL_KEY = "carnivore-install-date";
const SHOWN_KEY = "carnivore-onboarding-prompts-shown";
const COMPLETE_KEY = "carnivore-onboarding-complete-v3";
const ANSWERS_KEY = "carnivore-onboarding-answers";
export const ONBOARDING_MILESTONE_DAYS = [0, 1, 3, 7] as const;
const DAY_MS = 24 * 60 * 60 * 1000;

const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };

export function getInstallDate(now = Date.now()): number {
  const raw = Number(read(INSTALL_KEY));
  if (raw > 0) return raw;
  write(INSTALL_KEY, String(now));
  return now;
}

function shownMilestones(): number[] {
  try { return JSON.parse(read(SHOWN_KEY) || "[]"); } catch { return []; }
}

export function currentMilestone(now = Date.now()): number {
  const days = (now - getInstallDate(now)) / DAY_MS;
  let m = 0;
  for (const d of ONBOARDING_MILESTONE_DAYS) if (days >= d) m = d;
  return m;
}

const isComplete = () => read(COMPLETE_KEY) === "true" && !!read(ANSWERS_KEY);

/** True when the user should be sent to onboarding right now. */
export function shouldShowOnboarding(now = Date.now()): boolean {
  if (isComplete()) return false;
  return !shownMilestones().includes(currentMilestone(now));
}

/** Called when the user taps "Skip for now". */
export function skipOnboarding(now = Date.now()): void {
  const m = currentMilestone(now);
  const shown = shownMilestones();
  if (!shown.includes(m)) write(SHOWN_KEY, JSON.stringify([...shown, m]));
}
