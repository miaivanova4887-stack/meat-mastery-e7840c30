import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Proxies images from the meal-images bucket, resizes them using Supabase
 * Image Transformation (render API) and returns a smaller, cache-friendly response.
 *
 * Query params:
 *   key  – cache key (e.g. "smash-burgers")
 *   w    – width (default 480)
 *   q    – quality 1-100 (default 75)
 *   f    – format: webp | jpeg (default webp)
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const key = url.searchParams.get("key");
    if (!key) {
      return new Response(JSON.stringify({ error: "key required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const width = Math.min(Number(url.searchParams.get("w")) || 480, 1200);
    const quality = Math.min(Number(url.searchParams.get("q")) || 75, 100);
    const format = url.searchParams.get("f") === "jpeg" ? "origin" : "origin";

    // Use Supabase Storage's render endpoint for on-the-fly transformation
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const storageUrl = `${supabaseUrl}/storage/v1/render/image/public/meal-images/${key}.png`;
    const transformUrl = `${storageUrl}?width=${width}&quality=${quality}&resize=contain`;

    const imgResp = await fetch(transformUrl);

    if (!imgResp.ok) {
      // Fallback to original if render not available
      const originalUrl = `${supabaseUrl}/storage/v1/object/public/meal-images/${key}.png`;
      const origResp = await fetch(originalUrl);
      if (!origResp.ok) {
        return new Response(JSON.stringify({ error: "Image not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(origResp.body, {
        headers: {
          ...corsHeaders,
          "Content-Type": origResp.headers.get("Content-Type") || "image/png",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    return new Response(imgResp.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": imgResp.headers.get("Content-Type") || "image/webp",
        "Cache-Control": "public, max-age=31536000, immutable",
        "Vary": "Accept",
      },
    });
  } catch (e) {
    console.error("optimize-image error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
