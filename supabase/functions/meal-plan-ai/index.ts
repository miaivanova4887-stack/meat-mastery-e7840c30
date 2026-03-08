import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are a carnivore diet meal planning AI. Generate meal plans with REAL carnivore-friendly recipes.

Diet tiers:
1. Lion Diet — only ruminant meat (beef, lamb, bison), organ meats, salt, animal fats. No dairy, eggs, fish, pork, poultry.
2. Strict Carnivore — all animal products: beef, pork, poultry, seafood, eggs, dairy, animal fats.
3. Animal Based — all animal products plus fruits, honey, raw dairy, select low-toxin vegetables.

IMPORTANT: You MUST respond with ONLY valid JSON (no markdown, no extra text).

For "single" mode, return:
{
  "meals": [{
    "slot": "breakfast|lunch|dinner|snack",
    "recipeName": "Recipe Name",
    "cal": "500",
    "protein": "40g",
    "fat": "35g",
    "time": "20 min",
    "serving": "1 serving",
    "ingredients": [{"name": "ingredient", "amount": "8 oz"}],
    "steps": ["Step 1", "Step 2"]
  }]
}

For "daily" mode, return 3-4 meals covering breakfast, lunch, dinner, and optionally snack.

For "weekly" mode, return:
{
  "days": {
    "Mon": { "meals": [...] },
    "Tue": { "meals": [...] },
    ...all 7 days
  }
}

Each meal MUST have: slot, recipeName, cal, protein, fat, time, serving, ingredients (array of {name, amount}), steps (array of strings).

Make recipes practical, varied, and delicious. Include sweet/dessert options for Animal Based tier when appropriate. Always estimate realistic macros.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { mode, dietTier, preferences, mealsPerDay, nutritionTargets, goal, cuisines } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const mealCount = mealsPerDay || 3;
    let userPrompt = `Generate a ${mode} meal plan for the "${dietTier}" diet tier.`;
    
    // Add personalization
    if (nutritionTargets) {
      userPrompt += ` Daily targets: ${nutritionTargets.calories} calories, ${nutritionTargets.protein}g protein, ${nutritionTargets.fat}g fat.`;
    }
    if (goal) {
      userPrompt += ` User goal: ${goal.replace("_", " ")}.`;
    }
    userPrompt += ` The user eats ${mealCount} meals per day.`;
    if (cuisines?.length) {
      userPrompt += ` Preferred cuisines: ${cuisines.join(", ")}. Prioritize recipes from these food cultures while keeping them carnivore-compliant.`;
    }
    
    if (preferences) {
      userPrompt += ` Preferences: ${preferences}`;
    }
    if (mode === "single") {
      userPrompt += " Return exactly 1 recipe.";
    } else if (mode === "daily") {
      userPrompt += ` Return exactly ${mealCount} meals for one day, distributing macros evenly across meals.`;
    } else {
      userPrompt += ` Return meals for all 7 days (Mon-Sun), ${mealCount} meals per day, hitting the daily macro targets.`;
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
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        stream: false,
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
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
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

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Parse JSON from the response (handle possible markdown code blocks)
    let parsed;
    try {
      const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse AI response:", content);
      return new Response(
        JSON.stringify({ error: "Failed to parse meal plan. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ plan: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("meal-plan-ai error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
