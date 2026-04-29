// Native FCM push integration via @capacitor/push-notifications.
// Web push remains handled by src/lib/pushNotifications.ts (VAPID).

import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { supabase } from "@/integrations/supabase/client";
import { setLocalPushConsent } from "@/lib/pushConsentLocal";

export type PushConsentState = "unset" | "granted" | "denied";

/**
 * Persist consent + (optional) preferences.
 * Always writes a local mirror so anonymous users' choices survive until
 * sign-in, when AuthContext reconciles the value into profiles.push_consent.
 */
export async function savePushConsent(
  state: PushConsentState,
  preferences?: Record<string, boolean>,
): Promise<void> {
  // Local mirror — works even when no user is signed in.
  setLocalPushConsent(state);
  const { data: { user } } = await supabase.auth.getUser();
  console.info("[Push] savePushConsent local=", state, "userPresent=", !!user);
  if (!user) return;
  const patch = {
    push_consent: state,
    push_consent_at: new Date().toISOString(),
    ...(preferences ? { notification_preferences: preferences } : {}),
  };
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
  if (!Capacitor.isNativePlatform()) {
    console.info("[Push] requestNativePush skipped — not native");
    return "unset";
  }

  const platform = Capacitor.getPlatform() as "android" | "ios";
  console.info("[Push] requestNativePush start platform=", platform);
  const perm = await PushNotifications.requestPermissions();
  console.info("[Push] requestPermissions result receive=", perm.receive);
  if (perm.receive !== "granted") {
    await savePushConsent("denied");
    return "denied";
  }

  // Listen for the token (async event)
  PushNotifications.addListener("registration", async (t) => {
    try {
      console.info("[Push] FCM token registered len=", t.value?.length ?? 0);
      await registerToken(t.value, platform);
    } catch (e) {
      console.error("[Push] token register failed", e);
    }
  });
  PushNotifications.addListener("registrationError", (err) => {
    console.error("[Push] FCM registration error", err);
  });

  await PushNotifications.register();
  console.info("[Push] PushNotifications.register() called");
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
