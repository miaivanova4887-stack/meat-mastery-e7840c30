

## Gate AI Recipe Coach Button on Recipes Page for Pro+

### Problem
The AI Recipe Coach button on the Recipes page navigates freely to `/recipe-coach`. While the RecipeCoach page itself already has Pro gating internally, the entry point on the Recipes page should also show the teaser gate pattern for consistency.

### Changes — single file: `src/pages/Recipes.tsx`

1. **Import `TeaserGate`** at the top of the file
2. **Wrap the AI Coach button** (lines 366-378) in `<TeaserGate requiredTier="pro" featureName="AI Recipe Coach" mode="overlay">` so free users see it greyed out with a lock icon and can tap to trigger the upgrade drawer

### What stays the same
- Recipe library browsing — free for all users
- RecipeCoach page's own internal Pro gate — unchanged (defense in depth)
- Search, filters, favorites — all remain free

### Access Summary

| Feature | Tier |
|---------|------|
| Recipe library + search | Free |
| AI Recipe Coach | Pro |

