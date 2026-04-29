// Native FCM push integration via @capacitor/push-notifications.
// Web push remains handled by src/lib/pushNotifications.ts (VAPID).

import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { supabase } from "@/integrations/supabase/client";

export type PushConsentState = "unset" | "granted" | "denied";

/** Persist consent + (optional) preferences to the user profile. */
export async function savePushConsent(
  state: PushConsentState,
  preferences?: Record<string, boolean>,
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const patch: Record<string, unknown> = {
    push_consent: state,
    push_consent_at: new Date().toISOString(),
  };
  if (preferences) patch.notification_preferences = preferences;
  await supabase.from("profiles").update(patch).eq("id", user.id);
}

async function registerToken(token: string, platform: "android" | "ios") {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  await supabase.functions.invoke("register-device-token", {
    body: { token, platform },
  });
}

/**
 * Request native push permission and register the FCM token.
 * Returns the resulting consent state. Safe to call multiple times.
 */
export async function requestNativePush(): Promise<PushConsentState> {
  if (!Capacitor.isNativePlatform()) return "unset";

  const platform = Capacitor.getPlatform() as "android" | "ios";
  const perm = await PushNotifications.requestPermissions();
  if (perm.receive !== "granted") {
    await savePushConsent("denied");
    return "denied";
  }

  // Listen for the token (async event)
  PushNotifications.addListener("registration", async (t) => {
    try {
      await registerToken(t.value, platform);
    } catch (e) {
      console.error("token register failed", e);
    }
  });
  PushNotifications.addListener("registrationError", (err) => {
    console.error("FCM registration error", err);
  });

  await PushNotifications.register();
  await savePushConsent("granted");
  return "granted";
}

/** Fire an event that may trigger push campaigns. Non-blocking. */
export async function triggerPushEvent(
  eventName: string,
  eventData?: Record<string, unknown>,
): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.functions.invoke("push-event-trigger", {
      body: { event_name: eventName, event_data: eventData },
    });
  } catch (e) {
    // Never let messaging affect app flow
    console.warn("triggerPushEvent failed", e);
  }
}
