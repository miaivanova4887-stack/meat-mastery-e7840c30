import { supabase } from "@/integrations/supabase/client";

const SW_PATH = "/sw.js";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export async function getVapidPublicKey(): Promise<string | null> {
  try {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const res = await fetch(
      `https://${projectId}.supabase.co/functions/v1/push-notifications?action=vapid-public-key`
    );
    const data = await res.json();
    return data.publicKey || null;
  } catch {
    return null;
  }
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register(SW_PATH);
  } catch {
    return null;
  }
}

export async function subscribeToPush(): Promise<boolean> {
  try {
    const publicKey = await getVapidPublicKey();
    if (!publicKey) return false;

    const registration = await registerServiceWorker();
    if (!registration) return false;

    // Wait for service worker to be ready
    await navigator.serviceWorker.ready;

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    });

    const sub = subscription.toJSON();
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    await fetch(
      `https://${projectId}.supabase.co/functions/v1/push-notifications?action=subscribe`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: sub.endpoint,
          keys: sub.keys,
        }),
      }
    );

    return true;
  } catch (e) {
    console.error("Push subscription failed:", e);
    return false;
  }
}

export async function sendPushToAll(title: string, body: string): Promise<void> {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  await fetch(
    `https://${projectId}.supabase.co/functions/v1/push-notifications?action=send`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body, icon: "🔥" }),
    }
  );
}
