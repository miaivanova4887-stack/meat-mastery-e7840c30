import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// @ts-ignore: Deno npm specifier
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify the caller is an admin
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    // Check admin role
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) return json({ error: "Forbidden: admin role required" }, 403);

    const body = await req.json();
    const { title, notifBody, category, sendPush, sendFeed, targetPreferences } = body;

    if (!title) return json({ error: "Title is required" }, 400);

    // Save notification to database
    const { data: notification, error: insertError } = await supabaseAdmin
      .from("admin_notifications")
      .insert({
        title,
        body: notifBody || "",
        category: category || "general",
        target_preferences: targetPreferences || {},
        sent_push: !!sendPush,
        sent_feed: !!sendFeed,
        created_by: user.id,
      })
      .select()
      .single();

    if (insertError) return json({ error: insertError.message }, 500);

    let pushResult = { sent: 0, failed: 0 };

    // Send push notifications if requested
    if (sendPush) {
      // Get VAPID keys
      const { data: vapidData } = await supabaseAdmin
        .from("vapid_config")
        .select("public_key, private_key")
        .eq("id", 1)
        .maybeSingle();

      if (vapidData) {
        webPush.setVapidDetails(
          "mailto:noreply@lovable.app",
          vapidData.public_key,
          vapidData.private_key
        );

        // Get all push subscribers
        const { data: subs } = await supabaseAdmin
          .from("push_subscriptions")
          .select("*");

        if (subs && subs.length > 0) {
          const payload = JSON.stringify({
            title,
            body: notifBody || "",
            icon: "🔔",
          });

          const results = await Promise.allSettled(
            subs.map((sub) =>
              webPush.sendNotification(
                {
                  endpoint: sub.endpoint,
                  keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth },
                },
                payload
              )
            )
          );

          // Clean up expired subscriptions
          const expired = subs.filter(
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

          pushResult = {
            sent: results.filter((r) => r.status === "fulfilled").length,
            failed: results.filter((r) => r.status === "rejected").length,
          };
        }
      }
    }

    return json({
      ok: true,
      notification_id: notification.id,
      push: pushResult,
    });
  } catch (err) {
    console.error(err);
    return json({ error: "Internal server error" }, 500);
  }
});
