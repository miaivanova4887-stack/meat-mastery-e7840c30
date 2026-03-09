import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { recipeName, tags } = await req.json();
    if (!recipeName) {
      return new Response(JSON.stringify({ error: "recipeName required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create a cache key from the recipe name
    const cacheKey = recipeName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80);
    const storagePath = `${cacheKey}.png`;

    // Check if image already exists in storage
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: existing } = await supabase.storage
      .from("meal-images")
      .createSignedUrl(storagePath, 60 * 60 * 24 * 365);

    if (existing?.signedUrl) {
      // Verify the file actually exists by checking with a HEAD-like approach
      const { data: listData } = await supabase.storage
        .from("meal-images")
        .list("", { search: cacheKey });

      if (listData && listData.some((f) => f.name === `${cacheKey}.png`)) {
        const publicUrl = `${supabaseUrl}/storage/v1/object/public/meal-images/${storagePath}`;
        return new Response(JSON.stringify({ imageUrl: publicUrl }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Generate image using Gemini
    const tagHint = tags?.length ? ` (${tags.join(", ")})` : "";
    const prompt = `A photorealistic overhead food photography shot of "${recipeName}"${tagHint}. Carnivore diet meal. Beautifully plated on a dark rustic plate, dramatic lighting, shallow depth of field, professional food styling. No text or watermarks.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-image-preview",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Too many requests. Try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI image error:", response.status, t);
      return new Response(JSON.stringify({ error: "Failed to generate image" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    console.log("AI response structure:", JSON.stringify(data).slice(0, 500));
    
    // Try multiple possible response structures
    const imageData = 
      data.choices?.[0]?.message?.images?.[0]?.image_url?.url ||
      data.choices?.[0]?.message?.content?.[0]?.image_url?.url ||
      (typeof data.choices?.[0]?.message?.content === "string" && data.choices[0].message.content.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/)?.[0]) ||
      null;

    if (!imageData) {
      console.error("No image in response. Keys:", JSON.stringify(Object.keys(data)));
      return new Response(JSON.stringify({ error: "No image generated" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract base64 data
    const base64 = imageData.replace(/^data:image\/\w+;base64,/, "");
    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from("meal-images")
      .upload(storagePath, bytes, {
        contentType: "image/png",
        upsert: true,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      // Return inline base64 as fallback
      return new Response(JSON.stringify({ imageUrl: imageData }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const publicUrl = `${supabaseUrl}/storage/v1/object/public/meal-images/${storagePath}`;
    return new Response(JSON.stringify({ imageUrl: publicUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-meal-image error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
