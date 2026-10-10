import { supabase } from "@/integrations/supabase/client";

const DEVICE_KEY = "carnivore-insights-device-id";

function deviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return "unknown";
  }
}

function platform(): string {
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "web";
}

/** Fire-and-forget onboarding event; works signed in or signed out. */
export function trackOnboarding(
  eventType: "step_answered" | "completed" | "skipped",
  step: number | null,
  question: string | null,
  answers: string[] = [],
) {
  void (async () => {
    try {
      const { data } = await supabase.auth.getSession();
      await (supabase as any).from("onboarding_insights").insert({
        device_id: deviceId(),
        user_id: data.session?.user?.id ?? null,
        event_type: eventType,
        step,
        question,
        answers: answers.slice(0, 40).map((a) => String(a).slice(0, 120)),
        platform: platform(),
      });
    } catch {
      /* never block onboarding */
    }
  })();
}
