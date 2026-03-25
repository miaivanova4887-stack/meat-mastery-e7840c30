import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { CustomRecipe, DietTier } from "@/data/recipes";

const STORAGE_KEY = "carnivore-custom-recipes";

export function useCustomRecipes() {
  const { user } = useAuth();
  const [recipes, setRecipes] = useState<CustomRecipe[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch user's recipes from database
  const fetchRecipes = useCallback(async () => {
    if (!user) {
      setRecipes([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("community_recipes")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (!error && data) {
      const mapped: CustomRecipe[] = data.map((r) => ({
        id: r.id,
        name: r.name,
        time: r.time,
        cal: r.cal,
        protein: r.protein,
        fat: r.fat,
        serving: r.serving,
        desc: r.description,
        tags: r.tags ?? [],
        tier: (r.diet_tiers ?? ["strict"]) as DietTier[],
        meal: r.meal_type as CustomRecipe["meal"],
        cravings: [],
        ingredients: Array.isArray(r.ingredients) ? (r.ingredients as any) : [],
        steps: r.steps ?? [],
        createdAt: r.created_at,
        isCustom: true as const,
        image_url: (r as any).image_url ?? "",
        user_id: r.user_id,
      }));
      setRecipes(mapped);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchRecipes();
  }, [fetchRecipes]);

  // One-time migration from localStorage
  useEffect(() => {
    if (!user) return;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const localRecipes = JSON.parse(raw) as any[];
      if (!localRecipes.length) {
        localStorage.removeItem(STORAGE_KEY);
        return;
      }
      const inserts = localRecipes.map((r) => ({
        name: r.name,
        time: r.time || "N/A",
        cal: r.cal || "0",
        protein: r.protein || "0g",
        fat: r.fat || "0g",
        serving: r.serving || "1 serving",
        description: r.desc || "",
        tags: r.tags || [],
        diet_tiers: r.tier || ["strict"],
        meal_type: r.meal || "dinner",
        ingredients: r.ingredients || [],
        steps: r.steps || [],
        user_id: user.id,
      }));
      supabase
        .from("community_recipes")
        .insert(inserts)
        .then(() => {
          localStorage.removeItem(STORAGE_KEY);
          fetchRecipes();
        });
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [user, fetchRecipes]);

  const addRecipe = useCallback(
    async (recipe: CustomRecipe, imageFile?: File | null) => {
      if (!user) return;

      let image_url = "";

      // Upload image first if provided
      if (imageFile) {
        const ext = imageFile.name.split(".").pop() || "jpg";
        const path = `${user.id}/${recipe.id}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("recipe-images")
          .upload(path, imageFile, { upsert: true });
        if (!uploadErr) {
          const { data: urlData } = supabase.storage
            .from("recipe-images")
            .getPublicUrl(path);
          image_url = urlData.publicUrl;
        }
      }

      const row = {
        id: recipe.id,
        name: recipe.name,
        time: recipe.time,
        cal: recipe.cal,
        protein: recipe.protein,
        fat: recipe.fat,
        serving: recipe.serving,
        description: recipe.desc || "",
        tags: recipe.tags,
        diet_tiers: recipe.tier,
        meal_type: recipe.meal,
        ingredients: recipe.ingredients as any,
        steps: recipe.steps,
        user_id: user.id,
        image_url,
      };

      const { error } = await supabase.from("community_recipes").insert(row);
      if (!error) {
        // Optimistically add to local state
        setRecipes((prev) => [
          { ...recipe, image_url, user_id: user.id },
          ...prev,
        ]);
      }
      return { error, image_url };
    },
    [user]
  );

  const deleteRecipe = useCallback(
    async (id: string) => {
      if (!user) return;
      const { error } = await supabase
        .from("community_recipes")
        .delete()
        .eq("id", id);
      if (!error) {
        setRecipes((prev) => prev.filter((r) => r.id !== id));
        // Also try to delete the image
        supabase.storage
          .from("recipe-images")
          .remove([`${user.id}/${id}.jpg`, `${user.id}/${id}.jpeg`, `${user.id}/${id}.png`, `${user.id}/${id}.webp`])
          .catch(() => {});
      }
    },
    [user]
  );

  const updateRecipe = useCallback(
    async (id: string, updates: Partial<CustomRecipe>) => {
      if (!user) return;
      const dbUpdates: any = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.time !== undefined) dbUpdates.time = updates.time;
      if (updates.cal !== undefined) dbUpdates.cal = updates.cal;
      if (updates.protein !== undefined) dbUpdates.protein = updates.protein;
      if (updates.fat !== undefined) dbUpdates.fat = updates.fat;
      if (updates.serving !== undefined) dbUpdates.serving = updates.serving;
      if (updates.desc !== undefined) dbUpdates.description = updates.desc;
      if (updates.tags !== undefined) dbUpdates.tags = updates.tags;
      if (updates.tier !== undefined) dbUpdates.diet_tiers = updates.tier;
      if (updates.meal !== undefined) dbUpdates.meal_type = updates.meal;
      if (updates.ingredients !== undefined) dbUpdates.ingredients = updates.ingredients;
      if (updates.steps !== undefined) dbUpdates.steps = updates.steps;

      const { error } = await supabase
        .from("community_recipes")
        .update(dbUpdates)
        .eq("id", id);
      if (!error) {
        setRecipes((prev) =>
          prev.map((r) => (r.id === id ? { ...r, ...updates } : r))
        );
      }
    },
    [user]
  );

  return { customRecipes: recipes, addRecipe, deleteRecipe, updateRecipe, loading };
}
