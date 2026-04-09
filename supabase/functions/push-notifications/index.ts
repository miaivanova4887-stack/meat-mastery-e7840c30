import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webPush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Get or generate VAPID keys, stored in vapid_config table
async function getVapidKeys(supabaseAdmin: ReturnType<typeof createClient>) {
  const { data } = await supabaseAdmin
    .from("vapid_config")
    .select("public_key, private_key")
    .eq("id", 1)
    .maybeSingle();

  if (data) return { publicKey: data.public_key, privateKey: data.private_key };

  // Generate new keys
  const vapidKeys = webPush.generateVAPIDKeys();
  await supabaseAdmin.from("vapid_config").insert({
    id: 1,
    public_key: vapidKeys.publicKey,
    private_key: vapidKeys.privateKey,
  });

  return vapidKeys;
}

/** Extract and validate the authenticated user from the request */
async function getAuthUser(req: Request, supabaseAdmin: ReturnType<typeof createClient>) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return null;

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user } } = await userClient.auth.getUser();
  return user;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  try {
    // GET public key for client subscription (public endpoint)
    if (action === "vapid-public-key" || req.method === "GET") {
      const keys = await getVapidKeys(supabaseAdmin);
      return json({ publicKey: keys.publicKey });
    }

    const body = await req.json();

    // Subscribe: store push subscription (requires auth)
    if (action === "subscribe") {
      const user = await getAuthUser(req, supabaseAdmin);
      if (!user) return json({ error: "Unauthorized" }, 401);

      const { endpoint, keys } = body;
      if (!endpoint || !keys?.p256dh || !keys?.auth) {
        return json({ error: "Invalid subscription" }, 400);
      }

      await supabaseAdmin.from("push_subscriptions").upsert(
        {
          endpoint,
          keys_p256dh: keys.p256dh,
          keys_auth: keys.auth,
          user_id: user.id,
        },
        { onConflict: "endpoint" }
      );

      return json({ ok: true });
    }

    // Unsubscribe (requires auth)
    if (action === "unsubscribe") {
      const user = await getAuthUser(req, supabaseAdmin);
      if (!user) return json({ error: "Unauthorized" }, 401);

      const { endpoint } = body;
      // Only delete the user's own subscription
      await supabaseAdmin
        .from("push_subscriptions")
        .delete()
        .eq("endpoint", endpoint)
        .eq("user_id", user.id);
      return json({ ok: true });
    }

    // Send push notification to all subscribers (requires admin)
    if (action === "send") {
      const user = await getAuthUser(req, supabaseAdmin);
      if (!user) return json({ error: "Unauthorized" }, 401);

      // Check admin role
      const { data: roleData } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (!roleData) return json({ error: "Forbidden: admin role required" }, 403);

      const { title, body: notifBody, icon } = body;
      const keys = await getVapidKeys(supabaseAdmin);

      webPush.setVapidDetails(
        "mailto:noreply@lovable.app",
        keys.publicKey,
        keys.privateKey
      );

      const { data: subs } = await supabaseAdmin
        .from("push_subscriptions")
        .select("*");

      const results = await Promise.allSettled(
        (subs || []).map((sub) =>
          webPush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth },
            },
            JSON.stringify({ title, body: notifBody, icon: icon || "🔥" })
          )
        )
      );

      // Clean up expired subscriptions (410 Gone)
      const expired = (subs || []).filter(
        (_, i) =>
          results[i].status === "rejected" &&
          (results[i] as PromiseRejectedResult).reason?.statusCode === 410
      );

      if (expired.length) {
        await supabaseAdmin
          .from("push_subscriptions")
          .delete()
          .in("endpoint", expired.map((s) => s.endpoint));
      }

      return json({
        sent: results.filter((r) => r.status === "fulfilled").length,
        failed: results.filter((r) => r.status === "rejected").length,
      });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error(err);
    return json({ error: "Internal server error" }, 500);
  }
});
