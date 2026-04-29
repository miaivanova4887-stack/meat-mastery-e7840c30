import { describe, it, expect, beforeEach } from "vitest";
import { isOnboardingComplete } from "./Onboarding";

/**
 * Locks in the new-user onboarding gate. `Index.tsx` redirects to
 * `/onboarding` whenever this helper returns false, so any change to the
 * localStorage key or the strict `"true"` comparison would silently drop
 * new users straight onto the homepage.
 */
describe("isOnboardingComplete", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns false for a fresh install (empty localStorage)", () => {
    expect(isOnboardingComplete()).toBe(false);
  });

  it("returns true after onboarding completion writes 'true'", () => {
    localStorage.setItem("carnivore-onboarding-complete-v2", "true");
    expect(isOnboardingComplete()).toBe(true);
  });

  it("returns false after the Profile 'Reset onboarding' button removes the key", () => {
    localStorage.setItem("carnivore-onboarding-complete-v2", "true");
    localStorage.removeItem("carnivore-onboarding-complete-v2");
    localStorage.removeItem("carnivore-onboarding-answers");
    localStorage.removeItem("carnivore-onboarding-body");
    expect(isOnboardingComplete()).toBe(false);
  });

  it.each(["1", "yes", "TRUE", "completed", ""])(
    "returns false for non-'true' value %j (strict equality guards against accidental truthy writes)",
    (value) => {
      localStorage.setItem("carnivore-onboarding-complete-v2", value);
      expect(isOnboardingComplete()).toBe(false);
    },
  );
});
