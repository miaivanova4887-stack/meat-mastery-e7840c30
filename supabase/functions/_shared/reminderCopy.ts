// Shared helper: resolve coaching reminder push copy from CMS (content_blocks)
// with locale fallback: user locale → English → hardcoded default. {time} is
// substituted with the user's local start-time string; if {time} is absent in
// the template the substitution is a no-op (never fails the send).
//
// Sections used in content_blocks (page='coaching'):
//   - section='reminder'   — fired N minutes before a SCHEDULED session
//   - section='unscheduled'— fired for PAID-BUT-UNSCHEDULED sessions

const DEFAULTS = {
  reminder: {
    en: {
      title: "Coaching call reminder",
      body: "Your call starts at {time}.",
    },
    fr: {
      title: "Rappel : appel de coaching",
      body: "Votre appel commence à {time}.",
    },
  },
  unscheduled: {
    en: {
      title: "Schedule your coaching call",
      body: "You're paid up — pick a time that works for you.",
    },
    fr: {
      title: "Planifiez votre appel de coaching",
      body: "Votre séance est payée — choisissez l'horaire qui vous convient.",
    },
  },
} as const;

export interface ReminderCopy {
  title: string;
  body: string;
}

export type ReminderSection = "reminder" | "unscheduled";

export async function loadReminderCopy(
  admin: { from: (t: string) => any },
  section: ReminderSection = "reminder",
): Promise<Record<string, ReminderCopy>> {
  const def = DEFAULTS[section];
  const out: Record<string, ReminderCopy> = {
    en: { ...def.en },
    fr: { ...def.fr },
  };
  try {
    const { data } = await admin
      .from("content_blocks")
      .select("locale, key, value")
      .eq("page", "coaching")
      .eq("section", section);
    for (const row of (data ?? []) as Array<{ locale: string; key: string; value: string }>) {
      const loc = row.locale === "fr" ? "fr" : "en";
      if (row.key === "title" && row.value) out[loc].title = row.value;
      if (row.key === "body" && row.value) out[loc].body = row.value;
    }
  } catch (_e) {
    // Swallow — defaults already populated.
  }
  return out;
}

export function renderReminder(
  copy: Record<string, ReminderCopy>,
  locale: string | null | undefined,
  whenLocal: string,
): ReminderCopy {
  const want = locale === "fr" ? "fr" : "en";
  const tpl = copy[want] ?? copy.en ?? DEFAULTS.reminder.en;
  const sub = (s: string) => s.replaceAll("{time}", whenLocal ?? "");
  return { title: sub(tpl.title), body: sub(tpl.body) };
}
