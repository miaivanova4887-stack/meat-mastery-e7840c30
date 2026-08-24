import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const setupToken = Deno.env.get("ADMIN_BOOTSTRAP_TOKEN");
  const provided = req.headers.get("x-bootstrap-token");
  if (!setupToken || provided !== setupToken) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { email, password } = await req.json();
    if (!email || !password) throw new Error("email and password required");

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let userId: string | null = null;
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: "Admin" },
    });
    if (createErr) {
      // Already exists: find and update the password instead.
      const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const existing = list?.users?.find((u) => u.email?.toLowerCase() === String(email).toLowerCase());
      if (!existing) throw createErr;
      userId = existing.id;
      await admin.auth.admin.updateUserById(userId, { password, email_confirm: true });
    } else {
      userId = created.user!.id;
    }

    const { error: roleErr } = await admin
      .from("user_roles")
      .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
    if (roleErr) throw roleErr;

    return new Response(JSON.stringify({ ok: true, userId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("bootstrap-admin failed", e);
    return new Response(JSON.stringify({ error: "Bootstrap failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
