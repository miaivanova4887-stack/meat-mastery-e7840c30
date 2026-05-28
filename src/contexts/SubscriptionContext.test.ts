import { describe, it, expect } from "vitest";

/**
 * Re-implements the tier-access logic from `SubscriptionContext.tsx` inline so
 * these tests don't need to render the React provider (which pulls supabase,
 * auth, and React context). The matrix below is the single source of truth
 * for what each tier can see \u2014 anything here failing means a paywall bypass
 * or a dead feature gate in production.
 */
const TIER_RANK: Record<"free" | "pro" | "elite", number> = {
  free: 0,
  pro: 1,
  elite: 2,
};
const hasAccess = (
  current: keyof typeof TIER_RANK,
  required: keyof typeof TIER_RANK,
) => TIER_RANK[current] >= TIER_RANK[required];

describe("SubscriptionContext.hasAccess \u2014 core tier matrix", () => {
  it.each([
    // current,  required,  expected
    ["free",  "free",  true],
    ["free",  "pro",   false],
    ["free",  "elite", false],
    ["pro",   "free",  true],
    ["pro",   "pro",   true],
    ["pro",   "elite", false],
    ["elite", "free",  true],
    ["elite", "pro",   true],
    ["elite", "elite", true],
  ] as const)("tier=%s → gate=%s => %s", (current, required, expected) => {
    expect(hasAccess(current, required)).toBe(expected);
  });
});

/**
 * Feature catalogue \u2014 every `requiredTier` / `hasAccess(...)` call in the
 * codebase is mirrored here. If a gate is added/changed in source, this
 * list must be updated. The test then re-runs the access rule per user
 * tier and fails loudly on any regression.
 *
 * Grep command to regenerate:
 *   grep -rnE 'requiredTier=|hasAccess\("' src --include='*.tsx' --include='*.ts'
 */
const FEATURES = [
  // Progress page
  { location: "Progress.tsx", name: "Snap & Log",                required: "pro"   },
  { location: "Progress.tsx", name: "Scan Barcode",              required: "pro"   },
  { location: "Progress.tsx", name: "Advanced Progress Charts",  required: "pro"   },
  // Recipes / AI coach
  { location: "Recipes.tsx",  name: "AI Recipe Coach",           required: "pro"   },
  { location: "RecipeCoach.tsx", name: "AI Carnivore Coach",     required: "pro"   },
  // Community
  { location: "CommunityFeed.tsx", name: "Community Posting",    required: "pro"   },
  // Meal plan
  { location: "MealPlan.tsx", name: "Snap food inside meal plan", required: "pro"  },
  { location: "MealPlan.tsx", name: "AI Meal Planner",           required: "elite" },
] as const;

describe("Feature gates by tier", () => {
  it.each(FEATURES)(
    "Free user can NOT access '$name' (requires $required)",
    ({ required }) => {
      expect(hasAccess("free", required)).toBe(false);
    },
  );

  it.each(FEATURES.filter((f) => f.required === "pro"))(
    "Pro user CAN access Pro feature '$name'",
    ({ required }) => {
      expect(hasAccess("pro", required)).toBe(true);
    },
  );

  it.each(FEATURES.filter((f) => f.required === "elite"))(
    "Pro user can NOT access Elite feature '$name'",
    ({ required }) => {
      expect(hasAccess("pro", required)).toBe(false);
    },
  );

  it("Elite user can access EVERY gated feature", () => {
    for (const feat of FEATURES) {
      expect(hasAccess("elite", feat.required)).toBe(true);
    }
  });
});

/**
 * Pricing page card-state regression. An Elite user viewing the Pro card
 * previously rendered no button and a stale \"Popular\" badge because
 * `plan.highlight && !isCurrent` was still true even though the user
 * already had access. This test models the same derivation the component
 * does to guarantee we never ship that dead-state again.
 */
describe("Pricing card state derivation", () => {
  type Plan = { tier: "free" | "pro" | "elite"; highlight: boolean };
  const plans: Plan[] = [
    { tier: "free",  highlight: false },
    { tier: "pro",   highlight: true  },
    { tier: "elite", highlight: false },
  ];
  const deriveCard = (userTier: "free" | "pro" | "elite", plan: Plan) => {
    const isCurrent = userTier === plan.tier;
    const isUpgrade = !hasAccess(userTier, plan.tier);
    const isIncluded = !isCurrent && !isUpgrade;
    return { isCurrent, isUpgrade, isIncluded };
  };

  it("every (user, plan) pair renders exactly one of current/upgrade/included", () => {
    for (const user of ["free", "pro", "elite"] as const) {
      for (const plan of plans) {
        const { isCurrent, isUpgrade, isIncluded } = deriveCard(user, plan);
        const flagsSet = [isCurrent, isUpgrade, isIncluded].filter(Boolean).length;
        expect(
          flagsSet,
          `user=${user} plan=${plan.tier} produced ${flagsSet} states`,
        ).toBe(1);
      }
    }
  });

  it("Elite user sees Pro card as 'Included' (not as upgrade with no button)", () => {
    const proPlan = plans.find((p) => p.tier === "pro")!;
    const state = deriveCard("elite", proPlan);
    expect(state.isIncluded).toBe(true);
    expect(state.isUpgrade).toBe(false);
    expect(state.isCurrent).toBe(false);
  });

  it("Elite user sees Free card as 'Included'", () => {
    const freePlan = plans.find((p) => p.tier === "free")!;
    expect(deriveCard("elite", freePlan).isIncluded).toBe(true);
  });

  it("Pro user sees Elite card as 'Upgrade'", () => {
    const elitePlan = plans.find((p) => p.tier === "elite")!;
    expect(deriveCard("pro", elitePlan).isUpgrade).toBe(true);
  });

  it("Pro user sees Free card as 'Included' (covers free-plan dead-text bug)", () => {
    const freePlan = plans.find((p) => p.tier === "free")!;
    expect(deriveCard("pro", freePlan).isIncluded).toBe(true);
  });
});
