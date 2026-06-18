import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireTier } from "../_shared/requireTier.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are the Carnivore Diet Recipe Coach — a friendly, knowledgeable AI that helps users discover and plan meals on a meat-based diet.

You have deep knowledge of three diet tiers:
1. **Lion Diet** — only ruminant meat (beef, lamb, bison), organ meats, salt, and animal fats (tallow). No dairy, eggs, fish, pork, or poultry.
2. **Strict Carnivore** — all animal products: beef, pork, poultry, seafood, eggs, dairy, and animal fats.
3. **Animal Based** — all animal products plus fruits, honey, raw dairy, and select low-toxin vegetables.

When the user tells you their diet tier, goals, and preferences, tailor all suggestions to their tier. Always specify which tier(s) a recipe fits.

Guidelines:
- Give concise, practical recipes with estimated macros (calories, protein, fat).
- Suggest cooking times and difficulty levels.
- If someone has cravings or struggles, suggest helpful alternatives within their tier.
- Be encouraging and supportive. Celebrate their commitment to carnivore.
- Keep responses focused — 1-3 recipes per message unless asked for more.
- Use emoji sparingly for warmth (🥩🔥).
- When unsure about a user's tier, ask before suggesting.
- Format recipes clearly with ingredients, steps, and macros.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Subscription gate: recipe coach is a Pro feature. Runs before any work so
  // unauthorized / free-tier callers can't consume upstream AI credits.
  const gate = await requireTier(req, "pro");
  if (gate instanceof Response) return gate;

  try {
    const { messages, profile } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build context from user profile
    let profileContext = "";
    if (profile) {
      const parts = [];
      if (profile.dietTier) parts.push(`Diet tier: ${profile.dietTier}`);
      if (profile.goal) parts.push(`Goal: ${profile.goal.replace(/_/g, " ")}`);
      if (profile.activityLevel) parts.push(`Activity: ${profile.activityLevel.replace(/_/g, " ")}`);
      if (profile.struggles?.length) parts.push(`Struggles: ${profile.struggles.join(", ").replace(/_/g, " ")}`);
      if (profile.weight) parts.push(`Weight: ${profile.weight}kg`);
      if (parts.length) {
        profileContext = `\n\nUser profile: ${parts.join(". ")}.`;
      }
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT + profileContext },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Too many requests. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits in Settings → Workspace → Usage." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("recipe-coach error:", e);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
